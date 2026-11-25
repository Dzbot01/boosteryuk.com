import type { ReactNode } from 'react';

/** Warna desain sistem (CapCut-like dark). */
export const C = {
  app: '#0f0f11',
  panel: '#1a1a1d',
  raised: '#232327',
  border: '#2b2b30',
  text: '#e8e8ea',
  text2: '#8a8a92',
  text3: '#55555c',
  accent: '#00d1e0',
  scroll: '#3a3a40',
};

/** Tombol ikon dengan tooltip gelap 11px. */
export function IconBtn({ label, onClick, active, children, disabled }: { label: string; onClick?: () => void; active?: boolean; children: ReactNode; disabled?: boolean }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className="flex h-8 w-8 items-center justify-center rounded-[4px] transition-colors duration-[120ms] disabled:opacity-40 lg:h-7 lg:w-7"
        style={{ background: active ? C.raised : 'transparent', color: active ? C.accent : C.text2, boxShadow: active ? `inset 0 0 0 1px ${C.border}` : undefined }}
        onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = C.text; }}
        onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = C.text2; }}
      >
        {children}
      </button>
      <span
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-[4px] px-1.5 py-0.5 text-[11px] font-semibold opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100"
        style={{ background: '#000', color: C.text }}
      >
        {label}
      </span>
    </span>
  );
}

/** Slider khas editor: track 4px #3a3a40, fill accent, thumb 12px putih. */
export function SliderRow({ label, value, min, max, step = 1, suffix = '', onChange, diamond }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void; diamond?: boolean }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="w-[76px] shrink-0 text-[11px]" style={{ color: C.text2 }}>{label}</span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="ed-slider h-[4px] flex-1 cursor-pointer appearance-none rounded-full outline-none"
        style={{ background: `linear-gradient(to right, ${C.accent} ${pct}%, ${C.scroll} ${pct}%)` }}
      />
      <Stepper value={value} suffix={suffix} onChange={onChange} min={min} max={max} />
      {diamond && <span className="ml-0.5 inline-block h-2 w-2 rotate-45 border" style={{ borderColor: C.text3 }} aria-hidden />}
    </div>
  );
}

/** Input numerik gelap dengan stepper atas/bawah. */
export function Stepper({ value, suffix = '', onChange, min = -100000, max = 100000 }: { value: number; suffix?: string; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <span className="flex items-center rounded-[4px]" style={{ background: C.raised }}>
      <input
        value={`${value}${suffix}`}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^0-9.-]/g, ''));
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        aria-label="Nilai"
        className="w-[52px] bg-transparent py-0.5 text-center text-[11px] font-semibold outline-none"
        style={{ color: C.text }}
      />
      <span className="flex flex-col pr-1">
        <button type="button" aria-label="Naik" onClick={() => onChange(Math.min(max, value + 1))} className="text-[8px] leading-[8px]" style={{ color: C.text2 }}>▲</button>
        <button type="button" aria-label="Turun" onClick={() => onChange(Math.max(min, value - 1))} className="text-[8px] leading-[8px]" style={{ color: C.text2 }}>▼</button>
      </span>
    </span>
  );
}

/** Header seksi inspector: checkbox + judul kiri, reset + keyframe kanan. */
export function SectionHead({ title, checked = true, collapsed, onToggle, children }: { title: string; checked?: boolean; collapsed?: boolean; onToggle?: () => void; children?: ReactNode }) {
  return (
    <div className="border-b py-2" style={{ borderColor: C.border }}>
      <div className="flex items-center gap-2">
        {onToggle && (
          <button type="button" aria-label={`Buka/tutup ${title}`} onClick={onToggle} className="text-[10px]" style={{ color: C.text2, transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 160ms' }}>▼</button>
        )}
        <span className="h-3 w-3 rounded-[3px]" style={{ background: checked ? C.accent : 'transparent', boxShadow: `inset 0 0 0 1px ${checked ? C.accent : C.text3}` }} aria-hidden />
        <span className="text-[12px] font-semibold" style={{ color: C.text }}>{title}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <button type="button" aria-label={`Reset ${title}`} className="text-[11px]" style={{ color: C.text2 }}>↺</button>
          <span className="inline-block h-2 w-2 rotate-45 border" style={{ borderColor: C.text3 }} aria-hidden />
        </span>
      </div>
      {!collapsed && children && <div className="pt-1.5">{children}</div>}
    </div>
  );
}
