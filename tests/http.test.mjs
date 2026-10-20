import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createGameServer} from '../server/index.mjs';import {rooms} from '../server/rooms.mjs';

async function withServer(run){
  const root=await mkdtemp(path.join(os.tmpdir(),'tamasha-http-'));await writeFile(path.join(root,'index.html'),'<h1>Game screen</h1>');
  const server=createGameServer({publicOrigins:'https://party.example',staticRoot:root});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const origin=`http://127.0.0.1:${server.address().port}`;
  try{await run(origin)}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});rooms.clear()}
}
async function request(origin,url,data,token,headers={}){const r=await fetch(origin+url,{method:data?'POST':'GET',headers:{...(data?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{}) ,...headers},body:data?JSON.stringify(data):undefined});return {status:r.status,headers:r.headers,data:await r.json()}}

test('standalone Node server serves room deep links and in-memory multiplayer',async()=>withServer(async origin=>{
  assert.equal((await fetch(origin+'/play/ABCD')).status,200);
  const health=await request(origin,'/health');assert.equal(health.data.storage,'memory');
  const room=(await request(origin,'/api/rooms',{})).data;
  const a=(await request(origin,`/api/rooms/${room.code}/join`,{name:'Aadi',team:0})).data;
  await request(origin,`/api/rooms/${room.code}/join`,{name:'Nisha',team:0});
  assert.equal((await request(origin,`/api/rooms/${room.code}/state`)).status,403);
  assert.equal((await request(origin,`/api/rooms/${room.code}/action`,{type:'start',game:'terrace'},room.token)).status,200);
  assert.equal((await request(origin,`/api/rooms/${room.code}/action`,{action:'brace',direction:'stay',round:1,version:0},a.token)).status,200);
  const state=(await request(origin,`/api/rooms/${room.code}/state`,null,a.token)).data;
  assert(state.locked.includes(a.id));assert(state.private.choice);assert(state.players.every(p=>!p.token));
}));
test('a Netlify origin can use the Node API only when configured',async()=>withServer(async origin=>{
  const allowed=await request(origin,'/api/rooms',{},null,{Origin:'https://party.example'});assert.equal(allowed.status,201);assert.equal(allowed.headers.get('access-control-allow-origin'),'https://party.example');
  const denied=await request(origin,'/api/rooms',{},null,{Origin:'https://other.example'});assert.equal(denied.status,403);
  const preflight=await fetch(origin+'/api/rooms',{method:'OPTIONS',headers:{Origin:'https://party.example','Access-Control-Request-Headers':'authorization,content-type'}});assert.equal(preflight.status,204);
}));
