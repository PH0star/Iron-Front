/* Deterministic, hand-composed battlefield and its navigation geometry. */
(() => {
  'use strict';
  const width = 1840, height = 1180;
  const bridge = {x: 820, y: 450};
  const riverX = y => 820 - (y - 450) * .40 + 33 * Math.sin((y - 450) / 103) + 10 * Math.sin((y - 450) / 44);
  const riverRadius = y => 47 + 8 * Math.sin(y / 94) + 4 * Math.sin(y / 41) + 2 * Math.cos(y / 17);
  const bridges = [bridge, {x: riverX(900), y: 900}];
  const ore = [{x:132,y:595}, {x:1594,y:733}, {x:610,y:260}, {x:1240,y:935}];
  const pads = [[320,440,66],[474,335,60],[200,355,48],[245,555,52],[470,550,52],[550,440,38],[1500,600,63],[1440,450,55],[1250,520,42]];
  const paths = [
    {w:24,p:[[-70,505],[90,467],[190,432],[323,459],[436,436],[542,451],[634,425],[715,424],[820,450],[893,469],[1000,489],[1122,490],[1269,536],[1400,565],[1518,619],[1656,624],[1910,558]]},
    {w:16,p:[[155,450],[150,400],[204,367],[300,345],[379,332],[478,356],[530,402],[550,451]]},
    {w:14,p:[[129,590],[173,570],[240,562],[342,532],[435,547],[480,529],[526,473]]},
    {w:11,p:[[339,525],[357,460],[364,408],[379,332],[469,282],[555,270],[609,265]]},
    {w:14,p:[[435,546],[472,632],[497,720],[472,798],[501,857],[570,882],[riverX(900),900],[738,922],[865,913],[974,883],[1090,906],[1257,921],[1340,860],[1430,805],[1500,708],[1518,619]]},
    {w:15,p:[[1263,540],[1270,459],[1330,419],[1444,466],[1520,487],[1580,553],[1600,627],[1588,724]]}
  ];
  const segs = paths.flatMap(({w,p}) => p.slice(1).map(([x2,y2],i) => {
    const [x,y]=p[i], dx=x2-x, dy=y2-y, len=Math.hypot(dx,dy);
    return {x,y,dx,dy,len,w,left:Math.min(x,x2)-w-16,right:Math.max(x,x2)+w+16,top:Math.min(y,y2)-w-16,bottom:Math.max(y,y2)+w+16};
  }));
  function road(x,y){
    let best=1000, d=1000, along=0, w=0;
    for(const s of segs){
      if(x<s.left||x>s.right||y<s.top||y>s.bottom)continue;
      const t=Math.max(0,Math.min(1,((x-s.x)*s.dx+(y-s.y)*s.dy)/(s.len*s.len)));
      const distance=Math.hypot(x-s.x-t*s.dx,y-s.y-t*s.dy);
      if(distance-s.w<best){best=distance-s.w;d=distance;w=s.w;along=t*s.len;}
    }
    return {edge:best,d,w,along};
  }
  const clamp=(n,l=0,h=1)=>Math.max(l,Math.min(h,n));
  function generator(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
  const rand=generator(278045); const lut=new Float32Array(256*256);
  for(let i=0;i<lut.length;i++)lut[i]=rand();
  function noise(x,y,s){
    x/=s;y/=s;const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;
    fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
    const idx=(ix&255)|((iy&255)<<8), next=(ix+1)&255, bottom=((iy+1)&255)<<8;
    const a=lut[idx],b=lut[next|(idx&65280)],c=lut[(ix&255)|bottom],d=lut[next|bottom];
    return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;
  }
  function onBridge(x,y){return bridges.some(b=>Math.abs(x-b.x)<86 && Math.abs(y-b.y-(x-b.x)*.23)<20);}
  function inRiver(x,y,margin=0){return Math.abs(x-riverX(y))<riverRadius(y)+margin;}
  function openForProps(x,y,margin){
    return !inRiver(x,y,margin) && road(x,y).edge>margin &&
      !pads.some(([px,py,r])=>Math.hypot(x-px,(y-py)*1.22)<r+margin) &&
      !ore.some(o=>Math.hypot(x-o.x,(y-o.y)*1.55)<43+margin);
  }
  // Bedrock outcrops. The front edge is deliberately lower than the grassy cap.
  const cliffs=[
    [-3,257,89,27,21],[189,199,77,21,15],[404,104,137,31,26],[640,167,74,18,16],
    [43,700,96,27,23],[367,723,95,25,18],[611,615,45,15,12],[120,950,137,34,28],
    [818,115,65,16,15],[1173,310,140,38,26],[1068,679,103,32,24],[1094,1061,134,28,21],
    [1670,247,109,28,28],[1740,910,149,36,26],[646,1086,91,25,19],[1807,674,71,17,18]
  ];
  const woods=[
    [58,210,91,47,37],[269,157,126,49,32],[438,191,88,40,24],[69,339,55,58,18],
    [640,332,50,38,17],[560,192,68,26,16],[57,505,51,43,18],[335,650,82,41,27],
    [534,667,65,36,24],[652,570,37,36,13],[68,777,83,56,29],[280,851,104,38,34],
    [499,954,107,61,49],[257,1090,129,61,45],[662,77,134,47,50],[878,236,53,44,23],
    [1090,191,92,48,32],[1369,271,148,62,65],[1143,411,76,32,28],[1015,580,67,47,23],
    [891,765,101,45,38],[1085,811,91,42,40],[1360,677,59,33,20],[1691,511,104,62,32],
    [1770,762,111,49,37],[1420,1010,148,69,52],[804,1049,83,43,37],[1836,180,103,62,36]
  ];
  const trees=[];
  for(const [cx,cy,rx,ry,count] of woods){
    for(let i=0;i<count;i++){
      const a=rand()*Math.PI*2, radius=Math.sqrt(rand()),x=cx+Math.cos(a)*radius*rx,y=cy+Math.sin(a)*radius*ry;
      if(!openForProps(x,y,4)||cliffs.some(([px,py,dx,dy])=>((x-px)/dx)**2+((y-py)/dy)**2<.85))continue;
      if(trees.some(t=>Math.hypot(t.x-x,t.y-y)<6))continue;
      trees.push({x:x|0,y:y|0,h:18+rand()*20,seed:(rand()*1e7)|0});
    }
  }
  const indexedTrees=new Map();
  for(const t of trees){const key=(t.x>>5)+','+(t.y>>5);if(!indexedTrees.has(key))indexedTrees.set(key,[]);indexedTrees.get(key).push(t);}
  function blocked(x,y){
    if(x<5||y<5||x>=width-5||y>=height-5)return true;
    if(inRiver(x,y,1))return !onBridge(x,y);
    if(cliffs.some(([cx,cy,rx,ry,h])=>((x-cx)/(rx*.93))**2+((y-cy-h*.24)/(ry+h*.24))**2<1))return true;
    for(let i=(x-5)>>5;i<=(x+5)>>5;i++)for(let j=(y-4)>>5;j<=(y+4)>>5;j++){
      const a=indexedTrees.get(i+','+j);if(a&&a.some(t=>((x-t.x)/5)**2+((y-t.y)/4)**2<1))return true;
    }
    return false;
  }
  const palette={dry:[113,113,68],grass:[73,87,54],soil:[119,106,73],rich:[62,82,54],road:[151,135,97]};
  const mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
  function floorTexture(ctx){
    const coarse=document.createElement('canvas');coarse.width=width/2;coarse.height=height/2;
    const c=coarse.getContext('2d'),im=c.createImageData(coarse.width,coarse.height),arr=im.data;
    let i=0;const rr=generator(19235);
    for(let y=0;y<height;y+=2){
      const center=riverX(y),radius=riverRadius(y);
      const nearSegs=segs.filter(s=>y>=s.top&&y<=s.bottom);
      for(let x=0;x<width;x+=2){
        const big=noise(x,y,132), mid=noise(x+215,y,47),small=noise(x,y+350,14),fine=noise(x,y,5),grain=rr();
        const d=Math.abs(x-center)-radius,shoreNoise=(noise(x,y,13)-.5)*4;
        let col,light=(big-.52)*17+(mid-.5)*17+(small-.5)*11+(fine-.5)*8+(grain-.5)*9;
        if(d+shoreNoise<0){
          const deep=clamp((-d-3)/21),bands=noise(x*.6+y*.13,y*3,24);
          col=mix([75,108,93],[39,79,81],deep);light=(mid-.5)*11+(bands-.5)*18+(grain-.5)*4;
          if(d+shoreNoise>-2.2)light+=12;
        }else{
          const dry=clamp((.44*mid+.36*big+.20*small-.23)*1.92);
          col=mix(palette.rich,palette.dry,dry);
          if(small*.5+mid*.5>.61)col=mix(col,palette.soil,(small*.5+mid*.5-.61)*1.45);
          if(d<14)col=mix(col,[126,116,82],clamp(1-d/14)*.83);
          let edge=999,inner=0,rrad=0,along=0;
          for(const s of nearSegs){
            if(x<s.left||x>s.right)continue;
            const t=clamp(((x-s.x)*s.dx+(y-s.y)*s.dy)/(s.len*s.len));
            const dd=Math.hypot(x-s.x-t*s.dx,y-s.y-t*s.dy);
            if(dd-s.w<edge){edge=dd-s.w;inner=dd;rrad=s.w;along=t*s.len;}
          }
          if(edge<10){
            const opacity=clamp(.5-(edge+(small-.5)*13+(grain-.5)*6)/11);
            col=mix(col,palette.road,opacity*.90);
            const rut=Math.exp(-((inner-rrad*.46)**2)/7), shoulder=Math.exp(-((inner-rrad*.87)**2)/7);
            light+=opacity*(-rut*(6+3*Math.sin(along*.28))-shoulder*3+3);
          }
        }
        arr[i++]=col[0]+light;arr[i++]=col[1]+light;arr[i++]=col[2]+light*.81;arr[i++]=255;
      }
    }
    c.putImageData(im,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(coarse,0,0,width,height);
  }
  function poly(c,points,color){c.fillStyle=color;c.beginPath();c.moveTo(points[0][0]|0,points[0][1]|0);for(let i=1;i<points.length;i++)c.lineTo(points[i][0]|0,points[i][1]|0);c.closePath();c.fill();}
  function line(c,x1,y1,x2,y2,color,w=1){c.beginPath();c.strokeStyle=color;c.lineWidth=w;c.moveTo(x1|0,y1|0);c.lineTo(x2|0,y2|0);c.stroke();}
  function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
  function grassDetails(c){
    const r=generator(199832),gr=['#566241','#637047','#758052','#7c8457','#919065','#89875a','#566643'];
    for(let i=0;i<30500;i++){
      const x=r()*width|0,y=r()*height|0;if(inRiver(x,y))continue;
      const near=road(x,y).edge, tone=r();
      if(near<0){if(tone>.40)continue;c.fillStyle=tone>.19?'rgba(83,75,52,.26)':'rgba(232,210,161,.27)';c.fillRect(x,y,1+r()*3|0,1);continue;}
      const color=gr[r()*gr.length|0];c.fillStyle=color;
      c.fillRect(x,y,2,1);if(tone>.4){c.fillRect(x+2,y-1,2,1);c.fillRect(x+2,y-2,1,1);}if(tone>.74){c.fillRect(x-1,y-2,1,2);c.fillRect(x+4,y,2,1);}
    }
    for(let i=0;i<5700;i++){
      const y=r()*height|0, side=r()>.5?1:-1,x=(riverX(y)+side*r()*riverRadius(y))|0;
      const edge=riverRadius(y)-Math.abs(x-riverX(y));c.fillStyle=edge<6?'rgba(182,191,148,.53)':r()>.36?'rgba(128,164,151,.24)':'rgba(22,58,64,.37)';
      const n=2+r()*(edge<9?6:12)|0;c.fillRect(x,y,n,1);if(n>9)c.fillRect(x+n,y-1,2,1);
    }
    for(let i=0;i<730;i++){
      const y=r()*height|0, side=r()>.5?1:-1,x=(riverX(y)+side*(riverRadius(y)+r()*9))|0;
      if(onBridge(x,y))continue;
      if(r()>.55){const s=r()*4+1;ellipse(c,x+1,y+1,s,Math.max(1,s*.45),'#596851');ellipse(c,x,y,s,Math.max(1,s*.4),r()>.5?'#8c8971':'#a39a7c');}
      else{line(c,x,y,x-2,y-4,'#67754d');line(c,x,y,x+2,y-8,'#7f8256');}
    }
    // Tiny exposed rocks and lichen soften the transition from forest to bare dirt.
    for(let i=0;i<620;i++){
      const x=r()*width|0,y=r()*height|0;if(!openForProps(x,y,9))continue;
      const s=1+r()*3.1;poly(c,[[x-s,y],[x-1,y-s],[x+s,y-s*.45],[x+s+1,y],[x,y+1]],'#676e59');c.fillStyle='#999a7a';c.fillRect(x-1,y-s|0,s,1);
    }
  }
  function cliff(c,[cx,cy,rx,ry,drop],seed){
    const r=generator(seed), n=Math.ceil(rx/5.8)*2,top=[],base=[];
    for(let i=0;i<n;i++){
      const a=i/n*Math.PI*2,rad=.91+r()*.14;const x=cx+Math.cos(a)*rx*rad,y=cy+Math.sin(a)*ry*(.86+r()*.2)+Math.sin(a*3)*3;
      top.push([x,y]);base.push([x+3+r()*4,y+drop*(.73+r()*.38)]);
    }
    poly(c,base.map(([x,y])=>[x+7,y+3]),'rgba(35,40,30,.26)');poly(c,base,'#55594a');
    const dark=['#4a5045','#53574a','#656755','#71705c','#5c6152'],stone=['#9b9680','#868674','#aaa18a','#767b69','#8e8e78'];
    for(let i=0;i<n/2;i++){
      const p=top[i],q=top[(i+1)%n],v=base[i],w=base[(i+1)%n];
      poly(c,[p,q,w,v],dark[(r()*dark.length)|0]);poly(c,[p,q,[q[0]+1,q[1]+drop*.25],[p[0],p[1]+drop*.35]],stone[(r()*5)|0]);
      const lev=.55+r()*.2;line(c,p[0]+1,p[1]+drop*lev,q[0]+3,q[1]+drop*lev,'#83836e',1.2);
      line(c,p[0]+2,p[1]+drop*.3,v[0],v[1],'rgba(58,62,52,.7)',1.4);
      if(r()>.68)poly(c,[[v[0]-5,v[1]],[v[0],v[1]-4],[v[0]+5,v[1]-3],[v[0]+7,v[1]+1],[v[0]+1,v[1]+3]],'#777968');
    }
    poly(c,top,'#868670');poly(c,top.map(([x,y])=>[cx+(x-cx)*.85,cy+(y-cy)*.79]),'#757c59');
    for(let j=0;j<rx*2;j++){
      const a=r()*Math.PI*2,rad=Math.sqrt(r())*.87,x=cx+Math.cos(a)*rx*rad,y=cy+Math.sin(a)*ry*rad;
      c.fillStyle=r()>.64?'#95917b':r()>.5?'#808366':'#6f775b';c.fillRect(x|0,y|0,2+r()*5|0,1+r()*2|0);
    }
    for(let i=0;i<n;i+=2){const p=top[i],q=top[(i+1)%n];line(c,p[0],p[1],q[0],q[1],r()>.5?'#aaa48c':'#959680');}
  }
  function drawTree(c,t){
    const {x,y,h,seed}=t,rr=generator(seed), shade=rr(), tints=shade>.64?['#263e35','#334d3d','#435d46','#5e7251','#768465']:shade>.26?['#273d33','#354b38','#495d41','#687650','#899164']:['#263b34','#30483c','#435a49','#5a7055','#708465'];
    const w=h*.31; c.fillStyle='#474b38';c.fillRect(x-2,y-h*.25,4,h*.25+1);c.fillStyle='#89785a';c.fillRect(x-2,y-h*.19,1,h*.16);
    for(let j=0;j<4;j++){
      const base=y-h*(.12+j*.187),top=y-h*(.64+j*.128),span=w*(1-j*.213),left=x-span*(.90+rr()*.20),right=x+span*(.95+rr()*.15);
      const p=[[x,top],[x+span*.55,base-span*.71],[x+span*.40,base-span*.73],[right,base-1],[right-2,base+1],[x+span*.45,base],[x+span*.33,base+2],[x-1,base+1],[x-span*.46,base+3],[x-span*.52,base+1],[left,base+1],[left+2,base-2],[x-span*.75,base-span*.32],[x-span*.50,base-span*.65],[x-span*.58,base-span*.62]];
      poly(c,p,tints[0]);poly(c,[[x,top],[x+span*.24,base-span*.68],[right-1,base-1],[x+span*.31,base-1],[x+.04*span,base],[left+1,base],[x-span*.32,base-span*.58]],tints[1]);
      poly(c,[[x,top],[x-1,base-span*.74],[x+span*.24,base-span*.34],[x-span*.15,base-span*.42],[x-span*.36,base-1],[left,base],[x-span*.5,base-span*.5]],tints[2]);
      line(c,x-1,top+2,left+3,base-3,tints[3],1);c.fillStyle=tints[3];c.fillRect(left+2|0,base-1|0,Math.max(1,span*.28|0),1);
      if(j===3){c.fillStyle=tints[4];c.fillRect(x|0,top|0,1,3);}
    }
  }
  function orePatch(c,center,seed){
    const r=generator(seed);
    const patches=[[-16,1,16,9],[10,-6,24,10],[9,13,12,6],[31,3,11,6],[-30,-3,8,4]];
    for(const [dx,dy,rx,ry] of patches){
      const spots=[],cx=center.x+dx,cy=center.y+dy;
      for(let i=0;i<rx*1.7;i++){const a=r()*6.283,rad=Math.sqrt(r());spots.push({x:cx+Math.cos(a)*rad*rx,y:cy+Math.sin(a)*rad*ry,s:2+r()*3.8});}
      spots.sort((a,b)=>a.y-b.y);
      for(const {x,y,s} of spots){
        poly(c,[[x-s,y],[x-1,y-s*.8],[x+s*.55,y-s*.6],[x+s,y],[x+s*.28,y+s*.4],[x-s*.6,y+s*.45]],'#695e36');
        poly(c,[[x-s,y],[x-s*.3,y-s],[x+s*.45,y-s*.8],[x+s*.43,y-s*.18],[x-s*.25,y+s*.15]],r()>.46?'#c39b48':'#ab883f');
        c.fillStyle=r()>.3?'#eac164':'#f2d58b';c.fillRect(x-s*.5|0,y-s*.7|0,Math.max(1,s*.75|0),1+(s>4));
      }
    }
  }
  function drawBridge(c,b){
    // An open Warren truss. The space between the two rails remains the driveable deck.
    c.save();c.translate(b.x|0,b.y|0);c.transform(1,.23,0,1,0,0);
    poly(c,[[-72,-17],[77,-17],[87,29],[-61,29]],'rgba(18,40,40,.37)');
    c.fillStyle='#62695a';c.fillRect(-82,-21,164,43);c.fillStyle='#8f9179';c.fillRect(-81,-19,162,36);
    c.fillStyle='#494f45';c.fillRect(-70,-17,140,37);c.fillStyle='#877e62';c.fillRect(-69,-15,138,30);
    const r=generator(6646);
    for(let x=-68;x<69;x+=4){c.fillStyle=r()>.4?'#9a8a69':'#a29677';c.fillRect(x,-15,3,30);line(c,x+2,-15,x+2,14,'rgba(61,58,48,.28)');}
    for(const y of [-8,7]){c.fillStyle='rgba(70,67,56,.36)';c.fillRect(-69,y-2,138,4);}
    for(const yy of [-18,18]){
      line(c,-71,yy+2,70,yy+2,'#353f38',4);
      for(let i=-70;i<70;i+=20){
        line(c,i,yy-1,i+10,yy-13,'#3d4840',3.5);line(c,i+10,yy-13,i+20,yy-1,'#4b5649',3.5);
        line(c,i,yy-2,i+10,yy-14,'#90927a',1);line(c,i+10,yy-14,i+20,yy-2,'#969680',1);
      }
      line(c,-70,yy-14,70,yy-14,'#485448',3);line(c,-70,yy-15,70,yy-15,'#a4a18a',1);
      for(const x of [-71,-31,9,49,70]){c.fillStyle='#5a6252';c.fillRect(x-1,yy-15,3,18);c.fillStyle='#bfba98';c.fillRect(x-1,yy-15,2,2);}
    }
    for(const x of [-80,76])for(const y of [-23,19]){c.fillStyle='#4d5144';c.fillRect(x,y,6,6);c.fillStyle='#c9aa62';c.fillRect(x,y,5,2);}
    c.restore();
  }
  let cached;
  function build(){
    if(cached)return cached;
    const map=document.createElement('canvas');map.width=width;map.height=height;
    const c=map.getContext('2d',{alpha:false});c.imageSmoothingEnabled=false;
    floorTexture(c);grassDetails(c);
    for(const [i,rock] of cliffs.entries())cliff(c,rock,910+67*i);
    for(const [i,o] of ore.entries())orePatch(c,o,824+i*561);
    for(const t of trees){const w=t.h*.32;poly(c,[[t.x-w*.72,t.y],[t.x+1,t.y+2],[t.x+t.h*.48,t.y+4],[t.x+t.h*.66,t.y+1],[t.x+t.h*.48,t.y-2],[t.x+1,t.y-4]],'rgba(24,35,29,.33)');}
    for(const t of [...trees].sort((a,b)=>a.y-b.y))drawTree(c,t);
    for(const b of bridges)drawBridge(c,b);
    cached=map;return cached;
  }
  globalThis.Terrain={width,height,bridge,bridges,ore,blocked,build};
})();
