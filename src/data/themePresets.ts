// Preset warna tema untuk child panel (admin bisa menyesuaikan tiap warna setelah memilih preset).
export interface ThemePreset {
  id: string;
  name: string;
  accent: string; // teks brand
  header: string; // kartu header (transparan)
  menu: string; // tombol aktif side menu
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'cyan', name: 'Cyan (bawaan)', accent: '#0891b2', header: '#ffffff', menu: '#0891b2' },
  { id: 'ocean', name: 'Biru Laut', accent: '#2563eb', header: '#dbeafe', menu: '#1d4ed8' },
  { id: 'violet', name: 'Ungu', accent: '#7c3aed', header: '#ede9fe', menu: '#6d28d9' },
  { id: 'rose', name: 'Merah Muda', accent: '#db2777', header: '#fce7f3', menu: '#be185d' },
  { id: 'crimson', name: 'Merah', accent: '#dc2626', header: '#fee2e2', menu: '#b91c1c' },
  { id: 'sunset', name: 'Oranye', accent: '#ea580c', header: '#ffedd5', menu: '#c2410c' },
  { id: 'gold', name: 'Emas', accent: '#ca8a04', header: '#fef9c3', menu: '#a16207' },
  { id: 'emerald', name: 'Hijau', accent: '#059669', header: '#d1fae5', menu: '#047857' },
  { id: 'teal', name: 'Toska', accent: '#0f766e', header: '#ccfbf1', menu: '#115e59' },
  { id: 'slate', name: 'Abu Gelap', accent: '#334155', header: '#e2e8f0', menu: '#1e293b' },
];
