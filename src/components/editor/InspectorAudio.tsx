import { useState } from 'react';
import { useEditor } from './store';
import { C, SectionHead, SliderRow, Stepper } from './ui';

const VOICES = ['Original', 'Chipmunk', 'Deep', 'Robot', 'Echo'];

export default function InspectorAudio() {
  const { volume, setVolume } = useEditor();
  const [fade, setFade] = useState({ in: 0, out: 0 });
  const [noise, setNoise] = useState(true);
  const [voice, setVoice] = useState(VOICES[0]);

  return (
    <div className="px-3 pb-4 pt-1">
      <SectionHead title="Volume">
        <SliderRow label="Volume" value={volume} min={0} max={200} suffix="%" onChange={setVolume} diamond />
      </SectionHead>
      <SectionHead title="Fade">
        <SliderRow label="Fade in" value={fade.in} min={0} max={10} step={0.1} suffix="s" onChange={(v) => setFade((f) => ({ ...f, in: v }))} />
        <SliderRow label="Fade out" value={fade.out} min={0} max={10} step={0.1} suffix="s" onChange={(v) => setFade((f) => ({ ...f, out: v }))} />
      </SectionHead>
      <SectionHead title="Enhance">
        <label className="flex items-center justify-between py-1.5 text-[11px]" style={{ color: C.text2 }}>
          Noise reduction
          <button type="button" aria-label="Toggle noise reduction" onClick={() => setNoise((n) => !n)} className="h-4 w-8 rounded-[999px] p-[2px] transition-colors duration-[120ms]" style={{ background: noise ? C.accent : C.scroll }}>
            <span className="block h-3 w-3 rounded-full bg-white transition-transform duration-[120ms]" style={{ transform: noise ? 'translateX(16px)' : 'none' }} />
          </button>
        </label>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[11px]" style={{ color: C.text2 }}>Voice changer</span>
          <select value={voice} onChange={(e) => setVoice(e.target.value)} aria-label="Voice changer" className="rounded-[4px] border px-1.5 py-1 text-[11px] outline-none" style={{ background: C.raised, borderColor: C.border, color: C.text }}>
            {VOICES.map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between py-1.5">
          <span className="text-[11px]" style={{ color: C.text2 }}>Balance</span>
          <Stepper value={0} onChange={() => undefined} />
        </div>
      </SectionHead>
    </div>
  );
}
