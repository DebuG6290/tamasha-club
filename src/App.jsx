import React,{useState,useEffect} from 'react';
import {X} from '@phosphor-icons/react';
import {api,Character,ErrorNote} from './shared';
import {Entrance} from './Entrance';
import {Host} from './Host';
import {Controller} from './Controller';
import {touchFeedback} from './audio';
import {useLiveRoom} from './useLiveRoom';
export function App(){const path=location.pathname.match(/^\/(host|play)\/([A-Z]{4})$/),[session,setSession]=useState(()=>path?{role:path[1],code:path[2],token:localStorage.getItem(`tamasha:${path[2]}:${path[1]}`)}:null),[state,setState]=useState(null),[error,setError]=useState(''),[offline,setOffline]=useState(false),[sending,setSending]=useState(false);
  const accept=next=>setState(s=>!s||s.code!==next.code||next.version>s.version?{...next,receivedAt:Date.now()}:s);
  const live=useLiveRoom(session,accept);
  const connect=(role,code,token)=>{localStorage.setItem(`tamasha:${code}:${role}`,token);history.pushState({},'',`/${role}/${code}`);setSession({role,code,token});setState(null);setError('')};
  useEffect(()=>{if(!session?.token)return;let stop=false,timer;const poll=async()=>{try{const next=await api(`/api/rooms/${session.code}/state`,null,session.token);if(stop)return;accept(next);setOffline(false);setError('')}catch(e){if(!stop){setOffline(true);setError(e.message)}}finally{if(!stop)timer=setTimeout(poll,650)}};poll();return()=>{stop=true;clearTimeout(timer)}},[session?.code,session?.token]);
  const act=async data=>{if(sending)return;setSending(true);setError('');try{await api(`/api/rooms/${session.code}/action`,data,session.token);if(session.role==='play')touchFeedback('lock');const next=await api(`/api/rooms/${session.code}/state`,null,session.token);accept(next)}catch(e){setError(e.message);touchFeedback('error')}finally{setSending(false)}};
  const takeSeat=async id=>{try{const r=await api(`/api/rooms/${session.code}/action`,{type:'claim',id},session.token);localStorage.setItem(`tamasha:${session.code}:play`,r.token);window.open(`/play/${session.code}`,'_blank')}catch(e){setError(e.message)}};
  if(!session?.token)return <Entrance initialCode={path?.[2]||''} onSession={connect}/>;
  if(!state)return <main className="loading paper"><Character id={1} pose={1}/><h1>{offline?'Reconnecting…':'Finding your people…'}</h1><ErrorNote text={error}/><button className="text-button" onClick={()=>{localStorage.removeItem(`tamasha:${session.code}:${session.role}`);location.href='/'}}>Back to the club</button></main>;
  return <>{session.role==='host'?<Host state={state} act={act} takeSeat={takeSeat} live={live}/>:<Controller state={state} act={act} live={live}/>}<div className="live-status" aria-live="polite">{sending&&<span>Sending…</span>}{offline&&<span>Connection interrupted. Reconnecting…</span>}</div>{error&&<div className="toast" role="alert">{error}<button aria-label="Dismiss error" onClick={()=>setError('')}><X/></button></div>}</>;
}
