# VPS Manual Deploy Guide

Complete manual deployment of the BGSC Platform on a fresh Azure Ubuntu 22.04 VM — from provisioning to a live, TLS-secured, auto-starting stack.

**What gets deployed:**
- PostgreSQL + Redis (internal only, never exposed to internet)
- API Gateway on port 3000 (proxied via nginx)
- auth-service, user-service, sponsor-service, event-service, points-service, notification-service, announcement-service (all internal)
- nginx as the public reverse proxy with Let's Encrypt TLS

---

## Prerequisites

Have these ready before starting:

- Google OAuth credentials (client ID + secret) from Google Cloud Console
- Strava OAuth credentials from Strava API settings
- SMTP credentials (Gmail, Mailgun, etc.)
- A domain name you control (e.g. `bgsc-platform.in`) with access to its DNS settings

---

## 1. Provision the Azure VM

In the Azure Portal:

1. Go to **Virtual Machines → Create → Azure Virtual Machine**
2. Set:
   - Image: `Ubuntu Server 22.04 LTS`
   - Size: `Standard_B2s` or better (2 vCPU, 4GB RAM minimum)
   - Authentication type: **SSH public key**
   - Username: `azureuser` (Azure's default — use this, not root)
   - SSH public key source: **Use existing public key**
   - Paste the contents of your local `~/.ssh/id_ed25519.pub` (or `~/.ssh/id_rsa.pub`)
3. Under **Inbound port rules**, allow: `SSH (22)`, `HTTP (80)`, `HTTPS (443)`
4. Review + Create → Create

Once deployed, go to the VM's **Overview** page and note the **Public IP address**. You'll need this for DNS and SSH.

---

## 2. Point Your Domain at the VM

Before doing anything else, set up DNS so that by the time you need TLS (Step 11), it's already propagated.

Log into your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.) and add these DNS records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| `A` | `@` | `<VM_PUBLIC_IP>` | 3600 |
| `A` | `www` | `<VM_PUBLIC_IP>` | 3600 |
| `A` | `api` | `<VM_PUBLIC_IP>` | 3600 |

Replace `<VM_PUBLIC_IP>` with the actual IP from the Azure portal.

- `@` covers the root domain (`yourdomain.com`)
- `www` covers `www.yourdomain.com`
- `api` covers `api.yourdomain.com` — this is what the backend will be served on

DNS propagation takes anywhere from a few minutes to 48 hours depending on your registrar and TTL. You can check progress at any time with:

```sh
dig +short api.yourdomain.com
```

It should return your VM's public IP when ready. Continue with the rest of the guide while DNS propagates — just don't run Step 11 until it resolves correctly.

---

## 3. First SSH Login

Azure VMs don't have a root user in the traditional sense. You log in as `azureuser` directly with your SSH key:

```sh
ssh azureuser@<VM_PUBLIC_IP>
```

No password needed — Azure already placed your public key on the VM during provisioning.

---

## 4. Create a Deploy User

Don't run the app as `azureuser`. Create a dedicated user:

```sh
sudo adduser deploy
```

You'll be prompted for a password and optional info. Set a password, skip the rest with Enter.

Add to sudo group:

```sh
sudo usermod -aG sudo deploy
```

Copy your SSH key to the deploy user so you can log in as them directly:

```sh
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

Open a **new terminal on your local machine** and verify login works before continuing:

```sh
ssh deploy@<VM_PUBLIC_IP>
```

If that succeeds, use this session from now on. All remaining steps run as `deploy`.

---

## 5. Install System Dependencies

```sh
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw nginx certbot python3-certbot-nginx
```

Install Docker using the official script:

```sh
curl -fsSL https://get.docker.com | sh
```

Add `deploy` to the docker group so it can run docker without sudo:

```sh
sudo usermod -aG docker deploy
```

Log out and back in for the group change to take effect:

```sh
exit
ssh deploy@<VM_PUBLIC_IP>
```

Verify Docker works:

```sh
docker run --rm hello-world
```

Expected: `Hello from Docker!`

---

## 6. Configure the Firewall

Azure has its own Network Security Group (NSG) that already allows ports 22, 80, 443 from Step 1. Also enable UFW on the OS level as a second layer:

```sh
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Confirm:

```sh
sudo ufw status verbose
```

Only ports 22, 80, and 443 should be open. Port 3000 and all microservice ports must stay closed — only nginx and Docker's internal network should ever touch them.

---

## 7. Harden SSH

```sh
sudo nano /etc/ssh/sshd_config
```

Find and set (add lines if they don't exist):

```
PasswordAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
```

Restart SSH:

```sh
sudo systemctl restart sshd
```

Keep your current session open. Open a new terminal and verify you can still log in before closing the old one.

---

## 8. Generate a Deploy Key for GitHub

The VM needs to pull from the GitHub repo. Generate a dedicated SSH key for this — separate from your personal key:

```sh
ssh-keygen -t ed25519 -C "deploy@bgsc-vps" -f ~/.ssh/github_deploy -N ""
```

Print the public key:

```sh
cat ~/.ssh/github_deploy.pub
```

Copy the entire output. Then add it to GitHub:

1. Go to `https://github.com/promad130/BGSC-platform`
2. **Settings → Deploy keys → Add deploy key**
3. Title: `Azure VPS`
4. Key: paste the public key
5. Allow write access: **No** (read-only is enough for deployment)
6. Click **Add key**

Configure SSH on the VM to use this key for GitHub:

```sh
nano ~/.ssh/config
```

Paste:

```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_deploy
  IdentitiesOnly yes
```

Set correct permissions:

```sh
chmod 600 ~/.ssh/config
```

Test the connection:

```sh
ssh -T git@github.com
```

Expected: `Hi promad130! You've successfully authenticated, but GitHub does not provide shell access.`

---

## 9. Clone the Repository

```sh
mkdir -p /home/deploy/apps
cd /home/deploy/apps
git clone git@github.com:promad130/BGSC-platform.git bgsc
cd bgsc
git checkout main
git log --oneline -3
```

The last command should show the three most recent commits. Confirm the top one looks right.

---

## 10. Configure Environment Variables

```sh
cp .env.example .env
nano .env
```

Work through every variable. Generate secrets directly on the VM:

```sh
# Run each line separately and paste the output into the corresponding variable in .env
openssl rand -hex 32   # POSTGRES_PASSWORD
openssl rand -hex 32   # REDIS_PASSWORD
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET  — must be different from JWT_ACCESS_SECRET
openssl rand -hex 32   # INTERNAL_SERVICE_KEY
openssl rand -base64 32  # STRAVA_WEBHOOK_VERIFY_TOKEN
openssl rand -hex 32   # STRAVA_TOKEN_ENCRYPTION_KEY  — needs 64 hex chars; run twice and concatenate if needed
openssl rand -hex 32   # AUTH_TOTP_ENCRYPTION_KEY  — same as above
```

Set all remaining variables:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `POSTGRES_USER` | `bgsc` |
| `POSTGRES_DB` | `bgsc_dev` |
| `JWT_ISSUER` | `bgsc-auth-service` |
| `GOOGLE_CLIENT_ID` | from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | `https://api.yourdomain.com/auth/google/callback` |
| `OAUTH_FRONTEND_CALLBACK_URL` | `https://yourdomain.com` |
| `STRAVA_CLIENT_ID` | from Strava API settings |
| `STRAVA_CLIENT_SECRET` | from Strava API settings |
| `STRAVA_CALLBACK_URL` | `https://api.yourdomain.com/auth/strava/callback` |
| `SMTP_HOST` | your SMTP provider's host |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | your SMTP username |
| `SMTP_PASSWORD` | your SMTP password |
| `SMTP_FROM` | `noreply@yourdomain.com` |
| `CORS_ORIGINS` | `https://yourdomain.com,https://www.yourdomain.com` |
| `BCRYPT_SALT_ROUNDS` | `12` |

Rate limit defaults from `.env.example` are fine for production as-is.

Lock the file so only `deploy` can read it:

```sh
chmod 600 .env
```

---

## 11. Build and Start All Services

Use the **base compose file only** — do not use `docker compose up` without `-f`, as that merges the override file which exposes internal service ports to the host. Production must only expose port 3000:

```sh
docker compose -f docker-compose.yml up -d --build
```

The first build pulls base images and compiles all TypeScript services. Expect 5–15 minutes. Watch it:

```sh
docker compose -f docker-compose.yml logs -f
```

Once it settles, check all containers:

```sh
docker compose -f docker-compose.yml ps
```

All services should show `running` or `healthy`. If any show `exited`:

```sh
docker compose -f docker-compose.yml logs <service-name>
```

Smoke test the gateway from the VM itself:

```sh
curl http://localhost:3000/health
```

Should return 200. If it returns 502, a downstream service isn't ready yet — wait 30 seconds and retry.

---

## 12. Configure Nginx as Reverse Proxy

```sh
sudo nano /etc/nginx/sites-available/bgsc-api
```

Paste the following, replacing `api.yourdomain.com` with your actual subdomain:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    proxy_read_timeout 120s;
    proxy_connect_timeout 10s;
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable it and remove the default placeholder site:

```sh
sudo ln -s /etc/nginx/sites-available/bgsc-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
```

Test for syntax errors:

```sh
sudo nginx -t
```

If it says `syntax is ok` and `test is successful`:

```sh
sudo systemctl reload nginx
```

Test nginx is proxying to the gateway:

```sh
curl http://api.yourdomain.com/health
```

---

## 13. TLS with Let's Encrypt

Run this only after `dig +short api.yourdomain.com` returns your VM's public IP. Certbot does an HTTP challenge — if DNS isn't pointing here yet it will fail.

```sh
sudo certbot --nginx -d api.yourdomain.com
```

Certbot will:
1. Verify you own the domain by hitting `http://api.yourdomain.com/.well-known/acme-challenge/...`
2. Issue a certificate from Let's Encrypt
3. Automatically rewrite your nginx config to listen on 443 with the cert
4. Ask whether to redirect HTTP → HTTPS — choose **yes (option 2)**

Provide a real email address when prompted — Let's Encrypt will email you if auto-renewal ever fails.

Verify HTTPS works:

```sh
curl https://api.yourdomain.com/health
```

Test that auto-renewal will work (dry run, no changes made):

```sh
sudo certbot renew --dry-run
```

Certbot installs a systemd timer for automatic renewal. Verify it's active:

```sh
sudo systemctl status certbot.timer
```

---

## 14. Systemd Service for Auto-start on Reboot

Without this, the containers won't come back up if the VM reboots.

```sh
sudo nano /etc/systemd/system/bgsc.service
```

Paste:

```ini
[Unit]
Description=BGSC Platform (Docker Compose)
Documentation=https://github.com/promad130/BGSC-platform
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/deploy/apps/bgsc
ExecStart=/usr/bin/docker compose -f docker-compose.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.yml down
TimeoutStartSec=300
TimeoutStopSec=120
Restart=on-failure
User=deploy
Group=deploy

[Install]
WantedBy=multi-user.target
```

Enable and start it:

```sh
sudo systemctl daemon-reload
sudo systemctl enable bgsc
sudo systemctl start bgsc
```

Check it:

```sh
sudo systemctl status bgsc
```

Test by rebooting (optional but recommended):

```sh
sudo reboot
```

After reconnecting, verify everything came back up:

```sh
docker compose -f /home/deploy/apps/bgsc/docker-compose.yml ps
curl https://api.yourdomain.com/health
```

---

## 15. Updating the App

Whenever you push new code to `main` and want to deploy it:

```sh
cd /home/deploy/apps/bgsc
git pull origin main
docker compose -f docker-compose.yml up -d --build
```

The `--build` flag only rebuilds services whose source changed. Check nothing exited after:

```sh
docker compose -f docker-compose.yml ps
```

---

## Troubleshooting

**A service shows `exited` or keeps restarting:**
```sh
docker compose -f docker-compose.yml logs --tail=50 <service-name>
```

**Gateway returns 502:**
The gateway is up but a downstream service isn't. Check which:
```sh
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml logs auth-service
```

**Certbot fails with "Could not resolve host":**
DNS hasn't propagated yet. Check: `dig +short api.yourdomain.com` — wait until it returns your VM IP, then retry.

**Can't SSH into the VM:**
Check Azure NSG rules in the portal — port 22 must be allowed in the inbound rules for your VM's Network Security Group.

**Port 3000 accessible from outside (it should NOT be):**
```sh
sudo ufw status
```
Port 3000 must not appear. Also check the Azure NSG — remove any inbound rule for port 3000.

---

## Quick Reference

| Task | Command |
|------|---------|
| Start stack | `docker compose -f docker-compose.yml up -d` |
| Stop stack | `docker compose -f docker-compose.yml down` |
| Rebuild + restart | `docker compose -f docker-compose.yml up -d --build` |
| View all logs | `docker compose -f docker-compose.yml logs -f` |
| View one service logs | `docker compose -f docker-compose.yml logs -f <service>` |
| Check container status | `docker compose -f docker-compose.yml ps` |
| Restart one service | `docker compose -f docker-compose.yml restart <service>` |
| Pull latest code | `git pull origin main` |
| Full redeploy | `git pull origin main && docker compose -f docker-compose.yml up -d --build` |
| Postgres shell | `docker exec -it bgsc-postgres psql -U bgsc -d bgsc_dev` |
| Redis shell | `docker exec -it bgsc-redis redis-cli -a $REDIS_PASSWORD` |
| Check nginx config | `sudo nginx -t` |
| Reload nginx | `sudo systemctl reload nginx` |
| Check systemd service | `sudo systemctl status bgsc` |
| View nginx error log | `sudo tail -f /var/log/nginx/error.log` |
| Check DNS propagation | `dig +short api.yourdomain.com` |
| Check open ports | `sudo ufw status verbose` |
