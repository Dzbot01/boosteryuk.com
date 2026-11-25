# Pengaturan Database — pembersihan rutin riwayat user (tanpa cron)

## Yang diminta

- Setiap **tahun**: hapus data riwayat user (pesanan & deposit).
- Setiap **1 bulan**: hapus data pesanan/deposit yang **gagal**.

Hosting tidak punya cron, jadi pembersihan dipicu oleh request admin (pola yang sama dengan
`agent_reminder.php`): setiap kali admin membuka halaman data, jadwal yang sudah jatuh tempo
dijalankan — maksimal satu kali per periode.

## Jadwal

| Jadwal | Periode | Yang dihapus | Batas umur |
| --- | --- | --- | --- |
| `yearly` | tahun kalender (WIB) | **semua** riwayat order & deposit | lebih tua dari 1 tahun |
| `monthly` | bulan kalender (WIB) | hanya data **gagal** | lebih tua dari 1 bulan |

Definisi "gagal":

- `riwayat_pesanan.status = 'batal'`
- `otp_orders.status IN ('batal','gagal')`
- `deposits.status <> 'paid'` (baris yang tidak pernah menjadi deposit masuk)
- `deposit_invoices.status IN ('CANCELLED','FAILED','EXPIRED','REFUND')`

Tabel yang dibersihkan: `riwayat_pesanan`, `otp_orders`, `deposits`, `deposit_invoices`.

Tabel yang **tidak** disentuh (data uang/pendapatan yang masih dipakai fitur lain):
`child_panel_orders`, `child_panel_income_adjustments`, `child_panel_withdrawals`,
`smm_order_profit`, `admin_balance_log`, `user_daily_streaks`, `daily_streak_receipts`, `users`.
Saldo user tidak pernah berubah — yang dihapus hanya baris riwayat.

## Cara kerja

```
admin membuka Data Pesanan / Data Deposit / My Profit
        → admin_data.php → dr_maybe_run($conn)
              → periode (WIB) belum ada di data_retention_log? → dr_run()
                    → INSERT IGNORE log (kind, period_key)   ← klaim periode dulu
                    → DELETE ... WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR|1 MONTH) LIMIT 2000 (berulang)
                    → UPDATE log: jumlah baris terhapus per tabel
```

- `data_retention_log` punya `UNIQUE KEY uniq_period (kind, period_key)` → dua tab admin yang
  terbuka bersamaan tidak menghapus dua kali.
- Penghapusan dilakukan bertahap (`LIMIT 2000` per putaran, maksimal 500 putaran) agar tidak
  mengunci tabel lama di hosting bersama.
- Tabel/kolom yang tidak ada di database dilewati (dicek lewat `information_schema`), dan seluruh
  pemicu otomatis dibungkus `try/catch` → halaman admin tetap terbuka walau gagal.
- `data_retention_log` dibuat otomatis (lazy DDL, gaya `riwayat_schema.php`). File
  `php-api/data_retention.sql` disediakan bila ingin dibuat langsung di MySQL, lengkap dengan
  indeks `created_at` pendukung.

## Endpoint

`php-api/data_retention.php` — POST JSON, **hanya role admin** (`cp_require_admin`):

- `{token, action:'status'}` → jadwal (periode berjalan, sudah dibersihkan atau belum, perkiraan
  jalan berikutnya), pembersihan terakhir, jumlah baris yang akan dihapus per tabel, dan riwayat
  12 pembersihan terakhir. Membuka status sekaligus menjalankan jadwal yang jatuh tempo.
- `{token, action:'run', kind:'yearly'|'monthly'}` → jalankan sekarang (dicatat sebagai baris
  manual, tidak memakai slot periode, sehingga boleh diulang).

## Halaman admin

`Admin Panel → Pengaturan Database` (`/admin/database`, `src/pages/admin/AdminDatabasePage.tsx`):
dua kartu jadwal (tahunan & bulanan) berisi status periode, pembersihan terakhir, daftar tabel +
jumlah baris yang akan dihapus, tombol **Jalankan pembersihan sekarang** (dengan konfirmasi),
tabel riwayat pembersihan, dan penjelasan cara kerja.

## File yang perlu diupload ke `/api`

- `data_retention_lib.php` (baru)
- `data_retention.php` (baru)
- `admin_data.php` (diperbarui — memicu `dr_maybe_run`)
- opsional: jalankan `data_retention.sql` (tabel log + indeks `created_at`)

Frontend: `npm run build` lalu upload `dist/` seperti biasa.
