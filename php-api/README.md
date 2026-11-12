# Playground backend (PHP)

File proxy untuk fitur **Playground**. Upload ke server PHP yang melayani
`https://boosteryuk.com/api/` (lokasi yang sama dengan `register.php`).

| File      | URL produksi                          | Fungsi                                   |
|-----------|---------------------------------------|------------------------------------------|
| `ai.php`  | `https://boosteryuk.com/api/ai.php`   | Hook Generator & Auto Caption (siputzx)  |
| `tts.php` | `https://boosteryuk.com/api/tts.php`  | Teks To Speech (ElevenLabs)              |

## 1. ElevenLabs API key (WAJIB untuk Teks To Speech)

Key **tidak boleh** ada di kode frontend / browser. Set di server, salah satu:

- **Environment variable** (disarankan):
  ```
  ELEVENLABS_API_KEY=xi-xxxxxxxxxxxxxxxx
  ```
  (cPanel: Setup → Environment Variables; atau tambahkan `SetEnv ELEVENLABS_API_KEY ...`
  di `.htaccess` folder `api/`.)

- **atau** buat file `api/tts_config.php` (JANGAN di-commit):
  ```php
  <?php return ['key' => 'xi-xxxxxxxxxxxxxxxx'];
  ```

Uji: buka `https://boosteryuk.com/api/tts.php?action=models` → harus muncul daftar model.

## 2. Coba VPS (web-SSH)

Frontend memakai konstanta `WEBSSH_URL` di `src/services/playgroundApi.ts`.
Jalankan layanan web-SSH di VPS lalu isi URL-nya, contоh dengan **ttyd**:

```bash
# di VPS (auto login sebagai root)
ttyd -p 7681 -W bash        # atau: ttyd -p 7681 login
# amankan dengan reverse proxy HTTPS (nginx) -> https://vps.domain/terminal
```

Lalu set di frontend:
```ts
export const WEBSSH_URL = 'https://vps.domain/terminal';
```

> Catatan keamanan: batasi akses web-SSH (auth/token, IP allowlist) karena memberi
> shell root. Jangan taruh kredensial SSH di frontend.

## 3. Kuota download TTS

Dibatasi **7×/minggu per user** (hanya user terdaftar yang bisa download).
Saat ini dihitung di sisi klien (localStorage). Untuk anti-manipulasi, pindahkan
perhitungan kuota ke server (mis. tabel `tts_quota` di DB) pada iterasi berikutnya.

## Pengaturan website (Berita Overview, Favicon, teks Brand/Overview) — `site_settings.php`

Disimpan di MySQL agar sama untuk **semua pengunjung** (bukan lagi localStorage per-browser).

1. Upload `site_settings.php` ke folder `/api` (satu folder dengan `configdb.php`).
   Koneksi diambil otomatis dari `configdb.php` (`$conn`). Tidak perlu `me.php`.
2. Buat tabel: jalankan `site_settings.sql` di phpMyAdmin (opsional — tabel juga dibuat
   otomatis saat endpoint pertama kali diakses).
3. Tes: buka `https://boosteryuk.com/api/site_settings.php` → `{"ok":true,"settings":{...}}`.

Simpan (POST) hanya untuk **admin**: token dicek di tabel `sessions` (pakai
`getUserIdByToken()` dari configdb.php) lalu `users.role = 'admin'`.

## Order Sewa Agen AI — `agent_order.php`

Saldo user dipotong **di database** (bukan hanya di UI), pola sama seperti `order.php`.

1. Upload `agent_order.php` + `agent.php` (versi terbaru) ke `/api`. `order.php` tidak diubah.
2. Alur: token → `users` → harga dihitung server (`starter` 10.000, `medium` 35.000,
   `bisnis` 75.000 × bulan 1–12; harga dari klien diabaikan) →
   `UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?` (atomik) →
   insert `riwayat_pesanan` (`AI<timestamp>`, "Agen AI WhatsApp <Paket> - Jatuh tempo ...") →
   panggil VPS `/session`. Jika VPS gagal → saldo **dikembalikan** & riwayat `batal`.
3. Respon: `{ok, orderId, new_balance, ...}` — UI memakai `new_balance` dari server.
4. `agent.php?action=create` kini ditolak (410); `status`/`resend` wajib token pemilik order.

Kartu Overview "Server VPS Aktif" & "AI Agent Aktif" dihitung dari `riwayat_pesanan.php`
(status ≠ batal, agen yang lewat jatuh tempo tidak dihitung).
