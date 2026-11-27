import { useEffect, useRef, useState } from 'react';
import { Inbox, RotateCcw } from 'lucide-react';
import type { AnimationMixer, Clock, Group, PerspectiveCamera, WebGLRenderer } from 'three';
import type { OrbitControls as OrbitControlsType } from 'three/addons/controls/OrbitControls.js';

/**
 * Panggung 3D — dipakai sebagai empty state riwayat (Riwayat Deposit, Riwayat Pesanan,
 * Riwayat Nomor) maupun sebagai panggung model interaktif (scene Order OTP).
 *
 * Model GLB diambil dari Supabase Storage folder public "video":
 *   https://zcxtbtleeeaeqeryiwea.supabase.co/storage/v1/object/public/video/boy.glb
 * three.js + GLTFLoader (+ OrbitControls bila `interactive`) di-import DINAMIS (type-only
 * import di atas tidak menambah bundle) agar beratnya tidak ikut ke chunk halaman. Bila
 * WebGL/model gagal dimuat, tampil ikon cadangan + teks yang sama sehingga halaman tidak
 * pernah blank.
 *
 * Mode `interactive`: kamera (POV) bisa digeser/diputar dengan drag atau satu jari,
 * di-zoom dengan scroll/pinch, dan di-pan dengan drag dua jari / klik kanan; ayunan otomatis
 * panggung dimatikan agar POV sepenuhnya milik pengguna, dan tersedia tombol Reset kamera.
 */
export const EMPTY_STATE_MODEL_URL =
  'https://zcxtbtleeeaeqeryiwea.supabase.co/storage/v1/object/public/video/boy.glb';

type Props = {
  /** Teks utama, mis. "Belum ada riwayat deposit" (opsional: panggung 3D saja). */
  text?: string;
  /** URL GLB custom; default model empty-state (boy.glb). */
  modelUrl?: string;
  /** Penjelasan tambahan di bawah teks utama (opsional). */
  sub?: string;
  /** Tinggi panggung 3D dalam px. */
  height?: number;
  /** Ikon cadangan bila 3D tidak bisa dirender. */
  fallbackIcon?: typeof Inbox;
  className?: string;
  /** Label aksesibilitas wadah. */
  ariaLabel?: string;
  /** Kamera bisa digeser/diputar + zoom (OrbitControls). Default: tidak (panggung pasif). */
  interactive?: boolean;
  /** Zoom awal — makin besar makin dekat kameranya, model tampak lebih besar. Default 1. */
  zoom?: number;
  /** Ukuran model dalam satuan dunia sebelum diframe kamera. Default 2.2. */
  targetSize?: number;
  /** Kelas lebar panggung; default 'max-w-[280px]' (pakai 'max-w-none w-full' untuk layar penuh). */
  stageClassName?: string;
  /** Tampilkan petunjuk kontrol + tombol Reset kamera. Default: ikut `interactive`. */
  showControls?: boolean;
};

export default function EmptyStateModel({
  text,
  modelUrl,
  sub,
  height = 220,
  fallbackIcon: Icon = Inbox,
  className = '',
  ariaLabel,
  interactive = false,
  zoom = 1,
  targetSize = 2.2,
  stageClassName = 'max-w-[280px]',
  showControls,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  /** Diisi setelah OrbitControls siap: dipakai tombol "Reset kamera". */
  const resetCamRef = useRef<(() => void) | null>(null);
  /** 'idle' → 'ready' (WebGL jalan) | 'failed' (pakai ikon cadangan). */
  const [state, setState] = useState<'idle' | 'ready' | 'failed'>('idle');
  const hint = showControls ?? interactive;

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
    let controls: OrbitControlsType | null = null;
    let observers: { disconnect: () => void }[] = [];

    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      observers.forEach((o) => { try { o.disconnect(); } catch { /* sudah dilepas */ } });
      observers = [];
      try { controls?.dispose(); } catch { /* sudah dilepas */ }
      controls = null;
      resetCamRef.current = null;
      try { renderer?.dispose(); } catch { /* sudah dilepas */ }
      renderer = null;
      host.innerHTML = '';
    };

    (async () => {
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        if (disposed || !host.isConnected) return;

        const scene = new THREE.Scene();
        const cam = new THREE.PerspectiveCamera(35, Math.max(host.clientWidth || 260, 120) / height, 0.1, 200);
        camera = cam;
        const webgl = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer = webgl;
        webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        webgl.setSize(Math.max(host.clientWidth || 260, 120), height);
        webgl.domElement.setAttribute('aria-hidden', 'true');
        webgl.domElement.style.width = '100%';
        webgl.domElement.style.height = `${height}px`;
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

        // Pusatkan model ke origin lalu skalakan agar pas di panggung.
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const target = Math.max(targetSize, 0.05);
        const scale = target / Math.max(size.y || 1, size.x || 1, size.z || 1, 0.0001);
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -center.y * scale + 0.02, -center.z * scale);
        const group = new THREE.Group();
        group.add(model);
        scene.add(group);
        pivot = group;

        // Jarak kamera = frame bawaan dibagi `zoom`: zoom > 1 ⇒ model tampak lebih besar.
        const dist = (target * 2.15) / Math.max(zoom, 0.2);
        cam.position.set(0, dist * 0.06, dist);
        cam.lookAt(0, 0, 0);

        // Animasi bawaan GLB (idle/wave) diputar berulang bila ada.
        if (gltf.animations?.length) {
          clock = new THREE.Clock();
          mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(gltf.animations[0]).setLoop(THREE.LoopRepeat, Infinity).play();
        }

        // Kamera interaktif: drag = putar POV, scroll/pinch = zoom, dua jari/klik kanan = pan.
        if (interactive) {
          const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
          if (disposed || !host.isConnected) return;
          const oc = new OrbitControls(cam, webgl.domElement);
          controls = oc;
          oc.enableDamping = true;
          oc.dampingFactor = 0.08;
          oc.rotateSpeed = 0.85;
          oc.zoomSpeed = 0.9;
          oc.panSpeed = 0.7;
          oc.screenSpacePanning = true;
          oc.minDistance = dist * 0.3;
          oc.maxDistance = dist * 3;
          oc.target.set(0, 0, 0);
          oc.saveState();
          oc.update();
          // Canvas menerima pointer (bukan lagi dekorasi) dan drag tidak menggulir halaman.
          webgl.domElement.style.touchAction = 'none';
          webgl.domElement.style.cursor = 'grab';
          const grab = (e: PointerEvent) => { webgl.domElement.style.cursor = e.type === 'pointerdown' ? 'grabbing' : 'grab'; };
          webgl.domElement.addEventListener('pointerdown', grab);
          webgl.domElement.addEventListener('pointerup', grab);
          webgl.domElement.addEventListener('pointercancel', grab);
          resetCamRef.current = () => { try { oc.reset(); } catch { /* controls sudah dilepas */ } };
        }

        const resize = () => {
          const w = host.clientWidth;
          if (!renderer || !camera || !w) return;
          renderer.setSize(w, height);
          camera.aspect = w / height;
          camera.updateProjectionMatrix();
          controls?.update();
        };
        if (typeof ResizeObserver === 'function') {
          const ro = new ResizeObserver(resize);
          ro.observe(host);
          observers.push(ro);
        }
        setState('ready');

        // Hormati prefers-reduced-motion: tanpa animasi otomatis, tapi kamera tetap bisa digeser.
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true) {
          resize();
          renderer.render(scene, cam);
          if (controls) {
            const c = controls;
            const r = renderer;
            c.addEventListener('change', () => { if (!disposed) r.render(scene, cam); });
          }
          return;
        }

        // Render loop: ayunan + napas halus (mode pasif); dijeda saat di luar viewport/tab tersembunyi.
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
          // Mode interaktif: POV milik pengguna, ayunan otomatis dimatikan.
          if (pivot && !interactive) {
            pivot.rotation.y = Math.sin(t * 0.35) * 0.55;
            pivot.position.y = Math.sin(t * 1.1) * 0.045;
          }
          controls?.update();
          renderer.render(scene, camera);
        };
        tick();
      } catch (err) {
        console.warn('[EmptyStateModel] model 3D gagal dimuat, pakai ikon cadangan:', err);
        if (!disposed) { stop(); setState('failed'); }
      }
    })();

    return () => { disposed = true; stop(); };
  }, [height, modelUrl, interactive, zoom, targetSize]);

  return (
    <div
      role="status"
      aria-label={ariaLabel ?? text}
      className={`flex flex-col items-center justify-center px-6 py-8 text-center ${className}`}
    >
      {state !== 'failed' && (
        <div
          ref={hostRef}
          className={`w-full ${interactive ? 'pointer-events-auto' : 'pointer-events-none'} ${stageClassName}`}
          style={{ height, opacity: state === 'ready' ? 1 : 0.001 }}
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
      {hint && state !== 'failed' && (
        <div className="mt-2 flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span>
            {interactive
              ? 'Geser untuk memutar kamera · scroll/pinch untuk zoom · dua jari untuk menggeser posisi'
              : 'Model 3D beranimasi'}
          </span>
          {interactive && (
            <button
              type="button"
              data-orbit-reset=""
              onClick={() => resetCamRef.current?.()}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[10.5px] font-bold text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-700 dark:text-slate-300"
            >
              <RotateCcw className="h-3 w-3" strokeWidth={2.2} /> Reset kamera
            </button>
          )}
        </div>
      )}
    </div>
  );
}
