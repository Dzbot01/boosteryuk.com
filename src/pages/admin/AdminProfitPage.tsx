import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Banknote, CircleAlert, Info, Landmark, ReceiptText, TrendingUp, Wallet } from 'lucide-react';
import AdminShell, { adminCard } from './AdminShell';
import { adminDataApi, rupiah, type ProfitData } from '../../services/adminDataApi';

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
      <dd className={strong ? 'font-extrabold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-200'}>{v}</dd>
    </div>
  );
}

function Card({ icon: Icon, tone, label, value, sub, children }: {
  icon: typeof Wallet; tone: string; label: string; value: string | null; sub?: string; children?: React.ReactNode;
}) {
  return (
    <section className={`${adminCard} flex flex-col p-5`} aria-label={label}>
      <div className="flex items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${tone}`}><Icon className="h-5 w-5" /></span>
        <p className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}</p>
      </div>
      {value === null
        ? <span className="mt-4 block h-8 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
        : <p className="mt-4 font-display text-[28px] font-extrabold leading-none text-slate-900 dark:text-white">{value}</p>}
      {sub && <p className="mt-1.5 text-[12px] text-slate-500 dark:text-slate-400">{sub}</p>}
      {children && <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-700/60">{children}</dl>}
    </section>
  );
}

/**
 * My Profit: penghasilan (SMM + Agen AI + Upgrade), transaksi, deposit masuk, saldo provider.
 * Penghasilan = markup SMM (harga jual web utama − harga asli provider) + sewa Agen AI (harga dasar paket)
 *             + Upgrade Boosteryuk Plus & EXTRA (harga penuh). Contoh markup SMM:
 * provider Rp10.000 → dijual Rp12.000 → penghasilan Rp2.000.
 */
export default function AdminProfitPage() {
  const [d, setD] = useState<ProfitData | null>(null);
  const [err, setErr] = useState('');
  const [alert, setAlert] = useState('');
  const [prov, setProv] = useState<{ balance: number | null; msg: string; loading: boolean }>({ balance: null, msg: '', loading: true });

  const load = useCallback(async () => {
    setErr('');
    setProv((p) => ({ ...p, loading: true }));
    const [r, b] = await Promise.all([adminDataApi.profit(), adminDataApi.providerHealth()]);
    if (!r.ok) setErr(r.message || 'Gagal memuat data profit.');
    else setD(r);
    setAlert(b.ok && b.shortfall > 0 ? (b.alert_sent ? 'Email alert saldo kurang dikirim ke boosteryukid@gmail.com.' : 'Saldo provider kurang. Email alert dibatasi tiap 6 jam; periksa konfigurasi Resend jika email belum diterima.') : '');
    setProv({ balance: b.ok ? b.balance : null, msg: b.ok ? '' : b.message || 'Saldo provider tidak bisa dimuat.', loading: false });
  }, []);
  useEffect(() => { void load(); }, [load]);

  const inc = d?.income;
  const est = inc?.estimated.orders ?? 0;
  const smmInc = inc?.smm ?? (inc ? { today: inc.recorded.today + inc.estimated.today, month: inc.recorded.month + inc.estimated.month, all: inc.recorded.all + inc.estimated.all, orders: inc.recorded.orders + inc.estimated.orders } : undefined);
  const agentInc = inc?.agent_ai ?? { today: 0, month: 0, all: 0, orders: 0 };
  const upgradeInc = inc?.upgrade ?? { today: 0, month: 0, all: 0, orders: 0 };
  const dep = d?.deposits;
  const trx = d?.transactions;

  return (
    <AdminShell title="My Profit" desc="Penghasilan dari SMM (markup), sewa Agen AI, dan paket Upgrade — transaksi, deposit masuk, dan saldo provider." loading={!d && !err} onRefresh={() => void load()}>
      {err && <p role="alert" className="mt-5 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700 dark:bg-rose-950/40"><CircleAlert className="h-4 w-4" /> {err}</p>}

      {alert && <p role="status" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">{alert}</p>}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card icon={TrendingUp} tone="bg-emerald-600" label="Penghasilan" value={inc ? rupiah(inc.month) : null} sub="SMM (markup) + Agen AI + Upgrade bulan ini">
          {inc && smmInc && (
            <>
              <Row k="Hari ini" v={rupiah(inc.today)} />
              <Row k="Bulan ini" v={rupiah(inc.month)} />
              <Row k="Total" v={rupiah(inc.all)} strong />
              <Row k="· dari Markup SMM (bulan ini)" v={rupiah(smmInc.month)} />
              <Row k="· dari Sewa Agen AI (bulan ini)" v={rupiah(agentInc.month)} />
              <Row k="· dari Upgrade Plus & EXTRA (bulan ini)" v={rupiah(upgradeInc.month)} />
              <Row k="Markup SMM tercatat" v={`${inc.recorded.orders} pesanan · ${rupiah(inc.recorded.all)}`} />
              {est > 0 && <Row k="Estimasi pesanan lama" v={`${est} pesanan · ${rupiah(inc.estimated.all)}`} />}
              <Row k="Agen AI (total)" v={`${agentInc.orders} pesanan · ${rupiah(agentInc.all)}`} />
              <Row k="Upgrade Plus & EXTRA (total)" v={`${upgradeInc.orders} pesanan · ${rupiah(upgradeInc.all)}`} />
            </>
          )}
        </Card>

        <Card icon={ReceiptText} tone="bg-cyan-600" label="Data transaksi" value={trx ? rupiah(trx.month.omzet) : null} sub={trx ? `${trx.month.n} transaksi bulan ini (tanpa yang batal)` : undefined}>
          {trx && (
            <>
              <Row k="Hari ini" v={`${trx.today.n} · ${rupiah(trx.today.omzet)}`} />
              <Row k="Layanan SMM (total)" v={`${trx.smm.n} · ${rupiah(trx.smm.omzet)}`} />
              <Row k="Agen AI, NexSpace, OTP, Upgrade" v={`${trx.lain.n} · ${rupiah(trx.lain.omzet)}`} />
              <Row k="Dibatalkan" v={`${trx.batal} pesanan`} />
              <div className="pt-1"><Link to="/admin/orders" className="inline-flex items-center gap-1 text-[12px] font-bold text-cyan-700 hover:underline dark:text-cyan-400">Lihat Data Pesanan <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
            </>
          )}
        </Card>

        <Card icon={Banknote} tone="bg-violet-600" label="Deposit masuk" value={dep ? rupiah(dep.month + (dep.manual?.month || 0)) : null} sub="Bulan ini (gateway + top up manual admin)">
          {dep && (
            <>
              <Row k="Hari ini" v={rupiah(dep.today + (dep.manual?.today || 0))} />
              <Row k="Gateway bulan ini" v={`${dep.count_month} deposit · ${rupiah(dep.month)}`} />
              {dep.manual && <Row k="Manual admin bulan ini" v={rupiah(dep.manual.month)} />}
              <Row k="Total semua" v={rupiah(dep.all + (dep.manual?.all || 0))} strong />
              <div className="pt-1"><Link to="/admin/deposit" className="inline-flex items-center gap-1 text-[12px] font-bold text-cyan-700 hover:underline dark:text-cyan-400">Lihat Data Deposit <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
            </>
          )}
        </Card>

        <Card icon={Landmark} tone="bg-slate-800" label="Saldo provider" value={prov.loading ? null : prov.balance === null ? '—' : rupiah(prov.balance)} sub={prov.msg || 'Saldo akun provider layanan SMM (realtime)'}>
          {d && (
            <>
              <Row k="Total saldo semua user" v={rupiah(d.users.balance)} />
              <Row k="Jumlah user" v={d.users.total.toLocaleString('id-ID')} />
              {prov.balance !== null && (
                <Row k="Selisih saldo provider − saldo user" v={rupiah(prov.balance - d.users.balance)} strong />
              )}
            </>
          )}
        </Card>
      </div>

      <p className="mt-5 flex gap-2 rounded-xl bg-slate-100 px-4 py-3 text-[12px] leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Penghasilan = <b>markup SMM</b> (harga jual web − harga asli provider, mis. provider Rp10.000 dijual Rp12.000 → Rp2.000)
          + <b>sewa Agen AI</b> (harga dasar paket per bulan × durasi)
          + <b>Upgrade Plus &amp; EXTRA</b> (harga penuh paket).
          Pesanan batal tidak dihitung. Markup child panel adalah milik pemilik panel dan tidak termasuk di sini.
          {est > 0 && ' Pesanan lama sebelum pencatatan otomatis diperkirakan dengan markup tetap Rp4.425 per 1.000.'}
        </span>
      </p>
    </AdminShell>
  );
}
