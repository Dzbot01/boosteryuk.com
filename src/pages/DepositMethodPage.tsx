import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { LoaderCircle, Receipt, Wallet } from 'lucide-react';
import TripayInvoice from '../components/TripayInvoice';
import { useAuth } from '../context/AuthContext';
import { QUICK_AMOUNTS, formatRupiah } from '../constants';
import { findChannel } from '../data/fallbackChannels';
import { useTripayChannels } from '../hooks/useTripayChannels';
import { DepositError, depositCall, depositLabel, depositPending, type DepositInvoice } from '../services/depositApi';

export default function DepositMethodPage() {
  const { method } = useParams();
  const [search, setSearch] = useSearchParams();
  const selectedRef = search.get('invoice') || '';
  const { user, refresh } = useAuth();
  const { channels, loading: channelsLoading } = useTripayChannels();
  const channel = useMemo(() => findChannel(channels, method), [channels, method]);
  const [invoice, setInvoice] = useState<DepositInvoice | null>(null);
  const [amountText, setAmountText] = useState('');
  const [initializing, setInitializing] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [clockOffset, setClockOffset] = useState(0);
  const amount = Number(amountText) || 0;
  const pending = depositPending(invoice);
  const apply = useCallback((data: Awaited<ReturnType<typeof depositCall>>) => {
    setInvoice(data.invoice || null);
    if (data.server_time) setClockOffset(data.server_time * 1000 - Date.now());
  }, []);
  useEffect(() => {
    let alive = true;
    setInitializing(true);setReady(false);setInvoice(null);setError('');
    depositCall(selectedRef ? 'detail' : 'active', selectedRef ? { merchant_ref: selectedRef } : {})
      .then(data => { if (alive) { apply(data);setReady(true); } })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Gagal memuat invoice.'); })
      .finally(() => { if (alive) setInitializing(false); });
    return () => { alive = false; };
  }, [apply, selectedRef, user?.id]);
  useEffect(() => {
    if (invoice && !selectedRef) setSearch({ invoice: invoice.merchant_ref }, { replace: true });
  }, [invoice, selectedRef, setSearch]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000);return () => clearInterval(timer); }, []);

  const run = useCallback(async (action: 'status' | 'cancel') => {
    if (!invoice || busy) return;
    setBusy(true);setError('');
    try {
      const data = await depositCall(action, { merchant_ref: invoice.merchant_ref });apply(data);
      if (data.invoice?.status === 'PAID') await refresh();
    } catch(e) { setError(e instanceof Error ? e.message : 'Gagal mengecek pembayaran.'); }
    finally { setBusy(false); }
  }, [apply, busy, invoice, refresh]);
  useEffect(() => {
    if (!pending || !invoice?.reference || busy) return;
    const timer = window.setTimeout(() => void run('status'), 15000);
    return () => clearTimeout(timer);
  }, [pending, invoice, busy, run]);

  const min = channel?.minimum_amount ?? 1000;
  const max = channel?.maximum_amount ?? 10000000;
  const valid = Number.isInteger(amount) && amount >= min && amount <= max;
  const create = async () => {
    if (!valid || busy || initializing || !ready || pending || !channel) return;
    setBusy(true);setError('');
    try { apply(await depositCall('create', { amount, method: channel.code })); }
    catch(e) {
      if (e instanceof DepositError && e.invoice) setInvoice(e.invoice);
      else {
        // Recover reserved invoice even when create response was lost. Never auto-retry create.
        try { apply(await depositCall('active')); } catch { /* retain original error */ }
      }
      setError(e instanceof Error ? e.message : 'Gagal membuat invoice. Coba muat ulang untuk memulihkan invoice.');
    } finally { setBusy(false); }
  };
  // This page mounts a fresh channel hook after navigation. An empty list while
  // its Worker request is in flight does not mean the selected method is invalid.
  if (!channel && !selectedRef && channelsLoading) return <p role="status" className="flex items-center gap-2 p-5"><LoaderCircle className="animate-spin" /> Memuat metode pembayaran…</p>;
  if (!channel && !selectedRef) return <Navigate to="/deposit" replace />;
  const seconds = invoice ? Math.max(0, Math.ceil((invoice.cancel_after * 1000 - now - clockOffset) / 1000)) : 0;
  return <div className="mx-auto max-w-3xl space-y-5 pb-10">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold"><Wallet /> Deposit {channel?.name}</h1><p className="mt-2 text-sm text-slate-500">Bonus 3% · Bayar nominal + biaya gateway, bukan nominal + bonus.</p></div>
      <Link to="/riwayat-deposit" className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm"><Receipt size={16} /> Riwayat Deposit</Link>
    </header>
    {initializing && <p role="status" className="flex gap-2"><LoaderCircle className="animate-spin" /> Memulihkan invoice…</p>}
    {error && <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{error}</div>}
    {!initializing && invoice && <>
      <div className="rounded-xl border border-cyan-300 p-4 text-sm">
        <strong>{depositLabel(invoice.status)}</strong><p className="mt-1 break-all">ID: {invoice.merchant_ref}</p>
        <p className="mt-1">Nominal {formatRupiah(invoice.nominal || 0)} + bonus {formatRupiah(invoice.bonus || 0)} = saldo {formatRupiah(invoice.credit)}</p>
        {invoice.status === 'CANCELLED' && <p className="mt-2">Deposit dibatalkan di aplikasi. Jangan bayar QR/kode lama. Jika pembayaran terlanjur berhasil, saldo tetap diproses setelah verifikasi gateway.</p>}
      </div>
      {invoice.transaction ? <TripayInvoice transaction={invoice.transaction} refreshing={busy} onRefresh={() => void run('status')} polling={pending} /> : <div className="rounded-xl border p-5 text-sm"><p>Gateway belum mengembalikan invoice. Reservasi tetap disimpan untuk mencegah pembayaran ganda. Muat ulang atau hubungi admin dengan ID di atas bila tidak kunjung muncul.</p><button disabled={busy} onClick={() => void run('status')} className="mt-3 rounded-lg border px-4 py-2">Cek status</button></div>}
      {pending && <button onClick={() => { if (window.confirm('Batalkan deposit? Jangan membayar QR atau kode lama setelah dibatalkan.')) void run('cancel'); }} disabled={busy || seconds > 0 || !invoice.reference} className="rounded-xl border border-rose-300 px-4 py-3 text-sm font-bold text-rose-500 disabled:opacity-40">{seconds > 0 ? `Batalkan deposit (${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')})` : 'Batalkan deposit'}</button>}
      {!pending && <Link to="/deposit" className="block rounded-xl bg-cyan-600 p-3 text-center font-bold text-white">Buat deposit baru</Link>}
    </>}
    {!initializing && !invoice && <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <label className="block text-sm font-bold" htmlFor="deposit-amount">Nominal deposit</label>
      <input id="deposit-amount" inputMode="numeric" value={amountText} onChange={e => setAmountText(e.target.value.replace(/\D/g, ''))} placeholder="10000" className="w-full rounded-xl border bg-transparent p-3 text-xl" />
      <p className="text-xs text-slate-500">Min. {formatRupiah(min)} · Maks. {formatRupiah(max)}</p>
      <div className="flex flex-wrap gap-2">{QUICK_AMOUNTS.map(value => <button key={value} onClick={() => setAmountText(String(value))} className="rounded-lg border px-3 py-2 text-sm">{formatRupiah(value)}</button>)}</div>
      <dl className="space-y-2 text-sm"><div className="flex justify-between"><dt>Nominal</dt><dd>{formatRupiah(amount)}</dd></div><div className="flex justify-between"><dt>Bonus 3%</dt><dd>+{formatRupiah(Math.floor(amount * 3 / 100))}</dd></div><div className="flex justify-between font-bold"><dt>Saldo setelah sukses</dt><dd>{formatRupiah(amount + Math.floor(amount * 3 / 100))}</dd></div></dl>
      <p className="text-xs text-slate-500">Tagihan final termasuk biaya akan tampil pada invoice. Invoice tersimpan di akun, termasuk setelah refresh. Satu deposit aktif per akun.</p>
      <button disabled={!valid || busy || !ready} onClick={() => void create()} className="w-full rounded-xl bg-cyan-600 p-3 font-bold text-white disabled:opacity-40">{busy ? 'Memproses…' : 'Konfirmasi deposit'}</button>
      {error && <button className="text-sm underline" onClick={() => window.location.reload()}>Muat ulang invoice</button>}
    </section>}
  </div>;
}
