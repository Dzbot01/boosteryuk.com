import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Plus, Save, Pencil } from 'lucide-react';
import AdminShell, { adminCard, adminInput } from './AdminShell';
import { IS_CHILD_PANEL } from '../../lib/apiBase';
import { eventsApi, EVENT_LABEL, type EventInput, type SiteEvent, type EventStatus } from '../../services/eventsApi';
const fresh = ():EventInput => ({title:'',description:'',kind:'standard',status:'upcoming',starts_at:null,ends_at:null});
const toWib=(s:string|null)=>s?new Date(Date.parse(s)+7*3600_000).toISOString().slice(0,16):'';
const fromWib=(s:string)=>s?new Date(s+':00+07:00').toISOString():null;
export default function AdminEventsPage(){
  const [rows,setRows]=useState<SiteEvent[]>([]);const [draft,setDraft]=useState<EventInput>(fresh);const [err,setErr]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{if(IS_CHILD_PANEL)return;setLoading(true);const r=await eventsApi.adminList();setLoading(false);if(!r.ok)return setErr(r.message || 'Gagal memuat event.');setErr('');setRows(r.events || []);},[]);
  useEffect(()=>{void load();},[load]);
  if(IS_CHILD_PANEL)return <Navigate to="/panel-admin" replace/>;
  const save=async()=>{if(busy)return;setBusy(true);setErr('');setMessage('');const r=await eventsApi.save(draft);setBusy(false);if(!r.ok)return setErr(r.message || 'Gagal menyimpan.');setRows(r.events || []);setMessage('Event tersimpan. Halaman publik mengikuti pada pemuatan berikutnya atau maksimal sekitar 30 detik.');setDraft(fresh());};
  return <AdminShell wide title="Kelola Event" desc="Atur event untuk root dan seluruh child panel. Semua waktu di formulir memakai WIB (UTC+7)." loading={loading} onRefresh={()=>void load()}>
    {err && <p role="alert" className="mt-4 text-sm text-rose-600">{err}</p>}{message && <p role="status" className="mt-4 text-sm text-emerald-600">{message}</p>}
    <div className="mt-6 grid items-start gap-5 lg:grid-cols-2"><section className={`${adminCard} p-5`}><div className="flex justify-between gap-3"><h2 className="font-bold">{draft.id?`Ubah event #${draft.id}`:'Tambah event'}</h2><button disabled={busy} onClick={()=>{setDraft(fresh());setMessage('');}} className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700"><Plus className="h-4 w-4"/>Baru</button></div>
      <form onSubmit={e=>{e.preventDefault();void save();}} className="mt-4 space-y-4"><fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
        <label className="block text-xs font-semibold">Judul<input required={draft.status!=='upcoming'} maxLength={120} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} className={`${adminInput} mt-1`}/></label>
        <label className="block text-xs font-semibold">Deskripsi<textarea maxLength={4000} rows={4} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent p-3 text-sm dark:border-slate-600"/></label>
        <div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold">Status<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as EventStatus})} className={`${adminInput} mt-1`}>{Object.entries(EVENT_LABEL).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label className="text-xs font-semibold">Jenis<select value={draft.kind} onChange={e=>setDraft({...draft,kind:e.target.value as EventInput['kind']})} className={`${adminInput} mt-1`}><option value="standard">Informasi event</option><option value="game">Game Naikkan Akunmu!</option></select></label></div>
        <label className="block text-xs font-semibold">Mulai (WIB, opsional)<input type="datetime-local" value={toWib(draft.starts_at)} onChange={e=>setDraft({...draft,starts_at:fromWib(e.target.value)})} className={`${adminInput} mt-1`}/></label>
        <label className="block text-xs font-semibold">Batas akhir (WIB)<input type="datetime-local" required={draft.kind==='countdown'} value={toWib(draft.ends_at)} onChange={e=>setDraft({...draft,ends_at:fromWib(e.target.value)})} className={`${adminInput} mt-1`}/></label>
        <p className="text-xs leading-relaxed text-slate-500">Waktu mulai mengatur perpindahan Akan hadir → Berlangsung. Batas akhir otomatis memindahkan event ke Selesai. Status Selesai selalu diprioritaskan. Untuk mengatur status sepenuhnya manual, kosongkan jadwal. Card Akan hadir di publik hanya menampilkan tanda tanya tanpa judul dan tidak dapat diklik.</p>
        <button className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white"><Save className="h-4 w-4"/>{busy?'Menyimpan…':'Simpan event'}</button>
      </fieldset></form></section>
      <section className="space-y-3"><h2 className="font-bold">Event tersedia</h2>{loading && <p className="text-sm text-slate-500">Memuat…</p>}{rows.map(e=><article key={e.id} className={`${adminCard} p-4`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{e.title || 'Event misteri (tanpa judul)'}</h3><p className="mt-1 text-xs text-violet-500">{EVENT_LABEL[e.effective_status]} · {e.kind==='game'?'Game':'Informasi'}</p></div><button disabled={busy} onClick={()=>{setDraft({...e});setMessage('');}} aria-label={`Ubah event ${e.title || e.id}`} className="rounded-lg border border-slate-300 p-2 dark:border-slate-600"><Pencil className="h-4 w-4"/></button></div><p className="mt-3 text-xs text-slate-500">Mulai: {e.starts_at?new Date(e.starts_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB':'Manual'}<br/>Akhir: {e.ends_at?new Date(e.ends_at).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB':'Tanpa batas'}</p></article>)}</section>
    </div>
  </AdminShell>;
}
