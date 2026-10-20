import {shuffled} from './engine.mjs';

// Lines of the projective plane over F5: 31 cards, 6 symbols per card.
// Every pair of distinct cards intersects in exactly one symbol.
export function makeSymbolDeck(){
  const q=5,cards=[];
  for(let m=0;m<q;m++)for(let b=0;b<q;b++)cards.push([...Array.from({length:q},(_,x)=>x*q+(m*x+b)%q),25+m]);
  for(let x=0;x<q;x++)cards.push([...Array.from({length:q},(_,y)=>x*q+y),30]);
  cards.push([25,26,27,28,29,30]);return cards;
}
export const SPOT_ROUNDS=15,SPOT_SECONDS={ready:3,search:18,reveal:2.4};
export function makeSpot(players,random=Math.random){
  if(players.length<2||players.length>8)throw Error('Ek Jaisa! needs two to eight players.');
  const symbols=shuffled(Array.from({length:31},(_,i)=>i),random);
  const deck=shuffled(makeSymbolDeck().map(c=>c.map(i=>symbols[i])),random);
  const g={kind:'spot',round:1,total:SPOT_ROUNDS,epoch:0,step:'ready',done:false,deck,scores:Object.fromEntries(players.map(p=>[p.id,0])),lastSeq:{},feedback:{},blocked:{},streak:0,lastWinner:null};
  deal(g,players,random);return g;
}
function deal(g,players,random=Math.random){
  g.center=shuffled(g.deck[g.round-1],random);
  const pool=shuffled(g.deck.filter(c=>c!==g.deck[g.round-1]),random);
  g.hands=Object.fromEntries(players.map((p,i)=>[p.id,shuffled(pool[i],random)]));
  g.outcome=null;g.feedback={};g.blocked={};g.step='ready';g.epoch++;
}
export function spotSeconds(g){return SPOT_SECONDS[g.step];}
function reveal(g,winner=null,symbol=null){
  g.streak=winner&&winner===g.lastWinner?g.streak+1:winner?1:0;g.lastWinner=winner;
  g.outcome={winner,symbol,streak:g.streak};g.step='reveal';g.epoch++;
}
export function advanceSpot(g,players,random=Math.random){
  if(g.step==='ready'){g.step='search';g.epoch++;return;}
  if(g.step==='search'){reveal(g);return;}
  if(g.round===g.total){g.done=true;return;}
  g.round++;deal(g,players,random);
}
export function spotAction(g,id,a,now=Date.now()){
  if(g.done||g.step!=='search')throw Error('Wait for the next card.');
  if(a.type!=='spot'||a.round!==g.round||a.epoch!==g.epoch)throw Error('That card has moved on.');
  const hand=g.hands[id];if(!hand)throw Error('Join this game first.');
  if(!Number.isSafeInteger(a.seq)||a.seq<=0||!Number.isInteger(a.symbol)||!hand.includes(a.symbol))throw Error('Tap a symbol on your card.');
  if(a.seq<=(g.lastSeq[id]||0))return false;
  if(now<(g.blocked[id]||0))throw Error('Take a breath. Your card unlocks in a moment.');
  g.lastSeq[id]=a.seq;
  if(g.center.includes(a.symbol)){
    g.scores[id]++;g.feedback[id]={seq:a.seq,kind:'correct',symbol:a.symbol};reveal(g,id,a.symbol);
  }else{
    g.scores[id]=Math.max(0,g.scores[id]-1);g.blocked[id]=now+1000;
    g.feedback[id]={seq:a.seq,kind:'wrong',symbol:a.symbol};
  }
  return true;
}
export function spotBot(g,players,now=Date.now()){
  const bots=players.filter(p=>p.bot&&now>=(g.blocked[p.id]||0));if(!bots.length)return false;
  const p=bots[Math.floor(Math.random()*bots.length)],symbol=g.hands[p.id].find(s=>g.center.includes(s));
  return spotAction(g,p.id,{type:'spot',round:g.round,epoch:g.epoch,seq:(g.lastSeq[p.id]||0)+1,symbol},now);
}
export function spotView(g,me){
  return {game:{kind:g.kind,round:g.round,total:g.total,epoch:g.epoch,step:g.step,done:g.done,center:g.step==='ready'?[]:[...g.center],scores:{...g.scores},outcome:g.outcome?{...g.outcome}:null},private:me?{hand:g.step==='ready'?[]:[...g.hands[me.id]],lastSeq:g.lastSeq[me.id]||0,blockedUntil:g.blocked[me.id]||0,feedback:g.feedback[me.id]?{...g.feedback[me.id]}:null}:null};
}
export function spotStandings(g){
  const rows=Object.entries(g.scores).map(([id,score])=>({id,ids:[id],score,detail:'Matching cards won · wrong taps cost 1'})).sort((a,b)=>b.score-a.score);
  rows.forEach((r,i)=>r.rank=i&&r.score===rows[i-1].score?rows[i-1].rank:i+1);return rows;
}
