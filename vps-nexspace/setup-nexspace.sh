#!/usr/bin/env bash
# setup-nexspace.sh — jalankan SEKALI sebagai root di VPS (185.205.222.202) sebelum menjual NexSpace Started.
#   bash setup-nexspace.sh
# Aman dijalankan ulang (idempotent).
set -euo pipefail

echo "== 1. Grup nexspace =="
getent group nexspace >/dev/null || groupadd nexspace

echo "== 2. Lindungi file bot/server dari user NexSpace =="
chmod 700 /root
[ -d /root/.cloudflared ] && chmod 700 /root/.cloudflared || true
chmod 711 /home            # user tidak bisa melihat daftar home user lain
chmod 750 /var/log 2>/dev/null || true

echo "== 3. Aturan SSH untuk grup nexspace (tanpa port-forward / tunnel / X11) =="
CONF=/etc/ssh/sshd_config
if ! grep -q "# >>> NEXSPACE" "$CONF"; then
  cp "$CONF" "$CONF.bak.$(date +%s)"
  cat >> "$CONF" <<'SSHD'

# >>> NEXSPACE (dikelola setup-nexspace.sh) — HARUS di akhir file
Match Group nexspace
    PasswordAuthentication yes
    AllowTcpForwarding no
    AllowStreamLocalForwarding no
    AllowAgentForwarding no
    X11Forwarding no
    PermitTunnel no
    GatewayPorts no
    PermitUserRC no
# <<< NEXSPACE
SSHD
fi
grep -q "^UsePAM yes" "$CONF" || echo "PERINGATAN: pastikan 'UsePAM yes' agar masa aktif (chage -E) & batas RAM berlaku."
sshd -t
systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null || service ssh reload

echo "== 4. Akuntansi systemd (batas RAM/CPU per user) =="
mkdir -p /etc/systemd/system.conf.d
cat > /etc/systemd/system.conf.d/nexspace.conf <<'SYS'
[Manager]
DefaultCPUAccounting=yes
DefaultMemoryAccounting=yes
DefaultTasksAccounting=yes
SYS
systemctl daemon-reexec

echo "== 5. (Opsional) kuota disk =="
if command -v setquota >/dev/null; then echo "setquota tersedia — kuota dipasang bila filesystem mengaktifkan usrquota."; else echo "setquota tidak ada (apt install quota) — kuota disk dilewati."; fi

echo "Selesai. Uji: curl -s https://wa-origin.boosteryuk.com/health"
