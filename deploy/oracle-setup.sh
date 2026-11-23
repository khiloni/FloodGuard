#!/usr/bin/env bash
# One-time setup of an Oracle Cloud Always Free Ubuntu VM (Ampere A1 / ARM or AMD micro).
# Installs Docker Engine + Compose plugin and opens ports 80/443 in the VM's own firewall.
# Run as the default "ubuntu" user:  bash deploy/oracle-setup.sh
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl git netfilter-persistent iptables-persistent
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
fi

# Oracle's Ubuntu images ship iptables rules that reject everything except SSH.
# Insert ACCEPT rules for HTTP/HTTPS before the final REJECT, then persist them.
for port in 80 443; do
  if ! sudo iptables -C INPUT -p tcp -m state --state NEW --dport "$port" -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT 6 -p tcp -m state --state NEW --dport "$port" -j ACCEPT
  fi
done
if ! sudo iptables -C INPUT -p udp --dport 443 -j ACCEPT 2>/dev/null; then
  sudo iptables -I INPUT 6 -p udp --dport 443 -j ACCEPT
fi
sudo netfilter-persistent save

# Small swap file helps the frontend build on 1 GB micro instances.
if [ "$(free -m | awk '/Mem:/{print $2}')" -lt 2000 ] && [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "Done. Log out and back in (for the docker group), then:"
echo "  cp .env.example .env && nano .env"
echo "  docker compose up -d --build"
