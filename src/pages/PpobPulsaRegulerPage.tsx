import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Info, LoaderCircle, Smartphone, Wallet } from 'lucide-react';
import Seo from '../components/Seo';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import {
  PPOB_PULSA_REGULER,
  detectOperator,
  hargaPulsa,
  rupiahTitik,
  type PpobProduk,
} from '../data/ppob';

/** Kerangka (skeleton) kartu produk saat daftar layanan dimuat. */
function SkeletonProduk() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-[74px] animate-pulse rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60" />
      ))}
    </div>
  );
}

/**
 * Halaman B: Pulsa Reguler — isi pulsa semua operator.
 * Operator terdeteksi otomatis dari 4 digit pertama nomor; daftar produk menyesuaikan.
 * Tanpa bottom navbar & tanpa tombol scan QR; padding bawah ±100px; tombol
 * "Beli Sekarang" sticky di bawah dan baru muncul setelah produk dipilih.
 */
export default function PpobPulsaRegulerPage() {
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const namaApp = settings.brandName || 'Boosteryuk';

  const [nomor, setNomor] = useState('');
  const [terpilih, setTerpilih] = useState<PpobProduk | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [pesan, setPesan] = useState<{ nada: 'sukses' | 'info' | 'gagal'; teks: string } | null>(null);

  const operator = useMemo(() => detectOperator(nomor), [nomor]);
  const produk = useMemo(() => (operator ? PPOB_PULSA_REGULER[operator.id] : []), [operator]);

  // Skeleton sebentar setiap operator berganti (meniru penarikan data dari API).
  useEffect(() => {
    setTerpilih(null);
    setPesan(null);
    if (!operator) {
      setMemuat(false);
      return;
    }
    setMemuat(true);
    const t = window.setTimeout(() => setMemuat(false), 650);
    return () => window.clearTimeout(t);
  }, [operator?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saldo = Number(user?.balance) || 0;
  const nomorBersih = nomor.replace(/\D/g, '');

  const beli = () => {
    if (!terpilih) return;
    if (nomorBersih.length < 9) {
      setPesan({ nada: 'gagal', teks: 'Nomor tujuan minimal 9 digit.' });
      return;
    }
    if (!operator) {
      setPesan({ nada: 'gagal', teks: 'Operator tidak dikenali — periksa 4 digit pertama nomor.' });
      return;
    }
    if (!terpilih.tersedia) {
      setPesan({ nada: 'gagal', teks: `${terpilih.nama} sedang tidak tersedia.` });
      return;
    }
    if (saldo < terpilih.harga) {
      setPesan({
        nada: 'info',
        teks: `Saldo belum cukup (${rupiahTitik(saldo)} dari ${hargaPulsa(terpilih.harga)}). Isi saldo dulu untuk melanjutkan.`,
      });
      return;
    }
    // Checkout PPOB belum disambungkan ke penyedia: jangan membuat pesanan palsu.
    setPesan({
      nada: 'info',
      teks: `Pesanan disiapkan: ${terpilih.nama} → ${nomorBersih} (${hargaPulsa(terpilih.harga)}). Checkout PPOB belum tersambung ke penyedia — sambungkan API di src/data/ppob.ts untuk mengaktifkan pembelian.`,
    });
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB] pb-[120px] dark:bg-slate-950">
      <Seo title="Pulsa Reguler" description={`Isi pulsa semua operator di ${namaApp} — Telkomsel, Indosat, XL, Tri, Smartfren. Deteksi operator otomatis, proses 24 jam.`} noindex />


      {/* ============ CARD PUTIH BESAR (overlap header) ============ */}
      <div className="mx-auto w-full max-w-md px-4 md:max-w-3xl lg:max-w-5xl lg:px-6">
        <section className="relative -mt-9 rounded-t-[28px] rounded-b-[20px] bg-white p-4 shadow-[0_10px_30px_-14px_rgba(37,99,235,0.4)] dark:bg-slate-900 md:p-5">
          <h1 className="text-[16px] font-extrabold tracking-tight text-slate-900 dark:text-white">Pulsa Reguler</h1>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
            Isi pulsa semua operator Indonesia — deteksi operator otomatis dari nomor tujuan, proses otomatis 24 jam.
          </p>
          <div className="mt-3 border-t border-slate-100 dark:border-slate-800" />

          {/* Nomor tujuan + logo operator terdeteksi */}
          <label className="mt-3.5 block">
            <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Nomor Tujuan</span>
            <span className="relative block">
              <Smartphone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2.1} />
              <input
                value={nomor}
                onChange={(e) => setNomor(e.target.value.replace(/[^\d+ ]/g, '').slice(0, 20))}
                inputMode="numeric"
                placeholder="08xx"
                aria-label="Nomor tujuan"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-24 text-[13.5px] font-semibold text-slate-800 outline-none transition focus:border-[#3B82F6] focus:bg-white focus:ring-2 focus:ring-[#3B82F6]/15 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              {/* Logo operator = placeholder teks berwarna merek (deteksi 4 digit pertama) */}
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {operator ? (
                  <span
                    className="rounded-lg px-2 py-1 text-[10.5px] font-extrabold tracking-wide text-white"
                    style={{ backgroundColor: operator.warna }}
                    title={operator.nama}
                  >
                    {operator.singkat}
                  </span>
                ) : (
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10.5px] font-bold text-slate-400 dark:bg-slate-800">
                    Operator
                  </span>
                )}
              </span>
            </span>
            <span className="mt-1 block text-[11px] font-medium text-slate-400">
              {operator ? `Terdeteksi: ${operator.nama} · prefix ${nomorBersih.slice(0, 4)}` : 'Contoh: 0812, 0857, 0877, 0895, 0881'}
            </span>
          </label>

          <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-400">Pilih Layanan</p>

          {/* Daftar produk */}
          <div className="mt-2.5">
            {memuat ? (
              <SkeletonProduk />
            ) : !operator ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-[12px] leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
                Masukkan nomor tujuan (08xx) untuk melihat daftar layanan pulsa.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {produk.map((p) => {
                  const aktif = terpilih?.id === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!p.tersedia}
                      aria-disabled={!p.tersedia}
                      aria-pressed={aktif}
                      onClick={() => {
                        setTerpilih(p);
                        setPesan(null);
                      }}
                      className={`relative rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                        p.tersedia
                          ? aktif
                            ? 'border-[3px] border-[#3B82F6] bg-[#EFF6FF] dark:bg-blue-950/30'
                            : 'border-blue-200 bg-white hover:border-[#3B82F6] dark:border-blue-900/50 dark:bg-slate-900'
                          : 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-80 dark:border-slate-700 dark:bg-slate-800/50'
                      }`}
                    >
                      <span
                        className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white ${
                          p.tersedia ? 'bg-[#3B82F6]' : 'bg-slate-400'
                        }`}
                      >
                        {p.tersedia ? 'available' : 'unavailable'}
                      </span>
                      <span className="mt-4 block pr-1 text-[12.5px] font-extrabold leading-tight text-slate-800 dark:text-slate-100">
                        {p.nama}
                      </span>
                      <span className="mt-0.5 block text-[11.5px] font-semibold text-slate-400">{hargaPulsa(p.harga)}</span>
                      {aktif ? (
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[10.5px] font-extrabold text-[#2563EB]">
                          <Check className="h-3 w-3" strokeWidth={3} /> Dipilih
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {pesan ? (
            <div
              className={`mt-4 flex items-start gap-2 rounded-2xl border p-3 text-[12px] font-semibold leading-relaxed ${
                pesan.nada === 'gagal'
                  ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300'
                  : pesan.nada === 'sukses'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300'
              }`}
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.2} />
              <span className="min-w-0 flex-1">
                {pesan.teks}
                {pesan.nada === 'info' && saldo < (terpilih?.harga || 0) ? (
                  <button
                    type="button"
                    onClick={() => navigate('/deposit')}
                    className="mt-2 flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1.5 text-[11.5px] font-extrabold text-white transition active:scale-95"
                  >
                    <Wallet className="h-3.5 w-3.5" /> Isi saldo
                  </button>
                ) : null}
              </span>
            </div>
          ) : null}

          <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
            Harga sudah termasuk biaya admin. Pastikan nomor tujuan benar — pulsa yang sudah masuk tidak dapat ditarik kembali.
          </p>
        </section>
      </div>

      {/* ============ TOMBOL BELI (sticky, bukan navbar) ============ */}
      {terpilih ? (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md px-4 pb-4 md:max-w-3xl lg:max-w-5xl lg:px-6">
          <div className="rounded-2xl bg-white/95 p-3 shadow-[0_-6px_24px_-12px_rgba(15,23,42,0.45)] backdrop-blur dark:bg-slate-900/95">
            <div className="mb-2 flex items-center justify-between text-[12px]">
              <span className="truncate font-bold text-slate-600 dark:text-slate-300">
                {terpilih.nama} → {nomorBersih || '—'}
              </span>
              <span className="shrink-0 font-mono text-[13px] font-extrabold text-[#2563EB]">{hargaPulsa(terpilih.harga)}</span>
            </div>
            <button
              type="button"
              onClick={beli}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#3B82F6] text-[14px] font-extrabold text-white shadow-md shadow-blue-600/30 transition active:scale-[0.99] hover:bg-[#2563EB]"
            >
              {memuat ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
              Beli Sekarang
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
