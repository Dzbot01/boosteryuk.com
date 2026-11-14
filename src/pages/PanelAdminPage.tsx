import { useCallback, useEffect, useState } from 'react';
import { BarChart3, ShoppingBag, Users, Percent, Wallet, Banknote, TrendingUp, RefreshCw, Loader2, Check, CircleAlert, ShieldOff } from 'lucide-react';
import Seo from '../components/Seo';
import WithdrawPanel from '../components/childpanel/WithdrawPanel';
import { useAuth } from '../context/AuthContext';
import { IS_CHILD_PANEL } from '../lib/apiBase';
import { panelApi, usePanelOwner, type PanelOrder, type PanelSummary, type PanelUser } from '../services/panelApi';

const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const waktu = (s: string) => {
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? s : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
};
type Tab = 'ringkasan' | 'pesanan' | 'user' | 'markup' | 'withdraw';
const TABS: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'ringkasan', label: 'Ringkasan', icon: BarChart3 },
  { id: 'pesanan', label: 'Pesanan', icon: ShoppingBag },
  { id: 'user', label: 'Aktivitas User', icon: Users },
  { id: 'markup', label: 'Markup', icon: Percent },
  { id: 'withdraw', label: 'Withdraw', icon: Banknote },
];
const ACTION_LABEL: Record<string, string> = { visit: 'Berkunjung', order: 'Memesan' };

/**
 * Admin panel ke-2: hanya untuk pemilik child panel (diatur admin utama lewat "Email pemilik").
 * Berbeda dari admin panel utama — berisi pendapatan markup, pesanan & user panel ini saja.
 */
export default function PanelAdminPage() {
  const { user } = useAuth();
  const owner = usePanelOwner(user?.token);
  const [tab, setTab] = useState<Tab>('ringkasan');
  const [summary, setSummary] = useState<PanelSummary | null>(null);
  const [orders, setOrders] = useState<PanelOrder[] | null>(null);
  const [users, setUsers] = useState<PanelUser[] | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setErr('');
    const [s, o, u] = await Promise.all([panelApi.summary(), panelApi.orders(100), panelApi.users()]);
    if (!s.ok) setErr(s.message || 'Gagal memuat data panel.');
    else setSummary(s);
    setOrders(o.ok ? o.orders || [] : []);
    setUsers(u.ok ? u.users || [] : []);
  }, []);

  useEffect(() => {
    if (owner) void load();
  }, [owner, load]);

  const card = 'rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-slate-800 dark:bg-slate-900';

  if (!IS_CHILD_PANEL || owner === false) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-32 pt-16 text-center">
        <Seo title="Admin Panel Toko" noindex />
        <ShieldOff className="mx-auto h-10 w-10 text-slate-300" />
        <p className="mt-3 text-[15px] font-semibold text-slate-700 dark:text-slate-200">Halaman ini khusus admin child panel.</p>
        <p className="mt-1 text-[13px] text-slate-500">Buka dari subdomain panel milikmu dan login dengan akun pemilik panel.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 sm:px-6">
      <Seo title="Admin Panel Toko" noindex />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Admin Panel Toko</p>
          <h1 className="text-[22px] font-bold text-slate-900 dark:text-white">{summary?.panel.name || 'Memuat…'}</h1>
          {summary && <p className="text-[12.5px] text-slate-500">{summary.panel.hostname}</p>}
        </div>
        <button onClick={() => void load()} aria-label="Muat ulang" className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
          <RefreshCw className={`h-4 w-4 ${owner === null || (!summary && !err) ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto" role="tablist">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold ${
                tab === t.id ? 'by-menu-active text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {err && (
        <div className={`${card} mt-4 flex items-center gap-2 text-[13px] text-rose-600`}>
          <CircleAlert className="h-4 w-4" /> {err}
        </div>
      )}

      {tab === 'ringkasan' && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Total pendapatan (markup)', value: summary ? rupiah(summary.all.profit) : null, icon: Wallet },
              { label: 'Pendapatan bulan ini', value: summary ? rupiah(summary.month.profit) : null, icon: TrendingUp },
              { label: 'Pesanan bulan ini', value: summary ? `${summary.month.orders} pesanan` : null, icon: ShoppingBag },
              { label: 'User aktif 7 hari', value: summary ? `${summary.users.active7d} / ${summary.users.total}` : null, icon: Users },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className={`${card} flex items-center gap-3`}>
                  <span className="by-menu-active flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11.5px] leading-tight text-slate-400">{s.label}</p>
                    {s.value === null ? <span className="mt-1 block h-[18px] w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" /> : <p className="truncate text-[15px] font-bold text-slate-800 dark:text-slate-100">{s.value}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          {summary && (
            <div className={card}>
              <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Rincian</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
                <div><dt className="text-[11.5px] text-slate-400">Omzet hari ini</dt><dd className="font-semibold">{rupiah(summary.today.omzet)}</dd></div>
                <div><dt className="text-[11.5px] text-slate-400">Pendapatan hari ini</dt><dd className="font-semibold">{rupiah(summary.today.profit)}</dd></div>
                <div><dt className="text-[11.5px] text-slate-400">Omzet bulan ini</dt><dd className="font-semibold">{rupiah(summary.month.omzet)}</dd></div>
                <div><dt className="text-[11.5px] text-slate-400">Total pesanan</dt><dd className="font-semibold">{summary.all.orders}</dd></div>
                <div><dt className="text-[11.5px] text-slate-400">Total omzet</dt><dd className="font-semibold">{rupiah(summary.all.omzet)}</dd></div>
                <div><dt className="text-[11.5px] text-slate-400">Markup saat ini</dt><dd className="font-semibold">SMM {summary.panel.markup_smm_pct}% · Agen AI {summary.panel.markup_agent_pct}% · OTP {summary.panel.markup_otp_pct ?? 0}%</dd></div>
              </dl>
              <p className="mt-3 text-[11.5px] text-slate-500">
                Pendapatan = harga yang dibayar user di panel ini − harga asli Boosteryuk (pesanan dibatalkan tidak dihitung).{' '}
                <button className="font-semibold text-cyan-700 underline dark:text-cyan-400" onClick={() => setTab('withdraw')}>Cairkan pendapatan</button>
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'pesanan' && (
        <div className={`${card} mt-4 overflow-x-auto p-0`}>
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[10.5px] uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Layanan</th>
                <th className="px-4 py-3 text-right">Dibayar</th>
                <th className="px-4 py-3 text-right">Harga asli</th>
                <th className="px-4 py-3 text-right">Pendapatan</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {orders === null && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Memuat…</td></tr>
              )}
              {orders?.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Belum ada pesanan dari panel ini.</td></tr>
              )}
              {orders?.map((o) => (
                <tr key={`${o.kind}-${o.order_id}`}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{waktu(o.created_at)}</td>
                  <td className="px-4 py-3"><p className="font-semibold text-slate-800 dark:text-slate-100">{o.name || '—'}</p><p className="text-[11px] text-slate-400">{o.email}</p></td>
                  <td className="max-w-[240px] px-4 py-3">
                    <p className="truncate font-semibold text-slate-800 dark:text-slate-100" title={o.service_name}>{o.service_name}</p>
                    <p className="text-[11px] text-slate-400">{o.kind === 'agent' ? 'Agen AI' : o.kind === 'otp' ? 'Nomor OTP' : 'SMM'} · #{o.order_id}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{rupiah(o.price)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">{rupiah(o.base_price)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{rupiah(o.profit)}</td>
                  <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">{o.status || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'user' && (
        <div className={`${card} mt-4 overflow-x-auto p-0`}>
          <table className="w-full min-w-[680px] text-left text-[12.5px]">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[10.5px] uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Terakhir aktif</th>
                <th className="px-4 py-3">Aktivitas</th>
                <th className="px-4 py-3 text-right">Kunjungan</th>
                <th className="px-4 py-3 text-right">Pesanan</th>
                <th className="px-4 py-3 text-right">Belanja</th>
                <th className="px-4 py-3 text-right">Pendapatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users === null && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Memuat…</td></tr>}
              {users?.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Belum ada user yang login di panel ini.</td></tr>}
              {users?.map((u, i) => (
                <tr key={i}>
                  <td className="px-4 py-3"><p className="font-semibold text-slate-800 dark:text-slate-100">{u.name || '—'}</p><p className="text-[11px] text-slate-400">{u.email}</p></td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{waktu(u.last_seen)}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{ACTION_LABEL[u.last_action || ''] || u.last_action || '—'}</td>
                  <td className="px-4 py-3 text-right">{u.visits}</td>
                  <td className="px-4 py-3 text-right">{u.orders}</td>
                  <td className="px-4 py-3 text-right">{rupiah(u.spend)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{rupiah(u.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'markup' && summary && <MarkupForm summary={summary} onSaved={(s) => setSummary(s)} />}

      {tab === 'withdraw' && (
        <div className="mt-4">
          <WithdrawPanel />
        </div>
      )}
    </div>
  );
}

function MarkupForm({ summary, onSaved }: { summary: PanelSummary; onSaved: (s: PanelSummary) => void }) {
  const [smm, setSmm] = useState(String(summary.panel.markup_smm_pct));
  const [agent, setAgent] = useState(String(summary.panel.markup_agent_pct));
  const [otp, setOtp] = useState(String(summary.panel.markup_otp_pct ?? 0));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    setSaving(true);
    setMsg(null);
    const r = await panelApi.setMarkup(Number(smm) || 0, Number(agent) || 0, Number(otp) || 0);
    setSaving(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message || 'Gagal menyimpan.' });
    setSmm(String(r.markup_smm_pct));
    setAgent(String(r.markup_agent_pct));
    setOtp(String(r.markup_otp_pct ?? 0));
    onSaved({ ...summary, panel: { ...summary.panel, markup_smm_pct: r.markup_smm_pct ?? 0, markup_agent_pct: r.markup_agent_pct ?? 0, markup_otp_pct: r.markup_otp_pct ?? 0 } });
    setMsg({ ok: true, text: 'Markup tersimpan. Harga di panel langsung mengikuti setelah halaman dimuat ulang.' });
  };
  const inp = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] outline-none focus:border-cyan-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white';
  const ex = (base: number, pct: string) => Math.ceil(base * (1 + (Number(pct) || 0) / 100));
  return (
    <div className="mt-4 max-w-xl rounded-xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">Margin markup harga</p>
      <p className="mt-1 text-[12px] text-slate-500">Persentase ditambahkan ke harga asli Boosteryuk (0–300%). Selisihnya menjadi pendapatan panelmu.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-slate-500">Layanan SMM (%)</span>
          <input className={inp} type="number" min={0} max={300} step={0.5} value={smm} onChange={(e) => setSmm(e.target.value)} />
          <span className="mt-1 block text-[11.5px] text-slate-500">Contoh: harga asli {rupiah(5000)} → {rupiah(ex(5000, smm))}</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-slate-500">Sewa Agen AI (%)</span>
          <input className={inp} type="number" min={0} max={300} step={0.5} value={agent} onChange={(e) => setAgent(e.target.value)} />
          <span className="mt-1 block text-[11.5px] text-slate-500">Contoh: Starter {rupiah(10000)} → {rupiah(ex(10000, agent))}</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-semibold text-slate-500">Order Nomor OTP (%)</span>
          <input className={inp} type="number" min={0} max={300} step={0.5} value={otp} onChange={(e) => setOtp(e.target.value)} />
          <span className="mt-1 block text-[11.5px] text-slate-500">Contoh: {rupiah(3600)} → {rupiah(Math.ceil(ex(3600, otp) / 100) * 100)}</span>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={() => void save()} disabled={saving} aria-busy={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-cyan-700 disabled:opacity-70">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {saving ? 'Menyimpan…' : 'Simpan Markup'}
        </button>
        {msg && (
          <span role="status" className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
            {msg.ok ? <Check className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />} {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
