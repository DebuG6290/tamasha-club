import test from 'node:test';import assert from 'node:assert/strict';
import {makeSymbolDeck,makeSpot,advanceSpot,spotAction,spotView,spotStandings} from '../server/spot.mjs';
import {createRoom,joinRoom,hostAction,playerAction,tickRoom,view,rooms} from '../server/rooms.mjs';
const players=Array.from({length:8},(_,i)=>({id:`p${i}`,name:`Player ${i}`,character:i,bot:false}));
const action=(g,id,symbol,seq=1)=>({type:'spot',round:g.round,epoch:g.epoch,symbol:symbol??g.hands[id].find(s=>g.center.includes(s)),seq});
function roomWithPlayers(n=2){const r=createRoom();for(let i=0;i<n;i++)joinRoom(r,`Player ${i}`);return r;}
function expire(r){r.deadline=Date.now()-1;tickRoom(r);}

test('all 465 card pairs have exactly one common symbol; each card has six unique symbols',()=>{
 const deck=makeSymbolDeck();assert.equal(deck.length,31);assert.equal(new Set(deck.flat()).size,31);
 for(let i=0;i<deck.length;i++){assert.equal(new Set(deck[i]).size,6);for(let j=i+1;j<deck.length;j++)assert.equal(deck[i].filter(s=>deck[j].includes(s)).length,1);}
});
test('eight private cards remain distinct, have one match, and are hidden from host and other phones',()=>{
 const g=makeSpot(players);assert.deepEqual(spotView(g,players[0]).private.hand,[]);advanceSpot(g,players);
 const host=spotView(g),phone=spotView(g,players[0]);assert.equal(host.private,null);assert(!('hands' in host.game));assert(!('deck' in host.game));assert(!('answer' in phone.private));
 assert.equal(new Set(Object.values(g.hands).map(h=>[...h].sort((a,b)=>a-b).join(','))).size,8);
 for(const p of players){assert.equal(g.hands[p.id].filter(s=>g.center.includes(s)).length,1);}
 phone.private.hand.pop();phone.game.center.pop();assert.equal(g.hands.p0.length,6);assert.equal(g.center.length,6);
});
test('first correct claim wins once; wrong taps penalize once, lock briefly, and never make scores negative',()=>{
 const g=makeSpot(players);assert.throws(()=>spotAction(g,'p0',action(g,'p0')),/next card/);advanceSpot(g,players);
 const wrong=g.hands.p0.find(s=>!g.center.includes(s)),bad=action(g,'p0',wrong);
 g.scores.p0=2;spotAction(g,'p0',bad,1000);assert.equal(g.scores.p0,1);assert.equal(g.feedback.p0.kind,'wrong');
 assert.equal(spotAction(g,'p0',bad,1100),false);assert.equal(g.scores.p0,1);
 assert.throws(()=>spotAction(g,'p0',action(g,'p0',wrong,2),1500),/breath/);
 spotAction(g,'p0',action(g,'p0',wrong,2),2000);spotAction(g,'p0',action(g,'p0',wrong,3),3000);assert.equal(g.scores.p0,0);
 const a=action(g,'p1');spotAction(g,'p1',a,3100);assert.equal(g.outcome.winner,'p1');assert.equal(g.scores.p1,1);
 assert.throws(()=>spotAction(g,'p2',{...a,symbol:g.hands.p2.find(s=>g.center.includes(s))},3101),/next card/);assert.equal(g.scores.p2,0);
});
test('reject stale rounds, malformed symbols, forged cards, invalid sequence and non-player inputs',()=>{
 const g=makeSpot(players);advanceSpot(g,players);const good=action(g,'p0');
 for(const bad of [{...good,round:2},{...good,epoch:0},{...good,type:'fire'},{...good,symbol:99},{...good,symbol:'1'},{...good,seq:0},{...good,seq:1.1}])assert.throws(()=>spotAction(g,'p0',bad));
 assert.throws(()=>spotAction(g,'host',good));assert.equal(g.scores.p0,0);
 const absent=g.center.find(s=>!g.hands.p0.includes(s));assert.throws(()=>spotAction(g,'p0',{...good,symbol:absent}));
});
test('15 rounds end automatically with ties ranked equally and no repeated centre card',()=>{
 const g=makeSpot(players),centres=new Set();
 for(let i=0;i<15;i++){
  advanceSpot(g,players);centres.add([...g.center].sort((a,b)=>a-b).join(','));
  if(i<4)spotAction(g,players[i%2].id,action(g,players[i%2].id,undefined,i+1));else advanceSpot(g,players);
  assert.equal(g.step,'reveal');advanceSpot(g,players);
 }
 assert.equal(centres.size,15);assert(g.done);const rows=spotStandings(g);assert.equal(rows[0].rank,1);assert.equal(rows[1].rank,1);assert.equal(rows[2].rank,3);
});
test('room flow enforces deadlines, pause, private filtering and tournament progression',()=>{
 const r=roomWithPlayers(),[a,b]=r.players;
 try{
  hostAction(r,{type:'cup-config',enabled:true,games:['spot','race']});hostAction(r,{type:'start'});assert.equal(r.game.kind,'spot');
  expire(r);assert.equal(r.game.step,'search');assert.equal(view(r,r.hostToken).private,null);assert.equal(view(r,a.token).private.hand.length,6);
  hostAction(r,{type:'pause'});assert.throws(()=>playerAction(r,a,action(r.game,a.id)),/paused/);hostAction(r,{type:'pause'});
  r.deadline=Date.now()-1;assert.throws(()=>playerAction(r,a,action(r.game,a.id)),/Time is up/);assert.equal(r.game.step,'reveal');
  expire(r);
  for(let round=2;round<=15;round++){expire(r);playerAction(r,round%2?a:b,action(r.game,(round%2?a:b).id,undefined,round));expire(r);}
  assert.equal(r.phase,'results');assert.equal(r.cup.matches.length,1);assert.equal(r.cup.matches[0].game,'spot');hostAction(r,{type:'cup-next'});assert.equal(r.game.kind,'race');assert.equal(r.cup.index,1);
 }finally{rooms.delete(r.code);}
});
test('stale actions after auto advance cannot claim the new round; rematch clears scores',()=>{
 const r=roomWithPlayers();try{hostAction(r,{type:'start',game:'spot'});expire(r);const a=action(r.game,r.players[0].id);playerAction(r,r.players[0],a);expire(r);expire(r);assert.throws(()=>playerAction(r,r.players[0],a),/moved on/);hostAction(r,{type:'lobby'});hostAction(r,{type:'start',game:'spot'});assert(Object.values(r.game.scores).every(s=>s===0));}finally{rooms.delete(r.code);}
});
