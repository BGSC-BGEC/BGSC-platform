# Mobile App — Implementation Reference

**Milestone:** 0.4 – Frontend Shell (Mobile + Web)
**Phase:** 0 (Foundation)
**Status:** Shell implemented (auth live, events mocked)
**Stack:** Expo SDK 56 + Expo Router

---

## Overview

The Mobile App is the player-facing React Native (Expo) client. Milestone 0.4
delivers the shell required by the Phase 0 success criteria: a **side drawer**
navigator, a custom **dynamic status bar** header, **dark/light theme**
switching, and the shared **MVVM core** that mirrors the web app.

It talks only to the **API Gateway** (`http://localhost:3000`). Auth is wired
live (register/login, `GET /users/me`); the events list is **mock data** until
the Event Service ships (Milestone 1.2).

Lives in `mobile/`, installed and run independently of `backend/` and `web/`.

> Expo SDK 56 has breaking changes — read the versioned docs at
> <https://docs.expo.dev/versions/v56.0.0/> before editing (see `mobile/AGENTS.md`).

---

## File Map

```
mobile/
├── app.json                                — Expo config (icon → assets/expo.icon, splash, plugins)
├── .env.example                            — EXPO_PUBLIC_API_URL=http://localhost:3000
├── global.d.ts                             — `declare module '*.css'` for Metro CSS imports
├── assets/
│   ├── expo.icon/                          — App icon source (referenced by app.json)
│   └── images/                             — icon / splash / android-icon / favicon (app-owned)
├── src/
│   ├── global.css                          — Global styles (Metro web CSS)
│   ├── app/                                — Expo Router (file-based routes)
│   │   ├── _layout.tsx                     — Root: providers (Query, theme, safe-area)
│   │   ├── login.tsx / register.tsx        — Auth screens
│   │   ├── auth/callback.tsx               — Google OAuth redirect target
│   │   └── (drawer)/                       — Side Drawer navigator (spec §3.2)
│   │       ├── _layout.tsx                 — Drawer config + DynamicStatusBar header
│   │       ├── index.tsx                   — Home
│   │       ├── events.tsx                  — Events (mock data)
│   │       ├── points.tsx · sponsors.tsx · friends.tsx
│   │       ├── leaderboards.tsx · hall-of-fame.tsx
│   │       └── store.tsx · media.tsx · feedback.tsx · profile.tsx
│   ├── components/
│   │   ├── drawer-content.tsx              — Custom drawer body
│   │   ├── dynamic-status-bar.tsx          — Custom themed header / status bar (spec §3.1)
│   │   ├── screen.tsx · placeholder-screen.tsx
│   │   ├── logo.tsx · theme-toggle.tsx
│   ├── hooks/
│   │   ├── use-color-scheme.ts(.web.ts)    — Resolves themeStore → 'light' | 'dark' (.web = Metro override)
│   │   ├── use-colors.ts                    — Color accessor for components (reads core/theme/tokens)
│   ├── lib/query-client.ts                 — TanStack Query client
│   ├── viewmodels/ProfileViewModel.ts      — Example concrete ViewModel
│   └── core/                               — Shared MVVM core (mirrors web/src/core)
│       ├── env.ts                          — Reads process.env.EXPO_PUBLIC_API_URL
│       ├── storage.ts                      — Token persistence via expo-secure-store
│       ├── types.ts                        — Domain types + AsyncState<T>
│       ├── api/ApiClient.ts · ApiError.ts  — fetch wrapper + typed HTTP error
│       ├── repositories/                   — Auth / User / Event (Event = MOCK)
│       ├── stores/authStore.ts · themeStore.ts
│       ├── theme/tokens.ts
│       └── viewmodel/BaseViewModel.ts · useViewModel.ts
```

---

## Architecture (MVVM)

`src/core/` is **intentionally duplicated** with `web/src/core/` — keep the two
in sync until a shared package exists.

- **Model / transport** — `ApiClient` injects `Authorization: Bearer <token>`
  and surfaces typed `ApiError`s. The access token is persisted in the device
  keychain/keystore via **expo-secure-store** (`core/storage.ts`).
- **ViewModel** — `BaseViewModel<S>` (`setState` + `runAsync` →
  `AsyncState<T>`), bound to React via `useViewModel`. `ProfileViewModel` is the
  worked example.
- **Global state** — Zustand `authStore` (token + user, wires `ApiClient` hooks)
  and `themeStore` (light/dark/system), resolved by `hooks/use-color-scheme.ts`
  and consumed through `use-theme` / `use-colors`.

## Navigation & UI (Milestone 0.4 deliverables)

- **Side Drawer** — `src/app/(drawer)/_layout.tsx` registers all drawer screens
  (Home, Events, Points & Challenges, Sponsors, Friends, Leaderboards, Hall of
  Fame, Store, Media, Feedback, Profile) with a custom `drawer-content`.
  Role-gated links are intentionally omitted until RBAC-aware nav lands.
- **Dynamic status bar** — `components/dynamic-status-bar.tsx` is wired as the
  drawer `header`, theming the status bar/header per screen and color scheme.
- **Theme switching** — `theme-toggle` flips `themeStore`; light/dark/system is
  resolved in `hooks/use-color-scheme.ts`.

---

## Run & Configure

```bash
cd mobile
npm install
npx expo start        # press i (iOS), a (Android), w (web)
```

The gateway must be up (`docker compose up` from repo root). Configure via `.env`:

```ini
EXPO_PUBLIC_API_URL=http://localhost:3000
```

> **Android emulator:** the host is reachable at `10.0.2.2`, so use
> `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`.

Scripts: `npx expo start` · `npm run lint` · `npx tsc --noEmit` ·
`npx expo export -p web` (validate web bundle).

---

## Status & Known Gaps

- ✅ Side drawer, dynamic status bar, theme switching, MVVM core (Phase 0 mobile
  criteria met).
- ✅ Live auth against the gateway (register/login, `GET /users/me`).
- ⏳ **Events screen is mock data** — see the `TODO` in
  `src/core/repositories/EventRepository.ts`; wire to the Event Service at
  Milestone 1.2 / 1.6.
- ⏳ **Refresh-token cookie:** auth-service issues the refresh token as an
  httpOnly cookie, which React Native's `fetch` does not persist reliably.
  Mobile currently relies on the access token + best-effort refresh.
- ⏳ **Google OAuth:** opens the system browser, but the callback round-trip
  still needs a deep-link redirect URI wired in a later pass.
```
