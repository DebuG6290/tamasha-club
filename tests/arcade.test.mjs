import test from 'node:test';import assert from 'node:assert/strict';
import {ducksAt,motionOffset,obstacleAt} from '../shared/arcade-math.mjs';
import {makeArcade,tickArcade,arcadeFire,arcadeSteer,nextArcade,arcadeStandings} from '../server/arcade.mjs';
import {makeCup,configureCup,startCup,recordCup,nextCup,cupStandings} from '../server/tournament.mjs';
import {makeParty,partyAction} from '../server/party.mjs';
import {createRoom,joinRoom,hostAction,tickRoom,rooms} from '../server/rooms.mjs';
const players=Array.from({length:4},(_,i)=>({id:`p${i}`,team:Math.floor(i/2),name:`P${i}`,bot:false}));

test('duck hits are server checked, claimed once, and duplicate or rapid shots cannot add points',()=>{
  const g=makeArcade(players,'ducks',10000),now=g.startsAt+1000;tickArcade(g,now);const duck=ducksAt(g.seed,1000).find(d=>d.x>0&&d.x<1);
  const a={x:duck.x,y:duck.y,seq:1,at:now};assert.equal(arcadeFire(g,'p0',a,now).points,duck.gold?20:10);
  assert.throws(()=>arcadeFire(g,'p0',a,now+700),/already received/);
  assert.throws(()=>arcadeFire(g,'p0',{...a,seq:2},now+100),/recharge/);
  assert.equal(arcadeFire(g,'p1',a,now).points,0);assert.equal(g.players[0].hits,1);assert.equal(g.players[1].combo,0);
  assert.throws(()=>arcadeFire(g,'p2',{...a,x:NaN},now),/aim/);
});
test('client shot timestamps cannot rewind arbitrarily into an old duck position',()=>{
  const g=makeArcade(players,'ducks',10000),now=g.startsAt+6000;tickArcade(g,now);
  const old=ducksAt(g.seed,1000).find(d=>d.x>0&&d.x<1);
  arcadeFire(g,'p0',{x:old.x,y:old.y,seq:1,at:g.startsAt+1000},now);
  const current=ducksAt(g.seed,5800);if(g.players[0].hits)assert(current.some(d=>g.hit[d.id]));
});
test('racing enforces three lanes, finite boosts and deterministic shared obstacles',()=>{
  const g=makeArcade(players,'race',10000),now=g.startsAt+100;tickArcade(g,now);
  arcadeSteer(g,'p0',{type:'steer',direction:-1},now);assert.equal(g.players[0].lane,0);
  arcadeSteer(g,'p0',{type:'steer',direction:-1},now+200);assert.equal(g.players[0].lane,0);
  assert.throws(()=>arcadeSteer(g,'p0',{type:'steer',direction:9},now+400),/left or right/);
  for(let i=0;i<3;i++)arcadeSteer(g,'p0',{type:'boost'},now+i*2000);
  assert.throws(()=>arcadeSteer(g,'p0',{type:'boost'},now+6000),/No boost/);
  assert.deepEqual(obstacleAt(g.seed,2),obstacleAt(g.seed,2));
  const p=g.players[1],obstacle=obstacleAt(g.seed,0);p.lane=obstacle.lane;p.distance=obstacle.distance-1;p.speed=76;
  tickArcade(g,now+100);assert.equal(p.crashes,1);assert(p.stunUntil>now);assert(p.speed<76);
});
test('three arcade heats end in ranked scores and do not award race points twice',()=>{
  const g=makeArcade(players,'race',10000);
  for(let heat=0;heat<3;heat++){
    const end=g.endsAt;tickArcade(g,end);assert.equal(g.step,'reveal');const total=g.players.reduce((n,p)=>n+p.score,0);
    tickArcade(g,end+10000);assert.equal(g.players.reduce((n,p)=>n+p.score,0),total);nextArcade(g,end+15000);
  }
  assert.equal(g.done,true);assert(arcadeStandings(g).some(p=>p.rank===1));
});
test('motion mapping handles neutral positions, portrait/landscape axes and angle wrapping',()=>{
  const base={beta:30,gamma:10};assert.deepEqual(motionOffset(30,10,base,0),{x:0,y:0});
  assert.deepEqual(motionOffset(35,20,base,0),{x:10,y:5});
  const landscape=motionOffset(35,20,base,90);assert(Math.abs(landscape.x-5)<1e-8);assert(Math.abs(landscape.y+10)<1e-8);
  assert.equal(motionOffset(-179,0,{beta:179,gamma:0},0).y,2);
});
test('individual Same Soch supports uneven groups and gives each player a clue turn',()=>{
  const ps=[...players,{id:'extra',team:2}],g=makeParty(ps,'same');assert.equal(g.paired,false);assert.equal(g.total,5);assert.equal(new Set(g.schedule.map(s=>s.giver)).size,5);
  g.target=50;const send=(id,a)=>partyAction(g,ps,id,{...a,round:g.round,step:g.step,epoch:g.epoch});
  send(g.giver,{type:'clue-done'});for(const p of ps.filter(p=>p.id!==g.giver))send(p.id,{type:'estimate',value:50});
  assert(ps.every(p=>g.scores[p.id]===5));assert.equal(g.outcome.rows.length,5);
});
test('tournaments normalise game scores to placing points, share ties and count each match once',()=>{
  const cup=makeCup();configureCup(cup,{enabled:true,games:['ducks','race'],repeats:1});assert.equal(startCup(cup,players),'ducks');
  const rows=[{ids:['p0'],rank:1,score:900},{ids:['p1'],rank:1,score:900},{ids:['p2'],rank:3,score:2},{ids:['p3'],rank:4,score:1}];
  recordCup(cup,'ducks',rows);recordCup(cup,'ducks',rows);assert.equal(cup.matches.length,1);assert.equal(cup.scores.p0,10);assert.equal(cup.scores.p1,10);
  assert.equal(nextCup(cup),'race');recordCup(cup,'race',rows.map(r=>({...r,score:r.score/100})));assert.equal(nextCup(cup),null);assert.equal(cup.completed,true);
  assert.equal(cupStandings(cup)[0].score,20);assert.throws(()=>nextCup(cup),/Finish/);
});
test('a tournament moves between actual arcade matches without losing participants',()=>{
  const r=createRoom();for(let i=0;i<4;i++)joinRoom(r,`Guest ${i}`);const ids=r.players.map(p=>p.id);
  hostAction(r,{type:'cup-config',enabled:true,games:['ducks','race']});hostAction(r,{type:'start'});
  for(const kind of ['ducks','race']){
    assert.equal(r.game.kind,kind);
    for(let i=0;i<3;i++){r.game.startsAt=Date.now()-50000;r.game.endsAt=Date.now()-1;tickRoom(r);assert.equal(r.phase,'reveal');hostAction(r,{type:'arcade-next',round:r.game.round,epoch:r.game.epoch});}
    assert.equal(r.phase,'results');hostAction(r,{type:'cup-next'});
  }
  assert.equal(r.cup.completed,true);assert.equal(r.cup.matches.length,2);assert.deepEqual(r.players.map(p=>p.id),ids);
  hostAction(r,{type:'lobby'});assert.equal(r.cup.completed,false);rooms.delete(r.code);
});

test('pausing a race preserves times of racers who have already finished',()=>{
  const r=createRoom();joinRoom(r,'One');joinRoom(r,'Two');hostAction(r,{type:'start',game:'race'});
  const p=r.game.players[0];p.finishedAt=r.game.startsAt+20000;const duration=p.finishedAt-r.game.startsAt;
  hostAction(r,{type:'pause'});r.pausedAt-=3000;hostAction(r,{type:'pause'});
  assert.equal(p.finishedAt-r.game.startsAt,duration);rooms.delete(r.code);
});
