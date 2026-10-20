// Original content for two spoken party games. Secrets never enter the public view.
import {shuffled} from './engine.mjs';

export const TOPICS = [
  {label:'Chaat break',words:['Golgappa','Samosa','Bhel puri','Dahi bhalla','Aloo tikki','Pav bhaji','Kachori','Vada pav'],clues:['Queue','Triangle','Crunch','Cold','Round','Butter','Morning','Travel']},
  {label:'Ghar ki cheezein',words:['Pressure cooker','Ceiling fan','TV remote','Steel dabba','Doorbell','Broom','Alarm clock','Mixer'],clues:['Whistle','Summer','Missing','Leftovers','Visitor','Corner','Snooze','Noise']},
  {label:'Bahar chalte hain',words:['Cinema','Railway station','Beach','Zoo','Mall','Wedding hall','Park','Airport'],clues:['Dark','Platform','Sand','Stripes','Escalator','Invitation','Bench','Security']},
  {label:'Getting around',words:['Auto','Cycle','Metro','School bus','Scooter','Train','Boat','Aeroplane'],clues:['Meter','Pedal','Token','Uniform','Helmet','Berth','Oar','Window']},
  {label:'Sweet tooth',words:['Jalebi','Gulab jamun','Rasgulla','Kulfi','Kaju katli','Laddoo','Kheer','Gajar halwa'],clues:['Spiral','Warm','Squeeze','Stick','Diamond','Box','Spoon','Winter']},
  {label:'Chhutti ka plan',words:['Picnic','Road trip','Camping','Shopping','Cricket match','Movie night','House party','Hiking'],clues:['Basket','Playlist','Tent','Bargain','Boundary','Blanket','Doorbell','Shoes']},
  {label:'Shaadi scenes',words:['Baraat','Buffet','Mehendi','Photographer','Invitation card','DJ','Stage sofa','Gift envelope'],clues:['Traffic','Second helping','Palms','Pose','Address','Volume','Waiting','Pocket']},
  {label:'School memories',words:['Lunch box','Blackboard','Homework','Assembly','Report card','School bell','PT period','Library'],clues:['Sharing','Dust','Tomorrow','Line','Signature','Relief','Shoes','Silence']},
];
export const SCALES = [
  ['Light snack','Full meal','Food'],['Everyday clothes','Full shaadi outfit','Getting ready'],
  ['Normal entry','Full hero entry','Making an entrance'],['Quick errand','Poora din gaya','Making plans'],
  ['Whisper','Neighbours can hear','Volume'],['Easy to share','Last bite is mine','Food habits'],
  ['Five-minute packing','Moving the whole house','Travel'],['Simple gift','Grand gesture','Giving'],
  ['Very chill','Full competition mode','Game night'],['Walkable','Definitely need an auto','Distance'],
  ['Just a drizzle','Cancel all plans','Weather'],['Small bag','Extra baggage counter','Packing'],
  ['Everyday treat','Special occasion only','Treats'],['One photo','Full photoshoot','Taking pictures'],
  ['Easy fix','Call the whole family','A small problem'],['Little nap','See you tomorrow','Sleep'],
  ['One friend visiting','Full house','Hosting'],['Tiny detour','New road trip','Navigation'],
  ['Mildly spicy','Need three glasses of water','Spice'],['Quiet celebration','Whole street knows','Celebrating'],
  ['Casual game','Tournament final','Competition'],['One small purchase','Need another suitcase','Shopping'],
  ['Barely a dance move','Wedding dance performance','Dance'],['Short reply','Full voice-note series','Messaging'],
  ['A little late','Everyone has gone home','Timing'],['Simple breakfast','Sunday feast','Breakfast'],
  ['Quite comfortable','Never leaving this sofa','Comfort'],['Easy to explain','Need a family meeting','Explaining'],
  ['Small favour','Owe you for a year','Helping'],['One episode','Sun is coming up','Watching TV'],
  ['Low-key plan','Need a spreadsheet','Planning'],['Quick goodbye','Still at the door an hour later','Goodbyes'],
];
export const isParty = kind => kind==='bluff'||kind==='same';
const choose=(items,random)=>items[Math.min(items.length-1,Math.floor(random()*items.length))];
function step(g,name){g.step=name;g.epoch++;g.inputs={};}
export function makeParty(players,kind,random=Math.random,paired=false){
  if(!isParty(kind))throw Error('Unknown party game');
  if(players.length<4)throw Error('Bring at least four players, or add demo players.');
  const teams=[...new Set(players.map(p=>p.team))];
  if(kind==='same'&&paired&&teams.some(t=>players.filter(p=>p.team===t).length!==2))throw Error('Pair mode needs complete pairs. Switch to individual mode or fill the pairs.');
  const g={kind,paired:kind==='same'&&paired,round:1,epoch:0,step:'',inputs:{},scores:Object.fromEntries(players.map(p=>[p.id,0])),outcome:null,done:false};
  if(kind==='bluff'){
    g.roleOrder=shuffled(players.map(p=>p.id),random);g.total=players.length;
    g.cards=shuffled(TOPICS.flatMap(topic=>topic.words.map((word,i)=>({topic,word,hint:topic.clues[i]}))),random).slice(0,g.total);
  }else{
    const order=shuffled(teams,random);g.schedule=paired?[0,1].flatMap(role=>order.map(team=>({team,giver:players.filter(p=>p.team===team)[role].id}))):shuffled(players,random).map(p=>({team:p.team,giver:p.id}));
    g.total=g.schedule.length;g.cards=shuffled(SCALES,random).slice(0,g.total).map(scale=>({scale,target:10+Math.floor(random()*81)}));
    g.teamScores=Object.fromEntries(teams.map(t=>[t,0]));
  }
  begin(g,players,random);return g;
}
function begin(g,players,random=Math.random){
  g.outcome=null;
  if(g.kind==='bluff'){
    g.card=g.cards[g.round-1];g.impostor=g.roleOrder[g.round-1];
    g.order=shuffled(players.map(p=>p.id),random);g.clueIndex=0;g.clues=[];g.ballot=null;step(g,'deal');
  }else{
    Object.assign(g,g.schedule[g.round-1],g.cards[g.round-1]);step(g,'clue');
  }
}
export function partySeconds(g){return g.step==='reveal'?12:g.kind==='bluff'?({deal:30,clues:12,discuss:25,vote:20,guess:12}[g.step]||20):g.step==='clue'?40:25;}
function endBluff(g,guessed=null){
  const correct=guessed===g.card.word,escaped=!g.ballot.caught||correct;
  const awarded=escaped?[g.impostor]:g.roleOrder.filter(id=>id!==g.impostor);
  for(const id of awarded)g.scores[id]+=escaped?3:2;
  g.outcome={...g.ballot,impostor:g.impostor,word:g.card.word,guessed,correct,escaped,awarded};step(g,'reveal');
}
function countVotes(g){
  const votes=Object.entries(g.inputs).map(([by,v])=>({by,target:v.target}));const counts={};
  for(const v of votes)counts[v.target]=(counts[v.target]||0)+1;
  const high=Math.max(0,...Object.values(counts));const leaders=Object.keys(counts).filter(id=>counts[id]===high);
  const accused=leaders.length===1?leaders[0]:null;
  g.ballot={votes,counts,accused,tied:leaders.length>1,caught:accused===g.impostor};
  if(g.ballot.caught)step(g,'guess');else endBluff(g);
}
export function samePoints(distance){return distance<=3?5:distance<=10?3:distance<=25?1:0;}
function endSame(g,players,skipped=false){
  const guesses=Object.entries(g.inputs).map(([id,v])=>({id,value:v.value}));const rows=[];
  if(!g.paired){
    for(const p of players.filter(p=>p.id!==g.giver)){
      const v=guesses.find(v=>v.id===p.id),value=skipped||!v?null:v.value,distance=value===null?null:Math.abs(value-g.target),points=distance===null?0:samePoints(distance);
      g.scores[p.id]+=points;rows.push({id:p.id,ids:[p.id],team:p.team,value,distance,points,guesses:v?[v]:[]});
    }
    const bonus=Math.round(rows.reduce((sum,r)=>sum+r.points,0)/rows.length);g.scores[g.giver]+=bonus;
    const giver=players.find(p=>p.id===g.giver);rows.unshift({id:g.giver,ids:[g.giver],team:giver.team,value:null,distance:null,points:bonus,guesses:[],giver:true});
    g.outcome={target:g.target,rows,skipped};step(g,'reveal');return;
  }
  for(const team of Object.keys(g.teamScores).map(Number)){
    const ps=players.filter(p=>p.team===team&&p.id!==g.giver),submitted=guesses.filter(v=>ps.some(p=>p.id===v.id));
    const value=skipped||!submitted.length?null:Math.round(submitted.reduce((n,v)=>n+v.value,0)/submitted.length);
    const distance=value===null?null:Math.abs(value-g.target),points=distance===null?0:samePoints(distance);
    g.teamScores[team]+=points;rows.push({id:String(team),ids:players.filter(p=>p.team===team).map(p=>p.id),team,value,distance,points,guesses:submitted});
  }
  g.outcome={target:g.target,rows,skipped};step(g,'reveal');
}
function clueDone(g,players,skipped=false){
  const id=g.order[g.clueIndex];const p=players.find(p=>p.id===id);
  const text=p.bot?(id===g.impostor?g.card.topic.clues[(g.card.topic.words.indexOf(g.card.word)+2)%g.card.topic.clues.length]:g.card.hint):null;
  g.clues.push({id,text,skipped});g.clueIndex++;
  step(g,g.clueIndex>=g.order.length?'discuss':'clues');
}
export function advanceParty(g,players){
  if(g.step==='reveal'){
    if(g.round===g.total){g.done=true;return}g.round++;begin(g,players);return;
  }
  if(g.kind==='bluff'){
    if(g.step==='deal'){step(g,'clues');return}
    if(g.step==='clues'){clueDone(g,players);return}
    if(g.step==='discuss'){step(g,'vote');return}
  }
  throw Error('Players are choosing. Wait for their phones or the timer.');
}
export function partyTimeout(g,players){
  if(g.kind==='bluff'){
    if(g.step==='clues')clueDone(g,players,true);
    else if(g.step==='vote')countVotes(g);
    else if(g.step==='guess')endBluff(g);
    else advanceParty(g,players);
  }else if(g.step==='reveal')advanceParty(g,players);else endSame(g,players,g.step==='clue');
}
export function partyAction(g,players,id,a){
  if(a.round!==g.round||a.epoch!==g.epoch||a.step!==g.step)throw Error('That moment has passed. Check the current screen.');
  if(g.step==='reveal'||g.done)throw Error('Wait for the next round.');
  if(g.inputs[id])throw Error('Already locked. Look at the big screen.');
  if(g.kind==='bluff'){
    if(g.step==='deal'&&a.type==='ready'){
      g.inputs[id]={ready:true};if(Object.keys(g.inputs).length===players.length)step(g,'clues');return;
    }
    if(g.step==='clues'&&a.type==='clue-done'){
      if(g.order[g.clueIndex]!==id)throw Error('It is someone else’s clue.');clueDone(g,players);return;
    }
    if(g.step==='vote'&&a.type==='vote'){
      if(a.target===id||!players.some(p=>p.id===a.target))throw Error('Choose another player.');
      g.inputs[id]={target:a.target};if(Object.keys(g.inputs).length===players.length)countVotes(g);return;
    }
    if(g.step==='guess'&&a.type==='word'){
      if(id!==g.impostor)throw Error('Only the caught bluffer gets this guess.');
      if(!g.card.topic.words.includes(a.word))throw Error('Choose a word from the board.');endBluff(g,a.word);return;
    }
  }else{
    if(g.step==='clue'&&a.type==='clue-done'){
      if(id!==g.giver)throw Error('Your friend is giving the clue.');step(g,'guess');return;
    }
    if(g.step==='guess'&&a.type==='estimate'){
      if(id===g.giver)throw Error('You know the target. Let everyone else guess.');
      if(!Number.isInteger(a.value)||a.value<0||a.value>100)throw Error('Choose a position from 0 to 100.');
      g.inputs[id]={value:a.value};if(Object.keys(g.inputs).length===players.length-1)endSame(g,players);return;
    }
  }
  throw Error('That action is not available yet.');
}
export function partyBotAction(g,players){
  const available=players.filter(p=>p.bot&&!g.inputs[p.id]);let p,a;
  if(g.kind==='bluff'){
    if(g.step==='deal'){p=available[0];a={type:'ready'}}
    if(g.step==='clues'){p=available.find(p=>p.id===g.order[g.clueIndex]);a={type:'clue-done'}}
    if(g.step==='vote'){p=available[0];if(p)a={type:'vote',target:choose(players.filter(q=>q.id!==p.id),Math.random).id}}
    if(g.step==='guess'){p=available.find(p=>p.id===g.impostor);a={type:'word',word:choose(g.card.topic.words,Math.random)}}
  }else{
    if(g.step==='clue'){p=available.find(p=>p.id===g.giver);a={type:'clue-done'}}
    if(g.step==='guess'){p=available.find(p=>p.id!==g.giver);a={type:'estimate',value:Math.floor(Math.random()*101)}}
  }
  if(!p)return false;partyAction(g,players,p.id,{...a,round:g.round,epoch:g.epoch,step:g.step});return true;
}
export function partyView(g,players,me){
  const game={kind:g.kind,paired:g.paired,round:g.round,total:g.total,step:g.step,epoch:g.epoch,scores:{...g.scores},outcome:g.outcome};
  let priv=null;
  if(g.kind==='bluff'){
    Object.assign(game,{topic:g.card.topic.label,words:g.card.topic.words,order:g.order,speaker:g.order[g.clueIndex]||null,clues:g.clues,accused:g.step==='guess'?g.impostor:null});
    if(me)priv={role:me.id===g.impostor?'bluffer':'informed',word:me.id===g.impostor?null:g.card.word,choice:g.inputs[me.id]||null};
  }else{
    Object.assign(game,{scale:g.scale,giver:g.giver,team:g.team,teamScores:{...g.teamScores},demoClue:players.find(p=>p.id===g.giver)?.bot?'Demo preview: a real player says their own example aloud.':null});
    if(me)priv={role:me.id===g.giver?'giver':'guesser',target:me.id===g.giver?g.target:null,choice:g.inputs[me.id]||null};
  }
  return {game,private:priv,locked:Object.keys(g.inputs)};
}
export function partyStandings(g,players){
  const rows=g.kind==='bluff'||!g.paired?players.map(p=>({id:p.id,ids:[p.id],score:g.scores[p.id],detail:g.kind==='bluff'?'Bluffer wins +3 · each catcher wins +2':'Guess points + clue bonuses'})):Object.entries(g.teamScores).map(([team,score])=>({id:team,ids:players.filter(p=>p.team===Number(team)).map(p=>p.id),score,detail:'Points from every pair’s clues'}));
  rows.sort((a,b)=>b.score-a.score);rows.forEach((r,i)=>r.rank=i&&r.score===rows[i-1].score?rows[i-1].rank:i+1);return rows;
}
