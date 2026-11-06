/**
 * =============================================================
 *  OrderDetailSheet  —  bottom sheet “tarik untuk buka/tutup”
 * -------------------------------------------------------------
 *  • Muncul di bawah layar, full-width.
 *  • Tidak ada tombol close; user men-drag handle bulat di atas
 *    (area strip atas) untuk membuka & menutup.
 *    - Drag ke atas  >= DRAG_OPEN_THRESHOLD  → terbuka
 *    - Drag ke bawah >= DRAG_CLOSE_THRESHOLD → menutup
 *  • Di mobile panel ini juga bisa di-swipe native (touch).
 *  • Di dalamnya berisi baris detail order + stepper qty + CTA.
 * =============================================================
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, GripHorizontal, LoaderCircle, Minus, Plus, Rocket } from 'lucide-react';
import {
  euro,
  hourlyFromMonthly,
  type ImageSpec,
  type IpOption,
  type NetworkPlan,
  type PlanSpec,
  type RegionSpec,
} from '../data/serverData';

export interface OrderDetail {
  plan: PlanSpec;
  region: RegionSpec | null;
  network: NetworkPlan;
  image: ImageSpec | null;
  imageVersion: string;
  ip: IpOption;
  serverName: string;
}

/* -------------------------------- helpers ------------------------------- */

/** Satu baris ringkas: harga di atas, label kecil di bawah, rata kiri. */
function LineItem({ price, label }: { price: string; label: string }) {
  return (
    <div className="min-w-0 text-left">
      <p className="text-[12px] font-extrabold leading-none text-slate-900 tabular-nums dark:text-white">{price}</p>
      <p className="mt-0.5 truncate text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

/* --------------------------------- sheet -------------------------------- */

// Minimum jarak drag (px) supaya aksi buka/tutup tereksekusi.
const DRAG_OPEN_THRESHOLD = 48;
const DRAG_CLOSE_THRESHOLD = 70;

export default function OrderDetailSheet({
  open,
  detail,
  quantity,
  onQuantityChange,
  onOpenChange,
}: {
  open: boolean;
  detail: OrderDetail | null;
  quantity: number;
  onQuantityChange: (next: number) => void;
  onOpenChange: (next: boolean) => void;
}) {
  const [ordering, setOrdering] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0); // offset Y sementara saat user men-drag
  const dragRef = useRef<{ active: boolean; startY: number; lastOffset: number }>({
    active: false,
    startY: 0,
    lastOffset: 0,
  });

  /* Reset status sukses setiap kali data order berubah */
  useEffect(() => {
    setDone(null);
  }, [detail?.plan.id, open]);

  /* --- Drag handlers (pointer) untuk handle/strip atas --- */
  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // Di perangkat sentuh, serahkan ke native touch scroll.
    if (event.pointerType === 'touch') {
      dragRef.current = { active: false, startY: event.clientY, lastOffset: 0 };
      return;
    }
    dragRef.current = { active: true, startY: event.clientY, lastOffset: 0 };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current.active) return;
      const dy = event.clientY - dragRef.current.startY;
      // Saat sheet terbuka: drag ke bawah = offset positif (nurun).
      // Saat sheet tertutup: drag ke atas = offset negatif (naik).
      if (open) {
        setDragOffset(Math.max(0, dy));
      } else {
        setDragOffset(Math.min(0, dy));
      }
      dragRef.current.lastOffset = dy;
    },
    [open],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current.active) return;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      dragRef.current.active = false;
      const dy = dragRef.current.lastOffset;

      if (open && dy >= DRAG_CLOSE_THRESHOLD) onOpenChange(false);
      if (!open && dy <= -DRAG_OPEN_THRESHOLD) onOpenChange(true);

      setDragOffset(0);
    },
    [onOpenChange, open],
  );

  /* --- Touch handlers (untuk perangkat mobile swipe di strip) --- */
  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    dragRef.current = { active: true, startY: event.touches[0].clientY, lastOffset: 0 };
  };
  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dy = event.touches[0].clientY - dragRef.current.startY;
    if (open) setDragOffset(Math.max(0, dy));
    else setDragOffset(Math.min(0, dy));
    dragRef.current.lastOffset = dy;
  };
  const onTouchEnd = () => {
    if (!dragRef.current.active) return;
    const dy = dragRef.current.lastOffset;
    dragRef.current.active = false;
    if (open && dy >= DRAG_CLOSE_THRESHOLD) onOpenChange(false);
    if (!open && dy <= -DRAG_OPEN_THRESHOLD) onOpenChange(true);
    setDragOffset(0);
  };

  /* -------------------------------- render ------------------------------- */

  // Kalau tidak ada detail, tidak perlu menampilkan apa pun.
  if (!detail) return null;

  const { plan, region, network, image, imageVersion, ip, serverName } = detail;
  const unit = plan.monthly + network.monthly + ip.monthly;
  const total = unit * quantity;
  const hourly = hourlyFromMonthly(total);

  const submit = async () => {
    setOrdering(true);
    await new Promise((resolve) => window.setTimeout(resolve, 1100));
    setOrdering(false);
    setDone(`Server berhasil dibuat · ID #${Math.floor(100000 + Math.random() * 900000)}`);
  };

  // Posisi sheet berdasarkan state buka/tutup + offset drag sementara.
  const closedTransform = 'translate-y-[calc(100%-22px)]'; // hanya tampilkan strip handle
  const translate = open
    ? `translateY(${Math.max(0, dragOffset)}px)`
    : closedTransform;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 sm:px-2">
      {/* Panel utama — satu kotak persegi panjang full-width */}
      <div
        className="pointer-events-auto w-full border-t border-slate-200 bg-white/95 backdrop-blur-xl shadow-[0_-12px_40px_-12px_rgba(15,23,42,0.28)] transition-[transform,border-radius] duration-300 ease-out dark:bg-slate-900/95 dark:border-slate-700"
        style={{
          transform: dragOffset !== 0 ? (open ? `translateY(${dragOffset}px)` : `translateY(calc(100% - 22px + ${dragOffset}px))`) : translate,
          borderTopLeftRadius: open ? '20px' : '14px',
          borderTopRightRadius: open ? '20px' : '14px',
        }}
      >
        {/* =========================================================
            STRIP HANDLE — area TARIK untuk buka/tutup.
            Tidak ada tombol “X”; user menarik strip ini ke atas/bawah.
           ========================================================= */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className={`flex ${open ? 'h-8' : 'h-[22px]'} w-full cursor-grab touch-none items-center justify-center border-b border-slate-100 transition-[height] duration-300 active:cursor-grabbing dark:border-slate-800`}
          role="separator"
          aria-label={open ? 'Tarik ke bawah untuk menutup' : 'Tarik ke atas untuk membuka'}
        >
          {/* Indikator tarik (pill) */}
          <span className="flex flex-col items-center gap-0.5">
            <span className="block h-1 w-10 rounded-full bg-slate-300" />
            {!open ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-400">
                <GripHorizontal className="h-3 w-3" strokeWidth={2.6} />
                Tarik ke atas untuk buka
              </span>
            ) : null}
          </span>
        </div>

        {/* ========== Isi sheet — hanya tampil jika terbuka ========== */}
        <div className={`mx-auto w-full max-w-6xl overflow-hidden px-4 pb-3 pt-2 sm:px-6 ${open ? 'block' : 'invisible h-0 py-0'}`}>
          {/* header (judul order) */}
          <div className="mb-2 min-w-0 text-left">
            <p className="text-[9.5px] font-extrabold uppercase tracking-[0.2em] text-cyan-600">Detail Order</p>
            <p className="truncate text-[12.5px] font-extrabold leading-tight text-slate-900 dark:text-white">
              {serverName || plan.name}
              <span className="ml-1.5 font-medium text-slate-400 dark:text-slate-400">
                {plan.family} · {region ? `${region.city}, ${region.country}` : 'Region belum dipilih'}
              </span>
            </p>
          </div>

          {/* Baris utama persegi panjang: line items rata kiri + qty + total + CTA */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 sm:flex-nowrap dark:bg-slate-900 dark:border-slate-700">
            {/* Line items — detail kecil rata kiri */}
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-2">
              <LineItem price={euro(plan.monthly)} label={`${plan.name} x${quantity}`} />
              <LineItem price={euro(ip.monthly)} label={`${ip.label} x${quantity}`} />
              <LineItem
                price={network.included ? '€0.00' : euro(network.monthly)}
                label={`Network plan x${quantity}`}
              />
              <LineItem price="€0.00" label={image ? `${image.name} ${imageVersion}` : 'Image belum dipilih'} />
            </div>

            {/* Quantity stepper (plus/minus) */}
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-400">Qty</span>
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:bg-slate-800/60 dark:border-slate-700">
                <button
                  type="button"
                  aria-label="Kurangi jumlah order"
                  disabled={quantity <= 1}
                  onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-slate-700 shadow-sm transition-all hover:bg-slate-100 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800"
                >
                  <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                </button>
                <span className="w-7 text-center text-[12.5px] font-extrabold tabular-nums text-slate-900 dark:text-white">{quantity}</span>
                <button
                  type="button"
                  aria-label="Tambah jumlah order"
                  disabled={quantity >= 99}
                  onClick={() => onQuantityChange(Math.min(99, quantity + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-500 text-white shadow-sm transition-all hover:opacity-90 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                </button>
              </div>
            </div>

            {/* Total harga */}
            <div className="shrink-0 border-slate-200 pl-0 text-left sm:border-l sm:pl-5 dark:border-slate-700">
              <p className="text-[14px] font-extrabold leading-none text-slate-900 tabular-nums dark:text-white">{euro(total)}/month</p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">€{hourly.toFixed(4)}/hour</p>
            </div>

            {/* CTA order */}
            <button
              type="button"
              onClick={() => void submit()}
              disabled={ordering}
              className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-cyan-500 px-5 text-[12.5px] font-bold text-white shadow-md shadow-cyan-600/25 transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ordering ? (
                <>
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Memproses…
                </>
              ) : (
                <>
                  <Rocket className="h-3.5 w-3.5" strokeWidth={2.6} />
                  Buat Server
                </>
              )}
            </button>
          </div>

          {/* Status / footer info */}
          {done ? (
            <p className="mt-2 flex items-center gap-1.5 text-left text-[11px] font-semibold text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2.6} />
              {done}
            </p>
          ) : (
            <p className="mt-2 text-left text-[9.5px] font-medium text-slate-400 dark:text-slate-400">
              Tarik strip di atas ke bawah untuk menutup · Ditagih per jam · tanpa biaya setup
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
