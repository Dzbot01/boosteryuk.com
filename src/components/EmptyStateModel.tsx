import { useEffect, useRef, useState } from 'react';
import { Inbox } from 'lucide-react';
import type { AnimationMixer, Clock, Group, PerspectiveCamera, WebGLRenderer } from 'three';

/**
 * Panggung 3D — dipakai sebagai empty state riwayat (Riwayat Deposit, Riwayat Pesanan,
 * Riwayat Nomor), panggung model scene (Order OTP), dan model "merangkul" pojok card
 * slider (halaman Buat Pesanan / Layanan).
 *
 * Model GLB diambil dari Supabase Storage folder public "video":
 *   https://zcxtbtleeeaeqeryiwea.supabase.co/storage/v1/object/public/video/boy.glb
 * three.js + GLTFLoader di-import DINAMIS (type-only import di atas tidak menambah bundle)
 * agar beratnya tidak ikut ke chunk halaman. Bila WebGL/model gagal dimuat, tampil ikon
 * cadangan + teks yang sama sehingga halaman tidak pernah blank.
 *
 * Panggung ini PASIF (tanpa kontrol kamera/POV): model digerakkan animasi bawaan GLB
 * (+ ayunan halus panggung bila `motion`). GLB dimuat SEKALI per `modelUrl`; perubahan
 * tinggi/zoom/ukuran hanya memanggil `layout()` sehingga tidak ada re-fetch saat elemen
 * di-resize (penting untuk tinggi yang diukur dari elemen lain, mis. card slider).
 * Kamera selalu di-fit otomatis lewat `computeStageFit` sehingga model yang sedang
 * beranimasi tidak terpotong frame.
 */
export const EMPTY_STATE_MODEL_URL =
  'https://zcxtbtleeeaeqeryiwea.supabase.co/storage/v1/object/public/video/boy.glb';

/** Sumbu acuan skala model: 'max' = dimensi terpanjang, 'height' = tinggi model. */
export type FitBy = 'max' | 'height';
/** Sumbu yang dijaga muat di frame: 'both' = vertikal + horizontal, 'vertical' = tinggi saja. */
export type FitAxes = 'both' | 'vertical';

/**
 * Hitung skala model + jarak kamera agar model (beserta ruang gerak animasinya) muat di frame.
 * Fungsi murni — diekspor supaya bisa diuji tanpa WebGL.
 *
 * `dist` = max(jarak yang diminta `zoom`, jarak minimum agar tinggi model × fitMargin muat
 * secara vertikal, dan — bila `fitAxes` 'both' — agar lebar efektif model × fitMargin muat
 * secara horizontal). Lebar efektif memakai hypot(x, z) karena panggung mengayun model
 * mengelilingi sumbu Y (proyeksi terlebar terjadi di antara keduanya).
 */
export function computeStageFit(opts: {
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  aspect: number;
  fovDeg?: number;
  targetSize?: number;
  fitMargin?: number;
  zoom?: number;
  fitBy?: FitBy;
  fitAxes?: FitAxes;
}): { dist: number; scale: number; modelH: number; visibleH: number } {
  const fov = opts.fovDeg ?? 35;
  const target = Math.max(opts.targetSize ?? 2.2, 0.05);
  const margin = Math.max(opts.fitMargin ?? 1.3, 1);
  const zoom = Math.max(opts.zoom ?? 1, 0.2);
  const aspect = opts.aspect > 0.01 ? opts.aspect : 1;
  const refDim =
    opts.fitBy === 'height'
      ? opts.sizeY || 1
      : Math.max(opts.sizeY || 1, opts.sizeX || 1, opts.sizeZ || 1, 0.0001);
  const scale = target / refDim;
  const visH = 2 * Math.tan(((fov * Math.PI) / 180) / 2); // tinggi frame pada jarak 1
  const modelH = opts.sizeY * scale;
  const needV = modelH * margin;
  const needH = Math.hypot(opts.sizeX * scale, opts.sizeZ * scale) * margin;
  const minDistV = needV / visH;
  const minDistH = opts.fitAxes === 'vertical' ? 0 : needH / (visH * aspect);
  const want = (modelH * 2.15) / zoom;
  const dist = Math.max(want, minDistV, minDistH);
  return { dist, scale, modelH, visibleH: visH * dist };
}

/**
 * Hitung posisi model di dalam frame (satuan dunia three.js).
 * - `align` (-1..1): 0 = di tengah frame, x 1 = menempel tepi kanan, y 1 = menempel tepi bawah.
 *   Aman: model tidak pernah keluar frame selama |align| <= 1.
 * - `offset` (fraksi ukuran panggung dalam px): geser halus tambahan untuk fine-tuning
 *   (x fraksi lebar panggung, y fraksi tinggi panggung; y positif = ke bawah). Boleh
 *   mendorong model keluar frame bila memang disengaja.
 * Fungsi murni — diekspor supaya bisa diuji tanpa WebGL.
 */
export function computeStagePlacement(opts: {
  visibleH: number;
  modelH: number;
  modelW: number;
  stageW: number;
  stageH: number;
  align?: [number, number];
  offset?: [number, number];
}): { x: number; y: number } {
  const visibleW = opts.stageH > 0 ? opts.visibleH * (opts.stageW / opts.stageH) : opts.visibleH;
  const slackV = Math.max(opts.visibleH - opts.modelH, 0);
  const slackH = Math.max(visibleW - opts.modelW, 0);
  const ax = opts.align?.[0] ?? 0;
  const ay = opts.align?.[1] ?? 0;
  const ox = opts.offset?.[0] ?? 0;
  const oy = opts.offset?.[1] ?? 0;
  const worldPerPx = opts.stageH > 0 ? opts.visibleH / opts.stageH : 0;
  return {
    x: ax * (slackH / 2) + ox * opts.stageW * worldPerPx,
    y: -ay * (slackV / 2) - oy * opts.stageH * worldPerPx,
  };
}

type Props = {
  /** Teks utama, mis. "Belum ada riwayat deposit" (opsional: panggung 3D saja). */
  text?: string;
  /** URL GLB custom; default model empty-state (boy.glb). */
  modelUrl?: string;
  /** Penjelasan tambahan di bawah teks utama (opsional). */
  sub?: string;
  /** Tinggi panggung 3D dalam px (desktop / lebar >= 640px). */
  height?: number;
  /** Tinggi panggung dalam px di layar sempit (< 640px); default sama dengan `height`. */
  mobileHeight?: number;
  /** Ikon cadangan bila 3D tidak bisa dirender. */
  fallbackIcon?: typeof Inbox;
  className?: string;
  /** Label aksesibilitas wadah. */
  ariaLabel?: string;
  /** Seberapa dekat kamera boleh mendekat (1 = jarak bawaan; >1 lebih dekat/besar). Default 1. */
  zoom?: number;
  /** Ukuran model dalam satuan dunia sebelum diframe kamera. Default 2.2. */
  targetSize?: number;
  /** Ruang gerak animasi: 1.4 = kamera dijauhkan sampai model + 40% ruang bebas terlihat utuh. */
  fitMargin?: number;
  /** Acuan skala model: 'max' (default) atau 'height' (tinggi model = targetSize). */
  fitBy?: FitBy;
  /** Sumbu yang dijaga muat: 'both' (default) atau 'vertical' (tinggi saja, boleh melebar). */
  fitAxes?: FitAxes;
  /** Ayunan + napas otomatis panggung. Default true. */
  motion?: boolean;
  /** Rotasi pose model dalam DERAJAT: [x/pitch, y/yaw, z/roll] — untuk mengarahkan badan/tangan model. */
  rotation?: [number, number, number];
  /** Posisi model di dalam frame, -1..1: [x, y] (y 1 = menempel tepi bawah frame). */
  align?: [number, number];
  /** Geser halus tambahan dalam fraksi ukuran panggung: [x, y] (y positif = ke bawah). */
  offset?: [number, number];
  /** Kelas lebar panggung; default 'max-w-[280px]' (pakai 'max-w-none w-full' untuk layar penuh). */
  stageClassName?: string;
};

export default function EmptyStateModel({
  text,
  modelUrl,
  sub,
  height = 220,
  mobileHeight,
  fallbackIcon: Icon = Inbox,
  className = '',
  ariaLabel,
  zoom = 1,
  targetSize = 2.2,
  fitMargin = 1.3,
  fitBy = 'max',
  fitAxes = 'both',
  motion = true,
  rotation = [0, 0, 0],
  align = [0, 0],
  offset = [0, 0],
  stageClassName = 'max-w-[280px]',
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  /** 'idle' → 'ready' (WebGL jalan) | 'failed' (pakai ikon cadangan). */
  const [state, setState] = useState<'idle' | 'ready' | 'failed'>('idle');
  /** Tinggi panggung efektif: `mobileHeight` di layar sempit, selain itu `height`. */
  const [stageH, setStageH] = useState(height);
  /** Konfigurasi tata letak terbaru — dibaca `layout()` agar resize tidak memuat ulang GLB. */
  const cfgRef = useRef({ stageH: height, zoom, targetSize, fitMargin, fitBy, fitAxes, motion, rotation, align, offset });
  const layoutRef = useRef<(() => void) | null>(null);
  // Array prop di-serialize supaya identitas baru tiap render tidak memicu tata letak berulang.
  const rotKey = rotation.join(',');
  const alignKey = align.join(',');
  const offsetKey = offset.join(',');

  useEffect(() => {
    const calc = () => {
      const w = typeof window === 'undefined' ? 1024 : window.innerWidth || 1024;
      setStageH(mobileHeight && w < 640 ? mobileHeight : height);
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [height, mobileHeight]);

  // Tata letak ulang (tanpa memuat ulang model) saat tinggi/zoom/ukuran/fit berubah.
  useEffect(() => {
    cfgRef.current = { stageH, zoom, targetSize, fitMargin, fitBy, fitAxes, motion, rotation, align, offset };
    layoutRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageH, zoom, targetSize, fitMargin, fitBy, fitAxes, motion, rotKey, alignKey, offsetKey]);

  // Muat GLB SEKALI per modelUrl; sesudahnya semua perubahan ukuran lewat layout().
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let raf = 0;
    let renderer: WebGLRenderer | null = null;
    let mixer: AnimationMixer | null = null;
    let clock: Clock | null = null;
    let pivot: Group | null = null;
    let camera: PerspectiveCamera | null = null;
    let observers: { disconnect: () => void }[] = [];

    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      observers.forEach((o) => { try { o.disconnect(); } catch { /* sudah dilepas */ } });
      observers = [];
      try { renderer?.dispose(); } catch { /* sudah dilepas */ }
      renderer = null;
      layoutRef.current = null;
      host.innerHTML = '';
    };

    (async () => {
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        if (disposed || !host.isConnected) return;

        const scene = new THREE.Scene();
        const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
        camera = cam;
        const webgl = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer = webgl;
        webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        webgl.domElement.setAttribute('aria-hidden', 'true');
        webgl.domElement.style.width = '100%';
        webgl.domElement.style.display = 'block';
        host.appendChild(webgl.domElement);

        // Pencahayaan lembut: hemisphere + key putih + rim cyan senada warna brand.
        scene.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.6));
        const key = new THREE.DirectionalLight(0xffffff, 2);
        key.position.set(2.2, 3, 2.6);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0x22d3ee, 0.9);
        rim.position.set(-2.4, 1.4, -2);
        scene.add(rim);

        const gltf = await new GLTFLoader().loadAsync(modelUrl || EMPTY_STATE_MODEL_URL);
        if (disposed || !host.isConnected) return;

        // Pusatkan model ke origin; skala + framing dihitung ulang setiap layout().
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const group = new THREE.Group();
        group.add(model);
        scene.add(group);
        pivot = group;

        /** Pose + penempatan terakhir; dipakai render loop agar ayunan tidak menimpa pose. */
        const pose = { yaw: 0, y: 0 };

        /** Terapkan ukuran panggung + skala model + jarak kamera terbaru (tanpa re-fetch GLB). */
        const layout = () => {
          if (disposed || !renderer || !camera) return;
          const c = cfgRef.current;
          const w = Math.max(host.clientWidth || 260, 120);
          const h = Math.max(c.stageH || 120, 60);
          const fit = computeStageFit({
            sizeX: size.x, sizeY: size.y, sizeZ: size.z, aspect: w / h, fovDeg: camera.fov,
            targetSize: c.targetSize, fitMargin: c.fitMargin, zoom: c.zoom, fitBy: c.fitBy, fitAxes: c.fitAxes,
          });
          model.scale.setScalar(fit.scale);
          model.position.set(-center.x * fit.scale, -center.y * fit.scale + 0.02, -center.z * fit.scale);
          renderer.setSize(w, h);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          camera.position.set(0, fit.dist * 0.06, fit.dist);
          camera.lookAt(0, 0, 0);
          // Pose model (derajat -> radian) + penempatan di dalam frame (align/offset).
          const [rx, ry, rz] = c.rotation;
          group.rotation.set((rx * Math.PI) / 180, (ry * Math.PI) / 180, (rz * Math.PI) / 180);
          const pos = computeStagePlacement({
            visibleH: fit.visibleH, modelH: fit.modelH, modelW: size.x * fit.scale,
            stageW: w, stageH: h, align: c.align, offset: c.offset,
          });
          group.position.set(pos.x, pos.y, 0);
          pose.yaw = group.rotation.y;
          pose.y = pos.y;
        };
        layoutRef.current = layout;
        layout();

        // Animasi bawaan GLB (idle/wave) diputar berulang bila ada.
        if (gltf.animations?.length) {
          clock = new THREE.Clock();
          mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(gltf.animations[0]).setLoop(THREE.LoopRepeat, Infinity).play();
        }

        if (typeof ResizeObserver === 'function') {
          const ro = new ResizeObserver(layout);
          ro.observe(host);
          observers.push(ro);
        }
        setState('ready');

        // Hormati prefers-reduced-motion: render satu frame saja tanpa animasi.
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true) {
          layout();
          renderer.render(scene, cam);
          return;
        }

        // Render loop: ayunan + napas halus; dijeda saat di luar viewport atau tab tersembunyi.
        let visible = true;
        if (typeof IntersectionObserver === 'function') {
          const io = new IntersectionObserver((entries) => { visible = entries[entries.length - 1]?.isIntersecting !== false; });
          io.observe(host);
          observers.push(io);
        }
        let t = 0;
        const tick = () => {
          if (disposed) return;
          raf = requestAnimationFrame(tick);
          if (!visible || document.hidden || !renderer || !camera) return;
          const delta = clock ? clock.getDelta() : 1 / 60;
          t += delta;
          mixer?.update(delta);
          if (pivot && cfgRef.current.motion) {
            pivot.rotation.y = pose.yaw + Math.sin(t * 0.35) * 0.55;
            pivot.position.y = pose.y + Math.sin(t * 1.1) * 0.045;
          }
          renderer.render(scene, camera);
        };
        tick();
      } catch (err) {
        console.warn('[EmptyStateModel] model 3D gagal dimuat, pakai ikon cadangan:', err);
        if (!disposed) { stop(); setState('failed'); }
      }
    })();

    return () => { disposed = true; stop(); };
  }, [modelUrl]);

  return (
    <div
      role="status"
      aria-label={ariaLabel ?? text}
      className={`flex flex-col items-center justify-center px-6 py-8 text-center ${className}`}
    >
      {state !== 'failed' && (
        <div
          ref={hostRef}
          className={`pointer-events-none w-full ${stageClassName}`}
          style={{ height: stageH, opacity: state === 'ready' ? 1 : 0.001 }}
          aria-hidden="true"
        />
      )}
      {state === 'failed' && (
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500">
          <Icon className="h-8 w-8" strokeWidth={1.6} />
        </span>
      )}
      {text && <p className="mt-3 font-display text-[15px] font-extrabold text-slate-900 dark:text-white">{text}</p>}
      {sub && <p className="mt-1.5 max-w-[320px] text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  );
}
