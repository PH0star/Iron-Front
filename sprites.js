/* Small, pre-rendered orthographic models. Coordinates use a common ground plane. */
(() => {
  'use strict';
  const rise = 0.59;
  const TAU = Math.PI * 2;
  const unitTypes = new Set(['tank','scout','infantry','miner']);
  const cache = new Map();
  const colors = new Map();
  const hull = '#83928b', plate = '#a0aba1', edge = '#ced2b8', iron = '#525e5b';
  const dark = '#323d40', tire = '#262e30', tread = '#46504e', cement = '#979b89';
  const shadowMetal = '#637370', yellow = '#e5bc61', glass = '#86b7bf', ink = '#233539';
  const faction = team => team === 1
    ? {a:'#719eb1', b:'#abc5cb', c:'#416f8a', flag:'#84c4dd'}
    : {a:'#ae493c', b:'#d87152', c:'#873f38', flag:'#e65d42'};

  function rect(x,y,w,d,b=0) {
    const X=x+w/2, Y=y+d/2, l=x-w/2, t=y-d/2;
    return b>0 ? [[l+b,t],[X-b,t],[X,t+b],[X,Y-b],[X-b,Y],[l+b,Y],[l,Y-b],[l,t+b]]
      : [[l,t],[X,t],[X,Y],[l,Y]];
  }
  function ring(x,y,rx,ry,n=12) {
    return Array.from({length:n},(_,i)=>[x+Math.cos(i*TAU/n)*rx,y+Math.sin(i*TAU/n)*ry]);
  }
  function norm(a) {const n=Math.hypot(...a)||1; return a.map(v=>v/n);}
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  class Model {
    constructor(){this.faces=[];}
    face(points,color,lit=false) {this.faces.push({points,color,lit});}
    loft(low,high,z0,z1,color,top=color) {
      const b=low.map(([x,y])=>[x,y,z0]), t=high.map(([x,y])=>[x,y,z1]);
      for(let j=0;j<b.length;j++) {
        const k=(j+1)%b.length; this.face([b[j],b[k],t[k],t[j]],color);
      }
      this.face(t,top);
    }
    box(x,y,z,w,d,h,color,top=color,b=0){const p=rect(x,y,w,d,b);this.loft(p,p,z,z+h,color,top);}
    cap(x,y,z,w,d,color,b=0){this.face(rect(x,y,w,d,b).map(([a,v])=>[a,v,z]),color);}
    drum(x,y,z,rx,ry,h,col,n=12,top=col){const p=ring(x,y,rx,ry,n);this.loft(p,p,z,z+h,col,top);}
    cone(x,y,z,r0,r1,h,col,n=12){this.loft(ring(x,y,r0,r0,n),ring(x,y,r1,r1,n),z,z+h,col);}
    rod(a,b,r,col,n=8,endCol=col){
      const axis=norm(sub(b,a)), ref=Math.abs(axis[2])>.8?[0,1,0]:[0,0,1];
      const u=norm(cross(axis,ref)),v=cross(axis,u);
      const row=o=>Array.from({length:n},(_,i)=>o.map((t,k)=>t+r*(u[k]*Math.cos(i*TAU/n)+v[k]*Math.sin(i*TAU/n))));
      const s=row(a),e=row(b);
      for(let i=0;i<n;i++) {let j=(i+1)%n;this.face([s[i],s[j],e[j],e[i]],col);}
      this.face(s.slice().reverse(),endCol);this.face(e,endCol);
    }
  }
  function vent(m,x,y,z,w,d,n=5) {
    m.box(x,y,z,w,d,1.25,iron,dark,.6);
    for(let i=0;i<n;i++)m.box(x-w/2+1.3+(w-2.6)*i/(n-1),y,z+1.22,.75,d-1.4,.65,shadowMetal);
  }
  function fasteners(m,x,y,z,w,d) {
    for(const a of [-1,1])for(const b of [-1,1])m.cap(x+a*(w/2-1.8),y+b*(d/2-1.8),z,1.0,1,edge);
  }
  function roadWheel(m,x,y,z,r,side) {
    m.rod([x,y-1.4,z],[x,y+1.4,z],r,tire,12);
    m.rod([x,y+side*1.3,z],[x,y+side*1.78,z],r*.66,iron,10);
    m.rod([x,y+side*1.77,z],[x,y+side*2.0,z],r*.27,plate,8);
  }
  function tracks(m,len,width,height,phase=0) {
    for(const side of [-1,1]){
      const y=side*width;
      m.loft(rect(0,y,len-4,5.2,1.2),rect(0,y,len,5.8,1.5),1.2,height*.6,tire);
      m.loft(rect(0,y,len,5.8,1.5),rect(0,y,len-2,5.7,1.3),height*.6,height,tread);
      const c=len>30?6:5;
      for(let i=0;i<c;i++)roadWheel(m,(-.41+i*.82/(c-1))*len,y+side*2.1,height*.48,height*.39,side);
      for(let i=-len/2+2+phase;i<len/2-1;i+=3.1)m.box(i,y,height-.1,1.15,5.85,.65,iron);
    }
  }
  function tank(m,t,phase){
    tracks(m,38,10.4,8.1,phase);
    m.loft(rect(-.7,0,36.2,20,3),rect(.7,0,36.5,21,3),5.2,10,iron);
    m.loft(rect(.4,0,39,23.8,3.1),rect(-1.2,0,31.5,20.3,2.5),9.1,13.7,hull,plate);
    for(const y of [-11.3,11.3]){
      m.box(-.1,y,9.2,32.5,3.4,1.9,iron,hull,.85);
      for(let x=-14;x<14;x+=7.2)m.box(x,y,11,5.1,3,1,t.c,t.a,.35);
      m.box(16.3,y*.85,11.2,1.7,2.5,1.55,iron,yellow);
    }
    vent(m,-12.3,0,13.5,6.4,11.5);
    m.drum(1.3,0,13.5,8.4,7.4,1.3,dark);
    m.loft(rect(1.4,0,20,15.2,3.0),rect(.0,0,15.0,12.2,2.9),14.9,20.5,t.a,t.b);
    m.cap(-.8,4,20.55,10.5,1.5,plate,.2);
    m.drum(-1.1,-1.1,20.6,3.6,3,1.05,dark,10,iron);
    m.cap(-1.4,-1.1,21.72,3.5,.7,plate);
    m.rod([7.3,0,17.5],[15,0,17.5],2.55,iron,8);
    m.rod([14,0,17.5],[26.6,0,17.5],1.45,plate,8);
    m.rod([24.2,0,17.5],[29,0,17.5],1.87,iron,8,dark);
    m.box(-4.4,-4.3,20.45,3.1,1.2,1.2,ink,glass);
    m.rod([-7.7,4.8,17.6],[-9.6,5.1,27],.4,iron,4);
  }
  function scout(m,t,phase){
    for(const s of [-1,1])for(const x of [-11,10.5])roadWheel(m,x,s*8.3,5.1,5.1,s);
    m.box(0,0,4,30,15.5,3.6,dark,iron,2);
    m.loft(rect(0,0,35,17,2.5),rect(-.2,0,33.2,17.8,2),6.4,10.1,iron,t.a);
    m.loft(rect(6.8,0,18.8,16.5,1.8),rect(6.1,0,16,14.8,2.0),10.05,12.7,t.a,t.b);
    m.loft(rect(-2.7,0,14.8,15,2),rect(-4.8,0,9.1,12.5,1.7),10.2,17.7,ink,plate);
    for(const y of [-6.8,6.8])m.box(-4.6,y,12.4,1.1,1.4,4.4,iron);
    m.box(-4.9,0,17.62,11.8,13.4,1.15,hull,plate,1.35);
    m.drum(-5.7,0,18.7,3,2.7,2.1,t.c,8,t.b);
    m.rod([-3.2,-.2,20],[4.3,-.2,20],.88,iron,6);
    vent(m,-12.7,0,10.1,5.7,10.4,4);
    m.box(15.8,0,9.2,1.9,10.2,1.8,dark);
    for(const y of [-6.6,6.6])m.box(16.3,y,9.7,1.4,2.7,1.6,yellow);
    m.box(4.8,0,12.65,9.3,1.2,.16,edge);
    m.rod([-13.5,-5.8,10],[-15,-5.8,24],.38,dark,4);
  }
  function miner(m,t,phase,loaded){
    tracks(m,40,11.5,9,phase);
    m.box(0,0,7.8,39,24,4.1,iron,hull,2);
    m.loft(rect(-6.2,0,24,22.6,1.6),rect(-6.9,0,28,26,2),11.7,19.4,'#a7854d','#bfaa70');
    m.loft(rect(-6.9,0,27,25,1.7),rect(-6.9,0,25.8,24,1.3),19.4,20.4,edge,iron);
    m.cap(-6.8,0,20.45,23,21.9,'#7a6f50',1);
    for(let i=0;loaded&&i<12;i++){
      const x=-15.5+(i%4)*5.7+Math.sin(i)*.5,y=-7.5+Math.floor(i/4)*7;
      m.loft(ring(x,y,2.6,2.4,5),ring(x+.4,y+.2,1.5,1.2,5),20.5,22.5+(i%3)*.86,i%2?'#c79e4f':'#9a834e');
    }
    m.box(12.6,-3.8,11,12,15.3,8.4,t.a,t.b,1);
    m.loft(rect(12.8,-3.8,11.9,14.5,1.2),rect(12.2,-3.8,10.9,13.8,1.4),17.7,23.1,ink,glass);
    m.box(12.2,-3.8,23.1,12.8,15.3,1.3,t.c,t.b,1.3);
    m.box(12.4,6.7,11.7,11.8,7.3,5.6,iron,hull,.8);
    vent(m,12.1,6.6,17.3,8.4,5.6,4);
    m.rod([8.6,9.5,16.4],[8.6,9.5,24.6],1.12,dark,7);
    for(const s of [-1,1])for(let i=0;i<4;i++)m.box(-16.3+i*6.1,s*12.1,14,1.3,1.2,5.7,shadowMetal);
    for(const y of [-8,7])m.box(19.9,y,10.4,1,2.6,2, yellow);
  }
  function infantry(m,t,phase){
    const step=phase?1.8:.15;
    for(const s of [-1,1]){
      m.box(s*step+.6,s*1.75,.4,4,2.65,3,dark,iron,.4);
      m.rod([s*step,s*1.75,2.4],[0,s*1.55,8],1.4,'#6e776a',7);
    }
    m.loft(rect(0,0,4.6,5.7,.9),rect(0,0,6.3,7.6,1.1),7.1,13.1,'#737e70',hull);
    m.box(-2.75,0,8.3,2.4,5.2,5.2,iron,hull,.6);
    m.box(.1,0,7.65,5.3,6.3,1.35,dark);
    m.box(.6,0,13.1,3.7,4.2,2.7,'#c2a781',iron,.6);
    m.cone(.25,0,15.05,3.65,2.55,2.4,t.a,10);
    m.drum(.25,0,14.85,3.8,3.7,.72,iron,10,t.b);
    m.box(2.3,0,14.2,1.2,3.55,1,ink,glass);
    m.rod([.1,3.55,12.5],[2.3,4.15,10.0],1.32,t.a,6);
    m.rod([1.2,-3.1,12.5],[4.2,-2.15,10.6],1.16,hull,6);
    m.rod([1.2,3.3,10.8],[9.2,2.8,11.3],.89,dark,6);
    m.rod([6.7,3,11.2],[10.1,2.8,11.4],.57,plate,6);
  }
  function slab(m,w,d) {
    m.box(0,0,.1,w,d,2.5,iron,cement,3);
    m.cap(0,0,2.66,w-3.2,d-3.2,'#83887b',2.4);
    for(let x=-w/2+12;x<w/2-4;x+=12)m.cap(x,0,2.70,.55,d-4,'#676e65');
    for(let y=-d/2+12;y<d/2-4;y+=12)m.cap(0,y,2.72,w-4,.55,'#676e65');
  }
  function frame(m,x,y,z,w,d,h,body=cement,roof=plate){
    m.box(x,y,z,w,d,h,body,roof,1.1);
    m.box(x,y,z+h-1.25,w+1.65,d+1.65,1.65,iron,roof,1.35);
  }
  function blockWindows(m,x,y,z,w,n){
    m.box(x,y,z,w,.9,5.0,iron);
    for(let i=0;i<n;i++){
      const v=x-w/2+(i+.5)*w/n;
      m.box(v,y+.51,z+.8,w/n-1.4,.55,3.28,ink,glass);
      m.box(v,y+.8,z+2.75,w/n-1.75,.13,.7,glass);
    }
  }
  function shutter(m,x,y,z,w,h){
    m.box(x,y,z,w+3.2,1.8,h+1.5,dark,plate);
    m.box(x,y+1,z+.35,w,.6,h-1,shadowMetal);
    for(let q=1.4;q<h-1;q+=1.9)m.box(x,y+1.4,z+q,w-.6,.28,.6,iron);
    for(const s of [-1,1]) {
      m.box(x+s*(w*.5+1.25),y+.95,z,.85,.8,h,plate);
      for(let q=1.4;q<h-1.8;q+=4.4)m.box(x+s*(w*.5+1.25),y+1.42,z+q,.93,.36,2,yellow);
    }
  }
  function access(m,x,y,z,w=6.2){
    m.box(x,y,z,w+1.3,1.3,10.1,iron);
    m.box(x,y+.75,z+.3,w,.58,9.1,shadowMetal);
    m.box(x,y+1.12,z+5.2,w-1.6,.24,2.4,ink,glass);
    m.box(x+w/2-1.2,y+1.23,z+3.3,.75,.35,1.05,edge);
  }
  function stripePad(m,x,y,w,d) {
    m.cap(x,y,2.76,w,d,dark);
    const n=Math.floor(w/3.45);
    for(let i=0;i<n;i++) {
      let X=x-w/2+.5+i*3.45;
      m.face([[X,y-d/2,2.79],[X+1.65,y-d/2,2.79],[X+3.3,y+d/2,2.79],[X+1.65,y+d/2,2.79]],yellow);
    }
  }
  function crate(m,x,y,z=2.75,size=5.2) {
    m.box(x,y,z,size,size,size*.88,'#8a8063','#b2a788',.45);
    for(const s of [-1,1])m.box(x+s*size*.27,y,z+.1,.65,size+.1,size*.89,iron);
  }
  function mast(m,x,y,z,h,t) {
    m.drum(x,y,z,2.3,2,2.3,iron,8);
    m.rod([x,y,z+1],[x,y,z+h],.58,plate,6);
    m.rod([x-3.5,y,z+h-2.7],[x+3.5,y,z+h-2.7],.4,iron,4);
    m.drum(x,y,z+h-.2,.9,.9,1.1,t.flag,6);
  }
  function dish(m,x,y,z,r) {
    m.drum(x,y,z,2.6,2.6,2.6,dark,8);
    m.rod([x,y,z+1.6],[x,y,z+6.5],1.1,plate,8);
    const centre=[x,y,z+7.4], normal=norm([-.52,-.38,.77]), u=norm(cross(normal,[0,0,1])),v=cross(normal,u);
    const polar=(i,R,d)=>centre.map((a,k)=>a+R*(Math.cos(i*TAU/12)*u[k]+Math.sin(i*TAU/12)*v[k])+normal[k]*d);
    for(let i=0;i<12;i++){
      const a=polar(i,r,2),b=polar(i+1,r,2);
      m.face([centre,a,b],i%3===0?'#bec9bb':plate);
      m.rod(a,b,.34,edge,4);
    }
    const feed=centre.map((a,i)=>a+normal[i]*(r*.72+.9));
    for(const i of [1,5,9])m.rod(polar(i,r,2),feed,.27,iron,4);
    m.rod(centre,feed,.38,iron,4);
  }
  function hq(m,t) {
    slab(m,85,61);
    // Bunkered command floor with two buttressed wings.
    m.loft(rect(-.8,-2,74,48,5),rect(-.8,-2,68.5,43,4),2.7,17.2,shadowMetal,plate);
    m.box(-.8,-2,14.8,71.5,46,3.3,t.c,t.a,3.8);
    frame(m,-3.5,-4,17.7,54,33,10.7,hull,plate);
    blockWindows(m,-6,12.95,21,34.4,6);
    for(let x=-29;x<=29;x+=14.3)m.box(x,20.5,3.1,2.4,4.7,12,cement,plate,.4);
    for(const s of [-1,1]){
      m.box(31*s,-6,16.9,7.7,31,2.7,iron,plate,1);
      vent(m,31*s,-6,19.6,5.2,20,3);
    }
    // The radio tower's inclined red fascia and continuous observation glazing.
    m.loft(rect(-7.5,-7.1,33,22,3),rect(-7.5,-7.1,27,18.8,2.1),28.8,37.6,cement);
    m.loft(rect(-7.5,-7.1,27.5,19,2.1),rect(-7.5,-7.1,30.4,22.2,2.2),37.5,43.1,ink,glass);
    for(const x of [-17,-10,-3,3])m.box(x,3.3,38.2,1.0,1,4.65,shadowMetal);
    m.box(-7.5,-7.1,42.9,33,24.9,2,t.c,t.b,3);
    m.loft(rect(-7.5,-7.1,33.5,25.3,3),rect(-7.5,-7.1,25.3,17.6,2.1),44.6,48.5,t.a,t.b);
    m.cap(-7.5,-7,48.56,17.5,10,iron,1.1);
    dish(m,-7.5,-7,48.7,9.6);
    mast(m,-22.5,-16,28.7,34,t);
    m.rod([-22.5,-16,54.4],[-11.8,-16,54.4],.33,plate,4);
    m.face([[-22,-16,54.1],[-12,-15.4,53.5],[-14,-15.7,50.4],[-12.8,-15.2,48.9],[-22,-16,49.4]].reverse(),t.flag,true);
    frame(m,17,7.3,18.3,11,11,8.6,iron,hull);
    vent(m,17,7.3,27.35,9,7.2);
    shutter(m,6.0,21,2.8,14.5,12.7);
    stripePad(m,6.0,26.4,18.3,2.8);
    crate(m,33,22.5); crate(m,38,21.8,2.75,4);
  }
  function pitched(m,x,y,z,w,d,riseH,colors3){
    const X=w/2,Y=d/2,a=[x-X,y-Y,z],b=[x+X,y-Y,z],c=[x+X,y+Y,z],e=[x-X,y+Y,z];
    const p=[x-X,y,z+riseH],q=[x+X,y,z+riseH];
    m.face([a,b,q,p],colors3[0]);m.face([p,q,c,e],colors3[1]);
    m.face([b,c,q],colors3[2]);m.face([e,a,p],colors3[2]);
  }
  function factory(m,t) {
    slab(m,94,62);
    frame(m,-2,-1,2.75,75,44,24,shadowMetal,plate);
    m.box(-2,-1,18.6,76,45,3.15,t.c,t.a,1.3);
    for(const y of [-11.7,9.4]){
      pitched(m,-2,y,26.9,77,21.3,7.8,[hull,plate,iron]);
      for(let x=-36;x<36;x+=5.9)pitched(m,x,y,27.15,.60,21.3,7.8,[edge,hull,iron]);
      m.box(-2,y,34.4,77,1.4,.9,iron,plate);
      m.box(-9,y+4.0,30.9,23,5.6,1,iron,glass,.3);
      for(let x=-18;x<=0;x+=4.4)m.box(x,y+4.0,31.8,.6,5.65,.42,plate);
    }
    shutter(m,-10,21.4,2.8,26,17.8);
    m.box(-10,22.9,21.1,31.5,3.8,2.6,t.c,t.b,.5);
    stripePad(m,-10,26.5,30,3);
    for(const x of [-35,7,30])m.box(x,21.3,2.8,2.6,2.1,21.5,iron,plate);
    blockWindows(m,19.7,21.3,13.5,17.5,3);
    access(m,19.8,21.55,2.8);
    for(let j=0;j<3;j++){
      const x=10.8+j*8.5;
      m.drum(x,-16.1,28,2.7,2.7,4.2,iron,8);
      m.drum(x,-16.1,32,1.9,1.9,8+j%2*4.7,shadowMetal,8);
      m.drum(x,-16.1,39.0+j%2*4.7,2.25,2.25,1.45,iron,8,dark);
    }
    for(let i=0;i<3;i++)crate(m,39.7,-10+i*6);
  }
  function barracks(m,t) {
    slab(m,70,49);
    frame(m,-3,-2,2.75,54,32.5,12,cement);
    m.box(-3,-2,11.7,55,33.4,2.62,t.c,t.a,1.2);
    pitched(m,-3,-2,15.2,57,35.6,9.6,[t.b,t.a,t.c]);
    for(let x=-28.8;x<24;x+=7.2)pitched(m,x,-2,15.5,.95,35.55,9.6,[plate,iron,iron]);
    m.box(-3,-2,24.75,57,1.6,.9,iron,plate);
    for(const x of [-20,13])blockWindows(m,x,14.53,6.3,12.8,3);
    frame(m,-4.2,15.8,2.8,13,6.5,9.8,iron,plate);
    access(m,-4.2,19.15,2.8,6.6);
    stripePad(m,-4.2,21.8,11.7,1.9);
    vent(m,13.5,-1,24.2,7,5.5,4);
    mast(m,28.9,-13.3,2.8,27,t);
    crate(m,27.6,8.5);crate(m,28,15.2);
  }
  function power(m,t) {
    slab(m,68,53);
    frame(m,-4,-3,2.75,51,34,10,iron,hull);
    for(const [x,y,H,R] of [[-15,-6,30,12.4],[11,-5,25,11.2]]) {
      m.drum(x,y,12.8,R,R,2.5,iron,12);
      m.cone(x,y,15.3,R*.97,R*.62,H*.52,cement,12);
      m.cone(x,y,15.3+H*.52,R*.62,R*.7,H*.24,'#a5aba0',12);
      m.cone(x,y,15.3+H*.76,R*.7,R*.8,H*.16,t.a,12);
      m.cone(x,y,15.3+H*.92,R*.8,R*.82,H*.11,plate,12);
      m.drum(x,y,15.4+H*1.03,R*.67,R*.67,.24,dark,12,ink);
      for(const n of [-1,0,1])m.box(x+n*R*.3,y,15.65+H*1.03,.7,R*(n?1.04:1.25),.25,iron);
    }
    for(const x of [-19,-6,7]) {
      m.box(x,16,2.85,7.2,7.2,8.5,iron,plate,.6);
      m.rod([x,16,10.8],[x,16,19.7],.85,yellow,6);
      for(let z=13;z<18;z+=2)m.drum(x,16,z,2.1,2.1,.75,ink,8,glass);
    }
    m.rod([-19,16,19.5],[7,16,19.5],.46,plate,5);
    m.box(24,13,2.8,10,13,8.6,t.c,t.a,1);
    vent(m,24,13,11.5,8,9,4);
  }
  function refinery(m,t) {
    slab(m,85,59);
    for(const [x,y,r,h] of [[-23,-10,12,23],[-14,10,11.3,18]]){
      m.drum(x,y,2.8,r+1.3,r+1.3,2.7,iron,14);
      m.drum(x,y,5.5,r,r,h,hull,14);
      for(const z of [8.2,5.5+h*.58,5.3+h])m.drum(x,y,z,r+.45,r+.45,1.4,z<9?iron:t.c,14);
      m.cone(x,y,6.3+h,r,4.8,3.6,plate,14);
      m.drum(x,y,9.8+h,3.2,3.2,1.3,iron,8);
      for(let a=7;a<h+5;a+=3.6)m.box(x,y+r+.3,a,3.5,.55,.55,plate);
      for(const j of [-1,1])m.rod([x+j*1.7,y+r+.3,5.4],[x+j*1.7,y+r+.3,h+6],.36,iron,4);
    }
    frame(m,13.8,-4.5,2.8,34,34,23,shadowMetal,hull);
    m.box(13.8,-4.5,19.6,35,35,3.3,t.c,t.b,1.2);
    frame(m,13.5,-6.5,26.2,23,23,6.4,iron,plate);
    vent(m,16,-4.8,33.1,10.2,13.5);
    m.drum(6.1,-11.3,32.8,4,4,3.1,iron,10);
    m.cone(6.1,-11.3,35.7,2.9,2.2,17,hull,10);
    m.drum(6.1,-11.3,47.2,2.65,2.65,2.7,t.a,10);
    m.drum(6.1,-11.3,52.7,2.8,2.8,1.65,iron,10,dark);
    shutter(m,13.7,12.7,2.8,18.5,15.5);
    for(const y of [16,19.2,22.4])m.cap(13.5,y,2.81,21.8,.85,yellow);
    for(const y of [-13,-7]) {
      m.rod([-23,y,30.6],[-23,y,33.4],1.0,iron);
      m.rod([-23,y,33.4],[3.2,y,33.4],1.0,plate);
    }
    crate(m,32,17.2);crate(m,32,23,2.75,4.6);
  }
  function turret(m,t) {
    slab(m,38,34);
    m.loft(rect(0,0,32,27,5),rect(0,0,25,21,4),2.8,10,cement,plate);
    m.drum(0,0,10,10.5,9.6,3.3,iron,12);
    m.loft(rect(-1,0,22,18,4),rect(-1.8,0,16,13,3.6),13.2,19.9,t.a,t.b);
    for(const y of [-3.2,3.2]){
      m.rod([5.2,y,16.9],[12.7,y,16.9],2.1,iron);
      m.rod([12.2,y,16.9],[22.5,y,17.4],1.22,plate);
      m.rod([20.2,y,17.3],[23.3,y,17.48],1.51,dark);
    }
    m.drum(-3.8,0,19.8,3.5,3.15,.9,iron,8);
    m.box(-4.1,0,20.62,2.9,1,.6,glass);
  }
  const models={tank,scout,miner,infantry,hq,factory,barracks,power,refinery,turret};
  function rgb(hex){
    if(!colors.has(hex)){const n=parseInt(hex.slice(1),16);colors.set(hex,[(n>>16)&255,(n>>8)&255,n&255]);}
    return colors.get(hex);
  }
  function bake(type,team,rot,phase,res,loaded) {
    const m=new Model();
    models[type](m,faction(team),phase,loaded);
    const a=unitTypes.has(type)?rot*TAU/32:.56, c=Math.cos(a),s=Math.sin(a);
    const view=p=>[p[0]*c-p[1]*s,p[0]*s+p[1]*c,p[2]];
    const projected=m.faces.map(f=>({...f,pts:f.points.map(view)}));
    let l=1000,r=-1000,top=1000,bottom=-1000;
    for(const f of projected)for(const [x,y,z] of f.pts) {
      l=Math.min(l,x);r=Math.max(r,x,x+.31*z);
      top=Math.min(top,y*rise-z);bottom=Math.max(bottom,y*rise,y*rise+.15*z);
    }
    l=Math.floor(l-1);top=Math.floor(top-1);r=Math.ceil(r+1);bottom=Math.ceil(bottom+1);
    const width=Math.ceil((r-l)*res),height=Math.ceil((bottom-top)*res);
    const cnv=document.createElement('canvas');cnv.width=width;cnv.height=height;
    const ctx=cnv.getContext('2d'),img=ctx.createImageData(width,height),pixels=img.data;
    const buffer=new Float32Array(width*height);buffer.fill(-Infinity);
    function triangle(A,B,C,shade,base,ground) {
      const ax=(A[0]-l)*res,ay=(A[1]-top)*res,bx=(B[0]-l)*res,by=(B[1]-top)*res,cx=(C[0]-l)*res,cy=(C[1]-top)*res;
      const area=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
      if(Math.abs(area)<.001)return;
      const loX=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),hiX=Math.min(width-1,Math.floor(Math.max(ax,bx,cx)-.5));
      const loY=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),hiY=Math.min(height-1,Math.floor(Math.max(ay,by,cy)-.5));
      for(let y=loY;y<=hiY;y++) {
        let pos=y*width+loX;
        for(let x=loX;x<=hiX;x++,pos++) {
          const dx=x+.5-ax,dy=y+.5-ay;
          const u=(dx*(cy-ay)-dy*(cx-ax))/area,v=((bx-ax)*dy-(by-ay)*dx)/area;
          if(u<-.0001||v<-.0001||u+v>1.0001)continue;
          const j=pos*4;
          if(ground){
            if(pixels[j+3]===0){pixels[j]=14;pixels[j+1]=21;pixels[j+2]=27;pixels[j+3]=79;}
            continue;
          }
          const d=A[2]+(B[2]-A[2])*u+(C[2]-A[2])*v;
          if(d<buffer[pos]-.002)continue;
          buffer[pos]=d;
          const grain=(((x*29+y*53+(x^y)*17)%17)-8)*.44;
          pixels[j]=base[0]*shade+grain;pixels[j+1]=base[1]*shade+grain;pixels[j+2]=base[2]*shade+grain;pixels[j+3]=255;
        }
      }
    }
    for(const f of projected){
      const ground=f.pts.map(([x,y,z])=>[x+z*.31,y*rise+z*.15,0]);
      for(let i=1;i<ground.length-1;i++)triangle(ground[0],ground[i],ground[i+1],0,null,true);
    }
    for(const f of projected){
      const p=f.pts,n=norm(cross(sub(p[1],p[0]),sub(p[2],p[0])));
      const front=n[1]+rise*n[2];
      if(front<-.0001&&!f.lit)continue;
      const sun=Math.max(0,n[0]*-.55+n[1]*-.29+n[2]*.81);
      const bright=f.lit?1.18:.73+sun*.6+Math.max(0,n[2])*.025;
      const base=rgb(f.color);
      const scr=p.map(([x,y,z])=>[x,y*rise-z,y+rise*z]);
      for(let i=1;i<scr.length-1;i++)triangle(scr[0],scr[i],scr[i+1],bright,base,false);
    }
    ctx.putImageData(img,0,0);
    return {cnv,l,top,width:width/res,height:height/res};
  }
  function draw(ctx,type,x,y,opts={}) {
    if(!models[type])return;
    const team=Number(opts.team)===1?1:0,angle=Number(opts.angle)||0,time=Number(opts.time)||0;
    const rot=unitTypes.has(type)?(Math.round(Math.atan2(Math.sin(angle)/rise,Math.cos(angle))*32/TAU)+32)%32:0;
    const phase=type==='infantry'&&opts.moving?(Math.floor(time*5.5)%2):0;
    const res=opts.portrait?2:1;
    const loaded=type==='miner'&&opts.loaded!==false;
    const id=[type,team,rot,phase,res,loaded].join('/');
    if(!cache.has(id))cache.set(id,bake(type,team,rot,phase,res,loaded));
    const art=cache.get(id),scale=opts.scale||1;
    const smoothing=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=false;
    ctx.drawImage(art.cnv,x+art.l*scale,y+art.top*scale,art.width*scale,art.height*scale);
    ctx.imageSmoothingEnabled=smoothing;
  }
  window.Art={draw};
})();
