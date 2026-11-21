import test from 'node:test';
import assert from 'node:assert/strict';
import {Room} from '../server/room.mjs';
import {acceptRadio} from '../server/radio.mjs';

class Peer extends EventTarget{
  readyState=1;out=[];
  send(data){this.out.push(data);}
  close(){this.readyState=3;this.dispatchEvent(new Event('close'));}
  message(data){this.dispatchEvent(new MessageEvent('message',{data}));}
}
function radio(room,token,round=room.round){
  const channel=new Peer();acceptRadio(channel,()=>room);
  channel.message(JSON.stringify({token,round}));return channel;
}
function battle(){
  let now=1000;const room=new Room('ABCDEFGH',()=>now);
  const a=new Peer(),b=new Peer();room.join(a,{version:1,radio:1,create:true});room.join(b,{version:1,radio:1});
  for(const p of [a,b])room.handle(p,{type:'action',op:'ready',round:1,rev:1,seq:1,value:true});
  now+=3000;room.pulse();return {room,a,b};
}
test('radio text is scoped to a live round and authoritative faction, with limits and deduplication',()=>{
  const {room,a,b}=battle();
  const message={type:'radioText',op:'chat',text:' 橋頭見！ ',round:1,seq:2,team:1};
  room.handle(a,message);room.handle(a,message);
  assert.deepEqual(b.out.filter(m=>m.type==='radioText'),[{type:'radioText',team:0,round:1,text:'橋頭見！'}]);
  for(const [j,extra] of [{round:2},{text:'長'.repeat(161)},{text:'下一句'}].entries()){
    room.handle(a,{...message,...extra,seq:j+3});assert.ok(a.out.at(-1).error);
  }
  assert.equal(b.out.filter(m=>m.type==='radioText').length,1);
  room.disconnect(b);assert.equal(room.state(0).radioReady,false);
  room.handle(a,{...message,seq:6});assert.ok(a.out.at(-1).error);
});
test('voice uses a separate authenticated channel, validates packets, and closes on pause',()=>{
  const {room,a,b}=battle();
  assert.equal(radio(room,'no-seat').readyState,3);
  assert.equal(radio(room,room.seats[0].token,9).readyState,3);
  const sender=radio(room,room.seats[0].token),pcm=new ArrayBuffer(120000);
  sender.message(pcm);assert.match(sender.out.at(-1),/尚未連線/);
  const receiver=radio(room,room.seats[1].token);sender.message(pcm);assert.strictEqual(receiver.out.at(-1),pcm);
  assert.equal(JSON.parse(sender.out.at(-1)).type,'sent');
  sender.message(pcm);assert.match(sender.out.at(-1),/頻繁/);
  sender.message(new ArrayBuffer(120002));assert.equal(sender.readyState,3);assert.equal(a.readyState,1);
  const next=radio(room,room.seats[0].token);room.disconnect(b);
  assert.equal(next.readyState,3);assert.equal(receiver.readyState,3);assert.equal(room.phase,'paused');
});
