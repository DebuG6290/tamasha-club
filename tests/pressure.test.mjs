import test from 'node:test';
import assert from 'node:assert/strict';
import {makePressure,advancePressure,pressureAction,pressureBot,pressureSeconds,pressureStandings,pressureView,PRESSURE_REWARDS,PRESSURE_ROUNDS} from '../server/pressure.mjs';

const players=[{id:'p1'},{id:'p2'},{id:'p3'}];
const neverBust=()=>.999;
const bustAtThree=()=>.2;
const action=(g,choice)=>({type:'pressure',round:g.round,epoch:g.epoch,choice});
const lock=(g,id,choice)=>pressureAction(g,id,action(g,choice),g.endsAt-1);
const expire=(g,random=neverBust)=>advancePressure(g,players,random,g.endsAt);
const view=(g,id)=>pressureView(g,id?{id}:null);

test('roster needs 2 to 8 unique player identities',()=>{
  assert.throws(()=>makePressure(players.slice(0,1)),/two to eight/);
  assert.doesNotThrow(()=>makePressure(players.slice(0,2)));
  assert.doesNotThrow(()=>makePressure(Array.from({length:8},(_,i)=>({id:String(i)}))));
  assert.throws(()=>makePressure(Array.from({length:9},(_,i)=>({id:String(i)}))),/two to eight/);
  assert.throws(()=>makePressure([{id:'a'},{id:'a'}]),/distinct/);
});

test('live views keep both the bust stage and every other player’s choice secret',()=>{
  const g=makePressure(players,bustAtThree,1000);
  const initial=view(g,'p2');
  assert.equal(initial.private.choice,null);
  assert.equal(view(g).private,null);
  assert.equal(view(g,'spectator').private,null);
  assert.equal(initial.game.outcome,null);
  assert.equal(initial.game.reward,2);
  assert.equal(initial.game.endsAt,7000);
  for(const hidden of ['bustStage','choices','points','status','ids']){
    assert.equal(Object.hasOwn(initial.game,hidden),false);
  }
  assert.equal(lock(g,'p1','bank'),true);
  assert.deepEqual(view(g,'p2'),initial);
  assert.deepEqual(view(g,'p1').private,{active:true,choice:'bank'});
  lock(g,'p2','push');
  lock(g,'p3','push');
  assert.deepEqual(view(g).game,initial.game);
  assert.equal(advancePressure(g,players,neverBust,g.endsAt-1),false);
  assert.equal(g.stage,1);
  expire(g);
  assert.equal(g.stage,2);
  assert.equal(view(g,'p1').private.active,false);
  assert.equal(view(g,'p2').private.choice,null);
  assert.deepEqual(view(g).game.scores,{p1:0,p2:0,p3:0});
});

test('same submission is idempotent, switched and expired decisions are rejected',()=>{
  const g=makePressure(players,neverBust,0);
  const stale=action(g,'push');
  assert.equal(pressureAction(g,'p1',stale,10),true);
  assert.equal(pressureAction(g,'p1',stale,10),false);
  assert.throws(()=>lock(g,'p1','bank'),/already locked/);
  assert.throws(()=>lock(g,'intruder','push'),/not in this decision/);
  assert.throws(()=>lock(g,'p2','yolo'),/Bank or Push/);
  assert.throws(()=>pressureAction(g,'p2',action(g,'bank'),g.endsAt),/window has closed/);
  expire(g);
  assert.throws(()=>pressureAction(g,'p1',stale,g.endsAt-1),/window has closed/);
  // Both non-submitters banked stage 1, and cannot participate in stage 2.
  assert.throws(()=>lock(g,'p2','push'),/not in this decision/);
  assert.equal(lock(g,'p1','bank'),true);
  expire(g);
  assert.equal(g.outcome.reason,'banked');
  const before=view(g);
  assert.equal(advancePressure(g,players,neverBust,g.endsAt-1),false);
  assert.deepEqual(view(g),before);
  expire(g);
  assert.throws(()=>pressureAction(g,'p1',stale,g.endsAt-1),/window has closed/);
});

test('banking happens before a simultaneous bust and only unbanked points are wiped',()=>{
  const g=makePressure(players,bustAtThree,0);
  lock(g,'p1','bank');
  lock(g,'p2','push');
  lock(g,'p3','push');
  expire(g);
  lock(g,'p2','push');
  // p3 times out, which is a bank before p2 hits the trap at stage 3.
  expire(g);
  assert.deepEqual(view(g).game.outcome,{reason:'bust',bustStage:3,players:[
    {id:'p1',points:2,score:2,status:'banked'},
    {id:'p2',points:0,score:0,status:'busted'},
    {id:'p3',points:4,score:4,status:'banked'},
  ]});
  const result=view(g);
  result.game.outcome.players[0].points=999;
  result.game.scores.p1=999;
  assert.equal(view(g).game.outcome.players[0].points,2);
  assert.equal(view(g).game.scores.p1,2);
});

test('cap settles automatically, rounds keep accrued totals, and standings support ties',()=>{
  const g=makePressure(players,neverBust,0);
  assert.equal(pressureSeconds(g),6);
  const seen=[];
  while(g.step==='choose'){
    seen.push(view(g).game.reward);
    lock(g,'p1','push');
    expire(g);
  }
  assert.deepEqual(seen,PRESSURE_REWARDS.slice(0,-1));
  assert.equal(g.stage,PRESSURE_REWARDS.length);
  assert.equal(pressureSeconds(g),4);
  assert.equal(g.outcome.reason,'cap');
  assert.equal(g.outcome.players[0].status,'capped');
  assert.equal(g.outcome.players[0].points,PRESSURE_REWARDS.at(-1));
  assert.equal(g.outcome.bustStage,null);
  for(let r=2;r<=PRESSURE_ROUNDS;r++){
    expire(g);
    assert.equal(g.round,r);
    assert.equal(g.stage,1);
    assert.equal(view(g).game.outcome,null);
    assert.deepEqual(view(g,'p1').private,{active:true,choice:null});
    expire(g);
  }
  expire(g);
  assert.equal(g.done,true);
  assert.equal(expire(g),false);
  assert.deepEqual(pressureStandings(g).map(({ids,rank,score})=>[ids,rank,score]),[[['p1'],1,28],[['p2'],2,8],[['p3'],2,8]]);
});

test('bots lock privately, never advance the clock, and ignore already-locked choices',()=>{
  const roster=[players[0],{...players[1],bot:true}];
  const g=makePressure(roster,()=>0,0);
  const initial=view(g,'p1');
  assert.equal(pressureBot(g,roster,100,()=>0),true);
  assert.equal(pressureBot(g,roster,100,()=>.999),false);
  assert.equal(pressureBot(g,roster,g.endsAt,()=>0),false);
  assert.deepEqual(view(g,'p1'),initial);
  assert.equal(view(g,'p2').private.choice,'push');
  expire(g);
  assert.equal(g.outcome.bustStage,2);
});
