import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { formatRupiah } from '../constants';
import { qrImageUrl, type TripayTransaction } from '../services/tripay';

/**
 * =============================================================
 *  INVOICE TRIPAY — tampilan kartu invoice resmi
 * -------------------------------------------------------------
 *  Menampilkan hasil POST /create:
 *  • bar status + countdown kadaluarsa
 *  • blok pembayaran (QRIS / kode bayar) + tombol salin
 *  • ringkasan nominal dengan angka tabular
 *  • instruksi per bank/e-wallet (accordion)
 * ============================================================= */

const STATUS_STYLE: Record<string, { label: string; wrap: string; dot: string }> = {
  UNPAID: { label: 'Menunggu pembayaran', wrap: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40', dot: 'bg-amber-500' },
  PENDING: { label: 'Diproses', wrap: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40', dot: 'bg-sky-500' },
  PAID: { label: 'Lunas', wrap: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40', dot: 'bg-emerald-500' },
  FAILED: { label: 'Gagal', wrap: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-950/40', dot: 'bg-rose-500' },
  EXPIRED: { label: 'Kedaluwarsa', wrap: 'bg-slate-100 text-slate-600 ring-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:ring-slate-700', dot: 'bg-slate-400' },
  REFUND: { label: 'Refund', wrap: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
};

/** Hitung sisa waktu dari unix timestamp (detik). */
function remaining(expiredTime: number): { text: string; done: boolean } {
  const diff = expiredTime * 1000 - Date.now();
  if (diff <= 0) return { text: '00:00:00', done: true };
  const total = Math.floor(diff / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    text: `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`,
    done: false,
  };
}

/** Instruksi Tripay memuat tag <b> — dirender aman tanpa dangerouslySetInnerHTML. */
function StepText({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/<\/?b>/i), [text]);
  return (
    <span>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <b key={index} className="font-bold text-slate-900 dark:text-white">
            {part}
          </b>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </span>
  );
}

/** Tombol salin kecil. */
function CopyButton({
  value,
  label,
  block = false,
}: {
  value: string;
  label: string;
  block?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* clipboard ditolak browser */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex items-center gap-1.5 rounded-lg font-bold transition-all active:scale-95 ${
        block ? 'h-9 w-full justify-center text-[12px]' : 'px-2.5 py-1 text-[11px]'
      } ${copied ? 'bg-emerald-500 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
    >
      {copied ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Copy className="h-3.5 w-3.5" strokeWidth={2.4} />}
      {copied ? 'Tersalin' : label}
    </button>
  );
}

/** Satu baris ringkasan: label kiri, nilai kanan (angka tabular). */
function AmountRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-[12px] text-slate-500 dark:text-slate-400">{label}</span>
      <span
        className={`font-mono text-[12.5px] font-bold tabular-nums ${accent ? 'text-cyan-600' : 'text-slate-900 dark:text-white'}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function TripayInvoice({
  transaction,
  refreshing,
  onRefresh,
  polling,
}: {
  transaction: TripayTransaction;
  refreshing: boolean;
  onRefresh: () => void;
  polling: boolean;
}) {
  const [, setTick] = useState(0);
  const status = STATUS_STYLE[transaction.status] ?? STATUS_STYLE.UNPAID;
  const isPaid = transaction.status === 'PAID';
  const terminal = ['FAILED', 'EXPIRED', 'REFUND'].includes(transaction.status);

  const qrSource = transaction.qr_url || (transaction.qr_string ? qrImageUrl(transaction.qr_string) : null);
  const checkoutUrl = transaction.pay_url || transaction.checkout_url || '';

  /* Semua angka diambil dari respon Tripay:
     - total_due  = data.amount        → total yang harus dibayar user
     - fee        = data.fee_customer  → biaya transaksi
     - deposit    = nominal murni user (amount - fee_customer)
     - saldo      = deposit murni yang masuk ke akun */
  const totalDue = transaction.total_due ?? transaction.amount;
  const feeCustomer = transaction.fee_customer ?? 0;
  const depositAmount = transaction.deposit_amount ?? Math.max(0, totalDue - feeCustomer);
  const saldoMasuk = transaction.saldo_masuk ?? depositAmount;

  /* Detak countdown setiap detik */
  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const time = remaining(transaction.expired_time);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-34px_rgba(15,23,42,0.55)] dark:bg-slate-900 dark:border-slate-700">
      {/* ---------- HEADER INVOICE ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400">
            <BadgeCheck className="h-3.5 w-3.5 text-cyan-500" strokeWidth={2.6} />
            Invoice pembayaran
          </p>
          <p className="mt-1 break-all font-mono text-[15px] font-black tracking-tight text-slate-900 dark:text-white">
            {transaction.merchant_ref}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{transaction.payment_name || transaction.payment_method}</span>
            <span className="text-slate-300">·</span>
            <span className="font-mono text-slate-400 dark:text-slate-400">{transaction.reference}</span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold ring-1 ${status.wrap}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot} ${isPaid ? '' : 'animate-pulse-dot'}`} />
            {status.label}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Cek status terbaru"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10.5px] font-bold text-slate-500 transition-colors hover:border-cyan-300 hover:text-cyan-600 active:scale-95 disabled:opacity-50 dark:text-slate-400 dark:border-slate-700"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={2.6} />
            {refreshing ? 'Menyinkronkan' : 'Cek status'}
          </button>
        </div>
      </div>

      {/* ---------- COUNTDOWN ---------- */}
      {!isPaid && (
        <div className="px-5 pt-4">
          <div
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 ring-1 ${
              time.done ? 'bg-rose-50 ring-rose-200 dark:bg-rose-950/40' : 'bg-slate-50 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700'
            }`}
          >
            <Clock3 className={`h-4 w-4 shrink-0 ${time.done ? 'text-rose-500' : 'text-cyan-500'}`} strokeWidth={2.4} />
            <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">
              {time.done ? 'Waktu pembayaran habis' : 'Bayar sebelum'}
            </span>
            {!time.done && (
              <span className="ml-auto font-mono text-[17px] font-black tabular-nums tracking-tight text-slate-900 dark:text-white">
                {time.text}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ---------- ISI INVOICE ---------- */}
      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        {/* BLOK PEMBAYARAN */}
        <div>
          {qrSource ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:bg-slate-900 dark:border-slate-700">
              <div className="mx-auto w-fit rounded-lg bg-slate-50 p-2 ring-1 ring-slate-100 dark:bg-slate-800/60 dark:ring-slate-800">
                <img
                  src={qrSource}
                  alt="QR pembayaran"
                  className="h-44 w-44 rounded-md object-contain"
                />
              </div>
              <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                <QrCode className="h-3.5 w-3.5 text-cyan-500" strokeWidth={2.4} />
                Scan QRIS · e-wallet / m-banking
              </p>
            </div>
          ) : transaction.pay_code ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center dark:bg-slate-800/60 dark:border-slate-700">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-400">Kode Bayar</p>
              <p className="mt-2 break-all font-mono text-[17px] font-black leading-tight text-slate-900 dark:text-white">
                {transaction.pay_code}
              </p>
              <div className="mt-3">
                <CopyButton value={transaction.pay_code} label="Salin kode bayar" block />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center dark:bg-slate-800/60 dark:border-slate-600">
              <p className="text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                Tidak ada QR/kode bayar. Buka halaman pembayaran untuk menyelesaikan transaksi.
              </p>
            </div>
          )}

          {/* Salin referensi */}
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
            <span className="min-w-0 truncate text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
              Ref · <span className="font-mono text-slate-700 dark:text-slate-200">{transaction.reference}</span>
            </span>
            <CopyButton value={transaction.reference} label="Salin" />
          </div>
        </div>

        {/* BLOK NOMINAL + AKSI */}
        <div className="min-w-0">
          <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 px-4 py-3.5">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-300">Total tagihan</p>
            <p className="mt-1 font-mono text-[28px] font-black leading-none tabular-nums text-white">
              {formatRupiah(totalDue)}
            </p>
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-400">
              {formatRupiah(transaction.amount)} nominal deposit
              {(transaction.fee_customer || 0) > 0 && ` + ${formatRupiah(transaction.fee_customer)} biaya transaksi`}
            </p>
          </div>

          <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4 py-1 dark:border-slate-700 dark:divide-slate-800">
            <AmountRow label="Nominal deposit" value={formatRupiah(depositAmount)} />
            <AmountRow label="Biaya transaksi" value={formatRupiah(feeCustomer)} />
            <AmountRow label="Total tagihan" value={formatRupiah(totalDue)} />
            <AmountRow label="Biaya merchant" value={formatRupiah(transaction.fee_merchant)} />
            <AmountRow label="Saldo masuk" value={formatRupiah(saldoMasuk)} accent />
          </div>

          {checkoutUrl ? (
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 text-[13px] font-bold text-white shadow-lg shadow-cyan-600/25 transition-all hover:opacity-90 active:scale-[0.99]"
            >
              <ExternalLink className="h-4 w-4" strokeWidth={2.4} />
              {isPaid ? 'Buka halaman pembayaran' : 'Bayar sekarang'}
            </a>
          ) : null}

          {isPaid && (
            <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[11.5px] font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40">
              <ShieldCheck className="h-4 w-4" strokeWidth={2.4} />
              Pembayaran terverifikasi — saldo sedang diproses.
            </p>
          )}

          <p className="mt-2.5 flex items-center gap-1.5 text-[10.5px] font-medium text-slate-400 dark:text-slate-400">
            {polling ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Status diperbarui otomatis tiap 15 detik
              </>
            ) : terminal ? (
              <>
                <XCircle className="h-3 w-3" />
                Pembaruan otomatis dihentikan
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" />
                Pembaruan otomatis tidak aktif
              </>
            )}
          </p>
        </div>
      </div>

      {/* ---------- INSTRUKSI PEMBAYARAN ---------- */}
      {(transaction.instructions?.length ?? 0) > 0 && (
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <p className="mb-2.5 text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Instruksi pembayaran
          </p>
          <div className="space-y-2">
            {transaction.instructions.map((group, groupIndex) => (
              <details
                key={group.title}
                open={groupIndex === 0}
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition-colors open:border-slate-300 dark:bg-slate-900 dark:border-slate-700"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-[12.5px] font-extrabold text-slate-800 transition-colors hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800">
                  {group.title}
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180 dark:text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.6}
                    aria-hidden
                  >
                    <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <ol className="space-y-2.5 border-t border-slate-100 bg-slate-50/70 px-3.5 py-3 dark:border-slate-800">
                  {group.steps.map((step, index) => (
                    <li key={index} className="flex gap-2.5 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                      <span className="mt-0.5 flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-md bg-slate-900 px-1 text-[9.5px] font-black text-white">
                        {index + 1}
                      </span>
                      <span>
                        <StepText text={step} />
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
