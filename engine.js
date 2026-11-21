/* Iron Front · fixed-step skirmish simulation. Positions use projected map coordinates. */
(() => {
  'use strict';
  const types = {
    tank: {name:'重裝戰車',en:'BATTLE TANK',code:'T-04',hp:260,speed:43,range:133,damage:33,reload:1.36,cost:650,seconds:11,source:'factory',r:17,desc:'厚重裝甲與主砲，適合突破防線。'},
    infantry: {name:'突擊步兵',en:'RIFLE INFANTRY',code:'I-01',hp:75,speed:46,range:100,damage:8,reload:.68,cost:120,seconds:4,source:'barracks',r:7,desc:'快速集結的輕步兵，適合支援裝甲部隊。'},
    scout: {name:'偵察裝甲車',en:'SCOUT CAR',code:'V-02',hp:155,speed:76,range:110,damage:13,reload:.76,cost:350,seconds:7,source:'factory',r:13,desc:'高機動輪式裝甲車，適合偵察與快速增援。'},
    miner: {name:'採礦車',en:'ORE HARVESTER',code:'H-07',hp:280,speed:54,range:0,cost:800,seconds:12,source:'factory',r:16,desc:'自動往返礦區與精煉廠，每車可交付 260 資金。'},
    hq:{name:'前線指揮部',en:'COMMAND CENTER',code:'HQ',hp:1500,structure:true,r:43,supply:60,desc:'我方作戰核心。失去指揮部即會戰敗。'},
    factory:{name:'戰車工廠',en:'WAR FACTORY',code:'FAC',hp:800,structure:true,r:42,cost:1050,seconds:18,power:30,desc:'生產戰車、偵察裝甲車與採礦車。'},
    barracks:{name:'步兵營',en:'BARRACKS',code:'BAR',hp:580,structure:true,r:32,cost:500,seconds:9,power:12,desc:'訓練步兵，每座額外提供 8 個部隊名額。'},
    power:{name:'發電站',en:'POWER PLANT',code:'PWR',hp:530,structure:true,r:31,cost:400,seconds:8,supply:60,desc:'提供 60 電力，維持基地生產效率。'},
    refinery:{name:'礦石精煉廠',en:'ORE REFINERY',code:'REF',hp:735,structure:true,r:38,cost:750,seconds:13,power:22,desc:'接收採礦車運回的晶礦並轉換為資金。'},
    turret:{name:'守衛砲塔',en:'SENTRY TURRET',code:'TUR',hp:515,structure:true,r:21,range:153,damage:24,reload:1.27,cost:475,seconds:10,power:16,desc:'自動攻擊射程內的敵軍，守衛基地入口。'}
  };
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
  const grid=16;
  class Skirmish{
    constructor(terrain,emit=()=>{},duel=false){
      this.terrain=terrain;this.emit=emit;this.time=0;this.duel=duel;this.sides=[0,1].map(()=>({credits:2400,queue:[]}));this.productionId=0;this.units=[];this.sequence=0;this.wave=0;this.nextWave=105;this.end='';this.kills=0;
      this.cols=Math.ceil(terrain.width/grid);this.rows=Math.ceil(terrain.height/grid);this.map=new Uint8Array(this.cols*this.rows);
      for(let i=0;i<this.map.length;i++){let p=this.point(i);this.map[i]=terrain.blocked(p.x,p.y)?1:0;}
      const bases=[['hq',320,440],['factory',474,335],['power',200,355],['refinery',245,555],['barracks',470,550],['turret',550,440]];
      bases.forEach(([type,x,y])=>this.add(type,0,x,y));
      [['hq',1500,600],['factory',1440,450],['turret',1250,520],['barracks',1560,480],['power',1590,580],['refinery',1540,690]].forEach(([type,x,y])=>this.add(type,1,x,y));
      [['tank',420,454],['tank',491,464],['scout',duel?336:557,duel?204:505],['infantry',382,490],['infantry',402,504],['miner',187,575]].forEach(([type,x,y])=>this.add(type,0,x,y));
      const east = duel
        ? [['tank',1398,614],['tank',1352,648],['scout',1324,676],['infantry',1438,649],['infantry',1457,652],['miner',1515,755]]
        : [['tank',1345,551],['scout',1325,626],['infantry',1400,574],['infantry',1373,589]];
      east.forEach(([type,x,y])=>this.add(type,1,x,y));
      this.refreshGrid();
    }
    get credits(){return this.sides[0].credits;}
    get queue(){return this.sides[0].queue;}
    add(type,team,x,y){
      const spec=types[type], id=++this.sequence;
      const u={id,type,team,x,y,hp:spec.hp,max:spec.hp,angle:team?2.65:-.58,moving:false,path:[],order:type==='miner'?'mine':'guard',cool:0,target:0,focus:0,reroute:0,haul:0,work:0,build:0,tag:id};
      this.units.push(u);return u;
    }
    ready(type,team=0){return this.units.filter(u=>u.type===type&&u.team===team&&u.hp>0&&!u.build);}
    population(team=0){return this.units.filter(u=>u.team===team&&!types[u.type].structure&&u.hp>0).length;}
    capacity(team=0){return 16+this.ready('barracks',team).length*8;}
    power(team=0){let used=0,total=0;this.units.forEach(u=>{if(u.team===team&&u.hp>0&&!u.build){used+=types[u.type].power||0;total+=types[u.type].supply||0;}});return {used,total};}
    point(i){return {x:(i%this.cols+.5)*grid,y:(Math.floor(i/this.cols)+.5)*grid};}
    cell(p){return clamp(Math.floor(p.y/grid),0,this.rows-1)*this.cols+clamp(Math.floor(p.x/grid),0,this.cols-1);}
    refreshGrid(){
      this.nav=this.map.slice();
      for(const u of this.units){const t=types[u.type];if(!t.structure||u.hp<=0)continue;
        const r=t.r+4;for(let y=Math.floor((u.y-r*.72)/grid);y<=Math.floor((u.y+r*.72)/grid);y++)for(let x=Math.floor((u.x-r)/grid);x<=Math.floor((u.x+r)/grid);x++){
          const i=y*this.cols+x,p=this.point(i);if(((p.x-u.x)/r)**2+((p.y-u.y)/(r*.72))**2<1)this.nav[i]=1;
        }
      }
      for(const u of this.units) {
        if(u.path.length) u.path=this.route(u,u.path[u.path.length-1]);
      }
    }
    nearestCell(p){
      const i=this.cell(p);if(!this.nav[i])return i;
      const cx=i%this.cols,cy=Math.floor(i/this.cols);let best=-1,d=Infinity;
      for(let ring=1;ring<=16;ring++){
        for(let y=cy-ring;y<=cy+ring;y++)for(let x=cx-ring;x<=cx+ring;x++){
          if((Math.abs(x-cx)!==ring&&Math.abs(y-cy)!==ring)||x<0||x>=this.cols||y<0||y>=this.rows)continue;
          let n=y*this.cols+x;if(!this.nav[n]){let dd=distance(this.point(n),p);if(dd<d){best=n;d=dd;}}
        }if(best>=0)return best;
      }return -1;
    }
    route(from,to){
      const start=this.nearestCell(from),end=this.nearestCell(to);
      if(start<0||end<0)return [];
      const goal=this.nav[this.cell(to)]?this.point(end):{x:clamp(to.x,8,this.terrain.width-8),y:clamp(to.y,8,this.terrain.height-8)};
      if(start===end)return [goal];
      const prev=new Int32Array(this.map.length).fill(-1),g=new Float32Array(this.map.length).fill(Infinity),heap=[];
      const push=(i,f)=>{let k=heap.length;heap.push(null);while(k){let p=(k-1)>>1;if(heap[p][1]<=f)break;heap[k]=heap[p];k=p;}heap[k]=[i,f];};
      const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){let k=0;while(k*2+1<heap.length){let c=k*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[k]=heap[c];k=c;}heap[k]=last;}return top[0];};
      const ex=end%this.cols,ey=Math.floor(end/this.cols),h=(x,y)=>{let a=Math.abs(x-ex),b=Math.abs(y-ey);return Math.max(a,b)+.414*Math.min(a,b);};
      push(start,0);g[start]=0;
      const done=new Uint8Array(this.map.length);
      while(heap.length){const i=pop();if(done[i])continue;if(i===end)break;done[i]=1;
        let x=i%this.cols,y=Math.floor(i/this.cols);
        for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
          if((!dx&&!dy)||x+dx<0||x+dx>=this.cols||y+dy<0||y+dy>=this.rows)continue;
          const n=i+dy*this.cols+dx;if(this.nav[n]||done[n]||(dx&&dy&&(this.nav[i+dx]||this.nav[i+dy*this.cols])))continue;
          let v=g[i]+(dx&&dy?1.4142:1);if(v>=g[n])continue;prev[n]=i;g[n]=v;push(n,v+h(x+dx,y+dy));
        }
      }
      if(prev[end]<0)return [];
      let cells=[end];for(let v=prev[end];v!==start;v=prev[v])cells.push(v);
      cells.reverse();let points=[],dir=0,old=start;
      for(const n of cells){let step=n-old;if(dir&&step!==dir)points.push(this.point(old));dir=step;old=n;}points.push(this.point(end));if(distance(goal,points[points.length-1])>2)points.push(goal);return points;
    }
    produce(type,team=0){
      const side=this.sides[team];
      const t=types[type];if(this.end||!t||t.structure)return '無法生產';
      if(!this.ready(t.source,team).length)return '需要'+types[t.source].name;
      if(this.population(team)+side.queue.length>=this.capacity(team))return '部隊名額已滿，請增建步兵營';
      if(side.queue.length>=6)return '生產佇列已滿';if(this.sides[team].credits<t.cost)return '資金不足';
      this.sides[team].credits-=t.cost;side.queue.push({id:++this.productionId,type,remain:t.seconds});this.emit('queued',{type});return '';
    }
    cancelProduction(index,team=0){
      const side=this.sides[team];
      if(this.end||!Number.isInteger(index)||index<0||index>=side.queue.length)return 0;
      const [item]=side.queue.splice(index,1), t=types[item.type];
      const refund=Math.ceil(t.cost*clamp(item.remain/t.seconds,0,1));
      this.sides[team].credits+=refund;return refund;
    }
    canPlace(type,x,y,team=0){
      const t=types[type],p={x,y};if(!t?.structure||!t.cost)return '無法建造';
      if(this.sides[team].credits<t.cost)return '資金不足';
      if(!this.units.some(u=>u.team===team&&!u.build&&types[u.type].structure&&distance(p,u)<215))return '請選擇我方建築附近的空地';
      const footprint=t.r;
      for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,.7],[0,-.7],[.7,.55],[-.7,.55],[.7,-.55],[-.7,-.55]])if(this.terrain.blocked(x+dx*footprint,y+dy*footprint))return '地形不適合建造';
      if(this.terrain.ore.some(o=>distance(o,p)<footprint+12))return '礦區需要保留給採礦車';
      if(this.units.some(u=>u.hp>0&&Math.hypot(u.x-x,(u.y-y)*1.27)<t.r+types[u.type].r+8))return '這塊空地太小';return '';
    }
    place(type,x,y,team=0){if(this.end)return '戰役已結束';let fail=this.canPlace(type,x,y,team);if(fail)return fail;const t=types[type];this.sides[team].credits-=t.cost;let u=this.add(type,team,x,y);u.build=t.seconds;u.hp=Math.round(t.hp*.35);this.refreshGrid();this.emit('placed',u);return '';}
    command(group,mode,goal,target,team=0){
      const mobiles=group.filter(u=>!types[u.type].structure&&u.team===team&&u.hp>0);let issued=0;
      for(let i=0;i<mobiles.length;i++){const u=mobiles[i];
        if(mode==='guard'||mode==='stop'||mode==='mine'){u.order=mode;u.path=[];u.focus=0;u.target=0;u.work=0;issued++;continue;}
        if(!goal)continue;
        const n=Math.ceil(Math.sqrt(mobiles.length)),spacing=29;
        const p={x:goal.x+(i%n-(n-1)/2)*spacing,y:goal.y+(Math.floor(i/n)-(Math.ceil(mobiles.length/n)-1)/2)*spacing};
        let path=this.route(u,p);if(!path.length)continue;
        u.path=path;u.order=mode;u.focus=target&&types[u.type].damage?target.id:0;u.target=0;u.reroute=1;u.work=0;issued++;
      }return issued;
    }
    mine(u,dt){
      const goals=u.haul?this.ready('refinery',u.team):this.terrain.ore;if(!goals.length)return;
      let g=goals.reduce((a,b)=>distance(u,a)<distance(u,b)?a:b);
      let reach=u.haul?types.refinery.r+15:29;
      if(distance(u,g)<reach){u.path=[];u.work+=dt;if(u.work>=(u.haul?1.2:3.8)){u.work=0;if(u.haul){if(this.duel||!u.team)this.sides[u.team].credits+=260;this.emit('income',u);}u.haul=u.haul?0:1;}}
      else if(!u.path.length&&u.reroute<=0){u.path=this.route(u,g);u.reroute=1.5;}
    }
    walk(u,dt){
      let step=types[u.type].speed*dt;
      while(step>0&&u.path.length){let p=u.path[0],dx=p.x-u.x,dy=p.y-u.y,d=Math.hypot(dx,dy);if(d>.5)u.angle=Math.atan2(dy,dx);u.moving=true;
        if(d<=step){u.x=p.x;u.y=p.y;u.path.shift();step-=d;}else{u.x+=dx/d*step;u.y+=dy/d*step;break;}
      }if(!u.path.length&&u.order==='move')u.order='guard';
    }
    spaceUnits(){
      const moving=this.units.filter(u=>!types[u.type].structure&&u.hp>0);
      // Yield gently within the formation while preserving the navigable bridge corridor.
      for(let i=0;i<moving.length;i++)for(let j=i+1;j<moving.length;j++){
        const a=moving[i],b=moving[j];if(a.team!==b.team||(!a.moving&&!b.moving&&!a.target&&!b.target))continue;
        const spacing=(types[a.type].r+types[b.type].r)*.72;
        let dx=a.x-b.x,dy=(a.y-b.y)*1.32,d=Math.hypot(dx,dy);
        if(d>=spacing)continue;
        if(d<.01){dx=a.id%2?1:-1;dy=.15;d=1;}
        const nudge=Math.min(.72,(spacing-d)*.20);
        for(const [u,sign] of [[a,1],[b,-1]]){
          const p={x:u.x+sign*dx/d*nudge,y:u.y+sign*dy/d*nudge/1.32};
          if(!this.nav[this.cell(p)]&&!this.terrain.blocked(p.x,p.y)){u.x=p.x;u.y=p.y;}
        }
      }
    }
    runProduction(team,dt){
      const side=this.sides[team];
      side.credits+=dt*2;
      const q=side.queue[0];
      if(!q)return;
      const source=this.ready(types[q.type].source,team)[0];
      if(!source)return;
      const power=this.power(team);
      q.remain-=dt*(power.used>power.total?.45:1);
      if(q.remain>0)return;
      const slot=this.sequence%5;
      const node=this.nearestCell({x:source.x+(team?-1:1)*(16+slot*12),y:source.y+47+slot%2*13});
      if(node<0)return;
      const p=this.point(node), unit=this.add(q.type,team,p.x,p.y);
      side.queue.shift();
      this.emit('ready',unit);
    }
    tick(dt){
      if(this.end)return;
      this.time+=dt;
      this.runProduction(0,dt);
      if(this.duel)this.runProduction(1,dt);
      if(!this.duel&&this.time>=this.nextWave&&this.ready('factory',1).length){
        this.wave++;this.nextWave=this.time+Math.max(55,89-this.wave*4);
        const hq=this.ready('hq')[0],f=this.ready('factory',1)[0];if(hq&&f){
          const typesOut=this.wave<3?['scout','infantry','infantry']:['tank','scout','infantry','infantry'];
          typesOut.forEach((type,i)=>{const p=this.point(this.nearestCell({x:f.x-i*20,y:f.y+60}));const u=this.add(type,1,p.x,p.y);u.order='attack';u.focus=hq.id;u.path=this.route(u,hq);});
          this.emit('wave',{wave:this.wave});
        }}
      let rebuild=false;
      const pendingDamage=new Map();
      for(const u of this.units){
        if(u.hp<=0)continue;u.moving=false;u.cool-=dt;u.reroute-=dt;
        if(u.build){const amount=Math.min(u.build,dt);u.build-=amount;u.hp=Math.min(u.max,u.hp+u.max*.65*amount/types[u.type].seconds);if(u.build<=.001){u.build=0;this.emit('built',u);}continue;}
        const t=types[u.type];if(u.type==='miner'&&u.order==='mine')this.mine(u,dt);
        if(t.damage&&u.order!=='move'&&u.order!=='stop'){
          let focus=u.focus?this.units.find(o=>o.id===u.focus&&o.hp>0):null;if(focus&&this.canSee&&!this.canSee(u.team,focus))focus=null;
          if(!focus)u.focus=0;
          const within=o=>distance(u,o)<=t.range+(types[o.type].structure?types[o.type].r*.71:3);
          let aim=focus&&within(focus)?focus:null;
          if(!aim){let near=Infinity;for(const o of this.units){if(o.team===u.team||o.hp<=0||!within(o)||(this.canSee&&!this.canSee(u.team,o)))continue;let d=distance(u,o);if(d<near){near=d;aim=o;}}}
          if(aim){
            u.target=aim.id;u.angle=Math.atan2(aim.y-u.y,aim.x-u.x);
            if(u.cool<=0){
              u.cool=t.reload;
              this.emit('fire',{u,aim});
              if(this.duel)pendingDamage.set(aim,(pendingDamage.get(aim)||0)+t.damage);
              else {
                aim.hp-=t.damage;
                if(aim.hp<=0){
                  if(aim.team)this.kills++;
                  this.emit('destroy',aim);if(types[aim.type].structure)rebuild=true;
                  if(aim.type==='hq'){this.end=aim.team?'victory':'defeat';this.emit('end',{result:this.end});return;}
                }
              }
            }
            continue;
          }
          u.target=0;
          if(focus&&!t.structure&&u.reroute<=0&&(!u.path.length||distance(u.path[u.path.length-1],focus)>62)){u.path=this.route(u,focus);u.reroute=1.6;}
        }
        if(!t.structure&&u.path.length)this.walk(u,dt);
      }
      for(const [unit,damage] of pendingDamage){
        unit.hp-=damage;
        if(unit.hp<=0){
          this.emit('destroy',unit);
          if(types[unit.type].structure)rebuild=true;
        }
      }
      if(this.duel){
        const west=this.ready('hq',0).length,east=this.ready('hq',1).length;
        if(!west||!east)this.end=west?'red':east?'blue':'draw';
      }
      this.units=this.units.filter(u=>u.hp>0);
      this.spaceUnits();
      if(rebuild)this.refreshGrid();
    }
  }
  globalThis.Iron={Skirmish,types,distance,clamp};
})();
