import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import AdminShell, { adminCard, adminInput } from './AdminShell';
import { useAuth } from '../../context/AuthContext';
import { IS_CHILD_PANEL, MAIN_API } from '../../lib/apiBase';
type Participant={user_id:number;username:string;score:number;followers:number;likes:number;views:number;comments:number;revision:number;bonus:Record<string,number>};
const fields=['score','followers','likes','views','comments'] as const;
export default function AdminEventDataPage(){
 const {id}=useParams();const {user}=useAuth();const [rows,setRows]=useState<Participant[]>([]);const [total,setTotal]=useState(0);const [title,setTitle]=useState('');const [page,setPage]=useState(1);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [edit,setEdit]=useState<Participant|null>(null);
 const call=useCallback(async(action:string,extra:Record<string,unknown>={})=>{
  const res=await fetch(`${MAIN_API}/event_game_admin.php`,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({token:user?.token,event_id:Number(id),action,...extra}),signal:AbortSignal.timeout(20000)});
  let data;try{data=await res.json();}catch{throw new Error('API data event belum tersedia. Periksa upload event_game_admin.php.');}
  if(!res.ok||!data.ok)throw new Error(data.message||'Gagal memuat data event.');return data;
 },[id,user?.token]);
 const load=useCallback(async()=>{if(IS_CHILD_PANEL)return;setLoading(true);try{const d=await call('list',{page});setRows(d.rows);setTotal(d.total);setTitle(d.event.title);setError('');}catch(e){setError(e instanceof Error?e.message:'Gagal memuat data.');}finally{setLoading(false);}},[call,page]);
 useEffect(()=>{void load();},[load]);
 const mutate=async(action:'update'|'delete',row:Participant)=>{
  if(busy)return;if(action==='delete'&&!confirm(`Hapus @${row.username} dari game ini? Akun website, riwayat pembayaran, dan jatah harian tidak dihapus. Inventori game peserta ini ikut dihapus.`))return;
  setBusy(true);try{await call(action,{...row});setEdit(null);await load();}catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan.');}finally{setBusy(false);}
 };
 if(IS_CHILD_PANEL)return <Navigate to="/panel-admin" replace/>;
 return <AdminShell wide title="Data Event" desc={title} loading={loading} onRefresh={()=>void load()}><Link to="/admin/events" className="text-sm text-cyan-600">← Kelola Event</Link><div className={`${adminCard} mt-4 p-5`}><h2 className="text-xl font-bold">Total peserta: {total.toLocaleString('id-ID')}</h2><p className="mt-2 text-xs text-slate-500">Username adalah username dalam game. Statistik kuis terakhir ditampilkan di tabel; bonus merchant ditampilkan terpisah. Skor browser belum terverifikasi. Perubahan admin membuat tab game lama perlu dimuat ulang.</p></div>{error&&<p role="alert" className="my-4 text-rose-600">{error}</p>}
 <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['ID Web','Username Game','Score','Followers','Like','Views','Komentar','Bonus Merchant (F/L/V/K)','Aksi'].map(x=><th key={x} className="whitespace-nowrap p-3">{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.user_id} className="border-t border-slate-200 dark:border-slate-700"><td className="p-3">{r.user_id}</td><td className="p-3">@{r.username}</td>{fields.map(k=><td key={k} className="p-3">{r[k].toLocaleString('id-ID')}</td>)}<td className="p-3">{['f','l','v','c'].map(k=>r.bonus[k]||0).join(' / ')}</td><td className="whitespace-nowrap p-3"><button disabled={busy} onClick={()=>setEdit({...r})} className="mr-4 text-cyan-600">Ubah</button><button disabled={busy} onClick={()=>void mutate('delete',r)} className="text-rose-600">Hapus dari game</button></td></tr>)}</tbody></table>{!loading&&!rows.length&&<p className="p-4">Belum ada peserta.</p>}</div>
 <div className="my-5 flex items-center gap-4"><button disabled={page<=1||loading||busy} onClick={()=>setPage(p=>p-1)}>← Sebelumnya</button><span>{page} / {Math.max(1,Math.ceil(total/50))}</span><button disabled={page*50>=total||loading||busy} onClick={()=>setPage(p=>p+1)}>Berikutnya →</button></div>
 {edit&&<form onSubmit={e=>{e.preventDefault();void mutate('update',edit);}} className={`${adminCard} my-5 space-y-3 p-5`}><h2 className="font-bold">Ubah @{edit.username}</h2><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">{fields.map(k=><label key={k} className="text-sm capitalize">{k}<input required type="number" min="0" max={k==='score'?100000000:10000000} step="1" value={edit[k]} onChange={e=>setEdit({...edit,[k]:Number(e.target.value)})} className={`${adminInput} mt-1`}/></label>)}</fieldset><div className="flex gap-4"><button disabled={busy} className="rounded bg-cyan-600 px-4 py-2 font-bold text-white">{busy?'Menyimpan…':'Simpan perubahan'}</button><button type="button" disabled={busy} onClick={()=>setEdit(null)}>Batal</button></div></form>}
 </AdminShell>;
}
