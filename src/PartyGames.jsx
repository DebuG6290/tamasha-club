import React,{useState,useEffect} from 'react';
import {Check,ArrowRight,Eye,ChatCircle,Question,Target,Star,HandPalm} from '@phosphor-icons/react';
import {Character,Timer,TEAM_COLORS,TEAMS} from './shared';
import {touchFeedback} from './audio';

const name=(state,id)=>state.players.find(p=>p.id===id)?.name||'Your friend';
const person=(state,id)=>state.players.find(p=>p.id===id);
const teamName=(state,team)=>state.players.filter(p=>p.team===Number(team)).map(p=>p.name).join(' + ');
function Face({state,id,pose=0}){const p=person(state,id);return p?<Character id={p.character} pose={pose}/>:null;}
function Commit({children,onClick,disabled=false}){return <button className="button primary wide party-commit" disabled={disabled} onClick={onClick}>{children}<Check weight="bold"/></button>;}
function Peek({children,label='Hold to see your card'}){
  const [open,setOpen]=useState(false);
  return <div className={`secret-envelope ${open?'open':''}`}>
    <div className="secret-window" aria-live="polite">{open?children:<><Eye size={38}/><h2>For your eyes only.</h2><p>Keep your screen to yourself.</p></>}</div>
    <button className="peek-button" aria-label={label} aria-pressed={open}
      onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);setOpen(true);touchFeedback()}}
      onPointerUp={()=>setOpen(false)} onPointerCancel={()=>setOpen(false)} onLostPointerCapture={()=>setOpen(false)} onBlur={()=>setOpen(false)}
      onKeyDown={e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();setOpen(true)}}}
      onKeyUp={e=>{if([' ','Enter'].includes(e.key))setOpen(false)}}><HandPalm weight="fill"/>{label}</button>
  </div>;
}
export function Spectrum({scale,target=null,rows=[],state}){
  return <div className="spectrum"><div className="scale-labels"><strong>{scale[0]}</strong><strong>{scale[1]}</strong></div>
    <div className="spectrum-track">{target!==null&&<><i className="target-zone outer" style={{left:`${target}%`}}/><i className="target-zone inner" style={{left:`${target}%`}}/><span className="target-pin" style={{left:`${target}%`}}><Target weight="fill"/></span></>}
      {rows.filter(r=>r.value!==null).map(r=><span key={r.team} className="guess-pin" style={{left:`${r.value}%`,'--team':TEAM_COLORS[r.team]}} title={`${state?teamName(state,r.team):TEAMS[r.team]}: ${r.value}`}>{Number(r.team)+1}</span>)}
    </div><div className="scale-numbers"><span>0</span><span>50</span><span>100</span></div>
  </div>;
}
function PartyScores({state}){
  const g=state.game,rows=g.kind==='bluff'?state.players.map(p=>({key:p.id,ids:[p.id],score:g.scores[p.id],team:p.team})):Object.entries(g.teamScores).map(([team,score])=>({key:team,ids:state.players.filter(p=>p.team===Number(team)).map(p=>p.id),score,team:Number(team)}));
  return <div className={`party-scores ${g.kind==='bluff'?'individual':''}`}>{rows.map(r=><div key={r.key} style={{'--team':TEAM_COLORS[r.team]}}><div>{r.ids.map(id=><Face key={id} state={state} id={id}/>)}</div><span>{r.ids.map(id=>name(state,id)).join(' + ')}</span><b>{r.score}</b></div>)}</div>;
}
function Progress({state,ids=state.players.map(p=>p.id)}){return <div className="party-locks">{ids.map(id=><span key={id} className={state.locked.includes(id)?'locked':''}><Face state={state} id={id}/><b>{name(state,id)}</b>{state.locked.includes(id)&&<Check weight="bold"/>}</span>)}</div>;}
export function PartyRules({kind}){
  return kind==='bluff'?<p>Everyone gets the same secret word, except one bluffer. Hold your phone card to peek. Take turns saying one related clue aloud, then discuss and secretly vote. A tied vote or accusing the wrong person lets the bluffer escape. If caught, the bluffer gets one guess from the word board. Escape or guess correctly: bluffer +3. Catch them and keep the word secret: everyone else +2. Each player is the bluffer once. Highest individual score wins. Any spoken language is welcome.</p>:<p>Pairs take turns giving a clue. One partner privately sees a target from 0 to 100 on a scale, then says an example aloud. No numbers, percentages or pointing at the scale! Their partner and every rival player guess on their phones. Rival pairs’ two estimates are averaged; the clue-giver’s pair uses their partner’s estimate. Within 3 earns 5 points, within 10 earns 3, within 25 earns 1. A missing guess earns no points; if just one rival partner submits, that estimate counts. Both partners give a clue once. Highest pair score wins.</p>;
}
function BluffStage({state,act}){
  const g=state.game,o=g.outcome;
  const next=()=>act({type:'party-next',round:g.round,epoch:g.epoch});
  const words=<div className="word-board">{g.words.map(w=><span key={w} className={o?.word===w?'word-answer':''}>{w}</span>)}</div>;
  return <section className={`party-scene bluff-scene ${g.step}`}>
    <p className="eyebrow">ROUND {g.round} / {g.total} · {g.topic}</p>
    {g.step==='deal'&&<><Question className="scene-icon" weight="fill"/><h1>Sabko pata hai.<br/>Bas ek ko nahi.</h1><p className="scene-copy">Peek at your phone. Remember your card. Tap ready.</p><Progress state={state}/><div className="scene-footer"><Timer state={state}/><span>{state.locked.length} / {state.players.length} ready</span></div></>}
    {g.step==='clues'&&<><div className="spotlight-character"><Face state={state} id={g.speaker} pose={1}/></div><h1>{name(state,g.speaker)}, ek clue!</h1><p className="scene-copy">Say one related word aloud. Give a clue, not the answer.</p><div className="clue-order">{g.order.map(id=><span key={id} className={g.speaker===id?'speaking':g.clues.some(c=>c.id===id)?'said':''}><Face state={state} id={id}/>{name(state,id)}{g.clues.some(c=>c.id===id)&&<Check/>}</span>)}</div><div className="scene-footer"><Timer state={state}/><button className="button" onClick={next}>Next clue <ArrowRight/></button></div></>}
    {g.step==='discuss'&&<><ChatCircle className="scene-icon" weight="fill"/><h1>Kaun acting kar raha tha?</h1><p className="scene-copy">You heard the clues. Make your case.</p><div className="scene-footer"><Timer state={state}/><button className="button primary" onClick={next}>Start the vote <ArrowRight/></button></div></>}
    {g.step==='vote'&&<><h1>Point fingers.<br/>On your phones.</h1><p className="scene-copy">Votes stay secret until everyone locks in.</p><Progress state={state}/><div className="scene-footer"><Timer state={state}/><span>{state.locked.length} / {state.players.length} votes locked</span></div></>}
    {g.step==='guess'&&<><div className="spotlight-character"><Face state={state} id={g.accused} pose={2}/></div><h1>{name(state,g.accused)} got caught!</h1><p className="scene-copy">One last chance. Can they guess the secret word?</p><div className="scene-footer"><Timer state={state}/></div></>}
    {g.step==='reveal'&&<><div className="spotlight-character"><Face state={state} id={o.impostor} pose={o.escaped?3:2}/></div><h1>{o.escaped?'Bluff successful.':'Pakde gaye!'}</h1><p className="scene-copy"><b>{name(state,o.impostor)}</b> was the bluffer. {o.tied?'The vote was tied.':!o.caught?o.accused?`${name(state,o.accused)} took the blame.`:'Nobody cast a vote.':o.correct?'They guessed the word and stole the round.':o.guessed?`Their guess: ${o.guessed}.`:'The secret stayed safe.'}</p><div className="secret-answer"><small>THE WORD WAS</small><strong>{o.word}</strong></div><div className="vote-receipts">{o.votes.map(v=><span key={v.by}>{name(state,v.by)} <ArrowRight/> <b>{name(state,v.target)}</b></span>)}</div><p className="award-note">{o.escaped?`${name(state,o.impostor)} +3`: 'Everyone except the bluffer +2'}</p><button className="button primary" onClick={next}>{g.round===g.total?'Final scores':'Next round'} <ArrowRight/></button></>}
    {!['deal','reveal'].includes(g.step)&&words}
    {g.clues.some(c=>c.text)&&g.step!=='reveal'&&<p className="demo-clues">Demo clues: {g.clues.filter(c=>c.text).map(c=>`${name(state,c.id)}: “${c.text}”`).join(' · ')}</p>}
  </section>;
}
function SameStage({state,act}){
  const g=state.game,o=g.outcome;
  return <section className={`party-scene same-scene ${g.step}`}>
    <p className="eyebrow">ROUND {g.round} / {g.total} · {g.scale[2]}</p>
    {g.step==='clue'&&<><div className="spotlight-character"><Face state={state} id={g.giver} pose={1}/></div><h1>{name(state,g.giver)}, set the scene.</h1><p className="scene-copy">Peek at your target. Say an example that belongs there.<br/>Everyone else: listen. No numbers or pointing!</p></>}
    {g.step==='guess'&&<><h1>Same clue.<br/>Same soch?</h1><p className="scene-copy">Where does that example belong? Everyone guesses on their phone.</p><Progress state={state} ids={state.players.filter(p=>p.id!==g.giver).map(p=>p.id)}/></>}
    {g.step==='reveal'&&<><h1>{o.skipped?'New clue, fresh start.':o.rows.some(r=>r.points===5)?'Bilkul same soch!':'Achha, tumhara yeh matlab tha.'}</h1><p className="scene-copy">{o.skipped?'Time ran out before the clue. No points this round.':`The secret target was ${o.target}. How close were you?`}</p></>}
    <Spectrum scale={g.scale} target={o?o.target:null} rows={o?.rows||[]} state={state}/>
    {o?<><div className="guess-results">{o.rows.map(r=><div key={r.team} style={{'--team':TEAM_COLORS[r.team]}}><span className="pair-number">{r.team+1}</span><div><b>{teamName(state,r.team)}</b><small>{r.guesses.map(q=>`${name(state,q.id)}: ${q.value}`).join(' · ')||'No guess submitted'}</small></div><strong>{r.value??'—'}</strong><b className={r.points?'earned':''}>+{r.points}</b></div>)}</div><button className="button primary" onClick={()=>act({type:'party-next',round:g.round,epoch:g.epoch})}>{g.round===g.total?'Final scores':'Next pair'} <ArrowRight/></button></>:<div className="scene-footer"><Timer state={state}/><span>{g.step==='clue'?'The target stays on the clue-giver’s phone.':`${state.locked.length} / ${state.players.length-1} guesses locked`}</span></div>}
    <p className="scoring-key">Within 3: <b>+5</b> · within 10: <b>+3</b> · within 25: <b>+1</b></p>
    {g.demoClue&&<p className="demo-clues">{g.demoClue}</p>}
  </section>;
}
export function PartyHost({state,act}){return <div className="party-board"><PartyScores state={state}/>{state.game.kind==='bluff'?<BluffStage state={state} act={act}/>:<SameStage state={state} act={act}/>}</div>;}

function BluffControls({state,me,send}){
  const g=state.game,priv=state.private,[selected,setSelected]=useState(null);
  const voted=!!priv.choice;
  const card=<Peek><small>{priv.role==='bluffer'?'YOUR ROLE':'THE SECRET WORD'}</small><h1>{priv.role==='bluffer'?'You’re the bluffer.':priv.word}</h1><p>{priv.role==='bluffer'?'Listen to the others. Blend in.':'Give a clue without giving it away.'}</p></Peek>;
  if(g.step==='reveal')return <div className="phone-party-reveal"><Character id={me.character} pose={g.outcome.awarded.includes(me.id)?3:2}/><h1>{g.outcome.awarded.includes(me.id)?'This one’s yours.':'Next round, new story.'}</h1><p>The word was <b>{g.outcome.word}</b>.</p><strong>{g.outcome.awarded.includes(me.id)?`+${g.outcome.escaped?3:2}`:'+0'}</strong><p>Look up for the votes and the reveal.</p></div>;
  return <>
    {g.step==='deal'&&<>{card}{voted?<p className="locked-note"><Check/> Ready. Look at the big screen.</p>:<Commit onClick={()=>send({type:'ready'})}>Got it. I’m ready.</Commit>}</>}
    {g.step==='clues'&&<><h1>{g.speaker===me.id?'Your clue. Out loud.':`${name(state,g.speaker)}’s clue.`}</h1><p className="phone-party-copy">{g.speaker===me.id?'One related word. Hindi, English, Hinglish—all welcome.':'Listen carefully. Who sounds like they know?'}</p>{card}{g.speaker===me.id&&<Commit onClick={()=>send({type:'clue-done'})}>Clue bol diya</Commit>}</>}
    {g.step==='discuss'&&<><ChatCircle className="phone-scene-icon" weight="fill"/><h1>Make your case.</h1><p className="phone-party-copy">Who was vague? Who copied a clue? Talk to the room.</p>{card}</>}
    {g.step==='vote'&&(voted?<div className="phone-party-reveal"><Check size={56}/><h1>Vote locked.</h1><p>Keep it to yourself. Watch the big screen.</p></div>:<><h1>Kaun feku?</h1><p className="phone-party-copy">Pick the person who didn’t know the word.</p><div className="suspect-grid">{state.players.filter(p=>p.id!==me.id).map(p=><button aria-pressed={selected===p.id} className={selected===p.id?'selected':''} key={p.id} onClick={()=>{setSelected(p.id);touchFeedback()}}><Character id={p.character}/><b>{p.name}</b>{selected===p.id&&<Check/>}</button>)}</div><Commit disabled={!selected} onClick={()=>send({type:'vote',target:selected})}>Lock my vote</Commit></>)}
    {g.step==='guess'&&(g.accused===me.id?<><h1>One last chance.</h1><p className="phone-party-copy">You were caught. Guess the secret word to steal the round.</p><div className="word-choices">{g.words.map(w=><button aria-pressed={selected===w} className={selected===w?'selected':''} key={w} onClick={()=>{setSelected(w);touchFeedback()}}>{w}</button>)}</div><Commit disabled={!g.words.includes(selected)} onClick={()=>send({type:'word',word:selected})}>That’s my guess</Commit></>:<div className="phone-party-reveal"><Face state={state} id={g.accused} pose={2}/><h1>{name(state,g.accused)} got caught.</h1><p>Don’t say the word! They have one last guess.</p></div>)}
  </>;
}
function SameControls({state,me,send}){
  const g=state.game,priv=state.private,[value,setValue]=useState(50);
  const partner=state.players.find(p=>p.team===me.team&&p.id!==me.id);
  if(g.step==='reveal'){
    const row=g.outcome.rows.find(r=>r.team===me.team);return <div className="phone-party-reveal"><Character id={me.character} pose={row.points?3:2}/><h1>{row.points===5?'Bang on!':row.points?'Not bad at all.':'A different wavelength.'}</h1><strong>+{row.points}</strong><p>Your pair: <b>{row.value??'no guess'}</b> · target: <b>{g.outcome.target}</b></p><Spectrum scale={g.scale} target={g.outcome.target}/><p>Look up. Compare notes.</p></div>;
  }
  if(priv.role==='giver')return <><h1>{g.step==='clue'?'Give them a picture.':'Let them guess.'}</h1><p className="phone-party-copy">{g.step==='clue'?`Say an example to ${partner?.name} and the room. No numbers or pointing.`:'Keep the target secret until the reveal.'}</p><Peek label="Hold to see your target"><small>YOUR SECRET TARGET</small><h1>{priv.target}</h1><Spectrum scale={g.scale} target={priv.target}/></Peek>{g.step==='clue'&&<Commit onClick={()=>send({type:'clue-done'})}>Clue bol diya</Commit>}</>;
  if(g.step==='clue')return <div className="phone-party-reveal"><Face state={state} id={g.giver} pose={1}/><h1>Listen to {name(state,g.giver)}.</h1><p>They’ll give an example somewhere between these two ends.</p><Spectrum scale={g.scale}/><p>You’ll guess on the next screen.</p></div>;
  if(priv.choice)return <div className="phone-party-reveal"><Check size={56}/><h1>{priv.choice.value}. Locked.</h1><p>{g.team===me.team?'Your partner is about to find out.':`Your pair’s submitted guesses will be averaged.`}</p><p>Look up for the reveal.</p></div>;
  return <><h1>Where does it belong?</h1><p className="phone-party-copy">Think of {name(state,g.giver)}’s example.</p><div className="guess-input"><div className="scale-labels"><b>{g.scale[0]}</b><b>{g.scale[1]}</b></div><output htmlFor="spectrum-guess">{value}</output><input id="spectrum-guess" aria-label="Your guess from 0 to 100" type="range" min="0" max="100" step="1" value={value} onChange={e=>setValue(Number(e.target.value))}/><div className="scale-numbers"><span>0</span><span>50</span><span>100</span></div></div><Commit onClick={()=>send({type:'estimate',value})}>Lock {value}</Commit><p className="controller-foot">Within 3 = +5 · within 10 = +3 · within 25 = +1</p></>;
}
export function PartyControls({state,me,act}){
  const g=state.game,send=a=>act({...a,round:g.round,step:g.step,epoch:g.epoch});
  return <div className="party-phone"><div className="party-phone-top"><span>ROUND {g.round} / {g.total}</span>{g.step!=='reveal'&&<Timer state={state}/>}</div><div key={`${g.round}/${g.step}/${g.epoch}`}>{g.kind==='bluff'?<BluffControls state={state} me={me} send={send}/>:<SameControls state={state} me={me} send={send}/>}</div></div>;
}
