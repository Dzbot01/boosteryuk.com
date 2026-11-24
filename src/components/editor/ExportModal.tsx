import { useState } from 'react';
import { X } from 'lucide-react';
import { useEditor } from './store';
import { C } from './ui';
import type { ExportSettings } from './exporter';

const RESOLUTIONS = ['480p', '720p', '1080p', '2K', '4K'];
const FRAME_RATES = [24, 30, 60];
const FORMATS = ['MP4', 'MOV'];
const BITRATES = [2000, 4000, 8000, 12000, 20000];

export default function ExportModal({ onExport, busy }: { onExport: (s: ExportSettings) => Promise<void>; busy: boolean }) {
  const { modal, setModal, title } = useEditor();
  const [settings, setSettings] = useState<ExportSettings>({ resolution: '1080p', fps: 30, format: 'MP4', bitrate: 8000, filename: title || 'Boosteryuk-export' });
  const [err, setErr] = useState('');

  if (modal !== 'export') return null;

  const chip = (active: boolean): React.CSSProperties => ({
    background: active ? C.raised : 'transparent',
    color: active ? C.accent : C.text2,
    boxShadow: active ? `inset 0 0 0 1px ${C.accent}` : `inset 0 0 0 1px ${C.border}`,
  });

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex items-center gap-3 py-2">
      <span className="w-[86px] shrink-0 text-[12px]" style={{ color: C.text2 }}>{label}</span>
      <span className="flex flex-wrap items-center gap-1.5">{children}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Export">
      <div className="w-full max-w-[420px] overflow-hidden rounded-[6px] border shadow-2xl" style={{ background: C.panel, borderColor: C.border }}>
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: C.border }}>
          <h3 className="text-[13px] font-bold" style={{ color: C.text }}>Export</h3>
          <button type="button" aria-label="Tutup dialog export" onClick={() => { setModal(''); setErr(''); }} className="text-[16px]" style={{ color: C.text2 }}>
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div className="px-4 py-2">
          <Row label="Resolution">
            {RESOLUTIONS.map((r) => (
              <button key={r} type="button" onClick={() => setSettings((s) => ({ ...s, resolution: r }))} className="rounded-[4px] px-2.5 py-1 text-[11px] font-semibold transition-colors duration-[120ms]" style={chip(settings.resolution === r)}>
                {r}
              </button>
            ))}
          </Row>
          <Row label="Frame rate">
            {FRAME_RATES.map((f) => (
              <button key={f} type="button" onClick={() => setSettings((s) => ({ ...s, fps: f }))} className="rounded-[4px] px-2.5 py-1 text-[11px] font-semibold transition-colors duration-[120ms]" style={chip(settings.fps === f)}>
                {f} fps
              </button>
            ))}
          </Row>
          <Row label="Format">
            {FORMATS.map((f) => (
              <button key={f} type="button" onClick={() => setSettings((s) => ({ ...s, format: f }))} className="rounded-[4px] px-2.5 py-1 text-[11px] font-semibold transition-colors duration-[120ms]" style={chip(settings.format === f)}>
                {f}
              </button>
            ))}
          </Row>
          <Row label="Bitrate">
            {BITRATES.map((b) => (
              <button key={b} type="button" onClick={() => setSettings((s) => ({ ...s, bitrate: b }))} className="rounded-[4px] px-2.5 py-1 text-[11px] font-semibold transition-colors duration-[120ms]" style={chip(settings.bitrate === b)}>
                {b} kbps
              </button>
            ))}
          </Row>
          <Row label="Filename">
            <input
              value={settings.filename}
              onChange={(e) => setSettings((s) => ({ ...s, filename: e.target.value }))}
              aria-label="Nama file"
              className="h-8 w-full rounded-[4px] border px-2 text-[12px] outline-none"
              style={{ background: C.raised, borderColor: C.border, color: C.text }}
            />
          </Row>
          {err && <p className="pt-1 text-[11px]" style={{ color: '#ff6b6b' }}>{err}</p>}
          <p className="pt-1 text-[10.5px]" style={{ color: C.text3 }}>
            Catatan browser: hasil video direkam sebagai .webm (VP9/Opus) karena MediaRecorder; clip mock tanpa file asli dilewati.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3" style={{ borderColor: C.border }}>
          <button type="button" onClick={() => setModal('')} className="rounded-[4px] px-3 py-1.5 text-[12px] font-semibold" style={{ background: C.raised, color: C.text }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setErr('');
              try {
                await onExport(settings);
                setModal('');
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Export gagal');
              }
            }}
            className="rounded-[4px] px-4 py-1.5 text-[12px] font-bold disabled:opacity-60"
            style={{ background: C.accent, color: '#06282c' }}
          >
            {busy ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
