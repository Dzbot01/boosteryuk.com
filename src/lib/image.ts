/**
 * Perkecil gambar sebelum disimpan ke database (data URL).
 * - type 'image/jpeg' untuk foto (hero, slider), 'image/png' untuk logo (transparansi tetap).
 */
export function compressImage(file: File, maxWidth = 1920, type: 'image/jpeg' | 'image/png' = 'image/jpeg', quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('Gunakan gambar JPG, PNG, atau WebP.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      const ctx = c.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) return reject(new Error('Canvas tidak tersedia'));
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL(type, quality);
      if (data.length > 2_700_000) return reject(new Error('Gambar terlalu besar setelah dikompres. Coba gambar lain.'));
      resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('File bukan gambar yang valid'));
    };
    img.src = url;
  });
}
