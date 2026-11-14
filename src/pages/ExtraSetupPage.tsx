import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, ExternalLink, Loader2, CircleAlert, Check, Wallet } from 'lucide-react';
import Seo from '../components/Seo';
import Reveal from '../components/Reveal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PanelEditor, emptyDraft, toDraft, type Draft, type PanelEditorApi } from '../components/childpanel/PanelEditor';
import { ownerPanelApi, type MyPanel } from '../services/childPanelApi';
import { planApi } from '../services/planApi';
import { useAuth } from '../context/AuthContext';

const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const tanggal = (s: string | null | undefined) =>
  s ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s.replace(' ', 'T'))) : '';

/**
 * Halaman pembuatan & pengaturan Child Panel paket EXTRA (/upgrade/extra).
 * - Belum punya panel: isi SEMUA pengaturan (sama dengan editor admin utama) → Bayar & Buat Panel.
 * - Sudah punya panel: ubah pengaturan kapan saja + perpanjang langganan.
 */
export default function ExtraSetupPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [panel, setPanel] = useState<MyPanel | null | undefined>(undefined);
  const [prices, setPrices] = useState({ extra: 20000, extraFirst: 10000, promo: true });
  const [extraUntil, setExtraUntil] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; msg: string; url?: string } | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  // Id panel yang baru dibuat oleh pembayaran — mencegah pembayaran ganda bila langkah unggah gambar diulang.
  const createdId = useRef<number | null>(null);

  const load = useCallback(async () => {
    const [mine, st] = await Promise.all([ownerPanelApi.mine(), planApi.status()]);
    setPanel(mine.ok ? mine.panel ?? null : null);
    if (st.ok) {
      setPrices({ extra: st.price_extra ?? 20000, extraFirst: st.price_extra_first ?? 10000, promo: st.promo_available !== false });
      setExtraUntil(st.extra_until ?? null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isNew = panel === null;
  const price = prices.promo ? prices.extraFirst : prices.extra;
  const balance = user?.balance ?? 0;

  const initial: Draft | null = useMemo(() => {
    if (panel === undefined) return null;
    if (panel) return toDraft({ ...panel, owner_email: null, created_at: '' });
    const d = emptyDraft();
    d.config = { ...d.config, voice: 'off', showMusic: false };
    return d;
  }, [panel]);

  const api: PanelEditorApi = useMemo(
    () => ({
      check: async (sub) => {
        const r = await planApi.checkSubdomain(sub);
        return { ok: r.ok, available: r.available, message: r.message };
      },
      save: async (input, isFirst) => {
        const body = { name: input.name, config: input.config, markup_smm_pct: input.markup_smm_pct, markup_agent_pct: input.markup_agent_pct };
        // Panel belum ada → BAYAR paket EXTRA sekaligus membuat panel dengan pengaturan ini.
        if (isFirst && !panel && !createdId.current) {
          if (balance < price) return { ok: false, message: `Saldo tidak cukup. Butuh ${rupiah(price)} — silakan deposit dulu.` };
          const r = await planApi.buy('extra', { subdomain: input.subdomain, panel_name: input.name, ...body });
          if (!r.ok || !r.panel_id) return { ok: false, message: r.message || 'Pembayaran EXTRA gagal.' };
          createdId.current = r.panel_id;
          return { ok: true, id: r.panel_id, hostname: r.child_panel?.hostname, url: r.child_panel ? `https://${r.child_panel.hostname}` : undefined };
        }
        const r = await ownerPanelApi.save(body);
        return { ok: r.ok, id: r.id ?? createdId.current ?? panel?.id, message: r.message, url: r.url, hostname: r.hostname };
      },
      upload: (_id, slot, data) => ownerPanelApi.upload(slot, data),
      videoSign: (_id, ext, size) => ownerPanelApi.videoSign(ext, size),
    }),
    [panel, balance, price],
  );

  const renew = async () => {
    if (!window.confirm(`Perpanjang Boosteryuk EXTRA 1 bulan seharga ${rupiah(prices.extra)}?`)) return;
    setRenewing(true);
    const r = await planApi.buy('extra');
    setRenewing(false);
    if (!r.ok) return setNotice({ ok: false, msg: r.message || 'Perpanjangan gagal.' });
    await refresh();
    await load();
    setNotice({ ok: true, msg: `EXTRA diperpanjang sampai ${tanggal(r.extra_until)}.` });
  };

  if (initial === null) {
    return (
      <div className="mx-auto flex max-w-3xl justify-center px-4 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const active = !!extraUntil && new Date(extraUntil.replace(' ', 'T')).getTime() > Date.now();

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-6 sm:px-6">
      <Seo title={isNew ? 'Buat Child Panel' : 'Pengaturan Child Panel'} noindex />
      <Link to="/plus" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Upgrade
      </Link>

      <Reveal>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Badge className="mb-2 gap-1"><Crown className="h-3 w-3" /> Boosteryuk EXTRA</Badge>
            <h1 className="font-display text-[24px] font-extrabold leading-tight text-foreground">
              {isNew ? 'Buat child panel kamu' : `Child panel ${panel?.name}`}
            </h1>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              {isNew
                ? 'Atur subdomain, logo, judul, warna, slider, video, dan markup harga. Panel langsung aktif setelah pembayaran.'
                : 'Ubah tampilan & markup kapan saja. Perubahan langsung tampil di panelmu.'}
            </p>
          </div>
          {!isNew && panel && (
            <div className="rounded-xl border border-border bg-card p-3 text-[12.5px]">
              <a href={`https://${panel.hostname}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-primary hover:underline">
                {panel.hostname} <ExternalLink className="h-3 w-3" />
              </a>
              <p className="mt-0.5 text-muted-foreground">
                {panel.expires_at ? (active ? `Aktif s/d ${tanggal(panel.expires_at)}` : 'Langganan habis — panel nonaktif') : 'Tanpa batas waktu'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void renew()} disabled={renewing}>
                  {renewing && <Loader2 className="animate-spin" />} Perpanjang {rupiah(prices.extra)}
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.open(`https://${panel.hostname}/panel-admin`, '_blank')}>
                  Admin Panel Toko
                </Button>
              </div>
            </div>
          )}
        </div>
      </Reveal>

      {notice && (
        <div role="alert" className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-semibold ${notice.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400' : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-400'}`}>
          {notice.ok ? <Check className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
          <span className="flex-1">{notice.msg}</span>
          {notice.url && (
            <a href={notice.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
              Buka panel <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      <PanelEditor
        key={editorKey}
        initial={initial}
        api={api}
        mode="owner"
        variant="page"
        title={isNew ? 'Pengaturan child panel' : 'Pengaturan tampilan & markup'}
        submitLabel={isNew ? `Bayar ${rupiah(price)} & Buat Panel` : 'Simpan perubahan'}
        footerExtra={
          isNew ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Wallet className="h-4 w-4" /> Saldo {rupiah(balance)}
              </span>
              <span className="text-muted-foreground">
                Total: <b className="text-[15px] text-primary">{rupiah(price)}</b>
                {prices.promo && <span className="ml-1.5 text-[11.5px]">(bulan pertama, selanjutnya {rupiah(prices.extra)}/bulan)</span>}
              </span>
              {balance < price && (
                <Button size="sm" variant="outline" onClick={() => navigate('/deposit')}>Saldo kurang — Deposit</Button>
              )}
            </div>
          ) : undefined
        }
        onClose={() => navigate('/plus')}
        onSaved={async (res) => {
          const wasNew = isNew;
          await refresh();
          await load();
          setEditorKey((k) => k + 1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setNotice({
            ok: true,
            msg: wasNew ? 'Pembayaran berhasil — child panel kamu sudah aktif!' : 'Pengaturan tersimpan dan langsung tampil di panel.',
            url: res.url,
          });
        }}
      />
    </div>
  );
}
