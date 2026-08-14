# BGSC Admin Console (Web)

React + Vite + Tailwind CSS PWA for the Coordinator / Founder web console
(Milestone 0.4 frontend shell + Milestone 1.7).

## Stack

- **React 19 + Vite** — SPA, PWA via `vite-plugin-pwa`.
- **Tailwind CSS v4** — `@tailwindcss/vite`; dark mode via a `.dark` class on `<html>`.
- **React Router v7** — routing (`/login`, `/auth/callback`, protected `/events`).
- **TanStack Query** — server state (event list).
- **Zustand** — global client state (`authStore`, `themeStore`).
- **MVVM** — `src/core/` mirrors the mobile app: `ApiClient`, `BaseViewModel`,
  repositories, stores. See `src/core/viewmodel/BaseViewModel.ts`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

The API gateway must be running on `http://localhost:3000` (`docker compose up`
from the repo root). Configure via `.env`:

```ini
VITE_API_URL=http://localhost:3000
```

The gateway's CORS allowlist already includes `http://localhost:5173`.

## Scripts

- `npm run dev` — dev server
- `npm run build` — typecheck + production build (emits PWA manifest + service worker)
- `npm run lint` — ESLint

## Notes

- The Events table renders **mock data** until the Event Service ships
  (Milestone 1.2) — see the `TODO` in `src/core/repositories/EventRepository.ts`.
- Auth is wired live to the gateway: register/login, Google OAuth callback,
  `GET /users/me`, and transparent refresh-on-401 (refresh token is an httpOnly
  cookie sent with `credentials: 'include'`).
