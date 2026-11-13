import { BadgeCheck, XCircle } from 'lucide-react';
import type { Struk } from '../services/strukStore';
import { useSiteSettings } from '../context/SiteSettingsContext';

export default function StrukCard({ struk }: { struk: Struk }) {
  // Logo mengikuti pengaturan (child panel / admin), bukan logo Boosteryuk bawaan.
  const logoUrl = useSiteSettings().settings.logoUrl;
  const rows = [
    { label: 'Id Pesanan', value: struk.ok ? struk.orderId : '' },
    { label: 'Layanan', value: struk.ok ? struk.layanan : '' },
    { label: 'Target', value: struk.ok ? struk.target : '' },
    { label: 'Jumlah', value: struk.ok ? struk.jumlah : '' },
    { label: 'Tanggal', value: struk.ok ? struk.tanggal : '' },
  ];

  return (
    <div
      id="struk-print"
      className="relative w-full overflow-hidden rounded-lg bg-white text-slate-900 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.35)] dark:text-white dark:bg-slate-900"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.25] mix-blend-multiply">
        <div
          className="absolute -inset-[60%] -rotate-[30deg]"
          style={{
            backgroundImage: `url('${logoUrl}')`,
            backgroundRepeat: 'repeat',
            backgroundSize: '120px 120px',
            backgroundPosition: 'center',
          }}
        />
      </div>

      <div className="receipt-zigzag relative text-white">
        <span className="block h-2.5" />
      </div>

      <div className="relative px-5 pb-8 pt-2 sm:px-7">
        <div className="flex items-center justify-center gap-2.5">
          <img src={logoUrl} alt="Boosteryuk" className="h-9 w-9 object-contain" />
          <p className="font-display text-[17px] font-extrabold tracking-tight">
            <span className="text-cyan-600">Booster</span>yuk
          </p>
        </div>
        <p className="mt-1 text-center font-mono text-[9.5px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
          Bukti Pesanan Digital
        </p>

        <div className="my-5 border-t-2 border-dashed border-slate-200 dark:border-slate-700" />

        <div className="relative flex items-center justify-center">
          {struk.ok ? (
            <span className="animate-stamp inline-flex items-center gap-1.5 rounded-md border-2 border-emerald-500 bg-emerald-50 px-3.5 py-1.5 font-display text-[13.5px] font-extrabold uppercase tracking-widest text-emerald-600 shadow-sm dark:bg-emerald-950/40">
              <BadgeCheck className="h-4 w-4" strokeWidth={2.6} />
              Sukses
            </span>
          ) : (
            <span className="animate-stamp inline-flex items-center gap-1.5 rounded-md border-2 border-rose-500 bg-rose-50 px-3.5 py-1.5 font-display text-[13.5px] font-extrabold uppercase tracking-widest text-rose-600 shadow-sm dark:bg-rose-950/40">
              <XCircle className="h-4 w-4" strokeWidth={2.6} />
              Gagal
            </span>
          )}
        </div>

        <p className="mt-5 text-center font-mono text-[13px] font-bold leading-relaxed text-slate-800 dark:text-slate-100">
          {struk.ok ? 'Pesanan anda berhasil di buat' : 'Data pesanan tidak lengkap'}
        </p>

        <div className="my-5 border-t-2 border-dashed border-slate-200 dark:border-slate-700" />

        <dl className="space-y-4">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-col gap-1 sm:grid sm:grid-cols-[100px_1fr] sm:gap-2">
              <dt className="font-mono text-[11.5px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {r.label}
              </dt>
              <dd className="flex items-start gap-1.5">
                <span className="mt-[7px] hidden font-mono text-[11.5px] text-slate-400 sm:inline dark:text-slate-400">:</span>
                <span className="min-h-[18px] min-w-0 flex-1 break-all font-mono text-[12.5px] font-bold leading-relaxed text-slate-900 dark:text-white">
                  {r.value || '—'}
                </span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="my-5 border-t-2 border-dashed border-slate-200 dark:border-slate-700" />

        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Terima kasih</p>
          <div className="flex gap-[3px]" aria-hidden>
            {[2, 4, 2, 6, 2, 4, 6, 2, 4, 2, 6, 4, 2, 6].map((w, i) => (
              <span key={i} style={{ width: `${w}px` }} className="block h-7 bg-slate-800" />
            ))}
          </div>
        </div>

        <p className="mt-5 text-center font-mono text-[9.5px] leading-relaxed text-slate-400 dark:text-slate-400">
          boosteryuk.id · Struk ini sah tanpa tanda tangan
        </p>
      </div>

      <div className="receipt-zigzag relative text-white">
        <span className="block h-2.5" />
      </div>
    </div>
  );
}
