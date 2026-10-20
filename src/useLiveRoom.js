import {useState,useEffect,useRef} from 'react';
export function useLiveRoom(session,accept){
  const socket=useRef(null),acceptRef=useRef(accept),[connected,setConnected]=useState(false),[aims,setAims]=useState([]),[shot,setShot]=useState(null),[inputError,setInputError]=useState('');
  acceptRef.current=accept;
  useEffect(()=>{
    if(!session?.token)return;let closed=false,retry,times=0;
    const connect=()=>{
      const base=new URL((import.meta.env.VITE_API_BASE_URL||'').trim()||location.origin);base.protocol=base.protocol==='https:'?'wss:':'ws:';base.pathname=`/api/rooms/${session.code}/socket`;base.search=new URLSearchParams({token:session.token}).toString();
      const ws=new WebSocket(base);socket.current=ws;
      ws.onopen=()=>{if(closed){ws.close();return}times=0;setConnected(true);setInputError('')};
      ws.onmessage=e=>{if(closed)return;try{const message=JSON.parse(e.data);if(message.type==='state')acceptRef.current(message.state);if(message.type==='aims')setAims(message.aims);if(message.type==='shot')setShot(message.event);if(message.type==='error')setInputError(message.message)}catch{}};
      ws.onerror=()=>{};ws.onclose=()=>{if(closed)return;setConnected(false);setAims([]);retry=setTimeout(connect,Math.min(5000,600*2**times++))};
    };
    connect();return()=>{closed=true;clearTimeout(retry);socket.current?.close();socket.current=null;setConnected(false)};
  },[session?.code,session?.token]);
  return {connected,aims,shot,inputError,send:data=>{const ws=socket.current;if(ws?.readyState!==WebSocket.OPEN||ws.bufferedAmount>16000)return false;if(data.type!=='aim')setInputError('');ws.send(JSON.stringify(data));return true;}};
}
