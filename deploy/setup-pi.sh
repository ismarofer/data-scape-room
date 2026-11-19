#!/usr/bin/env bash
# En la Raspberry: git clone <repo> && cd <repo> && scp/crear .env && bash deploy/setup-pi.sh
# Instala Node 22, dependencias, compila el frontend y crea el servicio systemd.
set -euo pipefail
cd "$(dirname "$0")/.."
APP_DIR="$(pwd)"

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  echo ">> Instalando Node.js 22"
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

[ -f .env ] || { echo "Falta .env (cópialo con scp antes de seguir)"; exit 1; }

echo ">> npm ci"
npm ci
echo ">> Compilando frontend"
npm run build -w @codigo-alta/web

echo ">> Creando servicio systemd"
sudo tee /etc/systemd/system/codigo-alta.service >/dev/null <<UNIT
[Unit]
Description=Codigo Alta (escape room de datos)
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=$(command -v npm) run start -w @codigo-alta/server
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now codigo-alta
echo ">> Listo: http://$(hostname -I | awk '{print $1}'):3000"
echo "   Logs: journalctl -u codigo-alta -f"
