import {shuffled} from './engine.mjs';

const MARKETS = [
  [['Tea kettle','Clay cup','Steel tumbler','Glass bottle'],['Lemon','Mint','Ginger','Cardamom']],
  [['Paper kite','Hand fan','Ribbon spool','Pinwheel'],['Moon','Sun','Star','Cloud']],
  [['Mango','Guava','Banana','Pomegranate'],['Basket','Paper bag','Wooden crate','Tray']],
  [['Dhol','Flute','Cymbals','Tambourine'],['Bell','Lantern','Flower garland','Flag']],
  [['Toy train','Toy boat','Toy truck','Toy plane'],['Balloon','Marble','Yo-yo','Spinning top']],
  [['Notebook','Paintbrush','Pencil','Scissors'],['Ruler','Glue pot','Ink bottle','Eraser']]
];
const EXTRAS = ['Coins','Price tag','Parcel','String','Flower','Cloth','Tin','Jar'];
const STALLS = [...'ABCD'].flatMap(row => [1,2,3,4].map(col => row+col));

export const BAZAAR_ROUNDS = MARKETS.length;
export const BAZAAR_SECONDS = Object.freeze({ready:3,search:24,reveal:4});

function marketRound([left,right],targetId,random){
  const clues=[shuffled(left,random)[0],shuffled(right,random)[0]];
  // Each clue appears on four stalls by itself, but the pair appears exactly once.
  const pairs=shuffled(left.flatMap(a=>right.map(b=>[a,b])).filter(([a,b])=>a!==clues[0]||b!==clues[1]),random);
  const stalls=STALLS.map(id=>({
    id,
    // Item order itself must not signal a target.
    items:shuffled([...(id===targetId?clues:pairs.pop()),EXTRAS[Math.floor(random()*EXTRAS.length)]],random)
  }));
  return {stalls,clues,targetId};
}

function deal(g){
  const {stalls,clues,targetId}=g.deck[g.round-1];
  Object.assign(g,{stalls,clues,targetId,locks:Object.create(null),outcome:null,step:'ready'});
  g.epoch++;
}

export function makeBazaar(players,random=Math.random){
  if(players.length<2||players.length>8)throw Error('Bazaar Khoj needs two to eight players.');
  const ids=players.map(p=>p.id);
  if(new Set(ids).size!==ids.length)throw Error('Each bazaar player needs a distinct seat.');
  const targets=shuffled(STALLS,random);
  const deck=shuffled(MARKETS,random).map((market,i)=>marketRound(market,targets[i],random));
  const g={kind:'bazaar',round:1,total:BAZAAR_ROUNDS,epoch:0,done:false,deck,scores:Object.fromEntries(ids.map(id=>[id,0]))};
  deal(g);return g;
}

export function bazaarSeconds(g){return BAZAAR_SECONDS[g.step];}

export function advanceBazaar(g){
  if(g.done)return;
  if(g.step==='ready'){
    g.step='search';g.epoch++;return;
  }
  if(g.step==='search'){
    // Award points only once, on reveal. Arrival order never breaks a tie.
    const correctIds=Object.keys(g.scores).filter(id=>g.locks[id]===g.targetId);
    for(const id of correctIds)g.scores[id]++;
    g.outcome={targetId:g.targetId,correctIds};
    g.step='reveal';g.epoch++;return;
  }
  if(g.round===g.total){g.done=true;g.epoch++;return;}
  g.round++;deal(g);
}

export function bazaarAction(g,id,a){
  if(g.done||g.step!=='search')throw Error('Wait for the next bazaar round.');
  if(a?.type!=='bazaar'||a.round!==g.round||a.epoch!==g.epoch)throw Error('That bazaar round has moved on.');
  if(!Object.hasOwn(g.scores,id))throw Error('Join this game first.');
  if(typeof a.stallId!=='string'||!STALLS.includes(a.stallId))throw Error('Choose a stall from A1 through D4.');
  if(Object.hasOwn(g.locks,id)){
    if(g.locks[id]===a.stallId)return false;
    throw Error('Your stall is already locked.');
  }
  g.locks[id]=a.stallId;
  return true;
}

export function bazaarBot(g,players,random=Math.random){
  if(g.done||g.step!=='search')return false;
  const p=players.find(p=>p.bot&&Object.hasOwn(g.scores,p.id)&&!Object.hasOwn(g.locks,p.id));
  if(!p)return false;
  // Demo bots are imperfect and follow the same one-lock rule.
  const stallId=random()<0.65?g.targetId:STALLS[Math.floor(random()*STALLS.length)];
  return bazaarAction(g,p.id,{type:'bazaar',round:g.round,epoch:g.epoch,stallId});
}

export function bazaarView(g,me){
  const visible=g.step!=='ready';
  return {
    game:{kind:g.kind,round:g.round,total:g.total,epoch:g.epoch,step:g.step,done:g.done,
      stalls:visible?g.stalls.map(({id,items})=>({id,items:[...items]})):[],
      clues:visible?[...g.clues]:[],scores:{...g.scores},lockCount:Object.keys(g.locks).length,
      outcome:g.outcome?{targetId:g.outcome.targetId,correctIds:[...g.outcome.correctIds]}:null},
    private:me&&Object.hasOwn(g.scores,me.id)?{selectedId:g.locks[me.id]??null}:null
  };
}

export function bazaarStandings(g){
  const rows=Object.entries(g.scores).map(([id,score])=>({id,ids:[id],score,detail:'Correct stalls found'})).sort((a,b)=>b.score-a.score);
  rows.forEach((r,i)=>r.rank=i&&r.score===rows[i-1].score?rows[i-1].rank:i+1);
  return rows;
}
