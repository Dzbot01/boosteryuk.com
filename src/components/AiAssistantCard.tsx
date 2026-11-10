import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Sparkles } from 'lucide-react';
import { boostyVoice } from '../services/boostyVoice';
import guri from '../assets/guri.webp';

interface AiAssistantProps {
  /** Display name used in the greeting, e.g. first name. */
  userName?: string;
  /** Currently selected category label (empty string when none). */
  category: string;
  /** Currently selected service name (null when none). */
  serviceName: string | null;
  /** Formatted price per 1K for the selected service. */
  servicePriceText?: string;
  /** Whether the target field is filled. */
  hasTarget: boolean;
  /** Quantity/order count (for custom comments: number of comment lines). */
  qty: number;
  /** Formatted total price text. */
  priceText: string;
  /** True while an order request is in flight. */
  ordering: boolean;
  /** Latest order result notice (null when none). */
  orderNotice: { ok: boolean; message: string } | null;
}

const TYPE_SPEED_MS = 22;
const HOLD_MS = 2600;
const QUESTION_EXTRA_MS = 2000;
const GAP_MS = 350;
const IDLE_PROMO_MS = 16000;

const PROMOS = [
  'eh btw deposit QRIS dapet bonus 10% lhoo, lumayan banget kan?',
  'upgrade ke plus cuma 5rb, Harga TERMURAH! gas lah ya?',
  'jangan lupa klaim garansi refill 30 hari kalo turun ya kak!',
  'abis order jangan lupa selalu cek status pesanannya ya~',
  'butuh bantuan? admin standby 24/7 kok, gas chat aja!',
];

function truncate(text: string, max = 30): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export default function AiAssistantCard({
  userName,
  category,
  serviceName,
  servicePriceText,
  hasTarget,
  qty,
  priceText,
  ordering,
  orderNotice,
}: AiAssistantProps) {
  const queueRef = useRef<string[]>([]);
  const [current, setCurrent] = useState('');
  const [displayed, setDisplayed] = useState('');
  const [thinking, setThinking] = useState(false);
  const [version, setVersion] = useState(0);

  // ====== Suara + subtitle "Guri Booster" ======
  // Berlangganan controller global (dimulai dari gesture login agar autoplay lolos).
  const voiceState = useSyncExternalStore(boostyVoice.subscribe, boostyVoice.getState);
  const activeVoice = voiceState.voice;
  const subtitle = voiceState.subtitle;

  const prevRef = useRef({
    category: '',
    serviceName: null as string | null,
    hasTarget: false,
    hasQty: false,
    ordering: false,
    notice: null as { ok: boolean; message: string } | null,
  });
  const promoIndex = useRef(0);

  const push = (text: string) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    const q = queueRef.current;
    if (q[q.length - 1] === clean) return;
    q.push(clean);
    if (q.length > 6) q.shift();
    setVersion((v) => v + 1);
  };

  // Welcome message on mount.
  useEffect(() => {
    const name = userName ? ` ${userName.toLowerCase()}` : '';
    push(`haloo${name}! selamat datang~ yuk pilih kategori dulu biar aku bantuin!`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to form state changes (only on meaningful transitions).
  useEffect(() => {
    const prev = prevRef.current;

    if (category && category !== prev.category) {
      push(`aku liat kamu milih kategori ${category.toLowerCase()} ya? cakep! pilih layanannya dong`);
    }
    if (serviceName && serviceName !== prev.serviceName) {
      const short = truncate(serviceName, 26);
      push(
        servicePriceText
          ? `nahh ${short} mantep tuh! harganya cuma ${servicePriceText}/K lho. targetnya mana kak?`
          : `nahh ${short} mantep tuh! targetnya mana kak?`,
      );
    }
    if (hasTarget && !prev.hasTarget) {
      push('sippp targetnya udah kepilih! tinggal atur jumlahnya nih');
    }
    const hasQtyNow = qty > 0;
    if (hasQtyNow && !prev.hasQty) {
      push(`oke diitung yaa~ totalnya jadi ${priceText} nih, murah banget kan?`);
    }
    if (ordering && !prev.ordering) {
      push('tunggu bentar yaa, pesananmu lagi aku proses...');
    }
    if (orderNotice && orderNotice !== prev.notice) {
      if (orderNotice.ok) {
        push('yeyy pesananmu sukses dibuat! cek di riwayat ya kak 🎉');
      } else {
        push(`aduhh gagal nih kak: ${truncate(orderNotice.message, 60)}`);
      }
    }

    prevRef.current = {
      category,
      serviceName,
      hasTarget,
      hasQty: hasQtyNow,
      ordering,
      notice: orderNotice,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, serviceName, hasTarget, qty, priceText, ordering, orderNotice]);

  // Idle promo rotation while nothing else is queued.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (queueRef.current.length === 0 && !current) {
        push(PROMOS[promoIndex.current % PROMOS.length]);
        promoIndex.current += 1;
      }
    }, IDLE_PROMO_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Message pump: pick next message, think, type it, hold, clear.
  useEffect(() => {
    if (current || queueRef.current.length === 0) return;
    let cancelled = false;
    let holdTimer: number | undefined;
    let gapTimer: number | undefined;

    const next = queueRef.current.shift()!;
    setThinking(true);

    const thinkTimer = window.setTimeout(() => {
      if (cancelled) return;
      setThinking(false);
      setCurrent(next);
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(thinkTimer);
      if (holdTimer) window.clearTimeout(holdTimer);
      if (gapTimer) window.clearTimeout(gapTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, current]);

  // Typewriter effect.
  useEffect(() => {
    if (!current) return;
    setDisplayed('');
    let i = 0;
    let holdTimer: number | undefined;
    let gapTimer: number | undefined;

    const timer = window.setInterval(() => {
      i += 1;
      setDisplayed(current.slice(0, i));
      if (i >= current.length) {
        window.clearInterval(timer);
        const hold = HOLD_MS + (current.trim().endsWith('?') ? QUESTION_EXTRA_MS : 0);
        holdTimer = window.setTimeout(() => {
          setDisplayed('');
          gapTimer = window.setTimeout(() => {
            setCurrent('');
            setVersion((v) => v + 1);
          }, GAP_MS);
        }, hold);
      }
    }, TYPE_SPEED_MS);

    return () => {
      window.clearInterval(timer);
      if (holdTimer) window.clearTimeout(holdTimer);
      if (gapTimer) window.clearTimeout(gapTimer);
    };
  }, [current]);

  const typing = current !== '' && displayed.length < current.length;

  return (
    <div className="mb-4 w-full rounded-[18px] border border-cyan-100 bg-white px-4 py-3.5 shadow-[0_14px_36px_-18px_rgba(23,32,51,.22)] dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2.5">
        <img src={guri} alt="Guri Booster" className="h-11 w-11 shrink-0 select-none object-contain" draggable={false} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-display text-[13.5px] font-extrabold tracking-tight text-slate-900 dark:text-white">
            Guri Booster
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-900/25 dark:text-cyan-400 dark:ring-cyan-800/50">
              <Sparkles className="h-2.5 w-2.5" strokeWidth={2.4} />
              {activeVoice ? activeVoice.label : 'Online'}
            </span>
          </p>
        </div>
      </div>

      {activeVoice ? (
        <div className="mt-2.5 min-h-[2.7em]" aria-live="polite">
          <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wide text-cyan-600 dark:text-cyan-400">
            <span className="flex items-end gap-[2px]" aria-hidden>
              {[0, 1, 2, 3].map((d) => (
                <span
                  key={d}
                  className="w-[2.5px] animate-pulse rounded-full bg-cyan-500"
                  style={{ height: `${6 + (d % 2 ? 5 : 9)}px`, animationDelay: `${d * 120}ms` }}
                />
              ))}
            </span>
            Sedang berbicara…
          </div>
          <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-slate-700 dark:text-slate-200">
            {subtitle || ' '}
          </p>
        </div>
      ) : (
      <div
        className="mt-2.5 min-h-[2.7em] text-[13px] leading-relaxed text-slate-600 dark:text-slate-300"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
        aria-live="polite"
      >
        {thinking && !displayed ? (
          <span className="inline-flex items-center gap-1 py-1" aria-label="AI sedang mengetik">
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-500"
                style={{ animationDelay: `${d * 150}ms` }}
              />
            ))}
          </span>
        ) : (
          <>
            {displayed || '\u00A0'}
            {typing && <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-pulse bg-cyan-500 align-[-2px]" />}
          </>
        )}
      </div>
      )}
    </div>
  );
}
