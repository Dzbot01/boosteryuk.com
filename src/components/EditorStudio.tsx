/**
 * EditorStudio — ruang edit video & foto di Playground (menu "Editor Studio").
 *
 * UI mengikuti tata letak aplikasi editor desktop: TopBar → panel media (kiri) +
 * Player (tengah) + Inspector (kanan) → Timeline (bawah). Semua komponen berada di
 * `src/components/editor/` dan state bersama dikelola Zustand (`editor/store.ts`).
 *
 * Fungsi nyata tetap berjalan lokal di browser:
 *  - Import media (klik atau tarik-lepas) → thumbnail & durasi dibaca client-side.
 *  - Playback preview tersinkron playhead timeline (trim/split/move/undo-redo).
 *  - Export: foto → PNG, video → rekaman canvas + audio (.webm/VP9/Opus).
 * Tidak ada unggahan ke server.
 *
 * Studio mengisi seluruh layar (layer fixed inset-0 di PlaygroundPage) dan mendukung
 * layar sempit: panel jadi bottom sheet, toolbar bisa digeser, semua kontrol pakai pointer.
 */
import Studio from './editor/Studio';

/**
 * `onOpenMenu` membuka drawer menu Playground dari dalam studio (dipakai saat studio
 * tampil layar penuh, sehingga tombol menu halaman tidak terlihat lagi).
 */
export default function EditorStudio({ onOpenMenu }: { onOpenMenu?: () => void }) {
  return <Studio onOpenMenu={onOpenMenu} />;
}
