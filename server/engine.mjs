export const DIRECTIONS = { up:[0,-1], right:[1,0], down:[0,1], left:[-1,0], stay:[0,0] };
export const COLORS = ['coral','blue','gold','mint'];
export const key = (x,y) => `${x},${y}`;
export const equal = (a,b) => a.x===b.x && a.y===b.y;
export const shuffled = (items,random=Math.random) => {
  const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a;
};
export function arena(round=1){
  const missing=new Set(['0,0','4,0','0,4','4,4']);
  if(round>4) ['1,0','3,0','0,1','4,1'].forEach(x=>missing.add(x));
  if(round>8) ['0,3','4,3','1,4','3,4'].forEach(x=>missing.add(x));
  return Array.from({length:25},(_,i)=>({x:i%5,y:Math.floor(i/5)})).filter(p=>!missing.has(key(p.x,p.y)));
}
export function collapsing(round){return round===4?['1,0','3,0','0,1','4,1']:round===8?['0,3','4,3','1,4','3,4']:[]}
export function spawnStars(players,round,random=Math.random){
  const occupied=new Set(players.map(p=>key(p.x,p.y)));
  const danger=new Set(collapsing(round));
  return shuffled(arena(round).filter(p=>!occupied.has(key(p.x,p.y))&&!danger.has(key(p.x,p.y))),random).slice(0,3);
}
export function makeTerrace(players,random=Math.random){
  const slots=[{x:1,y:0},{x:3,y:0},{x:0,y:1},{x:4,y:1},{x:0,y:3},{x:4,y:3},{x:1,y:4},{x:3,y:4}];
  const pieces=players.map((p,i)=>({id:p.id,...slots[i],score:0,stars:0,falls:0,protected:false}));
  return {kind:'terrace',round:1,players:pieces,stars:spawnStars(pieces,1,random),events:[],egg:null};
}
export function resolveTerrace(game,choices,random=Math.random){
  const before=structuredClone(game.players), valid=new Set(arena(game.round).map(p=>key(p.x,p.y)));
  const next=before.map(p=>({...p})); const actions={}; const proposed={}; const moving=new Set(); const events=[];
  for(const p of next){
    const c=choices[p.id]||{direction:'stay',action:'brace'};
    const direction=DIRECTIONS[c.direction]?c.direction:'stay';
    const action=p.protected&&c.action==='shove'?'brace':c.action;
    actions[p.id]={direction,action};
    const [dx,dy]=DIRECTIONS[direction];const target={x:p.x+dx,y:p.y+dy};
    if(action==='move'&&direction!=='stay'&&valid.has(key(target.x,target.y))){proposed[p.id]=target;moving.add(p.id)}
  }
  // Same-destination conflicts and blocked occupants propagate until stable; swaps/cycles are legal.
  for(const p of next){if(!moving.has(p.id))continue; const k=key(proposed[p.id].x,proposed[p.id].y);
    if(next.filter(q=>proposed[q.id]&&key(proposed[q.id].x,proposed[q.id].y)===k).length>1) moving.delete(p.id);
  }
  let changed=true;while(changed){changed=false;for(const p of next){
    if(!moving.has(p.id))continue;
    const occupant=before.find(q=>equal(q,proposed[p.id]));
    if(occupant&&!moving.has(occupant.id)){moving.delete(p.id);changed=true}
  }}
  for(const p of next){if(moving.has(p.id)){Object.assign(p,proposed[p.id]);events.push({type:'move',id:p.id})}
    else if(proposed[p.id])events.push({type:'bounce',id:p.id});}
  const positions=structuredClone(next); const hits={};
  for(const p of positions){const a=actions[p.id];if(a.action!=='shove'||a.direction==='stay')continue;
    const [dx,dy]=DIRECTIONS[a.direction];const q=positions.find(q=>q.x===p.x+dx&&q.y===p.y+dy);
    if(q){(hits[q.id]??=[]).push({by:p.id,dx,dy})}
  }
  const pushes={};for(const q of positions){const h=hits[q.id];if(!h)continue;
    if(h.length!==1||actions[q.id].action==='brace'||q.protected){events.push({type:'block',id:q.id});continue}
    const hit=h[0], dest={x:q.x+hit.dx,y:q.y+hit.dy};
    if(positions.some(p=>equal(p,dest))){events.push({type:'block',id:q.id});continue}
    pushes[q.id]={...dest,by:hit.by};
  }
  for(const p of next){const push=pushes[p.id];if(!push)continue;
    if(Object.entries(pushes).filter(([,d])=>equal(d,push)).length>1){events.push({type:'block',id:p.id});continue}
    Object.assign(p,{x:push.x,y:push.y});events.push({type:'hit',id:p.id,by:push.by});
  }
  const danger=new Set(collapsing(game.round));const deltas={};
  for(const p of next){const fall=!valid.has(key(p.x,p.y))||danger.has(key(p.x,p.y));
    if(fall){const loss=before.find(q=>q.id===p.id).score>0?-1:0;p.falls++;deltas[p.id]=(deltas[p.id]||0)+loss;p.fallen=true;
      const hit=events.find(e=>e.type==='hit'&&e.id===p.id);
      if(hit){deltas[hit.by]=(deltas[hit.by]||0)+2;}
      events.push({type:'fall',id:p.id,by:hit?.by});
    }else if(game.stars.some(s=>equal(s,p))){p.stars++;deltas[p.id]=(deltas[p.id]||0)+1;events.push({type:'star',id:p.id})}
  }
  for(const p of next)p.score=Math.max(0,before.find(q=>q.id===p.id).score+(deltas[p.id]||0));
  return {...game,players:next,events,deltas,before,oldStars:game.stars,
    egg:next.every(p=>actions[p.id].action==='brace')&&!game.eggSeen?'peace':null,
    eggSeen:game.eggSeen||next.every(p=>actions[p.id].action==='brace')};
}
export function nextTerrace(game,random=Math.random){
  const round=game.round+1;const players=game.players.map(p=>({...p,protected:false}));
  const vacant=shuffled(arena(round).filter(s=>!players.some(p=>!p.fallen&&equal(p,s))),random);
  for(const p of players){if(p.fallen){const slot=vacant.shift();if(!slot)throw Error('No safe respawn');Object.assign(p,slot,{fallen:false,protected:true})}}
  return {...game,round,players,stars:spawnStars(players,round,random),events:[],deltas:{},before:null,egg:null};
}
let serial=0;
export function makeDeck(){const deck=[];for(const color of COLORS){for(let n=1;n<=6;n++)for(let j=0;j<2;j++)deck.push({id:`c${serial++}`,color,value:String(n)});
  for(let j=0;j<2;j++)deck.push({id:`c${serial++}`,color,value:'+1'});deck.push({id:`c${serial++}`,color,value:'reverse'});}
  for(let j=0;j<4;j++)deck.push({id:`c${serial++}`,color:'wild',value:'wild'});return deck;
}
export const legalCard=(card,game)=>card.color==='wild'||card.color===game.color||card.value===game.top.value;
export function makeCards(players,random=Math.random){
  const deck=shuffled(makeDeck(),random),hands={};for(const p of players)hands[p.id]=deck.splice(0,5);
  const i=deck.findIndex(c=>/^\d$/.test(c.value));const top=deck.splice(i,1)[0];
  return {kind:'rang',deck,hands,top,discard:[top],color:top.color,turn:0,direction:1,order:players.map(p=>p.id),drawn:null,log:'Match the colour or symbol. First empty hand wins.',winner:null,passes:0};
}
export function drawCards(game,id,count,random=Math.random){let got=[];
  for(let i=0;i<count;i++){if(!game.deck.length){if(game.discard.length<=1)break;game.deck=shuffled(game.discard.slice(0,-1),random);game.discard=[game.top]}
    const c=game.deck.pop();game.hands[id].push(c);got.push(c)}return got;
}
export function advanceCards(game,random=Math.random,penalty=false){
  game.turn=(game.turn+game.direction+game.order.length)%game.order.length;game.drawn=null;
  if(penalty)drawCards(game,game.order[game.turn],1,random);
}
export function actCards(game,id,action,random=Math.random){
  if(game.winner||game.order[game.turn]!==id)throw Error('It is not your turn');
  const g=structuredClone(game);g.passes=0;
  if(action.type==='play'){
    const i=g.hands[id].findIndex(c=>c.id===action.card);if(i<0)throw Error('Card not in your hand');
    const card=g.hands[id][i];if(!legalCard(card,g))throw Error('Match the active colour or symbol');
    if(g.drawn&&g.drawn!==card.id)throw Error('Only the newly drawn card may be played');
    if(card.color==='wild'&&!COLORS.includes(action.color))throw Error('Choose a colour');
    g.hands[id].splice(i,1);g.top=card;g.color=card.color==='wild'?action.color:card.color;g.discard.push(card);
    g.log=card.value==='reverse'?'Reverse. The turn goes the other way.':card.value==='+1'?'+1. Next player draws one, then plays.':card.color==='wild'?`New colour: ${g.color}.`:'Your move.';
    if(card.value==='reverse')g.direction*=-1;
    if(!g.hands[id].length){g.winner=id;return g}
    advanceCards(g,random,card.value==='+1');return g;
  }
  if(action.type==='draw'){
    if(g.drawn)throw Error('You already drew a card');
    if(g.hands[id].some(c=>legalCard(c,g)))throw Error('You have a matching card');
    const [card]=drawCards(g,id,1,random);
    if(card&&legalCard(card,g)){g.drawn=card.id;g.log='New card matches. Play it or keep it.'}
    else {g.log='One card drawn.';advanceCards(g,random);if(!card){g.passes=game.passes+1;if(g.passes>=g.order.length)g.exhausted=true}}
    return g;
  }
  if(action.type==='keep'&&g.drawn){advanceCards(g,random);return g}
  throw Error('Invalid card action');
}
export const JUNCTIONS=[
  {name:'The market shortcut',routes:[{name:'Market lane',tag:'Bumpy',base:4,hazard:[false,false,true]},{name:'Ring road',tag:'Open',base:3,hazard:[false,false,false]}],hint:'Bumpy roads spill cargo at Turbo.'},
  {name:'Rain, obviously',routes:[{name:'Low road',tag:'Flooded',base:4,hazard:[false,true,true]},{name:'Flyover',tag:'Open',base:3,hazard:[false,false,false]}],hint:'Flooded roads are safe only at Slow.'},
  {name:'The school crossing',routes:[{name:'School lane',tag:'No stopping',base:4,hazard:[true,false,false]},{name:'Park road',tag:'Bumpy',base:3,hazard:[false,false,true]}],hint:'No stopping means Slow loses cargo. Bumpy means no Turbo.'},
  {name:'One last delivery',routes:[{name:'Main road',tag:'Open',base:3,hazard:[false,false,false]},{name:'Back alley',tag:'Bumpy',base:4,hazard:[false,false,true]}],hint:'Bumpy roads spill cargo at Turbo.'},
  {name:'A very wet shortcut',routes:[{name:'Canal road',tag:'Flooded',base:5,hazard:[false,true,true]},{name:'Station road',tag:'Open',base:3,hazard:[false,false,false]}],hint:'Flooded roads are safe only at Slow.'},
  {name:'Traffic has opinions',routes:[{name:'Clock tower',tag:'No stopping',base:5,hazard:[true,false,false]},{name:'Library road',tag:'Open',base:3,hazard:[false,false,false]}],hint:'No stopping: Slow causes a spill; Cruise or Turbo is safe.'},
  {name:'The cricket detour',routes:[{name:'Ground lane',tag:'Bumpy',base:5,hazard:[false,false,true]},{name:'Wide road',tag:'Open',base:4,hazard:[false,false,false]}],hint:'Bumpy roads spill cargo at Turbo.'},
  {name:'Almost there. Maybe.',routes:[{name:'Bridge road',tag:'Open',base:4,hazard:[false,false,false]},{name:'Old town',tag:'Flooded',base:5,hazard:[false,true,true]}],hint:'Flooded roads are safe only at Slow.'},
  {name:'Neighbours are watching',routes:[{name:'Society gate',tag:'Bumpy',base:4,hazard:[false,false,true]},{name:'Service road',tag:'No stopping',base:5,hazard:[true,false,false]}],hint:'Bumpy: avoid Turbo. No stopping: avoid Slow.'},
  {name:'The party is upstairs',routes:[{name:'Hill lane',tag:'No stopping',base:4,hazard:[true,false,false]},{name:'Long way',tag:'Open',base:3,hazard:[false,false,false]}],hint:'No stopping: Slow causes a spill; Cruise or Turbo is safe.'}
];
export function makeAuto(players,random=Math.random){
  const teams=[...new Set(players.map(p=>p.team))].map(team=>({team,ids:players.filter(p=>p.team===team).map(p=>p.id),fuel:6,cargo:6,distance:0,last:null}));
  if(teams.some(t=>t.ids.length!==2)||teams.length<2)throw Error('Auto Duo needs at least two complete pairs');
  return {kind:'auto',round:1,junctions:shuffled(JUNCTIONS,random),teams,events:[],egg:null};
}
export function autoRole(game,id){const team=game.teams.find(t=>t.ids.includes(id));if(!team)return null;const nav=game.round<=5?0:1;return {team,role:team.ids[nav]===id?'route':'pace'}}
export function resolveAuto(game,choices){
  const g=structuredClone(game),junction=g.junctions[g.round-1];g.events=[];
  for(const team of g.teams){const nav=team.ids[g.round<=5?0:1],pacer=team.ids[g.round<=5?1:0];
    const defaultRoute=junction.routes.findIndex(r=>!r.hazard[0]);
    const routeIndex=Number.isInteger(choices[nav]?.route)&&choices[nav].route>=0&&choices[nav].route<2?choices[nav].route:defaultRoute;
    let pace=Number.isInteger(choices[pacer]?.pace)?choices[pacer].pace:0;
    if(pace<0||pace>2||pace>team.fuel)pace=0;
    const route=junction.routes[routeIndex],spill=route.hazard[pace];
    const gained=Math.max(0,route.base+pace-(spill?3:0));
    team.fuel=pace===0?Math.min(6,team.fuel+2):team.fuel-pace;team.distance+=gained;
    if(spill)team.cargo=Math.max(0,team.cargo-1);
    team.last={route:route.name,pace:['Slow','Cruise','Turbo'][pace],gained,spill};g.events.push({type:spill?'spill':'drive',team:team.team});
  }
  g.egg=g.teams.every(t=>!t.last.spill)&&new Set(g.teams.map(t=>`${t.last.route}/${t.last.pace}`)).size===1?'coordination':null;
  return g;
}
export function standings(game,players,paired=true){
  let rows=[];
  if(game.kind==='auto')rows=game.teams.map(t=>({id:String(t.team),ids:t.ids,score:t.distance+2*t.cargo,detail:`${t.distance} distance + ${t.cargo} parcels × 2`}));
  else if(game.kind==='rang')rows=game.order.map(id=>({id,ids:[id],score:-game.hands[id].length,detail:`${game.hands[id].length} cards left`}));
  else if(paired){for(const team of [...new Set(players.map(p=>p.team))]){const ids=players.filter(p=>p.team===team).map(p=>p.id),ps=game.players.filter(p=>ids.includes(p.id));rows.push({id:String(team),ids,score:ps.reduce((n,p)=>n+p.score,0),stars:ps.reduce((n,p)=>n+p.stars,0),falls:ps.reduce((n,p)=>n+p.falls,0),detail:ps.map(p=>`${players.find(q=>q.id===p.id).name} ${p.score}`).join(' + ')})}}
  else rows=game.players.map(p=>({id:p.id,ids:[p.id],score:p.score,stars:p.stars,falls:p.falls,detail:`${p.stars} stars · ${p.falls} falls`}));
  rows.sort((a,b)=>b.score-a.score||(b.stars||0)-(a.stars||0)||(a.falls||0)-(b.falls||0));
  for(let i=0;i<rows.length;i++){const r=rows[i];r.rank=i&&r.score===rows[i-1].score&&(r.stars||0)===(rows[i-1].stars||0)&&(r.falls||0)===(rows[i-1].falls||0)?rows[i-1].rank:i+1}return rows;
}
