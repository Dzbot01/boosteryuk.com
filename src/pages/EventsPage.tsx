import { useMusic } from '../context/MusicContext';
import EventPoster from '../components/EventPoster';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Gift, X, Clock3 } from 'lucide-react';
import Seo from '../components/Seo';
import { useNavigate } from 'react-router-dom';
import { eventsApi, eventAccess, EVENT_LABEL, eventStatus, type EventAccess, type SiteEvent, type EventStatus } from '../services/eventsApi';
export default function EventsPage() {
  const navigate=useNavigate();const {play}=useMusic();
  const [rows,setRows]=useState<SiteEvent[]>([]);const [loading,setLoading]=useState(true);const [err,setErr]=useState('');const [selected,setSelected]=useState<number|null>(null);const [now,setNow]=useState(Date.now());const offset=useRef(0);
  const [access,setAccess]=useState<Record<string,EventAccess>>({});const [notice,setNotice]=useState('');const [checking,setChecking]=useState(false);
  useEffect(()=>{let alive=true;void eventAccess().then(r=>{if(alive)setAccess(r);}).catch(()=>{});return()=>{alive=false;};},[]);
  const load=useCallback(async()=>{const r=await eventsApi.list();setLoading(false);if(!r.ok)return setErr(r.message || 'Gagal memuat event.');setErr('');setRows(r.events || []);const t=Date.parse(r.server_time || '');if(Number.isFinite(t))offset.current=t-Date.now();},[]);
  useEffect(()=>{void load();const t=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},30_000);return()=>window.clearInterval(t);},[load]);
  useEffect(()=>{const t=window.setInterval(()=>setNow(Date.now()+offset.current),1000);return()=>window.clearInterval(t);},[]);
  const effective=(e:SiteEvent):EventStatus=>eventStatus(e,now);
  const closeModal=useCallback(()=>setSelected(null),[]);
  const active=rows.find(e=>e.id===selected && effective(e)!=='upcoming');
  const openEvent=async(e:SiteEvent)=>{
    if(effective(e)==='finished'){setNotice(access[e.id]?.completed?'Event sudah kamu selesaikan.':'Event telah berakhir.');return;}
    if(access[e.id] && !access[e.id].allowed){setNotice(access[e.id].message);return;}
    if(checking)return;setChecking(true);setNotice('');
    try {
      const latest=await eventAccess(e.id);setAccess(previous=>({...previous,...latest}));
      if(!latest[e.id]?.allowed){setNotice(latest[e.id]?.message || 'Event tidak dapat dibuka.');return;}
      if(e.kind==='streak')navigate('/event/daily-streak');
      else if(e.kind==='game'){play();navigate(`/event/${e.id}/game`);}
      else setSelected(e.id);
    }catch(error){setNotice(error instanceof Error?error.message:'Akses event belum dapat diperiksa.');}
    finally{setChecking(false);}
  };
  return <main className="mx-auto max-w-5xl px-4 pb-32 pt-8 sm:px-6">
    <Seo title="Event"/><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-violet-500">Momen spesial</p><h1 className="mt-1 text-3xl font-extrabold">Event</h1><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Temukan event yang berlangsung dan nantikan kejutan berikutnya.</p></div></div>
    {loading && <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">Memuat event…</p>}{err && <p role="alert" className="mt-5 text-sm text-rose-600">{err} <button onClick={()=>void load()} className="underline">Coba lagi</button></p>}
    {(notice || checking) && <p role="status" className="mt-5 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300">{checking?'Memeriksa akses event…':notice}</p>}
    <section aria-label="Daftar event" className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[...rows].sort((a,b)=>['ongoing','upcoming','finished'].indexOf(effective(a))-['ongoing','upcoming','finished'].indexOf(effective(b)) || a.id-b.id).map(e=><EventPoster key={e.id} title={e.title} status={effective(e)} index={e.id} blockedMessage={access[e.id]?.completed?'Event sudah kamu selesaikan.':effective(e)==='finished'?'Event telah berakhir.':access[e.id]?.message} onOpen={()=>void openEvent(e)}/>)}
    </section>{!loading&&!err&&!rows.length&&<p className="mt-5 text-slate-400">Belum ada event.</p>}
    {active && <EventModal event={active} status={effective(active)} onClose={closeModal}/>}
  </main>;
}
function EventModal({event,status,onClose}:{event:SiteEvent;status:EventStatus;onClose:()=>void}){
  const close=useRef<HTMLButtonElement>(null);useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus();const before=document.body.style.overflow;document.body.style.overflow='hidden';const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){e.preventDefault();close.current?.focus();}};window.addEventListener('keydown',key);return()=>{window.removeEventListener('keydown',key);document.body.style.overflow=before;previous?.focus();};},[onClose]);
  return <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}><section role="dialog" aria-modal="true" aria-labelledby="event-title" onClick={e=>e.stopPropagation()} className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-7 shadow-2xl dark:bg-slate-900"><button ref={close} onClick={onClose} aria-label="Tutup detail event" className="absolute right-4 top-4 rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4"/></button><Gift className="mb-5 h-10 w-10 text-violet-500"/><p className="text-xs font-bold uppercase tracking-widest text-violet-500">{EVENT_LABEL[status]}</p><h2 id="event-title" className="mt-2 pr-4 text-2xl font-extrabold">{event.title}</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-500 dark:text-slate-400">{event.description}</p>{event.ends_at && <p className="mt-6 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><Clock3 className="h-4 w-4"/>{new Date(event.ends_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} WIB</p>}</section></div>;
}
