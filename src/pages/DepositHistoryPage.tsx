import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import EmptyStateModel from '../components/EmptyStateModel';
import { formatRupiah } from '../constants';
import { depositCall, depositLabel, depositPending, type DepositInvoice } from '../services/depositApi';

export default function DepositHistoryPage() {
  const [rows, setRows] = useState<DepositInvoice[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;setLoading(true);setError('');
    depositCall('list', { page }).then(data => {
      if (alive) { setRows(data.rows || []);setHasMore(!!data.has_more); }
    }).catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Gagal memuat riwayat.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [page, reload]);
  useEffect(() => {
    const reloadVisible = () => { if (document.visibilityState === 'visible') setReload(n => n + 1); };
    window.addEventListener('focus', reloadVisible);document.addEventListener('visibilitychange', reloadVisible);
    const timer = rows.some(depositPending) ? window.setInterval(reloadVisible, 15000) : null;
    const deadlines = rows.filter(depositPending).map(row => row.transaction?.expired_time || 0).filter(time => time * 1000 > Date.now());
    const expiry = deadlines.length ? window.setTimeout(reloadVisible, Math.min(2147483647, Math.max(250, Math.min(...deadlines) * 1000 - Date.now() + 250))) : null;
    return () => { window.removeEventListener('focus', reloadVisible);document.removeEventListener('visibilitychange', reloadVisible);if (timer !== null) clearInterval(timer);if (expiry !== null) clearTimeout(expiry); };
  }, [rows]);
  return <div className="page-align-left mx-auto w-full min-w-0 max-w-3xl space-y-5 px-4 py-10 sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-bold"><History /> Riwayat Deposit</h1><p className="mt-2 text-sm text-slate-500">Buka detail untuk QR, instruksi pembayaran, cek status langsung, atau pembatalan setelah 10 menit.</p></div><Link to="/deposit" className="rounded-xl bg-cyan-600 px-4 py-2 font-bold text-white">Deposit baru</Link></header>
    <button onClick={() => setReload(n => n + 1)} disabled={loading} className="rounded-xl border px-4 py-2 text-sm disabled:opacity-40">Muat ulang riwayat</button>
    {error && <p role="alert" className="text-sm text-rose-500">{error}</p>}
    <div className="w-full min-w-0 overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"><table className={`w-full text-left text-xs ${loading || rows.length ? 'min-w-[900px]' : ''}`}>{/* Kepala tabel disembunyikan saat riwayat kosong agar model 3D tampil sebagai isi card. */}
      {(loading || rows.length > 0) && <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr>{['Tanggal / ID', 'Metode / Referensi', 'Nominal', 'Bonus', 'Biaya', 'Total bayar', 'Saldo masuk', 'Status', 'Aksi'].map(h => <th key={h} className="whitespace-nowrap px-3 py-3">{h}</th>)}</tr></thead>}<tbody>
      {!loading && !error && rows.length === 0 && <tr><td colSpan={9} className="p-2"><EmptyStateModel text="Belum ada riwayat deposit" sub="Deposit yang kamu buat akan tampil di sini lengkap dengan status dan nominalnya." fallbackIcon={History} ariaLabel="Riwayat deposit kosong" /></td></tr>}
      {loading ? <tr><td colSpan={9} className="p-8 text-center">Memuat riwayat…</td></tr> : !error && rows.map(row => <tr key={row.merchant_ref} className="border-t border-slate-100 dark:border-slate-800">
        <td className="px-3 py-3"><span className="block whitespace-nowrap">{new Date(row.created_time * 1000).toLocaleString('id-ID')}</span><span className="text-xs text-slate-500">{row.merchant_ref}</span>{row.paid_at && <span className="block text-xs text-emerald-600">Dibayar: {row.paid_at}</span>}{row.cancelled_at && <span className="block text-xs text-rose-500">Dibatalkan: {row.cancelled_at}</span>}</td>
        <td className="px-3 py-3">{row.method || '—'}<span className="block text-xs text-slate-500">{row.reference || '—'}</span></td>
        <td className="whitespace-nowrap px-3 py-3">{row.nominal === null ? '—' : formatRupiah(row.nominal)}</td><td className="whitespace-nowrap px-3 py-3">{row.bonus === null ? '—' : formatRupiah(row.bonus)}</td>
        <td className="whitespace-nowrap px-3 py-3">{row.transaction ? formatRupiah(row.transaction.fee_customer) : '—'}</td><td className="whitespace-nowrap px-3 py-3">{row.transaction ? formatRupiah(row.transaction.total_due) : '—'}</td>
        <td className="whitespace-nowrap p-4 font-bold">{formatRupiah(row.credit)}{row.status !== 'PAID' && <span className="block text-xs font-normal text-slate-500">Belum dikreditkan</span>}</td>
        <td className="px-3 py-3"><span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${row.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : ['CREATING', 'UNPAID', 'PENDING'].includes(row.status) ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{depositLabel(row.status)}</span></td>
        <td className="px-3 py-3">{row.cancel_after > 0 ? <Link className="font-bold text-cyan-600" to={`/deposit/${encodeURIComponent(row.method)}?invoice=${encodeURIComponent(row.merchant_ref)}`}>Detail</Link> : <span className="text-xs text-slate-500">Riwayat lama</span>}</td>
      </tr>)}
    </tbody></table></div>
    <p className="text-xs text-slate-500">Riwayat lama hanya menampilkan data yang tersimpan; nominal, bonus, atau biaya yang tidak tercatat ditandai —. Invoice yang melewati batas pembayaran otomatis ditandai kedaluwarsa saat riwayat dimuat, dan diperbarui berkala selama masih menunggu. Buka Detail → Cek status untuk status langsung.</p>
    <div className="flex items-center gap-4"><button disabled={page === 1 || loading} onClick={() => setPage(n => n - 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Sebelumnya</button><span className="text-sm">Halaman {page}</span><button disabled={!hasMore || loading} onClick={() => setPage(n => n + 1)} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Berikutnya</button></div>
  </div>;
}
