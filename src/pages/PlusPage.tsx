import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Sparkles, Crown, Loader2, CircleAlert, ExternalLink, ShieldCheck, BadgeCheck, Globe, Headset, TrendingUp, Tag } from 'lucide-react';
import Seo from '../components/Seo';
import Reveal from '../components/Reveal';
import AuthModal from '../components/AuthModal';
import SpotlightCard from '../components/SpotlightCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { staticSeo } from '../seo/content';
import { planApi, type PlanChoice } from '../services/planApi';

const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const tanggal = (s: string | null | undefined) =>
  s ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s.replace(' ', 'T'))) : '';

type Benefit = { text: string; icon: typeof Check; included: boolean };

const PLUS_BENEFITS: Benefit[] = [
  { text: 'Harga reseller untuk selamanya', icon: Tag, included: true },
  { text: 'Badge profil khusus reseller', icon: BadgeCheck, included: true },
  { text: 'Child Panel (website sendiri)', icon: Globe, included: false },
  { text: 'Full Support system', icon: Headset, included: false },
];
const EXTRA_BENEFITS: Benefit[] = [
  { text: 'Semua benefit Plus — harga reseller selamanya', icon: Tag, included: true },
  { text: 'Badge profil khusus reseller', icon: BadgeCheck, included: true },
  { text: 'Child Panel: website sendiri di nama.boosteryuk.com', icon: Globe, included: true },
  { text: 'Admin panel toko: atur markup, pantau pesanan & pendapatan', icon: TrendingUp, included: true },
  { text: 'Full Support system (prioritas)', icon: Headset, included: true },
];

function BenefitList({ items }: { items: Benefit[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((b) => (
        <li key={b.text} className={`flex items-start gap-2.5 text-[13.5px] ${b.included ? 'text-foreground' : 'text-muted-foreground'}`}>
          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${b.included ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
            {b.included ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
          </span>
          <span className={b.included ? '' : 'line-through decoration-muted-foreground/60'}>{b.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Halaman Upgrade: Boosteryuk Plus (sekali bayar) & Boosteryuk EXTRA (bulanan + child panel). */
export default function PlusPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const { theme } = useTheme();
  const plan = user?.plan;
  const [prices, setPrices] = useState({ plus: 5000, extra: 20000, extraFirst: 10000 });
  const [checkout, setCheckout] = useState<PlanChoice | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    planApi.status().then((r) => {
      if (r.ok) setPrices({ plus: r.price_plus ?? 5000, extra: r.price_extra ?? 20000, extraFirst: r.price_extra_first ?? 10000 });
    });
  }, []);

  const promo = !plan || plan.promo_available;
  const isPlus = !!user?.plusActive;
  const extraActive = !!plan?.extra_active;

  const choose = (p: PlanChoice) => {
    if (!user) return setAuthOpen(true);
    // EXTRA: halaman pembuatan/pengaturan child panel lengkap (logo, judul, tema, slider, dll).
    if (p === 'extra') return navigate('/upgrade/extra');
    setCheckout(p);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-8 sm:px-6">
      <Seo title={staticSeo('/plus')?.title} description={staticSeo('/plus')?.description} />

      {/* Deskripsi */}
      <Reveal>
        <section className="mx-auto max-w-2xl text-center">
          <Badge variant="secondary" className="mb-3 gap-1"><Sparkles className="h-3 w-3" /> Upgrade akun</Badge>
          <h1 className="font-display text-[28px] font-extrabold leading-tight tracking-tight text-foreground sm:text-[34px]">
            Jadi reseller, dapatkan harga terbaik
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
            Pilih <b className="text-foreground">Plus</b> untuk harga reseller selamanya dengan sekali bayar, atau{' '}
            <b className="text-foreground">EXTRA</b> untuk punya website panel sendiri (child panel) di subdomain kamu, lengkap dengan
            markup harga, pencatatan pendapatan, dan dukungan penuh.
          </p>
          {(isPlus || extraActive) && (
            <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 text-[12.5px]">
              {isPlus && <Badge className="gap-1"><ShieldCheck className="h-3 w-3" /> Plus aktif selamanya</Badge>}
              {extraActive && <Badge variant="outline" className="gap-1"><Crown className="h-3 w-3" /> EXTRA aktif s/d {tanggal(plan?.extra_until)}</Badge>}
            </div>
          )}
        </section>
      </Reveal>

      {/* Dua kartu paket */}
      <div className="mt-8 grid items-stretch gap-5 md:grid-cols-2">
        <Reveal delay={60}>
          <Card className="h-full rounded-3xl">
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-4.5 w-4.5" /></span>
                <CardTitle className="text-[18px]">Boosteryuk Plus</CardTitle>
              </div>
              <CardDescription>Untuk kamu yang rutin order dan ingin harga reseller.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-5">
              <div>
                <p className="font-display text-[32px] font-extrabold leading-none text-foreground">{rupiah(prices.plus)}</p>
                <p className="mt-1 text-[12.5px] text-muted-foreground">sekali bayar · berlaku selamanya</p>
              </div>
              <Separator />
              <BenefitList items={PLUS_BENEFITS} />
            </CardContent>
            <CardFooter>
              <Button size="lg" variant="outline" className="h-11 w-full rounded-xl text-[14px] font-bold" disabled={isPlus} onClick={() => choose('plus')}>
                {isPlus ? 'Sudah aktif' : 'Pilih Plus'}
              </Button>
            </CardFooter>
          </Card>
        </Reveal>

        <Reveal delay={110}>
          <SpotlightCard
            theme={theme === 'dark' ? 'dark' : 'light'}
            spotlightColor="var(--by-menu)"
            intensity={0.35}
            className="h-full !p-0 ring-2 ring-primary/40"
          >
            <div className="flex h-full flex-col gap-6 py-6">
              <div className="px-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Crown className="h-4.5 w-4.5" /></span>
                    <h2 className="text-[18px] font-semibold leading-none text-foreground">Boosteryuk EXTRA</h2>
                  </div>
                  <Badge>Paling lengkap</Badge>
                </div>
                <p className="mt-2 text-[13.5px] text-muted-foreground">Punya website panel sendiri dan dapat untung dari markup.</p>
              </div>
              <div className="flex-1 space-y-5 px-6">
                <div>
                  {promo && !extraActive ? (
                    <>
                      <div className="flex items-baseline gap-2">
                        <p className="font-display text-[32px] font-extrabold leading-none text-foreground">{rupiah(prices.extraFirst)}</p>
                        <p className="text-[14px] text-muted-foreground line-through">{rupiah(prices.extra)}</p>
                      </div>
                      <p className="mt-1 text-[12.5px] text-muted-foreground">bulan pertama untuk upgrade baru · selanjutnya {rupiah(prices.extra)}/bulan</p>
                    </>
                  ) : (
                    <>
                      <p className="font-display text-[32px] font-extrabold leading-none text-foreground">{rupiah(prices.extra)}</p>
                      <p className="mt-1 text-[12.5px] text-muted-foreground">per bulan</p>
                    </>
                  )}
                </div>
                <Separator />
                <BenefitList items={EXTRA_BENEFITS} />
                {plan?.child_panel && (
                  <a href={`https://${plan.child_panel.hostname}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary hover:underline">
                    {plan.child_panel.hostname} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="px-6">
                <Button size="lg" className="h-11 w-full rounded-xl text-[14px] font-bold" onClick={() => choose('extra')}>
                  {extraActive ? 'Perpanjang 1 bulan' : plan?.child_panel ? 'Aktifkan lagi' : 'Pilih EXTRA'}
                </Button>
              </div>
            </div>
          </SpotlightCard>
        </Reveal>
      </div>

      {checkout && user && (
        <CheckoutDialog
          choice={checkout}
          balance={user.balance}
          price={checkout === 'plus' ? prices.plus : promo ? prices.extraFirst : prices.extra}
          needSubdomain={checkout === 'extra' && !plan?.child_panel}
          onClose={() => setCheckout(null)}
          onDone={async () => {
            await refresh();
          }}
          onDeposit={() => navigate('/deposit')}
        />
      )}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode="login" />
    </div>
  );
}

function CheckoutDialog({
  choice, balance, price, needSubdomain, onClose, onDone, onDeposit,
}: {
  choice: PlanChoice; balance: number; price: number; needSubdomain: boolean;
  onClose: () => void; onDone: () => Promise<void>; onDeposit: () => void;
}) {
  const [sub, setSub] = useState('');
  const [name, setName] = useState('');
  const [subState, setSubState] = useState<{ ok: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ msg: string; url?: string } | null>(null);
  const enough = balance >= price;

  useEffect(() => {
    if (!needSubdomain || !sub) return setSubState(null);
    const t = window.setTimeout(async () => {
      const r = await planApi.checkSubdomain(sub);
      setSubState({ ok: !!r.available, msg: r.message || '' });
    }, 400);
    return () => window.clearTimeout(t);
  }, [sub, needSubdomain]);

  const pay = async () => {
    setErr('');
    if (needSubdomain && !subState?.ok) return setErr('Isi nama subdomain yang tersedia.');
    setLoading(true);
    const r = await planApi.buy(choice, needSubdomain ? { subdomain: sub, panel_name: name } : {});
    setLoading(false);
    if (!r.ok) return setErr(r.message || 'Upgrade gagal.');
    await onDone();
    setDone(
      choice === 'plus'
        ? { msg: 'Boosteryuk Plus aktif selamanya. Harga reseller sudah berlaku.' }
        : { msg: `Boosteryuk EXTRA aktif sampai ${tanggal(r.extra_until)}.`, url: r.child_panel ? `https://${r.child_panel.hostname}` : undefined },
    );
  };

  const inp = 'h-10 w-full rounded-lg border border-input bg-background px-3 text-[13px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onClick={() => !loading && onClose()}>
      <Card role="dialog" aria-modal="true" aria-labelledby="co-title" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-b-none rounded-t-3xl sm:rounded-3xl">
        <CardHeader>
          <CardTitle id="co-title" className="text-[17px]">{done ? 'Upgrade berhasil' : `Checkout ${choice === 'plus' ? 'Boosteryuk Plus' : 'Boosteryuk EXTRA'}`}</CardTitle>
          {!done && <CardDescription>Saldo akun dipotong setelah kamu menekan Bayar.</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          {done ? (
            <div className="space-y-3 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Check className="h-6 w-6" strokeWidth={3} /></span>
              <p className="text-[14px] text-foreground">{done.msg}</p>
              {done.url && (
                <a href={done.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
                  Buka child panel <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ) : (
            <>
              {needSubdomain && (
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-muted-foreground">Nama toko / panel</span>
                    <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Toko Guri" maxLength={80} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-semibold text-muted-foreground">Subdomain child panel</span>
                    <div className="flex items-center overflow-hidden rounded-lg border border-input focus-within:border-primary">
                      <input className="h-10 min-w-0 flex-1 bg-background px-3 text-[13px] text-foreground outline-none" value={sub} maxLength={32} placeholder="tokoguri" onChange={(e) => setSub(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
                      <span className="bg-muted px-2.5 text-[12px] font-semibold leading-10 text-muted-foreground">.boosteryuk.com</span>
                    </div>
                    {subState && <span className={`mt-1 block text-[11.5px] font-semibold ${subState.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{subState.msg}</span>}
                  </label>
                </div>
              )}
              <div className="space-y-2 rounded-xl bg-muted p-3.5 text-[13px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Saldo kamu</span><b className="text-foreground">{rupiah(balance)}</b></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total bayar</span><b className="text-[16px] text-primary">{rupiah(price)}</b></div>
                {choice === 'extra' && <p className="text-[11.5px] text-muted-foreground">Berlaku 1 bulan. Child panel nonaktif bila tidak diperpanjang.</p>}
              </div>
              {err && <p role="alert" className="flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-600"><CircleAlert className="h-4 w-4" /> {err}</p>}
            </>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          {done ? (
            <Button className="h-11 w-full rounded-xl font-bold" onClick={onClose}>Selesai</Button>
          ) : (
            <>
              <Button variant="ghost" className="h-11 rounded-xl" onClick={onClose} disabled={loading}>Batal</Button>
              {enough ? (
                <Button className="h-11 flex-1 rounded-xl font-bold" onClick={() => void pay()} disabled={loading} aria-busy={loading}>
                  {loading && <Loader2 className="animate-spin" />} {loading ? 'Memproses…' : `Bayar ${rupiah(price)}`}
                </Button>
              ) : (
                <Button className="h-11 flex-1 rounded-xl font-bold" onClick={onDeposit}>Saldo kurang — Deposit</Button>
              )}
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
