# BGSC — QA Setup Guide

How to run the whole platform (backend, web admin, mobile app) on your own machine, exactly what
to put in each `.env`, and what to change for each way of running it.

```
phone (Expo Go) ──┐
                  ├──> public tunnel (https) ──> gateway :3000 ──> 12 services + MongoDB + Redis (Docker)
web admin :5173 ──┘                                   ▲
                                         Google sign-in calls back here
```

Only the gateway (port 3000) is ever reached from outside. Everything else lives in Docker.

---

## 1. Install once

| Tool | Version | Check |
|---|---|---|
| Docker + Docker Compose | any recent | `docker compose version` |
| Node.js | 22 or newer | `node -v` |
| cloudflared | any | `cloudflared --version` |
| Expo Go (on the test phone) | **must match the project's SDK: SDK 58** | Expo Go → Settings shows the SDK |

Install cloudflared: Arch `sudo pacman -S cloudflared` · macOS `brew install cloudflared` ·
Windows `winget install Cloudflare.cloudflared` · others: developers.cloudflare.com → cloudflared → Downloads.

> **Expo Go must support SDK 58.** The Play Store / App Store version is always the newest SDK. If it
> is newer than 58 the app fails with *"Failed to download remote update"*. On Android, install the
> SDK 58 build from **expo.dev/go**. On iPhone there is no way to pick an older version.

---

## 2. Get the code and the secrets

```bash
git clone <repo-url> && cd <repo>
git checkout <branch you were given>
```

The secrets are **not in git**. Ask the dev team for their `Backend/.env` over a private channel
(never in a group chat, ticket or email thread). It contains the Google OAuth client and the Gmail
SMTP login. If you cannot get it, see "Running without the shared secrets" in section 3.

Create the three env files:

```bash
cp Backend/.env.example Backend/.env      # then paste in the values you were given (section 3)
cp web/.env.example web/.env
cp mobile/.env.example mobile/.env
```

---

## 3. What goes in each `.env`

### `Backend/.env`

You only touch the lines below. Leave everything else as it is in `.env.example`.

| Key | Value | Why |
|---|---|---|
| `NODE_ENV` | `development` | Never `production` locally: production refuses to start on dev passwords. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_API_TOKEN` | any long random string each (`openssl rand -hex 48`) | Sign the logins. Changing them later logs everyone out, nothing else. |
| `STRAVA_TOKEN_ENCRYPTION_KEY` | `openssl rand -hex 32` (64 hex chars) or blank | Blank is fine in development. |
| `FRONTEND_URL` | `https://localhost:5173` | The web admin. **https**: the dev server uses a self-signed certificate. |
| `API_BASE_URL` | your tunnel URL, e.g. `https://abc-def.trycloudflare.com` | Set by the script in section 6. |
| `GOOGLE_CALLBACK_URL` | `<tunnel URL>/auth/google/callback` | Set by the script in section 6. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | from the dev team | Blank = "Continue with Google" says *not set up on the server*. |
| `SMTP_HOST` | `smtp.gmail.com` | Blank = no email is sent; codes appear in the log instead (section 9). |
| `SMTP_PORT` | `587` | |
| `SMTP_USER` | the sending Gmail address | |
| `SMTP_PASS` | its 16-character Gmail **app password**, no spaces | Not the normal Gmail password. |
| `MAIL_FROM` | `"BGSC <same gmail address>"` | Gmail rewrites any other sender to `SMTP_USER`. |
| `CORS_ORIGIN` | `https://localhost:5173,http://localhost:8081` | The web admin's origin must be listed exactly (https, port). |
| `FOUNDER_EMAIL` | your email | Used once to make your account founder (section 8). |
| `MONGO_ROOT_PASSWORD`, `MONGO_URI`, `REDIS_PASSWORD` | leave the `.env.example` values | Changing the Mongo password after the first start needs `docker compose down -v` (wipes the DB). |
| Strava / WhatsApp keys | leave blank | Not configured for this round: those features answer "not configured" by design. |

**Running without the shared secrets:** leave the Google and SMTP keys blank. Everything works
except Google sign-in, and verification/reset codes are read from the log (section 9).

### `web/.env`

```
VITE_API_URL=<tunnel URL>          # set by the script in section 6
VITE_USE_MOCK=false                # true = fake data, no backend, Google button hidden
```

### `mobile/.env`

```
EXPO_PUBLIC_API_URL=<tunnel URL>   # set by the script in section 6
EXPO_PUBLIC_PRIVACY_URL=           # optional
EXPO_PUBLIC_TERMS_URL=             # optional
```

> **Why a tunnel and not `localhost`?** A phone cannot reach your laptop's `localhost`, and Google
> only accepts `localhost` or a real public domain as a sign-in callback, never a LAN IP like
> `192.168.x.x`. One public https URL for the gateway fixes both, and works on any network.

---

## 4. Start the backend

```bash
cd Backend
docker compose up -d --build        # first time: a few minutes
docker compose ps                   # every service should say (healthy)
curl localhost:3000/health          # {"status":"ok","service":"gateway",...}
```

Stop: `docker compose down` (keeps data) · wipe all data: `docker compose down -v`.

---

## 5. Start the backend tunnel

In a **separate terminal that stays open the whole session**:

```bash
cloudflared tunnel --no-autoupdate --url http://localhost:3000
```

It prints `https://<random-words>.trycloudflare.com`. That is your **tunnel URL**. Check it:
`curl https://<tunnel URL>/health` must return `{"status":"ok",...}`.

> The URL is new every time cloudflared starts. Whenever it changes, repeat sections 6 and 7.

---

## 6. Point everything at the tunnel (one command)

```bash
cd Backend
bash scripts/set-public-url.sh https://<tunnel URL>
```

This writes the URL into `Backend/.env` (`API_BASE_URL`, `GOOGLE_CALLBACK_URL`, `STRAVA_CALLBACK_URL`),
`web/.env` (`VITE_API_URL`) and `mobile/.env` (`EXPO_PUBLIC_API_URL`), and restarts the containers
that read it.

---

## 7. Register the callback with Google

Needs access to the Google Cloud project. If you do not have it, send the line below to the dev
team and wait for "done".

1. console.cloud.google.com → **APIs & Services → Credentials** → the **Web application** OAuth client.
2. **Authorized redirect URIs** → **Add URI** → `https://<tunnel URL>/auth/google/callback`
   (exactly: https, no trailing slash). Not the "JavaScript origins" box.
3. **Save** at the bottom. It takes 5 minutes to a few hours to apply.
4. **OAuth consent screen → Test users**: every Google account QA will sign in with must be listed,
   or Google blocks it with *"access blocked"*.

---

## 8. Start the web admin

```bash
cd web
npm ci
npm run dev
```

Open **https://localhost:5173**. The browser warns about the certificate: Advanced → Proceed. The
"Not Secure" label afterwards is expected.

The web admin only lets in `core`, `coordinator` and `founder`. A new account sees *"Access
Restricted"*. Make your first account founder **once** (it must exist and be verified, e.g. signed in
with Google or verified by code):

```bash
cd Backend
docker compose exec -e FOUNDER_EMAIL=you@example.com user-service node apps/user-service/dist/scripts/seed-founder.js
```

Log out and back in. As founder, promote other test accounts from **Users** in the web admin
(user → member → core). `coordinator` cannot be assigned from the app yet; ask the dev team if you
need one.

---

## 9. Start the mobile app

```bash
cd mobile
npm ci
npx expo start -c
```

Scan the QR code with Expo Go (Android) or the Camera app (iPhone).

**If the phone is not on the same network as the laptop** (or the QR loads forever), give Expo its
own tunnel. In another terminal that stays open:

```bash
cloudflared tunnel --no-autoupdate --url http://localhost:8081
```

then start Expo with that second URL (not the backend one):

```bash
EXPO_PACKAGER_PROXY_URL=https://<8081 tunnel URL> npx expo start -c
# fish shell:  env EXPO_PACKAGER_PROXY_URL=https://<8081 tunnel URL> npx expo start -c
```

After any `.env` change: stop Expo and start it again with `-c` (it bakes the env in at start).

---

## 10. Reading codes and logs

| Want | Command (in `Backend/`) |
|---|---|
| Auth logs (sign-ups, mail sent, Google outcome) | `docker compose logs -f auth-service` |
| Verification / reset code when SMTP is blank | same log: a `[DEV EMAIL]` block with `Code: 123456` |
| Phone OTP code (SMS is not wired, always in the log) | same log: `[DEV SMS/WhatsApp OTP]` |
| Everything | `docker compose logs -f` |

Email codes are 6 digits, valid **10 minutes**, **5 wrong tries** per code; after that, request a new
code (a resend inside the 10 minutes does not reset the tries). To test with many fresh accounts on
one Gmail, use `name+anything@gmail.com`: it all lands in the same inbox.

---

## 11. What to change for each situation

| Situation | Change |
|---|---|
| cloudflared restarted / new tunnel URL | Section 6 script with the new URL → section 7 (Google) → restart web and Expo |
| Testing **without** a phone (web only) | Still use the tunnel for Google sign-in. Without Google: `VITE_API_URL=http://localhost:3000`, no tunnel needed |
| Phone on the same Wi-Fi/hotspot as laptop | Plain `npx expo start -c`; only the backend tunnel needed |
| Phone on a different network | Add the 8081 tunnel (section 9) |
| No Google / SMTP secrets | Leave those keys blank; codes come from the log; Google button says not configured |
| Laptop changed network (Wi-Fi ↔ hotspot) or VPN on/off | `cd Backend && docker compose restart`, restart cloudflared, then section 6 + 7 |
| Want a clean database | `cd Backend && docker compose down -v && docker compose up -d`, then redo the founder step |
| Pulled new code | `cd Backend && docker compose up -d --build`; `npm ci` in `web/` and `mobile/` if their `package-lock.json` changed |

---

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Google: **`redirect_uri_mismatch`** | Tunnel URL not in Google's redirect URIs (or not applied yet) | Section 7; click "error details" on Google's page to see the exact URI it got |
| Google: picked account, then **stuck on a blank page** | Backend tunnel is down: `curl <tunnel>/health` returns **530** | Restart cloudflared → section 6 + 7 |
| Google: **access blocked / app not verified** | Account not in Test users | Section 7, step 4 |
| URL shows `?error=google_unreachable` | Docker lost DNS after a network change | `cd Backend && docker compose restart auth-service` |
| `?error=invalid_oauth_state` / "Sign-in expired" | Took over 10 minutes, or started on a different URL than the callback | Try again; make sure `VITE_API_URL` / `EXPO_PUBLIC_API_URL` equal the tunnel URL |
| Web: page says `{"error":"not_found"}` | Opened `http://` instead of `https://localhost:5173` | Use https |
| Web: every request fails, console shows CORS | `CORS_ORIGIN` lacks the exact web origin | Add `https://localhost:5173`, then `docker compose up -d` |
| No verification email | SMTP blank/wrong, or in spam | `docker compose logs auth-service` shows either the code or the send error; check spam |
| `too_many_requests` | Rate limit: 5 attempts per account per 15 min (all tunnel traffic looks like one IP) | Wait 15 minutes or use another `+alias` email |
| Expo Go: *Failed to download remote update* | Expo Go SDK ≠ 58, or phone can't reach Expo | Section 1 note; or the 8081 tunnel (section 9) |
| App still calls the old URL | Expo cached the old env | Stop Expo, `npx expo start -c` |
| A service is not `(healthy)` | Look at its log | `docker compose logs <service>`; `docker compose up -d --build` |

---

## 13. Expected "not working" (not bugs)

- Strava connect/sync: *not configured* (no Strava app registered yet).
- WhatsApp announcement broadcast and push notifications: off for this release.
- Phone OTP: the code is only in the log; no real SMS is sent.
- Web admin has no "forgot password" link; password reset is on mobile.
- Google sign-in on mobile is on the Login screen only.
- Free tunnel URLs change on every restart and are slower than local; for timing tests use a laptop on the same network.
