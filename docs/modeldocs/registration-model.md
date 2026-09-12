# Registration Model (Common Registration Service)

**Owner service:** Registration Service
**Collections:** `form_definitions`, `form_submissions`
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

  user: { user_id: string, display_name: string, avatar_url: string | null },   // snapshot

  answers: Record<string, unknown>,   // key -> value, validated against form fields at form_version
  files: { field_key: string, url: string, name: string, size: number, mime: string }[],

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
      attended: boolean | null                             // plan Week 2 "attendance tracking"
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
| draft → submitted | now within the owner's window (`events.registration.opens_at..closes_at`, or `challenges.window`); all `required` fields present; answers pass validation; unique index passes |
| submitted → confirmed | if `events.registration.requires_approval == false`: automatic, in the same request. Else Core+ approves. Either way a seat must be reserved first (§3.2) |
| submitted → waitlisted | seat reservation failed and `waitlist_enabled` |
| waitlisted → confirmed | Registration Service consumes its own `RegistrationCancelled` for the owner, reserves a seat, promotes lowest `waitlist_position` |
| * → cancelled | by user before `closes_at`, or by Core+ any time. Captain cancelling: blocked while their team has other members (transfer captaincy or disband first) |
| * → rejected | Core+ |

`confirmed` is the only state that counts as "registered" for points, leaderboard, and teams. `RegistrationCreated` is emitted on **every** entry into `confirmed`, including waitlist promotion.

### 3.2 Capacity + duplicate safety

Order matters so the common failure (duplicate) never needs compensation:

```
1. insert form_submissions { status: 'submitted' }         ── unique index rejects duplicates here, nothing else touched
2. Event Service reserve seat (sync HTTP in MVP):
     findOneAndUpdate({ _id, $or: [{ 'registration.max_participants': null },
                                   { $expr: { $lt: ['$counts.registrations_confirmed', '$registration.max_participants'] } }] },
                      { $inc: { 'counts.registrations_confirmed': 1 } })
     no match ⇒ step 3b
3a. status → confirmed, emit RegistrationCreated
3b. status → waitlisted (or rejected if !waitlist_enabled), emit RegistrationWaitlisted
```

- Duplicate guard: unique index `{ form_id: 1, 'user.user_id': 1 }` partial on `status ∉ {cancelled, rejected}`. The DB, not the app.
- Capacity guard: the `findOneAndUpdate` above is atomic; no over-booking. Cancel of a `confirmed` row does the mirror `$inc: -1`.
- ponytail: sync call instead of saga; move to an event-driven reservation if the services split databases and latency bites.

### 3.2.1 Invariants

- `owner.type == 'event'` ⇒ `context.event` present, `context.challenge` absent (and vice versa)
- `context.event.role ∈ {captain, member}` ⇒ owner event `teaming.is_teamed == true`; `role == 'solo'` ⇔ not teamed
- owner event `type == 'ALL'` and `role == 'member'` ⇒ `base_price != null && > 0` (Spec §5.5)
- `events.teaming.captain_application_required` and `role == 'captain'` ⇒ `captain_application.status == 'approved'` before a team can be created
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

Errors returned as `{ field_key, code, message }[]`.

### 3.4 Indexes

| Index | Serves |
|---|---|
| `{ form_id: 1, 'user.user_id': 1 }` unique partial (`status ∉ {cancelled, rejected}`) | one active registration per user per form; also "am I registered" |
| `{ 'owner.id': 1, status: 1, submitted_at: 1 }` | participants list, waitlist order, CSV export |
| `{ 'user.user_id': 1, 'owner.type': 1, submitted_at: -1 }` | profile History section (Spec §5.3) |
| `{ 'owner.id': 1, 'context.event.team_visibility': 1, status: 1 }` | "users open to join" for team formation |
| `{ 'owner.id': 1, 'context.event.captain_application.status': 1 }` | Core reviewing captain applications |
| `{ 'owner.id': 1, 'context.event.role': 1 }` | auction: list members with base_price |

## 4. Domain events (Spec §8.1)

```
RegistrationCreated    { registration_id, owner, user_id, role }        // on every entry into confirmed
RegistrationWaitlisted { registration_id, owner, user_id, position }
RegistrationCancelled  { registration_id, owner, user_id, reason }
CaptainApproved        { registration_id, event_id, user_id }           // Event Service copies to auction.captain_user_ids
FormPublished          { form_id, owner, version }
```

Consumers: Points (`RegistrationCreated` → participation points), Event (`counts`, captain list), Notification, User (history).

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
