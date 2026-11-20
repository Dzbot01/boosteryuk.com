import EventPoster from '../components/EventPoster';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Gift, X, Clock3 } from 'lucide-react';
import Seo from '../components/Seo';
import { useNavigate } from 'react-router-dom';
import { eventsApi, EVENT_LABEL, eventStatus, type SiteEvent, type EventStatus } from '../services/eventsApi';
export default function EventsPage() {
  const navigate=useNavigate();
  const [rows,setRows]=useState<SiteEvent[]>([]);const [loading,setLoading]=useState(true);const [err,setErr]=useState('');const [selected,setSelected]=useState<number|null>(null);const [now,setNow]=useState(Date.now());const offset=useRef(0);
  const load=useCallback(async()=>{const r=await eventsApi.list();setLoading(false);if(!r.ok)return setErr(r.message || 'Gagal memuat event.');setErr('');setRows(r.events || []);const t=Date.parse(r.server_time || '');if(Number.isFinite(t))offset.current=t-Date.now();},[]);
  useEffect(()=>{void load();const t=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},30_000);return()=>window.clearInterval(t);},[load]);
  useEffect(()=>{const t=window.setInterval(()=>setNow(Date.now()+offset.current),1000);return()=>window.clearInterval(t);},[]);
  const effective=(e:SiteEvent):EventStatus=>eventStatus(e,now);
  const closeModal=useCallback(()=>setSelected(null),[]);
  const active=rows.find(e=>e.id===selected && effective(e)!=='upcoming');
  return <main className="mx-auto max-w-5xl px-4 pb-32 pt-8 sm:px-6">
    <Seo title="Event"/><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-violet-500">Momen spesial</p><h1 className="mt-1 text-3xl font-extrabold">Event</h1><p className="mt-2 text-sm text-slate-500">Temukan event yang berlangsung dan nantikan kejutan berikutnya.</p></div></div>
    {loading && <p className="mt-8 text-sm text-slate-500">Memuat event…</p>}{err && <p role="alert" className="mt-5 text-sm text-rose-600">{err} <button onClick={()=>void load()} className="underline">Coba lagi</button></p>}
    {(['ongoing','upcoming','finished'] as EventStatus[]).map(status=><section key={status} className="mt-8"><h2 className="mb-3 text-lg font-bold">{EVENT_LABEL[status]} {status==='upcoming' && <span className="text-xs font-normal text-slate-400">/ Coming soon</span>}</h2><div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {rows.filter(e=>effective(e)===status).map(e=><EventPoster key={e.id} title={e.title} status={status} index={e.id} onOpen={()=>e.kind==='game' && status==='ongoing'?navigate(`/event/${e.id}/game`):setSelected(e.id)}/>)}
    </div>{!loading && !err && !rows.some(e=>effective(e)===status) && <p className="text-sm text-slate-400">Belum ada event di kategori ini.</p>}</section>)}
    {active && <EventModal event={active} status={effective(active)} onClose={closeModal}/>}
  </main>;
}
function EventModal({event,status,onClose}:{event:SiteEvent;status:EventStatus;onClose:()=>void}){
  const close=useRef<HTMLButtonElement>(null);useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();const before=document.body.style.overflow;document.body.style.overflow='hidden';const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){e.preventDefault();close.current?.focus();}};window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);document.body.style.overflow=before;previous?.focus();};},[onClose]);
  return <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="event-title" onClick={e=>e.stopPropagation()} className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-7 shadow-2xl dark:bg-slate-900"><button ref={close} onClick={onClose} aria-label="Tutup detail event" className="absolute right-4 top-4 rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4"/></button><Gift className="mb-5 h-10 w-10 text-violet-500"/><p className="text-xs font-bold uppercase tracking-widest text-violet-500">{EVENT_LABEL[status]}</p><h2 id="event-title" className="mt-2 pr-4 text-2xl font-extrabold">{event.title}</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-500">{event.description}</p>{event.ends_at && <p className="mt-6 flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4"/>{new Date(event.ends_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</p>}</section></div>;
}
