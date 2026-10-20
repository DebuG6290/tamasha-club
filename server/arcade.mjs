import {clamp,ducksAt,hitDuck,obstacleAt,noise} from '../shared/arcade-math.mjs';
export const isArcade=k=>k==='ducks'||k==='race';
export const RACE_LENGTH=2200;
export function makeArcade(players,kind,now=Date.now()){
  if(players.length<2)throw Error('Bring at least two players, or add demo players.');
  const g={kind,round:1,total:3,epoch:0,step:'ready',seed:Math.floor(Math.random()*1000000),players:players.map(p=>({id:p.id,score:0})),done:false,events:[]};
  beginArcade(g,now);return g;
}
export function beginArcade(g,now){
  g.step='ready';g.epoch++;g.startsAt=now+5000;g.endsAt=g.startsAt+(g.kind==='ducks'?30000:45000);g.lastTick=g.startsAt;g.hit={};g.outcome=null;g.events=[];
  for(const p of g.players)Object.assign(p,{heat:0,hits:0,shots:0,combo:0,lastShot:0,lastSeq:-1,distance:0,speed:0,lane:1,boosts:3,boostUntil:0,stunUntil:0,crashes:0,nextObstacle:0,finishedAt:null,lastSteer:0});
}
export function arcadeFire(g,id,a,now=Date.now()){
  const p=g.players.find(p=>p.id===id);
  if(g.kind!=='ducks'||g.step!=='shoot'||now>=g.endsAt)throw Error('Wait for the next shooting heat.');
  if(!p||![a.x,a.y].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('Re-centre your aim.');
  if(!Number.isInteger(a.seq)||a.seq<=p.lastSeq)throw Error('That shot was already received.');
  if(now-p.lastShot<600)throw Error('Let the popper recharge.');
  const at=Number.isFinite(a.at)?clamp(a.at,now-200,now):now;
  const duck=ducksAt(g.seed,at-g.startsAt).find(d=>!g.hit[d.id]&&hitDuck(d,a.x,a.y));
  p.lastShot=now;p.lastSeq=a.seq;p.shots++;
  let points=0;if(duck){p.hits++;p.combo++;points=(duck.gold?20:10)+(p.combo%3===0?5:0);p.score+=points;p.heat+=points;g.hit[duck.id]={by:id,at:now};}else p.combo=0;
  const event={type:duck?'duck-hit':'duck-miss',id,seq:a.seq,target:duck?.id??null,points,x:a.x,y:a.y,at:now};
  g.events=[...g.events.slice(-7),event];return event;
}
export function arcadeSteer(g,id,a,now=Date.now()){
  const p=g.players.find(p=>p.id===id);if(g.kind!=='race'||g.step!=='race'||!p||p.finishedAt||now>=g.endsAt)throw Error('Wait for the race.');
  if(a.type==='steer'){
    if(![-1,1].includes(a.direction))throw Error('Steer left or right.');
    if(now-p.lastSteer<140)return false;p.lane=clamp(p.lane+a.direction,0,2);p.lastSteer=now;return true;
  }
  if(a.type==='boost'){
    if(!p.boosts||p.boostUntil>now)throw Error('No boost ready.');p.boosts--;p.boostUntil=now+1800;return true;
  }
  throw Error('Unknown racing control.');
}
function finishHeat(g,now){
  g.step='reveal';g.epoch++;
  if(g.kind==='race'){
    const ranked=[...g.players].sort((a,b)=>(a.finishedAt??Infinity)-(b.finishedAt??Infinity)||b.distance-a.distance);
    ranked.forEach((p,i)=>{const previous=ranked[i-1],same=previous&&p.finishedAt===previous.finishedAt&&Math.abs(p.distance-previous.distance)<.001;const place=same?previous.place:i+1;p.place=place;p.heat=Math.max(1,11-place);p.score+=p.heat;});
  }
  g.outcome={at:now,players:g.players.map(p=>({id:p.id,heat:p.heat,score:p.score,hits:p.hits,shots:p.shots,place:p.place,distance:Math.floor(p.distance),crashes:p.crashes,time:p.finishedAt?((p.finishedAt-g.startsAt)/1000).toFixed(2):null}))};
}
export function tickArcade(g,now=Date.now()){
  if(g.step==='reveal'||g.done)return false;
  if(g.step==='ready'){if(now<g.startsAt)return false;g.step=g.kind==='ducks'?'shoot':'race';g.epoch++;}
  if(g.kind==='race'){
    const until=Math.min(now,g.endsAt),dt=clamp((until-g.lastTick)/1000,0,.5);g.lastTick=until;
    for(const p of g.players){
      if(p.finishedAt)continue;
      const desired=p.stunUntil>now?20:p.boostUntil>now?118:76;p.speed+=(desired-p.speed)*Math.min(1,dt*4);p.distance+=p.speed*dt;
      while(obstacleAt(g.seed,p.nextObstacle).distance<=p.distance){
        const obstacle=obstacleAt(g.seed,p.nextObstacle++);
        if(obstacle.lane===p.lane){p.crashes++;p.speed=12;p.stunUntil=now+700;g.events=[...g.events.slice(-7),{type:'crash',id:p.id,at:now}];}
      }
      if(p.distance>=RACE_LENGTH){p.distance=RACE_LENGTH;p.finishedAt=now;}
    }
  }
  if(now>=g.endsAt||g.kind==='race'&&g.players.every(p=>p.finishedAt)){finishHeat(g,now);return true;}
  return true;
}
export function nextArcade(g,now=Date.now()){
  if(g.step!=='reveal')throw Error('Finish this heat first.');
  if(g.round>=g.total){g.done=true;return}g.round++;g.seed++;beginArcade(g,now);
}
export function arcadeView(g){return {kind:g.kind,round:g.round,total:g.total,epoch:g.epoch,step:g.step,seed:g.seed,startsAt:g.startsAt,endsAt:g.endsAt,sampleAt:g.lastTick,hit:g.hit,players:g.players.map(({lastSeq,lastShot,lastSteer,nextObstacle,...p})=>p),events:g.events,outcome:g.outcome};}
export function arcadeStandings(g){
  const rows=g.players.map(p=>({id:p.id,ids:[p.id],score:p.score,detail:g.kind==='ducks'?'Points across three shooting heats':'Race points across three heats'})).sort((a,b)=>b.score-a.score);
  rows.forEach((r,i)=>r.rank=i&&r.score===rows[i-1].score?rows[i-1].rank:i+1);return rows;
}
export function arcadeBot(g,players,now=Date.now()){
  if(!['shoot','race'].includes(g.step))return null;
  const bots=players.filter(p=>p.bot);if(!bots.length)return null;const p=bots[Math.floor(Math.random()*bots.length)],car=g.players.find(q=>q.id===p.id);
  if(g.kind==='ducks'){
    const d=ducksAt(g.seed,now-g.startsAt).find(d=>!g.hit[d.id]);if(!d)return null;
    try{return arcadeFire(g,p.id,{x:clamp(d.x+(Math.random()-.5)*.07),y:clamp(d.y+(Math.random()-.5)*.09),seq:car.lastSeq+1,at:now},now)}catch{return null}
  }
  const obstacle=obstacleAt(g.seed,car.nextObstacle);if(obstacle.distance-car.distance<120&&obstacle.lane===car.lane&&noise(g.seed,car.nextObstacle+car.id.length)>.2){try{arcadeSteer(g,p.id,{type:'steer',direction:car.lane===2?-1:1},now)}catch{}}
  if(car.boosts&&Math.random()<.09){try{arcadeSteer(g,p.id,{type:'boost'},now)}catch{}}
  return null;
}
