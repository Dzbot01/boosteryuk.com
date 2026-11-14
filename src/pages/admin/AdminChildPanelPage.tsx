import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Globe, ExternalLink, Pencil, Trash2, X, Check, CircleAlert,
} from 'lucide-react';
import Reveal from '../../components/Reveal';
import { childPanelApi, type ChildPanel } from '../../services/childPanelApi';
import { PanelEditor, emptyDraft, toDraft, ROOT, type Draft, type PanelEditorApi } from '../../components/childpanel/PanelEditor';
import { tenantAssetUrl } from '../../lib/tenant';


/** Admin utama: endpoint child_panel.php khusus admin. */
const ADMIN_API: PanelEditorApi = {
  check: (sub, id) => childPanelApi.check(sub, id),
  save: (input) => childPanelApi.save(input),
  upload: (id, slot, data) => childPanelApi.upload(id, slot, data),
  videoSign: (id, ext, size) => childPanelApi.videoSign(id, ext, size),
};

export default function AdminChildPanelPage() {
  const navigate = useNavigate();
  const [panels, setPanels] = useState<ChildPanel[] | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setError('');
    const r = await childPanelApi.list();
    if (r.ok) setPanels(r.panels || []);
    else {
      setPanels([]);
      setError(r.message || 'Gagal memuat child panel.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), toast.ok ? 3500 : 7000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const remove = async (p: ChildPanel) => {
    if (!window.confirm(`Hapus child panel "${p.name}" (${p.hostname})? Subdomain langsung tidak aktif.`)) return;
    const r = await childPanelApi.remove(p.id);
    if (r.ok) {
      setPanels(r.panels || []);
      setToast({ ok: true, msg: `${p.hostname} dihapus.` });
    } else setToast({ ok: false, msg: r.message || 'Gagal menghapus.' });
  };

  const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/60 dark:bg-slate-800/80';

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-10 sm:px-6">
      <Reveal>
        <button
          onClick={() => navigate('/admin')}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.4} /> Admin Panel
        </button>
      </Reveal>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight text-slate-900 dark:text-white">Child Panel</h1>
          <p className="mt-1 text-[13.5px] text-slate-500 dark:text-slate-400">
            Kloning website di subdomain <b>nama.{ROOT}</b> dengan brand, tema, slider, dan markup harga sendiri.
          </p>
        </div>
        <button
          onClick={() => setDraft(emptyDraft())}
          className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-cyan-700 active:scale-95"
        >
          <Plus className="h-4 w-4" strokeWidth={2.6} /> Buat Child Panel
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {panels === null && <div className={`${card} h-24 animate-pulse`} />}
        {error && (
          <div className={`${card} flex items-center gap-2 text-[13px] text-rose-600`}>
            <CircleAlert className="h-4 w-4" /> {error}
          </div>
        )}
        {panels?.length === 0 && !error && (
          <div className={`${card} py-10 text-center text-[13.5px] text-slate-500`}>
            Belum ada child panel. Klik <b>Buat Child Panel</b> lalu isi nama subdomain.
          </div>
        )}
        {panels?.map((p) => {
          const logo = tenantAssetUrl(p, p.config?.logo);
          return (
            <article key={p.id} className={`${card} flex flex-wrap items-center gap-4`}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-700">
                {logo ? <img src={logo} alt="" className="h-full w-full object-contain" /> : <Globe className="h-5 w-5 text-slate-400" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-slate-900 dark:text-white">
                  {p.name}
                  <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${p.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700'}`}>
                    {p.status === 'active' ? 'Aktif' : 'Ditangguhkan'}
                  </span>
                </p>
                <a href={`https://${p.hostname}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-cyan-700 hover:underline dark:text-cyan-400">
                  {p.hostname} <ExternalLink className="h-3 w-3" />
                </a>
                <p className="mt-0.5 text-[11.5px] text-slate-400">
                  Markup SMM {p.markup_smm_pct}% · Agen AI {p.markup_agent_pct}%{p.owner_email ? ` · pemilik ${p.owner_email}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setDraft(toDraft(p))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
                  <Pencil className="h-3.5 w-3.5" /> Atur
                </button>
                <button onClick={() => void remove(p)} aria-label={`Hapus ${p.name}`} className="rounded-lg border border-rose-200 px-2.5 py-2 text-rose-600 hover:bg-rose-50 dark:border-rose-800/50 dark:hover:bg-rose-900/20">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {draft && (
        <PanelEditor
          initial={draft}
          api={ADMIN_API}
          onClose={() => setDraft(null)}
          onSaved={(res, msg) => {
            setPanels(res.panels || []);
            setDraft(null);
            setToast({ ok: true, msg });
          }}
        />
      )}

      {toast && (
        <div role="alert" className="fixed inset-x-4 top-5 z-[90] mx-auto flex max-w-sm items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {toast.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.8} /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
          <p className="flex-1 text-slate-700 dark:text-slate-200">{toast.msg}</p>
          <button onClick={() => setToast(null)} aria-label="Tutup" className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

