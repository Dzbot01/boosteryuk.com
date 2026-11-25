import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, CircleAlert, Database, History, Loader2, Play, Trash2 } from 'lucide-react';
import AdminShell, { adminCard } from './AdminShell';
import { dataRetentionApi, type RetentionKind, type RetentionSchedule, type RetentionStatus } from '../../services/dataRetentionApi';

const waktu = (s?: string | null) => (s ? new Date(s.replace(' ', 'T')).toLocaleString('id-ID') : '—');
const epochWib = (n?: number) => (n ? `${new Date(n * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB` : '—');
const angka = (n: number) => new Intl.NumberFormat('id-ID').format(n || 0);

const KINDS: RetentionKind[] = ['yearly', 'monthly'];
const KIND_LABEL: Record<RetentionKind, string> = { yearly: 'Setiap tahun', monthly: 'Setiap 1 bulan' };
const KIND_ICON: Record<RetentionKind, typeof Database> = { yearly: CalendarClock, monthly: Trash2 };
const KIND_TONE: Record<RetentionKind, string> = { yearly: 'bg-cyan-600', monthly: 'bg-rose-600' };

/** Kartu satu jadwal pembersihan: status periode, target tabel, dan tombol jalankan manual. */
function ScheduleCard({ kind, s, busyKind, onRun }: {
  kind: RetentionKind; s: RetentionSchedule; busyKind: '' | RetentionKind; onRun: (kind: RetentionKind) => void;
}) {
  const Icon = KIND_ICON[kind];
  const pending = s.targets.reduce((n, t) => n + (t.pending || 0), 0);
  return (
    <section className={`${adminCard} p-5`} aria-label={`Pembersihan ${KIND_LABEL[kind]}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${KIND_TONE[kind]}`}><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[16px] font-extrabold tracking-tight text-slate-900 dark:text-white">{KIND_LABEL[kind]}</h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">{s.keeps}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${s.done_this_period ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
          {s.done_this_period ? 'Periode ini sudah dibersihkan' : 'Menunggu giliran'}
        </span>
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-[12.5px] dark:border-slate-700/60">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-500 dark:text-slate-400">Periode berjalan</dt>
          <dd className="font-semibold text-slate-700 dark:text-slate-200">{s.period_key}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-500 dark:text-slate-400">Otomatis berikutnya</dt>
          <dd className="font-semibold text-slate-700 dark:text-slate-200">{epochWib(s.next_run_at)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-500 dark:text-slate-400">Pembersihan terakhir</dt>
          <dd className="text-right font-semibold text-slate-700 dark:text-slate-200">
            {s.last_run ? `${waktu(s.last_run.ran_at)} · ${angka(s.last_run.deleted_total)} baris` : 'Belum pernah'}
            {s.last_run && <span className="block text-[11px] font-medium text-slate-400">{s.last_run.triggered_by === 'admin' ? 'Dijalankan admin' : 'Otomatis'}</span>}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-slate-500 dark:text-slate-400">Baris yang akan dihapus sekarang</dt>
          <dd className="font-extrabold text-slate-900 dark:text-white">{angka(pending)}</dd>
        </div>
      </dl>

      <ul className="mt-3 space-y-1.5">
        {s.targets.map((t) => (
          <li key={t.table} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900/40">
            <span className="min-w-0">
              <span className="block truncate text-[12px] font-semibold text-slate-700 dark:text-slate-200">{t.label}</span>
              <span className="block font-mono text-[10.5px] text-slate-400">{t.table}{t.exists ? '' : ' · tabel tidak ada'}</span>
            </span>
            <span className="shrink-0 rounded-md bg-white px-2 py-0.5 font-mono text-[11.5px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {t.pending === null ? '—' : angka(t.pending)}
            </span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onRun(kind)}
        disabled={!!busyKind}
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-[13px] font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
      >
        {busyKind === kind ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" strokeWidth={2.4} />}
        Jalankan pembersihan sekarang
      </button>
    </section>
  );

}

/**
 * Pengaturan Database — pembersihan rutin riwayat user tanpa cron.
 *  • Tahunan : SEMUA riwayat order & deposit yang lebih tua dari 1 tahun dihapus.
 *  • Bulanan : data order/deposit GAGAL (batal, OTP batal/gagal, deposit tidak terbayar,
 *              invoice gateway CANCELLED/FAILED/EXPIRED/REFUND) yang lebih tua dari 1 bulan dihapus.
 * Jadwal dipicu otomatis saat admin membuka halaman data (admin_data.php → dr_maybe_run),
 * dan tiap periode hanya dieksekusi sekali karena dicatat di tabel data_retention_log.
 */
export default function AdminDatabasePage() {
  const [status, setStatus] = useState<RetentionStatus | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'' | RetentionKind>('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    const r = await dataRetentionApi.status();
    setLoading(false);
    if (!r.ok || !r.status) return setErr(r.message || 'Gagal memuat pengaturan pembersihan data.');
    setStatus(r.status);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (kind: RetentionKind) => {
    if (busy) return;
    const what = kind === 'yearly'
      ? 'SEMUA riwayat order & deposit yang lebih tua dari 1 tahun'
      : 'data order/deposit GAGAL yang lebih tua dari 1 bulan';
    if (!window.confirm(`Jalankan pembersihan sekarang?\n\nYang dihapus: ${what}.\nData yang sudah terhapus tidak bisa dikembalikan — pastikan backup database terbaru sudah ada.`)) return;
    setBusy(kind);
    setMsg('');
    setErr('');
    const r = await dataRetentionApi.run(kind);
    setBusy('');
    if (!r.ok || !r.status) return setErr(r.message || 'Pembersihan gagal dijalankan.');
    setStatus(r.status);
    setMsg(`${KIND_LABEL[kind]}: ${angka(r.result?.deleted_total ?? 0)} baris dihapus.`);
  };

  return (
    <AdminShell
      title="Pengaturan Database"
      desc="Pembersihan rutin data riwayat user: semua riwayat order & deposit dihapus setiap tahun, dan data order/deposit yang gagal dihapus setiap 1 bulan. Berjalan otomatis tanpa cron."
      loading={loading}
      onRefresh={() => void load()}
    >
      {err && (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[12.5px] font-semibold text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {err}
        </p>
      )}
      {msg && (
        <p role="status" className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-[12.5px] font-semibold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {msg}
        </p>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {!status
          ? KINDS.map((k) => <span key={k} className="h-72 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-700" />)
          : KINDS.map((k) => <ScheduleCard key={k} kind={k} s={status.schedules[k]} busyKind={busy} onRun={(kind) => void run(kind)} />)}
      </div>

      <section className={`${adminCard} mt-4 p-5`} aria-label="Riwayat pembersihan">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-cyan-600 dark:text-cyan-400" strokeWidth={2.2} />
          <h2 className="font-display text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">Riwayat pembersihan</h2>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-left text-[12px]">
            <caption className="sr-only">Daftar pembersihan data yang sudah dijalankan</caption>
            <thead>
              <tr className="text-slate-500 dark:text-slate-400">
                {['Waktu', 'Jadwal', 'Periode', 'Pemicu', 'Baris terhapus', 'Rincian'].map((h) => (
                  <th key={h} scope="col" className="border-b border-slate-100 px-2 py-2 text-[10.5px] font-bold uppercase tracking-wide dark:border-slate-700/60">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(status?.history || []).map((h, i) => (
                <tr key={`${h.ran_at}-${i}`} className="align-top">
                  <td className="border-b border-slate-100 px-2 py-2 whitespace-nowrap text-slate-600 dark:border-slate-700/60 dark:text-slate-300">{waktu(h.ran_at)}</td>
                  <td className="border-b border-slate-100 px-2 py-2 font-semibold text-slate-700 dark:border-slate-700/60 dark:text-slate-200">{h.kind ? KIND_LABEL[h.kind] : '—'}</td>
                  <td className="border-b border-slate-100 px-2 py-2 font-mono text-slate-500 dark:border-slate-700/60 dark:text-slate-400">{h.period_key}</td>
                  <td className="border-b border-slate-100 px-2 py-2 text-slate-500 dark:border-slate-700/60 dark:text-slate-400">{h.triggered_by === 'admin' ? 'Manual (admin)' : 'Otomatis'}</td>
                  <td className="border-b border-slate-100 px-2 py-2 font-bold text-slate-900 dark:border-slate-700/60 dark:text-white">{angka(h.deleted_total)}</td>
                  <td className="border-b border-slate-100 px-2 py-2 text-slate-500 dark:border-slate-700/60 dark:text-slate-400">
                    {Object.keys(h.deleted || {}).length
                      ? Object.entries(h.deleted).map(([t, n]) => `${t}: ${angka(n)}`).join(' · ')
                      : '—'}
                  </td>
                </tr>
              ))}
              {!status?.history?.length && (
                <tr><td colSpan={6} className="px-2 py-3 text-slate-400">Belum ada pembersihan yang tercatat.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${adminCard} mt-4 p-5`} aria-label="Cara kerja pembersihan data">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-cyan-600 dark:text-cyan-400" strokeWidth={2.2} />
          <h2 className="font-display text-[15px] font-extrabold tracking-tight text-slate-900 dark:text-white">Cara kerja</h2>
        </div>
        <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
          <li>Tanpa cron: jadwal dicek otomatis setiap admin membuka <b>Data Pesanan</b>, <b>Data Deposit</b>, atau <b>My Profit</b> (<span className="font-mono">admin_data.php</span> → <span className="font-mono">dr_maybe_run()</span>).</li>
          <li>Satu periode hanya dibersihkan sekali — dicatat di tabel <span className="font-mono">data_retention_log</span> (UNIQUE <span className="font-mono">kind</span> + <span className="font-mono">period_key</span>), jadi aman walau dua tab admin terbuka bersamaan.</li>
          <li>Tabel yang dibersihkan: <span className="font-mono">riwayat_pesanan</span>, <span className="font-mono">otp_orders</span>, <span className="font-mono">deposits</span>, <span className="font-mono">deposit_invoices</span>. Penghapusan dilakukan bertahap (LIMIT 2000 per putaran) agar tidak mengunci tabel lama.</li>
          <li>Tidak disentuh: pendapatan child panel, markup SMM, log saldo admin, receipt Daily Streak, dan data akun user — hanya riwayat pesanan & deposit.</li>
          <li>Saldo user TIDAK berubah: pembersihan hanya menghapus baris riwayat, bukan memotong/menambah uang.</li>
        </ul>
      </section>
    </AdminShell>
  );
}
