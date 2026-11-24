import { useEditor } from './store';
import { SectionHead, SliderRow } from './ui';

const KEYS = ['Brightness', 'Contrast', 'Saturation', 'Sharpness', 'Highlight', 'Shadow', 'Temperature', 'Tint'];

export default function InspectorAdjust() {
  const { adjust, setAdjust } = useEditor();
  const reset = () => KEYS.forEach((k) => setAdjust(k, 0));
  return (
    <div className="px-3 pb-4 pt-1">
      <SectionHead title="Adjust">
        <button type="button" onClick={reset} className="mb-1 text-[11px] font-semibold" style={{ color: '#00d1e0' }}>Reset semua</button>
        {KEYS.map((k) => (
          <SliderRow key={k} label={k} value={adjust[k]} min={-50} max={50} onChange={(v) => setAdjust(k, v)} diamond />
        ))}
      </SectionHead>
    </div>
  );
}
