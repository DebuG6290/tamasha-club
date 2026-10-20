import {WebSocketServer,WebSocket} from 'ws';
import {rooms,view,playerAction} from './rooms.mjs';

export function attachLive(server,{publicOrigins=''}={}){
  const allowed=new Set(publicOrigins.split(',').map(s=>s.trim().replace(/\/$/,'' )).filter(Boolean));
  const wss=new WebSocketServer({noServer:true,maxPayload:4096,perMessageDeflate:false});
  const send=(ws,value)=>{if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<128*1024)ws.send(JSON.stringify(value));};
  server.on('upgrade',(req,socket,head)=>{
    let url;try{url=new URL(req.url,'http://local')}catch{socket.destroy();return}
    const match=url.pathname.match(/^\/api\/rooms\/([A-Z]{4})\/socket$/),room=match&&rooms.get(match[1]),token=url.searchParams.get('token');
    const host=room&&token===room.hostToken,player=room?.players.find(p=>p.token===token),origin=req.headers.origin;
    const sameHost=origin===`https://${req.headers.host}`||origin===`http://${req.headers.host}`;
    if(!room||!host&&!player||origin&&!sameHost&&!allowed.has(origin)){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return}
    wss.handleUpgrade(req,socket,head,ws=>{ws.room=room;ws.token=token;ws.host=host;ws.player=player;ws.alive=true;wss.emit('connection',ws)});
  });
  wss.on('connection',ws=>{
    const room=ws.room,publish=()=>send(ws,{type:'state',state:view(room,ws.token)}),event=(message,actor)=>{if(ws.host||actor===ws.player?.id)send(ws,message)};
    room.subscribers.add(publish);room.liveListeners.add(event);publish();
    ws.on('pong',()=>{ws.alive=true});
    ws.on('message',raw=>{
      if(ws.host){send(ws,{type:'error',message:'Use the host controls to run the room.'});return}
      try{const a=JSON.parse(String(raw));playerAction(room,ws.player,a)}catch(e){send(ws,{type:'error',message:e.message||'That input was not accepted.'})}
    });
    ws.on('close',()=>{room.subscribers.delete(publish);room.liveListeners.delete(event);if(ws.player)delete room.aims[ws.player.id]});
    ws.on('error',()=>{});
  });
  const aiming=setInterval(()=>{
    const now=Date.now();for(const ws of wss.clients)if(ws.host&&ws.room.game?.kind==='ducks'&&!ws.room.paused){
      const aims=Object.entries(ws.room.aims).filter(([,p])=>now-p.at<5000).map(([id,p])=>[id,p.x,p.y]);
      send(ws,{type:'aims',aims});
    }
  },67);aiming.unref();
  const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue}ws.alive=false;ws.ping()}},20000);heartbeat.unref();
  server.once('close',()=>{clearInterval(aiming);clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();wss.close()});
  return wss;
}
