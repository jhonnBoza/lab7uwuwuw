#!/usr/bin/env bash
# Crea /etc/systemd/system/lab7.service. Uso en EC2 (evita pegar heredoc en el navegador):
#   curl -fsSL https://raw.githubusercontent.com/jhonnBoza/lab7uwuwuw/main/scripts/install-systemd-lab7.sh | sudo bash
# Si el codigo esta en /opt/lab7 (clone con "."):
#   APP_ROOT=/opt/lab7 sudo -E bash scripts/install-systemd-lab7.sh
# Por defecto: repo clonado en subcarpeta lab7uwuwuw

set -euo pipefail
APP_ROOT="${APP_ROOT:-/opt/lab7/lab7uwuwuw}"

sudo tee /etc/systemd/system/lab7.service >/dev/null <<EOF
[Unit]
Description=Lab7 app
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_ROOT}
EnvironmentFile=/etc/sysconfig/lab7
ExecStart=/usr/bin/node ${APP_ROOT}/server.js
Restart=always
RestartSec=3
User=ec2-user

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now lab7
echo "Listo. Prueba: curl -s http://127.0.0.1:8080/health"
