import test from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../server/match.mjs';
import {Room} from '../server/room.mjs';

function fixture(){
  let now=1000;
  const r=new Room('ABCDEFGH',()=>now);
  const socket=()=>({out:[],send(m){this.out.push(m);},close(){}});
  const a=socket(),b=socket();
  assert.equal(r.join(a,{create:true,version:1}),'');
  assert.equal(r.join(b,{version:1}),'');
  const send=(i,op,data={},type='action')=>{
    const m={type,op,round:r.round,rev:r.rev,seq:r.seats[i].seq+1,...data};
    r.handle(r.seats[i].wire,m);return m;
  };
  function advance(ms){now+=ms;r.pulse();}
  function start(){send(0,'ready',{value:true});send(1,'ready',{value:true});advance(3000);assert.equal(r.phase,'playing');}
  return {r,a,b,socket,send,advance,start};
}

test('both players receive matched economies, production and harvest timing',()=>{
  const m=new Match('full'),s=m.sim,times=[],deliveries=[0,0];const emit=s.emit;
  s.emit=(k,u)=>{if(k==='income'){times[u.team]??=s.time;deliveries[u.team]++;}emit(k,u);};
  for(const t of [0,1]){
    assert.equal(s.sides[t].credits,2400);assert.equal(s.population(t),6);assert.equal(s.capacity(t),24);
    assert.deepEqual(s.power(t),{used:80,total:120});assert.equal(s.produce('infantry',t),'');assert.equal(s.sides[t].credits,2280);
  }
  for(let i=0;i<180;i++)m.step();
  for(const t of [0,1]){assert.equal(s.population(t),7);assert.equal(deliveries[t],1);assert.ok(Math.abs(s.sides[t].credits-(2280+260+15))<.001);}
  assert.ok(Math.max(...times)/Math.min(...times)<=1.10);
  const routes=[0,1].map(t=>Terrain.bridges.map(b=>{
    let p=s.ready('scout',t)[0],len=0;
    for(const next of s.route(p,b)){len+=Iron.distance(p,next);p=next;}
    return len/Iron.types.scout.speed;
  }));
  for(const i of [0,1])assert.ok(Math.max(routes[0][i],routes[1][i])/Math.min(routes[0][i],routes[1][i])<=1.15);
});

test('single player retains original start, production and scripted wave',()=>{
  const s=new Iron.Skirmish(Terrain);assert.equal(s.population(1),4);
  assert.equal(s.produce('infantry'),'');for(let i=0;i<24*106;i++)s.tick(1/24);
  assert.equal(s.wave,1);assert.ok(s.population()>=7);
});

test('lobby version gates, capacity, ready revision and cancelled countdown',()=>{
  const {r,a,socket,send,advance}=fixture();
  assert.match(r.join(socket(),{version:1}),/已滿/);assert.match(r.join(socket(),{version:0}),/版本/);
  send(0,'ready',{value:true});const old=r.rev;send(1,'mode',{mode:'fog'});
  assert.equal(r.seats[0].ready,false);send(0,'ready',{value:true,rev:old});assert.equal(r.seats[0].ready,false);
  send(0,'ready',{value:true});send(1,'ready',{value:true});assert.equal(r.phase,'countdown');
  send(0,'ready',{value:false});advance(4000);assert.equal(r.match,null);
  r.disconnect(a);assert.equal(r.phase,'lobby');
});

test('only the owner commands units; replay, cancellation and round versioning',()=>{
  const {r,a,send,start}=fixture();start();const s=r.match.sim;
  const m=send(0,'produce',{unit:'infantry'},'command');r.handle(a,m);
  assert.equal(s.sides[0].queue.length,1);assert.equal(s.sides[0].credits,2280);
  send(1,'cancel',{item:s.sides[0].queue[0].id},'command');assert.equal(s.sides[0].queue.length,1);
  send(1,'order',{ids:[s.ready('tank',0)[0].id],order:'move',goal:{x:600,y:500}},'command');assert.equal(s.ready('tank',0)[0].path.length,0);
  send(0,'cancel',{item:s.sides[0].queue[0].id},'command');assert.equal(s.sides[0].credits,2400);
  send(1,'produce',{unit:'tank',round:0},'command');assert.equal(s.sides[1].queue.length,0);
  assert.equal(s.sides[1].credits,2400);
});

test('full vision does not explore; hidden buildings and units obey independent scouting',()=>{
  const m=new Match('full'),s=m.sim,scout=s.ready('scout')[0],hq=s.ready('hq',1)[0];
  assert.ok(m.snapshot(0).units.some(u=>u.id===hq.id));m.setMode('fog');
  assert.ok(!m.snapshot(0).units.some(u=>u.team===1));assert.equal(m.intel[0].sees(hq),false);
  const old={x:scout.x,y:scout.y};Object.assign(scout,{x:hq.x-40,y:hq.y});m.survey();
  assert.ok(m.snapshot(0).units.some(u=>u.id===hq.id));Object.assign(scout,old);m.survey();
  let v=m.snapshot(0);assert.ok(v.ghosts.some(g=>g.id===hq.id));assert.ok(!v.units.some(u=>u.id===hq.id));assert.ok(!('hp' in v.ghosts[0]));
  assert.match(m.command(0,{op:'order',ids:[scout.id],order:'attack',target:hq.id}),/視野/);
  m.event('fire',{u:hq,aim:s.ready('factory',1)[0]});assert.equal(m.snapshot(0).events.length,0);
  s.units=s.units.filter(u=>u!==hq);m.survey();assert.ok(m.snapshot(0).ghosts.some(g=>g.id===hq.id));
  Object.assign(scout,{x:hq.x-40,y:hq.y});m.survey();assert.ok(!m.snapshot(0).ghosts.some(g=>g.id===hq.id));
});

test('proposals require consent and expire; disconnect freezes the exact battle until readiness',()=>{
  const {r,a,b,socket,send,start,advance}=fixture();start();send(0,'offer');const id=r.proposal.id;
  send(1,'offer');assert.equal(r.proposal.id,id);send(0,'vote',{id,accept:true});assert.equal(r.mode,'full');
  send(1,'vote',{id,accept:false});assert.equal(r.mode,'full');send(0,'offer');advance(15001);assert.equal(r.proposal,null);
  send(0,'offer');send(1,'vote',{id:r.proposal.id,accept:true});assert.equal(r.mode,'fog');
  send(0,'produce',{unit:'scout'},'command');send(1,'offer');const oldState=r.match.sim.time;
  const token=r.seats[1].token;r.disconnect(b);advance(500);assert.equal(r.phase,'paused');assert.equal(r.match.sim.time,oldState);
  assert.equal(r.proposal,null);assert.match(r.join(socket(),{version:1}),/已滿|開戰/);
  const reconnect=socket();assert.equal(r.join(reconnect,{version:1,token}),'');
  assert.equal(r.team(1),1);assert.ok(reconnect.out.at(-1).world.units.every(u=>u.team===1));
  send(0,'ready',{value:true});send(1,'ready',{value:true});advance(3000);assert.equal(r.phase,'playing');advance(100);
  assert.ok(r.match.sim.time>oldState);assert.equal(r.match.sim.sides[0].queue.length,1);assert.ok(a.out.length);
});

test('timed-out player can return to a completed match; rematch swaps sides and wipes world',()=>{
  const {r,b,socket,send,start,advance}=fixture();start();
  r.disconnect(b);for(let i=0;i<6;i++){r.handle(r.seats[0].wire,{type:'ping'});advance(10000);}
  send(0,'wait');assert.equal(r.phase,'paused');
  for(let i=0;i<6;i++){r.handle(r.seats[0].wire,{type:'ping'});advance(10000);}
  send(0,'abort');assert.equal(r.result,'aborted');
  r.join(socket(),{version:1,token:r.seats[1].token});send(0,'rematch');send(1,'rematch');
  assert.equal(r.phase,'lobby');assert.equal(r.match,null);assert.equal(r.team(0),1);assert.equal(r.round,2);
  start();assert.equal(r.match.sim.sides[0].credits,2400);
});

test('headquarters destruction and same-tick draw resolve once',()=>{
  for(const result of ['red','blue','draw']){
    const m=new Match('full'),s=m.sim;
    for(const team of [0,1]){
      if(result!=='draw'&&result!==['red','blue'][team])continue;
      const h=s.ready('hq',1-team)[0],u=s.ready('tank',team)[0];h.hp=1;
      Object.assign(u,{x:h.x+25,y:h.y,focus:h.id});
    }
    m.step();assert.equal(s.end,result);const t=s.time;m.step();assert.equal(s.time,t);
  }
});

test('two fresh armies can finish a battle using regular production and orders',()=>{
  const m=new Match('full'),s=m.sim;
  for(let i=0;i<3;i++)assert.equal(m.command(0,{op:'produce',unit:'tank'}),'');
  for(let n=0;n<24*34;n++)m.step();
  const target=s.ready('hq',1)[0], army=s.units.filter(u=>u.team===0&&Iron.types[u.type].damage&&!Iron.types[u.type].structure);
  assert.equal(m.command(0,{op:'order',order:'attack',target:target.id,ids:army.map(u=>u.id)}),'');
  for(let n=0;n<24*200&&!s.end;n++)m.step();
  assert.equal(s.end,'red');
});

test('invite tools belong to the creator across reconnects, rematches and reused seats',()=>{
  const {r,socket,send,start}=fixture();
  assert.equal(r.state(0).host,true);
  assert.equal(r.state(1).host,false);
  const token=r.seats[0].token;
  r.disconnect(r.seats[0].wire);
  assert.equal(r.join(socket(),{version:1,token}),'');
  assert.equal(r.state(0).host,true);
  start();r.finish('blue');send(0,'rematch');send(1,'rematch');
  assert.deepEqual([r.state(0).team,r.state(0).host],[1,true]);
  assert.deepEqual([r.state(1).team,r.state(1).host],[0,false]);
  send(0,'leave');
  assert.equal(r.join(socket(),{version:1}),'');
  assert.equal(r.state(0).host,false);
});
