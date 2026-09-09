> **Legacy.** This describes the old PostgreSQL + NestJS system that was replaced. Kept for
> reference only. For the current backend see `docs/local-dev-guide.md`.

# BGSC Platform — Local Dev Guide

Everything runs on `localhost`. The gateway is the only port frontends talk to.

---

## Prerequisites

- Node.js 20+
- PostgreSQL 15+ running locally
- Redis running locally (`redis-server`)
- `pnpm` or `npm` (the repo uses `npm`)

---

## 1. Backend setup

### 1a. Fill in the .env

`backend/.env` was pre-populated with local defaults. You **must** replace placeholder values before services will start:

| Variable | What to put |
|----------|-------------|
| `DATABASE_URL` | Your local Postgres connection string |
| `JWT_ACCESS_SECRET` | Any strong random string (≥32 chars) |
| `JWT_REFRESH_SECRET` | A **different** strong random string |
| `INTERNAL_SERVICE_KEY` | Any string ≥32 chars |
| `AUTH_TOTP_ENCRYPTION_KEY` | 64 hex chars — run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From Google Cloud Console (OAuth2 credentials) |
| `SMTP_*` | Any SMTP provider (Gmail App Password works for dev) |
| `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` | From strava.com/settings/api |
| `STRAVA_TOKEN_ENCRYPTION_KEY` | Another 64 hex chars (can reuse command above) |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Any string ≥16 chars |

For a quick smoke test of non-OAuth flows you can leave Google and Strava as placeholder strings — the services will start but those specific flows will fail.

### 1b. Create databases

Each service uses its own Postgres database. The simplest local setup is one DB per service:

```sql
CREATE DATABASE bgsc_auth;
CREATE DATABASE bgsc_users;
CREATE DATABASE bgsc_sponsors;
CREATE DATABASE bgsc_events;
CREATE DATABASE bgsc_points;
CREATE DATABASE bgsc_notifications;
CREATE DATABASE bgsc_announcements;
CREATE DATABASE bgsc_social;
CREATE DATABASE bgsc_challenges;
```

Update `DATABASE_URL` in `backend/.env` to match the database for whichever service you're starting. Because all services read from the same `.env`, you need to either:
- Set `DATABASE_URL` to one DB and override per-service via shell env (`DATABASE_URL=... npm run start:auth-service:dev`)
- Or run each service in its own terminal with a prefixed env: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bgsc_auth npm run start:auth-service:dev`

The gateway itself does **not** use a database — set `DATABASE_URL` to anything (or the auth DB) for the gateway terminal.

### 1c. Install dependencies

```bash
cd backend
npm install
```

### 1d. Start services

Open a terminal per service (or use a process manager like `pm2`). Run all from the `backend/` directory:

```bash
# Terminal 1 — Gateway (port 3000)
npm run start:dev            # starts the gateway (nest start --watch)

# Terminal 2 — Auth service (port 3001)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bgsc_auth \
  npm run start:auth-service:dev

# Terminal 3 — User service (port 3002)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bgsc_users \
  npm run start:user-service:dev

# Terminal 4 — Sponsor service (port 3003)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bgsc_sponsors \
  npm run start:sponsor-service:dev

# Terminal 5 — Event service (port 3004)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bgsc_events \
  npm run start:event-service:dev

# Terminal 6 — Points service (port 3005)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bgsc_points \
  npm run start:points-service:dev

# Terminal 7 — Notification service (port 3006)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bgsc_notifications \
  npm run start:notification-service:dev

# Terminal 8 — Announcement service (port 3007)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bgsc_announcements \
  npm run start:announcement-service:dev

# Terminal 9 — Social service (port 3008)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bgsc_social \
  npm run start:social-service:dev

# Terminal 10 — Challenge service (port 3009)  
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bgsc_challenges \
  nest start challenge-service --watch
```

> The `challenge-service` and `social-service` don't have explicit `start:*:dev` scripts in `package.json` yet — use `nest start <name> --watch` directly.

**Verify the gateway is up:**
```bash
curl http://localhost:3000/health
# or just: curl http://localhost:3000/events
```

**Swagger docs** (per service, direct — bypass gateway):
- Auth: http://localhost:3001/auth/docs
- Users: http://localhost:3002/users/docs
- (other services expose `/SERVICE/docs` similarly)

---

## 2. Web admin setup

```bash
cd web
npm install
npm run dev       # Vite dev server → http://localhost:5173
```

`web/.env` is already set to `VITE_API_URL=http://localhost:3000`.  
The web app talks only to the gateway — no direct service calls.

---

## 3. Mobile setup

```bash
cd mobile
npm install
npm run start     # Expo dev server
```

Then press:
- `a` to open Android emulator  
- `i` to open iOS simulator  
- Scan the QR code for a physical device

`mobile/.env` is set to `EXPO_PUBLIC_API_URL=http://localhost:3000`.

**On a physical device or Android emulator:**
- Physical device on the same Wi-Fi: change `EXPO_PUBLIC_API_URL` to `http://<your-machine-LAN-ip>:3000`
- Android emulator (AVD): use `http://10.0.2.2:3000` (localhost alias inside AVD)

---

## 4. Service port map

| Service | Port | Gateway prefix(es) |
|---------|------|--------------------|
| Gateway | 3000 | — |
| auth-service | 3001 | `/auth`, `/account` |
| user-service | 3002 | `/users`, `/strava` |
| sponsor-service | 3003 | `/sponsors` |
| event-service | 3004 | `/events`, `/hall-of-fame` |
| points-service | 3005 | `/points` |
| notification-service | 3006 | `/notifications` |
| announcement-service | 3007 | `/announcements` |
| social-service | 3008 | `/social` |
| challenge-service | 3009 | `/challenges` |

---

## 5. Quick smoke tests

Register and get a token:
```bash
curl -c cookies.txt -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"Password123!","acceptedTos":true}'
```

Use the returned `accessToken` for protected calls:
```bash
TOKEN=<paste accessToken here>
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/users/me
curl http://localhost:3000/events
curl http://localhost:3000/announcements
curl http://localhost:3000/hall-of-fame/event-winners
```

---

## 6. Troubleshooting

**Gateway returns 502/504** — the target microservice is not running. Check which service the request should route to (see port map above) and start it.

**401 on refresh** — the `bgsc_refresh_token` cookie requires `Secure` flag. In local dev the auth service sets `secure: true`, which won't work over plain `http://`. For local testing either:
- Test token refresh via Postman/curl with the cookie manually, or
- Temporarily change `secure: false` in `auth.controller.ts:setCookie` for dev.

**CORS errors in browser** — ensure `CORS_ORIGINS` in `backend/.env` includes your frontend URL exactly (e.g. `http://localhost:5173`).

**TypeORM migration errors** — services use `synchronize: true` in development (auto-creates tables). If you see schema conflicts, drop and recreate the database.

**Redis connection refused** — start Redis: `redis-server` (or `brew services start redis` on Mac).
