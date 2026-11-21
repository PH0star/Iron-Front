import {Match} from './match.mjs';

export const PROTOCOL=1;
const GRACE=60_000, COUNTDOWN=3000, PROPOSAL=15_000;
const modes=new Set(['fog','full']);
const key=()=>crypto.randomUUID();
function seat(host){
  return {host,token:key(),wire:null,ready:false,again:false,seq:0,replies:new Map(),lastSeen:0,away:0};
}
export class Room {
  constructor(code, now=Date.now){
    this.code=code;this.now=now;this.seats=[null,null];this.phase='lobby';this.mode='full';
    this.round=1;this.swapped=false;this.rev=1;this.deadline=0;this.proposal=null;
    this.match=null;this.result='';this.last=this.now();this.acc=0;this.lastPush=0;this.lastProbe=0;this.closed=false;
  }
  join(wire,msg){
    if(msg.version!==PROTOCOL)return '遊戲版本不同，請更新後再入房';
    let i=this.seats.findIndex(s=>s&&s.token===msg.token);
    if(msg.token&&i<0)return '原席位憑證已失效';
    if(i<0){
      if(msg.create&&this.seats.some(Boolean))return '房號已使用，請重新開房';
      if(!msg.create&&!this.seats.some(Boolean))return '找不到這個房間';
      i=this.seats.findIndex(s=>!s);
      if(i<0||this.phase!=='lobby')return '房間已滿或已開戰';
      this.seats[i]=seat(msg.create===true);
    }
    const s=this.seats[i],old=s.wire;s.wire=wire;s.lastSeen=this.now();s.away=0;
    if(old&&old!==wire)old.close('Seat replaced');
    wire.send({type:'welcome',room:this.code,token:s.token,seat:i,seq:s.seq});
    this.push(true);
    return '';
  }
  team(i){return this.swapped?1-i:i;}
  disconnect(wire){
    const s=this.seats.find(s=>s?.wire===wire);if(!s)return;
    s.wire=null;s.away=this.now()+GRACE;
    this.proposal=null;
    if(this.phase!=='end'){
      this.phase=this.match?'paused':'lobby';
      this.seats.forEach(p=>{if(p)p.ready=false;});
      this.rev++;this.deadline=this.match?s.away:0;this.acc=0;
    }
    this.push(true);
  }
  state(i){
    return {room:this.code,round:this.round,phase:this.phase,team:this.team(i),host:this.seats[i]?.host===true,mode:this.mode,
      rev:this.rev,deadline:this.deadline,serverTime:this.now(),proposal:this.proposal,result:this.result,
      elapsed:this.match?.sim.time||0,seats:this.seats.map((s,k)=>({team:this.team(k),online:!!s?.wire,
        ready:!!s?.ready,again:!!s?.again,occupied:!!s}))};
  }
  push(world=false){
    this.seats.forEach((s,i)=>{
      if(!s?.wire)return;
      const m={type:'state',...this.state(i)};
      if(world&&this.match)m.world=this.match.snapshot(this.team(i));
      s.wire.send(m);
    });
    this.lastPush=this.now();
  }
  finish(result){
    this.phase='end';this.result=result;this.proposal=null;this.deadline=0;this.rev++;
    if(this.match&&!this.match.sim.end)this.match.sim.end=result;
  }
  handle(wire,msg){
    const i=this.seats.findIndex(s=>s?.wire===wire);if(i<0)return;
    const s=this.seats[i];s.lastSeen=this.now();
    if(msg.type==='ping'){wire.send({type:'pong'});return;}
    if(!Number.isSafeInteger(msg.seq)||msg.seq<=0)return;
    if(s.replies.has(msg.seq)){wire.send(s.replies.get(msg.seq));return;}
    if(msg.seq<=s.seq){wire.send({type:'ack',seq:msg.seq,error:'這筆指令已處理'});return;}
    s.seq=msg.seq;
    let error='';
    if(msg.round!==this.round)error='對局已更新';
    else error=this.apply(i,msg)||'';
    const reply={type:'ack',seq:msg.seq,error,op:msg.op};
    s.replies.set(msg.seq,reply);if(s.replies.size>96)s.replies.delete(s.replies.keys().next().value);
    wire.send(reply);
    if(msg.op==='leave'&&!error){
      this.seats[i]=null;wire.close();
      if(this.phase==='lobby'){this.seats.forEach(p=>{if(p)p.ready=false;});this.rev++;}
    }
    if(msg.type!=='command'||error)this.push(true);
  }
  apply(i,m){
    const now=this.now(),s=this.seats[i];
    if(m.type==='command'){
      if(this.phase!=='playing')return '戰局尚未開放指令';
      if(m.rev!==this.rev)return '戰局狀態已變更，請重新下令';
      return this.match.command(this.team(i),m);
    }
    if(m.type!=='action')return '無效操作';
    if(m.op==='leave'){
      if(this.match&&this.phase!=='end')this.finish('aborted');
      else if(this.phase==='countdown'){this.phase='lobby';this.deadline=0;}
      return;
    }
    if(m.rev!==this.rev)return '房間設定已變更';
    if(m.op==='mode'&&this.phase==='lobby'&&modes.has(m.mode)){
      if(m.mode!==this.mode){this.mode=m.mode;this.rev++;this.seats.forEach(p=>{if(p)p.ready=false;});}return;
    }
    if(m.op==='ready'&&['lobby','paused','countdown'].includes(this.phase)){
      if(typeof m.value!=='boolean')return '準備狀態無效';
      s.ready=m.value;
      if(this.phase==='countdown'&&!m.value){
        this.phase=this.match?'paused':'lobby';this.deadline=0;this.rev++;
      }else if(this.phase!=='countdown'&&this.seats.every(p=>p?.wire&&p.ready)){
        this.phase='countdown';this.deadline=now+COUNTDOWN;this.rev++;
      }return;
    }
    if(m.op==='offer'&&this.phase==='playing'){
      if(this.proposal)return '已有待回覆提議';
      this.proposal={id:key(),from:i,mode:this.mode==='full'?'fog':'full',until:now+PROPOSAL};return;
    }
    if(m.op==='vote'&&this.phase==='playing'){
      const p=this.proposal;
      if(!p||p.until<=now||m.id!==p.id||i===p.from)return '這項提議已失效';
      if(m.accept===true){this.mode=p.mode;this.match.setMode(this.mode);this.rev++;}
      this.proposal=null;return;
    }
    if(this.phase==='paused'&&this.seats.some(p=>!p?.wire)&&this.deadline&&now>=this.deadline){
      if(m.op==='wait'){this.deadline=now+GRACE;return;}
      if(m.op==='abort'){this.finish('aborted');return;}
    }
    if(m.op==='rematch'&&this.phase==='end'&&this.seats.every(p=>p?.wire)){
      s.again=true;
      if(this.seats.every(p=>p.again)){
        this.swapped=!this.swapped;this.round++;this.rev++;this.match=null;this.result='';
        this.phase='lobby';this.deadline=0;this.acc=0;
        this.seats.forEach(p=>{p.ready=false;p.again=false;});
      }return;
    }
    return '目前無法進行此操作';
  }
  pulse(){
    const now=this.now(),dt=Math.min(250,Math.max(0,now-this.last));this.last=now;
    if(now-this.lastProbe>=4000){
      this.lastProbe=now;this.seats.forEach(s=>s?.wire?.send({type:'probe'}));
    }
    for(const s of this.seats)if(s?.wire&&now-s.lastSeen>18000){
      const wire=s.wire;this.disconnect(wire);wire.close();
    }
    if(this.phase==='lobby'){
      for(let i=0;i<2;i++){const s=this.seats[i];if(s&&!s.wire&&now>=s.away){this.seats[i]=null;this.rev++;this.push();}}
    }
    if(this.seats.every(s=>!s?.wire)&&this.seats.every(s=>!s||s.away<=now)){this.closed=true;return;}
    if(this.phase==='countdown'&&now>=this.deadline){
      this.match??=new Match(this.mode);this.phase='playing';this.deadline=0;this.acc=0;this.rev++;
      this.push(true);return;
    }
    if(this.proposal&&this.proposal.until<=now){this.proposal=null;this.push();}
    if(this.phase==='playing'){
      this.acc+=dt;
      while(this.acc>=1000/24&&this.phase==='playing'){
        this.acc-=1000/24;this.match.step();if(this.match.sim.end)this.finish(this.match.sim.end);
      }
      if(this.phase==='end'||now-this.lastPush>=100)this.push(true);
    }else if(now-this.lastPush>=1000)this.push();
  }
}
