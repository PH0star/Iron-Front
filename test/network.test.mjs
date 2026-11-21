import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {WebSocket} from 'ws';

async function client(url){
  const ws=new WebSocket(url), messages=[];
  ws.on('message',raw=>{
    const m=JSON.parse(raw);
    if(m.type==='probe')ws.send(JSON.stringify({type:'ping'}));else messages.push(m);
  });
  await once(ws,'open');
  return {ws,send(data){ws.send(JSON.stringify(data));},
    async take(predicate){
      const until=Date.now()+8000;
      do{
        const n=messages.findIndex(predicate);
        if(n>=0)return messages.splice(n,1)[0];
        await new Promise(r=>setTimeout(r,15));
      }while(Date.now()<until);
      throw Error('Timed out waiting for room message');
    }};
}

test('HTTP entry, real sockets, separate factions, fog and seat recovery', {timeout:20000},async t=>{
  const server=spawn(process.execPath,['server/local.mjs'],{
    cwd:new URL('../',import.meta.url),env:{...process.env,HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','inherit']
  });
  t.after(()=>server.kill());
  const [line]=await once(server.stdout,'data');
  const port=/localhost:(\d+)/.exec(line.toString())[1],base='http://127.0.0.1:'+port;
  const page=await fetch(base+'/Iron-Front/');assert.equal(page.status,200);assert.match(await page.text(),/duelPanel/);
  for(const file of ['sw.js','duel.js','vendor/qrcode.js','assets/icon-512.png']){
    assert.equal((await fetch(base+'/Iron-Front/'+file)).status,200);
  }
  const url=base.replace(/^http:/,'ws:')+'/rooms/ABCDEFGH';
  const a=await client(url),b=await client(url);t.after(()=>{a.ws.terminate();b.ws.terminate();});
  a.send({type:'hello',version:1,create:true});await a.take(m=>m.type==='welcome');
  b.send({type:'hello',version:1});const ticket=await b.take(m=>m.type==='welcome');
  a.send({type:'action',op:'mode',mode:'fog',round:1,rev:1,seq:1});
  const config=await b.take(m=>m.mode==='fog');
  a.send({type:'action',op:'ready',value:true,round:1,rev:config.rev,seq:2});
  b.send({type:'action',op:'ready',value:true,round:1,rev:config.rev,seq:1});
  const play=await a.take(m=>m.phase==='playing'&&m.world);
  assert.ok(play.world.units.every(u=>u.team===0));
  const right=await b.take(m=>m.phase==='playing'&&m.world);assert.ok(right.world.units.every(u=>u.team===1));
  b.send({type:'command',op:'produce',unit:'tank',round:1,rev:right.rev,seq:2});
  await b.take(m=>m.world?.queue.some(q=>q.type==='tank'));
  b.ws.close();await a.take(m=>m.phase==='paused');
  const c=await client(url);t.after(()=>c.ws.terminate());
  c.send({type:'hello',version:1,token:ticket.token});await c.take(m=>m.type==='welcome');
  const recovered=await c.take(m=>m.phase==='paused'&&m.world);
  assert.equal(recovered.team,1);assert.equal(recovered.world.queue.length,1);assert.equal(recovered.mode,'fog');
});
