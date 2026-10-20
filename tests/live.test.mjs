import test from 'node:test';import assert from 'node:assert/strict';import {once} from 'node:events';import WebSocket from 'ws';
import {createGameServer} from '../server/index.mjs';import {rooms,tickRoom} from '../server/rooms.mjs';import {ducksAt} from '../shared/arcade-math.mjs';

async function connect(url){
  const ws=new WebSocket(url),messages=[],waiters=[];ws.on('error',()=>{});ws.on('message',raw=>{const m=JSON.parse(String(raw));messages.push(m);for(const w of [...waiters])if(w.predicate(m)){clearTimeout(w.timer);waiters.splice(waiters.indexOf(w),1);w.resolve(m)}});
  await once(ws,'open');return {ws,wait:predicate=>{const found=messages.find(predicate);if(found)return Promise.resolve(found);return new Promise((resolve,reject)=>{const w={predicate,resolve};w.timer=setTimeout(()=>{waiters.splice(waiters.indexOf(w),1);reject(Error('No expected live message'))},3000);waiters.push(w)})}};
}
test('authenticated live controls share crosshairs and score shots; a projector cannot shoot as a player',async()=>{
  const server=createGameServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const root=`http://127.0.0.1:${server.address().port}`,sockets=[];
  const post=async(path,data,token)=>{const r=await fetch(root+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(data)});assert(r.ok);return r.json()};
  try{
    const room=await post('/api/rooms',{}),p=await post(`/api/rooms/${room.code}/join`,{name:'Player'});await post(`/api/rooms/${room.code}/join`,{name:'Friend'});
    await post(`/api/rooms/${room.code}/action`,{type:'start',game:'ducks'},room.token);
    const host=await connect(`${root.replace('http','ws')}/api/rooms/${room.code}/socket?token=${room.token}`);sockets.push(host.ws);
    const phone=await connect(`${root.replace('http','ws')}/api/rooms/${room.code}/socket?token=${p.token}`);sockets.push(phone.ws);
    assert.equal((await host.wait(m=>m.type==='state')).state.private,null);
    const internal=rooms.get(room.code);internal.game.startsAt=Date.now()-1000;internal.game.endsAt=Date.now()+29000;tickRoom(internal);
    const at=Date.now(),d=ducksAt(internal.game.seed,at-internal.game.startsAt).find(d=>d.x>0&&d.x<1);
    phone.ws.send(JSON.stringify({type:'aim',round:1,x:d.x,y:d.y}));
    const aims=await host.wait(m=>m.type==='aims'&&m.aims.some(a=>a[0]===p.id));assert.equal(aims.aims.find(a=>a[0]===p.id)[1],d.x);
    phone.ws.send(JSON.stringify({type:'fire',round:1,x:d.x,y:d.y,seq:1,at}));
    const shot=await phone.wait(m=>m.type==='shot'&&m.event.seq===1);assert.equal(shot.event.type,'duck-hit');
    const projected=await host.wait(m=>m.type==='state'&&m.state.game.players.some(p=>p.score>0));assert(projected.state.game.players.some(q=>q.id===p.id&&q.score>0));
    host.ws.send(JSON.stringify({type:'fire',round:1,x:.5,y:.5,seq:1}));assert.match((await host.wait(m=>m.type==='error')).message,/host controls/);
  }finally{for(const ws of sockets)ws.terminate();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rooms.clear()}
});
test('live socket rejects unknown credentials and unapproved origins',async()=>{
  const server=createGameServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const root=`http://127.0.0.1:${server.address().port}`;
  const room=await(await fetch(root+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json();
  try{for(const [token,origin] of [['wrong',root],[room.token,'https://other.example']]){
    const ws=new WebSocket(`${root.replace('http','ws')}/api/rooms/${room.code}/socket?token=${token}`,{origin});ws.on('error',()=>{});
    const [,response]=await once(ws,'unexpected-response');assert.equal(response.statusCode,403);response.resume();ws.terminate();
  }}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rooms.clear()}
});
