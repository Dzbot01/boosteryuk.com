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
 */
import Studio from './editor/Studio';

export default function EditorStudio() {
  return <Studio />;
}
