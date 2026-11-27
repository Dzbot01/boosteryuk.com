import { useEffect, useState } from 'react';
import EmptyStateModel from './EmptyStateModel';

/**
 * Model 3D karakter (gadis berambut tosca, baju pink) yang "merangkul" pojok KIRI ATAS card
 * image slider. GLB diambil dari Supabase Storage folder public "video" — nama file aslinya
 * mengandung spasi sehingga di-encode sebagai %20:
 *   https://zcxtbtleeeaeqeryiwea.supabase.co/storage/v1/object/public/video/scene (1).glb
 */
export const SLIDER_HUG_MODEL_URL =
  'https://zcxtbtleeeaeqeryiwea.supabase.co/storage/v1/object/public/video/scene%20(1).glb';

/**
 * ============================================================================
 *  PANEL FINE-TUNING posisi & pose model di pojok kiri atas card slider
 * ============================================================================
 * Semua nilai di bawah bisa diubah tanpa menyentuh kode lain. Satuan:
 *   px      → width / mobileWidth / top / left / mobileTop / mobileLeft
 *   rasio   → ratio (tinggi panggung = width × ratio)
 *   derajat → pitchDeg / yawDeg / rollDeg
 *   -1..1   → alignX / alignY (posisi model di dalam panggungnya)
 *   fraksi  → offsetX / offsetY (geser halus, fraksi lebar/tinggi panggung)
 *
 * Cara cepat menyetel:
 *   • Model terlalu menutupi image  → perkecil `width`, atau naikkan `top` lebih negatif.
 *   • Model kurang "nempel" di card → turunkan `top` (mis. -110 → -90) supaya bagian
 *     bawah model lebih masuk ke card. Bagian yang masuk ke card = (width × ratio) + top.
 *   • Model terpotong tepi kiri     → naikkan `left` (mis. -20 → -8); jaga >= -16 di mobile
 *     agar tidak menimbulkan scroll horizontal (padding halaman 16px).
 *   • Tangan belum tepat di garis   → setel `yawDeg`/`rollDeg` (arah badan & lengan),
 *     lalu `alignX`/`alignY` (geser di dalam panggung, aman tidak keluar frame),
 *     terakhir `offsetX`/`offsetY` (geser halus; y positif = ke bawah).
 *   • Model kurang besar/kecil      → `zoom` (kamera mendekat) dan `fitMargin`
 *     (ruang kosong di dalam panggung; 1.05 = model hampir mengisi penuh).
 */
export const SLIDER_HUG = {
  /* --- ukuran panggung model (px): kecil saja agar tidak menutupi isi slider --- */
  width: 120, // desktop 90–130px
  mobileWidth: 84, // mobile 70–90px
  ratio: 1.3, // tinggi panggung = width × ratio (model berdiri ⇒ sedikit lebih tinggi)

  /* --- posisi wrapper terhadap pojok KIRI ATAS card (negatif = di luar card) --- */
  top: -110, // badan model di ATAS tepi card; hanya ±46px bagian bawah yang masuk ke card
  left: -20, // sedikit keluar sisi kiri card (tangan kiri menumpu di tepi kiri)
  mobileTop: -76, // ±33px bagian bawah masuk ke card di layar sempit
  mobileLeft: -12, // jangan lebih negatif dari -16 (padding halaman) agar tidak overflow
  zIndex: 20, // di atas slider, di bawah modal/header (biasanya z-50 ke atas)

  /* --- pose model (derajat) agar tangan menghadap tepi card --- */
  pitchDeg: 4, // sumbu X: mendongak/menunduk
  yawDeg: -26, // sumbu Y: badan menyerong ke arah pojok card
  rollDeg: 0, // sumbu Z: miringkan badan ke arah card bila tangan belum "memeluk"

  /* --- posisi model di dalam panggung (-1..1) + geser halus (fraksi panggung) --- */
  alignX: 0, // -1 = menempel tepi kiri panggung, 1 = tepi kanan
  alignY: 1, // 1 = menempel tepi BAWAH panggung (kaki/pinggul tepat di tepi atas card)
  offsetX: 0, // fraksi lebar panggung (positif = ke kanan)
  offsetY: 0, // fraksi tinggi panggung (positif = ke bawah)

  /* --- framing kamera --- */
  zoom: 1.45, // >1 = kamera lebih dekat (model lebih besar di dalam panggung)
  fitMargin: 1.06, // ruang gerak animasi 6% agar model tidak menempel tepi panggung
};

export type SliderHugConfig = Partial<typeof SLIDER_HUG>;

/**
 * Overlay model 3D di pojok kiri atas card slider.
 *
 * Dipakai sebagai SIBLING dari card slider di dalam wrapper `relative` (lihat LayananPage,
 * OrderVpsPage, SewaAgenAiPage):
 *
 *   <div className="relative mx-auto w-full max-w-2xl">   // overflow visible (default)
 *     <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[22px] ...">
 *       ...image slider + dots...                          // hanya card ini yang memotong
 *     </div>
 *     <SliderHugModel />                                   // menempel di sudut, tidak memotong
 *   </div>
 *
 * `pointer-events-none` + `aria-hidden` sehingga slider tetap bisa diklik/di-drag, dots tetap
 * jalan, auto-advance tidak terganggu, dan screen reader tidak membacakan elemen dekoratif.
 */
export default function SliderHugModel({ cfg, className = '' }: { cfg?: SliderHugConfig; className?: string }) {
  const c = { ...SLIDER_HUG, ...cfg };
  /** Layar sempit (< 640px): model diperkecil dan digeser agar tetap tidak menutupi slider. */
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const calc = () => setNarrow((typeof window === 'undefined' ? 1024 : window.innerWidth || 1024) < 640);
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  const w = narrow ? c.mobileWidth : c.width;
  const h = Math.round(w * c.ratio);
  const top = narrow ? c.mobileTop : c.top;
  const left = narrow ? c.mobileLeft : c.left;

  return (
    <div
      data-slider-hug=""
      className={`pointer-events-none absolute select-none ${className}`}
      style={{ top, left, width: w, height: h, zIndex: c.zIndex }}
      aria-hidden="true"
    >
      <EmptyStateModel
        modelUrl={SLIDER_HUG_MODEL_URL}
        height={h}
        fitBy="height"
        fitAxes="both"
        fitMargin={c.fitMargin}
        zoom={c.zoom}
        motion={false}
        rotation={[c.pitchDeg, c.yawDeg, c.rollDeg]}
        align={[c.alignX, c.alignY]}
        offset={[c.offsetX, c.offsetY]}
        stageClassName="max-w-none w-full"
        className="!p-0"
      />
    </div>
  );
}
