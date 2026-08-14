# BGSC Mobile (Expo)

React Native (Expo) client for the BGSC platform — the Milestone 0.4 frontend
shell + Phase 1 mobile app.

## Stack

- **Expo SDK 56 + Expo Router** — file-based routing with a **side drawer**
  (`src/app/(drawer)/`) and a custom **dynamic status bar** header (spec §3.1/§3.2).
- **Zustand** — global client state (`authStore`, `themeStore`).
- **TanStack Query** — server state (event list).
- **expo-secure-store** — access token persistence (device keychain/keystore).
- **MVVM** — `src/core/` mirrors the web app: `ApiClient`, `BaseViewModel`,
  repositories, stores. See `src/core/viewmodel/BaseViewModel.ts` and the example
  `src/viewmodels/ProfileViewModel.ts`.

Theme (light/dark/system) is driven by `themeStore` and resolved in
`src/hooks/use-color-scheme.ts`, which the template's `useTheme`/`useColors` read.

## Run

```bash
npm install
npx expo start        # then press: i (iOS), a (Android), w (web)
```

The API gateway must be running on `http://localhost:3000` (`docker compose up`
from the repo root). Configure via `.env`:

```ini
EXPO_PUBLIC_API_URL=http://localhost:3000
```

> **Android emulator:** the host is reachable at `10.0.2.2`, so use
> `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`.

## Scripts

- `npx expo start` — dev server
- `npm run lint` — Expo ESLint
- `npx tsc --noEmit` — typecheck
- `npx expo export -p web` — validate the production bundle

## Notes

- The Events screen renders **mock data** until the Event Service ships
  (Milestone 1.2) — see the `TODO` in `src/core/repositories/EventRepository.ts`.
- Auth is wired live to the gateway: register/login and `GET /users/me`.
- **Known follow-up:** the auth-service issues the refresh token as an httpOnly
  cookie, which React Native's fetch does not persist reliably. Mobile currently
  relies on the access token + best-effort refresh; Google OAuth opens the system
  browser but the callback round-trip needs a deep-link redirect URI to be wired
  in a later pass.
