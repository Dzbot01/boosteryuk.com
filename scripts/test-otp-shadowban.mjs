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
assert.match(otp, /Apa itu Shadowban\?/, 'judul bagian shadowban');
assert.match(otp, /rate OTP hingga 95%/);
assert.match(otp, /https:\/\/qpanel\.org\/panel\/requestlayanan/, 'tautan Request Layanan');
assert.match(otp, /https:\/\/tinyurl\.com\/qpaneldoc/, 'tautan panduan KLIK DISINI');
assert.match(otp, /https:\/\/qpanel\.org\/panel\/serverstatus/, 'tautan Server Status');
assert.match(otp, /https:\/\/qpanel\.org\/panel\/number-checker/, 'tautan Number Checker promo');
for (const t of ['SMS Tidak Masuk?', 'Apa itu Shadow Ban?', 'Bagaimana Mencari OTP Fresh?', 'Baca Info Penting!!']) {
  assert.ok(otp.includes(t), `tautan cepat ${t}`);
}
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

console.log('PASS Order OTP: Syarat & ketentuan di card Cara pakai, keterangan Shadowban + tautan + 2 gambar contoh, audio Guri hanya saat baru login.');
