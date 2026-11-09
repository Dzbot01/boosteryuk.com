import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Globe2,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  Server,
  ShoppingCart,
} from 'lucide-react';
import Reveal from '../components/Reveal';
import BottomSheet from '../components/BottomSheet';
import {
  NOMOR_CATEGORIES,
  NOMOR_COUNTRIES,
  NOMOR_PROVIDERS,
  NOMOR_SERVERS,
  NOMOR_SERVICES,
  NOMOR_TOTAL_LAYANAN,
  brandIconUrl,
  flagUrl,
  formatRp,
  formatStock,
} from '../data/orderNomorData';

// DARK-FIX: nilai hex diganti token CSS var(--by-*) (lihat index.css) agar card/teks
// mengikuti tema terang & gelap (sebelumnya inline hex -> teks gelap tak terlihat saat dark).
const COLOR = {
  primary: 'var(--by-primary)',
  dark: 'var(--by-ink)',
  secondary: 'var(--by-ink-2)',
  border: 'var(--by-line)',
  surface: 'var(--by-surface)',
  muted: 'var(--by-muted)',
};

/* =============================================================
   MODAL DROPDOWN KATEGORI — custom dropdown (gaya yang sama
   seperti halaman server): tombol + panel listbox + pilih opsi.
   ============================================================= */
function CategorySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-white pl-3.5 pr-3 text-left text-[13.5px] outline-none transition-colors focus-visible:ring-4 focus-visible:ring-cyan-500/10 dark:bg-slate-900"
        style={{ borderColor: COLOR.border }}
      >
        <span className="min-w-0 flex-1 truncate font-medium" style={{ color: COLOR.dark }}>
          {value}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          style={{ color: COLOR.secondary }}
          strokeWidth={2.2}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full z-40 mt-1 max-h-[300px] overflow-y-auto overflow-x-hidden rounded-xl border bg-white shadow-[0_8px_24px_-8px_rgba(23,32,51,0.18)] dark:bg-slate-900"
            style={{ borderColor: COLOR.border }}
          >
            {NOMOR_CATEGORIES.map((cat) => {
              const active = cat === value;
              return (
                <button
                  key={cat}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(cat);
                    setOpen(false);
                  }}
                  className="flex h-11 w-full items-center justify-between gap-2 border-b px-3.5 text-left text-[13.5px] last:border-b-0 transition-colors hover:bg-cyan-50 dark:hover:bg-cyan-950/60"
                  style={{ borderColor: COLOR.border, background: active ? 'var(--by-active)' : undefined }}
                >
                  <span className="truncate font-medium" style={{ color: active ? COLOR.primary : COLOR.dark }}>
                    {cat}
                  </span>
                  {active ? <Check className="h-4 w-4 shrink-0" style={{ color: COLOR.primary }} strokeWidth={2.6} /> : null}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* =============================================================
   MODAL KARTU IKON LAYANAN — tile grid hasil kategori.
   Menampilkan ikon brand + nama layanan, bisa diklik pilih.
   ============================================================= */
function ServiceTile({
  name,
  icon,
  color,
  selected,
  onSelect,
}: {
  name: string;
  icon: string;
  color: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={name}
      className={`relative flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-center transition-all duration-200 active:scale-95 ${
        selected
          ? 'border-cyan-400 bg-cyan-50/70 shadow-[0_14px_30px_-20px_rgba(72,198,229,0.9)] dark:bg-cyan-950/40'
          : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md dark:bg-slate-900 dark:border-slate-700'
      }`}
    >
      {selected && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-white ring-2 ring-white">
          <Check className="h-3 w-3" strokeWidth={3.5} />
        </span>
      )}
      <span
        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl ring-1 ring-black/5"
        style={{ background: `${color}1a` }}
      >
        {failed ? (
          <span className="text-[14px] font-extrabold" style={{ color }}>
            {name.slice(0, 2).toUpperCase()}
          </span>
        ) : (
          <img
            src={brandIconUrl(icon, color)}
            alt={name}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-6 w-6 object-contain"
          />
        )}
      </span>
      <span className="w-full truncate text-[11px] font-extrabold leading-tight text-slate-900 dark:text-white">{name}</span>
    </button>
  );
}

/* Label kecil untuk tiap field di dalam card Buat Pesanan */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[12px] font-medium" style={{ color: COLOR.secondary }}>
      {children}
    </label>
  );
}

/* =============================================================
   HALAMAN ORDER NOMOR — beli nomor virtual / OTP
   ============================================================= */
export default function OrderNomorPage() {
  const navigate = useNavigate();

  /* ----- state form ----- */
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('Social & Chat');
  // Demo: user sudah memilih Whatsapp
  const [serviceId, setServiceId] = useState<string>('whatsapp');
  const [providerId, setProviderId] = useState<string>('p2');
  const [otpOpen, setOtpOpen] = useState(false);
  const [countrySheetOpen, setCountrySheetOpen] = useState(false);
  const [serverSheetOpen, setServerSheetOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [countryId, setCountryId] = useState('id');
  const [serverId, setServerId] = useState('nksp-58');
  const [qty, setQty] = useState(1);
  const [ordering, setOrdering] = useState(false);
  const [successAt, setSuccessAt] = useState<Date | null>(null);

  /* ----- turunan ----- */
  const services = useMemo(() => {
    const q = search.trim().toLowerCase();
    return NOMOR_SERVICES.filter((s) => {
      const matchCat = category === 'Semua Kategori' || s.category === category;
      const matchQ = !q || s.name.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [category, search]);

  const service = useMemo(
    () => NOMOR_SERVICES.find((s) => s.id === serviceId) ?? null,
    [serviceId],
  );
  const provider = useMemo(
    () => NOMOR_PROVIDERS.find((p) => p.id === providerId) ?? NOMOR_PROVIDERS[0],
    [providerId],
  );
  const country = useMemo(
    () => NOMOR_COUNTRIES.find((c) => c.id === countryId) ?? NOMOR_COUNTRIES[0],
    [countryId],
  );
  const server = useMemo(
    () => NOMOR_SERVERS.find((s) => s.id === serverId) ?? NOMOR_SERVERS[0],
    [serverId],
  );

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return NOMOR_COUNTRIES;
    return NOMOR_COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [countrySearch]);

  // Provider 3 tanpa pilih server → harga mengikuti provider
  const noServer = provider.id === 'p3';
  const unitPrice = noServer ? provider.from : server.price;
  const total = unitPrice * qty;

  const confirmOrder = async () => {
    if (!service || ordering) return;
    setOrdering(true);
    setSuccessAt(null);
    await new Promise((r) => window.setTimeout(r, 1200));
    setOrdering(false);
    setSuccessAt(new Date());
  };

  return (
    <div className="page-align-left mx-auto max-w-2xl px-4 pb-32 pt-8 sm:px-6">
      {/* Tombol kembali */}
      <Reveal>
        <button
          onClick={() => navigate('/')}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
          Kembali
        </button>
      </Reveal>

      {/* =====================================================
          MODAL CARD JUDUL — total layanan tersedia
         ===================================================== */}
      <Reveal delay={30}>
        <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_16px_44px_-28px_rgba(15,23,42,.35)] sm:p-6 dark:bg-slate-900 dark:border-slate-700">
          <p className="text-[26px] font-black leading-none tracking-tight text-slate-900 sm:text-[30px] dark:text-white">
            {NOMOR_TOTAL_LAYANAN.toLocaleString('id-ID')}{' '}
            <span className="text-cyan-500">Layanan Tersedia.</span>
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
            Pilih layanan, provider, negara, lalu server.
          </p>
        </div>
      </Reveal>

      {/* =====================================================
          MODAL CARD 3D TIMBUL — link Panduan & Kebijakan
          Efek timbul: border tebal + shadow bawah offset.
         ===================================================== */}
      <Reveal delay={70}>
        <button
          onClick={() => navigate('/order-nomor/panduan')}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border-2 border-slate-900 bg-white p-4 text-left shadow-[0_5px_0_0_#0f172a] transition-all hover:-translate-y-0.5 hover:shadow-[0_7px_0_0_#0f172a] active:translate-y-1 active:shadow-none dark:bg-slate-900"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
            <BookOpenCheck className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-slate-700 dark:text-slate-200">
            Pelajari Panduan dan Kebijakan <strong className="font-extrabold text-slate-900 dark:text-white">Order Nomor</strong>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-900 dark:text-white" strokeWidth={2.6} />
        </button>
      </Reveal>

      {/* =====================================================
          MODAL CARD BUAT PESANAN — form Order Nomor
         ===================================================== */}
      <Reveal delay={110}>
        <div
          className="mt-5 w-full rounded-[18px] px-4 py-5 sm:px-5"
          style={{ background: COLOR.surface, boxShadow: '0 22px 48px -22px rgba(23,32,51,.32), 0 6px 16px -10px rgba(23,32,51,.14)' }}
        >
          {/* Header card + label biru */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-[18px] w-[18px]" style={{ color: COLOR.primary }} strokeWidth={2} />
              <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: COLOR.dark }}>
                Buat Pesanan
              </h2>
            </div>
            <span className="rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-white" style={{ background: COLOR.primary }}>
              Order Nomor
            </span>
          </div>

          <div className="my-3.5 h-px w-full" style={{ background: COLOR.border }} />

          <div className="space-y-5">
            {/* ----- Kolom Pencarian Layanan ----- */}
            <div>
              <FieldLabel>Pencarian Layanan</FieldLabel>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: COLOR.secondary }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari layanan… (cth: Whatsapp)"
                  className="h-11 w-full rounded-xl border bg-white pl-9 pr-3.5 text-[13.5px] outline-none transition-colors focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10 dark:bg-slate-900"
                  style={{ borderColor: COLOR.border }}
                />
              </div>
            </div>

            {/* ----- Kolom Kategori (dropdown custom) ----- */}
            <div>
              <FieldLabel>Kategori</FieldLabel>
              <CategorySelect
                value={category}
                onChange={(v) => {
                  setCategory(v);
                }}
              />
            </div>

            {/* ----- Grid Card hasil kategori (demo: Whatsapp) ----- */}
            <div>
              <FieldLabel>
                {services.length} hasil {category !== 'Semua Kategori' ? `· ${category}` : ''}
              </FieldLabel>
              {services.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-[12px] font-medium text-slate-500 dark:text-slate-400 dark:bg-slate-800/60 dark:border-slate-600">
                  Tidak ada layanan yang cocok dengan pencarian.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                  {services.map((s) => (
                    <ServiceTile
                      key={s.id}
                      name={s.name}
                      icon={s.icon}
                      color={s.color}
                      selected={s.id === serviceId}
                      onSelect={() => setServiceId(s.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ----- Pilih Provider ----- */}
            <div>
              <p className="text-[14px] font-extrabold tracking-tight text-slate-900 dark:text-white">Pilih provider</p>
              <p className="mb-2.5 mt-0.5 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                Harga, negara, dan server mengikuti provider yang dipilih.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {NOMOR_PROVIDERS.map((p) => {
                  const active = p.id === providerId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProviderId(p.id)}
                      aria-pressed={active}
                      className={`relative rounded-2xl border p-3.5 text-left transition-all active:scale-[0.98] ${
                        active
                          ? 'border-cyan-400 bg-cyan-50/60 shadow-[0_14px_30px_-20px_rgba(72,198,229,0.9)] dark:bg-cyan-950/40'
                          : 'border-slate-200 bg-white hover:border-cyan-200 hover:shadow-md dark:bg-slate-900 dark:border-slate-700'
                      }`}
                    >
                      {active && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-white ring-2 ring-white">
                          <Check className="h-3 w-3" strokeWidth={3.5} />
                        </span>
                      )}
                      <p className="text-[13px] font-extrabold text-slate-900 dark:text-white">{p.name}</p>
                      <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        mulai <span className="font-extrabold text-cyan-600">{formatRp(p.from)}</span>
                      </p>
                      <p className="mt-1 text-[10.5px] leading-snug text-slate-400 dark:text-slate-400">{p.tag}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ----- Modal card dropdown: OTP kedua ----- */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setOtpOpen((v) => !v)}
                aria-expanded={otpOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="text-[13.5px] font-extrabold text-slate-900 dark:text-white">
                  Apakah bisa meminta OTP kedua?
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 dark:text-slate-400 ${otpOpen ? 'rotate-180' : ''}`}
                  strokeWidth={2.4}
                />
              </button>
              {otpOpen && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3.5 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300 dark:border-slate-800">
                  <p>
                    OTP berikutnya bergantung pada kemampuan nomor yang dibeli. Setelah OTP pertama diterima, masa
                    aktif harus masih tersisa dan aktivasi belum ditutup.
                  </p>
                  <ul className="mt-2.5 space-y-1.5">
                    <li><strong>Provider 1:</strong> Mendukung permintaan OTP berikutnya selama aktivasi masih terbuka.</li>
                    <li><strong>Provider 2:</strong> Permintaan OTP berikutnya belum tersedia di Nokos Pusat untuk provider ini.</li>
                    <li><strong>Provider 3:</strong> Tersedia hanya untuk nomor yang terkonfirmasi mendukung SMS berikutnya setelah pembelian.</li>
                    <li><strong>Provider 4:</strong> Tersedia hanya untuk nomor yang terkonfirmasi mendukung SMS berikutnya setelah pembelian.</li>
                  </ul>
                  <p className="mt-2.5">
                    Jika tersedia, tekan Minta OTP berikutnya di pesanan, lalu minta kirim ulang SMS dari aplikasi
                    tujuan. Tombol ini menyiapkan penerimaan; pengiriman kode tetap bergantung pada aplikasi tujuan
                    dan tidak dijamin berhasil.
                  </p>
                  <p className="mt-2.5">
                    Nomor bersifat sementara. Jangan mengandalkannya untuk login atau pemulihan akun setelah masa
                    aktif habis. OTP yang sudah diterima tetap tidak dapat direfund, termasuk saat menunggu kode
                    berikutnya.
                  </p>
                </div>
              )}
            </div>

            {/* ----- Kolom Pilih Negara (buka sheet) ----- */}
            <div>
              <FieldLabel>Pilih Negara</FieldLabel>
              <button
                type="button"
                onClick={() => {
                  setCountrySearch('');
                  setCountrySheetOpen(true);
                }}
                className="flex h-[52px] w-full items-center gap-3 rounded-xl border bg-white px-3.5 text-left transition-colors hover:border-cyan-300 dark:bg-slate-900"
                style={{ borderColor: COLOR.border }}
              >
                <span className="flex h-8 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 ring-1 ring-black/5 dark:bg-slate-800">
                  <img src={flagUrl(country.flag)} alt={country.name} className="h-full w-full object-cover" loading="lazy" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold text-slate-900 dark:text-white">
                    {country.name} {country.isDefault ? <span className="font-medium text-slate-400 dark:text-slate-400">(default)</span> : null}
                  </span>
                  <span className="block text-[10.5px] text-slate-400 dark:text-slate-400">{formatStock(country.stock)}</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-400" strokeWidth={2.4} />
              </button>
            </div>

            {/* ----- Kolom Pilih Server (buka sheet) ----- */}
            <div>
              <FieldLabel>Pilih Server</FieldLabel>
              <button
                type="button"
                disabled={noServer}
                onClick={() => setServerSheetOpen(true)}
                className={`flex h-[52px] w-full items-center gap-3 rounded-xl border bg-white px-3.5 text-left transition-colors dark:bg-slate-900 ${
                  noServer ? 'cursor-not-allowed opacity-60' : 'hover:border-cyan-300'
                }`}
                style={{ borderColor: COLOR.border }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100 dark:bg-cyan-950/40">
                  <Server className="h-4 w-4" strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  {noServer ? (
                    <>
                      <span className="block truncate text-[13.5px] font-bold text-slate-900 dark:text-white">Otomatis</span>
                      <span className="block text-[10.5px] text-slate-400 dark:text-slate-400">Provider ini tanpa pilih server</span>
                    </>
                  ) : (
                    <>
                      <span className="block truncate text-[13.5px] font-bold text-slate-900 dark:text-white">{server.name}</span>
                      <span className="block text-[10.5px] text-slate-400 dark:text-slate-400">
                        {formatStock(server.stock)} · <span className="font-bold text-cyan-600">{formatRp(server.price)}</span>
                      </span>
                    </>
                  )}
                </span>
                {!noServer && <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-400" strokeWidth={2.4} />}
              </button>
            </div>

            {/* ----- Card jumlah order (- / +) ----- */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-700">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-extrabold text-slate-900 dark:text-white">Jumlah nomor</p>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-slate-500 dark:text-slate-400">
                    Maksimal 5 nomor dengan pilihan yang sama. Biaya dan OTP per nomor.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:bg-slate-900 dark:border-slate-700">
                  <button
                    type="button"
                    aria-label="Kurangi jumlah"
                    disabled={qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition-all hover:bg-slate-200 active:scale-90 disabled:opacity-40 dark:text-slate-200 dark:bg-slate-800"
                  >
                    <Minus className="h-4 w-4" strokeWidth={3} />
                  </button>
                  <span className="w-8 text-center text-[15px] font-black tabular-nums text-slate-900 dark:text-white">{qty}</span>
                  <button
                    type="button"
                    aria-label="Tambah jumlah"
                    disabled={qty >= 5}
                    onClick={() => setQty((q) => Math.min(5, q + 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500 text-white transition-all hover:opacity-90 active:scale-90 disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" strokeWidth={3} />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2.5 dark:border-slate-700">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {formatRp(unitPrice)} × {qty} nomor
                </span>
                <span className="text-[16px] font-black tabular-nums text-slate-900 dark:text-white">{formatRp(total)}</span>
              </div>
            </div>

            {/* ----- Button Konfirmasi Order ----- */}
            <button
              type="button"
              onClick={confirmOrder}
              disabled={!service || ordering}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 text-[14px] font-bold text-white shadow-lg shadow-cyan-600/25 transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ordering ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Memproses…
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" strokeWidth={2.4} />
                  Konfirmasi Order · {formatRp(total)}
                </>
              )}
            </button>

            {/* ----- Notice sukses ----- */}
            {successAt && service && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 dark:bg-emerald-950/40 dark:border-emerald-800/60">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" strokeWidth={2.2} />
                <div className="min-w-0 text-[12px] leading-relaxed text-emerald-800">
                  <p className="font-extrabold">Order nomor berhasil dibuat!</p>
                  <p className="mt-1">
                    {service.name} · {provider.name} · {country.name}
                    {noServer ? '' : ` · ${server.name}`} · {qty} nomor · {formatRp(total)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-emerald-700/80">
                    {successAt.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Reveal>

      {/* =====================================================
          MODAL SHEET PILIH NEGARA — floating dari bawah,
          dapat diseret ke bawah untuk menutup.
         ===================================================== */}
      <BottomSheet
        open={countrySheetOpen}
        onClose={() => setCountrySheetOpen(false)}
        title="Pilih negara"
        subtitle={`Pilihan saat ini: ${country.name}${country.isDefault ? ' (default)' : ''}. Cari atau pilih negara tujuan nomor.`}
      >
        <p className="mb-1.5 text-[12px] font-semibold text-slate-500 dark:text-slate-400">Cari berdasarkan nama</p>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-400" />
          <input
            value={countrySearch}
            onChange={(e) => setCountrySearch(e.target.value)}
            placeholder="Cari negara"
            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 text-[13.5px] outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10 dark:bg-slate-900 dark:border-slate-700"
          />
        </div>
        <div className="space-y-2">
          {filteredCountries.length === 0 && (
            <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-[12px] font-medium text-slate-500 dark:text-slate-400 dark:bg-slate-800/60">
              Tidak ada negara yang cocok.
            </p>
          )}
          {filteredCountries.map((c) => {
            const active = c.id === countryId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCountryId(c.id);
                  setCountrySheetOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all active:scale-[0.99] ${
                  active ? 'border-cyan-400 bg-cyan-50/60 dark:bg-cyan-950/40' : 'border-slate-200 bg-white hover:border-cyan-200 dark:bg-slate-900 dark:border-slate-700'
                }`}
              >
                <span className="flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-black/5 dark:bg-slate-800">
                  <img src={flagUrl(c.flag)} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-extrabold text-slate-900 dark:text-white">
                    {c.name}{' '}
                    {c.isDefault && (
                      <span className="ml-1 rounded-full bg-slate-900 px-1.5 py-0.5 align-middle text-[8.5px] font-bold uppercase tracking-wide text-white">
                        default
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{formatStock(c.stock)}</span>
                </span>
                {active ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-white">
                    <Check className="h-3 w-3" strokeWidth={3.5} />
                  </span>
                ) : (
                  <Globe2 className="h-4 w-4 shrink-0 text-slate-300" />
                )}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {/* =====================================================
          MODAL SHEET PILIH SERVER — logic sama seperti negara.
         ===================================================== */}
      <BottomSheet
        open={serverSheetOpen}
        onClose={() => setServerSheetOpen(false)}
        title="Pilih server"
        subtitle={`${server.name} sedang dipilih. Pilih server lain berdasarkan stok dan harga.`}
      >
        <div className="space-y-2">
          {NOMOR_SERVERS.map((s) => {
            const active = s.id === serverId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setServerId(s.id);
                  setServerSheetOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.99] ${
                  active ? 'border-cyan-400 bg-cyan-50/60 dark:bg-cyan-950/40' : 'border-slate-200 bg-white hover:border-cyan-200 dark:bg-slate-900 dark:border-slate-700'
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600 ring-1 ring-cyan-100 dark:bg-cyan-950/40">
                  <Server className="h-4 w-4" strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-extrabold text-slate-900 dark:text-white">{s.name}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">{formatStock(s.stock)}</span>
                </span>
                <span className="shrink-0 text-[14px] font-black tabular-nums text-cyan-600">{formatRp(s.price)}</span>
                {active && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-white">
                    <Check className="h-3 w-3" strokeWidth={3.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </div>
  );
}
