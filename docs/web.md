# Web Admin Console — Implementation Reference

**Milestone:** 0.4 – Frontend Shell (Mobile + Web)
**Phase:** 0 (Foundation)
**Status:** Shell implemented (auth live, events mocked)
**Dev port:** 5173

---

## Overview

The Web Admin Console is the **Coordinator / Founder** management UI. It is a
React 19 + Vite single-page app, installable as a **PWA**, styled with
**Tailwind CSS v4**. Milestone 0.4 delivers the shell: routing, login + Google
OAuth callback, a protected layout, a (mock) events table, dark/light theming,
and the shared **MVVM core** that mirrors the mobile app.

It talks only to the **API Gateway** (`http://localhost:3000`). Auth is wired
live (register/login, `GET /users/me`, transparent refresh-on-401); the events
list is **mock data** until the Event Service ships (Milestone 1.2).

Lives in `web/`, installed and run independently of `backend/` and `mobile/`
(no npm workspace).

---

## File Map

```
web/
├── index.html                              — App shell; links /favicon.svg
├── vite.config.ts                          — Vite + Tailwind v4 + vite-plugin-pwa (manifest/SW)
├── .env.example                            — VITE_API_URL=http://localhost:3000
├── public/
│   └── favicon.svg                         — Placeholder icon (PWA manifest references it)
├── src/
│   ├── main.tsx                            — Entry: QueryClientProvider + RouterProvider
│   ├── index.css                           — Tailwind v4 entry + design tokens
│   ├── assets/                             — Static images (app-owned)
│   ├── app/
│   │   ├── router.tsx                      — React Router v7 route tree
│   │   └── queryClient.ts                  — TanStack Query client config
│   ├── pages/
│   │   ├── Login.tsx                        — Email/password + Google OAuth entry
│   │   ├── AuthCallback.tsx                 — Handles Google OAuth redirect
│   │   └── Events.tsx                       — Event table (mock data)
│   ├── components/
│   │   ├── Layout.tsx                       — Authenticated shell (nav + outlet)
│   │   ├── RequireAuth.tsx                  — Route guard → redirects to /login
│   │   ├── EventTable.tsx                   — Event list table
│   │   ├── Logo.tsx / ThemeToggle.tsx       — Branding + dark/light switch
│   └── core/                                — Shared MVVM core (mirrors mobile/src/core)
│       ├── env.ts                           — Reads import.meta.env.VITE_API_URL
│       ├── storage.ts                       — Token persistence (localStorage)
│       ├── types.ts                         — Domain types + AsyncState<T>
│       ├── api/
│       │   ├── ApiClient.ts                 — fetch wrapper: Bearer inject + refresh-on-401
│       │   └── ApiError.ts                  — Typed HTTP error (status, message, body)
│       ├── repositories/
│       │   ├── AuthRepository.ts            — register / login / refresh / logout
│       │   ├── UserRepository.ts            — GET /users/me
│       │   └── EventRepository.ts           — MOCK until Milestone 1.2
│       ├── stores/
│       │   ├── authStore.ts                 — Zustand: token + user, wires ApiClient hooks
│       │   └── themeStore.ts                — Zustand: light / dark / system
│       ├── theme/tokens.ts                  — Shared color/spacing tokens
│       └── viewmodel/
│           ├── BaseViewModel.ts             — Observable VM base (setState + runAsync)
│           └── useViewModel.ts              — useSyncExternalStore binding
```

---

## Architecture (MVVM)

The `src/core/` layer is **intentionally duplicated** with `mobile/src/core/` —
keep the two in sync until a shared package exists.

- **Model / transport** — `ApiClient` is the single fetch wrapper. It injects
  `Authorization: Bearer <token>`, sends `credentials: 'include'` (so the
  auth-service httpOnly refresh cookie rides along), and on a `401` for an
  authed request transparently refreshes **once** and retries. Repositories
  (`AuthRepository`, `UserRepository`, `EventRepository`) are the typed API
  surface built on top of it.
- **ViewModel** — `BaseViewModel<S>` holds plain state, mutates via `setState`,
  and notifies subscribers. `runAsync(key, task)` drives one `AsyncState<T>`
  field through `loading → success | error`. React binds via `useViewModel`
  (`useSyncExternalStore`).
- **Global state** — Zustand `authStore` (token + user; registers
  `getToken`/`refresh` hooks into `ApiClient`) and `themeStore`
  (light/dark/system → `.dark` class on `<html>`).

## Routing (`src/app/router.tsx`)

| Path             | Element        | Notes                                   |
|------------------|----------------|-----------------------------------------|
| `/login`         | `Login`        | Public                                  |
| `/auth/callback` | `AuthCallback` | Google OAuth redirect target            |
| `/`              | `RequireAuth` → `Layout` | Protected; `index` → `/events` |
| `/events`        | `Events`       | Protected; mock event table             |
| `*`              | → `/`          | Catch-all redirect                      |

## Auth flow

1. `Login` posts to the gateway (`/auth/register` or `/auth/login`); on success
   `authStore` stores the access token + user and registers the `ApiClient`
   hooks.
2. Google OAuth opens the provider; the gateway redirects back to
   `/auth/callback`, which finalizes the session.
3. Any authed request that 401s triggers a single refresh (httpOnly cookie) and
   retry inside `ApiClient`; on refresh failure the user is sent back to
   `/login`.

---

## Run & Configure

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

The gateway must be up (`docker compose up` from repo root); its CORS allowlist
already includes `http://localhost:5173`. Configure via `.env`:

```ini
VITE_API_URL=http://localhost:3000
```

Scripts: `npm run dev` · `npm run build` (typecheck + PWA build) · `npm run lint`.

---

## Status & Known Gaps

- ✅ Routing, protected layout, login + Google OAuth callback, theming, MVVM core.
- ✅ Live auth against the gateway (register/login, `GET /users/me`, refresh-on-401).
- ⏳ **Events table is mock data** — see the `TODO` in
  `src/core/repositories/EventRepository.ts`; wire to the Event Service at
  Milestone 1.2 / 1.7.
- ⏳ `favicon.svg` is a placeholder — replace with branded PWA assets before launch.
