import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, ChevronDown, LayoutGrid, LoaderCircle, RefreshCw, Search } from 'lucide-react';
import Seo from '../components/Seo';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { hargaMarkup, markupPpobPct } from '../lib/panelMarkup';
import { tvLayanan, tvLayananProduk, type TvLayananKelompok, type TvLayananProdukItem } from '../services/tokovoucherApi';
import { ikonLayanan, rupiahTitik } from '../data/ppob';
import { IKON_LAYANAN } from '../lib/ppobIkon';

/**
 * Halaman "Lainnya" PPOB — grid card SEMUA layanan dari katalog penuh penyedia
 * (endpoint list produk penuh) yang BUKAN top up game: pulsa, paket data,
 * e-money, voucher, token listrik, tagihan, sampai operator telekomunikasi.
 * Top up game tetap di /topup, jadi tidak ada kartu game di halaman ini.
 *
 * Data sepenuhnya dari server — tidak ada daftar layanan karangan: saat gagal
 * memuat, yang tampil kartu galat (Coba lagi / Login ulang), bukan dummy.
 */
export default function PpobLayananPage() {
  const { settings, tenant } = useSiteSettings();
  const navigate = useNavigate();
  const [param, setParam] = useSearchParams();
  const namaApp = settings.brandName || 'Boosteryuk';
  /** Markup PPOB child panel (0 bila akses belum dibeli / web utama). */
  const pctPpob = markupPpobPct(tenant);

  const [kelompok, setKelompok] = useState<TvLayananKelompok[] | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [cari, setCari] = useState('');
  const [terbuka, setTerbuka] = useState<string>('');
  const [produk, setProduk] = useState<Record<string, TvLayananProdukItem[]>>({});
  const [memuatProduk, setMemuatProduk] = useState<Record<string, boolean>>({});
  const [galatProduk, setGalatProduk] = useState<Record<string, string>>({});

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat('');
    const r = await tvLayanan();
    setMemuat(false);
    if (!r.ok) {
      setKelompok(null);
      setGalat(r.message || 'Daftar layanan gagal dimuat.');
      return;
    }
    setKelompok(Array.isArray(r.kelompok) ? r.kelompok : []);
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  /** Harga jual = harga asli penyedia + markup PPOB panel (bila aksesnya dibeli). */
  const jual = (n: number) => rupiahTitik(Math.round(hargaMarkup(n, pctPpob)));

  /** Kelompok per kategori penyedia (kategori kosong digabung jadi "Layanan lain"). */
  const seksi = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const lolos = (kelompok || []).filter(
      (k) =>
        !q ||
        k.layanan.toLowerCase().includes(q) ||
        (k.kategori || '').toLowerCase().includes(q) ||
        k.labels.some((l) => l.toLowerCase().includes(q)),
    );
    const peta = new Map<string, TvLayananKelompok[]>();
    for (const k of lolos) {
      const nama = (k.kategori || '').trim() || 'Layanan lain';
      if (!peta.has(nama)) peta.set(nama, []);
      peta.get(nama)!.push(k);
    }
    return [...peta.entries()].sort((a, b) => a[0].localeCompare(b[0], 'id'));
  }, [kelompok, cari]);

  const totalLayanan = (kelompok || []).length;
  const totalProduk = useMemo(() => (kelompok || []).reduce((n, k) => n + (k.jumlah || 0), 0), [kelompok]);

  /** Buka/tutup daftar produk satu layanan (data produk ditarik sekali, lalu disimpan). */
  const toggle = async (id: string) => {
    if (terbuka === id) {
      setTerbuka('');
      return;
    }
    setTerbuka(id);
    if (produk[id] || memuatProduk[id]) return;
    setMemuatProduk((m) => ({ ...m, [id]: true }));
    const r = await tvLayananProduk(id);
    setMemuatProduk((m) => ({ ...m, [id]: false }));
    if (!r.ok) {
      setGalatProduk((g) => ({ ...g, [id]: r.message || 'Daftar produk gagal dimuat.' }));
      return;
    }
    setProduk((p) => ({ ...p, [id]: Array.isArray(r.items) ? r.items : [] }));
  };

  /** `?grup=<id>` dari tile Menu Service: langsung buka layanan itu. */
  useEffect(() => {
    const id = (param.get('grup') || '').trim();
    if (!id || memuat || !kelompok) return;
    if (kelompok.some((k) => k.id === id)) void toggle(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memuat, kelompok]);

  const tutupGrup = () => {
    setTerbuka('');
    if (param.get('grup')) {
      param.delete('grup');
      setParam(param, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB] pb-[100px] dark:bg-slate-950">
      <Seo
        title="Semua Layanan PPOB"
        description={`Semua layanan ${namaApp} selain top up game: pulsa, paket data, e-money, voucher, token listrik, dan bayar tagihan dari katalog penyedia.`}
        noindex
      />

      <div className="mx-auto w-full max-w-md px-4 md:max-w-3xl lg:max-w-5xl lg:px-6">
        <section className="mt-4 rounded-[20px] bg-white p-4 shadow-[0_10px_30px_-14px_rgba(37,99,235,0.4)] dark:bg-slate-900 md:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#3B82F6] text-white">
              <LayoutGrid className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <h1 className="text-[16px] font-extrabold tracking-tight text-slate-900 dark:text-white">Semua Layanan</h1>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                Layanan dari katalog penyedia <span className="font-bold">selain top up game</span> — pulsa, paket data,
                e-money, voucher, token listrik & tagihan. Top up game ada di halaman Topup Game.
              </p>
            </div>
          </div>

          {!memuat && !galat && (
            <p className="mt-2.5 text-[11px] font-bold text-slate-400">
              {totalLayanan} layanan · {totalProduk} produk
              {pctPpob > 0 ? ` · harga sudah termasuk markup panel ${pctPpob}%` : ''}
            </p>
          )}

          {/* Pencarian layanan */}
          <label className="relative mt-3 block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2.1} />
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari layanan (pulsa, data, e-money, …)"
              aria-label="Cari layanan PPOB"
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-[13px] font-semibold text-slate-800 outline-none transition focus:border-[#3B82F6] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <div className="mt-3 border-t border-slate-100 dark:border-slate-800" />

          {/* ============ STATE: memuat / galat / kosong ============ */}
          {memuat && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/70" />
              ))}
            </div>
          )}

          {galat && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/40">
              <p className="flex items-start gap-2 text-[12.5px] font-bold leading-relaxed text-rose-600 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.3} />
                <span className="break-words">{galat}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void muat()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-[12px] font-extrabold text-white transition active:scale-95"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Coba lagi
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/', { state: { openLogin: true } })}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 px-3.5 py-2 text-[12px] font-extrabold text-rose-600 transition active:scale-95 dark:border-rose-800 dark:text-rose-300"
                >
                  Login ulang
                </button>
              </div>
            </div>
          )}

          {!memuat && !galat && totalLayanan === 0 && (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-200 p-4 text-center text-[12px] font-semibold leading-relaxed text-slate-500 dark:border-slate-700">
              Katalog penyedia belum mengirim layanan selain top up game. Coba lagi beberapa saat — daftar ini diambil
              langsung dari server, tidak diisi data karangan.
            </p>
          )}

          {!memuat && !galat && totalLayanan > 0 && seksi.length === 0 && (
            <p className="mt-4 text-center text-[12px] font-semibold text-slate-500">
              Tidak ada layanan yang cocok dengan “{cari}”.
            </p>
          )}

          {/* ============ GRID CARD PER KATEGORI ============ */}
          {seksi.map(([kategori, daftar]) => (
            <div key={kategori} className="mt-4">
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{kategori}</p>
              <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {daftar.map((k) => {
                  const Ikon = IKON_LAYANAN[ikonLayanan(`${k.kategori} ${k.layanan} ${k.labels.join(' ')}`)];
                  const buka = terbuka === k.id;
                  return (
                    <div
                      key={k.id}
                      className={`col-span-2 overflow-hidden rounded-2xl border transition sm:col-span-1 ${
                        buka
                          ? 'border-[#3B82F6] bg-white shadow-[0_10px_26px_-16px_rgba(37,99,235,0.55)] dark:bg-slate-900'
                          : 'border-slate-100 bg-white hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void toggle(k.id)}
                        aria-expanded={buka}
                        data-layanan={k.id}
                        className="flex w-full items-start gap-2.5 p-3 text-left transition active:scale-[0.99]"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-800">
                          {k.logo ? (
                            <img src={k.logo} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <Ikon className="h-5 w-5 text-[#2563EB]" strokeWidth={2.2} />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-extrabold text-slate-800 dark:text-slate-100">{k.layanan}</span>
                          <span className="mt-0.5 block truncate text-[10.5px] font-semibold text-slate-400">
                            {k.jumlah} produk · mulai {jual(k.termurah)}
                          </span>
                          <span className="mt-1.5 flex items-center gap-1 text-[10px] font-extrabold text-[#2563EB]">
                            {buka ? 'Tutup daftar' : 'Lihat produk'}
                            <ChevronDown className={`h-3 w-3 transition ${buka ? 'rotate-180' : ''}`} strokeWidth={2.6} />
                          </span>
                        </span>
                      </button>

                      {buka && (
                        <div className="border-t border-slate-100 p-3 dark:border-slate-800">
                          {memuatProduk[k.id] && (
                            <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-400">
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Memuat produk…
                            </p>
                          )}
                          {galatProduk[k.id] && (
                            <p className="break-words text-[11.5px] font-bold leading-relaxed text-rose-600 dark:text-rose-300">
                              {galatProduk[k.id]}
                            </p>
                          )}
                          {!memuatProduk[k.id] && !galatProduk[k.id] && produk[k.id] && (
                            produk[k.id].length === 0 ? (
                              <p className="text-[11.5px] font-semibold text-slate-500">Produk layanan ini belum dikirim penyedia.</p>
                            ) : (
                              <ul className="grid max-h-[280px] gap-1.5 overflow-y-auto pr-0.5">
                                {produk[k.id].map((p) => (
                                  <li
                                    key={p.kode}
                                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
                                  >
                                    <span className="min-w-0">
                                      <span className="block truncate text-[11.5px] font-bold text-slate-700 dark:text-slate-200">{p.nama}</span>
                                      <code className="block truncate text-[10px] font-semibold text-slate-400">{p.kode}</code>
                                    </span>
                                    <span className="shrink-0 font-mono text-[11.5px] font-extrabold text-[#14143c] dark:text-white">{jual(p.harga)}</span>
                                  </li>
                                ))}
                              </ul>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {terbuka && (
            <button
              type="button"
              onClick={tutupGrup}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-[11.5px] font-extrabold text-slate-600 transition active:scale-95 dark:border-slate-700 dark:text-slate-300"
            >
              <Check className="h-3.5 w-3.5" /> Tutup daftar produk
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
