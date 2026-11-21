// One authenticated, round-scoped media connection per occupied seat.
// Payloads are 12 kHz mono, signed 16-bit little-endian PCM (0.2–5 seconds).
export const radioPath=/^\/rooms\/([A-HJ-NP-Z2-9]{8})\/radio$/;
export const maxVoiceBytes=120_000;

export function acceptRadio(socket,lookup){
  socket.binaryType='arraybuffer';
  let room,seat,round,lastClip=-Infinity;
  const close=()=>{if(socket.readyState<2)socket.close(1000,'Radio closed');};
  const timer=setTimeout(close,8000);
  const tell=message=>socket.send(JSON.stringify(message));
  socket.addEventListener('message',({data})=>{
    if(socket.readyState!==1)return;
    if(!seat){
      if(typeof data!=='string'||data.length>256)return close();
      let hello;try{hello=JSON.parse(data);}catch{return close();}
      room=lookup();
      if(!room||room.phase!=='playing'||!room.radioReady()||hello?.round!==room.round)return close();
      seat=room.seats.find(s=>s?.wire&&s.token===hello.token);
      if(!seat)return close();
      round=room.round;const old=seat.media;seat.media=socket;
      if(old&&old!==socket&&old.readyState<2)old.close(1000,'Replaced');
      clearTimeout(timer);tell({type:'ready'});return;
    }
    if(room.phase!=='playing'||room.round!==round||seat.media!==socket||!seat.wire)return close();
    if(!(data instanceof ArrayBuffer)||data.byteLength<4800||data.byteLength>maxVoiceBytes||data.byteLength%2)return close();
    const now=room.now(),other=room.seats.find(s=>s&&s!==seat)?.media;
    if(now-lastClip<1200)return tell({error:'語音傳送太頻繁，請稍候。'});
    if(other?.readyState!==1)return tell({error:'對手語音尚未連線，可改用文字。'});
    lastClip=now;
    other.send(data);tell({type:'sent'});
  });
  socket.addEventListener('close',()=>{clearTimeout(timer);if(seat?.media===socket)seat.media=null;});
  socket.addEventListener('error',close);
}
