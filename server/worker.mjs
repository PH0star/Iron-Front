import assets from '../.build/public-assets.mjs';
import {radioPath,acceptRadio} from './radio.mjs';
import {roomPath,accept} from './transport.mjs';

export class DuelRoom {
  constructor(){this.room=null;this.timer=null;}
  fetch(request){
    const path=new URL(request.url).pathname,media=radioPath.exec(path);
    const code=(media||roomPath.exec(path))?.[1];
    if(!code||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
    const [client,server]=Object.values(new WebSocketPair());
    server.accept();
    if(media)acceptRadio(server,()=>this.room);
    else accept(server,code,()=>this.room,r=>{
      this.room=r;
      if(!this.timer)this.timer=setInterval(()=>{
        r.pulse();
        if(r.closed){clearInterval(this.timer);this.timer=null;this.room=null;}
      },1000/24);
    });
    return new Response(null,{status:101,webSocket:client});
  }
}
export default {
  fetch(request,env){
    const url=new URL(request.url),match=roomPath.exec(url.pathname)||radioPath.exec(url.pathname);
    if(!match){
      const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
      if(!['GET','HEAD'].includes(request.method)||!Object.hasOwn(assets,name))return new Response('Not found',{status:404});
      const [mime,content,binary]=assets[name];
      const body=binary?Uint8Array.from(atob(content),c=>c.charCodeAt(0)):content;
      return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':mime,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
    }
    const origin=request.headers.get('Origin');
    if(origin && origin!==url.origin && origin!==env.FRONTEND_ORIGIN)return new Response('Origin rejected',{status:403});
    return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(request);
  }
};
