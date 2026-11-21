import assert from 'node:assert/strict';
import test from 'node:test';
import {
  makeBazaar, bazaarSeconds, advanceBazaar, bazaarAction, bazaarBot,
  bazaarView, bazaarStandings, BAZAAR_ROUNDS,
} from '../server/bazaar.mjs';

const seats = count => Array.from({length:count},(_,i)=>({id:'p'+i,bot:false}));
function rng(seed){
  return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
}
const lock=(g,stallId)=>({type:'bazaar',round:g.round,epoch:g.epoch,stallId});

test('Bazaar requires 2–8 distinct players and generates reproducible six-round markets',()=>{
  for(const n of [0,1,9])assert.throws(()=>makeBazaar(seats(n)),/two to eight/);
  assert.throws(()=>makeBazaar([{id:'x'},{id:'x'}]),/distinct seat/);
  assert.deepEqual(makeBazaar(seats(2),rng(42)).deck,makeBazaar(seats(2),rng(42)).deck);
  for(let seed=0;seed<64;seed++){
    const g=makeBazaar(seats(8),rng(seed));
    assert.equal(g.total,BAZAAR_ROUNDS);
    assert.equal(new Set(g.deck.map(r=>r.targetId)).size,BAZAAR_ROUNDS);
    for(const {stalls,clues,targetId} of g.deck){
      assert.deepEqual(stalls.map(s=>s.id),[...'ABCD'].flatMap(r=>[1,2,3,4].map(c=>r+c)));
      assert.equal(new Set(stalls.map(s=>[...s.items].sort().join('|'))).size,16);
      assert.ok(stalls.every(s=>s.items.length===3&&new Set(s.items).size===3));
      for(const clue of clues)assert.equal(stalls.filter(s=>s.items.includes(clue)).length,4);
      assert.deepEqual(stalls.filter(s=>clues.every(item=>s.items.includes(item))).map(s=>s.id),[targetId]);
    }
  }
});

test('Ready conceals boards; search publishes only clues and lock count, with own selection private',()=>{
  const [alice,bea]=seats(2), g=makeBazaar([alice,bea],rng(1));
  assert.deepEqual(bazaarView(g,null).game.stalls,[]);
  assert.deepEqual(bazaarView(g,alice).game.clues,[]);
  assert.equal(bazaarSeconds(g),3);
  assert.throws(()=>bazaarAction(g,alice.id,lock(g,'A1')),/Wait/);
  advanceBazaar(g);
  assert.equal(bazaarSeconds(g),24);
  const guessed=g.targetId;
  bazaarAction(g,alice.id,lock(g,guessed));
  const host=bazaarView(g,null),p1=bazaarView(g,alice),p2=bazaarView(g,bea);
  assert.equal(host.private,null);
  assert.equal(p1.private.selectedId,guessed);
  assert.equal(p2.private.selectedId,null);
  assert.equal(host.game.lockCount,1);
  assert.equal(host.game.outcome,null);
  assert.deepEqual(host.game.scores,{p0:0,p1:0});
  for(const k of ['targetId','locks','deck'])assert.equal(Object.hasOwn(host.game,k),false);
  assert.ok(host.game.stalls.every(x=>Object.keys(x).join() === 'id,items'));
  host.game.stalls[0].items[0]='changed';
  assert.notEqual(g.stalls[0].items[0],'changed');
});

test('Accept one lock per player, reject changed locks and stale rounds, and score all correct equally',()=>{
  const players=seats(4),g=makeBazaar(players,rng(2));
  const stale=lock(g,'A1');
  advanceBazaar(g);
  assert.throws(()=>bazaarAction(g,'p0',stale),/moved on/);
  assert.throws(()=>bazaarAction(g,'spectator',lock(g,'A1')),/Join/);
  assert.throws(()=>bazaarAction(g,'p0',lock(g,'not-a-stall')),/Choose/);
  assert.throws(()=>bazaarAction(g,'p0',null),/moved on/);
  const wrong=g.stalls.find(s=>s.id!==g.targetId).id;
  assert.equal(bazaarAction(g,'p3',lock(g,g.targetId)),true);
  assert.equal(bazaarAction(g,'p3',lock(g,g.targetId)),false);
  assert.throws(()=>bazaarAction(g,'p3',lock(g,wrong)),/already locked/);
  bazaarAction(g,'p0',lock(g,g.targetId));
  bazaarAction(g,'p1',lock(g,wrong));
  assert.equal(g.step,'search');
  advanceBazaar(g);
  assert.equal(bazaarSeconds(g),4);
  assert.deepEqual(bazaarView(g,null).game.outcome,{targetId:g.targetId,correctIds:['p0','p3']});
  assert.deepEqual(g.scores,{p0:1,p1:0,p2:0,p3:1});
  assert.deepEqual(bazaarStandings(g).map(({rank,score})=>[rank,score]),[[1,1],[1,1],[3,0],[3,0]]);
  assert.throws(()=>bazaarAction(g,'p2',lock(g,g.targetId)),/Wait/);
  advanceBazaar(g);
  assert.equal(g.round,2);
  assert.equal(bazaarView(g,players[0]).private.selectedId,null);
  assert.equal(bazaarView(g,null).game.outcome,null);
});

test('Bot locks are legal; rounds without inputs reveal and the final reveal closes cleanly',()=>{
  const players=seats(3);players[2].bot=true;
  const g=makeBazaar(players,rng(3));
  assert.equal(bazaarBot(g,players,()=>0),false);
  for(let r=1;r<=g.total;r++){
    advanceBazaar(g);
    if(r===1){
      assert.equal(bazaarBot(g,players,()=>0),true);
      assert.equal(bazaarBot(g,players,()=>0),false);
    }
    advanceBazaar(g);
    assert.deepEqual(g.outcome.correctIds,r===1?['p2']:[]);
    advanceBazaar(g);
  }
  assert.equal(g.done,true);
  assert.equal(g.round,g.total);
  const final=bazaarView(g,null);
  advanceBazaar(g);
  assert.deepEqual(bazaarView(g,null),final);
  assert.deepEqual(g.scores,{p0:0,p1:0,p2:1});
});
