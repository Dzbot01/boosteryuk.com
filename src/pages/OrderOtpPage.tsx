import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, Check, CheckCircle2, Copy, KeyRound, LoaderCircle, RefreshCw, ShoppingCart, Smartphone, Timer, Wallet, X,
} from 'lucide-react';
import Seo from '../components/Seo';
import Reveal from '../components/Reveal';
import { CustomSelect, FormSection } from '../components/BuatPesananCard';
import { useAuth } from '../context/AuthContext';
import { otpApi, type OtpCountry, type OtpOrder, type OtpService, type OtpTier } from '../services/otpOrderApi';

const COLOR = {
  primary: 'var(--by-primary)',
  dark: 'var(--by-ink)',
  secondary: 'var(--by-ink-2)',
  border: 'var(--by-line)',
  surface: 'var(--by-surface)',
};
const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const angka = (n: number) => new Intl.NumberFormat('id-ID').format(n || 0);
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const POPULER = ['whatsapp', 'telegram', 'instagram', 'tiktok', 'shopee', 'google', 'facebook'];
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  membeli: { label: 'Memproses nomor', cls: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
  menunggu: { label: 'Menunggu kode', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  selesai: { label: 'Selesai', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  batal: { label: 'Dibatalkan', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  gagal: { label: 'Gagal', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
};

/**
 * Order Nomor (OTP) — alur sama dengan bot: layanan → negara → pilih harga (stok realtime)
 * → bayar pakai SALDO → nomor tampil → kode OTP masuk otomatis (maks 15 menit) / batal = saldo kembali.
 */
export default function OrderOtpPage() {
  const { user, refresh } = useAuth();
  const [services, setServices] = useState<OtpService[] | null>(null);
  const [countries, setCountries] = useState<OtpCountry[] | null>(null);
  const [catalogErr, setCatalogErr] = useState('');
  const [service, setService] = useState('');
  const [country, setCountry] = useState('');
  const [tiers, setTiers] = useState<OtpTier[] | null>(null);
  const [tiersLoading, setTiersLoading] = useState(false);
  const [tierErr, setTierErr] = useState('');
  const [harga, setHarga] = useState(0);
  const [ordering, setOrdering] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [orders, setOrders] = useState<OtpOrder[]>([]);
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState('');
  const [tick, setTick] = useState(0);
  const loadedAt = useRef(Date.now());

  const loadCatalog = useCallback(async () => {
    setCatalogErr('');
    const [s, c] = await Promise.all([otpApi.services(), otpApi.countries()]);
    if (!s.ok || !c.ok) {
      setCatalogErr(s.message || c.message || 'Daftar layanan belum bisa dimuat.');
      setServices([]);
      setCountries([]);
      return;
    }
    setServices(s.services || []);
    setCountries(c.countries || []);
  }, []);

  const loadOrders = useCallback(async () => {
    const r = await otpApi.list();
    if (r.ok) {
      setOrders(r.orders || []);
      loadedAt.current = Date.now();
    }
  }, []);

  useEffect(() => {
    void loadCatalog();
    void loadOrders();
  }, [loadCatalog, loadOrders]);

  // Harga & stok realtime untuk layanan + negara terpilih.
  const loadTiers = useCallback(async () => {
    if (!service || !country) return;
    setTiersLoading(true);
    setTierErr('');
    const r = await otpApi.prices(service, country);
    setTiersLoading(false);
    if (!r.ok) {
      setTiers([]);
      return setTierErr(r.message || 'Harga belum bisa dimuat.');
    }
    const list = r.tiers || [];
    setTiers(list);
    setHarga((h) => (list.some((t) => t.harga === h) ? h : list[0]?.harga || 0));
  }, [service, country]);

  useEffect(() => {
    setTiers(null);
    setHarga(0);
    void loadTiers();
  }, [loadTiers]);

  // Order aktif: cek kode setiap 5 detik, hitung mundur tiap detik.
  const active = orders.filter((o) => o.status === 'menunggu' || o.status === 'membeli');
  useEffect(() => {
    if (!active.length) return;
    const t1 = window.setInterval(() => setTick((x) => x + 1), 1000);
    const t2 = window.setInterval(async () => {
      for (const o of active) {
        const r = await otpApi.status(o.order_id);
        if (r.ok && r.order) {
          const next = r.order;
          setOrders((list) => list.map((x) => (x.order_id === next.order_id ? next : x)));
          if (next.status !== o.status) {
            loadedAt.current = Date.now();
            if (next.status === 'selesai') setNotice({ ok: true, message: `Kode OTP masuk: ${next.code}` });
            else if (next.refunded) {
              setNotice({ ok: false, message: `${next.note || 'Order berakhir'} — saldo ${rupiah(next.price)} dikembalikan.` });
              void refresh();
            }
          }
        }
      }
    }, 5000);
    return () => {
      window.clearInterval(t1);
      window.clearInterval(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.map((o) => o.order_id + o.status).join('|')]);

  const serviceOptions = useMemo(() => {
    if (!services) return [];
    const pop = POPULER.map((p) => services.find((s) => s.name.toLowerCase() === p)).filter(Boolean) as OtpService[];
    const rest = services.filter((s) => !pop.includes(s));
    return [...pop, ...rest].map((s) => ({ value: s.code, label: s.name }));
  }, [services]);
  const countryOptions = useMemo(() => {
    if (!countries) return [];
    const id = countries.find((c) => c.name.toLowerCase() === 'indonesia');
    return [...(id ? [id] : []), ...countries.filter((c) => c !== id)].map((c) => ({ value: c.id, label: c.name }));
  }, [countries]);

  const tier = tiers?.find((t) => t.harga === harga) || null;
  const balance = user?.balance ?? 0;
  const svcName = services?.find((s) => s.code === service)?.name || '';
  const ctyName = countries?.find((c) => c.id === country)?.name || '';

  const order = async () => {
    if (!user || !tier) return;
    if (balance < tier.harga) return setNotice({ ok: false, message: 'Saldo tidak cukup. Silakan deposit dulu.' });
    setOrdering(true);
    setNotice(null);
    const r = await otpApi.buy(service, country, tier.harga);
    setOrdering(false);
    await refresh();
    if (!r.ok) {
      setNotice({ ok: false, message: r.message || 'Order gagal.' });
      if (/berubah|stok/i.test(r.message || '')) void loadTiers();
      return void loadOrders();
    }
    setNotice({ ok: true, message: r.message || 'Nomor siap!' });
    await loadOrders();
    document.getElementById('otp-aktif')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cancel = async (o: OtpOrder) => {
    if (!window.confirm(`Batalkan nomor +${o.phone}? Saldo ${rupiah(o.price)} dikembalikan.`)) return;
    setBusy(o.order_id);
    const r = await otpApi.cancel(o.order_id);
    setBusy('');
    if (r.order) setOrders((list) => list.map((x) => (x.order_id === r.order!.order_id ? r.order! : x)));
    setNotice({ ok: r.ok, message: r.message || (r.ok ? 'Dibatalkan.' : 'Gagal membatalkan.') });
    if (r.ok) void refresh();
  };

  const copy = (key: string, v: string) => {
    void navigator.clipboard?.writeText(v).then(() => {
      setCopied(key);
      window.setTimeout(() => setCopied(''), 1500);
    });
  };
  const elapsed = Math.floor((Date.now() - loadedAt.current) / 1000);
  void tick;

  const inputCls = 'h-11 w-full rounded-xl border bg-white px-3.5 text-[13.5px] dark:border-slate-600 dark:bg-slate-800 dark:text-white';

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6">
      <Seo title="Order Nomor OTP" />
      <Reveal>
        <div className="mb-5">
          <h1 className="font-display text-[24px] font-extrabold tracking-tight" style={{ color: COLOR.dark }}>Order Nomor OTP</h1>
          <p className="mt-1 text-[13px]" style={{ color: COLOR.secondary }}>
            Nomor virtual untuk verifikasi WhatsApp, Telegram, dan aplikasi lain. Stok & harga realtime, dibayar pakai saldo.
          </p>
        </div>
      </Reveal>

      <div className="w-full rounded-[18px] px-4 py-5 sm:px-6 lg:px-7" style={{ background: COLOR.surface, boxShadow: '0 22px 48px -22px rgba(23,32,51,.32), 0 6px 16px -10px rgba(23,32,51,.14)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-[18px] w-[18px]" style={{ color: COLOR.primary }} strokeWidth={2} />
            <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: COLOR.dark }}>Buat Pesanan Nomor</h2>
          </div>
          <span className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-white" style={{ background: COLOR.primary }}>
            <Wallet className="h-3 w-3" strokeWidth={2.2} /> {rupiah(balance)}
          </span>
        </div>
        <div className="my-3.5 h-px w-full" style={{ background: COLOR.border }} />

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-8">
          {/* KIRI: form order (field sama dengan alur bot: layanan → negara → harga) */}
          <div className="space-y-5">
            {catalogErr && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-[12px] font-semibold text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40">
                <AlertCircle className="h-4 w-4 shrink-0" /> <span className="flex-1">{catalogErr}</span>
                <button onClick={() => void loadCatalog()} className="inline-flex items-center gap-1 underline"><RefreshCw className="h-3.5 w-3.5" /> Coba lagi</button>
              </div>
            )}
            <FormSection label="Layanan / Aplikasi">
              <CustomSelect
                id="otp-layanan"
                value={service}
                options={serviceOptions}
                disabled={!services?.length}
                placeholder={services === null ? 'Memuat layanan…' : 'Pilih layanan…'}
                searchable
                searchPlaceholder="Cari layanan (whatsapp, telegram…)"
                onChange={setService}
              />
            </FormSection>

            <FormSection label="Negara">
              <CustomSelect
                id="otp-negara"
                value={country}
                options={countryOptions}
                disabled={!countries?.length}
                placeholder={countries === null ? 'Memuat negara…' : 'Pilih negara…'}
                searchable
                searchPlaceholder="Cari negara…"
                onChange={setCountry}
              />
            </FormSection>

            <FormSection label="Pilih Harga (stok realtime)">
              {!service || !country ? (
                <div className={`${inputCls} flex items-center text-slate-400`} style={{ borderColor: COLOR.border }}>Pilih layanan & negara dulu</div>
              ) : tiersLoading && !tiers ? (
                <div className={`${inputCls} flex items-center gap-2 text-slate-500`} style={{ borderColor: COLOR.border }}>
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Mengecek stok…
                </div>
              ) : tierErr || !tiers?.length ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12.5px] font-semibold text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300">
                  {tierErr || 'Stok sedang kosong. Coba negara lain.'}
                </div>
              ) : (
                <div role="radiogroup" aria-label="Pilih harga" className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {tiers.map((t, i) => {
                    const on = t.harga === harga;
                    return (
                      <button
                        key={t.harga}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setHarga(t.harga)}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition ${on ? 'ring-2' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        style={{ borderColor: on ? COLOR.primary : COLOR.border, ...(on ? { background: 'var(--by-active)', ['--tw-ring-color' as string]: COLOR.primary } : {}) }}
                      >
                        <span>
                          <span className="block font-mono text-[14px] font-bold" style={{ color: on ? COLOR.primary : COLOR.dark }}>{rupiah(t.harga)}</span>
                          <span className="block text-[11px] text-slate-500">Stok {angka(t.stok)}</span>
                        </span>
                        {i === 0 && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">Termurah</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {tiers && tiers.length > 0 && (
                <button type="button" onClick={() => void loadTiers()} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: COLOR.primary }}>
                  <RefreshCw className={`h-3 w-3 ${tiersLoading ? 'animate-spin' : ''}`} /> Perbarui stok
                </button>
              )}
            </FormSection>

            <FormSection label="Harga">
              <div className="rounded-xl border-2 p-3.5" style={{ borderColor: COLOR.primary, background: 'var(--by-active)' }}>
                <p className="font-display text-[22px] font-extrabold" style={{ color: COLOR.primary }}>{rupiah(tier?.harga || 0)}</p>
                <p className="mt-0.5 text-[10.5px]" style={{ color: COLOR.secondary }}>
                  {tier ? `${svcName} • ${ctyName} — dibayar dengan saldo, tanpa biaya admin` : 'Harga tampil setelah memilih layanan, negara, dan tier'}
                </p>
                {tier && balance < tier.harga && (
                  <p className="mt-1.5 text-[11px] font-bold text-rose-600">
                    Saldo kurang {rupiah(tier.harga - balance)} — <Link to="/deposit" className="underline">Deposit</Link>
                  </p>
                )}
              </div>
            </FormSection>

            <button
              onClick={() => void order()}
              disabled={!user || !tier || ordering || balance < (tier?.harga || 0)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-bold text-white shadow-lg shadow-cyan-600/20 transition-all hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: COLOR.primary }}
            >
              {ordering ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Memproses nomor…</> : <><ShoppingCart className="h-4 w-4" strokeWidth={2.4} /> Pesan Nomor</>}
            </button>

            {notice && (
              <div role="status" aria-live="polite" className={`flex items-start gap-2 rounded-xl border px-3 py-3 text-[12px] leading-relaxed ${notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40'}`}>
                {notice.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span className="flex-1 font-semibold">{notice.message}</span>
                <button onClick={() => setNotice(null)} aria-label="Tutup"><X className="h-3.5 w-3.5" /></button>
              </div>
            )}
          </div>

          {/* KANAN: nomor aktif & riwayat */}
          <div id="otp-aktif" className="mt-6 space-y-3 lg:sticky lg:top-24 lg:mt-0">
            <div className="rounded-xl border p-3.5 text-[12.5px] leading-relaxed" style={{ borderColor: COLOR.border, color: COLOR.secondary }}>
              <p className="text-[13.5px] font-bold text-slate-900 dark:text-white">Cara pakai</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                <li>Pilih layanan, negara, lalu harga (termurah di atas).</li>
                <li>Klik <b>Pesan Nomor</b> — saldo dipotong, nomor langsung tampil.</li>
                <li>Masukkan nomor di aplikasi & minta kode. Kode muncul otomatis di sini (maks 15 menit).</li>
                <li>Kode tidak masuk / nomor bermasalah? <b>Batalkan</b> — saldo kembali utuh.</li>
              </ol>
            </div>

            {orders.length === 0 && <p className="px-1 text-[12px] text-slate-400">Belum ada order nomor.</p>}
            {orders.slice(0, 8).map((o) => {
              const st = STATUS_LABEL[o.status] || STATUS_LABEL.gagal;
              const left = o.seconds_left != null ? Math.max(0, o.seconds_left - elapsed) : null;
              const live = o.status === 'menunggu';
              return (
                <div key={o.order_id} className={`rounded-xl border p-3.5 ${live ? 'shadow-md' : ''}`} style={{ borderColor: live ? COLOR.primary : COLOR.border, background: COLOR.surface }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-bold text-slate-900 dark:text-white">{o.service} • {o.country}</p>
                      <p className="text-[11px] text-slate-400">#{o.order_id} · {rupiah(o.price)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${st.cls}`}>{st.label}</span>
                  </div>
                  {o.phone && (
                    <button type="button" onClick={() => copy(o.order_id + 'p', '+' + o.phone)} className="mt-2.5 flex w-full items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-left dark:bg-slate-800">
                      <span>
                        <span className="block text-[10.5px] text-slate-400">Nomor</span>
                        <span className="block font-mono text-[16px] font-bold text-slate-900 dark:text-white">+{o.phone}</span>
                      </span>
                      {copied === o.order_id + 'p' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-slate-400" />}
                    </button>
                  )}
                  {o.code && (
                    <button type="button" onClick={() => copy(o.order_id + 'c', o.code!)} className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-left dark:bg-emerald-900/25">
                      <span>
                        <span className="block text-[10.5px] text-emerald-700">Kode OTP</span>
                        <span className="block font-mono text-[20px] font-extrabold tracking-widest text-emerald-700 dark:text-emerald-300">{o.code}</span>
                      </span>
                      {copied === o.order_id + 'c' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-emerald-600" />}
                    </button>
                  )}
                  {live && (
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-amber-600">
                        <Timer className="h-3.5 w-3.5" /> <KeyRound className="h-3.5 w-3.5" /> Menunggu kode · <span className="tabular-nums">{mmss(left ?? 0)}</span>
                      </span>
                      <button onClick={() => void cancel(o)} disabled={busy === o.order_id} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[11.5px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60 dark:border-rose-800/50">
                        {busy === o.order_id && <LoaderCircle className="h-3 w-3 animate-spin" />} Batalkan
                      </button>
                    </div>
                  )}
                  {o.refunded && <p className="mt-2 text-[11px] text-slate-500">{o.note} — saldo dikembalikan.</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
