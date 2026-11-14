# NexSpace — bagian VPS (185.205.222.202, SSH root -p 10892)

Website memanggil VPS lewat tunnel yang sudah ada: `wa-origin.boosteryuk.com` → `server.js` (pm2 `paimon-agent`,
port 8787, header `x-agent-token` = AGENT_TOKEN yang sama dengan `php-api/agent_config.php`).

## File
| File di repo | Taruh di VPS |
|---|---|
| `vps-nexspace/nexspace.js` | `/root/botwawa/lib/nexspace.js` (baru) |
| `vps-nexspace/server.js` | `/root/botwawa/server.js` (ganti; isinya = server.js lama + 3 baris NexSpace) |
| `vps-nexspace/setup-nexspace.sh` | jalankan sekali: `bash setup-nexspace.sh` |

## Langkah
```bash
ssh root@185.205.222.202 -p 10892
cd /root/botwawa
cp server.js server.js.bak                 # cadangan
# upload nexspace.js ke lib/, server.js ke folder ini, setup-nexspace.sh ke mana saja
bash setup-nexspace.sh                      # grup nexspace, aturan SSH, akuntansi systemd
pm2 restart paimon-agent                    # server.js HARUS berjalan sebagai root
curl -s https://wa-origin.boosteryuk.com/health
```

## Yang dilakukan saat order NexSpace Started
1. PHP memotong saldo secara atomik, lalu `POST /nexspace/create` lewat tunnel.
2. `useradd -m -G nexspace <username>`, password via `chpasswd` (tidak disimpan di mana pun), home `chmod 700`.
3. Masa aktif `chage -E <tanggal>` + batas `systemctl set-property user-<uid>.slice MemoryMax CPUQuota TasksMax`.
4. Gagal di langkah mana pun → akun dihapus lagi (rollback) dan website mengembalikan saldo.
5. Tiap 10 menit: akun yang lewat masa aktif dikunci (`usermod -L`) dan prosesnya dihentikan.
6. User login: `ssh <username>@185.205.222.202 -p 10892`.

## Keamanan (penting)
- Grup `nexspace` di sshd: **tanpa** port-forwarding, tunnel, agent forwarding, X11 → tidak bisa dipakai sebagai VPN/proxy.
- User biasa tidak bisa membuat VPN (butuh TUN/root) dan tidak bisa menjalankan Pterodactyl (butuh Docker/root);
  **jangan pernah** memasukkan user NexSpace ke grup `docker`/`sudo`.
- `/root` (bot, token, `.cloudflared`) `chmod 700` → tidak bisa dibaca user NexSpace.
- NexSpace **Pro (root)** TIDAK dibuat di server ini: admin menyiapkannya terpisah (mis. container/VPS lain) lalu
  mengisi data login di Admin → NexSpace Pro Request. Memberi root di server bersama = menyerahkan seluruh server.
- Kuota disk hanya aktif bila paket `quota` terpasang dan filesystem memakai `usrquota`.
