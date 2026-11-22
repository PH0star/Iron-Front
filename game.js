(() => {
  'use strict';
  const $=id=>document.getElementById(id),{Skirmish,types,clamp,distance}=Iron;
  const board=$('battle'),ctx=board.getContext('2d',{alpha:false}),mini=$('radar'),mc=mini.getContext('2d',{alpha:false}),dlg=$('dialog');
  const map=Terrain.build(), W=Terrain.width,H=Terrain.height;
  const miniBase=document.createElement('canvas');miniBase.width=400;miniBase.height=255;
  const mb=miniBase.getContext('2d');mb.drawImage(map,0,0,400,255);mb.fillStyle='#11292155';mb.fillRect(0,0,400,255);
  let sim,selected=[],activated=false,paused=false,mode='',placing='',tab='units',modalType='';
  let cam={x:452,y:440,zoom:1,factor:1,w:1,h:1},pointer=null,box=null,lastPos=null,pinch=null,suppressTap=false;
  const touches=new Map(),keys=new Set();let visualTime=0,fx=[],marks=[],uiClock=0,miniClock=0,remainder=0,lastFrame=0;
  let lastTap={id:-1,t:0},statusTimer=0,noticeTimer=0,drawCatalogKey='',lastUnitKey='',lastCmdKey='';
  const short=t=>String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0');
  const squad=()=>sim.units.filter(u=>u.hp>0&&selected.includes(u.id)&&!u.team);
  const landscapeToolbar=matchMedia('(max-height:530px) and (orientation:landscape)');
  const narrowScreen=matchMedia('(max-width:780px)');
  const compact=()=>narrowScreen.matches||landscapeToolbar.matches;
  const mobileActions=document.querySelector('.mobileactions');
  const actionsHome=mobileActions.parentElement;
  const systemButtons=document.querySelector('.topright');
  function placeMobileActions(){
    if(landscapeToolbar.matches)systemButtons.before(mobileActions);
    else actionsHome.append(mobileActions);
  }
  placeMobileActions();
  landscapeToolbar.addEventListener('change',placeMobileActions);
  function awake(){Comms.init();if(!sim.end&&!paused)activated=true;}
  function pop(msg,sound=''){if(sound)Comms.play(sound);const n=$('notify');n.textContent=msg;n.style.opacity=1;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{n.style.opacity=0;},2100);$('statusText').textContent=msg;clearTimeout(statusTimer);statusTimer=setTimeout(()=>{$('statusText').textContent=sim?.end?'戰役已結束':'戰術系統就緒';},4000);}
  function event(kind,data){
    if(kind==='fire'){fx.push({kind,u:data.u,ax:data.u.x,ay:data.u.y-10,bx:data.aim.x,by:data.aim.y-11,age:0,inf:data.u.type==='infantry'||data.u.type==='scout'});if(inView(data.u)||inView(data.aim))Comms.play(data.u.type==='infantry'||data.u.type==='scout'?'rifle':'fire');}
    if(kind==='destroy'){fx.push({kind,ax:data.x,ay:data.y-9,age:0,big:types[data.type].structure});if(inView(data))Comms.play('destroy');}
    if((kind==='ready'||kind==='built')&&(sim?.network||data.team===0))pop(types[data.type].name+(kind==='ready'?'已就緒':'建造完成'),'ready');
    if(kind==='income'&&!data.team){marks.push({x:data.x,y:data.y-20,age:0,kind:'cash'});}
    if(kind==='wave')pop('雷達警報：藍軍部隊正向西岸推進','wave');
    if(kind==='end'){cancelMode();Comms.play(data.result);setTimeout(()=>showDialog('end'),90);}
  }
  function newGame(){sim=new Skirmish(Terrain,event);selected=[sim.ready('tank')[0].id];activated=false;paused=false;mode='';placing='';fx=[];marks=[];remainder=0;tab='units';cam.factor=1;cam.x=compact()?376:452;cam.y=443;lastUnitKey=lastCmdKey=drawCatalogKey='';setTray('');fit();catalog();update();updateMode();$('statusText').textContent='戰術系統就緒';}
  function fit(){const b=board.getBoundingClientRect();if(!b.width||!b.height)return;cam.w=b.width;cam.h=b.height;const ratio=Math.min(devicePixelRatio||1,1.75);
    board.width=Math.round(b.width*ratio);board.height=Math.round(b.height*ratio);
    const base=compact()?Math.min(cam.w/512,cam.h/360):Math.min(cam.w/830,cam.h/405);
    cam.zoom=clamp(base,.65,2.05)*cam.factor;contain();drawRadar();}
  function contain(){let halfW=cam.w/cam.zoom/2,halfH=cam.h/cam.zoom/2;cam.x=halfW*2>W?W/2:clamp(cam.x,halfW,W-halfW);cam.y=halfH*2>H?H/2:clamp(cam.y,halfH,H-halfH);}
  function world(p){return {x:(p.x-cam.w/2)/cam.zoom+cam.x,y:(p.y-cam.h/2)/cam.zoom+cam.y};}
  function screen(u){return {x:(u.x-cam.x)*cam.zoom+cam.w/2,y:(u.y-cam.y)*cam.zoom+cam.h/2};}
  function inView(u){return Math.abs(u.x-cam.x)<cam.w/cam.zoom/2+65&&Math.abs(u.y-cam.y)<cam.h/cam.zoom/2+95;}
  function center(x,y){cam.x=x;cam.y=y;contain();drawRadar();}
  function zoom(f,at){const before=at&&world(at);cam.factor=clamp(f,.75,2.4);fit();if(at){const after=world(at);center(cam.x+before.x-after.x,cam.y+before.y-after.y);}}
  function home(){if(sim?.network){const base=sim.ready('hq')[0];if(base)center(base.x,base.y);return;}center(compact()?376:452,443);marks.push({x:320,y:440,age:0,kind:'move'});}
  function point(e,el=board){const b=el.getBoundingClientRect();return {x:e.clientX-b.left,y:e.clientY-b.top};}
  function hit(p){
    let best=null,v=Infinity;for(const u of sim.units){if(u.hp<=0)continue;const t=types[u.type],r=t.r,extra=compact()?12:4;
      let top=t.structure?(u.type==='hq'?88:u.type==='turret'?34:62):(u.type==='infantry'?18:24);
      const dy=p.y-(u.y-top*.39),dx=p.x-u.x;
      let score=(dx/(r*1.12+extra))**2+(dy/(r*.39+top*.55+extra))**2;
      if(score<1&&score<v){v=score;best=u;}}return best;}
  function choose(ids,sound=true){selected=ids;cancelMode();if(sound&&ids.length)Comms.play('select');update();}
  function allArmy(){awake();choose(sim.units.filter(u=>!u.team&&!types[u.type].structure&&u.type!=='miner').map(u=>u.id));pop('已選取全部作戰部隊');setTray('');}
  function setTray(which){$('mobileBuild').setAttribute('aria-expanded',String(which==='prod'));$('mobileRadar').setAttribute('aria-expanded',String(which==='radar'));document.querySelector('.side').classList.toggle('prodopen',which==='prod');document.querySelector('.side').classList.toggle('radaropen',which==='radar');if(which==='radar')requestAnimationFrame(drawRadar);}
  function updateMode(){const tip=$('modeTip');tip.hidden=!mode&&!placing;tip.querySelector('span').textContent=placing?'選擇建造位置 · '+types[placing].name:mode==='attack'?'點選敵方目標或地面發動攻擊':'點選地面設定移動位置';board.style.cursor=placing||mode?'crosshair':'default';updateCommands();}
  function cancelMode(){mode='';placing='';if(sim)updateMode();}
  function command(which){
    if(sim.end||paused)return;awake();const group=squad();if(!group.length)return pop('請先選取我方單位','fail');
    if(which==='produce'){setTab('units');if(compact())setTray('prod');return;}
    if(which==='base'){setTab('build');if(compact())setTray('prod');return;}
    if(which==='army'){allArmy();return;}
    if(which==='mine'||which==='guard'||which==='stop'){sim.command(group,which);cancelMode();Comms.play('order');pop(which==='guard'?'原地警戒，接敵自動開火':which==='mine'?'採礦車開始自動作業':'已停止行動');}
    else{placing='';mode=mode===which?'':which;updateMode();Comms.play('select');}
  }
  function issue(p,forced=false){
    if(paused||sim.end)return;const target=hit(p);
    if(placing){let failure=sim.place(placing,p.x,p.y);if(failure){pop(failure,'fail');return;}let name=types[placing].name;cancelMode();pop((sim.network?'已送出建造指令：':'開始建造')+name,'queued');update();return;}
    if(!forced&&!mode&&target&&!target.team){
      if(lastTap.id===target.id&&performance.now()-lastTap.t<360&&!types[target.type].structure)choose(sim.ready(target.type).filter(inView).map(o=>o.id));
      else choose([target.id]);lastTap={id:target.id,t:performance.now()};return;
    }
    const group=squad().filter(u=>!types[u.type].structure);
    if(!group.length){if(target?.team)pop('敵方'+types[target.type].name+' · '+Math.ceil(target.hp)+' HP');else if(!target)choose([],false);return;}
    const hostile=target?.team===1&&mode!=='move',order=hostile||mode==='attack'?'attack':'move';
    if(!hostile&&Terrain.blocked(p.x,p.y)){pop('此處無法通行','fail');return;}
    const goal=hostile?target:p;
    const count=sim.command(group,order,goal,hostile?target:null);
    if(!count){pop('無法抵達指定位置','fail');return;}
    marks.push({x:goal.x,y:goal.y,age:0,kind:order});Comms.play('order');cancelMode();update();
  }
  function localDrag(e){return e.pointerType==='touch'||e.button===1||e.button===2||e.altKey;}
  board.addEventListener('contextmenu',e=>e.preventDefault());
  board.addEventListener('pointerdown',e=>{
    if(sim.end||paused)return;awake();setTray('');e.preventDefault();const p=point(e);board.setPointerCapture(e.pointerId);touches.set(e.pointerId,p);
    if(touches.size===2){const [a,b]=[...touches.values()];pinch={dist:Math.max(1,distance(a,b)),factor:cam.factor,mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};suppressTap=true;pointer=null;box=null;return;}
    if(touches.size>2)return;pointer={id:e.pointerId,origin:p,last:p,drag:false,pan:localDrag(e),right:e.button===2};lastPos=p;
  });
  board.addEventListener('pointermove',e=>{const p=point(e);lastPos=p;
    if(touches.has(e.pointerId))touches.set(e.pointerId,p);
    if(pinch&&touches.size===2){const [a,b]=[...touches.values()];const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};zoom(pinch.factor*distance(a,b)/pinch.dist,mid);center(cam.x-(mid.x-pinch.mid.x)/cam.zoom,cam.y-(mid.y-pinch.mid.y)/cam.zoom);pinch.mid=mid;return;}
    if(!pointer||pointer.id!==e.pointerId){if(!placing&&!mode)board.style.cursor=hit(world(p))?'pointer':'crosshair';return;}
    if(distance(pointer.origin,p)>5)pointer.drag=true;
    if(pointer.drag){if(pointer.pan){center(cam.x-(p.x-pointer.last.x)/cam.zoom,cam.y-(p.y-pointer.last.y)/cam.zoom);}else{box={a:pointer.origin,b:p};}}
    pointer.last=p;
  });
  function release(e,cancelled){const p=point(e);touches.delete(e.pointerId);
    if(pinch||suppressTap){pinch=null;if(!touches.size)suppressTap=false;pointer=null;box=null;return;}
    if(!pointer||pointer.id!==e.pointerId)return;
    if(!cancelled){if(box){const a=world(box.a),b=world(box.b);
      let group=sim.units.filter(u=>!u.team&&!types[u.type].structure&&u.x>=Math.min(a.x,b.x)&&u.x<=Math.max(a.x,b.x)&&u.y-9>=Math.min(a.y,b.y)&&u.y-9<=Math.max(a.y,b.y));choose(group.map(u=>u.id));}
      else if(!pointer.drag)issue(world(p),pointer.right);}
    pointer=null;box=null;
  }
  board.addEventListener('pointerup',e=>release(e,false));board.addEventListener('pointercancel',e=>release(e,true));board.addEventListener('pointerleave',()=>{if(!pointer)lastPos=null;});
  board.addEventListener('wheel',e=>{e.preventDefault();zoom(cam.factor*Math.exp(-e.deltaY*.0014),point(e));},{passive:false});
  function radarMove(e){let p=point(e,mini),b=mini.getBoundingClientRect();center(p.x/b.width*W,p.y/b.height*H);}
  mini.addEventListener('pointerdown',e=>{e.preventDefault();mini.setPointerCapture(e.pointerId);radarMove(e);});
  mini.addEventListener('pointermove',e=>{if(e.buttons)radarMove(e);});mini.addEventListener('pointerup',()=>{if(compact())setTray('');});
  function drawRadar(){
    if(!sim)return;const r=mini.getBoundingClientRect();if(r.width<1||r.height<1)return;
    const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);if(mini.width!==w||mini.height!==h){mini.width=w;mini.height=h;}
    mc.setTransform(w/r.width,0,0,h/r.height,0,0);const a=r.width/W,b=r.height/H;
    mc.drawImage(miniBase,0,0,r.width,r.height);mc.fillStyle='#b5d9a317';for(let i=1;i<9;i++)mc.fillRect(r.width*i/9,0,1,r.height);for(let i=1;i<6;i++)mc.fillRect(0,r.height*i/6,r.width,1);
    for(const o of Terrain.ore){if(sim.network&&sim.fogAt(o.x,o.y)===0)continue;mc.fillStyle='#f2ce5f';mc.fillRect(o.x*a-2,o.y*b-2,3.5,3.5);}
    if(sim.maskCanvas)mc.drawImage(sim.maskCanvas,0,0,sim.cols*sim.cell*a,sim.rows*sim.cell*b);
    for(const g of sim.ghosts||[]){mc.strokeStyle='#9b9e94';mc.strokeRect(g.x*a-2,g.y*b-2,4,4);}
    for(const u of sim.units){
      if(u.hp<=0)continue;const size=types[u.type].structure?4:3;
      mc.fillStyle=teamTint(u.faction??u.team);
      if(sim.network&&u.team){mc.beginPath();mc.moveTo(u.x*a,u.y*b-size);mc.lineTo(u.x*a+size,u.y*b+size/2);mc.lineTo(u.x*a-size,u.y*b+size/2);mc.fill();}
      else mc.fillRect(u.x*a-size/2,u.y*b-size/2,size,size);
    }
    const v={x:cam.x-cam.w/cam.zoom/2,y:cam.y-cam.h/cam.zoom/2};mc.strokeStyle='#e4eac6';mc.lineWidth=1.2;mc.strokeRect(v.x*a+.5,v.y*b+.5,cam.w/cam.zoom*a-1,cam.h/cam.zoom*b-1);
  }
  const teamTint=team=>team?'#8cc9e7':'#ff795d';
  function bar(x,y,w,val,unit){ctx.fillStyle='#161b19';ctx.fillRect(x-1,y-1,w+2,5);ctx.fillStyle='#485047';ctx.fillRect(x,y,w,3);ctx.fillStyle=val<.32?'#f1ac58':sim.network?teamTint(unit.faction):unit.team?'#98cce3':'#a2d578';ctx.fillRect(x,y,w*clamp(val,0,1),3);}
  function draw(){
    const sx=board.width/cam.w,sy=board.height/cam.h;ctx.setTransform(sx,0,0,sy,0,0);ctx.fillStyle='#384532';ctx.fillRect(0,0,cam.w,cam.h);
    ctx.translate(cam.w/2,cam.h/2);ctx.scale(cam.zoom,cam.zoom);ctx.translate(-cam.x,-cam.y);ctx.imageSmoothingEnabled=false;ctx.drawImage(map,0,0);
    if(sim.maskCanvas){
      ctx.drawImage(sim.maskCanvas,0,0,sim.cols*sim.cell,sim.rows*sim.cell);
      for(const g of sim.ghosts){if(!inView(g))continue;ctx.globalAlpha=.4;Art.draw(ctx,g.type,g.x,g.y,{team:g.team});ctx.globalAlpha=1;
        ctx.fillStyle='#d8d7b8';ctx.font='11px sans-serif';ctx.fillText('上次偵察',g.x-20,g.y+12);}
    }
    if(placing){ctx.strokeStyle='#d8e3ae65';ctx.lineWidth=1.15/cam.zoom;ctx.setLineDash([6,8]);for(const u of sim.units.filter(u=>!u.team&&types[u.type].structure&&!u.build)){ctx.beginPath();ctx.arc(u.x,u.y,215,0,Math.PI*2);ctx.stroke();}ctx.setLineDash([]);}
    const entities=sim.units.filter(u=>u.hp>0&&inView(u)).sort((a,b)=>a.y-b.y||a.id-b.id);
    for(const u of entities){
      const t=types[u.type],sel=selected.includes(u.id),r=t.r+9;
      if(sel){ctx.strokeStyle=sim.network?teamTint(u.faction):'#b5ee78';ctx.lineWidth=1.5/cam.zoom;ctx.beginPath();ctx.ellipse(u.x,u.y+1,r,r*.55,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle=sim.network?teamTint(u.faction)+'20':'#aff56012';ctx.fill();}
      if(sim.network&&u.team){ctx.fillStyle='#fff3cc';ctx.beginPath();ctx.moveTo(u.x+10,u.y+7);ctx.lineTo(u.x+16,u.y+7);ctx.lineTo(u.x+13,u.y+2);ctx.fill();}
      if(u.build)ctx.globalAlpha=.45+.4*(1-u.build/t.seconds);
      Art.draw(ctx,u.type,Math.round(u.x),Math.round(u.y),{team:u.faction??u.team,angle:u.angle,time:sim.time,moving:u.moving,loaded:!!u.haul});ctx.globalAlpha=1;
      if(sel||u.hp<u.max-.5||u.build){const height=t.structure?({hq:85,power:68,refinery:66,factory:66,barracks:46,turret:32}[u.type]):u.type==='infantry'?27:33;bar(u.x-(t.structure?21:15),u.y-height,t.structure?42:30,u.build?1-u.build/t.seconds:u.hp/u.max,u);}
      if(!u.build&&['refinery','power','factory'].includes(u.type)){for(let i=0;i<3;i++){const tt=(visualTime*.38+i/3+u.id*.22)%1;ctx.fillStyle='rgba(197,192,163,'+(.17*(1-tt))+')';ctx.beginPath();ctx.arc(u.x+(u.type==='power'?1:-3)+tt*8,u.y-(u.type==='power'?58:45)-tt*18,1.5+tt*4,0,Math.PI*2);ctx.fill();}}
    }
    for(const m of marks){if(m.kind==='cash'){ctx.fillStyle='#f7d278';ctx.font='bold 13px monospace';ctx.fillText('+260',m.x,m.y-m.age*12);continue;}
      let frac=m.age/.86;ctx.globalAlpha=1-frac;let rad=10+frac*15;ctx.strokeStyle=m.kind==='attack'?'#ff906b':'#b9fa8f';ctx.lineWidth=2/cam.zoom;
      ctx.beginPath();ctx.ellipse(m.x,m.y,rad,rad*.55,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(m.x-4,m.y);ctx.lineTo(m.x+4,m.y);ctx.moveTo(m.x,m.y-3);ctx.lineTo(m.x,m.y+3);ctx.stroke();ctx.globalAlpha=1;}
    for(const f of fx){const a=f.age;
      if(f.kind==='fire'){const n=clamp(a/.13,0,1),dx=f.bx-f.ax,dy=f.by-f.ay;ctx.strokeStyle=f.inf?'#fae6aa':'#ffd06b';ctx.lineWidth=f.inf?1.4:2.3;ctx.beginPath();ctx.moveTo(f.ax+dx*Math.max(0,n-.19),f.ay+dy*Math.max(0,n-.19));ctx.lineTo(f.ax+dx*n,f.ay+dy*n);ctx.stroke();
        if(a>.10){ctx.fillStyle='rgba(255,190,76,'+Math.max(0,1-(a-.10)*9)+')';ctx.beginPath();ctx.arc(f.bx,f.by,3+a*8,0,Math.PI*2);ctx.fill();}}
      else{const k=f.big?1.8:1;for(let i=0;i<9;i++){const angle=i*2.42+f.ax%10,r=(a*28+3)*k;ctx.fillStyle=a<.16?(i%2?'#ffe09a':'#e88538'):'rgba(62,61,53,'+Math.max(0,.72-a*.85)+')';ctx.beginPath();ctx.arc(f.ax+Math.cos(angle)*r*.6,f.ay+Math.sin(angle)*r*.38-a*10,(4+Math.sin(i)*1.5+a*5)*k,0,Math.PI*2);ctx.fill();}}
    }
    if(placing&&lastPos){const p=world(lastPos),valid=!sim.canPlace(placing,p.x,p.y);ctx.globalAlpha=.65;Art.draw(ctx,placing,p.x,p.y,{team:sim.faction??0});ctx.globalAlpha=1;ctx.strokeStyle=valid?'#b6ef82':'#ff805d';ctx.lineWidth=2;const r=types[placing].r;ctx.beginPath();ctx.ellipse(p.x,p.y,r+7,r*.68,0,0,Math.PI*2);ctx.stroke();}
    if(box){ctx.setTransform(sx,0,0,sy,0,0);const {a,b}=box;ctx.fillStyle='#b6e88722';ctx.strokeStyle='#b3e584';ctx.lineWidth=1;ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);}
  }
  const unitList=['tank','infantry','scout','miner'],buildList=['power','turret','barracks','factory','refinery'];
  const artSizes={tank:[58,51,.78],scout:[47,40,.76],miner:[58,56,.78],infantry:[24,29,.82],hq:[106,113,.83],factory:[115,88,.76],refinery:[108,92,.78],barracks:[91,64,.77],power:[91,89,.78],turret:[57,44,.76]};
  function artwork(canvas,type){
    const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);if(!type)return;const [w,h,y]=artSizes[type];
    const s=Math.min(canvas.width*.81/w,canvas.height*.91/h);
    Art.draw(c,type,canvas.width*.49,canvas.height*y,{angle:2.62,scale:s,portrait:true,team:sim.faction??0});
  }
  function catalog(){const key=tab+(sim.faction??0);if(drawCatalogKey===key)return;drawCatalogKey=key;const target=$('catalog');target.innerHTML='';
    for(const id of tab==='units'?unitList:buildList){const t=types[id],btn=document.createElement('button');btn.className='product';btn.dataset.type=id;
      btn.title=t.desc+'（'+t.seconds+' 秒）';btn.setAttribute('aria-label',(t.structure?'建造':'生產')+t.name+'，'+t.cost+' 資金');
      btn.innerHTML='<div class="artbox"><canvas width="200" height="100"></canvas><span class="artcode">'+t.code+'</span></div><div class="pdata"><strong>'+t.name+'</strong><span class="cost">'+icon('coins')+t.cost+'</span></div>';artwork(btn.querySelector('canvas'),id);
      btn.addEventListener('click',()=>{if(paused||sim.end)return;awake();
        if(t.structure){if(sim.credits<t.cost){pop('資金不足','fail');return;}mode='';placing=id;setTray('');updateMode();Comms.play('select');}
        else{const no=sim.produce(id);if(no)pop(no,'fail');else pop(t.name+(sim.network?'生產指令已送出':'已加入生產佇列'),'queued');update();}
      });target.append(btn);
    }$('unitsTab').classList.toggle('active',tab==='units');$('buildTab').classList.toggle('active',tab==='build');
  }
  function setTab(name){tab=name;catalog();}
  function updateCommands(){
    if(!sim)return;const group=squad(),u=group[0],structure=u&&types[u.type].structure;
    const commands=structure?[['produce','生產','factory',''],['base','建築','build',''],['army','全軍','squad','F']]:[['move','移動','move','M'],[u?.type==='miner'&&group.length===1?'mine':'attack',u?.type==='miner'&&group.length===1?'採礦':'攻擊',u?.type==='miner'&&group.length===1?'mine':'attack','A'],['guard','警戒','guard','G'],['stop','停止','stop','S']];
    const key=commands.map(c=>c[0]).join('')+mode+!!group.length;if(key===lastCmdKey)return;lastCmdKey=key;
    const container=$('cmds');container.innerHTML='';for(const [cmd,label,ico,key] of commands){const b=document.createElement('button');b.className='cmd'+(mode===cmd?' active':'');b.disabled=!group.length;b.title=label+(key?'（'+key+'）':'');b.setAttribute('aria-label',b.title);b.innerHTML=icon(ico)+'<span>'+label+'</span>'+(key?'<small class="key">'+key+'</small>':'');b.onclick=()=>command(cmd);container.append(b);}
  }
  function update(){
    if(!sim)return;$('credits').textContent=Math.floor(sim.credits).toLocaleString('en-US');const power=sim.power();
    $('power').innerHTML=power.used+'<small>/'+power.total+'</small>';$('power').style.color=power.used>power.total?'#f38768':'';
    $('population').innerHTML=sim.population()+'<small>/'+sim.capacity()+'</small>';$('timer').textContent=short(sim.time);
    const group=squad(),u=group[0],key=[u?.type,group.length,sim.faction??0].join('/');
    if(key!==lastUnitKey){lastUnitKey=key;artwork($('portrait'),u?.type);$('unitName').textContent=group.length>1?'聯合作戰部隊':u?types[u.type].name:'尚未選取';$('unitCode').textContent=group.length>1?'GROUP / '+group.length+' UNITS':u?types[u.type].code+' / '+types[u.type].en:'UNIT SELECTION';}
    let hp=0,max=0;group.forEach(o=>{hp+=Math.ceil(o.hp);max+=o.max;});$('healthTrack').firstElementChild.style.width=(max?hp/max*100:0)+'%';$('healthNum').textContent=max?hp+'/'+max:'—';
    const q=sim.queue[0];$('qCount').textContent=sim.queue.length+' / 6';
    const queue=$('queue'),seq=sim.queue.map(o=>o.type).join(',');
    if(queue.dataset.seq!==seq){
      queue.dataset.seq=seq;
      queue.innerHTML=q?'<div class="qline"><span></span><b></b></div><div class="qbar"><b></b></div><div class="qslots"></div>':'<div class="qempty">等待生產指令</div>';
      if(q){sim.queue.forEach((o,i)=>{const t=types[o.type],btn=document.createElement('button');btn.textContent=t.code+' ×';btn.title='取消'+t.name+'並退回未用資金';btn.setAttribute('aria-label',btn.title);btn.onclick=()=>{const amount=sim.cancelProduction(i);pop(sim.network?'已送出取消指令':'已取消生產，退回 '+amount+' 資金');update();};queue.querySelector('.qslots').append(btn);});}
    }
    if(q){queue.querySelector('.qline span').textContent=types[q.type].name+' · '+(sim.ready(types[q.type].source).length?'生產中':'等待工廠');queue.querySelector('.qline b').textContent=Math.ceil(q.remain)+'s';queue.querySelector('.qbar b').style.width=(1-q.remain/types[q.type].seconds)*100+'%';}
    $('catalog').querySelectorAll('.product').forEach(b=>{const t=types[b.dataset.type];b.classList.toggle('unavailable',sim.credits<t.cost||(!t.structure&&!sim.ready(t.source).length));});updateCommands();
  }
  function showDialog(kind){
    if(sim.network&&['pause','restart','end','objective'].includes(kind)){window.DuelUI.menu();return;}
    keys.clear();pointer=null;box=null;touches.clear();pinch=null;suppressTap=false;if(!sim.end&&!sim.network)paused=true;setTray('');modalType=kind;
    const titles={pause:['COMMAND STANDBY','戰役暫停'],help:['FIELD MANUAL','操作指南'],objective:['MISSION BRIEF','烈谷突襲'],audio:['AUDIO CONTROL','音效與配樂'],restart:['REDEPLOY','重新開始戰役'],end:['MISSION REPORT',sim.end==='victory'?'任務勝利':'基地失守']};
    $('dialogEyebrow').textContent=titles[kind][0];$('dialogTitle').textContent=titles[kind][1];$('closeDialog').hidden=kind==='end';
    const action=(id,text,primary=false)=>'<button id="'+id+'" class="dialogbtn'+(primary?' primary':'')+'">'+text+'</button>';
    let body='';
    if(kind==='pause')body='<p>戰場時間與生產佇列已暫停。</p><div class="missionstats"><span>作戰時間<b>'+short(sim.time)+'</b></span><span>擊毀敵軍<b>'+sim.kills+'</b></span></div><div class="actionrow">'+action('resumeMatch','繼續作戰',true)+action('restartMatch','重新開始')+'</div>';
    if(kind==='restart')body='<p>目前戰役進度將重設。雙方會從初始基地與資源重新部署。</p><div class="actionrow">'+action('confirmRestart','重新部署',true)+action('backPause','返回')+'</div>';
    if(kind==='end')body='<p>'+(sim.end==='victory'?'敵軍指揮部已摧毀，烈谷戰區由我方控制。':'我方指揮部已被摧毀，部隊已撤出戰區。')+'</p><div class="missionstats"><span>作戰時間<b>'+short(sim.time)+'</b></span><span>擊毀敵軍<b>'+sim.kills+'</b></span></div><div class="actionrow">'+action('confirmRestart','再次出擊',true)+'</div>';
    if(kind==='objective')body='<p>你指揮的是河谷西側的紅色部隊。藍軍會採礦擴軍並跨橋進攻。保護我方基地，摧毀東側藍軍指揮部，即可取得勝利。</p><div class="controls-list"><strong>經濟</strong><span>採礦車會自動在礦區採集，再送回精煉廠。</span><strong>擴軍</strong><span>點生產卡加入佇列。選擇建築後，在基地旁的空地部署。</span><strong>進攻</strong><span>北橋直通敵軍防線，也可由南橋繞行。點雷達可查看兩岸。</span></div><div class="actionrow">'+action('resumeMatch','返回戰場',true)+'</div>';
    if(kind==='help')body='<strong class="help-h">電腦操作</strong><div class="controls-list"><strong>左鍵 / 拖曳</strong><span>選取我軍 / 框選多個單位</span><strong>點擊或右鍵</strong><span>點地面移動，點敵軍鎖定攻擊</span><strong>方向鍵 / 雷達</strong><span>平移視野，滾輪縮放，H 回基地</span><strong>F / M / A</strong><span>選取全軍 / 移動 / 攻擊行進</span><strong>G / S / Esc</strong><span>原地警戒 / 停止 / 取消或暫停</span></div><strong class="help-h">手機操作</strong><div class="controls-list"><strong>點選 / 雙點</strong><span>選取單位 / 選取畫面內同型單位</span><strong>單指 / 雙指</strong><span>拖曳移動視野，雙指縮放戰場</span><strong>生產指揮</strong><span>點卡片生產，點建築後再點空地放置</span></div><div class="actionrow">'+action('resumeMatch','返回戰場',true)+'</div>';
    if(kind==='audio')body='<div class="dialogrow"><b>作戰音效</b><button id="toggleEffects" class="switch"></button></div><div class="dialogrow"><b>行軍配樂</b><button id="toggleMusic" class="switch"></button></div><div class="dialogrow"><label for="level">主音量 <small id="volValue"></small></label><input type="range" id="level" min="0" max="100" value="'+Math.round(Comms.prefs.volume*100)+'"></div><div class="actionrow">'+action('resumeMatch','返回戰場',true)+'</div>';
    $('dialogBody').innerHTML=body;if(!dlg.open)dlg.showModal();
    const bind=(id,fn)=>{const e=$(id);if(e)e.onclick=fn;};bind('resumeMatch',closeModal);bind('restartMatch',()=>showDialog('restart'));bind('backPause',()=>showDialog('pause'));bind('confirmRestart',()=>{dlg.close();newGame();awake();});
    if(kind==='audio'){const refresh=()=>{for(const [id,key] of [['toggleEffects','enabled'],['toggleMusic','music']]){const b=$(id);b.textContent=Comms.prefs[key]?'已開啟':'已關閉';b.classList.toggle('on',Comms.prefs[key]);b.setAttribute('aria-pressed',String(Comms.prefs[key]));}$('volValue').textContent=Math.round(Comms.prefs.volume*100)+'%';$('audioBtn').innerHTML=icon(Comms.prefs.enabled||Comms.prefs.music?'volume':'mute');};
      bind('toggleEffects',()=>{Comms.init();Comms.set('enabled',!Comms.prefs.enabled);Comms.play('select');refresh();});
      bind('toggleMusic',()=>{Comms.init();Comms.set('music',!Comms.prefs.music);refresh();});$('level').oninput=e=>{Comms.set('volume',Number(e.target.value)/100);refresh();};refresh();}
  }
  function closeModal(){if(sim.end){showDialog('end');return;}dlg.close();paused=false;modalType='';}
  dlg.addEventListener('cancel',e=>{e.preventDefault();closeModal();});dlg.addEventListener('click',e=>{if(e.target===dlg){const r=dlg.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
  $('pauseBtn').onclick=()=>showDialog(sim.end?'end':'pause');$('helpBtn').onclick=$('keysBtn').onclick=()=>showDialog('help');$('audioBtn').onclick=()=>{Comms.init();showDialog('audio');};$('objective').onclick=()=>showDialog('objective');$('closeDialog').onclick=closeModal;
  $('zoomIn').onclick=()=>zoom(cam.factor*1.2);$('zoomOut').onclick=()=>zoom(cam.factor/1.2);$('homeBtn').onclick=home;$('modeTip').querySelector('button').onclick=cancelMode;
  $('unitsTab').onclick=()=>setTab('units');$('buildTab').onclick=()=>setTab('build');
  $('mobileBuild').onclick=()=>setTray(document.querySelector('.side').classList.contains('prodopen')?'':'prod');$('mobileClose').onclick=()=>setTray('');$('mobileArmy').onclick=allArmy;$('mobileRadar').onclick=()=>setTray(document.querySelector('.side').classList.contains('radaropen')?'':'radar');
  window.addEventListener('keydown',e=>{if(e.target.closest?.('input,textarea,select,[contenteditable=true],#fieldRadio')||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||dlg.open||$('duelPanel').open)return;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
    if(e.key.startsWith('Arrow')){keys.add(e.key);return;}if(e.repeat)return;const k=e.key.toLowerCase();
    if(k==='escape'&&(mode||placing)){cancelMode();return;}if(k===' '||k==='escape'){showDialog(sim.end?'end':'pause');return;}
    if(dlg.open||paused||sim.end)return;
    const commands={m:'move',a:squad().length===1&&squad()[0].type==='miner'?'mine':'attack',g:'guard',s:'stop'};
    if(commands[k]&&!types[squad()[0]?.type]?.structure)command(commands[k]);if(k==='h')home();if(k==='f')allArmy();if(k==='?'||k==='f1'){e.preventDefault();showDialog('help');}
  });
  window.addEventListener('keyup',e=>keys.delete(e.key));window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>{lastFrame=0;keys.clear();if(!sim.network&&document.hidden&&activated&&!dlg.open&&!sim.end)showDialog('pause');});
  function frame(ts){const dt=lastFrame?Math.min(.12,(ts-lastFrame)/1000):0;lastFrame=ts;visualTime+=dt;
    if($('duelPanel').open&&!sim.network){requestAnimationFrame(frame);return;}
    if(sim.network)sim.interpolate();
    if(!paused&&!sim.end){if(activated&&!sim.network){remainder+=dt;while(remainder>=1/24&&!sim.end){sim.tick(1/24);remainder-=1/24;}}
      if(keys.size){let step=dt*450/cam.zoom;center(cam.x+((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*step,cam.y+((keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0))*step);}}
    if(!paused){for(const f of fx)f.age+=dt;fx=fx.filter(f=>f.age<(f.kind==='fire'?.23:.82));for(const m of marks)m.age+=dt;marks=marks.filter(m=>m.age<(m.kind==='cash'?1.2:.86));}
    Comms.music((activated&&!paused&&!sim.end)||modalType==='audio'&&dlg.open);
    if(!$('duelPanel').open)draw();
    uiClock+=dt;miniClock+=dt;if(uiClock>.19){uiClock=0;update();}if(miniClock>.15){miniClock=0;drawRadar();}requestAnimationFrame(frame);}
  window.BattleUI={
    startSolo:awake,
    enter(remote){if(dlg.open)dlg.close();sim=remote;paused=false;activated=true;mode='';placing='';marks=[];fx=[];remainder=0;tab='units';
      selected=[sim.ready('tank')[0]?.id].filter(Boolean);lastUnitKey=lastCmdKey=drawCatalogKey='';setTray('');home();catalog();updateMode();update();drawRadar();},
    refresh(clear){if(clear){fx=[];marks=[];cancelMode();}update();drawRadar();},
    exit(){if(dlg.open)dlg.close();newGame();}, notice:pop,event,
    preview(canvas,fog){const c=canvas.getContext('2d');c.drawImage(map,655,333,330,170,0,0,canvas.width,canvas.height);
      if(fog){const g=c.createRadialGradient(30,32,12,42,32,102);g.addColorStop(0,'transparent');g.addColorStop(1,'#101615');c.fillStyle=g;c.fillRect(0,0,canvas.width,canvas.height);}}
  };
  newGame();new ResizeObserver(()=>{fit();if(sim)draw();}).observe($('view'));window.addEventListener('resize',fit);requestAnimationFrame(frame);
})();
