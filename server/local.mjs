import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname} from 'node:path';
import {networkInterfaces} from 'node:os';
import {WebSocketServer} from 'ws';
import {radioPath,acceptRadio,maxVoiceBytes} from './radio.mjs';
import {roomPath,accept} from './transport.mjs';

const root=new URL('../',import.meta.url);
const rooms=new Map();
import {extensions,files} from './public-files.mjs';
const server=http.createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname.replace(/^\/(Iron-Front\/)?/,'')||'index.html';
  if(!['GET','HEAD'].includes(req.method)||!files.has(path)){res.writeHead(404).end();return;}
  try{
    const data=await readFile(new URL(path,root));
    res.writeHead(200,{'Content-Type':extensions[extname(path)]||'text/plain','Cache-Control':'no-cache'});
    res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404).end();}
});
const sockets=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
const mediaSockets=new WebSocketServer({noServer:true,maxPayload:maxVoiceBytes,perMessageDeflate:false});
server.on('upgrade',(req,stream,head)=>{
  const media=radioPath.exec(req.url),match=media||roomPath.exec(req.url);
  let originOk=false;
  try{originOk=!req.headers.origin||new URL(req.headers.origin).host===req.headers.host;}catch{}
  if(!match||!originOk){stream.destroy();return;}
  if(media){mediaSockets.handleUpgrade(req,stream,head,socket=>acceptRadio(socket,()=>rooms.get(match[1])));return;}
  sockets.handleUpgrade(req,stream,head,socket=>accept(socket,match[1],()=>rooms.get(match[1]),r=>rooms.set(match[1],r)));
});
setInterval(()=>{for(const [code,r] of rooms){r.pulse();if(r.closed)rooms.delete(code);}},1000/24).unref();
const host=process.env.HOST||'0.0.0.0';
server.listen(Number(process.env.PORT||8080),host,()=>{
  const port=server.address().port;
  console.log('鐵幕前線 http://localhost:'+port+'/');
  let interfaces={};
  try { interfaces=networkInterfaces(); } catch { /* Some runtimes hide network interfaces. */ }
  if(host==='0.0.0.0')for(const addresses of Object.values(interfaces))for(const ip of addresses||[]){
    if(ip.family==='IPv4'&&!ip.internal)console.log('同 Wi-Fi 裝置 http://'+ip.address+':'+port+'/');
  }
});
