# Handoff → BE-1: foundation is ready

**From:** BE-2 · **Date:** Sep 6, 2026 · **Branch:** `start`
**Applies to:** Week 1 Sunday, *BE-1: Authentication Service* (`MVP_Timeline_Plan_Updated.md:136-143`)

Three things you were blocked on now exist and are verified. Three things change in code you were about to write.

---

## 1. TL;DR

**Ready for you:**

| | Where | What it gives you |
|---|---|---|
| Server entrypoint | `Backend/src/index.ts` | app boots, `/health` returns 200, DB connects. `npm run dev` works |
| Auth middleware | `Backend/src/middleware/requireAuth.ts` | `requireAuth`, `optionalAuth` — use on your protected routes, don't write your own |
| Role middleware | `Backend/src/middleware/requireRole.ts` | `requireRole`, `requireSelfOr` — Spec §7.1 ladder |
| `User.ts` | `Backend/src/models/User.ts` | converted to project conventions, 3 bugs fixed |
| Request validation | `Backend/src/middleware/validate.ts` | `validate({ body: schema })` — zod, auto-maps to the 422 envelope in §5 |
| Domain event bus | `Backend/src/events/publish.ts` | `publish(type, producer, payload)` — emit `UserRegistered` / `UserLoggedIn` here |
| Audit trail | `Backend/src/models/AuditLog.ts` | `recordAudit({...})` — Spec §7.3 requires it for your coordinator promotion |

**Changes for you — read §2, §3, §5:**

1. Sign access tokens with the exact payload in §2, or auth breaks silently.
2. `User.ts` is snake_case with a UUID string `_id` (§3).
3. Password hashes no longer load by default — login and refresh need `.select('+password_hash')` (§3.3).

---

## 2. Access token contract ← most important

`requireAuth` expects exactly this payload:

```ts
{
  sub:  string,     // the user's _id (UUID v4 string, NOT an ObjectId)
  role: UserRole,   // 'guest'|'user'|'member'|'core'|'coordinator'|'founder'
  iat, exp
}
```

- Signed with `config.jwt.accessSecret` (`config/env.ts`)
- 15 min expiry, refresh 7 days rotating (Spec §11.1) — `config.jwt.accessExpiresIn` / `refreshExpiresIn` already hold these
- `sub` is the standard JWT subject claim, so it carries the user id and nothing else

```ts
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

const accessToken = jwt.sign(
  { sub: user._id, role: user.role },
  config.jwt.accessSecret,
  { expiresIn: config.jwt.accessExpiresIn }
);
```

A token missing `sub`, carrying an empty `sub`, or carrying a role outside the enum is rejected as 401 even if the signature is valid. If you need a different shape, change `requireAuth.ts` — one file, one place — rather than working around it per route.

## 3. `User.ts` changed

Converted to the conventions the other 11 collections already follow (`docs/modeldocs/README.md`): snake_case fields, UUID string `_id`.

### 3.1 `_id` is now a UUID string, not an ObjectId

This was a live bug, not a style preference. Every BE-2 collection stores a user reference as a `String` — `point_transactions.user_id`, `teams.members[].user_id`, `leaderboard_entries.participant.id`, and the `{ user_id, display_name, avatar_url }` snapshot in six collections. While `_id` was an ObjectId, all of those compared a string to an ObjectId and matched nothing.

Generated automatically on insert. Do not set it yourself:

```ts
const user = await User.create({ email, username, password_hash, profile: { full_name } });
user._id;   // '3f2a…' string, ready to drop into a JWT or a URL
```

### 3.2 Field renames

| Was | Now |
|---|---|
| `passwordHash` | `password_hash` |
| `refreshTokenHash` | `refresh_token_hash` |
| `passwordResetToken` / `passwordResetExpires` | `password_reset_token` / `password_reset_expires` |
| `isEmailVerified` | `is_email_verified` |
| `lastLoginAt` | `last_login_at` |
| `profile.fullName` / `avatarUrl` / `phoneNumber` | `profile.full_name` / `avatar_url` / `phone_number` |
| `profile.socialLinks` | `profile.social_links` |
| `playerCard.cardTier` | `player_card.card_tier` |
| `pointsBalance` | `points_balance` |
| `settings.privacy.isProfilePublic` | `settings.privacy.is_profile_public` |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` |

`UserRole` and `UserStatus` are unchanged — same enums, same values, same import.

### 3.3 Secrets are `select: false` ← affects your login code

`password_hash`, `refresh_token_hash`, `password_reset_token` and `password_reset_expires` no longer load on an ordinary query. A hash can only leak from a route that explicitly asked for it.

```ts
// login / refresh / reset — ask for it
const user = await User.findOne({ email }).select('+password_hash');
await bcrypt.compare(plain, user.password_hash);

// everywhere else — it simply isn't there
const user = await User.findById(id);   // no hash loaded, nothing to leak
```

Forgetting the `.select()` gives you `undefined`, and `bcrypt.compare` throws rather than returning false — so this fails loudly in your first login test, not silently in production.

### 3.4 Three bugs fixed while converting

| Was | Now |
|---|---|
| Interface said `profile.avatar`, schema said `profile.avatarUrl` — the field was effectively untyped | `profile.avatar_url` in both |
| Interface said `socialLinks.staraId`, schema said `stravaId` | `social_links.strava_id` |
| Interface had `steamId`, schema had no such field (Spec §4.1 and §9.2 want it) | `social_links.steam_id` added to the schema |

### 3.5 Fields added

`announcements: { last_seen_at, read_ids[] }` (Week 2 Announcement Service), `last_active_at` (Spec §5.15.5 admin column), `deleted_at` (Spec §11.2 soft delete). None affect auth. Also `username` + `profile.full_name` now carry a text index for user search.

## 4. Where to mount your router

`src/index.ts` has your line ready, commented:

```ts
// BE-1 (Auth Service): uncomment when src/auth/auth.routes.ts lands.
// import { authRoutes } from './auth/auth.routes';
// app.use('/auth', authRoutes);
```

Uncomment it. Please don't restructure the file — BE-2's router mounts on the line below yours.

Using the middleware:

```ts
import { requireAuth } from '../middleware/requireAuth';
import { requireRole } from '../middleware/requireRole';
import { UserRole } from '../models/User';

router.post('/logout', requireAuth, logout);          // req.user = { id, role }
router.post('/promote', requireAuth, requireRole(UserRole.COORDINATOR), promote);
```

## 4.1 The three shared pieces

**Validation** (`middleware/validate.ts`) — parses and *strips*, so a client cannot smuggle `role` into a registration payload:

```ts
router.post('/register', validate({ body: RegisterSchema }), register);
// failure → 422 { error: 'validation_failed', fields: [{ key, code }] }, handler never runs
```

**Events** (`events/publish.ts`) — in-process emitter now, Kafka in Phase 2. Envelope per `modeldocs/relationships.md` §6; call sites stay correct across the swap:

```ts
import { publish } from '../events/publish';
publish('UserRegistered', 'auth-service', { user_id: user._id, email, username });
publish('UserLoggedIn',   'auth-service', { user_id: user._id, device, ip });
```

A throwing consumer is logged, never propagated — an event consumer cannot fail the request that produced it.

**Audit** (`models/AuditLog.ts`) — append-only, every mutating query is blocked at the schema. Spec §5.15.5 makes an audit row mandatory for promotion:

```ts
import { recordAudit } from '../models/AuditLog';
await recordAudit({
  actor_id: req.user!.id,
  action: 'user.role_changed',            // dotted machine key, enforced
  target_type: 'user',
  target_id: target._id,
  previous_value: { role: 'user' },       // the diff, not the document
  new_value:      { role: 'core' },
  reason: 'operational justification',    // §5.15.5 requires this on promotions
});
```

Pass the diff, never the document — copying a whole user record into the trail would copy the hashes with it.

`AuditLog` was missing from Saturday's Core Data Models list. Plan gap, logged in `be2-user-service-plan.md` §11.5.

## 4.2 Full middleware reference

Everything exported, so you are not guessing at what exists:

| Export | From | Use |
|---|---|---|
| `requireAuth` | `middleware/requireAuth` | rejects 401 unless a valid token is present; sets `req.user = { id, role }` |
| `optionalAuth` | `middleware/requireAuth` | sets `req.user` when a token is present, **never rejects**. For routes whose response differs for a signed-in viewer |
| `bearerToken(header)` | `middleware/requireAuth` | pure helper, exported for testing |
| `requireRole(min)` | `middleware/requireRole` | `requireRole(UserRole.COORDINATOR)` = coordinator or above. Must run after `requireAuth` |
| `requireSelfOr(min, getId)` | `middleware/requireRole` | passes if the caller is the target **or** outranks `min`. Takes the target id from the request so a handler cannot forget the check |
| `rankOf(role)` | `middleware/requireRole` | position on the Spec §7.1 ladder |
| `validate(schemas)` | `middleware/validate` | `{ body?, query?, params? }`, each a zod schema |
| `publish(type, producer, payload)` | `events/publish` | emit a domain event; returns the envelope |
| `subscribe(type, handler)` | `events/publish` | consume one; returns an unsubscribe function. `subscribe('*', …)` receives every event |
| `recordAudit(entry)` | `models/AuditLog` | append one audit row |

```ts
router.patch('/users/:ref/role',
  requireAuth,
  requireRole(UserRole.COORDINATOR),
  validate({ body: RoleChangeSchema }),
  changeRole);
```

## 5. Error response shape (agreed convention)

A snake_case code, no human message. FE owns the wording.

```
401  { "error": "unauthorized" }
403  { "error": "forbidden" }
404  { "error": "not_found" }
409  { "error": "conflict" }
422  { "error": "validation_failed", "fields": [{ "key": "email", "code": "invalid" }] }
500  { "error": "internal_error" }
```

Two rules that matter for auth:

- **Auth failures never say why.** Not "expired", not "bad signature", not "no such user". "Token expired" already tells an attacker the token was real. `requireAuth` returns the same `{ error: 'unauthorized' }` for all nine rejection paths.
- **401 vs 403.** No/invalid token → 401. Valid token, insufficient rank → 403. An anonymous caller never receives 403, because a 403 confirms the endpoint exists.

The global error handler in `index.ts` already returns `500 { error: 'internal_error' }` and logs the real error server-side. Never put `err.message` in a response.

## 6. Running it

```bash
cd Backend
docker compose up -d mongodb    # mongo on :27017 (already running as `bgsc-mongodb`)
npm run dev                     # nodemon → ts-node → :3001
curl localhost:3001/health      # {"status":"ok","db":"connected",...}
```

Other scripts:

```bash
npm run build       # tsc, TypeScript 6.0.3
npm run typecheck   # tsc --noEmit on TypeScript 7 (checker only)
npm run selfcheck   # 3 suites: model invariants, auth middleware, shared infra
```

**Do not install TypeScript 7 as `node_modules/typescript`.** TS 7.0 ships no compiler API and `ts-node` dies at startup — that is why `npm run dev` was broken this morning. Full reasoning in `docs/typescript-toolchain.md`.

## 7. Verified before handing over

```
npm run build       clean
npm run typecheck   clean
npm run selfcheck   3 suites (models, auth middleware, shared infra), all passed
npm run dev         boots, mongo connects, GET /health → 200
```

`auth.selfcheck.ts` covers 30 cases: expired tokens, wrong secret, missing/empty `sub`, unknown role, malformed headers, and the 401-vs-403 split. **Run it if you change the token shape** — it is the fastest way to find out you broke the contract in §2.

`shared.selfcheck.ts` covers 29 more across `validate()`, `publish()` and `AuditLog`.

## 8. Still yours, untouched

Registration, login, refresh, password reset, email verification, JWT issuance, OAuth2 Google, 2FA/TOTP.

Two pieces of shared infrastructure were deliberately **not** built, because only auth needs them:

- **Rate limiting** — Spec §11.1: 5 attempts / 15 min / IP on auth endpoints. Needs a dependency (`express-rate-limit`); yours to add. If you put the general 100 req/min limit in `index.ts`, mount it above the routers.
- **Mailer** — email verification and password-reset delivery. No dependency installed.

Note: BE-2's `PATCH /users/:ref/role` refuses promotion to `coordinator` or `founder` with `501`, because Spec §5.15.5 requires Founder 2FA/TOTP and 2FA is not built yet. When your TOTP flow lands, that gate opens.

## 9. Context

- What BE-2 is building on top: `docs/be2-user-service-plan.md`
- Why `typescript` is pinned to 6.x: `docs/typescript-toolchain.md`
- Data model reference: `docs/modeldocs/`

The server entrypoint (`src/index.ts`) is assigned to nobody in the MVP plan — BE-2 wrote it because both Sunday tasks were blocked without it. Logged in `be2-user-service-plan.md` §11.5 so the plan gets fixed rather than the gap being absorbed silently.
