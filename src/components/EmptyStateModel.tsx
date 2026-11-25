import { useEffect, useRef, useState } from 'react';
import { Inbox } from 'lucide-react';
import type { AnimationMixer, Clock, Group, PerspectiveCamera, WebGLRenderer } from 'three';

/**
 * Empty state 3D — dipakai saat sebuah riwayat belum punya data:
 * Riwayat Deposit, Riwayat Pesanan, dan Riwayat Nomor (Order OTP).
 *
 * Model GLB diambil dari Supabase Storage folder public "video":
 *   https://zcxtbtleeeaeqeryiwea.supabase.co/storage/v1/object/public/video/boy.glb
 * three.js + GLTFLoader di-import DINAMIS (type-only import di atas tidak menambah bundle)
 * agar beratnya tidak ikut ke chunk halaman. Bila WebGL/model gagal dimuat, tampil ikon
 * cadangan + teks yang sama sehingga halaman tidak pernah blank.
 */
export const EMPTY_STATE_MODEL_URL =
  'https://zcxtbtleeeaeqeryiwea.supabase.co/storage/v1/object/public/video/boy.glb';

type Props = {
  /** Teks utama, mis. "Belum ada riwayat deposit". */
  text: string;
  /** Penjelasan tambahan di bawah teks utama (opsional). */
  sub?: string;
  /** Tinggi panggung 3D dalam px. */
  height?: number;
  /** Ikon cadangan bila 3D tidak bisa dirender. */
  fallbackIcon?: typeof Inbox;
  className?: string;
  /** Label aksesibilitas wadah. */
  ariaLabel?: string;
};

export default function EmptyStateModel({
  text,
  sub,
  height = 220,
  fallbackIcon: Icon = Inbox,
  className = '',
  ariaLabel,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  /** 'idle' → 'ready' (WebGL jalan) | 'failed' (pakai ikon cadangan). */
  const [state, setState] = useState<'idle' | 'ready' | 'failed'>('idle');

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
      host.innerHTML = '';
    };

    (async () => {
      try {
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        if (disposed || !host.isConnected) return;

        const scene = new THREE.Scene();
        const cam = new THREE.PerspectiveCamera(35, Math.max(host.clientWidth || 260, 120) / height, 0.1, 100);
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

        const gltf = await new GLTFLoader().loadAsync(EMPTY_STATE_MODEL_URL);
        if (disposed || !host.isConnected) return;

        // Pusatkan model ke origin lalu skalakan agar pas di panggung.
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const target = 2.2;
        const scale = target / Math.max(size.y || 1, size.x || 1, size.z || 1, 0.0001);
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -center.y * scale + 0.02, -center.z * scale);
        const group = new THREE.Group();
        group.add(model);
        scene.add(group);
        pivot = group;
        cam.position.set(0, 0.25, target * 2.15);
        cam.lookAt(0, 0, 0);

        // Animasi bawaan GLB (idle/wave) diputar berulang bila ada.
        if (gltf.animations?.length) {
          clock = new THREE.Clock();
          mixer = new THREE.AnimationMixer(model);
          mixer.clipAction(gltf.animations[0]).setLoop(THREE.LoopRepeat, Infinity).play();
        }

        const resize = () => {
          const w = host.clientWidth;
          if (!renderer || !camera || !w) return;
          renderer.setSize(w, height);
          camera.aspect = w / height;
          camera.updateProjectionMatrix();
        };
        if (typeof ResizeObserver === 'function') {
          const ro = new ResizeObserver(resize);
          ro.observe(host);
          observers.push(ro);
        }
        setState('ready');

        // Hormati prefers-reduced-motion: render satu frame saja tanpa animasi.
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true) {
          resize();
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
          if (pivot) {
            pivot.rotation.y = Math.sin(t * 0.35) * 0.55;
            pivot.position.y = Math.sin(t * 1.1) * 0.045;
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
  }, [height]);

  return (
    <div
      role="status"
      aria-label={ariaLabel ?? text}
      className={`flex flex-col items-center justify-center px-6 py-8 text-center ${className}`}
    >
      {state !== 'failed' && (
        <div
          ref={hostRef}
          className="pointer-events-none w-full max-w-[280px]"
          style={{ height, opacity: state === 'ready' ? 1 : 0.001 }}
          aria-hidden="true"
        />
      )}
      {state === 'failed' && (
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500">
          <Icon className="h-8 w-8" strokeWidth={1.6} />
        </span>
      )}
      <p className="mt-3 font-display text-[15px] font-extrabold text-slate-900 dark:text-white">{text}</p>
      {sub && <p className="mt-1.5 max-w-[320px] text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">{sub}</p>}
    </div>
  );
}
