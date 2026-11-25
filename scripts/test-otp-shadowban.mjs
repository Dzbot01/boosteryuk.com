import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

/* 1. Halaman Order OTP: judul baru "Syarat dan ketentuan" di dalam card Cara pakai */
const otp = read('src/pages/OrderOtpPage.tsx');
assert.match(otp, /Cara pakai/, 'card Cara pakai tetap ada');
assert.match(otp, /Syarat dan ketentuan/, 'judul baru Syarat dan ketentuan');
for (const frag of [
  'Nomor yang sudah mendapatkan kode OTP dinyatakan Pesanan Sukses, tidak bisa di refund jika suatu saat nomor',
  'Segera lakukan verifikasi pada aplikasi layanan yang Anda pilih untuk',
  'pastikan menunggu minimal 3 menit untuk menunggu kode OTP',
  'stok yang di pilih pada harga tersebut sedang sedikit atau kosong -',
  'Pilih harga yang lebih tinggi untuk mendapatkan Rate OTP tinggi.',
]) assert.ok(otp.includes(frag), `teks syarat: ${frag.slice(0, 40)}…`);

/* 2. Keterangan Shadowban + tautan + gambar contoh */
/* Penjelasan shadow ban hanya satu: judul dobel di bagian atas sudah dihapus. */
assert.doesNotMatch(otp, /<h2[^>]*>Apa itu Shadowban\?<\/h2>/, 'judul shadowban di atas tidak lagi ada');
assert.match(otp, /<h3[^>]*>Apa itu Shadow Ban\?<\/h3>/, 'penjelasan shadow ban yang lebih detail tetap ada');
assert.equal((otp.match(/Penjelasan Shadow Ban/g) || []).length, 1, 'hanya satu blok penjelasan shadow ban');
assert.match(otp, /aria-label="Keterangan penting dan penjelasan shadow ban"/, 'seksi keterangan tetap ada');
/* Bullet promo + 4 tautan cepat qpanel sudah dihapus atas permintaan user. */
assert.doesNotMatch(otp, /qpanel\.org/i, 'tidak ada lagi tautan qpanel.org');
assert.doesNotMatch(otp, /tinyurl\.com/i, 'tidak ada lagi tautan tinyurl');
for (const t of ['rate OTP hingga 95%', 'Request Layanan', 'KLIK DISINI', 'Server Status',
  'Pilih OTP Lebih Mahal untuk mendapatkan service terbaik', 'PROMO SPESIAL', 'Rp.50/Check',
  'SMS Tidak Masuk?', 'Bagaimana Mencari OTP Fresh?', 'Baca Info Penting!!']) {
  assert.ok(!otp.includes(t), `teks dihapus: ${t}`);
}
assert.doesNotMatch(otp, /<ul className="list-disc/, 'daftar bullet di atas penjelasan hilang');
/* Penyebutan server kini memakai domain panel yang sedang dibuka, bukan QPanel.org. */
assert.ok(!/QPanel\.org/i.test(otp.replace(/^.*CHILD_PANEL_SUB.*$/gm, '')), 'teks QPanel.org tidak dipakai lagi');
assert.match(otp, /import \{ CHILD_PANEL_SUB \} from '\.\.\/lib\/apiBase';/, 'host child panel dipakai');
assert.match(otp, /const PANEL_HOST = CHILD_PANEL_SUB \? `\$\{CHILD_PANEL_SUB\}\.boosteryuk\.com` : 'boosteryuk\.com';/, 'domain panel: nama child atau boosteryuk.com');
assert.match(otp, /perangkat pengguna\/server\{' '\}/, 'frasa "perangkat pengguna/server" dipertahankan');
assert.match(otp, /<a href=\{`http:\/\/\$\{PANEL_HOST\}`\}[^>]*>\{PANEL_HOST\}<\/a>/, 'tautan server = domain panel');
assert.match(otp, /Penjelasan Shadow Ban/);
assert.match(otp, /Kenapa Shadow Ban Terjadi\?/);
assert.match(otp, /Apa itu Fingerprint Perangkat\?/);
assert.ok(otp.includes('Shadow ban bukan disebabkan oleh boosteryuk.com'), 'catatan penting penyebab shadow ban');
assert.ok(otp.includes('Gunakan perangkat baru(fresh) atau modifikasi IMEI/ID DEVICE di ponsel'), 'solusi');
assert.ok(otp.includes('tidak bersifat permanen'), 'info sifat sementara');
assert.match(otp, /src="\/images\/shadowban-contoh-1\.jpg"/, 'gambar contoh 1 dipakai');
assert.match(otp, /src="\/images\/shadowban-contoh-2\.png"/, 'gambar contoh 2 dipakai');
assert.ok(fs.existsSync('public/images/shadowban-contoh-1.jpg'), 'aset gambar contoh 1 ada');
assert.ok(fs.existsSync('public/images/shadowban-contoh-2.png'), 'aset gambar contoh 2 ada');

/* 2b. Kartu shadow ban pindah ke atas (sebelum card order), tertutup default, tombol buka di kanan */
const iShadow = otp.indexOf('aria-label="Keterangan penting dan penjelasan shadow ban"');
const iOrderCard = otp.indexOf('Buat Pesanan Nomor');
assert.ok(iShadow > -1 && iOrderCard > -1, 'kedua card ada');
assert.ok(iShadow < iOrderCard, 'card shadow ban berada di atas card order OTP');
assert.match(otp, /const \[shadowOpen, setShadowOpen\] = useState\(false\);/, 'penjelasan shadow ban tertutup secara default');
assert.match(otp, /aria-expanded=\{shadowOpen\}/, 'tombol toggle melaporkan status buka/tutup');
assert.match(otp, /aria-controls="otp-shadowban-body"/, 'tombol toggle menautkan isi card');
assert.match(otp, /className=\{shadowOpen \? 'mt-2' : 'hidden'\}/, 'isi card disembunyikan saat tertutup');
assert.match(otp, /Buka penjelasan/, 'label tombol saat tertutup');
assert.match(otp, /Tutup penjelasan/, 'label tombol saat terbuka');
/* Tombol toggle ada di sisi kanan card: satu baris flex bersama judul. */
const headerBlock = otp.slice(iShadow, otp.indexOf('otp-shadowban-body'));
assert.match(headerBlock, /<div className="flex items-center justify-between gap-3">/, 'header card: judul kiri, tombol kanan');
assert.ok(headerBlock.indexOf('Apa itu Shadow Ban?') < headerBlock.indexOf('onClick={() => setShadowOpen((v) => !v)}'), 'tombol setelah judul (posisi kanan)');

/* 2c. Riwayat nomor (sukses & batal) dipisah jadi card tabel di bawah card order, maks 10 baris */
assert.match(otp, /const RIWAYAT_MAX = 10;/, 'batas 10 baris riwayat');
assert.match(otp, /\.slice\(0, RIWAYAT_MAX\)/, 'riwayat dipotong maksimal 10 baris');
assert.match(otp, /orders\.filter\(\(o\) => o\.status !== 'menunggu' && o\.status !== 'membeli'\)/, 'riwayat = pesanan yang sudah berakhir (sukses/batal)');
const iRiwayat = otp.indexOf('aria-label="Riwayat nomor OTP"');
assert.ok(iRiwayat > iOrderCard, 'card riwayat berada di bawah card order');
assert.match(otp, /<h2[^>]*>Riwayat Nomor<\/h2>/, 'judul card riwayat nomor');
assert.ok(!/orders\.slice\(0, 8\)/.test(otp), 'daftar riwayat lama di dalam card order sudah dihapus');
assert.match(otp, /\{active\.map\(\(o\) => \{/, 'card order hanya menampilkan nomor aktif');
assert.match(otp, /<table className="w-full min-w-\[760px\] border-collapse text-left text-\[12px\]">/, 'riwayat tampil sebagai tabel');
assert.match(otp, /\['Waktu', 'Layanan', 'Negara', 'Nomor', 'Kode OTP', 'Harga', 'Status'\]/, 'kolom tabel riwayat');
assert.ok(otp.indexOf('Belum ada nomor aktif') < iRiwayat, 'keterangan nomor aktif tetap di card order');

/* 3. Bug audio Guri Booster: hanya play saat baru selesai login */
const ses = read('src/components/GuriVoiceSession.tsx');
assert.match(ses, /const JUST_LOGIN_KEY = 'by-just-logged-in'/, 'kunci penanda login baru');
assert.match(ses, /function consumeJustLoggedIn\(\)/, 'penanda dikonsumsi sekali');
assert.match(ses, /sessionStorage\.removeItem\(JUST_LOGIN_KEY\)/, 'penanda dihapus setelah dipakai');
assert.match(ses, /JUST_LOGIN_WINDOW_MS = 2 \* 60 \* 1000/, 'jendela waktu penanda login');
assert.match(ses, /if \(!consumeJustLoggedIn\(\)\) \{/, 'tanpa penanda → tidak play (refresh/pulihkan sesi)');
assert.match(ses, /boostyVoice\.start\(voiceMode\)/, 'play hanya setelah penanda valid');

const auth = read('src/context/AuthContext.tsx');
const marks = auth.match(/sessionStorage\.setItem\('by-just-logged-in', String\(Date\.now\(\)\)\)/g) || [];
assert.equal(marks.length, 2, 'penanda diset di login() dan loginWithGoogle()');

const voice = read('src/services/boostyVoice.ts');
assert.match(voice, /RETRY_WINDOW_MS = 60_000/, 'jendela retry gesture dibatasi');
assert.match(voice, /Date\.now\(\) - retryStartedAt > RETRY_WINDOW_MS/, 'klik lama setelah login tidak membunyikan audio');

console.log('PASS Order OTP: card shadow ban di atas & tertutup default (tombol kanan), riwayat nomor (sukses/batal) jadi card tabel maks 10 baris di bawah card order, Syarat & ketentuan tetap, bullet promo + tautan qpanel dihapus, audio Guri hanya saat baru login.');
