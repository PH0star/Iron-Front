import {Room} from './room.mjs';

export const roomPath=/^\/rooms\/([A-HJ-NP-Z2-9]{8})$/;
export function accept(socket,code,lookup,create){
  const wire={
    send(data){if(socket.readyState===1)socket.send(JSON.stringify(data));},
    close(reason='Room closed'){if(socket.readyState<2)socket.close(1000,reason);}
  };
  let room=null,second=0,count=0,closed=false;
  const timeout=setTimeout(()=>{if(!room)wire.close();},8000);
  const fail=error=>{wire.send({type:'error',error});wire.close();};
  socket.addEventListener('message',e=>{
    if(closed)return;
    const now=Math.floor(Date.now()/1000);if(now!==second){second=now;count=0;}
    if(++count>45||typeof e.data!=='string'||e.data.length>8192)return fail('指令過多或過大');
    let msg;try{msg=JSON.parse(e.data);}catch{return fail('訊息格式錯誤');}
    if(!msg||typeof msg!=='object'||Array.isArray(msg))return fail('訊息格式錯誤');
    if(room){room.handle(wire,msg);return;}
    if(msg.type!=='hello')return fail('請先加入房間');
    let next=lookup();
    if(!next){
      if(!msg.create||msg.token)return fail('找不到房間，請重新開房');
      next=new Room(code);
    }
    const problem=next.join(wire,msg);
    if(problem)return fail(problem);
    room=next;clearTimeout(timeout);create(room);
  });
  const disconnect=()=>{if(!closed){closed=true;clearTimeout(timeout);room?.disconnect(wire);}};
  socket.addEventListener('close',disconnect);
  socket.addEventListener('error',disconnect);
}
