# BGSC Frontend Orchestrator — Monolight Prompt

> **What this file is:** A single prompt you paste at the start of any AI coding session to wire the AI into the full BGSC frontend documentation stack. Copy everything between the triple-dashes and paste it as your opening message. The AI will load the master doc, find the relevant screen spec, and build/verify code iteratively without needing further setup instructions.

> **When to use it:** At the start of every new frontend implementation session — whether building a new screen, refactoring an existing one, or reviewing a PR.

---

## ⬇️ PASTE THIS PROMPT TO START A SESSION ⬇️

---

You are implementing frontend code for the BGSC Platform. Before writing a single line of code, read and internalize the following documents in this exact order:

**1. Master Design + Architecture Doc (required — read in full):**
`docs/FrontendGuide/UI-UX-Master-Doc.md`

This is the law. Every colour, font, radius, spacing value, component recipe, API pattern, and code convention in this doc is a hard requirement. Do not deviate. Do not hardcode hex. Do not use fonts not listed in §5. Do not import packages not listed in §11.

**2. Screen-Specific UI/UX Spec (required — read in full for the screen you are building):**
`docs/FrontendGuide/Screens Master Doc/<screen-name>.md`

This spec is the pixel-level source of truth for the screen. Every section, component, state, interaction, empty state, error state, and loading skeleton described in it must be implemented. Nothing may be left out.

**3. Screen-Specific Frontend Implementation Guide (if it exists):**
`docs/FrontendGuide/Screens Master Doc/<screen-name>-frontend.md`

This doc provides the component tree, ViewModel structure, API wiring, and implementation checklist. Follow the component tree exactly. Wire the repositories and ViewModels as described. Check off the implementation checklist before declaring done.

**4. Relevant Backend Service Doc (read the API section for any endpoints you will call):**
`docs/Backend Documentation/<service-name>.md`

Cross-reference every API call you make with the exact request/response shapes documented here. Do not guess field names.

**5. Auth Spec (read if building auth, onboarding, or any screen with a guest-gating flow):**
`docs/FrontendGuide/Auth/handoffSpec.md`

---

### Your Operating Rules

**Design rules (from UI-UX-Master-Doc.md §0):**
- Never hardcode hex colours. Always use `useColors()` semantic tokens.
- Every card and panel is a BlurView glassmorphism surface over a dark canvas.
- Hero text (32 sp+): Bebas Neue 400 only. Section headings: Barlow Condensed 700. All UI and body: Inter.
- One primary CTA per view. All other actions are ghost/outline.
- Skeletons for data loading. No full-page spinners.
- Guest-gating: read actions are public; write actions redirect to `/login` with return path.

**Architecture rules (from UI-UX-Master-Doc.md §2):**
- MVVM strict — zero business logic or data fetching inside component bodies.
- One ViewModel per screen. ViewModels extend `BaseViewModel<S>`.
- Repositories are the only layer that calls `ApiClient`. One repository per service domain.
- TanStack Query v5 wraps repositories. Use object syntax `useQuery({ queryKey, queryFn })` — no positional args.
- All HTTP traffic routes through the API Gateway at `EXPO_PUBLIC_API_URL` / `VITE_API_URL`. Never call microservices directly.

**Code quality rules:**
- TypeScript strict mode. No `any` without an explicit comment.
- Every interactive element: `accessibilityRole` + `accessibilityLabel`. Min touch target 44×44 dp.
- All `opacity` + `transform` animations: `useNativeDriver: true`.
- BlurView must have a `surfaceSolid` fallback for devices that don't support backdrop-filter.

---

### Your Build Process

Follow this process for every screen. Do not skip steps.

**Step 1 — Read.**
Read all the docs listed above for this screen. Confirm you understand: every section of the screen, every API endpoint it calls, every state (loading / empty / error / guest), and every component in the tree.

**Step 2 — Plan.**
Before writing code, output a short implementation plan:
- List the files you will create/modify.
- List the components, their props, and their render conditions.
- List every API call with its method, path, and data shape.
- List which parts are Phase 2 (not live yet) and how you will stub them.

Wait for approval on the plan before writing code.

**Step 3 — Implement.**
Build the screen from the bottom up:
1. Types + data shapes first (`types.ts` additions)
2. Repository methods
3. ViewModel(s)
4. Leaf components (no data dependencies)
5. Connected components (use ViewModel state)
6. Screen root (route file, tab/nav structure)
7. Skeleton states
8. Empty states
9. Error states
10. Guest-gating

**Step 4 — Self-verify.**
After writing each component, check it against the spec:
- Does every section from the spec exist in the code?
- Do all props/states from the spec have implementations?
- Are skeletons and empty states present for every data-driven section?
- Are colours from `useColors()` only — no hardcoded hex?
- Is the font correct for every text element (Bebas Neue hero, Barlow Condensed heading, Inter body)?
- Does every pressable element have `accessibilityRole` + `accessibilityLabel`?
- Does the guest gate redirect to `/login` with the correct return path?

**Step 5 — Re-read and patch.**
Re-read the screen spec one more time. Find any detail you missed. Patch it. Do not call the screen done until the spec is fully satisfied.

**Step 6 — Report.**
Output a completion summary:
- List every component created.
- List every API endpoint wired.
- List any spec items left stubbed for Phase 2, with a TODO comment in the code.
- List any open questions or design decisions that need team input.

---

### Iterative Re-verification Checklist

Run through this checklist after every major implementation session. Fix everything that fails before moving on.

**Glassmorphism:**
- [ ] All cards/panels use `BlurView` with the correct intensity (cards ~55, modals ~80)
- [ ] All cards have `rgba` surface overlay on top of BlurView
- [ ] All cards have `borderWidth: 1, borderColor: colors.border` (sage hairline)
- [ ] `surfaceSolid` fallback exists for devices without backdrop-filter support

**Colours:**
- [ ] Zero hardcoded hex in component files
- [ ] `useColors()` imported and used in every component that renders colour
- [ ] Accent (#E8662A) used only for links, active chips, and CTA fills — not for large decorative areas
- [ ] Success / danger / info used only for their semantic purpose

**Typography:**
- [ ] Hero/balance/score text: `fontFamily: 'BebasNeue_400Regular'`
- [ ] Screen/modal/section headings: `fontFamily: 'BarlowCondensed_700Bold'`
- [ ] All body, labels, buttons, inputs: `fontFamily: 'Inter_*'` at correct weight
- [ ] Field labels: UPPERCASE, letterSpacing: 0.6, Inter 600, textMuted colour
- [ ] All fonts loaded in `app/_layout.tsx` with `useFonts`

**Layout:**
- [ ] Screen horizontal padding: 16 everywhere
- [ ] Card border radius: 16
- [ ] Pill button/input border radius: 999
- [ ] Bottom sheet top radius: 24

**Loading states:**
- [ ] Every data-driven section has a skeleton that matches the content shape
- [ ] No full-page spinners (only inline on buttons and "load more")
- [ ] Skeleton uses opacity pulse animation with `useNativeDriver: true`

**State coverage:**
- [ ] Loading state
- [ ] Empty state (with illustration/emoji + message)
- [ ] Error state (with retry button)
- [ ] Guest state (read shows, write actions redirect)
- [ ] Authenticated state (full functionality)

**API integration:**
- [ ] All API calls go through a Repository method
- [ ] All Repository methods use `ApiClient` (never raw `fetch`)
- [ ] Bearer token injection is automatic (via `ApiClient`)
- [ ] Mutations use `useMutation` with `onSuccess` cache invalidation
- [ ] Queries use correct `queryKey` convention from §12.3 of master doc

**Accessibility:**
- [ ] Every Pressable, Button, and Link has `accessibilityRole` and `accessibilityLabel`
- [ ] Touch targets are ≥ 44×44 dp (use `hitSlop` if visual is smaller)
- [ ] Color is not the only signal for state (text/icon pairs for status)
- [ ] Reduce-motion check wraps animations: `AccessibilityInfo.isReduceMotionEnabled()`

**Navigation:**
- [ ] Back navigation always works (back arrow functional even on error)
- [ ] Guest gating preserves return path: `router.replace({ pathname: '/login', params: { returnTo: currentPath } })`
- [ ] Deep-links (share icon) use `expo-sharing` or `Share.share()` with full URL

---

### Reference File Map

Each screen now has its own dedicated folder. `Screens Master Doc/` has been removed.

```
docs/Frontend/
├── UI-UX-Master-Doc.md                    ← MASTER — read first, always
├── ORCHESTRATOR.md                        ← this file
│
├── Auth/                                  ← Authentication & Onboarding
│   ├── handoffSpec.md                     ← pixel-level light-mode auth spec (login/register/OTP/onboard)
│   └── auth-mobile-spec.md                ← mobile implementation spec (interaction, flow, dark-mode tokens)
│
├── Events/                                ← Events Screen
│   └── events-page1.md                    ← full detailed spec (tabs, leagues, bracket, auction, FitSoc/Strava)
│
├── feedback/                              ← Feedback & Contact Screen
│   └── feedback-contact-page.md
│
├── friends/                               ← Friends Screen
│   └── friends-page.md
│
├── hall-of-fame/                          ← Hall of Fame Screen
│   └── hall-of-fame.md
│
├── homepage/                              ← Home Screen
│   └── home-page.md                       ← canonical overhaul spec (Glass Forest design)
│
├── leaderboard/                           ← Leaderboard Screen
│   └── leaderboard.md                     ← full spec (live standings, investment, sponsor leaderboard)
│
├── media/                                 ← Media Screen
│   ├── media-page.md                      ← layout spec
│   └── media-page-design.md               ← full design + implementation guide ✅
│
├── points/                                ← Points & Challenges Screen
│   ├── points-challenge-page.md           ← UI/UX spec
│   └── points-challenge-frontend.md       ← code-level impl guide ✅
│
├── popups-modals/                         ← Shared Popups & Modals
│   ├── popups-and-modals.md
│   └── assets/                            ← modal screenshots
│
├── sponsors/                              ← Sponsors & Newsletters Screen
│   └── sponsors-page.md
│
├── store/                                 ← Store Screen
│   └── store-page.md
│
├── union/                                 ← Union Page (⚠️ DEPRECATED — feature removed)
│   └── union-page.md
│
├── user-profile/                          ← User Profile Screen (own profile / self-view)
│   └── user-profile.md
│
└── users/                                 ← Users Page (Coordinator+ admin roster view)
    └── users-page.md                      ← NEW — full spec for coordinator user management
```

> **Cross-reference backend docs at** `docs/` (one level up):
> `authservice.md`, `user-service.md`, `event-service.md`, `points-service.md`, `sponsor-service.md`, `api-gateway.md`

---

### Session Startup Shortcut

For subsequent sessions on an already-started screen, use this shorter prompt:

```
Continue implementing the BGSC [Screen Name] screen.
Read UI-UX-Master-Doc.md §0 golden rules first (30 seconds).
Then read [screen].md and [screen]-frontend.md.
Pick up from the implementation checklist — find the first unchecked item and build it.
After each component, run the §4 re-verify checklist from ORCHESTRATOR.md.
```

---

### Screen Build Order (Recommended)

Build screens in this sequence to maximise momentum and dependency resolution:

1. **Auth + Onboarding** (`Auth/handoffSpec.md`, `Auth/auth-mobile-spec.md`) — gate to everything
2. **Home** (`homepage/home-page.md`) — landing; announces identity and social proof
3. **Events** (`Events/events-page1.md`) — core value prop
4. **Points & Challenges** (`points/points-challenge-page.md`, `points/points-challenge-frontend.md`) — gamification heart
5. **User Profile** (`user-profile/user-profile.md`) — personal identity
6. **Leaderboard** (`leaderboard/leaderboard.md`) — social competition
7. **Hall of Fame** (`hall-of-fame/hall-of-fame.md`) — aspirational
8. **Store** (`store/store-page.md`) — reward redemption
9. **Friends** (`friends/friends-page.md`) — network effects
10. **Sponsors** (`sponsors/sponsors-page.md`) — monetisation
11. **Feedback & Contact** (`feedback/feedback-contact-page.md`) — support
12. **Users** (`users/users-page.md`) — Coordinator+ roster management ← **new**
13. **Media** (`media/media-page.md`, `media/media-page-design.md`) — content hub (design TBD per owner)

> **Note:** The Media page design is being handled separately by the team. Do not begin implementing it until the design spec is confirmed and the team signals it's ready.

---

> **Colour system reminder for all screens:**
> All screens use the dark glassmorphism palette from `UI-UX-Master-Doc.md §4` via `useColors()`.
> Auth screens (item 1 in build order) use the **light mode** token override (`background: #FAF7F2`).
> Never hardcode hex values — always reference semantic tokens.

*End of ORCHESTRATOR.md. Paste the section between the triple-dashes above to start a frontend session.*
