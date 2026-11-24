import { useState } from 'react';
import { useEditor } from './store';
import { C, SectionHead, SliderRow, Stepper } from './ui';

const CURVES = ['Custom', 'Montage', 'Hero', 'Bullet', 'Jump cut'];

export default function InspectorSpeed() {
  const { speed, setSpeed } = useEditor();
  const [mode, setMode] = useState<'Standard' | 'Curve'>('Standard');

  return (
    <div className="px-3 pb-4 pt-1">
      <div className="flex items-center gap-1 rounded-[999px] p-1" style={{ background: C.raised }}>
        {(['Standard', 'Curve'] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className="flex-1 rounded-[999px] py-1 text-[11px] font-semibold transition-colors duration-[120ms]" style={{ background: mode === m ? C.panel : 'transparent', color: mode === m ? C.accent : C.text2 }}>
            {m}
          </button>
        ))}
      </div>

      {mode === 'Standard' ? (
        <div className="mt-1">
          <SectionHead title="Speed">
            <SliderRow label="Speed" value={speed} min={0.1} max={100} step={0.1} suffix="x" onChange={setSpeed} diamond />
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[11px]" style={{ color: C.text2 }}>Duration</span>
              <Stepper value={Number((20 / speed).toFixed(1))} suffix="s" min={0.1} onChange={(v) => setSpeed(Number((20 / Math.max(0.1, v)).toFixed(2)))} />
            </div>
          </SectionHead>
        </div>
      ) : (
        <div className="mt-1">
          <SectionHead title="Curve">
            <div className="grid grid-cols-2 gap-2">
              {CURVES.map((c, i) => (
                <button key={c} type="button" className="rounded-[6px] py-2 text-[11px]" style={{ background: C.raised, color: i === 0 ? C.accent : C.text2, boxShadow: i === 0 ? `0 0 0 1px ${C.accent}` : undefined }}>
                  {c}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10.5px]" style={{ color: C.text3 }}>Preset kecepatan dipakai sebagai mock; kurva penuh menyusul saat logika edit terhubung.</p>
          </SectionHead>
        </div>
      )}
    </div>
  );
}
