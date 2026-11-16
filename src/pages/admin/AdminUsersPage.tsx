import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, CircleAlert, Crown, Loader2, Minus, Pencil, Plus, Search, Shield, Wallet, X } from 'lucide-react';
import AdminShell, { adminCard, adminInput } from './AdminShell';
import { adminDataApi, rupiah, type AdminUser } from '../../services/adminDataApi';

/** Admin utama: semua user di database — tambah/kurangi saldo dan edit data user. */
export default function AdminUsersPage() {
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [totalBal, setTotalBal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState<{ u: AdminUser; tab: 'saldo' | 'data' } | null>(null);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setRows(null);
    setErr('');
    const r = await adminDataApi.users({ q: query, page });
    if (!r.ok) { setRows([]); return setErr(r.message || 'Gagal memuat user.'); }
    setRows(r.users || []);
    setTotal(r.total || 0);
    setTotalBal(r.total_balance || 0);
    setPerPage(r.per_page || 25);
  }, [query, page]);
  useEffect(() => { void load(); }, [load]);

  const done = (u: AdminUser | null, msg: string) => {
    if (u) setRows((list) => list?.map((x) => (x.id === u.id ? { ...x, ...u } : x)) || null);
    setEdit(null);
    setToast(msg);
    window.setTimeout(() => setToast(''), 3500);
  };

  const pages = Math.max(1, Math.ceil(total / perPage));
  const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-cyan-400 hover:text-cyan-700 disabled:opacity-30 dark:border-slate-600 dark:text-slate-300';

  return (
    <AdminShell wide title="Data User" desc="Semua user di database. Tambah atau kurangi saldo (tercatat dengan catatan & admin), atau ubah data user." loading={rows === null} onRefresh={() => void load()}>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className={`${adminCard} p-4`}><p className="text-[11.5px] text-slate-400">User (sesuai pencarian)</p><p className="text-[20px] font-extrabold text-slate-900 dark:text-white">{total.toLocaleString('id-ID')}</p></div>
        <div className={`${adminCard} p-4`}><p className="text-[11.5px] text-slate-400">Total saldo user</p><p className="text-[20px] font-extrabold text-slate-900 dark:text-white">{rupiah(totalBal)}</p></div>
      </div>

      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q.trim()); }}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className={`${adminInput} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, username, email, atau ID user…" aria-label="Cari user" />
        </div>
        <button className="h-10 rounded-lg bg-cyan-600 px-4 text-[13px] font-bold text-white hover:bg-cyan-700">Cari</button>
      </form>

      {err && <p role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700 dark:bg-rose-950/40"><CircleAlert className="h-4 w-4" /> {err}</p>}

      <div className={`${adminCard} mt-4 overflow-x-auto p-0`}>
        <table className="w-full min-w-[860px] text-left text-[12.5px]">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-[10.5px] uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:bg-slate-800/40">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Email / HP</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3 text-right">Pesanan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {rows === null && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>}
            {rows?.length === 0 && !err && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Tidak ada user.</td></tr>}
            {rows?.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/20">
                <td className="px-4 py-3 font-mono text-slate-400">#{u.id}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{u.name || '—'}</p>
                  {u.username && <p className="text-[11px] text-slate-400">@{u.username}</p>}
                </td>
                <td className="px-4 py-3"><p className="text-slate-700 dark:text-slate-200">{u.email}</p>{u.phone && <p className="text-[11px] text-slate-400">{u.phone}</p>}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{rupiah(u.balance)}</td>
                <td className="px-4 py-3 text-right"><p>{u.orders ?? 0}</p><p className="text-[11px] text-slate-400">{rupiah(u.spend)}</p></td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {u.role === 'admin' && <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900"><Shield className="h-3 w-3" /> Admin</span>}
                    {u.plus && <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"><Crown className="h-3 w-3" /> Plus</span>}
                    {u.role !== 'admin' && !u.plus && <span className="text-[11px] text-slate-400">User</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-1.5">
                    <button className={iconBtn} onClick={() => setEdit({ u, tab: 'saldo' })} aria-label={`Ubah saldo ${u.email}`} title="Tambah / kurangi saldo"><Wallet className="h-4 w-4" /></button>
                    <button className={iconBtn} onClick={() => setEdit({ u, tab: 'data' })} aria-label={`Edit data ${u.email}`} title="Edit data user"><Pencil className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-[12.5px] text-slate-500">
        <span>Halaman {page} dari {pages}</span>
        <div className="flex gap-1.5">
          <button className={iconBtn} disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Halaman sebelumnya"><ChevronLeft className="h-4 w-4" /></button>
          <button className={iconBtn} disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Halaman berikutnya"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      {edit && <UserModal key={edit.u.id + edit.tab} u={edit.u} initialTab={edit.tab} onClose={() => setEdit(null)} onDone={done} />}
      {toast && (
        <div role="alert" className="fixed inset-x-4 top-5 z-[90] mx-auto flex max-w-sm items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <Check className="h-4 w-4 text-emerald-600" /> {toast}
        </div>
      )}
    </AdminShell>
  );
}

function UserModal({ u, initialTab, onClose, onDone }: { u: AdminUser; initialTab: 'saldo' | 'data'; onClose: () => void; onDone: (u: AdminUser | null, msg: string) => void }) {
  const [tab, setTab] = useState(initialTab);
  const [mode, setMode] = useState<'add' | 'sub'>('add');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [d, setD] = useState({ name: u.name, username: u.username || '', email: u.email, phone: u.phone || '', role: u.role, plus: u.plus });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const amt = Math.round(Number(amount) || 0);

  const saveBalance = async () => {
    if (amt <= 0) return setErr('Isi nominal.');
    if (note.trim().length < 3) return setErr('Isi catatan (mis. "Deposit manual DANA", "Kompensasi pesanan #123").');
    const signed = mode === 'add' ? amt : -amt;
    if (!window.confirm(`${mode === 'add' ? 'Tambah' : 'Kurangi'} saldo ${u.email} sebesar ${rupiah(amt)}?`)) return;
    setBusy(true); setErr('');
    const r = await adminDataApi.balance(u.id, signed, note.trim());
    setBusy(false);
    if (!r.ok) return setErr(r.message || 'Gagal.');
    onDone({ ...u, balance: r.balance ?? u.balance }, r.message || 'Saldo diperbarui.');
  };
  const saveData = async () => {
    const patch: Record<string, unknown> = {};
    if (d.name !== u.name) patch.name = d.name;
    if (u.has_username && d.username !== (u.username || '')) patch.username = d.username;
    if (d.email !== u.email) patch.email = d.email;
    if (u.has_phone && d.phone !== (u.phone || '')) patch.phone = d.phone;
    if (d.role !== u.role) patch.role = d.role;
    if (u.has_plus && d.plus !== u.plus) patch.plus = d.plus;
    if (!Object.keys(patch).length) return setErr('Tidak ada perubahan.');
    setBusy(true); setErr('');
    const r = await adminDataApi.updateUser({ id: u.id, ...patch });
    setBusy(false);
    if (!r.ok) return setErr(r.message || 'Gagal.');
    onDone(r.user || null, r.message || 'Data user tersimpan.');
  };

  const lbl = 'mb-1 block text-[11.5px] font-semibold text-slate-500';
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`Kelola ${u.email}`} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl dark:bg-slate-900 sm:rounded-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">User #{u.id}</p>
            <p className="text-[17px] font-extrabold text-slate-900 dark:text-white">{u.name || u.email}</p>
            <p className="text-[12.5px] text-slate-500">Saldo sekarang <b className="text-slate-900 dark:text-white">{rupiah(u.balance)}</b></p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 inline-flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
          {(['saldo', 'data'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setErr(''); }} className={`rounded-md px-3 py-1.5 text-[12.5px] font-bold ${tab === t ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500'}`}>
              {t === 'saldo' ? 'Saldo' : 'Data user'}
            </button>
          ))}
        </div>

        {tab === 'saldo' ? (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setMode('add')} className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-[13px] font-bold ${mode === 'add' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}><Plus className="h-4 w-4" /> Tambah</button>
              <button type="button" onClick={() => setMode('sub')} className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-[13px] font-bold ${mode === 'sub' ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-900/30' : 'border-slate-200 text-slate-500 dark:border-slate-700'}`}><Minus className="h-4 w-4" /> Kurangi</button>
            </div>
            <label className="block"><span className={lbl}>Nominal (Rp)</span>
              <input className={adminInput} type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50000" />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[10000, 25000, 50000, 100000].map((v) => <button key={v} type="button" onClick={() => setAmount(String(v))} className="rounded-full border border-slate-200 px-2.5 py-1 text-[11.5px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">{rupiah(v)}</button>)}
            </div>
            <label className="block"><span className={lbl}>Catatan (wajib)</span>
              <input className={adminInput} value={note} maxLength={255} onChange={(e) => setNote(e.target.value)} placeholder="mis. Deposit manual via DANA" />
            </label>
            {amt > 0 && <p className="text-[12.5px] text-slate-500">Saldo setelahnya: <b className="text-slate-900 dark:text-white">{rupiah(u.balance + (mode === 'add' ? amt : -amt))}</b></p>}
            <button onClick={() => void saveBalance()} disabled={busy} className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13.5px] font-bold text-white disabled:opacity-50 ${mode === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {mode === 'add' ? 'Tambah saldo' : 'Kurangi saldo'}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block"><span className={lbl}>Nama</span><input className={adminInput} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
            {u.has_username && <label className="block"><span className={lbl}>Username</span><input className={adminInput} value={d.username} onChange={(e) => setD({ ...d, username: e.target.value })} /></label>}
            <label className="block"><span className={lbl}>Email</span><input className={adminInput} type="email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} /></label>
            {u.has_phone && <label className="block"><span className={lbl}>No. HP / WhatsApp</span><input className={adminInput} inputMode="tel" value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} /></label>}
            <label className="block"><span className={lbl}>Role</span>
              <select className={adminInput} value={d.role} onChange={(e) => setD({ ...d, role: e.target.value })}><option value="user">User</option><option value="admin">Admin</option></select>
            </label>
            {u.has_plus && (
              <label className="flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200">
                <input type="checkbox" className="h-4 w-4 accent-cyan-600" checked={d.plus} onChange={(e) => setD({ ...d, plus: e.target.checked })} /> Boosteryuk Plus aktif
              </label>
            )}
            <p className="text-[11.5px] text-slate-500">Password user tidak bisa dilihat. User dapat menggantinya sendiri lewat lupa password.</p>
            <button onClick={() => void saveData()} disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-[13.5px] font-bold text-white hover:bg-cyan-700 disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Simpan data
            </button>
          </div>
        )}
        {err && <p role="alert" className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-600"><CircleAlert className="h-4 w-4" /> {err}</p>}
      </div>
    </div>
  );
}
