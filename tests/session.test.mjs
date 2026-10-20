import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoom,addBots,startGame,tickRoom,hostAction,view,rooms} from '../server/rooms.mjs';

for(const kind of ['terrace','rang','auto']){
  test(`${kind}: an eight-player room reaches results and rematches without losing identities`,()=>{
    const room=createRoom();addBots(room);const identities=room.players.map(p=>p.id);startGame(room,kind);
    let iterations=0;
    while(room.phase!=='results'&&iterations++<5000){room.botAt=0;if(room.phase==='reveal')room.deadline=0;tickRoom(room);}
    assert.equal(room.phase,'results',`No result after ${iterations} ticks`);
    assert(room.results.length>0);assert(room.results.some(r=>r.rank===1));
    assert.deepEqual(room.players.map(p=>p.id),identities);
    const projected=view(room,room.hostToken);assert.equal(projected.private,null);
    for(const player of room.players){const own=view(room,player.token);assert.equal(own.me,player.id);assert.equal(own.host,false)}
    hostAction(room,{type:'start'});assert.equal(room.phase,'play');assert.deepEqual(room.players.map(p=>p.id),identities);
    hostAction(room,{type:'lobby'});assert.equal(room.phase,'lobby');assert.equal(room.game,null);rooms.delete(room.code);
  });
}
test('pause preserves deadline and locked choice, then resumes the same beat',()=>{
  const room=createRoom();addBots(room);startGame(room,'terrace');const deadline=room.deadline;
  room.choices[room.players[0].id]={action:'brace',direction:'stay'};
  hostAction(room,{type:'pause'});tickRoom(room,deadline+60000);
  assert.equal(room.phase,'play');assert.equal(room.game.round,1);assert.equal(Object.keys(room.choices).length,1);
  hostAction(room,{type:'pause'});assert.equal(room.paused,false);assert(room.deadline>Date.now());rooms.delete(room.code);
});
