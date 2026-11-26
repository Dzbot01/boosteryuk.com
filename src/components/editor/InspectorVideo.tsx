import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useEditor } from './store';
import { C, IconBtn, SectionHead, SliderRow, Stepper } from './ui';

const SEGMENTS = ['Basic', 'Cutout', 'Mask', 'Canvas'];
const COLLAPSED_DEFAULT = ['Blend', 'Stabilize', 'Opacity'];

export default function InspectorVideo() {
  const { filterName, filterStrength, setFilterStrength, effects, removeEffect, zoomPct, setZoomPct, posX, posY, setPos, opacity, setOpacity } = useEditor();
  const [seg, setSeg] = useState('Basic');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ 'Position & Size': false, Blend: true, Stabilize: true, Opacity: true });
  const toggle = (k: string) => setCollapsed((c) => ({ ...c, [k]: !c[k] }));

  return (
    <div className="px-3 pb-4">
      {/* Segmented control */}
      <div className="flex items-center gap-1 rounded-[999px] p-1" style={{ background: C.raised }}>
        {SEGMENTS.map((s) => (
          <button key={s} type="button" onClick={() => setSeg(s)} className="flex-1 rounded-[999px] py-1 text-[11px] font-semibold transition-colors duration-[120ms]" style={{ background: seg === s ? C.panel : 'transparent', color: seg === s ? C.accent : C.text2 }}>
            {s}
          </button>
        ))}
      </div>

      {seg === 'Basic' && (
        <div className="mt-1">
          <SectionHead title="Filters">
            <p className="pb-1 text-[12px] font-bold" style={{ color: C.text }}>{filterName || `Original`}</p>
            <SliderRow label="Strength" value={filterStrength} min={0} max={100} suffix="%" onChange={setFilterStrength} diamond />
          </SectionHead>

          <SectionHead title="Effects">
            {effects.length === 0 && <p className="py-1 text-[11px]" style={{ color: C.text3 }}>Belum ada effect</p>}
            {effects.map((e) => (
              <div key={e.id} className="flex items-center gap-2 py-1">
                <span className="text-[10px] font-bold" style={{ color: C.text3 }}>NO {e.id}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-bold" style={{ color: C.text }}>{e.name}</span>
                <button type="button" aria-label={`Edit ${e.name}`} className="flex h-6 w-6 items-center justify-center rounded-[4px]" style={{ background: C.raised }}>
                  <Pencil className="h-3 w-3" style={{ color: C.text2 }} strokeWidth={2} />
                </button>
                <button type="button" aria-label={`Hapus ${e.name}`} onClick={() => removeEffect(e.id)} className="flex h-6 w-6 items-center justify-center rounded-[4px]" style={{ background: C.raised }}>
                  <Trash2 className="h-3 w-3" style={{ color: '#ff6b6b' }} strokeWidth={2} />
                </button>
              </div>
            ))}
          </SectionHead>

          <SectionHead title="Position & Size" collapsed={collapsed['Position & Size']} onToggle={() => toggle('Position & Size')}>
            <SliderRow label="Zoom" value={zoomPct} min={10} max={300} suffix="%" onChange={setZoomPct} diamond />
            <div className="flex items-center gap-2 py-1.5">
              <span className="w-[76px] shrink-0 text-[11px]" style={{ color: C.text2 }}>Position X</span>
              <Stepper value={posX} onChange={(x) => setPos(x, posY)} />
              <span className="w-[76px] shrink-0 pl-4 text-[11px]" style={{ color: C.text2 }}>Position Y</span>
              <Stepper value={posY} onChange={(y) => setPos(posX, y)} />
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[11px]" style={{ color: C.text2 }}>Rotate</span>
              <Stepper value={0} suffix="°" onChange={() => undefined} />
            </div>
            <label className="flex items-center gap-2 py-1.5 text-[11px]" style={{ color: C.text2 }}>
              <span className="h-3 w-3 rounded-[3px]" style={{ background: C.accent, boxShadow: `inset 0 0 0 1px ${C.accent}` }} />
              Scale uniformly
            </label>
          </SectionHead>

          {COLLAPSED_DEFAULT.map((name) => (
            <SectionHead key={name} title={name} collapsed={collapsed[name]} onToggle={() => toggle(name)}>
              <SliderRow label={name === 'Opacity' ? 'Opacity' : 'Amount'} value={opacity} min={0} max={100} suffix="%" onChange={setOpacity} diamond />
            </SectionHead>
          ))}
        </div>
      )}

      {seg === 'Cutout' && (
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-[12px]" style={{ color: C.text }}>
            <span className="h-3.5 w-3.5 rounded-[3px]" style={{ background: C.accent }} /> Auto cutout
          </label>
          <SliderRow label="Edge feather" value={20} min={0} max={100} suffix="%" onChange={() => undefined} />
        </div>
      )}

      {seg === 'Mask' && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {['None', 'Circle', 'Rectangle', 'Heart'].map((m, i) => (
            <button key={m} type="button" className="rounded-[4px] px-2 py-1 text-[11px]" style={{ background: i === 1 ? C.raised : 'transparent', color: i === 1 ? C.accent : C.text2, boxShadow: i === 1 ? `inset 0 0 0 1px ${C.border}` : undefined }}>
              {m}
            </button>
          ))}
          <SliderRow label="Feather" value={30} min={0} max={100} suffix="%" onChange={() => undefined} />
        </div>
      )}

      {seg === 'Canvas' && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px]" style={{ color: C.text2 }}>Ratio</p>
          <div className="flex flex-wrap gap-1.5">
            {['16:9', '9:16', '1:1'].map((r, i) => (
              <button key={r} type="button" className="rounded-[4px] px-2 py-1 text-[11px]" style={{ background: i === 0 ? C.raised : 'transparent', color: i === 0 ? C.accent : C.text2, boxShadow: i === 0 ? `inset 0 0 0 1px ${C.border}` : undefined }}>
                {r}
              </button>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: C.text2 }}>Blur</p>
          <div className="flex gap-1.5">
            {['1', '2', '3', '4'].map((b) => (
              <IconBtn key={b} label={`Blur ${b}`}><span className="text-[10px]">{b}</span></IconBtn>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
