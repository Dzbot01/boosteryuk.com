interface HamburgerToggleProps {
  /** State menu terbuka/tertutup — menggerakkan animasi morph hamburger → silang. */
  open: boolean;
  onToggle: () => void;
  /** Kelas posisi/warna (ukuran default 44px, tanpa card). */
  className?: string;
  /** Label aksesibilitas & tooltip. */
  label?: string;
  /** Dipanggil saat kursor masuk (dipakai untuk hover-open di desktop). */
  onMouseEnter?: () => void;
}

/**
 * Toggle side menu — adaptasi animasi dari Uiverse.io (talhabangyal).
 * Tanpa card/latar; warna garis mengikuti currentColor agar responsif terhadap tema.
 * Input checkbox asli (visually hidden tapi tetap fokusable) → keyboard & screen reader ramah.
 * Atribut data-by-menu-toggle dipakai handler "klik di mana saja untuk menutup" agar tidak bentrok.
 */
export default function HamburgerToggle({ open, onToggle, className = '', label = 'Buka/tutup menu', onMouseEnter }: HamburgerToggleProps) {
  return (
    <label className={`by-hamburger ${className}`} onMouseEnter={onMouseEnter} title={label} data-by-menu-toggle>
      <input type="checkbox" checked={open} onChange={onToggle} aria-label={label} />
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path
          className="by-line by-line-top-bottom"
          d="M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22"
        />
        <path className="by-line" d="M7 16 27 16" />
      </svg>
    </label>
  );
}
