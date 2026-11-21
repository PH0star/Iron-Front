import '../engine.js';
import '../terrain.js';

const {Skirmish, types} = globalThis.Iron;
const terrain = globalThis.Terrain;
export const CELL = 24;
const cols = Math.ceil(terrain.width / CELL);
const rows = Math.ceil(terrain.height / CELL);
const sight = {scout:240, infantry:135, miner:135, turret:175};
const allowedOrders = new Set(['move','attack','mine','guard','stop']);
const cellOf = (x, y) => Math.floor(y / CELL) * cols + Math.floor(x / CELL);
const inMap = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
  p.x >= 0 && p.y >= 0 && p.x < terrain.width && p.y < terrain.height;

function viewUnit(u) {
  return {id:u.id, team:u.team, type:u.type, x:Math.round(u.x), y:Math.round(u.y),
    angle:+u.angle.toFixed(2), hp:Math.ceil(u.hp), max:u.max, moving:u.moving,
    build:+u.build.toFixed(2), haul:!!u.haul};
}

class Intel {
  constructor(){
    this.visible = new Uint8Array(cols*rows);
    this.explored = new Uint8Array(cols*rows);
    this.memory = new Map();
    this.mask = '';
  }
  sees(p){ return !!this.visible[cellOf(p.x,p.y)]; }
  survey(units,team){
    const cells=this.visible;
    cells.fill(0);
    for(const u of units){
      if(u.team!==team || u.hp<=0 || u.build)continue;
      const r=sight[u.type]||160;
      const lowX=Math.max(0,Math.floor((u.x-r)/CELL)), highX=Math.min(cols-1,Math.floor((u.x+r)/CELL));
      const lowY=Math.max(0,Math.floor((u.y-r)/CELL)), highY=Math.min(rows-1,Math.floor((u.y+r)/CELL));
      for(let y=lowY;y<=highY;y++){
        const dy=(y+.5)*CELL-u.y;
        for(let x=lowX;x<=highX;x++){
          const dx=(x+.5)*CELL-u.x;
          if(dx*dx+dy*dy<=r*r)cells[y*cols+x]=this.explored[y*cols+x]=1;
        }
      }
    }
    for(const [id,mark] of this.memory)if(this.sees(mark))this.memory.delete(id);
    for(const u of units)if(u.team!==team&&u.hp>0&&types[u.type].structure&&this.sees(u)){
      this.memory.set(u.id,{id:u.id,type:u.type,x:u.x,y:u.y,team:u.team});
    }
  }
  encode(){
    // Three cells per printable character. 0 unknown, 1 explored, 2 visible.
    let out='';
    for(let i=0;i<this.visible.length;i+=3){
      let n=0;
      for(let j=0;j<3 && i+j<this.visible.length;j++)n|=(this.visible[i+j]?2:this.explored[i+j])<<(j*2);
      out+=String.fromCharCode(48+n);
    }
    return out;
  }
}

export class Match {
  constructor(mode){
    this.mode=mode;
    this.intel=[new Intel(),new Intel()];
    this.events=[[],[]];
    this.sim=new Skirmish(terrain,(k,d)=>this.event(k,d),true);
    this.sim.canSee=(team,u)=>this.mode==='full'||this.intel[team].sees(u);
    this.survey();
  }
  survey(){ for(const team of [0,1])this.intel[team].survey(this.sim.units,team); }
  setMode(mode){
    this.mode=mode;
    this.events=[[],[]];
    this.dropHiddenTargets();
  }
  dropHiddenTargets(){
    const units=new Map(this.sim.units.map(u=>[u.id,u]));
    for(const u of this.sim.units){
      if(!u.focus&&!u.target)continue;
      const focus=units.get(u.focus||u.target);
      if(this.mode==='full'){
        if(focus&&this.intel[u.team].sees(focus))u.lastSight={x:focus.x,y:focus.y};
        continue;
      }
      if(!focus||!this.intel[u.team].sees(focus)){
        u.focus=0;u.target=0;
        // A path created during full visibility may point to undiscovered terrain.
        u.path=u.lastSight ? this.sim.route(u,u.lastSight) : [];
        u.lastSight=null;
      }else u.lastSight={x:focus.x,y:focus.y};
    }
  }
  step(){
    this.dropHiddenTargets();
    this.sim.tick(1/24);
    this.survey();
  }
  event(kind,data){
    if(!['fire','destroy','ready','built','income'].includes(kind))return;
    for(const team of [0,1]){
      const sees=u=>u.team===team||this.mode==='full'||this.intel[team].sees(u);
      if(kind==='fire'){
        if(sees(data.u)&&sees(data.aim))this.events[team].push({kind,data:{u:viewUnit(data.u),aim:viewUnit(data.aim)}});
      }else if(kind==='destroy'?sees(data):data.team===team)this.events[team].push({kind,data:viewUnit(data)});
    }
  }
  command(team,msg){
    const sim=this.sim, side=sim.sides[team];
    if(msg.op==='produce'||msg.op==='place'){
      if(typeof msg.unit!=='string'||!Object.hasOwn(types,msg.unit))return '未知單位';
      if(msg.op==='produce')return sim.produce(msg.unit,team);
      if(!inMap(msg)||!this.intel[team].sees(msg)&&this.mode==='fog')return '請在目前視野內建造';
      return sim.place(msg.unit,msg.x,msg.y,team);
    }
    if(msg.op==='cancel'){
      const i=side.queue.findIndex(q=>q.id===msg.item);
      if(i<0)return '佇列項目已變更';
      sim.cancelProduction(i,team);return '';
    }
    if(msg.op!=='order'||!Array.isArray(msg.ids)||msg.ids.length>256||!allowedOrders.has(msg.order))return '無效指令';
    const ids=new Set(msg.ids),group=sim.units.filter(u=>ids.has(u.id)&&u.team===team&&!types[u.type].structure);
    if(!group.length||group.length!==ids.size)return '只能指揮己方部隊';
    const target=msg.target?sim.units.find(u=>u.id===msg.target&&u.team!==team):null;
    if(msg.target&&(!target||!sim.canSee(team,target)))return '目標已離開視野';
    const goal=target||msg.goal;
    if(['move','attack'].includes(msg.order)&&!inMap(goal))return '目的地無效';
    if(msg.order==='mine'&&group.some(u=>u.type!=='miner'))return '請選取採礦車';
    for(const u of group)u.lastSight=target&&this.intel[team].sees(target)?{x:target.x,y:target.y}:null;
    return sim.command(group,msg.order,goal,target,team)?'':'無法抵達指定位置';
  }
  snapshot(team){
    const s=this.sim, eye=this.intel[team], fog=this.mode==='fog';
    return {time:+s.time.toFixed(2),credits:s.sides[team].credits,queue:s.sides[team].queue.map(q=>({...q})),
      units:s.units.filter(u=>u.team===team||!fog||eye.sees(u)).map(viewUnit),
      cell:CELL, cols, rows, mask:fog?eye.encode():'',
      ghosts:fog?[...eye.memory.values()].filter(g=>!eye.sees(g)):[],
      events:this.events[team].splice(0),end:s.end};
  }
}
