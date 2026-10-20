import {makeTerrace,resolveTerrace,nextTerrace,arena,collapsing,DIRECTIONS,makeCards,legalCard,actCards,drawCards,advanceCards,makeAuto,autoRole,resolveAuto,standings} from './engine.mjs';
import {isParty,makeParty,partyView,partyAction,advanceParty,partyTimeout,partyBotAction,partySeconds,partyStandings} from './party.mjs';
import {isArcade,makeArcade,tickArcade,nextArcade,arcadeView,arcadeStandings,arcadeFire,arcadeSteer,arcadeBot} from './arcade.mjs';
import {makeCup,configureCup,startCup,recordCup,nextCup,cupView} from './tournament.mjs';
import {makeSpot,spotView,spotAction,advanceSpot,spotSeconds,spotStandings,spotBot} from './spot.mjs';
const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(18)),x=>x.toString(16).padStart(2,'0')).join('');
const randomInt=n=>crypto.getRandomValues(new Uint32Array(1))[0]%n;
const names=['Nisha','Aadi','Riya','Dev','Meera','Kabir','Isha','Neel'];
export const rooms=new Map();
export function createRoom(){let code;do{code=Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ'[randomInt(24)]).join('')}while(rooms.has(code));
  const room={code,hostToken:secret(),players:[],game:null,selected:'ducks',paired:false,cup:makeCup(),phase:'lobby',choices:{},paused:false,version:0,subscribers:new Set(),liveListeners:new Set(),aims:{},touched:Date.now(),eggCount:0};rooms.set(code,room);return room;
}
export function joinRoom(room,name,team){
  if(room.phase!=='lobby')throw Error('This round is underway. Join after the host returns to the lobby.');
  if(room.players.length>=8)throw Error('This room is full');
  name=String(name||'').trim().replace(/[\u0000-\u001f]/g,'').slice(0,16);if(!name)throw Error('Enter your name');
  if(room.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))throw Error('That name is taken. Add an initial.');
  if(team===undefined)team=[0,1,2,3].find(t=>room.players.filter(p=>p.team===t).length<2);
  if(!Number.isInteger(team)||team<0||team>3||room.players.filter(p=>p.team===team).length>=2)throw Error('Choose a pair with an open place');
  const used=room.players.map(p=>p.character);const character=Array.from({length:8},(_,i)=>i).find(i=>!used.includes(i));
  const player={id:secret().slice(0,12),token:secret(),name,team,character,bot:false,online:false};room.players.push(player);publish(room);return player;
}
export function addBots(room){if(room.phase!=='lobby')throw Error('Return to the lobby first');
  while(room.players.length<8){const team=[0,1,2,3].find(t=>room.players.filter(p=>p.team===t).length<2);const idx=room.players.length;let name=names[idx];if(room.players.some(p=>p.name===name))name=`Guest ${idx+1}`;
    const p=joinRoom(room,name,team);p.bot=true;p.online=true;}
  publish(room);
}
export function view(room,token){const me=room.players.find(p=>p.token===token);const host=room.hostToken===token;
  const base={code:room.code,selected:room.selected,paired:room.paired,phase:room.phase,paused:room.paused,deadline:room.deadline||0,serverTime:Date.now(),version:room.version,
    players:room.players.map(({token,...p})=>p),locked:Object.keys(room.choices),me:me?.id||null,host,results:room.results||null,cup:cupView(room.cup)};
  if(!room.game)return {...base,game:null};
  const g=room.game;
  if(g.kind==='spot')return {...base,...spotView(g,me)};
  if(isArcade(g.kind))return {...base,game:arcadeView(g),private:me?{lastSeq:g.players.find(p=>p.id===me.id)?.lastSeq}:null};
  if(isParty(g.kind))return {...base,...partyView(g,room.players,me)};
  if(g.kind==='terrace')return {...base,game:{...g},private:me?{choice:room.choices[me.id]||null}:null};
  if(g.kind==='rang')return {...base,game:{kind:g.kind,top:g.top,color:g.color,turn:g.turn,order:g.order,direction:g.direction,counts:Object.fromEntries(g.order.map(id=>[id,g.hands[id].length])),log:g.log,lastActor:g.lastActor,turnSerial:g.turnSerial||0},
    private:me?{hand:g.hands[me.id],drawn:g.order[g.turn]===me.id?g.drawn:null}:null};
  const junction=g.junctions[g.round-1];const role=me?autoRole(g,me.id):null;
  return {...base,game:{kind:g.kind,round:g.round,teams:g.teams,events:g.events,egg:g.egg,junction:junction.name},
    private:role?{role:role.role,team:role.team.team,choice:room.choices[me.id]||null,routes:role.role==='route'?junction.routes.map(({name,tag})=>({name,tag})):null,hint:role.role==='pace'?junction.hint:null}:null};
}
export function publish(room){room.version++;room.touched=Date.now();for(const subscriber of room.subscribers)subscriber();}
function setClock(room,seconds){room.deadline=Date.now()+seconds*1000;room.botAt=Date.now()+1000+randomInt(900)}
function finish(room){room.phase='results';room.results=room.game.kind==='spot'?spotStandings(room.game):isArcade(room.game.kind)?arcadeStandings(room.game):isParty(room.game.kind)?partyStandings(room.game,room.players):standings(room.game,room.players,room.paired);room.deadline=0;recordCup(room.cup,room.game.kind,room.results);publish(room)}
function syncSpot(room){if(room.game.done){finish(room);return;}room.phase=room.game.step==='reveal'?'reveal':'play';setClock(room,spotSeconds(room.game));room.botAt=Date.now()+2500+randomInt(3500);publish(room);}
function syncParty(room,previousEpoch=-1){
  if(room.game.done){finish(room);return}
  room.phase=room.game.step==='reveal'?'reveal':'play';
  if(previousEpoch!==room.game.epoch)setClock(room,partySeconds(room.game));
  publish(room);
}
export function startGame(room,kind=room.selected){
  if(room.players.length<2)throw Error('Add at least two players or try demo players');
  if(!['spot','bluff','same','ducks','race','terrace','rang','auto'].includes(kind))throw Error('Unknown game');
  const game=kind==='spot'?makeSpot(room.players):isArcade(kind)?makeArcade(room.players,kind):isParty(kind)?makeParty(room.players,kind,Math.random,room.paired):kind==='terrace'?makeTerrace(room.players):kind==='rang'?makeCards(room.players):makeAuto(room.players);
  room.selected=kind;room.game=game;room.results=null;room.choices={};room.phase='play';room.paused=false;room.started=Date.now();setClock(room,kind==='rang'?20:kind==='auto'?18:12);publish(room);
  if(isParty(kind))syncParty(room);
  if(kind==='spot')syncSpot(room);
  if(isArcade(kind)){room.deadline=game.startsAt;room.aims={};room.snapshotAt=0;publish(room)}
}
export function hostAction(room,action){
  if(action.type==='bots')return addBots(room);
  if(action.type==='select'){if(room.phase!=='lobby')throw Error('Return to the lobby first');if(!['spot','bluff','same','ducks','race','terrace','rang','auto'].includes(action.game))throw Error('Unknown game');room.selected=action.game;publish(room);return}
  if(action.type==='cup-config'){if(room.phase!=='lobby')throw Error('Set up tournaments in the lobby.');configureCup(room.cup,action);if(room.cup.enabled)room.paired=false;publish(room);return}
  if(action.type==='cup-next'){
    if(room.phase!=='results')throw Error('Finish this match first.');const kind=nextCup(room.cup);if(kind)startGame(room,kind);else publish(room);return;
  }
  if(action.type==='arcade-next'){
    if(!isArcade(room.game?.kind)||room.phase!=='reveal'||room.paused)throw Error('Finish this heat first.');
    if(action.round!==room.game.round||action.epoch!==room.game.epoch)throw Error('The heat has already moved on.');
    nextArcade(room.game);if(room.game.done)finish(room);else {room.phase='play';room.deadline=room.game.startsAt;publish(room)}return;
  }
  if(action.type==='party-next'){
    if(!isParty(room.game?.kind)||!['play','reveal'].includes(room.phase)||room.paused)throw Error('No active party round.');
    if(action.epoch!==room.game.epoch||action.round!==room.game.round)throw Error('The game has already moved on.');
    const previous=room.game.epoch;advanceParty(room.game,room.players);syncParty(room,previous);return;
  }
  if(action.type==='start'){
    if(room.cup.enabled){if(room.cup.active&&!room.cup.completed&&room.phase!=='lobby')throw Error('Use Next match to continue the tournament.');room.paired=false;return startGame(room,startCup(room.cup,room.players))}
    return startGame(room,action.game||room.selected);
  }
  if(action.type==='lobby'){room.phase='lobby';room.game=null;room.choices={};room.results=null;room.paused=false;room.cup.active=false;room.cup.completed=false;publish(room);return}
  if(action.type==='pause'){if(!['play','reveal'].includes(room.phase))throw Error('No active round');room.paused=!room.paused;
    if(room.paused){room.remaining=Math.max(0,room.deadline-Date.now());room.pausedAt=Date.now()}else {room.deadline=Date.now()+(room.remaining||1000);if(isArcade(room.game?.kind)){const delay=Date.now()-room.pausedAt;for(const key of ['startsAt','endsAt','lastTick'])room.game[key]+=delay;for(const p of room.game.players)for(const key of ['boostUntil','stunUntil','lastShot','lastSteer','finishedAt'])if(p[key])p[key]+=delay;}if(room.game?.kind==='spot'){const delay=Date.now()-room.pausedAt;for(const id of Object.keys(room.game.blocked))room.game.blocked[id]+=delay;}}publish(room);return}
  if(action.type==='paired'){if(room.phase!=='lobby')throw Error('Change scoring in the lobby');if(room.cup.enabled)throw Error('Tournaments use individual scores.');room.paired=Boolean(action.value);publish(room);return}
  if(action.type==='remove'){if(room.phase!=='lobby')throw Error('Remove players in the lobby');room.players=room.players.filter(p=>p.id!==action.id);publish(room);return}
  throw Error('Unknown host action');
}
export function playerAction(room,player,action){
  if(room.phase!=='play'||room.paused)throw Error(room.paused?'The host paused the game':'Wait for the next choice');
  if(room.game.kind==='spot'){
    if(Date.now()>=room.deadline){advanceSpot(room.game,room.players);syncSpot(room);throw Error('Time is up. Look for the next card.');}
    const previous=room.game.epoch,changed=spotAction(room.game,player.id,action);
    if(room.game.epoch!==previous)syncSpot(room);else if(changed)publish(room);return;
  }
  if(isArcade(room.game.kind)){
    const g=room.game;if(action.round!==g.round)throw Error('That heat has ended.');
    if(action.type==='aim'){
      if(g.kind!=='ducks'||![action.x,action.y].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('Invalid aim.');
      const now=Date.now();if(now-(room.aims[player.id]?.at||0)<40)return;room.aims[player.id]={x:action.x,y:action.y,at:now};room.touched=now;return;
    }
    if(action.type==='fire'){
      const event=arcadeFire(g,player.id,action);for(const listener of room.liveListeners)listener({type:'shot',event},player.id);
      publish(room);return;
    }
    arcadeSteer(g,player.id,action);publish(room);return;
  }
  if(isParty(room.game.kind)){
    // Expire the previous stage before applying a late HTTP input.
    if(Date.now()>=room.deadline){partyTimeout(room.game,room.players);syncParty(room);throw Error('Time is up. Check the current screen.');}
    const previous=room.game.epoch;partyAction(room.game,room.players,player.id,action);syncParty(room,previous);return;
  }
  if(action.version!==undefined&&action.round!==undefined&&action.round!==room.game.round)throw Error('That round has already ended');
  if(room.game.kind==='rang'){
    room.game={...actCards(room.game,player.id,action),lastActor:player.id,turnSerial:(room.game.turnSerial||0)+1};
    if(room.game.winner||room.game.exhausted)return finish(room);
    setClock(room,20);publish(room);return;
  }
  if(room.choices[player.id])throw Error('Your choice is already locked');
  if(room.game.kind==='terrace'){
    if(!Object.hasOwn(DIRECTIONS,action.direction)||!['move','shove','brace'].includes(action.action))throw Error('Choose a direction and an action');
    const p=room.game.players.find(p=>p.id===player.id),[dx,dy]=DIRECTIONS[action.direction];
    if(action.action==='move'&&!arena(room.game.round).some(t=>t.x===p.x+dx&&t.y===p.y+dy))throw Error('Choose a safe adjacent tile');
    if(action.action==='shove'&&(action.direction==='stay'||p.protected))throw Error(p.protected?'Protected this beat: move or brace':'Choose where to shove');
    room.choices[player.id]={direction:action.direction,action:action.action};
  }else{
    const role=autoRole(room.game,player.id);
    if(role.role==='route'){if(![0,1].includes(action.route))throw Error('Choose a route');room.choices[player.id]={route:action.route}}
    else {if(![0,1,2].includes(action.pace)||action.pace>role.team.fuel)throw Error('Choose an affordable pace');room.choices[player.id]={pace:action.pace}}
  }
  publish(room);if(Object.keys(room.choices).length===room.players.length)resolve(room);
}
function resolve(room){
  if(room.phase!=='play')return;
  room.game=room.game.kind==='terrace'?resolveTerrace(room.game,room.choices):resolveAuto(room.game,room.choices);
  room.phase='reveal';setClock(room,2.7);publish(room);
}
function botChoice(room,p){
  const g=room.game;
  if(g.kind==='rang'){
    const hand=g.hands[p.id];const c=g.drawn?hand.find(c=>c.id===g.drawn):hand.find(c=>legalCard(c,g));
    return c?{type:'play',card:c.id,color:['coral','blue','gold','mint'][randomInt(4)]}:{type:g.drawn?'keep':'draw'};
  }
  if(g.kind==='auto'){
    const role=autoRole(g,p.id);if(role.role==='route')return {route:randomInt(2)};
    return {pace:randomInt(Math.min(2,role.team.fuel)+1)};
  }
  const own=g.players.find(q=>q.id===p.id), dirs=Object.entries(DIRECTIONS).filter(([d,[dx,dy]])=>d!=='stay'&&arena(g.round).some(t=>t.x===own.x+dx&&t.y===own.y+dy));
  const adjacent=dirs.filter(([, [dx,dy]])=>g.players.some(q=>q.id!==p.id&&q.x===own.x+dx&&q.y===own.y+dy));
  if(!own.protected&&adjacent.length&&Math.random()<.45)return {direction:adjacent[randomInt(adjacent.length)][0],action:'shove'};
  const towardStar=dirs.filter(([, [dx,dy]])=>g.stars.some(s=>s.x===own.x+dx&&s.y===own.y+dy));
  if(Math.random()<.13)return {direction:'stay',action:'brace'};
  const pool=towardStar.length?towardStar:dirs;return {direction:pool.length?pool[randomInt(pool.length)][0]:'stay',action:'move'};
}
export function tickRoom(room,now=Date.now()){
  for(const [code] of [[room.code]]){
    if(now-room.touched>3*60*60*1000&&!room.subscribers.size){rooms.delete(code);continue}
    if(room.paused||!['play','reveal'].includes(room.phase))continue;
    if(room.game.kind==='spot'){
      if(now>=room.deadline){advanceSpot(room.game,room.players);syncSpot(room);}
      else if(room.game.step==='search'&&now>=room.botAt){if(spotBot(room.game,room.players,now))syncSpot(room);else room.botAt=now+1000;}
      continue;
    }
    if(isArcade(room.game.kind)){
      const g=room.game;
      if(g.step==='reveal'){if(room.players.every(p=>p.bot)&&now>=room.deadline){nextArcade(g,now);if(g.done)finish(room);else {room.phase='play';room.deadline=g.startsAt;publish(room)}}continue;}
      const epoch=g.epoch;tickArcade(g,now);room.deadline=g.step==='ready'?g.startsAt:g.endsAt;
      if(now>=room.botAt){const event=arcadeBot(g,room.players,now);if(event){for(const listener of room.liveListeners)listener({type:'shot',event},event.id);if(event.target!==null)publish(room)}room.botAt=now+150;}
      if(g.step==='reveal'){room.phase='reveal';room.deadline=now+10000;publish(room)}
      else if(g.epoch!==epoch||g.kind==='race'&&now>=room.snapshotAt){room.snapshotAt=now+100;publish(room)}
      continue;
    }
    if(isParty(room.game.kind)){
      const g=room.game;
      if(g.step==='reveal'){
        if(room.players.every(p=>p.bot)&&now>=room.deadline){advanceParty(g,room.players);syncParty(room)}
      }else if(now>=room.deadline){partyTimeout(g,room.players);syncParty(room)}
      else if(now>=room.botAt){const previous=g.epoch;if(partyBotAction(g,room.players))syncParty(room,previous);room.botAt=now+1200;}
      continue;
    }
    if(room.phase==='reveal'&&now>=room.deadline){
      if(room.game.round>=(room.game.kind==='terrace'?12:10)){finish(room);continue}
      room.game=room.game.kind==='terrace'?nextTerrace(room.game):{...room.game,round:room.game.round+1,events:[],egg:null};
      room.choices={};room.phase='play';setClock(room,room.game.kind==='auto'?18:12);publish(room);continue;
    }
    if(room.phase!=='play')continue;
    if(room.game.kind==='rang'&&now-room.started>6*60*1000){finish(room);continue}
    if(now>=room.deadline){
      if(room.game.kind==='rang'){const id=room.game.order[room.game.turn];drawCards(room.game,id,1);advanceCards(room.game);room.game.turnSerial=(room.game.turnSerial||0)+1;room.game.log='Time up. One card drawn.';setClock(room,20);publish(room)}else resolve(room);
      continue;
    }
    if(now>=room.botAt){
      if(room.game.kind==='rang'){const p=room.players.find(p=>p.id===room.game.order[room.game.turn]);if(p?.bot){try{playerAction(room,p,botChoice(room,p))}catch{}}}
      else{const waiting=room.players.filter(p=>p.bot&&!room.choices[p.id]);if(waiting.length){const p=waiting[randomInt(waiting.length)];try{playerAction(room,p,botChoice(room,p))}catch{}}}
      room.botAt=Date.now()+350+randomInt(650);
    }
  }
}
export function tick(now=Date.now()){for(const room of rooms.values())tickRoom(room,now)}
export function networkURLs(){return []}
export function apiHandler(req,res,next){
  const url=new URL(req.url,'http://local');if(!url.pathname.startsWith('/api/'))return next();
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const send=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(obj))};
  if(url.pathname==='/api/network'){send(200,{urls:networkURLs(Number(req.headers.host?.split(':').at(-1))||4173)});return}
  const match=url.pathname.match(/^\/api\/rooms\/([A-Z]{4})\/(state|events|join|action|info)$/);
  const room=match?rooms.get(match[1]):null;
  if(match&&!room){send(404,{error:'Room not found. Check the four-letter code.'});return}
  if(match&&match[2]==='info'&&req.method==='GET'){send(200,{players:room.players.map(({token,...p})=>p),phase:room.phase,paired:room.paired});return}
  if(match&&match[2]==='events'&&req.method==='GET'){
    const token=url.searchParams.get('token');if(!room.players.some(p=>p.token===token)&&token!==room.hostToken){send(403,{error:'Join the room first'});return}
    res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive','X-Accel-Buffering':'no'});
    const subscriber=()=>res.write(`data: ${JSON.stringify(view(room,token))}\n\n`);room.subscribers.add(subscriber);
    const p=room.players.find(p=>p.token===token);if(p){p.connections=(p.connections||0)+1;p.online=true;publish(room)}else subscriber();
    const alive=setInterval(()=>res.write(': alive\n\n'),15000);
    req.on('close',()=>{clearInterval(alive);room.subscribers.delete(subscriber);if(p){p.connections=Math.max(0,(p.connections||1)-1);p.online=p.connections>0;publish(room)}});return;
  }
  if(match&&match[2]==='state'&&req.method==='GET'){
    const token=req.headers.authorization?.replace(/^Bearer /,'');if(!room.players.some(p=>p.token===token)&&token!==room.hostToken){send(403,{error:'Join the room first'});return}send(200,view(room,token));return;
  }
  if(req.method!=='POST'){send(405,{error:'Method not allowed'});return}
  let body='';let tooLarge=false;
  req.on('data',chunk=>{body+=chunk;if(body.length>8192&&!tooLarge){tooLarge=true;send(413,{error:'Request too large'})}});
  req.on('end',()=>{if(tooLarge)return;try{
    const action=JSON.parse(body||'{}');
    if(url.pathname==='/api/rooms'){const r=createRoom();send(201,{code:r.code,token:r.hostToken});return}
    if(!match)throw Error('Endpoint not found');
    if(match[2]==='join'){const p=joinRoom(room,action.name,action.team);send(201,{token:p.token,id:p.id});return}
    const token=req.headers.authorization?.replace(/^Bearer /,'');
    if(token===room.hostToken){
      if(action.type==='claim'){const p=room.players.find(p=>p.id===action.id&&p.bot);if(!p)throw Error('Choose a demo player');p.bot=false;publish(room);send(200,{ok:true,token:p.token});return}
      hostAction(room,action);
    }else{const p=room.players.find(p=>p.token===token);if(!p){send(403,{error:'Join the room first'});return}playerAction(room,p,action)}
    send(200,{ok:true});
  }catch(e){send(400,{error:e.message||'That did not work. Try again.'})}});
}
export function roomPlugin(){return {name:'tamasha-local-multiplayer',async configureServer(server){server.middlewares.use(apiHandler);if(server.httpServer){const {attachLive}=await import('./live.mjs');attachLive(server.httpServer)}const timer=setInterval(()=>tick(),50);server.httpServer?.once('close',()=>clearInterval(timer));}}}
