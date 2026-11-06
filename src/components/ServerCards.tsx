import { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  Gauge,
  Globe2,
  HardDrive,
  Infinity as InfinityIcon,
  MemoryStick,
  Network,
} from 'lucide-react';
import {
  euro,
  euroHourly,
  flagUrl,
  iconUrl,
  pingLevel,
  type ImageSpec,
  type NetworkPlan,
  type PlanSpec,
  type RegionSpec,
} from '../data/serverData';

const PING_STYLE = {
  green: { dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40', ring: 'ring-emerald-200', label: 'Excellent' },
  yellow: { dot: 'bg-amber-500', text: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40', ring: 'ring-amber-200', label: 'Good' },
  red: { dot: 'bg-rose-500', text: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/40', ring: 'ring-rose-200', label: 'Slow' },
};

const FAMILY_STYLE: Record<string, string> = {
  Burstable: 'bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-950/40',
  Highload: 'bg-violet-50 text-violet-600 ring-violet-100',
  'High Frequency': 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-950/40',
};

function SelectedRing({ selected }: { selected: boolean }) {
  if (!selected) return null;
  return (
    <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-cyan-500 text-white shadow-lg shadow-cyan-500/40 ring-2 ring-white">
      <CheckCircle2 className="h-4 w-4" strokeWidth={3} />
    </span>
  );
}

function SpecRow({ icon: Icon, label }: { icon: typeof Cpu; label: string }) {
  return (
    <li className="flex items-center gap-2 text-[11.5px] font-medium leading-tight text-slate-600 dark:text-slate-300">
      <Icon className="h-3.5 w-3.5 shrink-0 text-cyan-500" strokeWidth={2.4} />
      <span className="truncate">{label}</span>
    </li>
  );
}

/* ============================== PLAN CARD ============================== */

export function PlanCard({
  plan,
  selected,
  onSelect,
}: {
  plan: PlanSpec;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative flex aspect-square w-[244px] shrink-0 flex-col rounded-2xl border p-4 text-left transition-all duration-200 ${
        selected
          ? 'border-cyan-400 bg-cyan-50/60 shadow-[0_18px_40px_-22px_rgba(72,198,229,0.95)] dark:bg-cyan-950/40'
          : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg dark:bg-slate-900 dark:border-slate-700'
      }`}
    >
      <SelectedRing selected={selected} />
      <span
        className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-[0.12em] ring-1 ${
          FAMILY_STYLE[plan.family] ?? 'bg-slate-50 text-slate-500 ring-slate-100 dark:text-slate-400 dark:bg-slate-800/60 dark:ring-slate-800'
        }`}
      >
        {plan.family}
      </span>
      <p className="mt-2 text-[15px] font-extrabold leading-tight text-slate-900 dark:text-white">{plan.name}</p>

      <ul className="mt-2.5 space-y-1.5">
        <SpecRow icon={Cpu} label={plan.cpu} />
        <SpecRow icon={MemoryStick} label={plan.ram} />
        <SpecRow icon={HardDrive} label={plan.storage} />
        <SpecRow icon={Gauge} label={plan.bandwidth} />
        <SpecRow icon={Activity} label={plan.traffic} />
      </ul>

      <div className="mt-auto border-t border-slate-200 pt-2.5 dark:border-slate-700">
        <p className="text-[19px] font-extrabold leading-none text-cyan-600">{euro(plan.monthly)}</p>
        <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{euroHourly(plan.monthly)}</p>
      </div>
    </button>
  );
}

/* ============================= REGION CARD ============================= */

export function RegionCard({
  region,
  selected,
  onSelect,
}: {
  region: RegionSpec;
  selected: boolean;
  onSelect: () => void;
}) {
  const level = PING_STYLE[pingLevel(region.ping)];
  const [flagFailed, setFlagFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative flex aspect-square w-[212px] shrink-0 flex-col rounded-2xl border p-3.5 text-left transition-all duration-200 ${
        selected
          ? 'border-cyan-400 bg-cyan-50/60 shadow-[0_18px_40px_-22px_rgba(72,198,229,0.95)] dark:bg-cyan-950/40'
          : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg dark:bg-slate-900 dark:border-slate-700'
      }`}
    >
      <SelectedRing selected={selected} />

      {/* Full flag — never cropped or stretched */}
      <div className="flex h-[82px] w-full items-center justify-center rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200/80 dark:bg-slate-800/60">
        {flagFailed ? (
          <span className="text-[13px] font-extrabold text-slate-400 dark:text-slate-400">{region.code}</span>
        ) : (
          <img
            src={flagUrl(region.flag)}
            alt={`${region.country} flag`}
            loading="lazy"
            onError={() => setFlagFailed(true)}
            className="max-h-full max-w-full object-contain drop-shadow-sm"
          />
        )}
      </div>

      <p className="mt-2.5 truncate text-[13.5px] font-extrabold leading-tight text-slate-900 dark:text-white">{region.country}</p>
      <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] font-medium text-slate-500 dark:text-slate-400">
        <Globe2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
        {region.city}
      </p>

      <div className={`mt-auto flex items-center justify-between rounded-lg px-2.5 py-1.5 ring-1 ${level.bg} ${level.ring}`}>
        <span className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${level.dot} animate-pulse-dot`} />
          <span className={`text-[11.5px] font-extrabold ${level.text}`}>{region.ping}ms</span>
        </span>
        <span className="text-[9.5px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-400">{level.label}</span>
      </div>
      <p className="mt-1.5 text-[9.5px] font-medium text-slate-400 dark:text-slate-400">Looking Glass · {region.code}</p>
    </button>
  );
}

/* =========================== NETWORK PLAN CARD =========================== */

export function NetworkCard({
  plan,
  selected,
  onSelect,
}: {
  plan: NetworkPlan;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative flex aspect-square w-[224px] shrink-0 flex-col rounded-2xl border p-4 text-left transition-all duration-200 ${
        selected
          ? 'border-cyan-400 bg-cyan-50/60 shadow-[0_18px_40px_-22px_rgba(72,198,229,0.95)] dark:bg-cyan-950/40'
          : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-lg dark:bg-slate-900 dark:border-slate-700'
      }`}
    >
      <SelectedRing selected={selected} />
      {plan.included ? (
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-950/40">
          Free · All plans
        </span>
      ) : null}

      <p className={`flex items-start gap-1.5 text-[13px] font-extrabold leading-snug text-slate-900 dark:text-white ${plan.included ? 'mt-2' : ''}`}>
        <Network className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-500" strokeWidth={2.6} />
        {plan.name}
      </p>

      <ul className="mt-3 space-y-1.5">
        <li className="flex items-center justify-between text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
          <span>Traffic</span>
          <span className="flex items-center gap-1 font-bold text-slate-900 dark:text-white">
            <InfinityIcon className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        </li>
        <li className="flex items-center justify-between text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
          <span>Bandwidth</span>
          <span className="font-bold text-slate-900 dark:text-white">{plan.bandwidth}</span>
        </li>
        <li className="flex items-center justify-between text-[11.5px] font-medium text-slate-600 dark:text-slate-300">
          <span>Extra 1TB</span>
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-extrabold text-emerald-600 dark:bg-emerald-950/40">
            {plan.extraTb}
          </span>
        </li>
      </ul>

      <div className="mt-auto border-t border-slate-200 pt-2.5 dark:border-slate-700">
        <p className="text-[18px] font-extrabold leading-none text-cyan-600">
          {plan.included ? 'FREE' : euro(plan.monthly)}
        </p>
        <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {plan.included ? 'Included in every plan' : euroHourly(plan.monthly)}
        </p>
      </div>
    </button>
  );
}

/* ============================== IMAGE CARD ============================== */

export function ImageTile({
  image,
  selected,
  onSelect,
}: {
  image: ImageSpec;
  selected: boolean;
  onSelect: () => void;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={`${image.name} — ${image.versions[0]}`}
      className={`relative flex aspect-square w-[132px] shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center transition-all duration-200 ${
        selected
          ? 'border-cyan-400 bg-cyan-50/60 shadow-[0_18px_36px_-22px_rgba(72,198,229,0.95)] dark:bg-cyan-950/40'
          : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md dark:bg-slate-900 dark:border-slate-700'
      }`}
    >
      <SelectedRing selected={selected} />
      <span
        className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-black/5"
        style={{ background: `${image.color}1a` }}
      >
        {failed ? (
          <span className="text-[16px] font-extrabold" style={{ color: image.color }}>
            {image.name.slice(0, 2).toUpperCase()}
          </span>
        ) : (
          <img
            src={iconUrl(image.icon, image.color)}
            alt={image.name}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-7 w-7 object-contain"
          />
        )}
      </span>
      <span className="w-full truncate text-[12px] font-extrabold leading-tight text-slate-900 dark:text-white">{image.name}</span>
      <span className="truncate text-[9.5px] font-medium text-slate-400 dark:text-slate-400">{image.versions[0]}</span>
    </button>
  );
}

/* =========================== VERSION SWAP CHIP =========================== */

export function VersionChip({
  version,
  active,
  onSelect,
}: {
  version: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`shrink-0 rounded-full px-3.5 py-2 text-[11.5px] font-bold transition-all active:scale-95 ${
        active ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-800'
      }`}
    >
      {version}
    </button>
  );
}

/* ============================ SECTION HEADER ============================ */

export function SectionHeader({
  step,
  title,
  hint,
}: {
  step: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-2.5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-500">{step}</p>
      <h3 className="text-[14.5px] font-extrabold leading-tight text-slate-900 dark:text-white">{title}</h3>
      {hint ? <p className="mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}
