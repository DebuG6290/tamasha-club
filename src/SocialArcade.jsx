import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, CoinVertical, LockKey, MagnifyingGlass, Storefront, Warning } from '@phosphor-icons/react';
import { PLAYER_COLORS, Timer } from './shared';
import './social-arcade.css';

const PRESSURE = 'Bas, Ab Nahi!';
const BAZAAR = 'Bazaar Khoj';
const sameId = (a, b) => a != null && b != null && String(a) === String(b);
const stallLabel = (id, index) => /^[A-D][1-4]$/i.test(String(id)) ? String(id).toUpperCase() : String.fromCharCode(65 + Math.floor(index / 4)) + (index % 4 + 1);
const scoreFor = (game, id) => game.scores?.[id] ?? 0;

function SocialTimer({room, game}) {
  const deadline = game.endsAt ?? room.deadline;
  return Number.isFinite(deadline) && deadline > 0 ? <Timer state={{...room, deadline}}/> : null;
}

function Title({name, kicker, game, room, icon: Icon}) {
  return <header className="social-title">
    <div className="social-title-main"><span className="social-title-crest" aria-hidden="true"><Icon weight="duotone"/></span><div><p>{kicker}</p><h1>{name}</h1></div></div>
    <div className="social-title-meta"><span>ROUND <strong>{game.round} / {game.total}</strong></span><SocialTimer room={room} game={game}/></div>
  </header>;
}

function ScoreStrip({room, game, winning = []}) {
  const players = [...(room.players || [])].sort((a, b) => scoreFor(game,b.id) - scoreFor(game,a.id));
  return <ol className="social-scores" aria-label="Cumulative scores">
    {players.map(player => <li key={player.id} className={winning.some(id=>sameId(player.id,id)) ? 'social-score-up' : undefined}>
      <i aria-hidden="true" style={{background: PLAYER_COLORS[player.character % PLAYER_COLORS.length] || '#e4aa64'}}/>
      <span title={player.name}>{player.name}</span><b>{scoreFor(game,player.id)}</b>
    </li>)}
  </ol>;
}

/* Decorative vector icons are paired with visible stall text; recognizing an icon is never required. */
const marketIcons = [
  [/mango|papaya|pear|lemon|lime|guava|apple|orange|coconut|peach|plum/i, 'fruit'],
  [/flower|rose|marigold|lotus|jasmine|tulip/i, 'flower'],
  [/kite|pinwheel|flag/i, 'kite'],
  [/cup|tea|coffee|lassi|glass/i, 'cup'],
  [/jar|pickle|honey|oil|bottle|jug|milk/i, 'jar'],
  [/lantern|lamp|candle|diya/i, 'lamp'],
  [/drum|tabla|bell|music/i, 'drum'],
  [/book|paper|card|post|journal|newspaper/i, 'book'],
  [/scarf|ribbon|cloth|sari|fabric|shawl|silk/i, 'cloth'],
  [/fish/i, 'fish'],
  [/pot|bowl|plate|basket|pan/i, 'pot'],
  [/ring|bangle|necklace|bead|bracelet|gem|jewel/i, 'gem'],
  [/samosa|snack|bread|naan|bun|biscuit|sweet|salt|spice/i, 'snack'],
  [/leaf|chilli|pepper|carrot|corn|mint|herb/i, 'leaf'],
  [/umbrella/i, 'umbrella'],
  [/bag|sack|pouch/i, 'bag'],
];
const shapes = {
  fruit: <><path d="M12 10c-8-5-12 3-8 9 3 5 6 4 8 2 2 2 5 3 8-2 4-6 0-14-8-9Z"/><path d="M12 10c0-4 3-7 7-7-1 3-3 5-7 5V4"/></>,
  flower: <><path d="M12 8c-6-9-10 1-4 4-6 3 0 10 4 4 4 6 10-1 4-4 6-3 2-13-4-4ZM12 18v5"/><circle cx="12" cy="12" r="2"/></>,
  kite: <><path d="m12 2 8 7-8 9-8-9 8-7Zm0 0v16m-8-9h16m-8 9c0 2 3 2 3 4"/><path d="m14 20 4-1m-4 2 3 2"/></>,
  cup: <><path d="M5 9h12v5a6 6 0 0 1-12 0V9Zm12 1h2a2.5 2.5 0 1 1 0 5h-2M3 22h17M9 6c-2-1 1-2 0-4m5 4c-2-1 1-2 0-4"/></>,
  jar: <><path d="M8 3h8v4H8zm0 4-3 4v9l2 2h10l2-2v-9l-3-4M5 13h14M5 18h14"/><path d="M10 15h4"/></>,
  lamp: <><path d="M3 12h18c-2 6-5 8-9 8s-7-2-9-8Zm3 9h12M12 11c-5-2 0-6 1-9 3 4 4 7-1 9Z"/></>,
  drum: <><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6l2 13c3 3 9 3 12 0l2-13M7 9l2 10 3-10 3 10 2-10"/></>,
  book: <><path d="M12 6C8 3 5 3 2 4v15c3-1 6-1 10 2 4-3 7-3 10-2V4c-3-1-6-1-10 2Zm0 0v15M5 8l4 1m-4 3 4 1m10-5-4 1m4 3-4 1"/></>,
  cloth: <><path d="m5 4 6 2 8-2v15l-6 2-8-2V4Zm6 2 2 15m-7-8 5 2 8-2M5 19l-2 2m16-2 2 2"/></>,
  fish: <><path d="M3 12c5-7 10-7 14-2l4-4v12l-4-4c-4 5-9 5-14-2Z"/><circle cx="8" cy="11" r="1"/></>,
  pot: <><path d="M3 10h18v4c0 4-4 7-9 7s-9-3-9-7v-4Zm1-3h16M8 4h8M6 14h12"/></>,
  gem: <><path d="m3 9 4-5h10l4 5-9 12L3 9Zm0 0h18M7 4l5 17 5-17"/></>,
  snack: <><path d="m3 18 8-13c.5-1 1.5-1 2 0l8 13a2 2 0 0 1-2 3H5a2 2 0 0 1-2-3Z"/><path d="M8 17h1m3-5h1m2 4h1"/></>,
  leaf: <><path d="M4 19C1 6 15 3 21 4c-1 11-6 17-17 15Zm0 0 12-11m-6 9-1-5m4 3 4-1"/></>,
  umbrella: <><path d="M2 12a10 10 0 0 1 20 0H2Zm10 0v8c0 3 4 3 4 0m-4-18v2"/></>,
  bag: <><path d="M4 8h16l2 13H2L4 8Zm4 0V5a4 4 0 1 1 8 0v3m-8 5 4 4 4-4"/></>,
  generic: <><path d="M4 6h16v14H4zm-1 0 3-3h12l3 3M4 10h16m-10 4h4"/></>,
};

function MarketIcon({item}) {
  const glyph = marketIcons.find(([pattern]) => pattern.test(item))?.[1] || 'generic';
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[glyph]}</svg>;
}

function MarketStall({stall, id, target}) {
  return <li className={'social-stall'+(target?' social-stall-target':'')} aria-label={`Stall ${id}: ${stall.items.join(', ')}${target ? ', correct stall' : ''}`}>
    <div className="social-stall-roof"><b>{id}</b>{target && <Check weight="bold" size={17} aria-hidden="true"/>}</div>
    <div className="social-stall-shelf">
      {stall.items.map((item,i) => <span key={i}><MarketIcon item={item}/><b>{item}</b></span>)}
    </div>
  </li>;
}

function StallClues({clues = []}) {
  return <ol className="social-clues" aria-label="Two clues">{clues.map((clue,i)=><li key={i}><span aria-hidden="true">{i+1}</span>{clue}</li>)}</ol>;
}

function BazaarHost({room}) {
  const game = room.game;
  const reveal = game.step === 'reveal';
  const ready = game.step === 'ready';
  const stalls = game.stalls || [];
  const target = game.outcome?.targetId;
  const correct = game.outcome?.correctIds || [];
  const targetLabel = stallLabel(target, Math.max(0, stalls.findIndex(s => sameId(s.id,target))));
  return <section className="social-board social-bazaar-board">
    <Title name={BAZAAR} kicker="THE MARKET MYSTERY" game={game} room={room} icon={Storefront}/>
    {ready ? <div className="social-bazaar-ready"><div className="social-ready-seal"><MagnifyingGlass size={53} weight="duotone" aria-hidden="true"/></div><p className="social-kicker">THE BAZAAR IS OPENING</p><h2>Two clues. One stall.</h2><p>Read the clues here, then lock one stall on your phone. Every correct answer earns a point.</p></div> :
      <div className="social-bazaar-map">
        <aside className="social-bazaar-clue-panel">
          <div aria-hidden="true" className="social-bazaar-insignia"><MagnifyingGlass weight="duotone"/></div>
          <p className="social-kicker">{reveal ? 'CASE CLOSED' : 'FIND THE STALL'}</p>
          <h2>{reveal && target != null ? `Stall ${targetLabel}!` : 'Follow both clues.'}</h2>
          <StallClues clues={game.clues}/>
          <div className="social-bazaar-progress" role="status">{reveal ? <><Check weight="bold" aria-hidden="true"/>{correct.length ? `${correct.length} ${correct.length===1?'player':'players'} found it`:'Nobody found it this round'}</> : <><LockKey weight="duotone" aria-hidden="true"/>{`${game.lockCount ?? 0} / ${room.players?.length ?? 0} locked`}</>}</div>
        </aside>
        <ol className="social-stalls" aria-label="Bazaar stall map">
          {stalls.map((stall,index) => <MarketStall key={stall.id} stall={stall} id={stallLabel(stall.id,index)} target={reveal && sameId(target,stall.id)}/>)}
        </ol>
      </div>
    }
    <ScoreStrip room={room} game={game} winning={correct}/>
  </section>;
}

const statusLabel = status => ({
  bank: 'Banked', banked: 'Banked', bust: 'Busted', busted:'Busted', pushed:'Pushed',
  push:'Pushed', cap:'Made it', capped:'Made it', survived:'Made it', timeout:'Timed out', missed:'No choice',
  inactive:'Out', safe:'Safe', out:'Out',
})[status] || '';

function pressureHeadline(outcome) {
  if (!outcome) return 'The round is over.';
  if (outcome.reason === 'bust') return 'The run busted!';
  if (outcome.reason === 'cap') return 'Made it to the top!';
  if (outcome.reason === 'banked') return 'Everyone banked!';
  return 'The round is settled.';
}

function RiskMeter({game}) {
  const count = Math.max(1,game.cap || game.stage || 1);
  const stage = game.stage || 1;
  return <div className="social-risk" aria-label={`Risk stage ${stage} of ${count}`}>
    <div className="social-risk-label"><span>RISK METER</span><strong>{stage} / {count}</strong></div>
    <ol aria-hidden="true">{Array.from({length:count},(_,i)=><li key={i} className={i+1===stage?'risk-current':i+1<stage?'risk-past':''} style={{'--risk-height':`${45 + ((i+1)/count)*55}%`}}><span>{i+1}</span></li>)}</ol>
    <div className="social-risk-ends" aria-hidden="true"><span>LOWER</span><span>HIGHER</span></div>
  </div>;
}

function PressureReveal({room, game}) {
  const outcome = game.outcome;
  const rows = (outcome?.players || []).map(result => ({...result,name:room.players?.find(p=>sameId(p.id,result.id))?.name || 'Player'}));
  return <section className="social-pressure-reveal" aria-label="Round result">
    <p className="social-kicker">{outcome?.reason === 'bust' && outcome.bustStage != null ? `BUST AT STAGE ${outcome.bustStage}` : 'ROUND COMPLETE'}</p><h2>{pressureHeadline(outcome)}</h2>
    <ol className="social-result-list">{rows.map(row=><li key={row.id}><span>{row.name}<small>{statusLabel(row.status)}</small></span><b>{row.points > 0 ? '+' : ''}{row.points}</b><small>{row.score} total</small></li>)}</ol>
  </section>;
}

function PressureHost({room}) {
  const game = room.game, reveal = game.step === 'reveal';
  return <section className="social-board social-risk-board">
    <Title name={PRESSURE} kicker="THE PUSH-YOUR-LUCK SHOW" game={game} room={room} icon={Warning}/>
    <div className="social-pressure-scene">
      <div className="social-risk-machine">
        <p className="social-kicker">{reveal?'FINAL STAGE VALUE':'CURRENT BANK VALUE'}</p>
        <div className="social-stage-reward"><strong>{game.reward}</strong><span>POINTS</span></div>
        <RiskMeter game={game}/>
      </div>
      {reveal ? <PressureReveal room={room} game={game}/> :
        <aside className="social-pressure-callout"><p className="social-kicker">YOUR SECRET CALL</p><h2>Bank it.<br/>Or go higher.</h2>
          <div className="social-host-options"><p><CoinVertical weight="duotone" aria-hidden="true"/><span><b>Bank</b> Keep these points.</span></p><p><ArrowUpRight weight="bold" aria-hidden="true"/><span><b>Push</b> Play on. A bust earns you nothing this round.</span></p></div>
          <small>Make your choice on your phone.</small>
        </aside>}
    </div>
    <ScoreStrip room={room} game={game}/>
  </section>;
}

function PhoneHeader({room, game, name, icon: Icon}) {
  return <header className="social-phone-masthead"><div><Icon weight="duotone" aria-hidden="true"/><span>{name} <small>Round {game.round} / {game.total}</small></span></div><SocialTimer room={room} game={game}/></header>;
}

function useSubmission(game, act) {
  const [pending,setPending] = useState(null);
  const actionKey = `${game.round}/${game.epoch}/${game.step}`;
  const active = useRef(null);
  useEffect(() => {active.current=null;setPending(null)}, [actionKey]);
  const submit = (action,key) => {
    if (active.current?.actionKey === actionKey) return;
    const request = {actionKey};
    active.current=request;
    setPending({actionKey,key});
    Promise.resolve().then(() => act({...action,round:game.round,epoch:game.epoch})).catch(()=>{}).finally(()=>{
      if(active.current!==request)return;
      active.current=null;setPending(null);
    });
  };
  return [pending?.actionKey===actionKey?pending.key:null,submit];
}

function BazaarPhone({room,act}) {
  const game=room.game, picked=room.private?.selectedId;
  const [pending,submit]=useSubmission(game,act);
  const ready=game.step==='ready', reveal=game.step==='reveal';
  const won=(game.outcome?.correctIds || []).some(id=>sameId(id,room.me));
  const stalls=game.stalls || [];
  const target=game.outcome?.targetId;
  const targetLabel=stallLabel(target,Math.max(0,stalls.findIndex(s=>sameId(s.id,target))));
  const pickedLabel=stallLabel(picked,Math.max(0,stalls.findIndex(s=>sameId(s.id,picked))));
  return <section className="social-phone social-bazaar-phone">
    <PhoneHeader room={room} game={game} name={BAZAAR} icon={Storefront}/>
    <div className="social-phone-intro"><p className="social-kicker">MARKET CASE {game.round}</p><h1>{ready?'Eyes on the market.':reveal?(won?'Case cracked!':'Case closed.'):picked!=null?'Stall locked.':'Choose a stall.'}</h1>
      <p>{ready?'The shared market and its two clues are about to appear.':reveal?target!=null?`The match was stall ${targetLabel}.`:'See the answer on the big screen.':picked!=null?`You picked ${pickedLabel}. Look up for the reveal.`:'Look up at the big screen. Find the stall that fits both clues.'}</p>
    </div>
    {!ready && <div className="social-tiles" role="group" aria-label="Stall selections">
      {stalls.map((stall,index)=>{const label=stallLabel(stall.id,index), isPicked=sameId(stall.id,picked??pending), isTarget=reveal&&sameId(stall.id,target);return <button type="button" key={stall.id} className={`${isPicked?'social-tile-selected ':''}${isTarget?'social-tile-target':''}`} aria-label={`Stall ${label}${isTarget?', correct stall':''}`} aria-pressed={isPicked} disabled={reveal||picked!=null||pending!=null||room.paused} onClick={()=>submit({type:'bazaar',stallId:stall.id},stall.id)}><span>{label}</span>{isTarget&&<Check weight="bold" aria-hidden="true"/>}{isPicked&&!isTarget&&<LockKey weight="fill" aria-hidden="true"/>}</button>})}
    </div>}
    <p className="social-phone-foot" role="status">{pending!=null?'Locking your pick…':reveal&&won?'+1 point':picked!=null&&!reveal?'Locked in':ready?'Get ready':`${scoreFor(game,room.me)} total points`}</p>
    {!ready && <details className="social-board-reference">
      <summary>Read the market board</summary>
      <StallClues clues={game.clues}/>
      <ol aria-label="Stalls and items">{stalls.map((stall,index)=><li key={stall.id}><b>{stallLabel(stall.id,index)}</b><span>{stall.items.join(', ')}</span></li>)}</ol>
    </details>}
  </section>;
}

function PressurePhone({room,act}) {
  const game=room.game, priv=room.private, reveal=game.step==='reveal';
  const [pending,submit]=useSubmission(game,act);
  const active=Boolean(priv?.active), choice=priv?.choice || pending;
  const row=game.outcome?.players?.find(p=>sameId(p.id,room.me));
  const disabled=!active || Boolean(choice) || room.paused;
  return <section className="social-phone social-pressure-phone">
    <PhoneHeader room={room} game={game} name={PRESSURE} icon={Warning}/>
    <div className="social-phone-intro"><p className="social-kicker">{reveal?'ROUND COMPLETE':`RISK STAGE ${game.stage} / ${game.cap}`}</p><h1>{reveal?pressureHeadline(game.outcome):active?(choice?'Choice locked.':'Bank it or push?'):'Look up.'}</h1>
      <p>{reveal?(statusLabel(row?.status) || 'See the full reveal on the big screen.'):!active?'You’re done for this round. Watch how the rest play it.':choice?'Your call is private until the round ends.':'Bank now for guaranteed points, or push for more. No pick banks automatically.'}</p>
    </div>
    {reveal?<div className="social-phone-reward"><b>{row?.points>0?'+':''}{row?.points??0}</b><span>ROUND POINTS</span></div>:<>
      <div className="social-phone-reward"><b>{game.reward}</b><span>POINTS AVAILABLE</span></div>
      <div className="social-phone-actions" role="group" aria-label="Make your choice">
        <button type="button" className={choice==='bank'?'social-action-current':''} aria-pressed={choice==='bank'} disabled={disabled} onClick={()=>submit({type:'pressure',choice:'bank'},'bank')}><CoinVertical weight="duotone" aria-hidden="true"/><b>Bank</b><small>Keep {game.reward}</small></button>
        <button type="button" className={choice==='push'?'social-action-current':''} aria-pressed={choice==='push'} disabled={disabled} onClick={()=>submit({type:'pressure',choice:'push'},'push')}><ArrowUpRight weight="bold" aria-hidden="true"/><b>Push</b><small>Risk the round</small></button>
      </div>
    </>}
    <p className="social-phone-foot" role="status">{pending?'Locking your choice…':choice&&!reveal?'Locked in':`${scoreFor(game,room.me)} total points`}</p>
  </section>;
}

export function SocialArcadeHost({room,act}) {
  if(room.game?.kind==='bazaar')return <BazaarHost room={room} act={act}/>;
  if(room.game?.kind==='pressure')return <PressureHost room={room} act={act}/>;
  return null;
}
export function SocialArcadePhone({room,act}) {
  if(room.game?.kind==='bazaar')return <BazaarPhone room={room} act={act}/>;
  if(room.game?.kind==='pressure')return <PressurePhone room={room} act={act}/>;
  return null;
}
