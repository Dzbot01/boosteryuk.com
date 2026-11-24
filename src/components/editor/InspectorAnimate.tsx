import { useState } from 'react';
import { C, SectionHead } from './ui';

const MODES = ['In', 'Out', 'Combo'] as const;
const PRESETS: Record<string, string[]> = {
  In: ['Fade In', 'Slide Up', 'Slide Left', 'Zoom In', 'Spin In', 'Blur In', 'Pop In', 'None'],
  Out: ['Fade Out', 'Slide Down', 'Slide Right', 'Zoom Out', 'Spin Out', 'Blur Out', 'Pop Out', 'None'],
  Combo: ['Zoom Bounce', 'Shake', 'Wobble', 'Flip', 'Flash', 'None'],
};

export default function InspectorAnimate() {
  const [mode, setMode] = useState<(typeof MODES)[number]>('In');
  const [picked, setPicked] = useState<string>('None');
  return (
    <div className="px-3 pb-4 pt-1">
      <div className="flex items-center gap-1 rounded-[999px] p-1" style={{ background: C.raised }}>
        {MODES.map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setPicked('None'); }} className="flex-1 rounded-[999px] py-1 text-[11px] font-semibold transition-colors duration-[120ms]" style={{ background: mode === m ? C.panel : 'transparent', color: mode === m ? C.accent : C.text2 }}>
            {m}
          </button>
        ))}
      </div>
      <SectionHead title={`Animation ${mode}`}>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {PRESETS[mode].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPicked(p)}
              className="flex flex-col items-center gap-1 rounded-[6px] py-2 transition-transform duration-[120ms] hover:scale-[1.03]"
              style={{ background: C.raised, boxShadow: picked === p ? `0 0 0 2px ${C.accent}` : undefined }}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-[4px]" style={{ background: picked === p ? C.accent : C.panel }}>
                <span className="block h-2 w-2 rounded-[1px]" style={{ background: picked === p ? '#000' : C.text2 }} />
              </span>
              <span className="text-[10px]" style={{ color: picked === p ? C.accent : C.text2 }}>{p}</span>
            </button>
          ))}
        </div>
      </SectionHead>
    </div>
  );
}
