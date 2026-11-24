import { useEditor } from './store';
import type { RightTab } from './store';
import { C } from './ui';
import InspectorVideo from './InspectorVideo';
import InspectorAudio from './InspectorAudio';
import InspectorSpeed from './InspectorSpeed';
import InspectorAnimate from './InspectorAnimate';
import InspectorAdjust from './InspectorAdjust';

const TABS: RightTab[] = ['Video', 'Audio', 'Speed', 'Animate', 'Adjust'];

export default function Inspector() {
  const { rightTab, setRightTab, selected, clips } = useEditor();
  const clip = clips.find((c) => c.id === selected) || null;
  return (
    <div className="flex h-full min-h-0 flex-col" style={{ background: C.panel }}>
      {/* Tab underline, dapat di-scroll horizontal */}
      <div className="flex shrink-0 overflow-x-auto border-b ed-scroll-x" style={{ borderColor: C.border }}>
        {TABS.map((t) => {
          const on = rightTab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setRightTab(t)}
              className="shrink-0 border-b-2 px-3 py-2 text-[12px] font-semibold transition-colors duration-[120ms]"
              style={{ borderColor: on ? C.accent : 'transparent', color: on ? C.accent : C.text2 }}
            >
              {t}
            </button>
          );
        })}
      </div>
      <p className="shrink-0 truncate px-3 py-1.5 text-[10.5px]" style={{ color: C.text3 }}>
        {clip ? `Clip terpilih: ${clip.name}` : 'Tidak ada clip terpilih'}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto ed-scroll">
        {rightTab === 'Video' && <InspectorVideo />}
        {rightTab === 'Audio' && <InspectorAudio />}
        {rightTab === 'Speed' && <InspectorSpeed />}
        {rightTab === 'Animate' && <InspectorAnimate />}
        {rightTab === 'Adjust' && <InspectorAdjust />}
      </div>
    </div>
  );
}
