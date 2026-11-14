import { useCallback, useEffect, useMemo, useState } from 'react';
import { Wallet, Hourglass, Send, CheckCircle2, Loader2, Check, CircleAlert, Zap, Landmark, Smartphone, RefreshCw } from 'lucide-react';
import { withdrawApi, type WdBalance, type WdMethod, type WdRow, type WdStatus } from '../../services/childPanelApi';

const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
const waktu = (s: string | null) => {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? s : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
};
export const WD_STATUS: Record<WdStatus, { label: string; cls: string }> = {
  pending: { label: 'Diproses', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-900/25 dark:text-amber-400 dark:ring-amber-800/50' },
  paid: { label: 'Dibayar', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:ring-emerald-800/50' },
  rejected: { label: 'Ditolak', cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-900/25 dark:text-rose-400 dark:ring-rose-800/50' },
};

/**
 * Pencairan pendapatan markup child panel (pemilik panel).
 * Dipakai di Admin Panel Toko (subdomain) dan halaman /upgrade/extra (web utama).
 */
export default function WithdrawPanel() {
  const [balance, setBalance] = useState<WdBalance | null>(null);
  const [methods, setMethods] = useState<WdMethod[]>([]);
  const [history, setHistory] = useState<WdRow[]>([]);
  const [min, setMin] = useState(10000);
  const [holdDays, setHoldDays] = useState(3);
  const [err, setErr] = useState('');
  const [method, setMethod] = useState('dana');
  const [bank, setBank] = useState('');
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setErr('');
    const r = await withdrawApi.info();
    if (!r.ok) return setErr(r.message || 'Gagal memuat saldo pencairan.');
    setBalance(r.balance || null);
    setMethods(r.methods || []);
    setHistory(r.history || []);
    if (r.min) setMin(r.min);
    if (r.hold_days) setHoldDays(r.hold_days);
    // Isi otomatis alamat pencairan terakhir.
    if (r.last) {
      setMethod((m) => r.last?.method || m);
      setBank((b) => b || r.last?.bank_name || '');
      setNumber((v) => v || r.last?.account_number || '');
      setName((v) => v || r.last?.account_name || '');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const m = methods.find((x) => x.id === method);
  const isBank = m?.kind === 'bank';
  const amt = Math.floor(Number(amount) || 0);
  const fee = m?.fee ?? 0;
  const available = balance?.available ?? 0;
  const pendingOpen = (balance?.pending_count ?? 0) > 0;

  const problem = useMemo(() => {
    if (!m) return 'Pilih metode pencairan.';
    if (isBank && bank.trim().length < 2) return 'Isi nama bank.';
    const num = number.replace(/[\s.-]/g, '');
    if (!isBank && !/^(\+?62|0)8\d{8,12}$/.test(num)) return `Nomor ${m.label} harus nomor HP aktif (contoh 081234567890).`;
    if (isBank && !/^\d{6,20}$/.test(num)) return 'Nomor rekening hanya angka (6–20 digit).';
    if (name.trim().length < 3) return `Isi nama pemilik ${isBank ? 'rekening' : 'akun ' + m.label}.`;
    if (amt < min) return `Minimal pencairan ${rupiah(min)}.`;
    if (amt > available) return `Saldo yang bisa dicairkan ${rupiah(available)}.`;
    if (amt <= fee) return 'Jumlah harus lebih besar dari biaya admin.';
    return '';
  }, [m, isBank, bank, number, name, amt, min, available, fee]);

  const submit = async () => {
    if (problem || !m) return setMsg({ ok: false, text: problem });
    const tujuan = `${m.label}${isBank ? ` ${bank}` : ''} ${number} a.n. ${name}`;
    if (!window.confirm(`Cairkan ${rupiah(amt)} ke ${tujuan}?\nBiaya admin ${rupiah(fee)} — diterima ${rupiah(amt - fee)}.`)) return;
    setSending(true);
    setMsg(null);
    const r = await withdrawApi.request({ method, bank_name: isBank ? bank : undefined, account_number: number, account_name: name, amount: amt });
    setSending(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message || 'Gagal mengajukan pencairan.' });
    if (r.balance) setBalance(r.balance);
    if (r.history) setHistory(r.history);
    setAmount('');
    setMsg({ ok: true, text: r.message || 'Permintaan pencairan terkirim.' });
  };

  const card = 'rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-slate-800 dark:bg-slate-900';
  const inp = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none focus:border-cyan-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white';

  if (err) {
    return (
      <div className={`${card} flex items-center gap-2 text-[13px] text-rose-600`}>
        <CircleAlert className="h-4 w-4" /> <span className="flex-1">{err}</span>
        <button onClick={() => void load()} className="inline-flex items-center gap-1 font-semibold underline"><RefreshCw className="h-3.5 w-3.5" /> Coba lagi</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Bisa dicairkan', value: balance?.available, icon: Wallet, strong: true },
          { label: `Tertahan (maks ${holdDays} hari)`, value: balance?.held, icon: Hourglass },
          { label: 'Sedang diproses', value: balance?.pending, icon: Send },
          { label: 'Sudah dicairkan', value: balance?.paid, icon: CheckCircle2 },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`${card} flex items-center gap-3`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.strong ? 'by-menu-active text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11.5px] leading-tight text-slate-400">{s.label}</p>
                {balance === null ? (
                  <span className="mt-1 block h-[18px] w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                ) : (
                  <p className={`truncate font-bold text-slate-800 dark:text-slate-100 ${s.strong ? 'text-[17px]' : 'text-[15px]'}`}>{rupiah(s.value || 0)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className={card}>
        <p className="text-[14px] font-bold text-slate-800 dark:text-slate-100">Ajukan pencairan</p>
        <p className="mt-1 text-[12px] text-slate-500">
          Pendapatan dari pesanan yang dibatalkan tidak dihitung. Pesanan yang belum selesai bisa dicairkan setelah {holdDays} hari.
          Admin mentransfer manual lalu kamu dapat email konfirmasi.
        </p>

        <p className="mb-2 mt-4 text-[11.5px] font-semibold text-slate-500">Metode pencairan</p>
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Metode pencairan">
          {methods.map((x) => {
            const active = x.id === method;
            const Icon = x.kind === 'bank' ? Landmark : Smartphone;
            return (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMethod(x.id)}
                className={`relative flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition ${
                  active ? 'border-cyan-500 bg-cyan-50/60 ring-1 ring-cyan-500 dark:bg-cyan-900/20' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-cyan-600' : 'text-slate-400'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-slate-800 dark:text-slate-100">{x.label}</span>
                  <span className={`block text-[11px] ${x.fee === 0 ? 'font-semibold text-emerald-600' : 'text-slate-500'}`}>
                    {x.fee === 0 ? 'Gratis biaya' : `Biaya ${rupiah(x.fee)}`}
                  </span>
                </span>
                {x.recommended && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    <Zap className="h-3 w-3" /> Cepat
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {method !== 'dana' && methods.length > 0 && (
          <p className="mt-2 text-[11.5px] text-emerald-700 dark:text-emerald-400">
            Rekomendasi: pakai <button type="button" className="font-bold underline" onClick={() => setMethod('dana')}>DANA</button> — paling cepat & tanpa biaya.
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {isBank && (
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[11.5px] font-semibold text-slate-500">Nama bank</span>
              <input className={inp} value={bank} maxLength={60} onChange={(e) => setBank(e.target.value)} placeholder="BCA / BRI / BNI / Mandiri / BSI …" />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold text-slate-500">{isBank ? 'Nomor rekening' : `Nomor ${m?.label || 'e-wallet'}`}</span>
            <input className={inp} inputMode="numeric" value={number} maxLength={24} onChange={(e) => setNumber(e.target.value)} placeholder={isBank ? '1234567890' : '081234567890'} />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold text-slate-500">Nama pemilik {isBank ? 'rekening' : 'wallet'}</span>
            <input className={inp} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Sesuai nama terdaftar" autoComplete="name" />
          </label>
          <div className="sm:col-span-2">
            <div className="mb-1 flex items-center justify-between text-[11.5px] font-semibold text-slate-500">
              <label htmlFor="wd-amount">Jumlah withdraw</label>
              <button type="button" className="text-cyan-700 hover:underline disabled:opacity-50 dark:text-cyan-400" onClick={() => setAmount(String(available))} disabled={!available}>
                Tarik semua ({rupiah(available)})
              </button>
            </div>
            <input id="wd-amount" className={inp} type="number" inputMode="numeric" min={min} step={1000} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Minimal ${rupiah(min)}`} />
          </div>
        </div>

        {amt > 0 && (
          <dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-[12.5px] dark:bg-slate-800/60">
            <div><dt className="text-[11px] text-slate-400">Ditarik</dt><dd className="font-semibold">{rupiah(amt)}</dd></div>
            <div><dt className="text-[11px] text-slate-400">Biaya admin</dt><dd className="font-semibold">{rupiah(fee)}</dd></div>
            <div><dt className="text-[11px] text-slate-400">Kamu terima</dt><dd className="font-bold text-emerald-600">{rupiah(Math.max(0, amt - fee))}</dd></div>
          </dl>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void submit()}
            disabled={sending || pendingOpen || !balance}
            aria-busy={sending}
            className="by-menu-active inline-flex h-10 items-center gap-1.5 rounded-lg px-5 text-[13px] font-bold text-white disabled:opacity-60"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {sending ? 'Mengirim…' : 'Withdraw'}
          </button>
          {pendingOpen && <span className="text-[12px] font-semibold text-amber-600">Ada pencairan yang sedang diproses — tunggu selesai dulu.</span>}
          {msg && (
            <span role="status" className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${msg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
              {msg.ok ? <Check className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />} {msg.text}
            </span>
          )}
        </div>
      </div>

      <div className={`${card} overflow-x-auto p-0`}>
        <p className="px-4 pt-4 text-[13px] font-bold text-slate-800 dark:text-slate-100">Riwayat pencairan</p>
        <table className="mt-2 w-full min-w-[620px] text-left text-[12.5px]">
          <thead className="border-y border-slate-100 bg-slate-50/70 text-[10.5px] uppercase tracking-wider text-slate-400 dark:border-slate-800 dark:bg-slate-800/40">
            <tr>
              <th className="px-4 py-2.5">Waktu</th>
              <th className="px-4 py-2.5">Tujuan</th>
              <th className="px-4 py-2.5 text-right">Diterima</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {history.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">Belum ada pencairan.</td></tr>}
            {history.map((h) => (
              <tr key={h.id}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{waktu(h.created_at)}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{h.method_label}{h.bank_name ? ` · ${h.bank_name}` : ''} · {h.account_number}</p>
                  <p className="text-[11px] text-slate-400">a.n. {h.account_name}{h.admin_note ? ` — ${h.admin_note}` : ''}</p>
                </td>
                <td className="px-4 py-3 text-right font-bold">{rupiah(h.net_amount)}<p className="text-[10.5px] font-normal text-slate-400">dari {rupiah(h.amount)}</p></td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${WD_STATUS[h.status]?.cls || ''}`}>{WD_STATUS[h.status]?.label || h.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
