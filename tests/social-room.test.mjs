import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {apiHandler,rooms,createRoom,joinRoom,view,playerAction,hostAction,tickRoom} from '../server/rooms.mjs';

async function withRoom(run){
  const server=createServer((req,res)=>apiHandler(req,res,()=>{res.writeHead(404);res.end();}));
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  const base='http://127.0.0.1:'+server.address().port;
  const request=async(path,body,token)=>{
    const res=await fetch(base+path,{method:body?'POST':'GET',headers:{
      ...(body?{'Content-Type':'application/json'}:{}),
      ...(token?{Authorization:'Bearer '+token}:{}),
    },body:body&&JSON.stringify(body)});
    return {status:res.status,value:await res.json()};
  };
  try{
    const {value:{code,token}}=await request('/api/rooms',{});
    const route='/api/rooms/'+code;
    await run({room:rooms.get(code),token,join:name=>request(route+'/join',{name}),state:token=>request(route+'/state',undefined,token),act:(token,a)=>request(route+'/action',a,token)});
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rooms.clear();}
}
const advance=room=>tickRoom(room,room.deadline);
const input=(room,type,fields={})=>({type,round:room.game.round,epoch:room.game.epoch,...fields});

test('eight HTTP controllers play a Bazaar round; locks and target do not leak',async()=>withRoom(async({room,token,join,state,act})=>{
  const players=[];
  for(let i=1;i<=8;i++){const r=await join('Phone '+i);assert.equal(r.status,201);players.push(r.value);}
  assert.equal((await join('Ninth')).status,400);
  assert.equal((await act(token,{type:'select',game:'bazaar'})).status,200);
  assert.equal((await act(token,{type:'start'})).status,200);
  assert.equal((await state(token)).value.game.stalls.length,0);
  advance(room);
  const host=(await state(token)).value;
  assert.equal(host.game.stalls.length,16);
  assert.equal(host.game.outcome,null);
  assert.ok(!Object.hasOwn(host.game,'targetId'));
  const target=host.game.stalls.find(stall=>host.game.clues.every(c=>stall.items.includes(c))).id;
  const wrong=host.game.stalls.find(stall=>stall.id!==target).id;
  const command=input(room,'bazaar',{stallId:target});
  assert.equal((await act(players[0].token,{...command,stallId:'Z9'})).status,400);
  assert.equal((await act(players[0].token,command)).status,200);
  assert.equal((await state(players[0].token)).value.private.selectedId,target);
  assert.equal((await state(players[1].token)).value.private.selectedId,null);
  assert.equal((await state(token)).value.game.lockCount,1);
  assert.equal((await act(players[0].token,{...command,stallId:wrong})).status,400);
  assert.equal((await act(players[7].token,command)).status,200);
  assert.equal((await act(players[6].token,{...command,stallId:wrong})).status,200);
  advance(room);
  assert.equal((await act(players[2].token,command)).status,400);
  const result=(await state(token)).value.game;
  assert.equal(result.step,'reveal');assert.equal(result.outcome.targetId,target);
  assert.equal(result.scores[players[0].id],1);assert.equal(result.scores[players[7].id],1);
  assert.equal(result.scores[players[6].id],0);
}));

test('two HTTP controllers play Pressure with private locks, retry, pause, and timeout',async()=>withRoom(async({room,token,join,state,act})=>{
  const a=(await join('One')).value,b=(await join('Two')).value;
  assert.equal((await act(token,{type:'start',game:'pressure'})).status,200);
  room.game.bustStage=2;
  const before=(await state(token)).value;
  const bank=input(room,'pressure',{choice:'bank'}),push=input(room,'pressure',{choice:'push'});
  assert.equal((await act(a.token,bank)).status,200);
  assert.equal((await act(a.token,bank)).status,200);
  assert.equal((await act(a.token,push)).status,400);
  assert.equal((await state(a.token)).value.private.choice,'bank');
  const peek=(await state(b.token)).value;
  assert.equal(peek.private.choice,null);
  assert.deepEqual(peek.game,before.game);
  assert.equal(peek.version,before.version);
  assert.equal((await state(token)).value.version,before.version);
  assert.equal((await act(token,{type:'pause'})).status,200);
  assert.equal((await act(b.token,push)).status,400);
  advance(room);
  assert.equal(room.game.step,'choose');
  assert.equal((await act(token,{type:'pause'})).status,200);
  assert.equal(room.game.endsAt,room.deadline);
  assert.equal((await act(b.token,push)).status,200);
  advance(room);
  const result=(await state(token)).value.game;
  assert.equal(result.outcome.bustStage,2);
  assert.deepEqual(result.outcome.players.map(p=>p.points),[2,0]);
  assert.equal((await act(b.token,push)).status,400);
}));

test('Bazaar and Pressure can complete the same tournament and reject stale rematch input',()=>{
  const room=createRoom();
  try{
    const a=joinRoom(room,'One'),b=joinRoom(room,'Two');
    hostAction(room,{type:'cup-config',enabled:true,games:['bazaar','pressure']});
    hostAction(room,{type:'start'});
    advance(room);
    const old=input(room,'bazaar',{stallId:'A1'});
    for(let guard=20;room.phase!=='results'&&guard>0;guard--)advance(room);
    assert.equal(room.phase,'results');
    assert.deepEqual(view(room,room.hostToken).results.map(p=>p.rank),[1,1]);
    hostAction(room,{type:'cup-next'});
    assert.equal(room.game.kind,'pressure');
    for(let guard=12;room.phase!=='results'&&guard>0;guard--)advance(room);
    hostAction(room,{type:'cup-next'});
    const end=view(room,room.hostToken);
    assert.ok(end.cup.completed);
    assert.deepEqual(end.cup.matches.map(m=>m.game),['bazaar','pressure']);
    assert.deepEqual(end.cup.standings.map(r=>[r.rank,r.score]),[[1,20],[1,20]]);
    hostAction(room,{type:'lobby'});
    hostAction(room,{type:'cup-config',enabled:false});
    hostAction(room,{type:'start',game:'bazaar'});
    advance(room);
    assert.throws(()=>playerAction(room,a,old));
    assert.ok(view(room,b.token).private);
  }finally{rooms.delete(room.code);}
});
