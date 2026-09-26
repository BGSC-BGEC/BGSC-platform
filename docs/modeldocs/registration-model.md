# Registration Model (Common Registration Service)

**Owner service:** Registration Service
**Collections:** `form_definitions`, `form_definition_versions`, `form_submissions`, `form_uploads`
**Spec refs:** §5.5 Event Details — "need to have flexibility to add fields required for the event's registration ... along with multiple parameters like compulsory or not", §5.5 League-Specific Registration, §5.15.1 Registration Deadline Gates, §8.1 Registration domain events
**MVP plan refs:** "Registration Service: Common/shared service for all form-based registrations", Week 2 BE-2 (dynamic form schema, creation, submission, validation engine, multiple form types, versioning), Week 3 FE-Admin form builder

---

## 1. Purpose

One service answers "what does this thing ask people to fill in?" and "who filled it in, with what?" for **any** owner: events today, challenges and anything form-shaped later. Two collections:

- `form_definitions` — the admin-built schema (fields, types, validation). Versioned.
- `form_submissions` — one per (form, user). Holds the dynamic `answers` and a small typed `context` for owner-specific structured state (event role, team, base price, captain application) that is not a "form field" but every registration of that owner type needs.

Registration status (confirmed / waitlisted / cancelled) lives on the submission. "Registering for an event" **is** creating a `form_submissions` doc.

## 2. `form_definitions`

```ts
{
  _id: string,
  owner: { type: 'event' | 'challenge' | 'generic', id: string | null },
  title: string,
  description: string | null,

  version: number,                    // starts 1; incremented on every published change
  status: 'draft' | 'published' | 'archived',

  fields: FormField[],                // ordered

  settings: {
    allow_edit_until: 'closes_at' | 'never' | 'always',   // can user edit answers after submit; 'closes_at' = owner's registration close (event) / accept window close (challenge)
    confirmation_message: string | null
  },

  created_by: string,
  created_at: Date,
  updated_at: Date,
  published_at: Date | null
}
```

### 2.1 `FormField`

```ts
{
  key: string,                        // ^[a-z][a-z0-9_]{0,31}$, unique in form
  label: string,
  help_text: string | null,
  type: 'short_text' | 'long_text' | 'number' | 'email' | 'phone' | 'url' |
        'select' | 'multi_select' | 'checkbox' | 'date' | 'file' | 'user_ref',
  required: boolean,                  // Spec §5.5 "compulsory or not"
  placeholder: string | null,

  options: { value: string, label: string }[] | null,   // select / multi_select

  validation: {                       // all optional, checked server-side
    min: number | null,               // number: value; text: length; multi_select: count
    max: number | null,
    pattern: string | null,           // regex (short_text, url, phone)
    accept: string[] | null,          // file: mime types
    max_size_bytes: number | null     // file
  },

  visible_if: {                       // simple conditional display
    field_key: string,
    op: 'eq' | 'neq' | 'in',
    value: unknown
  } | null,

  admin_only: boolean,                // filled by admin, not user (e.g. seed, elo verified)
  order: number
}
```

Example, chess league (from Spec §5.5): `{ key: 'fide_elo', label: 'FIDE Elo', type: 'number', required: false, validation: { min: 0, max: 3500 } }`.

### 2.2 Versioning rule

`fields` are **immutable once published**. Editing a published form creates a new version:

- Bump `version`, keep same `_id`, store previous fields in `form_definition_versions` (`{ form_id, version, fields, published_at }`) so old submissions can still be rendered.
- Each submission records `form_version` it was submitted against.
- ponytail: history in a side collection instead of embedding an array of versions in the definition; keeps the hot doc small.

### 2.3 Indexes

`{ 'owner.type': 1, 'owner.id': 1 }`, `{ status: 1 }`, `{ created_by: 1 }`.

## 3. `form_submissions`

```ts
{
  _id: string,
  form_id: string,
  form_version: number,
  owner: { type: 'event' | 'challenge' | 'generic', id: string | null },   // denormalized from form

  user: { user_id: string, display_name: string, avatar_url: string | null, deleted: boolean },   // snapshot (relationships.md §4)

  answers: Record<string, unknown>,   // key -> value, validated against form fields at form_version
  files: { field_key: string, url: string, name: string, size: number, mime: string }[],   // copied from form_uploads, never from the client (§3.5)

  // owner-specific structured state. Exactly one branch populated, matching owner.type.
  context: {
    event?: {
      role: 'solo' | 'captain' | 'member',                 // Spec §5.5 role selection
      team_id: string | null,                              // -> teams._id
      team_visibility: 'open' | 'invite_only' | 'closed',  // Spec §5.5 user toggle
      base_price: number | null,                           // auction leagues (Spec §5.5)
      captain_application: {                               // Spec §5.5 Captain Request Flow
        status: 'none' | 'pending' | 'approved' | 'declined',
        reviewed_by: string | null,
        reviewed_at: Date | null,
        note: string | null
      },
      attended: boolean | null                             // plan Week 2 "attendance tracking"; written only via POST /internal/registrations/attendance
    },
    challenge?: {
      team_id: string | null
    }
  },

  status: 'draft' | 'submitted' | 'confirmed' | 'waitlisted' | 'rejected' | 'cancelled',   // draft = saved, not submitted; purged after closes_at
  waitlist_position: number | null,
  status_history: { from: string, to: string, by: string, at: Date, reason: string | null }[],

  submitted_at: Date | null,
  confirmed_at: Date | null,
  cancelled_at: Date | null,
  created_at: Date,
  updated_at: Date
}
```

### 3.1 Status lifecycle

```
draft ──submit──> submitted ──auto/approve──> confirmed
                      │                          │
                      ├──(capacity full)──> waitlisted ──(slot frees)──> confirmed
                      ├──reject──> rejected       │
                      └──cancel──> cancelled <────┘
```

| Transition | Guard |
|---|---|
| draft → submitted | now within the owner's window (`events.registration.opens_at..closes_at` — enforced by the Event Service's reserve; or, for a challenge, `status == 'active'` and `challenges.window`, checked here: `409 challenge_not_active / challenge_not_open / challenge_closed`); `context.event.role` matches `teaming.is_teamed` (else `422 role_mismatch`); all `required` fields present; answers pass validation; unique index passes |
| submitted → confirmed | if `events.registration.requires_approval == false`: automatic, in the same request. Else the row stays `submitted`, holding no seat, until an event admin confirms it (`PATCH /registrations/:id/status`, which reserves). Either way a seat must be reserved first (§3.2). Nobody approves or overrides their own registration (`403 cannot_review_own_registration`) |
| submitted → waitlisted | seat reservation failed and `waitlist_enabled` — on submit, or when an admin confirms a `submitted` row into a full event (`200`, row `waitlisted`, recorded `by: 'system'` so auto-promotion picks it up) |
| waitlisted → confirmed | (a) automatic: Registration Service consumes its own `RegistrationCancelled` with `freed_seat: true` and offers the seat to the lowest `waitlist_position`; (b) organiser: Event Service calls `POST /internal/registrations/:id/promote { by }`. Both go through one `promoteRegistration`: reserve (idempotent per registration) → CAS `waitlisted → confirmed`; a CAS loser gives back a seat it will not use. Refusal leaves the row waitlisted |
| * → cancelled | by user before `closes_at` (`409 cancel_window_closed` after), or by an admin of the owner any time. Captain cancelling (or being demoted by an admin): blocked while their open (`forming`/`complete`) team has other members (`409 captain_has_team`; disband first); a captain alone takes the team with them. A locked roster does not block: it cannot be disbanded, so an admin can still remove a no-show captain |
| * → rejected | Core+ |
| * → waitlisted (admin) | event rows only (`409 no_waitlist` otherwise). Emits `RegistrationWaitlisted` with the new position; the row is never auto-promoted back (only an admin, or `/internal/.../promote`) |

`confirmed` is the only state that counts as "registered" for points, leaderboard, and teams. `RegistrationCreated` is emitted on **every** entry into `confirmed` — submit, captain approval, admin confirm, and both promotion paths. **Decision (Sep 26):** it is the ONE "now confirmed" event; the Event Service's `RegistrationConfirmed` is retired, because the leaderboard and the points path only ever heard one of the two names. Every exit from `confirmed` (cancel, or an admin demotion) emits `RegistrationCancelled`.

Every status change is a CAS on the status the request read (`casTransition`), so two instances, a cancel racing an approval, or a retried promotion can move a row at most once (no transactions on a standalone Mongo).

### 3.2 Capacity + duplicate safety

Order matters so the common failure (duplicate) never needs compensation:

```
1. insert form_submissions { status: 'submitted' }         ── unique index rejects duplicates here, nothing else touched
2. POST event:/internal/events/:id/reserve-seat { registration_id }   (callInternal; envelope unwrapped; idempotent per registration_id)
     { reserved: true }                          ⇒ 3a
     { reserved: false, reason: 'capacity_full' } ⇒ 3b waitlisted     (full, waitlist on)
     { reserved: false, reason: other }           ⇒ 3b rejected       (waitlist_disabled | event_closed | not_open | event_not_found)
     no answer (timeout / 5xx)                    ⇒ row stays `submitted`; the stranded sweep (every 5 min, rows untouched > 60s,
                                                   not awaiting an admin) or a resubmit retries the same reserve
3a. CAS submitted → confirmed, emit RegistrationCreated     (CAS lost ⇒ release the seat)
3b. CAS submitted → waitlisted | rejected, emit RegistrationWaitlisted for waitlisted
```

- Duplicate guard: unique index `{ form_id: 1, 'user.user_id': 1 }` partial on `status ∉ {cancelled, rejected}`. The DB, not the app.
- Capacity guard: the Event Service's reserve is atomic and **idempotent per registration** (`events.seat_holders`, event-model.md §3), so a retry after a lost answer never counts twice. Every exit from `confirmed` — and from `submitted`, which may hold a seat whose answer was lost — calls `release-seat` (idempotent, one retry). `RegistrationCancelled.freed_seat` is true only when the Event Service confirmed the release, so a failed release never promotes into a seat that is still held.
- The seat contract (Sep 26) replaced a client that read `reserved` off the `{ success, data }` envelope — undefined every time, so every event registration settled `rejected` while a seat was counted.
- ponytail: sync call instead of saga; move to an event-driven reservation if the services split databases and latency bites.

### 3.2.1 Invariants

- `owner.type == 'event'` ⇒ `context.event` present, `context.challenge` absent (and vice versa)
- `context.event.role ∈ {captain, member}` ⇒ owner event `teaming.is_teamed == true`; `role == 'solo'` ⇔ not teamed — checked at submit (`422 role_mismatch`)
- owner event `type == 'ALL'` and `role == 'member'` ⇒ `base_price != null && > 0` (Spec §5.5)
- `events.teaming.captain_application_required` and `role == 'captain'` ⇒ `captain_application.status == 'approved'` before a team can be created. Without the requirement a captain's application starts `approved`
- `context.event.team_id != null` ⇒ `status == 'confirmed'`
- `waitlist_position != null ⇔ status == 'waitlisted'`

### 3.3 Validation engine (server-side, in Registration Service)

For each field at `form_version`:
1. `required` ⇒ value present and non-empty.
2. Type coercion/check per `type`.
3. `validation.min/max/pattern/accept/max_size_bytes`.
4. `visible_if` false ⇒ field ignored even if required.
5. `admin_only` ⇒ reject if present in a user submission.
6. Unknown keys ⇒ reject.

Errors returned as `422 { error: 'validation_failed', fields: { key, code, message }[] }` — the same shape as a request-schema (zod) failure.

`visible_if.value` is stored as the engine compares it: at form save it is coerced the way the controller field's answers are (a date to its ISO instant, `"20"` to 20, each element for `in`); a value no answer could equal (wrong type, unknown option, a `multi_select` or `file` controller) is `422 visible_if_value_invalid`.

### 3.4 Indexes

| Index | Serves |
|---|---|
| `{ form_id: 1, 'user.user_id': 1 }` unique partial (`status ∉ {cancelled, rejected}`) | one active registration per user per form; also "am I registered" |
| `{ 'owner.id': 1, status: 1, submitted_at: 1 }` | participants list, waitlist order, CSV export |
| `{ 'user.user_id': 1, 'owner.type': 1, submitted_at: -1 }` | profile History section (Spec §5.3) |
| `{ 'owner.id': 1, 'context.event.team_visibility': 1, status: 1 }` | "users open to join" for team formation |
| `{ 'owner.id': 1, 'context.event.captain_application.status': 1 }` | Core reviewing captain applications |
| `{ 'owner.id': 1, 'context.event.role': 1 }` | auction: list members with base_price |

### 3.5 `form_uploads` — the server's record of a file answer

```ts
form_uploads { _id, user_id, form_id, field_key, url, name, size, mime, created_at }
// indexes: { url: 1 } unique; { user_id: 1, created_at: -1 } (per-user quota)
```

**Decision (Sep 26):** `files[]` used to be whatever the client sent — url, size and mime included — so a `javascript:` link, another user's upload or a 50 MB file claiming 10 bytes passed the field's `accept`/`max_size_bytes`. `POST /registrations/upload-file` now writes a `form_uploads` row; a submission names files by `{ field_key, url }` and everything stored is read from the upload row, which must be the same user's, for the same form and field (else `422 validation_failed / unknown_upload`). Files are **private**: written under `<uploadDir>/.private/registrations/` (a dot-directory Media Service's static `/uploads` never serves), referenced as `private://registrations/…`, and read back only through `GET /registrations/:id/files/:field_key` (the owner, or an admin of the owner). Registration Service is the only writer.

## 4. Domain events (Spec §8.1)

```
RegistrationCreated          { registration_id, owner, user_id, role }        // every entry into confirmed
RegistrationWaitlisted       { registration_id, owner, user_id, position }
RegistrationCancelled        { registration_id, owner, user_id, previous_status, status, freed_seat, reason }   // every exit from confirmed, and every cancel
CaptainApproved              { registration_id, event_id, user_id, approved_by }   // only once the captain holds a seat
ParticipantAttended          { event_id, registration_id, user_id, marked_by }     // attended → true
ParticipantAttendanceRevoked { event_id, registration_id, user_id, marked_by }     // true → false
FormPublished                { form_id, owner, version }
```

Consumers: Leaderboard (`RegistrationCreated` → solo entry; `RegistrationCancelled` → withdraw), Notification (`RegistrationCreated`, `RegistrationWaitlisted`), Points (`ParticipantAttended` → participation credit; `RegistrationCancelled` / `ParticipantAttendanceRevoked` → reversal), Event (`CaptainApproved` → `auction.captain_user_ids`; `RegistrationCancelled` → idempotent release, a safety net), Registration itself (`RegistrationCancelled { freed_seat }` → promote next). Points is **not** paid on `RegistrationCreated` (turning up, not signing up).

**Attendance (Sep 26):** marked by the Event Service's admin route, written here through `POST /internal/registrations/attendance { event_id, marked_by, attendances[] }` → `{ updated_count, skipped[] }`. Only `confirmed` rows of that event; each row flips by CAS on its previous value, so a resent batch publishes nothing twice. `ParticipantAttended` moved here from the Event Service with the same payload.

## 5. Read patterns

| Screen | Query |
|---|---|
| Event detail → registration form | `form_definitions.findOne({ _id: event.registration.form_id })` |
| Event detail → "am I registered" | `form_submissions.findOne({ form_id, 'user.user_id': me })` |
| Admin → responses table / CSV | `find({ 'owner.id': eventId }).sort({ submitted_at })` then flatten `answers` by field keys of each `form_version` |
| Admin → captain applications | `find({ 'owner.id', 'context.event.captain_application.status': 'pending' })` |
| Profile → History | `find({ 'user.user_id': me, status: 'confirmed' }).sort({ submitted_at: -1 })` |

## 6. Deferred

- Payment fields (`registration_cost` in Spec §4.1 Team) — no payment in MVP.
- Form field types `signature`, `rating`, repeating groups — add when an event needs them.
- Cross-field validation rules (e.g. "if role == member then base_price required") — handled in `context` code path for now, not in the generic engine.
