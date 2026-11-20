import { useEffect, useRef, useState } from 'react';
import { clampEventPosition } from '../lib/eventPosition';
import { Gift, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
const KEY = 'by_event_position';
export const EVENT_REOPEN = 'by:event-reopen';
function clamp(p: {x:number;y:number}) { return clampEventPosition(p, window.innerWidth, window.innerHeight); }
export default function EventLauncher() {
  const navigate = useNavigate();
  const [hidden,setHidden] = useState(() => { try { return sessionStorage.getItem('by_event_hidden') === '1'; } catch { return false; } });
  const [pos,setPos] = useState(() => { try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return clamp(p); } catch { /* defaults */ } return clamp({x:window.innerWidth-88,y:window.innerHeight-170}); });
  const posRef = useRef(pos); posRef.current = pos;
  const drag = useRef<{id:number;x:number;y:number;px:number;py:number;moved:boolean} | null>(null);
  const moved = useRef(false);
  useEffect(() => {
    const resize = () => setPos(p => clamp(p));
    const reopen = () => { setHidden(false); try { sessionStorage.removeItem('by_event_hidden'); } catch { /* unavailable */ } };
    window.addEventListener('resize',resize); window.addEventListener(EVENT_REOPEN,reopen);
    return () => {window.removeEventListener('resize',resize);window.removeEventListener(EVENT_REOPEN,reopen);};
  },[]);
  if (hidden) return null;
  return <div className="fixed z-[45]" style={{left:pos.x,top:pos.y}}>
    <button onClick={() => {setHidden(true);try {sessionStorage.setItem('by_event_hidden','1');} catch { /* unavailable */ }}} aria-label="Sembunyikan ikon Event" className="absolute -right-1 -top-6 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm dark:border-slate-600 dark:bg-slate-800"><X className="h-3 w-3"/></button>
    <button aria-label="Buka Event; seret untuk memindahkan" title="Event — seret untuk memindahkan" className="flex h-16 w-16 touch-none select-none flex-col items-center justify-center gap-0.5 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg ring-1 ring-white/30 active:cursor-grabbing"
      onPointerDown={e => {if (e.button !== 0) return; moved.current=false; drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,px:pos.x,py:pos.y,moved:false};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e => {const d=drag.current;if (!d || d.id!==e.pointerId) return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if (Math.hypot(dx,dy)>5) d.moved=true;if (d.moved) {moved.current=true;const next=clamp({x:d.px+dx,y:d.py+dy});posRef.current=next;setPos(next);}}}
      onPointerUp={e => {const d=drag.current;if (!d || d.id!==e.pointerId) return;drag.current=null;if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);if(d.moved) try {localStorage.setItem(KEY,JSON.stringify(posRef.current));} catch { /* unavailable */ }}}
      onPointerCancel={() => {drag.current=null;moved.current=true;}}
      onClick={() => {if (!moved.current) navigate('/event');moved.current=false;}}
      onKeyDown={e => {if (!e.key.startsWith('Arrow')) return;e.preventDefault();const delta={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if (!delta) return;const p=clamp({x:pos.x+delta[0],y:pos.y+delta[1]});setPos(p);try {localStorage.setItem(KEY,JSON.stringify(p));} catch { /* unavailable */ }}}>
      <Gift className="h-6 w-6"/><span className="text-[10px] font-bold">Event</span>
    </button>
  </div>;
}
