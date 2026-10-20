import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {apiHandler,tick} from './rooms.mjs';
import {attachLive} from './live.mjs';

const projectRoot=fileURLToPath(new URL('../',import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2','.json':'application/json; charset=utf-8','.ico':'image/x-icon'};

export function createGameServer({publicOrigins=process.env.PUBLIC_ORIGINS||'',staticRoot=path.join(projectRoot,'dist/client')}={}){
  const allowed=new Set(publicOrigins.split(',').map(x=>x.trim().replace(/\/$/,'')).filter(Boolean));
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');
    let url;
    try{url=new URL(req.url,`http://${req.headers.host||'localhost'}`)}catch{res.writeHead(400);res.end('Bad request');return}
    const origin=req.headers.origin;
    if(origin){
      const sameHost=[`http://${req.headers.host}`,`https://${req.headers.host}`].includes(origin);
      if(!sameHost&&!allowed.has(origin)){res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'This game screen is not allowed to use this server.'}));return}
      res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
      res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
    }
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
    if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({status:'ok',storage:'memory'}));return}
    if(url.pathname.startsWith('/api/')){apiHandler(req,res,()=>{res.writeHead(404);res.end()});return}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end('Method not allowed');return}
    let pathname;
    try{pathname=decodeURIComponent(url.pathname)}catch{res.writeHead(400);res.end('Bad path');return}
    const appRoute=pathname==='/'||/^\/(host|play)\/[A-Z]{4}$/.test(pathname);
    const target=path.resolve(staticRoot,appRoute?'index.html':`.${pathname}`);
    const relative=path.relative(staticRoot,target);
    if(relative.startsWith('..')||path.isAbsolute(relative)||pathname.includes('\0')){res.writeHead(403);res.end('Forbidden');return}
    try{
      const info=await stat(target);if(!info.isFile())throw Error('Not a file');
      res.writeHead(200,{'Content-Type':MIME[path.extname(target)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':appRoute?'no-cache':'public, max-age=3600'});
      if(req.method==='HEAD')res.end();else createReadStream(target).on('error',()=>res.destroy()).pipe(res);
    }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end(appRoute?'Build the game screens with npm run build before starting the server.':'Not found')}
  });
  attachLive(server,{publicOrigins});
  const clock=setInterval(()=>tick(),50);clock.unref();server.on('close',()=>clearInterval(clock));
  return server;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||4173),server=createGameServer();
  server.listen(port,'0.0.0.0',()=>console.log(`Tamasha Club listening on port ${port}; live rooms are stored in memory.`));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>process.exit(0)));
}
