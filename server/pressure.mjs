export const PRESSURE_ROUNDS=4;
export const PRESSURE_REWARDS=Object.freeze([2,4,7,11,16,22]);
export const PRESSURE_SECONDS=Object.freeze({choose:6,reveal:4});
const cap=PRESSURE_REWARDS.length;
const scoresFor=ids=>Object.fromEntries(ids.map(id=>[id,0]));
const wait=(step,now)=>now+PRESSURE_SECONDS[step]*1000;

export function makePressure(players,random=Math.random,now=Date.now()){
  const ids=players.map(p=>p.id);
  if(ids.length<2||ids.length>8||new Set(ids).size!==ids.length)throw Error('Bas, Ab Nahi! needs two to eight distinct players.');
  const g={kind:'pressure',ids,round:1,total:PRESSURE_ROUNDS,epoch:0,done:false,scores:scoresFor(ids)};
  deal(g,random,now);
  return g;
}
function deal(g,random,now){
  // Stage 1 is safe. Any incoming stage from 2 to cap may bust;
  // one equally likely result has no bust and reaches the cap.
  const bust=2+Math.floor(random()*cap);
  g.bustStage=bust<=cap?bust:null;
  g.points=scoresFor(g.ids);
  g.status=Object.fromEntries(g.ids.map(id=>[id,'active']));
  g.outcome=null;
  startStage(g,1,now);
}
function startStage(g,stage,now){
  g.stage=stage;
  g.step='choose';
  g.choices=Object.create(null);
  g.endsAt=wait('choose',now);
  g.epoch++;
}
export function pressureSeconds(g){return PRESSURE_SECONDS[g.step];}

export function pressureAction(g,id,a,now=Date.now()){
  if(g.done||g.step!=='choose'||a?.type!=='pressure'||a.round!==g.round||a.epoch!==g.epoch||now>=g.endsAt)throw Error('That decision window has closed.');
  if(!Object.hasOwn(g.status,id)||g.status[id]!=='active')throw Error('You are not in this decision.');
  if(a.choice!=='bank'&&a.choice!=='push')throw Error('Choose Bank or Push.');
  if(Object.hasOwn(g.choices,id)){
    if(g.choices[id]===a.choice)return false;
    throw Error('Your choice is already locked.');
  }
  g.choices[id]=a.choice;
  return true;
}
function settle(g,id,points,status){
  g.points[id]=points;
  g.status[id]=status;
}
function reveal(g,reason,now){
  g.step='reveal';
  g.endsAt=wait('reveal',now);
  g.epoch++;
  g.choices=Object.create(null);
  const players=g.ids.map(id=>{
    const points=g.points[id];
    g.scores[id]+=points;
    return {id,points,score:g.scores[id],status:g.status[id]};
  });
  g.outcome={reason,bustStage:g.bustStage,players};
}
export function advancePressure(g,players,random=Math.random,now=Date.now()){
  if(g.done||now<g.endsAt)return false;
  if(g.step==='reveal'){
    if(g.round>=g.total){g.done=true;return true;}
    g.round++;
    deal(g,random,now);
    return true;
  }

  const pushers=[];
  const reward=PRESSURE_REWARDS[g.stage-1];
  for(const id of g.ids){
    if(g.status[id]!=='active')continue;
    if(g.choices[id]==='push')pushers.push(id);
    else settle(g,id,reward,'banked');
  }
  if(!pushers.length){reveal(g,'banked',now);return true;}
  const next=g.stage+1;
  if(next===g.bustStage){
    for(const id of pushers)settle(g,id,0,'busted');
    // Show the actual stage that failed, not the previous safe offer.
    g.stage=next;
    reveal(g,'bust',now);
  }else if(next===cap){
    g.stage=next;
    for(const id of pushers)settle(g,id,PRESSURE_REWARDS[next-1],'capped');
    reveal(g,'cap',now);
  }else startStage(g,next,now);
  return true;
}
export function pressureBot(g,players,now=Date.now(),random=Math.random){
  if(g.done||g.step!=='choose'||now>=g.endsAt)return false;
  let changed=false;
  for(const p of players){
    if(!p.bot||g.status[p.id]!=='active'||Object.hasOwn(g.choices,p.id))continue;
    const choice=g.stage<cap&&random()<(.86-.11*(g.stage-1))?'push':'bank';
    changed=pressureAction(g,p.id,{type:'pressure',round:g.round,epoch:g.epoch,choice},now)||changed;
  }
  return changed;
}
export function pressureView(g,me){
  const {kind,round,total,epoch,step,stage,done,endsAt}=g;
  const game={kind,round,total,epoch,step,stage,cap,reward:PRESSURE_REWARDS[stage-1],done,endsAt,scores:{...g.scores},
    outcome:g.outcome?{...g.outcome,players:g.outcome.players.map(row=>({...row}))}:null};
  const id=me?.id;
  return {game,private:me&&Object.hasOwn(g.status,id)?{
    active:step==='choose'&&g.status[id]==='active',choice:g.choices[id]??null,
  }:null};
}
export function pressureStandings(g){
  const rows=g.ids.map(id=>({id,ids:[id],score:g.scores[id],detail:'Points banked over four rounds'})).sort((a,b)=>b.score-a.score);
  rows.forEach((r,i)=>r.rank=i&&r.score===rows[i-1].score?rows[i-1].rank:i+1);
  return rows;
}
