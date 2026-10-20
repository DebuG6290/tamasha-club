export const CUP_GAMES=['bluff','same','ducks','race'];
const POINTS=[10,8,6,5,4,3,2,1];
export const makeCup=()=>({enabled:false,games:['ducks','race','bluff','same'],repeats:1,active:false,completed:false,index:0,playlist:[],matches:[],scores:{}});
export function configureCup(cup,a){
  if(typeof a.enabled==='boolean')cup.enabled=a.enabled;
  if(a.games!==undefined){if(!Array.isArray(a.games)||!a.games.length||a.games.some(k=>!CUP_GAMES.includes(k)))throw Error('Choose at least one tournament game.');cup.games=[...new Set(a.games)];}
  if(a.repeats!==undefined){if(![1,2,3].includes(a.repeats))throw Error('Choose one, two or three runs.');cup.repeats=a.repeats;}
}
export function startCup(cup,players){
  const playlist=Array.from({length:cup.repeats},()=>cup.games).flat();if(playlist.length<2)throw Error('A tournament needs at least two matches.');
  if(players.length<(playlist.includes('bluff')||playlist.includes('same')?4:2))throw Error('Bring four players for the selected party games, or choose only shooting and racing.');
  Object.assign(cup,{active:true,completed:false,index:0,playlist,matches:[],scores:Object.fromEntries(players.map(p=>[p.id,0]))});return playlist[0];
}
export function recordCup(cup,kind,rows){
  if(!cup.active||cup.completed||cup.matches.length>cup.index)return;
  const awards=rows.map(r=>({id:r.ids[0],place:r.rank,points:POINTS[r.rank-1]??0,score:r.score}));
  for(const a of awards)cup.scores[a.id]=(cup.scores[a.id]||0)+a.points;
  cup.matches.push({game:kind,awards});
}
export function nextCup(cup){
  if(!cup.active||cup.completed||cup.matches.length!==cup.index+1)throw Error('Finish the current tournament match first.');
  if(cup.index+1===cup.playlist.length){cup.completed=true;return null;}return cup.playlist[++cup.index];
}
export function cupStandings(cup){const rows=Object.entries(cup.scores).map(([id,score])=>({id,ids:[id],score,detail:`${cup.matches.length} matches · tournament points`})).sort((a,b)=>b.score-a.score);rows.forEach((r,i)=>r.rank=i&&r.score===rows[i-1].score?rows[i-1].rank:i+1);return rows;}
export function cupView(cup){return {...cup,scores:{...cup.scores},standings:cupStandings(cup)};}
