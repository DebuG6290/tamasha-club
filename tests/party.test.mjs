import test from 'node:test';
import assert from 'node:assert/strict';
import {makeParty,partyView,samePoints} from '../server/party.mjs';
import {createRoom,joinRoom,addBots,startGame,playerAction,hostAction,tickRoom,view,rooms} from '../server/rooms.mjs';

function fixture(kind,count=4){const r=createRoom();for(let i=0;i<count;i++)joinRoom(r,`Guest ${i+1}`,Math.floor(i/2));startGame(r,kind);return r;}
function send(r,p,a){const g=r.game;return playerAction(r,p,{...a,round:g.round,step:g.step,epoch:g.epoch});}
function next(r){return hostAction(r,{type:'party-next',round:r.game.round,epoch:r.game.epoch});}
function voting(r){for(const p of r.players)send(r,p,{type:'ready'});while(r.game.step==='clues')send(r,r.players.find(p=>p.id===r.game.order[r.game.clueIndex]),{type:'clue-done'});assert.equal(r.game.step,'discuss');next(r);}
function accuse(r,id){for(const p of r.players)send(r,p,{type:'vote',target:p.id===id?r.players.find(q=>q.id!==id).id:id});}

test('party games require four players; Same Soch rejects incomplete pairs',()=>{
  const ps=Array.from({length:3},(_,i)=>({id:String(i),team:i}));
  assert.throws(()=>makeParty(ps,'bluff'),/four players/);
  assert.throws(()=>makeParty([...ps,{id:'3',team:0}],'same'),/complete pairs/);
});
test('secret roles, word selection, targets and other choices stay off the projector and rival phones',()=>{
  const r=fixture('bluff');const host=view(r,r.hostToken),g=r.game;
  for(const field of ['card','cards','impostor','roleOrder','inputs'])assert.equal(host.game[field],undefined);
  assert.equal(host.private,null);assert.equal(host.game.outcome,null);
  for(const p of r.players){const s=view(r,p.token);assert.equal(s.private.role,p.id===g.impostor?'bluffer':'informed');assert.equal(s.private.word,p.id===g.impostor?null:g.card.word)}
  voting(r);const p=r.players[0],target=r.players[1];send(r,p,{type:'vote',target:target.id});
  assert.equal(view(r,r.hostToken).game.ballot,undefined);assert.equal(view(r,target.token).private.choice,null);assert.equal(view(r,p.token).private.choice.target,target.id);
  rooms.delete(r.code);
  const s=fixture('same'),giver=s.players.find(p=>p.id===s.game.giver);
  assert.equal(view(s,s.hostToken).game.target,undefined);assert.equal(view(s,giver.token).private.target,s.game.target);
  assert.equal(view(s,s.players.find(p=>p.id!==giver.id).token).private.target,null);
  rooms.delete(s.code);
});
test('a tie lets the bluffer escape; ballots are committed once and cannot target yourself',()=>{
  const r=fixture('bluff');voting(r);const [a,b,c,d]=r.players;
  assert.throws(()=>send(r,a,{type:'vote',target:a.id}),/another player/);
  send(r,a,{type:'vote',target:b.id});assert.throws(()=>send(r,a,{type:'vote',target:c.id}),/Already locked/);
  send(r,b,{type:'vote',target:a.id});send(r,c,{type:'vote',target:b.id});send(r,d,{type:'vote',target:a.id});
  assert.equal(r.phase,'reveal');assert.equal(r.game.outcome.tied,true);assert.equal(r.game.outcome.escaped,true);
  assert.equal(r.game.scores[r.game.impostor],3);assert.equal(Object.values(r.game.scores).reduce((a,b)=>a+b),3);rooms.delete(r.code);
});
test('caught bluffer alone gets the word guess; correct guess steals the round',()=>{
  const r=fixture('bluff');voting(r);accuse(r,r.game.impostor);
  assert.equal(r.game.step,'guess');assert.equal(view(r,r.hostToken).game.outcome,null);
  const bluffer=r.players.find(p=>p.id===r.game.impostor),other=r.players.find(p=>p.id!==bluffer.id);
  assert.throws(()=>send(r,other,{type:'word',word:r.game.card.word}),/Only the caught/);
  send(r,bluffer,{type:'word',word:r.game.card.word});assert.equal(r.game.outcome.correct,true);assert.equal(r.game.scores[bluffer.id],3);
  assert.equal(view(r,r.hostToken).game.outcome.word,r.game.card.word);rooms.delete(r.code);
});
test('failed last guess rewards every informed player; next round removes the previous secret and ballot',()=>{
  const r=fixture('bluff');voting(r);accuse(r,r.game.impostor);
  const bluffer=r.players.find(p=>p.id===r.game.impostor);send(r,bluffer,{type:'word',word:r.game.card.topic.words.find(w=>w!==r.game.card.word)});
  assert.equal(r.game.outcome.escaped,false);
  for(const p of r.players)assert.equal(r.game.scores[p.id],p===bluffer?0:2);
  const stale={type:'ready',round:r.game.round,step:'deal',epoch:r.game.epoch};next(r);
  assert.equal(r.game.round,2);assert.equal(r.game.outcome,null);assert.equal(r.game.ballot,null);
  assert.throws(()=>playerAction(r,r.players[0],stale),/moment has passed/);rooms.delete(r.code);
});
test('Same Soch averages rival guesses, awards distance bands and reveals only at the end',()=>{
  const r=fixture('same');r.game.target=50;const giver=r.players.find(p=>p.id===r.game.giver),partner=r.players.find(p=>p.team===giver.team&&p.id!==giver.id),rivals=r.players.filter(p=>p.team!==giver.team);
  assert.throws(()=>send(r,partner,{type:'clue-done'}),/friend is giving/);
  send(r,giver,{type:'clue-done'});assert.throws(()=>send(r,giver,{type:'estimate',value:50}),/know the target/);
  assert.throws(()=>send(r,partner,{type:'estimate',value:101}),/0 to 100/);
  send(r,partner,{type:'estimate',value:51});send(r,rivals[0],{type:'estimate',value:20});
  assert.equal(view(r,r.hostToken).game.outcome,null);assert.equal(view(r,rivals[1].token).private.choice,null);
  send(r,rivals[1],{type:'estimate',value:80});assert.equal(r.phase,'reveal');
  const row=r.game.outcome.rows.find(t=>t.team===rivals[0].team);assert.equal(row.value,50);assert.equal(row.points,5);
  assert.equal(r.game.teamScores[giver.team],5);assert.deepEqual([0,3,4,10,11,25,26].map(samePoints),[5,5,3,3,1,1,0]);rooms.delete(r.code);
});
test('timeouts, pauses and a late old-stage request cannot change the next stage',()=>{
  const r=fixture('same'),giver=r.players.find(p=>p.id===r.game.giver),old={type:'clue-done',round:r.game.round,step:r.game.step,epoch:r.game.epoch};
  hostAction(r,{type:'pause'});tickRoom(r,Date.now()+600000);assert.equal(r.game.step,'clue');hostAction(r,{type:'pause'});
  r.deadline=Date.now()-1;assert.throws(()=>playerAction(r,giver,old),/Time is up/);assert.equal(r.phase,'reveal');assert.equal(r.game.outcome.skipped,true);
  assert(Object.values(r.game.teamScores).every(n=>n===0));next(r);assert.throws(()=>playerAction(r,giver,old),/moment has passed/);rooms.delete(r.code);
});
for(const kind of ['bluff','same'])test(`${kind}: eight demo players complete the whole game, then rematch and reconnect`,()=>{
  const r=createRoom();addBots(r);startGame(r,kind);const ids=r.players.map(p=>p.id),roles=new Set();let runs=0;
  while(r.phase!=='results'&&runs++<1500){
    roles.add(kind==='bluff'?r.game.impostor:r.game.giver);r.botAt=0;
    if(r.game.step==='discuss'||r.game.step==='reveal')r.deadline=0;
    tickRoom(r);
  }
  assert.equal(r.phase,'results');assert.equal(roles.size,8);assert(r.results.some(r=>r.rank===1));
  assert.equal(view(r,r.hostToken).private,null);hostAction(r,{type:'start'});assert.equal(r.phase,'play');
  assert.deepEqual(r.players.map(p=>p.id),ids);assert.equal(view(r,r.players[0].token).me,ids[0]);rooms.delete(r.code);
});
