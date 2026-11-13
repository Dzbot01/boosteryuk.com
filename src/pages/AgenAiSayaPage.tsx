import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Plus, RefreshCw, Copy, Check, CalendarClock, AlertTriangle, Loader2, Inbox } from 'lucide-react';
import Seo from '../components/Seo';
import { getMyAgents, resendAgentCode, type MyAgent } from '../services/agentApi';

const rupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const tanggal = (ms: number | null) =>
  ms ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(ms) : '—';
const tanggalJam = (ms: number) =>
  new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ms);

type Tab = 'aktif' | 'kedaluwarsa' | 'semua';
const REMINDER_DAYS = 7;

const STATE_META: Record<MyAgent['state'], { label: string; cls: string }> = {
  aktif: { label: 'Aktif', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:ring-emerald-800/50' },
  menunggu: { label: 'Menunggu WhatsApp ditautkan', cls: 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-900/25 dark:text-cyan-400 dark:ring-cyan-800/50' },
  kedaluwarsa: { label: 'Kedaluwarsa', cls: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/25 dark:text-rose-400 dark:ring-rose-800/50' },
};

function dueText(a: MyAgent): { text: string; tone: 'ok' | 'warn' | 'bad' } {
  if (a.sisa_hari === null) return { text: 'Tanpa jatuh tempo', tone: 'ok' };
  if (a.state === 'kedaluwarsa') return { text: `Lewat ${Math.abs(a.sisa_hari)} hari`, tone: 'bad' };
  if (a.sisa_hari <= 1) return { text: a.sisa_hari <= 0 ? 'Jatuh tempo hari ini' : 'Jatuh tempo besok', tone: 'bad' };
  if (a.sisa_hari <= REMINDER_DAYS) return { text: `${a.sisa_hari} hari lagi`, tone: 'warn' };
  return { text: `${a.sisa_hari} hari lagi`, tone: 'ok' };
}

export default function AgenAiSayaPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<MyAgent[] | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('aktif');
  const [copied, setCopied] = useState('');
  const [resending, setResending] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setAgents(null);
    setError('');
    const r = await getMyAgents();
    if (!r.ok) setError(r.message || 'Gagal memuat data agen.');
    setAgents(r.agents);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const list = agents || [];
    return {
      aktif: list.filter((a) => a.state !== 'kedaluwarsa').length,
      kedaluwarsa: list.filter((a) => a.state === 'kedaluwarsa').length,
      semua: list.length,
    };
  }, [agents]);

  const visible = useMemo(
    () => (agents || []).filter((a) => (tab === 'semua' ? true : tab === 'aktif' ? a.state !== 'kedaluwarsa' : a.state === 'kedaluwarsa')),
    [agents, tab],
  );

  const copy = (id: string) => {
    navigator.clipboard?.writeText(id).then(
      () => {
        setCopied(id);
        window.setTimeout(() => setCopied(''), 1500);
      },
      () => {},
    );
  };

  const resend = async (id: string) => {
    setResending(id);
    setNotice(null);
    const r = await resendAgentCode(id);
    setResending('');
    setNotice(r?.ok ? { ok: true, msg: 'Kode pairing baru dikirim ke email kamu.' } : { ok: false, msg: r?.message || 'Gagal mengirim ulang kode.' });
  };

  const card = 'rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-slate-800 dark:bg-slate-900';

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-6 sm:px-6">
      <Seo title="Agen AI Saya" description="Daftar Agen AI WhatsApp yang kamu sewa beserta jatuh temponya." noindex />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500 text-white">
            <Bot className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <div>
            <h1 className="text-[20px] font-bold leading-tight text-slate-900 dark:text-white">Agen AI Saya</h1>
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
              {agents === null ? 'Memuat…' : `${counts.aktif} agen aktif · ${counts.kedaluwarsa} kedaluwarsa`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Muat ulang"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-4 w-4 ${agents === null ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/sewa-agen-ai')}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 text-[13px] font-semibold text-white hover:bg-cyan-700"
          >
            <Plus className="h-4 w-4" strokeWidth={2.4} /> Sewa Agen
          </button>
        </div>
      </div>

      <div className="mt-5 flex gap-1.5" role="tablist">
        {(['aktif', 'kedaluwarsa', 'semua'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-9 rounded-lg px-3 text-[12.5px] font-semibold capitalize transition-colors ${
              tab === t
                ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {t} <span className="ml-0.5 opacity-60">{agents ? counts[t] : ''}</span>
          </button>
        ))}
      </div>

      {notice && (
        <div
          role="alert"
          className={`mt-4 rounded-lg border px-3.5 py-2.5 text-[12.5px] font-semibold ${
            notice.ok
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400'
              : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-400'
          }`}
        >
          {notice.msg}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {agents === null &&
          [0, 1].map((i) => (
            <div key={i} className={`${card} p-4`}>
              <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((j) => (
                  <div key={j} className="h-8 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            </div>
          ))}

        {agents !== null && error && (
          <div className={`${card} flex items-center gap-3 p-4 text-[13px] text-rose-700 dark:text-rose-400`}>
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {agents !== null && !error && visible.length === 0 && (
          <div className={`${card} flex flex-col items-center px-6 py-12 text-center`}>
            <Inbox className="h-8 w-8 text-slate-300 dark:text-slate-600" strokeWidth={1.6} />
            <p className="mt-3 text-[14px] font-semibold text-slate-700 dark:text-slate-200">
              {tab === 'kedaluwarsa' ? 'Tidak ada agen yang kedaluwarsa' : 'Belum ada Agen AI'}
            </p>
            {tab !== 'kedaluwarsa' && (
              <button
                type="button"
                onClick={() => navigate('/sewa-agen-ai')}
                className="mt-4 rounded-lg bg-cyan-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-cyan-700"
              >
                Sewa Agen AI
              </button>
            )}
          </div>
        )}

        {visible.map((a) => {
          const st = STATE_META[a.state];
          const due = dueText(a);
          const rows: [string, React.ReactNode][] = [
            ['Nomor Pemilik / Bot', a.nomor_pemilik || a.nomor_bot || '—'],
            ['Nama Toko', a.nama_toko || '—'],
            ['Alamat E-wallet', a.ewallet || '—'],
            ['Payment Gateway', a.payment_gateway ? 'Aktif' : 'Tidak termasuk'],
            ['Durasi Sewa', `${a.durasi_bulan} bulan`],
            ['Harga', rupiah(a.harga)],
            ['Tanggal Pembelian', tanggalJam(a.dibeli)],
            ['Jatuh Tempo', tanggal(a.jatuh_tempo)],
          ];
          return (
            <article key={a.order_id} className={`${card} p-4`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-bold text-slate-900 dark:text-white">
                    {a.nama_ai || 'Agen AI WhatsApp'}
                    {a.paket && <span className="ml-2 align-middle text-[11.5px] font-semibold text-slate-400">Paket {a.paket}</span>}
                  </h2>
                  <button
                    type="button"
                    onClick={() => copy(a.order_id)}
                    className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11.5px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Salin ID pesanan"
                  >
                    #{a.order_id}
                    {copied === a.order_id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${st.cls}`}>{st.label}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                      due.tone === 'bad'
                        ? 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/25 dark:text-rose-400 dark:ring-rose-800/50'
                        : due.tone === 'warn'
                          ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/25 dark:text-amber-400 dark:ring-amber-800/50'
                          : 'bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700'
                    }`}
                  >
                    <CalendarClock className="h-3 w-3" /> {due.text}
                  </span>
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800 sm:grid-cols-4">
                {rows.map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-[11px] text-slate-400 dark:text-slate-500">{k}</dt>
                    <dd className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-3 flex flex-wrap gap-2">
                {a.state === 'menunggu' && (
                  <button
                    type="button"
                    disabled={resending === a.order_id}
                    onClick={() => void resend(a.order_id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {resending === a.order_id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Kirim ulang kode pairing
                  </button>
                )}
                {(due.tone !== 'ok' || a.state === 'kedaluwarsa') && (
                  <button
                    type="button"
                    onClick={() => navigate('/sewa-agen-ai')}
                    className="rounded-lg bg-cyan-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-cyan-700"
                  >
                    Sewa Lagi
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
