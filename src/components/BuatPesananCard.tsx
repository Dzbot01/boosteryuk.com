import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  LoaderCircle,
  Search,
  ShoppingCart,
  Tag,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useOrderHistory } from '../context/OrderHistoryContext';
import AiAssistantCard from './AiAssistantCard';
import { applyMarkup, formatRate, fetchServices, isCustomCommentService, type ServiceItem } from '../services/servicesApi';
import { placeOrder } from '../services/checkoutApi';
import { brandForCategory, brandIconUrl } from '../constants';


/** Small round brand badge shown in front of a dropdown result. */
function BrandBadge({ name }: { name: string }) {
  const brand = useMemo(() => brandForCategory(name), [name]);
  const [failed, setFailed] = useState(false);

  if (!brand) return null;

  const initials = name.trim().slice(0, 2).toUpperCase();

  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-black/5"
      style={{ background: `#${brand.color}` }}
      aria-hidden
    >
      {failed ? (
        <span className="font-display text-[8px] font-extrabold text-white">{initials}</span>
      ) : (
        <img
          src={brandIconUrl(brand, 'ffffff')}
          alt=""
          className="h-3 w-3 object-contain"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}


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

interface Option { value: string; label: string }

function stripHtml(value: string): string {
  if (!value) return '';
  const doc = new DOMParser().parseFromString(value, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

interface ParsedDesc {
  deskripsi: string;
  catatan: string[];
  waktu: string | null;
}

function parseDescription(value: string): ParsedDesc {
  const clean = stripHtml(value);
  if (!clean) return { deskripsi: '', catatan: [], waktu: null };

  let text = clean;
  let waktu: string | null = null;

  // Extract Waktu Rata-Rata if present
  const waktuMatch = text.match(/\b(?:Waktu\s*Rata-Rata|Waktu\s*Rata\s*Rata|Average\s*Time)\s*:\s*([\s\S]*?)$/i);
  if (waktuMatch) {
    waktu = waktuMatch[1].trim();
    text = text.substring(0, waktuMatch.index).trim();
  }

  // Look for "Catatan :" or "Catatan:"
  const catatanMatch = text.match(/\bCatatan\s*:\s*([\s\S]*)$/i);
  if (catatanMatch) {
    let beforeCatatan = text.substring(0, catatanMatch.index).trim();
    beforeCatatan = beforeCatatan.replace(/^Deskripsi\s*:\s*/i, '').trim();

    const catatanBody = catatanMatch[1].trim();
    const items = catatanBody
      .split(/(?:^|\n)\s*[•\-*]\s*|\s*•\s*/)
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      deskripsi: beforeCatatan,
      catatan: items.length > 0 ? items : [catatanBody],
      waktu,
    };
  }

  const cleanDeskripsi = text.replace(/^Deskripsi\s*:\s*/i, '').trim();
  return {
    deskripsi: cleanDeskripsi,
    catatan: [],
    waktu,
  };
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(value);
}

function CustomSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Pilih...',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Cari...',
  showBrand = false,
  widePanel = false,
  wrapText = false,
}: {
  id: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Render a round social-media brand badge before each option label. */
  showBrand?: boolean;
  /** Let the panel grow wider than the trigger so long labels fit on one line. */
  widePanel?: boolean;
  /** Wrap text onto lines below rather than truncating or scrolling horizontally. */
  wrapText?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((option) => option.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  
  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex ${wrapText && selected ? 'min-h-[44px] py-2' : 'h-11'} w-full items-center justify-between gap-2 rounded-xl border bg-white pl-3.5 pr-3 text-left text-[13.5px] outline-none transition-colors focus-visible:ring-4 focus-visible:ring-cyan-500/10 dark:bg-slate-800 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        style={{ borderColor: COLOR.border }}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {showBrand && selected && <BrandBadge name={selected.label} />}
          <span
            className={`min-w-0 flex-1 ${wrapText && selected ? 'whitespace-normal break-words text-[13px] leading-snug' : 'truncate'}`}
            style={{ color: selected ? COLOR.dark : 'var(--by-placeholder)' }}
          >
            {selected?.label || placeholder}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} style={{ color: COLOR.secondary }} strokeWidth={2.2} />
      </button>

      {open && (
        <div
          className={`absolute left-0 top-full z-40 mt-1 overflow-hidden rounded-xl border bg-white shadow-[0_8px_24px_-8px_rgba(23,32,51,0.18)] dark:border-slate-700 dark:bg-slate-900 ${
            widePanel ? 'w-max min-w-full max-w-[min(560px,88vw)]' : 'right-0 w-full'
          }`}
          style={{ borderColor: COLOR.border }}
          role="listbox"
        >
          {searchable && (
            <div className="border-b p-2 dark:border-slate-700" style={{ borderColor: COLOR.border }}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: COLOR.secondary }} />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 w-full rounded-lg border bg-white pl-8 pr-3 text-[13px] outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  style={{ borderColor: COLOR.border }}
                />
              </div>
            </div>
          )}
          <div
            className={`max-h-[320px] overflow-y-auto overscroll-contain ${
              widePanel ? 'overflow-x-auto' : 'overflow-x-hidden'
            }`}
          >
            {visible.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-[12.5px]" style={{ color: 'var(--by-placeholder)' }}>Tidak ada hasil</p>
            ) : visible.map((option) => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { onChange(option.value); setOpen(false); setQuery(''); }}
                  className={`flex w-full ${wrapText ? 'min-h-[44px] py-2.5 sm:py-3 items-start' : 'h-11 items-center'} gap-2.5 border-b px-3.5 text-left last:border-b-0 hover:bg-cyan-50 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors ${
                    widePanel ? 'w-max min-w-full whitespace-nowrap' : ''
                  }`}
                  style={{ borderColor: COLOR.border, background: active ? 'var(--by-active)' : undefined }}
                >
                  {showBrand && <BrandBadge name={option.label} />}
                  <span
                    className={`min-w-0 flex-1 dark:text-slate-200 ${
                      wrapText
                        ? 'whitespace-normal break-words text-[13px] leading-snug'
                        : widePanel
                          ? 'whitespace-nowrap text-[13.5px]'
                          : 'truncate text-[13.5px]'
                    }`}
                    style={{ color: active ? COLOR.primary : COLOR.dark }}
                    title={option.label}
                  >
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface SuccessInfo {
  name: string;
  target: string;
  quantity: number;
  at: Date;
}

export default function BuatPesananCard() {
  const { user, topUp } = useAuth();
  const { addOrder } = useOrderHistory();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [target, setTarget] = useState('');
  const [quantity, setQuantity] = useState('');
  const [comments, setComments] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [orderNotice, setOrderNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);

  useEffect(() => {
    let alive = true;
    fetchServices().then((result) => {
      if (!alive) return;
      if (result.ok) setServices(result.services);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const categoryOptions = useMemo<Option[]>(() => Array.from(new Set(services.map((s) => s.category.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)).map((value) => ({ value, label: value })), [services]);
  const filteredServices = useMemo(() => category ? services.filter((s) => s.category.trim() === category) : services, [services, category]);
  const serviceOptions = useMemo<Option[]>(() => filteredServices.map((s) => ({ value: s.id, label: s.name })), [filteredServices]);
  const selected = useMemo(() => services.find((s) => s.id === serviceId) || null, [services, serviceId]);
  const description = selected ? parseDescription(selected.description) : null;
  const isCustomComment = isCustomCommentService(selected);

  // For custom-comment services the unit is counted per comment line (enter).
  const commentLines = useMemo(
    () => comments.split('\n').map((line) => line.trim()).filter(Boolean),
    [comments],
  );
  const manualQty = Number(quantity) || 0;
  const qty = isCustomComment ? commentLines.length : manualQty;

  const rate = selected ? applyMarkup(selected.rate, user?.plusActive) || 0 : 0;
  const price = Math.round((qty / 1000) * rate);

const handleOrder = async () => {
    if (!user || !selected || !target.trim() || qty <= 0) return;

    if (user.balance < price) {
      setOrderNotice({ ok: false, message: 'Saldo Anda tidak mencukupi untuk melakukan pemesanan ini.' });
      return;
    }

    const captured = { name: selected.name, target: target.trim(), qty };
    setOrdering(true);
    setOrderNotice(null);
    setSuccessInfo(null);
    
   const result = await placeOrder({
  serviceId: selected.id, // <- ini
  serviceName: selected.name, // <- ini juga
  link: target,
  quantity: qty,
  comments: isCustomComment ? commentLines.join('\n') : undefined,
  price: price
})
    setOrdering(false);

    const isProviderBalanceIssue = !result.ok && result.message.toLowerCase().includes('saldo');
    const orderIdFinal = result.orderId || String(Math.floor(100000 + Math.random() * 900000));
    const orderStatus = isProviderBalanceIssue ? 'pending' : 'proses';
    let riwayatMessage = ""; // tampung error riwayat di sini

    if (result.ok || isProviderBalanceIssue) {
      const now = new Date();
      topUp(-price);
      setSuccessInfo({ 
  name: captured.name, 
  target: captured.target, 
  quantity: captured.qty, // <-- TAMBAH INI
  at: now 
});

      addOrder({
        serviceName: captured.name,
        orderId: orderIdFinal,
        quantity: captured.qty,
        price,
        createdAt: now.getTime(),
        status: orderStatus,
      });

     // === SIMPAN KE DB ===
const tokenFromStorage = localStorage.getItem('token'); // <-- AMBIL LANGSUNG
if(!tokenFromStorage) {
  riwayatMessage = ` Gagal simpan riwayat: Token kosong. Silahkan login ulang`;
} else {
  try {
    const resRiwayat = await fetch('https://cekidku.my.id/api/riwayat_pesanan.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: tokenFromStorage, // <-- PAKAI INI
        orderId: orderIdFinal,
        serviceName: captured.name,
        quantity: captured.qty,
        price: price,
        status: orderStatus
      })
    });
    
    const dataRiwayat = await resRiwayat.json();
    
    if(!dataRiwayat.ok){
      riwayatMessage = ` Gagal simpan riwayat: ${dataRiwayat.message}`;
    }
  } catch(err: any) {
    riwayatMessage = ` Gagal konek riwayat: ${err.message}`;
  }
}
// === SELESAI ===

      const successMessage = isProviderBalanceIssue
        ? `Pesanan berhasil dibuat. ID #${orderIdFinal}`
        : `Pesanan berhasil dibuat. ID #${orderIdFinal}`;

      // Gabungin pesan sukses + error riwayat jadi 1
      setOrderNotice({ ok: riwayatMessage === "", message: successMessage + riwayatMessage });

      setTarget('');
      setQuantity('');
      setComments('');
    } else {
      setOrderNotice({ ok: false, message: result.message });
    }
  };
    const firstName = user?.username?.split(' ')[0] || user?.email?.split('@')[0] || 'Bos';
    
  return (
  <>
   <AiAssistantCard
        userName={firstName}
        category={category}
        serviceName={selected?.name ?? null}
        servicePriceText={selected ? formatRupiah(rate) : undefined}
        hasTarget={target.trim().length > 0}
        qty={qty}
        priceText={formatRupiah(price)}
        ordering={ordering}
        orderNotice={orderNotice}
      />
    <div className="w-full rounded-[18px] px-4 py-5 sm:px-6 lg:px-7" style={{ background: COLOR.surface, boxShadow: '0 22px 48px -22px rgba(23,32,51,.32), 0 6px 16px -10px rgba(23,32,51,.14)' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-[18px] w-[18px]" style={{ color: COLOR.primary }} strokeWidth={2} />
          <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: COLOR.dark }}>
            Buat Pesanan
          </h2>
        </div>
        <button
          type="button"
          onClick={() => document.getElementById('buat-pesanan-kategori')?.click()}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
          style={{ background: COLOR.primary }}
        >
          <Tag className="h-3 w-3" strokeWidth={2.2} />
          Kategori
        </button>
      </div>

      <div className="my-3.5 h-px w-full" style={{ background: COLOR.border }} />
      
{/* Success alert — pinned to the very top of the card */}

{successInfo && (
  <div
    role="status"
    className="mb-4 flex items-start gap-3 rounded-2xl border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-100/70 p-4 shadow-sm dark:border-emerald-700/50 dark:from-emerald-900/25 dark:to-emerald-900/15"
  >
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
      <CheckCircle2 className="h-5 w-5" strokeWidth={2.4} />
    </span>

    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-[14px] font-extrabold text-emerald-800 dark:text-emerald-300">
          Pesanan sukses dibuat!
        </p>
        <button
          onClick={() => {
            const textToCopy = `Pesanan sukses dibuat!\nLayanan: ${successInfo.name}\nTarget: ${successInfo.target}\nJumlah: ${successInfo.quantity}\nTanggal: ${new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(successInfo.at)}`;
            navigator.clipboard.writeText(textToCopy);
          }}
          className="shrink-0 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition-all hover:bg-emerald-500/20 active:scale-95 dark:bg-emerald-400/10 dark:text-emerald-300"
        >
          Copy
        </button>
      </div>

      <dl className="mt-1.5 space-y-0.5 text-[12px] leading-relaxed text-emerald-800/90 dark:text-emerald-300/90">
        <div className="flex gap-1.5">
          <dt className="shrink-0 font-semibold">Layanan:</dt>
          <dd className="min-w-0 font-medium break-words">{successInfo.name}</dd> {/* <-- FIX: hapus truncate, ganti break-words */}
        </div>
        <div className="flex gap-1.5">
          <dt className="shrink-0 font-semibold">Target:</dt>
          <dd className="min-w-0 font-medium font-mono text-[11.5px] break-words">{successInfo.target}</dd> {/* <-- FIX: hapus truncate */}
        </div>
        <div className="flex gap-1.5"> {/* <-- TAMBAH INI */}
          <dt className="shrink-0 font-semibold">Jumlah:</dt>
          <dd className="font-medium">{successInfo.quantity.toLocaleString('id-ID')}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="shrink-0 font-semibold">Tanggal:</dt>
          <dd className="font-medium">
            {new Intl.DateTimeFormat('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }).format(successInfo.at)}
          </dd>
        </div>
      </dl>
    </div>
  </div>
)}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-8">
        {/* ============ KIRI: input pesanan ============ */}
        <div className="space-y-5">
         {/* 1. Kategori */}
        <FormSection label="Kategori">
          <CustomSelect
            id="buat-pesanan-kategori"
            value={category}
            options={categoryOptions}
            disabled={loading}
            searchable
            searchPlaceholder="Cari kategori..."
            showBrand
            widePanel
            onChange={(value) => {
              setCategory(value);
              setServiceId('');
            }}
          />
        </FormSection>

        {/* 2. Layanan */}
        <FormSection label="Layanan">
          <CustomSelect
            id="buat-pesanan-layanan"
            value={serviceId}
            options={serviceOptions}
            disabled={!category || loading}
            wrapText
            searchable
            searchPlaceholder="Cari layanan..."
            onChange={setServiceId}
          />
        </FormSection>
        
        {/* 4. Target */}
        <FormSection label="Target (URL atau Username)">
          <input
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="https://instagram.com/username"
            className="h-11 w-full rounded-xl border bg-white px-3.5 text-[13.5px] outline-none transition-colors focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            style={{ borderColor: COLOR.border }}
          />
        </FormSection>

        {/* Custom Comments field */}
        {isCustomComment && (
          <FormSection label="Komentar (1 baris = 1 komentar)">
            <textarea
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              placeholder={'Tulis komentar di sini…\nSatu komentar per baris (tekan Enter)'}
              rows={5}
              className="w-full resize-y rounded-xl border bg-white px-3.5 py-2.5 text-[13.5px] leading-relaxed outline-none transition-colors focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              style={{ borderColor: COLOR.border }}
            />
            <p className="mt-1 text-[10.5px] text-slate-500 dark:text-slate-400">
              Jumlah komentar:{' '}
              <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                {commentLines.length}
              </span>
            </p>
          </FormSection>
        )}

        {/* 5. Jumlah Order */}
        <FormSection label="Jumlah Order">
          {isCustomComment ? (
            <div
              className="flex h-11 w-full items-center rounded-xl border bg-slate-50 px-3.5 font-mono text-[13.5px] text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              style={{ borderColor: COLOR.border }}
            >
              {commentLines.length} <span className="ml-1 text-slate-400 dark:text-slate-400">(otomatis dari baris komentar)</span>
            </div>
          ) : (
            <>
              <input
                type="number"
                min={selected?.min || undefined}
                max={selected?.max || undefined}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder="1000"
                className="h-11 w-full rounded-xl border bg-white px-3.5 font-mono text-[13.5px] outline-none transition-colors focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                style={{ borderColor: COLOR.border }}
              />
              {selected && (
                <p className="mt-1 text-[10.5px] text-slate-500 dark:text-slate-400">
                  Min {selected.min?.toLocaleString('id-ID') || '—'} · Max{' '}
                  {selected.max?.toLocaleString('id-ID') || '—'}
                </p>
              )}
            </>
          )}
        </FormSection>

        {/* 6. Harga */}
        <FormSection label="Harga">
          <div
            className="rounded-xl border-2 p-3.5"
            style={{ borderColor: COLOR.primary, background: 'var(--by-active)' }}
          >
            <p className="font-display text-[22px] font-extrabold" style={{ color: COLOR.primary }}>
              {formatRupiah(price)}
            </p>
            <p className="mt-0.5 text-[10.5px]" style={{ color: COLOR.secondary }}>
              Harga dihitung otomatis berdasarkan jumlah order
            </p>
            {user?.plusActive ? (
              <p className="mt-1.5 flex items-center gap-1 text-[10.5px] font-bold" style={{ color: COLOR.primary }}>
                <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
                Harga Boosteryuk Plus
              </p>
            ) : (
              <p className="mt-1 text-[10.5px] font-medium" style={{ color: COLOR.primary }}>
                Upgrade ke Boosteryuk Plus untuk harga lebih murah!
              </p>
            )}
          </div>
        </FormSection>

        {/* Checkbox */}
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={favoriteOnly}
            onChange={(event) => setFavoriteOnly(event.target.checked)}
            className="h-[15px] w-[15px] shrink-0 rounded"
            style={{ accentColor: COLOR.primary }}
          />
          <span className="text-[12.5px]" style={{ color: COLOR.secondary }}>
            Tampilkan layanan favorit saja
          </span>
        </label>

        {/* Pesan Button */}
        <button
          onClick={handleOrder}
          disabled={!user || !selected || !target.trim() || qty <= 0 || ordering}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white shadow-lg shadow-cyan-600/20 transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: COLOR.primary }}
        >
          {ordering ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Memproses…
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" strokeWidth={2.4} />
              Pesan
            </>
          )}
        </button>

        {orderNotice && (
          <div
            role="status"
            aria-live="polite"
            className={`flex items-start gap-2 rounded-xl border px-3 py-3 text-[12px] leading-relaxed ${
              orderNotice.ok
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800/60'
                : 'border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800/60'
            }`}
          >
            {orderNotice.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.4} />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.4} />
            )}
            <span className="font-semibold">{orderNotice.message}</span>
          </div>
        )}
        </div>

        {/* ============ KANAN: deskripsi layanan (sticky di desktop) ============ */}
        <div className="mt-6 lg:mt-0 lg:sticky lg:top-24">
          {selected ? (
            <div
              id="buat-pesanan-deskripsi"
              className="w-full rounded-xl border p-3.5 text-[12.5px] leading-relaxed"
              style={{ borderColor: COLOR.border, background: COLOR.surface, color: COLOR.secondary }}
            >
              <p className="font-bold text-[13.5px] text-slate-900 dark:text-white leading-snug">
                {selected.name}
              </p>

              <p className="mt-2 text-[12.5px] font-bold text-slate-800 dark:text-slate-200">
                Harga: {formatRate(selected.rate, user?.plusActive)}/K
              </p>

              <div className="my-3 border-t border-slate-200 dark:border-slate-700/60" />

              <p className="font-bold text-[12.5px] text-slate-900 dark:text-white">Deskripsi:</p>
              {description?.deskripsi ? (
                <div className="mt-1 space-y-1 text-slate-600 dark:text-slate-300">
                  {description.deskripsi.split(/(?=- )|\n/).map((line, idx) => {
                    const l = line.trim();
                    if (!l) return null;
                    return <p key={idx}>{l}</p>;
                  })}
                </div>
              ) : (
                <p className="mt-1 text-slate-500 dark:text-slate-400">-</p>
              )}

              {description?.catatan && description.catatan.length > 0 && (
                <>
                  {/* Enter spacing before Catatan */}
                  <div className="h-3" />
                  <p className="font-bold text-[12.5px] text-slate-900 dark:text-white">Catatan :</p>
                  <ul className="mt-1.5 space-y-1.5 text-slate-600 dark:text-slate-300">
                    {description.catatan.map((item, index) => (
                      <li key={index} className="flex items-start gap-1.5">
                        <span className="shrink-0 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="my-3 border-t border-slate-200 dark:border-slate-700/60" />

              <p className="font-bold text-[12.5px] text-slate-900 dark:text-white">Waktu Rata-Rata:</p>
              <p className="mt-0.5 text-slate-600 dark:text-slate-300">37 menit 19 detik</p>
            </div>
          ) : (
            <div
              className="flex min-h-[90px] w-full items-center justify-center rounded-xl border p-3.5 text-[12.5px]"
              style={{ borderColor: COLOR.border, color: 'var(--by-placeholder)', background: COLOR.muted }}
            >
              {loading ? 'Memuat layanan…' : 'Pilih layanan untuk melihat deskripsi'}
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-medium" style={{ color: COLOR.secondary }}>
        {label}
      </label>
      {children}
    </div>
  );
}
