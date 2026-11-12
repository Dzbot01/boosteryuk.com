import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  AlertCircle,
  Gift,
  LoaderCircle,
  Mail,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  User,
  Wallet,
  XCircle,
} from 'lucide-react';
import Reveal from '../components/Reveal';
import TripayInvoice from '../components/TripayInvoice';
import { QUICK_AMOUNTS, formatRupiah, getDepositBonus } from '../constants';
import { findChannel } from '../data/fallbackChannels';
import { useTripayChannels } from '../hooks/useTripayChannels';
import {
  TripayError,
  getTransactionStatus,
  hmacSha256Hex,
  loadConfig,
  makeMerchantRef,
  createTransactionViaWorker,
  workerCreateCurl,

  type TripayTransaction,
} from '../services/tripay';
import type { SignaturePreview } from '../components/TripaySettings';

const LS_CUSTOMER = 'boosteryuk.deposit.customer.v1';

interface Customer {
  name: string;
  email: string;
  phone: string;
}

const EMPTY_CUSTOMER: Customer = { name: '', email: '', phone: '' };

function loadCustomer(): Customer {
  try {
    const raw = localStorage.getItem(LS_CUSTOMER);
    return raw ? { ...EMPTY_CUSTOMER, ...(JSON.parse(raw) as Partial<Customer>) } : EMPTY_CUSTOMER;
  } catch {
    return EMPTY_CUSTOMER;
  }
}

/* ============================================================
   HALAMAN DETAIL CHANNEL — /deposit/:method  (mis. /deposit/QRIS)
   Tombol Konfirmasi → POST /transaction/create Tripay.
   Info biaya & batas nominal diambil dari channel pembayaran.
   ============================================================ */
export default function DepositMethodPage() {
  const { method } = useParams();

  /* Daftar channel dari API Tripay (dengan fallback) */
  const { channels } = useTripayChannels();
  const channel = useMemo(() => findChannel(channels, method), [channels, method]);

  const [config] = useState(() => loadConfig());
  const [customer, setCustomer] = useState<Customer>(loadCustomer);
  const [amountText, setAmountText] = useState('');
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; kind: string } | null>(null);
  const [transaction, setTransaction] = useState<TripayTransaction | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [curlCommand, setCurlCommand] = useState<string | null>(null);
  const [curlCopied, setCurlCopied] = useState(false);
  const [, setSignaturePreview] = useState<SignaturePreview | null>(null); // nilai hanya di-set, tak dibaca
  const pollingRef = useRef<number | null>(null);

  const amount = Number(amountText) || 0;
  /* Nominal minimum/maksimum dari channel Tripay (fallback 1.000 / 10 juta) */
  const minAmount = channel?.minimum_amount ?? 1000;
  const maxAmount = channel?.maximum_amount ?? 10_000_000;
  /* NB: biaya transaksi TIDAK dihitung di frontend — Tripay yang menghitung
     otomatis lewat worker. amount di bawah = nominal murni dari input user. */
  const bonusRate = getDepositBonus(method ?? '');
  const bonusAmount = Math.floor(amount * bonusRate);
  const estimate = amount + bonusAmount;

  /* Validasi nominal berdasarkan batas channel */
  const amountError = useMemo(() => {
    if (!channel || !amountText) return null;
    if (amount < minAmount) return `Minimal deposit ${formatRupiah(minAmount)}`;
    if (amount > maxAmount) return `Maksimal deposit ${formatRupiah(maxAmount)}`;
    return null;
  }, [amount, amountText, channel, maxAmount, minAmount]);

  /* Validasi data pelanggan — name & email wajib di body Tripay */
  const customerError = useMemo(() => {
    if (!customer.name.trim()) return 'Nama pelanggan wajib diisi';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customer.email.trim())) return 'Format email tidak valid';
    return null;
  }, [customer.email, customer.name]);

  /* Preview signature live: HMAC-SHA256(privateKey, merchant_ref + amount) */
  useEffect(() => {
    let alive = true;
    if (!channel || amount <= 0) {
      setSignaturePreview(null);
      return;
    }
    const merchantRef = makeMerchantRef('DEP');
    hmacSha256Hex(merchantRef + amount, config.privateKey.trim())
      .then((signature) => {
        if (alive) setSignaturePreview({ merchantRef, amount, signature });
      })
      .catch(() => {
        if (alive) setSignaturePreview(null);
      });
    return () => {
      alive = false;
    };
  }, [amount, channel, config.privateKey]);

  /* ------------------------- status polling ------------------------- */
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  /** GET /transaction/status */
  const refreshStatus = useCallback(
    async (withSpinner = true) => {
      if (!transaction) return;
      if (withSpinner) setRefreshing(true);
      try {
        const latest = await getTransactionStatus(transaction.merchant_ref, config);
        setTransaction(latest);
        if (['PAID', 'FAILED', 'EXPIRED', 'REFUND'].includes(latest.status)) stopPolling();
      } catch {
        /* kegagalan polling tidak mengganggu invoice yang sudah tampil */
      } finally {
        if (withSpinner) setRefreshing(false);
      }
    },
    [config, stopPolling, transaction],
  );

  useEffect(() => {
    stopPolling();
    const stillOpen = transaction?.status === 'UNPAID' || transaction?.status === 'PENDING';
    if (!stillOpen) return;
    pollingRef.current = window.setInterval(() => void refreshStatus(false), 15_000);
    return stopPolling;
  }, [refreshStatus, stopPolling, transaction]);

  useEffect(() => stopPolling, [stopPolling]);

  /* --------------------------- submit --------------------------- */
  const canSubmit = !!channel && amount > 0 && !amountError && !customerError && !loading;

  const confirm = async () => {
    if (!canSubmit || !channel) return;

    // ALERT DEBUG - BIAR KELIATAN DI HP
    alert("DEBUG USER ID: " + (user?.id || "KOSONG") + "\nNama: " + (user?.name || "KOSONG") + "\nEmail: " + (user?.email || "KOSONG"));

    if (!user?.id || user.id === 0) {
      alert("ERROR: User ID 0 terbaca! Logout lalu login lagi. user object: " + JSON.stringify(user));
      setError({ message: 'User ID 0 - Logout login lagi', kind: 'auth' });
      return;
    }

    const currentUserId = user.id;

    setLoading(true);
    setError(null);
    setTransaction(null);
    setCurlCommand(null);
    setCurlCopied(false);

    const payloadCustomer: Customer = {
      name: (user.name || customer.name || "User").trim(),
      email: (user.email || customer.email || "user@boosteryuk.com").trim(),
      phone: customer.phone.trim() || "08123456789",
    };
    setCustomer(payloadCustomer);
    try {
      localStorage.setItem(LS_CUSTOMER, JSON.stringify(payloadCustomer));
    } catch {}

    try {
      const merchantRefFinal = `BY-${currentUserId}-${Date.now()}`;
      
      alert("AKAN KIRIM: " + merchantRefFinal + " | user_id: " + currentUserId);

      const input: any = {
        amount,
        method: channel.code,
        merchantRef: merchantRefFinal,
        merchant_ref: merchantRefFinal,
        user_id: currentUserId,
        userId: currentUserId,
        customerName: payloadCustomer.name,
        customer_name: payloadCustomer.name,
        customerEmail: payloadCustomer.email,
        customer_email: payloadCustomer.email,
      };

      setCurlCommand(workerCreateCurl(input));
      const result = await createTransactionViaWorker(input);
      setTransaction(result);
    } catch (err) {
      alert("GAGAL CREATE: " + (err as Error).message);
      if (err instanceof TripayError) {
        setError({ message: err.message, kind: err.kind });
      } else {
        setError({
          message: err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui.',
          kind: 'unknown',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  /* Route tidak dikenal / channel tidak ditemukan → kembali ke daftar */
  if (!method || (!channel && channels.length > 0)) return <Navigate to="/deposit" replace />;

  const inputClass =
    'h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] font-medium text-slate-800 outline-none transition-colors focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10 dark:text-slate-100 dark:bg-slate-900 dark:border-slate-700';

  return (
    <div className="page-align-left mx-auto max-w-2xl px-4 pb-32 pt-8 sm:px-6">

      {/* Judul */}
      <Reveal delay={30}>
        <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900 sm:text-[32px] dark:text-white">
          Deposit {channel?.name ?? method}
        </h1>
        <p className="mt-1.5 text-[13.5px] text-slate-500 dark:text-slate-400">
          {channel ? `${channel.group} · ${channel.name}` : 'Memuat data channel…'}
        </p>
      </Reveal>

      <Reveal delay={60}>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3.5 py-1.5 text-[11.5px] font-bold text-cyan-700 dark:bg-cyan-950/40 dark:border-cyan-800/60">
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />
          {bonusRate > 0
            ? `Bonus deposit aktif — ${Math.round(bonusRate * 100)}% tiap top-up`
            : 'Deposit biasa — tanpa bonus'}
        </div>
      </Reveal>

      {/* ======================================================
          MODAL CARD UTAMA — form nominal deposit
         ====================================================== */}
      <Reveal delay={90}>
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_16px_44px_-28px_rgba(15,23,42,.35)] sm:p-5 dark:bg-slate-900 dark:border-slate-700">
          {/* Header kartu */}
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white p-1.5 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
              {channel?.icon_url ? (
                <img src={channel.icon_url} alt={channel.code} className="h-full w-full object-contain" />
              ) : (
                <QrCode className="h-6 w-6 text-cyan-600" strokeWidth={2.2} />
              )}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-extrabold text-slate-900 dark:text-white">{channel?.name ?? method}</p>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                Channel <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{method}</span> · Min{' '}
                {formatRupiah(minAmount)} · Maks {formatRupiah(maxAmount)}
              </p>
            </div>
          </div>

          <div className="my-4 h-px w-full bg-slate-200" />

          {/* MODAL BUTTON — nominal cepat */}
          <p className="mb-2 text-[12px] font-semibold text-slate-500 dark:text-slate-400">Pilih nominal cepat</p>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_AMOUNTS.map((value) => {
              const active = amount === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setAmountText(String(value));
                    setError(null);
                  }}
                  className={`h-12 rounded-xl border text-[13px] font-extrabold transition-all active:scale-95 ${
                    active
                      ? 'border-cyan-400 bg-cyan-50 text-cyan-700 shadow-[0_10px_24px_-16px_rgba(72,198,229,1)] dark:bg-cyan-950/40'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/40 dark:text-slate-200 dark:bg-slate-900 dark:border-slate-700'
                  }`}
                >
                  Rp. {value.toLocaleString('id-ID')}
                </button>
              );
            })}
          </div>

          {/* INPUT — nominal manual (angka saja) */}
          <label htmlFor="deposit-amount" className="mb-1.5 mt-5 block text-[12px] font-semibold text-slate-500 dark:text-slate-400">
            Nominal deposit
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[13.5px] font-bold text-slate-400 dark:text-slate-400">
              Rp
            </span>
            <input
              id="deposit-amount"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={amountText}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
                setAmountText(digits);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void confirm();
              }}
              placeholder="Masukkan nominal"
              className={`h-12 w-full rounded-xl border bg-white pl-11 pr-3.5 font-mono text-[15px] font-bold text-slate-900 outline-none transition-colors focus:ring-4 dark:text-white dark:bg-slate-900 ${
                amountError
                  ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-500/10'
                  : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-500/10 dark:border-slate-700'
              }`}
            />
          </div>
          {amountError ? (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-rose-600">
              <AlertCircle className="h-3.5 w-3.5" strokeWidth={2.4} />
              {amountError}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-400">
              Hanya angka. Nominal inilah yang dikirim sebagai jumlah deposit.
            </p>
          )}

          {/* 2 KARTU RINGKASAN — Total Bayar & Estimasi Saldo.
              Nominal deposit = persis nilai yang user pilih/ketik
              (tanpa ditambah biaya channel). */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:bg-slate-800/60 dark:border-slate-700">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <Receipt className="h-3.5 w-3.5" strokeWidth={2.4} />
                Total Bayar
              </p>
              <p className="mt-1.5 text-[22px] font-black leading-none tabular-nums text-slate-900 dark:text-white">
                {formatRupiah(amount)}
              </p>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                Belum termasuk biaya transaksi — biaya dihitung otomatis dan muncul di invoice.
              </p>
            </div>

            <div className="rounded-xl border-2 border-cyan-400 bg-cyan-50 p-4 dark:bg-cyan-950/40">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-cyan-700">
                <Wallet className="h-3.5 w-3.5" strokeWidth={2.4} />
                Estimasi Saldo
              </p>
              <p className="mt-1.5 text-[22px] font-black leading-none text-cyan-600">{formatRupiah(estimate)}</p>
              <p className="mt-1.5 flex items-center gap-1 text-[10.5px] font-semibold text-emerald-600">
                <Gift className="h-3 w-3" strokeWidth={2.6} />
                {bonusRate > 0
                  ? `Bonus ${Math.round(bonusRate * 100)}% · +${formatRupiah(bonusAmount)}`
                  : 'Tanpa bonus'}
              </p>
            </div>
          </div>

          <div className="my-4 h-px w-full bg-slate-200" />

          {/* DATA PELANGGAN — isi body request Tripay */}
          <p className="mb-2 text-[12px] font-semibold text-slate-500 dark:text-slate-400">Data pelanggan</p>
          <div className="space-y-2.5">
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500" strokeWidth={2.4} />
              <input
                value={customer.name}
                onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
                placeholder="Nama pelanggan *"
                className={`${inputClass} pl-10`}
              />
            </div>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500" strokeWidth={2.4} />
              <input
                type="email"
                value={customer.email}
                onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
                placeholder="email@domain.com *"
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>
          {customerError && amountText ? (
            <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
              <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2.4} />
              {customerError}
            </p>
          ) : null}

          {/* BUTTON KONFIRMASI → POST /transaction/create */}
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={!canSubmit}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 text-[14px] font-bold text-white shadow-lg shadow-cyan-600/25 transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Membuat invoice…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" strokeWidth={2.4} />
                Konfirmasi
              </>
            )}
          </button>

          <p className="mt-2 text-center text-[10.5px] text-slate-400 dark:text-slate-400">
            Harap lakukan pembayaran sebelum waktu habis.
          </p>
        </div>
      </Reveal>


      {/* MODAL ERROR */}
      {error && (
        <Reveal>
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:bg-rose-950/40 dark:border-rose-800/60">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-md shadow-rose-500/30">
                <XCircle className="h-5 w-5" strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-extrabold text-rose-800">Invoice gagal dibuat</p>
                <p className="mt-1 break-words text-[12px] leading-relaxed text-rose-700">{error.message}</p>
                {error.kind === 'cors' || error.kind === 'network' ? (
                  <p className="mt-2 break-all rounded-lg bg-white/70 px-3 py-2 font-mono text-[10.5px] leading-relaxed text-rose-700 dark:bg-slate-900/70">
                    Request ke worker /create gagal. Pastikan worker aktif, mengizinkan CORS
                    (header Access-Control-Allow-Origin), dan menerima method POST.
                  </p>
                ) : null}

                {/* cURL siap pakai — body & signature identik */}
                {curlCommand ? (
                  <div className="mt-3 rounded-xl bg-slate-900 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-cyan-300">
                        Request siap kirim
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(curlCommand);
                          } catch {
                            /* clipboard ditolak browser */
                          }
                          setCurlCopied(true);
                          window.setTimeout(() => setCurlCopied(false), 1600);
                        }}
                        className={`rounded-md px-2.5 py-1 text-[10.5px] font-extrabold transition-all active:scale-95 ${
                          curlCopied ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        {curlCopied ? 'Tersalin' : 'Salin cURL'}
                      </button>
                    </div>
                    <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-slate-200">
                      {curlCommand}
                    </pre>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Reveal>
      )}

      {/* MODAL INVOICE — hasil sukses create transaction */}
      {transaction && (
        <Reveal>
          <div className="mt-4">
            <TripayInvoice
              transaction={transaction}
              refreshing={refreshing}
              polling={transaction.status === 'UNPAID' || transaction.status === 'PENDING'}
              onRefresh={() => void refreshStatus()}
            />
          </div>
        </Reveal>
      )}
    </div>
  );
}
