import {useState,useRef,useEffect} from 'react';
import {motionOffset,clamp} from '../shared/arcade-math.mjs';
export function useMotion(onTilt){
  const [enabled,setEnabled]=useState(false),[status,setStatus]=useState('Touch controls ready.'),callback=useRef(onTilt),base=useRef(null),last=useRef(null),lastAt=useRef(0),cancel=useRef(()=>{}),mounted=useRef(true);
  callback.current=onTilt;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;cancel.current()}},[]);
  const stop=()=>{cancel.current();cancel.current=()=>{};base.current=null;setEnabled(false);setStatus('Touch controls ready.')};
  const start=async()=>{
    if(!window.isSecureContext||typeof window.DeviceOrientationEvent==='undefined'){setStatus('Tilt is unavailable here. Use touch controls.');return}
    try{
      // Must be called directly from the player's click, before any unrelated await.
      if(typeof window.DeviceOrientationEvent.requestPermission==='function'){
        const permission=await window.DeviceOrientationEvent.requestPermission();if(permission!=='granted'){setStatus('Motion permission was declined. Touch still works.');return}
      }
      if(!mounted.current)return;cancel.current();base.current=null;lastAt.current=0;let received=false,angle=null;
      const listener=e=>{
        if(!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;
        received=true;const a=screen.orientation?.angle??window.orientation??0;
        last.current={beta:e.beta,gamma:e.gamma};
        if(!base.current||a!==angle){base.current={...last.current};angle=a;setStatus('Tilt ready. Re-centre whenever you need.');}
        const now=performance.now();if(now-lastAt.current<50)return;lastAt.current=now;
        const offset=motionOffset(e.beta,e.gamma,base.current,a);callback.current({x:clamp(offset.x,-45,45),y:clamp(offset.y,-45,45)});
      };
      window.addEventListener('deviceorientation',listener);
      const timeout=setTimeout(()=>{if(!received&&mounted.current){cancel.current();setEnabled(false);setStatus('No motion readings arrived. Use touch controls.')}},3500);
      cancel.current=()=>{window.removeEventListener('deviceorientation',listener);clearTimeout(timeout)};
      setEnabled(true);setStatus('Hold comfortably. Finding your centre…');
    }catch{if(mounted.current){setEnabled(false);setStatus('Could not enable tilt. Touch controls are available.')}}
  };
  return {enabled,status,start,stop,recenter:()=>{if(last.current)base.current={...last.current};setStatus('Centre reset.');callback.current({x:0,y:0})}};
}
