(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const panel=$('duelPanel'), body=$('roomBody'), note=$('roomError');
  const modeName={full:'全圖可見',fog:'戰爭迷霧'}, teamName=['紅軍 · 西岸','藍軍 · 東岸'];
  const factionNames=['紅軍','藍軍'], factionKeys=['red','blue'];
  function presentFaction(team){
    const assigned=team===0||team===1;
    const name=assigned?factionNames[team]:'', key=assigned?factionKeys[team]:'';
    if((document.body.dataset.faction||'')===key)return;
    if(assigned)document.body.dataset.faction=key;
    else delete document.body.dataset.faction;
    const emblem=team===1?'assets/insignia-blue.svg':'assets/insignia.svg';
    document.querySelector('.brand img').src=emblem;
    document.querySelector('link[rel="icon"]').href=emblem;
    $('roomInsignia').src=emblem;$('roomInsignia').hidden=!assigned;
    $('roomFaction').hidden=!assigned;
    $('roomFaction').textContent=assigned?'你指揮'+teamName[team]:'';
    $('fieldLabel').textContent=assigned?'我方 · '+teamName[team]:'戰場視圖';
    $('productionLabel').textContent=$('mobileProductionLabel').textContent=name+'生產指揮';
    $('radarFriend').textContent='我方'+(assigned?'・'+name:'');
    $('radarFoe').textContent='敵方'+(assigned?'・'+factionNames[1-team]:'');
    $('objective').querySelector('span').textContent=assigned?'摧毀'+factionNames[1-team]+'指揮部':'摧毀敵軍指揮部';
  }
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const roomPattern=/^[A-HJ-NP-Z2-9]{8}$/;
  const args=new URL(location.href).searchParams;
  let room='', token='', socket=null, state=null, seat=-1, seq=0, retry=null;
  let remote=null, screenKey='', lastVote='', offset=0, pendingLeave=false, openedAt=0;
  const mem=new Map();
  function read(k){try{return localStorage.getItem(k)||mem.get(k)||'';}catch{return mem.get(k)||'';}}
  function write(k,v){mem.set(k,v);try{if(v)localStorage.setItem(k,v);else localStorage.removeItem(k);}catch{}}
  function openPanel(title){$('roomTitle').textContent=title;if(!panel.open)panel.showModal();}
  function showNote(msg){note.textContent=msg||'';}
  function actions(...buttons){return '<div class="room-actions">'+buttons.join('')+'</div>';}
  function btn(id,label,primary=false){return '<button id="'+id+'"'+(primary?' class="primary"':'')+'>'+label+'</button>';}
  function on(id,fn){const el=$(id);if(el)el.onclick=fn;}
  function invite(){
    const u=new URL(location.href);u.hash='';u.search='';u.searchParams.set('room',room);return u.href;
  }
  function setRoomUrl(code){
    if(!/^https?:$/.test(location.protocol))return;
    const u=new URL(location.href);if(code)u.searchParams.set('room',code);else u.searchParams.delete('room');
    history.replaceState(null,'',u);
  }
  function hint(text){if(panel.open)showNote(text);else BattleUI.notice(text,'fail');}
  function send(type,op,fields={}){
    if(socket?.readyState!==WebSocket.OPEN||!state){hint('連線尚未就緒');return false;}
    socket.send(JSON.stringify({type,op,seq:++seq,round:state.round,rev:state.rev,...fields}));return true;
  }
  const act=(op,fields)=>send('action',op,fields);
  function command(op,fields){return send('command',op,fields);}
  function startPage(message=''){
    screenKey='';openPanel('選擇作戰模式');showNote(message);
    body.innerHTML=actions(btn('solo','單人戰役'),btn('create','建立雙人好友房',true))+
      '<label for="joinCode">加入好友房</label><div class="join-row"><input id="joinCode" maxlength="8" placeholder="8 碼房號" autocomplete="off" autocapitalize="characters" spellcheck="false">'+btn('join','加入')+'</div>';
    on('solo',()=>{panel.close();showNote('');});
    on('create',()=>{Comms.init();const nums=crypto.getRandomValues(new Uint8Array(8));connect(Array.from(nums,n=>alphabet[n%alphabet.length]).join(''),true);});
    on('join',()=>{Comms.init();const id=$('joinCode').value.trim().toUpperCase();if(!roomPattern.test(id)){showNote('請輸入好友提供的 8 碼房號');return;}connect(id,false);});
    $('joinCode').onkeydown=e=>{if(e.key==='Enter')$('join').click();};
  }
  function reset(){
    clearTimeout(retry);retry=null;const old=socket;socket=null;old?.close();
    if(room)write('if-seat-'+room,'');
    setRoomUrl('');room='';token='';state=null;remote=null;seat=-1;pendingLeave=false;lastVote='';
    presentFaction(null);$('duelVote').hidden=true;$('radarMode').textContent='RADAR';
    $('duelOpen').textContent='雙人對戰';$('pauseBtn').setAttribute('aria-label','暫停戰役');
    $('pauseBtn').querySelector('span').textContent='暫停';document.querySelector('.missionname h1').textContent='烈谷突襲';
    BattleUI.exit();
  }
  function leave(){
    if(socket?.readyState===WebSocket.OPEN&&state){pendingLeave=true;act('leave');return;}
    reset();startPage();
  }
  function connecting(){
    openPanel('連接好友房');body.innerHTML='<p>房號 <b class="room-code">'+room+'</b></p>'+actions(btn('returnMenu','返回主選單'));
    on('returnMenu',()=>{reset();startPage();});
  }
  function connect(code,create,again=false){
    clearTimeout(retry);
    if(!/^https?:$/.test(location.protocol)){startPage('請從遊戲伺服器網址開啟雙人模式。');return;}
    room=code;token=read('if-seat-'+room);pendingLeave=false;connecting();
    showNote(again?'正在恢復原席位…':'正在連線…');
    let ws;
    try{
      const u=new URL('/rooms/'+room,globalThis.IRON_ROOM_ORIGIN||location.origin);
      u.protocol=u.protocol==='https:'?'wss:':'ws:';
      ws=new WebSocket(u);
    }catch{startPage('房間服務網址無效');return;}
    socket=ws;openedAt=Date.now();let rejected='';
    ws.onopen=()=>ws.send(JSON.stringify({type:'hello',version:1,create,token}));
    ws.onmessage=e=>{
      if(socket!==ws)return;
      const m=JSON.parse(e.data);
      if(m.type==='probe'){ws.send(JSON.stringify({type:'ping'}));return;}
      if(m.type==='error'){rejected=m.error;return;}
      if(m.type==='welcome'){
        token=m.token;seat=m.seat;seq=m.seq;write('if-seat-'+room,token);setRoomUrl(room);showNote('');
      }
      if(m.type==='state'){applyState(m);return;}
      if(m.type==='ack'){
        if(m.error)hint(m.error);
        if(m.op==='leave'&&pendingLeave&&!m.error){reset();startPage();}
      }
    };
    ws.onclose=e=>{
      if(socket!==ws)return;
      socket=null;screenKey='';
      if(pendingLeave||rejected||e.reason==='Seat replaced'){
        reset();startPage(rejected||(e.reason==='Seat replaced'?'原席位已在另一個視窗開啟':''));return;
      }
      if(token){connecting();showNote('連線中斷，正在嘗試回到原席位…');retry=setTimeout(()=>connect(code,false,true),1500);}
      else{reset();startPage('無法連到房間服務，請確認遊戲伺服器與網路連線。');}
    };
    ws.onerror=()=>{};
  }
  setInterval(()=>{
    if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'ping'}));
    if(socket?.readyState===WebSocket.CONNECTING&&Date.now()-openedAt>10000)socket.close();
  },4000);
  class RemoteBattle {
    constructor(){this.network=true;this.terrain=Terrain;this.maskData=null;}
    apply(world,team){
      const oldMask=this.mask,previous=this.units;
      Object.assign(this,world);this.faction=team;
      this.units=world.units.map(u=>({...u,faction:u.team,team:u.team===team?0:1}));
      if(previous&&this.mask===oldMask){
        const byId=new Map(previous.map(u=>[u.id,u]));
        for(const u of this.units){
          const old=byId.get(u.id);
          if(old&&u.moving&&Math.hypot(old.x-u.x,old.y-u.y)<25){
            u.fromX=old.x;u.fromY=old.y;u.toX=u.x;u.toY=u.y;
          }
        }
      }
      this.received=performance.now();
      this.sides=[{credits:this.credits}];
      if(this.mask!==oldMask){
        if(!this.mask){this.maskCanvas=null;this.maskData=null;}
        else{
          const c=this.maskCanvas||document.createElement('canvas');c.width=this.cols;c.height=this.rows;
          const ctx=c.getContext('2d'),im=ctx.createImageData(c.width,c.height);
          this.maskData=new Uint8Array(c.width*c.height);
          for(let i=0;i<this.maskData.length;i++){
            const val=((this.mask.charCodeAt(Math.floor(i/3))-48)>>(2*(i%3)))&3;
            this.maskData[i]=val;const at=4*i;im.data[at]=18;im.data[at+1]=24;im.data[at+2]=23;im.data[at+3]=[255,150,0][val];
          }
          ctx.putImageData(im,0,0);this.maskCanvas=c;
        }
      }
    }
    interpolate(){
      const t=Math.min(1,(performance.now()-this.received)/100);
      for(const u of this.units)if(u.toX!==undefined){u.x=u.fromX+(u.toX-u.fromX)*t;u.y=u.fromY+(u.toY-u.fromY)*t;}
    }
    fogAt(x,y){return this.maskData?this.maskData[Math.floor(y/this.cell)*this.cols+Math.floor(x/this.cell)]:2;}
    ready(type){return Iron.Skirmish.prototype.ready.call(this,type);}
    population(){return Iron.Skirmish.prototype.population.call(this);}
    capacity(){return Iron.Skirmish.prototype.capacity.call(this);}
    power(){return Iron.Skirmish.prototype.power.call(this);}
    produce(unit){return command('produce',{unit})?'':'未連線';}
    canPlace(unit,x,y){return this.fogAt(x,y)!==2?'請在視野內建造':Iron.Skirmish.prototype.canPlace.call(this,unit,x,y);}
    place(unit,x,y){const error=this.canPlace(unit,x,y);return error||(command('place',{unit,x,y})?'':'未連線');}
    cancelProduction(i){if(this.queue[i])command('cancel',{item:this.queue[i].id});}
    command(group,order,goal,target){
      const point=goal?{x:goal.x,y:goal.y}:null;
      return command('order',{ids:group.map(u=>u.id),order,goal:point,target:target?.id||0})?group.length:0;
    }
  }
  function applyState(next){
    const previous=state,changed=previous?.round!==next.round||previous?.mode!==next.mode;
    state=next;offset=next.serverTime-Date.now();presentFaction(next.team);
    if(next.world){
      const fresh=!remote||previous?.round!==next.round;
      if(fresh)remote=new RemoteBattle();
      remote.apply(next.world,next.team);
      if(fresh){
        BattleUI.enter(remote);
        document.querySelector('.missionname h1').textContent='烈谷對決';$('duelOpen').textContent='對戰房';
        $('pauseBtn').querySelector('span').textContent='選單';$('pauseBtn').setAttribute('aria-label','對戰選單');
      }else BattleUI.refresh(changed);
      if(next.phase==='playing')for(const e of next.world.events){
        if(e.kind==='income')e.data.team=0;
        BattleUI.event(e.kind,e.data);
      }
      $('radarMode').textContent=modeName[next.mode];
    }
    if(next.phase==='lobby'&&remote){remote=null;BattleUI.exit();}
    if(next.phase==='playing'&&previous?.phase!=='playing'){panel.close();showNote('');}
    const proposal=next.proposal;
    const voting=next.phase==='playing'&&proposal&&proposal.from!==seat;
    $('duelVote').hidden=!voting;
    if(voting&&proposal.id!==lastVote){
      lastVote=proposal.id;$('duelVote').open=true;
      $('duelVote').querySelector('p').textContent=proposal.mode==='full'?'切換後，雙方都會看到目前所有部隊與基地位置。':'切換後，只保留己方實際偵察過的地形與建築情報。';
      on('voteYes',()=>act('vote',{id:proposal.id,accept:true}));on('voteNo',()=>act('vote',{id:proposal.id,accept:false}));
    }
    if(next.phase!=='playing'||panel.open)renderRoom();
  }
  function renderRoom(force=false){
    if(!state)return;
    const s=state,sec=Math.max(0,Math.ceil((s.deadline-Date.now()-offset)/1000));
    const key=JSON.stringify([s.phase,s.round,s.mode,s.rev,s.team,s.host,s.result,s.seats,s.proposal?.id,sec===0]);
    if(!force&&screenKey===key&&panel.open){updateClock();return;}
    screenKey=key;showNote('');
    const titles={lobby:'雙人好友房',countdown:'作戰倒數',paused:'等待重連',playing:'對戰選單',end:'對戰結算'};
    openPanel(titles[s.phase]);
    const seats='<div class="room-seats">'+s.seats.map((p,i)=>
      '<div class="seat seat-'+factionKeys[p.team]+'"><b>'+(i===seat?'我方':'對手')+' · '+factionNames[p.team]+'</b><small>'+
      (!p.occupied?'等待入房':!p.online?'離線':p.ready?'✓ 已準備':'已入房')+'</small></div>').join('')+'</div>';
    if(s.phase==='lobby'){
      const inviteOpen=s.host&&!s.seats[1-seat].occupied;
      const code='<small>好友房號</small><b class="room-code">'+room+'</b>';
      const roomInfo=inviteOpen?'<div class="room-share"><div id="qrCode"></div><div>'+code+
        btn('copyLink','複製邀請連結')+'</div></div>':'<div class="room-id">'+code+'</div>';
      body.innerHTML=roomInfo+seats+
        '<div class="room-options">'+['full','fog'].map(m=>'<button id="opt-'+m+'" aria-pressed="'+(s.mode===m)+'"><canvas width="160" height="54"></canvas>'+modeName[m]+'</button>').join('')+'</div>'+
        actions(btn('ready',s.seats[seat].ready?'取消準備':'準備作戰',true),btn('leave','離開房間'));
      if(inviteOpen){
        const qr=qrcode(0,'M');qr.addData(invite());qr.make();$('qrCode').innerHTML=qr.createSvgTag({cellSize:3,margin:12,scalable:true});
        on('copyLink',async()=>{try{await navigator.clipboard.writeText(invite());showNote('已複製邀請連結');}catch{showNote(invite());}});
      }
      for(const m of ['full','fog']){BattleUI.preview($('opt-'+m).querySelector('canvas'),m==='fog');on('opt-'+m,()=>act('mode',{mode:m}));}
    }else if(s.phase==='countdown'){
      body.innerHTML=seats+'<p>視野模式 · '+modeName[s.mode]+'</p><b class="room-count" id="roomClock"></b>'+actions(btn('ready','取消準備'));
    }else if(s.phase==='paused'){
      const connected=s.seats.every(p=>p.online);
      body.innerHTML=seats+(connected?'<p>雙方已連線，準備後繼續原戰局。</p>'+actions(btn('ready',s.seats[seat].ready?'取消準備':'準備恢復',true)):
        '<p>戰場、生產與收入已暫停。保留席位 <b id="roomClock"></b></p>'+(sec===0?actions(btn('wait','繼續等待'),btn('abort','結束本局')):''))+actions(btn('leave','離開房間'));
      on('wait',()=>act('wait'));on('abort',()=>act('abort'));
    }else if(s.phase==='playing'){
      body.innerHTML='<p>'+modeName[s.mode]+' · 目標為摧毀'+factionNames[1-s.team]+'指揮部。</p><p>開啟選單時，對戰持續進行。</p>'+
        actions(btn('return','返回戰場',true),btn('offer',s.proposal?'等待視野提議回覆':'提議切換至'+modeName[s.mode==='full'?'fog':'full']))+actions(btn('leave','離開對戰'));
      $('offer').disabled=!!s.proposal;on('return',()=>panel.close());on('offer',()=>{act('offer');panel.close();});
    }else{
      const winner=factionKeys.indexOf(s.result);
      const result=winner<0?(s.result==='draw'?'和局 · 雙方指揮部同時被摧毀':'對戰中止 · 本局無勝負'):
        factionNames[winner]+'獲勝 · '+(winner===s.team?'我方勝利':'我方敗北');
      const time=Math.floor(s.elapsed);
      body.innerHTML='<p class="match-result">'+result+'</p><p>作戰時間 '+Math.floor(time/60)+' 分 '+time%60+' 秒</p>'+
        actions(btn('again',s.seats[seat].again?'等待對手再戰':'交換陣營再戰',true),btn('leave','離開房間'));
      $('again').disabled=s.seats[seat].again||!s.seats.every(p=>p.online);on('again',()=>act('rematch'));
    }
    on('ready',()=>act('ready',{value:!s.seats[seat].ready}));on('leave',leave);updateClock();
  }
  function updateClock(){const clock=$('roomClock');if(clock&&state)clock.textContent=Math.max(0,Math.ceil((state.deadline-Date.now()-offset)/1000))+' 秒';}
  setInterval(updateClock,200);
  function menu(){if(state&&socket?.readyState===WebSocket.OPEN)renderRoom(true);else if(room)connecting();else startPage();}
  panel.addEventListener('cancel',e=>{e.preventDefault();if(!room||state?.phase==='playing')panel.close();});
  $('duelOpen').onclick=menu;window.DuelUI={menu};
  const code=(args.get('room')||'').toUpperCase();
  if(roomPattern.test(code))connect(code,false);else startPage();
})();
