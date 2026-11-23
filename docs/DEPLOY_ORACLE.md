# Deploying FloodGuard on Oracle Cloud Always Free

One small VM runs two containers with Docker Compose: the FloodGuard app (FastAPI serving the built React frontend) and Caddy, which provides one HTTPS URL with an automatic Let's Encrypt certificate. API keys live only in a `.env` file on the server.

The Render deployment keeps running unchanged. Switch links over only after the checks at the end of this guide pass on Oracle.

## What you need

- An Oracle Cloud account on the Always Free tier (card verification is needed at sign-up; Always Free resources are not charged).
- An SSH key pair on your computer (`ssh-keygen -t ed25519` if you do not have one).
- This repository pushed to GitHub (the server clones it).
- Optional: an API key for one LLM provider (Sarvam, Cloudflare Workers AI or Hugging Face). Without one the app runs in template mode, which is fully playable.

## Task: create the VM

1. In the Oracle console open **Compute → Instances → Create instance**.
2. Image: **Canonical Ubuntu 22.04 or 24.04**.
3. Shape: **Ampere (VM.Standard.A1.Flex)**, for example 2 OCPU and 12 GB memory. This is within the Always Free allowance. If A1 capacity is unavailable in your region, **VM.Standard.E2.1.Micro** (AMD, 1 GB) also works; the setup script adds swap for the build.
4. Networking: keep the default VCN and public subnet, and make sure **Assign a public IPv4 address** is on.
5. SSH keys: paste your public key (`~/.ssh/id_ed25519.pub`).
6. Create, then copy the instance's **public IP address**.

## Task: open ports 80 and 443

Oracle blocks traffic in two places, and both must allow it.

**Cloud firewall (security list).** Instance page → subnet link → **Security Lists → Default Security List → Add Ingress Rules**:

| Source CIDR | IP protocol | Destination port |
|---|---|---|
| 0.0.0.0/0 | TCP | 80 |
| 0.0.0.0/0 | TCP | 443 |
| 0.0.0.0/0 | UDP | 443 (optional, HTTP/3) |

**VM firewall (iptables).** The setup script in the next task adds these rules and saves them.

## Task: install Docker and get the code

```bash
ssh ubuntu@<PUBLIC_IP>
git clone https://github.com/<your-user>/<your-repo>.git floodguard
cd floodguard
bash deploy/oracle-setup.sh
exit        # log out and back in so the docker group applies
ssh ubuntu@<PUBLIC_IP>
cd floodguard
```

The script installs Docker Engine with the Compose plugin, opens 80/443 in iptables (Oracle's Ubuntu images reject them by default) and, on 1 GB machines, adds a 2 GB swap file.

## Task: configure

```bash
cp .env.example .env
nano .env
```

- `SITE_ADDRESS`: the public name Caddy will get a certificate for. Without a domain, use sslip.io with the IP's dots replaced by dashes, e.g. `floodguard.203-0-113-10.sslip.io`. With your own domain, point an A record at the IP and use that name.
- LLM, pick one:
  - **No AI:** `LLM_MODE=template`.
  - **Sarvam:** `LLM_MODE=openai_compat`, `LLM_PROVIDER=sarvam`, `SARVAM_API_KEY=...`
  - **Cloudflare Workers AI:** `LLM_MODE=openai_compat`, `LLM_PROVIDER=cloudflare`, `CF_ACCOUNT_ID=...`, `CF_API_TOKEN=...`
  - **Hugging Face:** `LLM_MODE=openai_compat`, `LLM_PROVIDER=huggingface`, `HF_TOKEN=...`
  - **Local model on the VM (no key):** see the next task.

Only Apache-2.0 or MIT licensed models are allowed; the presets already point at such models (see `docs/MODEL_CARD.md`). `.env` is git-ignored, so keys never reach the repository.

## Task: start

```bash
docker compose up -d --build
docker compose ps            # app should become "healthy"
docker compose logs -f caddy # watch for "certificate obtained successfully"
```

The first build takes a few minutes on the VM. Then open `https://<SITE_ADDRESS>`.

### Optional: local model instead of a hosted API

An A1 VM with 12 GB or more can run the small default model on CPU:

```bash
# in .env
LLM_MODE=openai_compat
LLM_PROVIDER=ollama
LLM_BASE_URL=http://ollama:11434/v1

docker compose --profile local-llm up -d --build
docker compose exec ollama ollama pull qwen2.5:1.5b
docker compose restart app
```

Replies are slower than on a hosted API. If the model is slow or down, the app falls back to template text automatically.

## Task: verify before switching links

Run these against the Oracle URL; all must pass before Render is retired or links are changed.

```bash
curl -s https://<SITE_ADDRESS>/api/v1/health      # {"status":"ok", ...}
curl -s https://<SITE_ADDRESS>/api/v1/meta | head -c 400
curl -s https://<SITE_ADDRESS>/api/v1/scenarios | head -c 200
```

In a browser, on a phone and on a laptop:

- The disclaimer gate appears, and the emergency footer (112 / 1078) is visible on every screen.
- All four stories start; both pages (Act and Village) are reachable by swipe, tabs and arrow keys; the page itself never scrolls.
- "What should I do?" returns options; the AI badge reads "AI on" with a key set, and "AI off" in template mode.
- Play to the end, open the report and use "Retry with the same seed".

## Task: update and maintain

```bash
cd ~/floodguard
git pull
docker compose up -d --build     # rebuilds the app; Caddy keeps its certificate
docker image prune -f            # optional: free disk space
```

- Logs: `docker compose logs -f app`
- Restart after changing `.env`: `docker compose up -d` (Compose re-reads the file)
- Sessions are stored in SQLite on the `app_data` volume and survive rebuilds.
- Containers restart automatically after a VM reboot (`restart: unless-stopped`).

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Browser times out | Port 80/443 missing in the security list, or iptables rules not saved; re-run `bash deploy/oracle-setup.sh`. |
| Caddy log shows certificate errors | `SITE_ADDRESS` does not resolve to this VM's IP, or port 80 is closed (Let's Encrypt validates over HTTP). |
| `SITE_ADDRESS` error on `docker compose up` | `.env` is missing or `SITE_ADDRESS` is empty. |
| AI badge shows "missing_key" | `LLM_PROVIDER` is set but its key variable is empty. |
| Build killed on a 1 GB VM | Out of memory; check `swapon --show` and re-run the setup script. |
