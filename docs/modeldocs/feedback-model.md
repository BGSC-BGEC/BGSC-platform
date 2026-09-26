# Feedback Model

**Owner service:** Feedback Service, :3011 (plan Week 4 Sunday, BE-2)
**Collections:** `feedback_tickets`, `feedback_throttle`
**Spec refs:** §4.1 `FeedbackTicket`, §5.12 Feedback & Contact Us (categories, severity, anonymous toggle, attachments, auto-reply with ticket ID, Submitted → Under Review → Resolved → Closed)
**MVP plan refs:** Week 4 Sunday BE-2 — feedback submission endpoint, contact-us form endpoint, categorization, email notification.

---

## 1. Purpose

One collection behind two front doors. A bug report and a contact-us message are the same shape —
a subject, a body, and a way to reply — with the same status ladder and the same staff inbox. `kind`
is the only thing that differs, and two collections would have duplicated all three.

`feedback_throttle` is bookkeeping, not domain: `POST /feedback` takes no token (Spec §5.12 marks
the page Public), so the only handle on a flood is the submitter.

**Ordering.** The inbox reads **newest first**, not worst first: `severity` is a string enum, and
Mongo sorts those alphabetically — `critical, high, low, medium` — which is the trap
`adding-a-service.md §9` already records for announcement priorities. Severity is a *filter* here
(`?severity=critical`), and a keyset cursor on `created_at` stays correct beside it. Ranking by
severity in the database needs a numeric rank on the document, and that is not worth adding until a
triage screen asks for it.

---

## 2. `feedback_tickets`

```jsonc
{
  _id: uuid,
  ticket_no: 'BG-7K3M2QXP',      // unique; what the auto-reply quotes
  kind: 'feedback' | 'contact',
  category: 'bug' | 'feature' | 'complaint' | 'general',
  severity: 'low' | 'medium' | 'high' | 'critical',
  subject: string,               // <= 140
  description: string,           // <= 5000
  attachments: string[],         // URLs only, <= 5
  event_id: string | null,

  is_anonymous: boolean,
  reporter: { user_id, display_name, avatar_url } | null,   // null iff is_anonymous
  contact_email: string | null,

  status: 'submitted' | 'under_review' | 'resolved' | 'closed',
  response: { body, by_user_id, at } | null,
  status_history: StatusHistoryItem[],
  created_at, updated_at
}
```

### 2.1 Field notes

| Field | Why |
|---|---|
| `ticket_no` | Spec §5.12 wants an auto-reply "with ticket ID", and a uuid is not something a person reads back. Eight characters of Crockford base32 with the vowels removed: nothing spells a word, nothing confuses `0/O` or `1/I/L`. It is also a **capability** — for an anonymous ticket it is the only way back in — so it is `randomInt`, not `Math.random`, and 2^40 wide |
| `is_anonymous` / `reporter` | Spec §5.12's toggle, enforced as an invariant: `reporter` is null **exactly when** `is_anonymous`. A signed-out submitter is anonymous by construction, whatever the flag says |
| `contact_email` | Required when anonymous — otherwise the receipt has nowhere to go. For an attributed ticket it defaults to the account's address |
| `severity` | The reporter's claim, and staff re-triage it (`PATCH /:ticket_no/severity`). A reporter's "critical" is a wish |
| `attachments` | URLs, never uploads — and refused unless they are `http(s)` or an `/uploads` path, the same rule `announcement.schemas.ts` applies to `media_url` |
| `status_history` | The shared `StatusHistorySchema`, as registrations and challenge participations use |

### 2.2 Invariants

- `reporter === null` ⟺ `is_anonymous`.
- `is_anonymous` ⇒ `contact_email` is set.
- at most 5 attachments.
- the ladder moves along `FEEDBACK_TRANSITIONS`, which is forward-only except `resolved → under_review`
  and `closed → under_review`: **a disputed resolution has to be reopenable**, or the ticket system
  is a way of closing conversations rather than having them.

### 2.3 The anonymity promise

An anonymous toggle that quietly keeps the submitter's id is worse than no toggle, because the
person believed it. So on that path:

- no `reporter` on the ticket;
- the audit row carries `actor_id: null` **and `ip: null`** — `AuditLog` has an address column, and
  writing it there would undo the promise one table across;
- `GET /feedback/me` lists attributed tickets only, so nothing re-attaches it later;
- the only trace is the rate limiter's one-way hash (§3).

### 2.4 Indexes

| Index | Serves |
|---|---|
| `{ ticket_no: 1 }` unique (from the field) | the quoted id, and the anonymous bearer lookup |
| `{ status: 1, severity: 1, created_at: -1 }` | the staff inbox, filtered by status and severity |
| `{ 'reporter.user_id': 1, created_at: -1 }` | "my tickets" |
| `{ kind: 1, category: 1, created_at: -1 }` | the inbox filters |
| `{ event_id: 1, created_at: -1 }` | complaints about one event (declared `sparse`, which excludes nothing: `event_id` is stored as `null`, not omitted) |

---

## 3. `feedback_throttle`

```jsonc
{ _id: uuid, subject_key: 'user:<id>' | 'ip:<sha256>', created_at, expires_at }
```

One row per submission, counted over the last hour, capped at `FEEDBACK_RATE_PER_HOUR` (5).

The address is **hashed with the JWT secret as the key**, never stored raw: it is only ever compared
for equality, a raw-IP column on an anonymous feedback form is a liability nobody asked for, and
keying the hash stops it being reversed with a list of every address on the internet. TTL'd at an
hour, because a rate limit has no memory worth keeping.

Indexes: `{ subject_key: 1, created_at: -1 }` for the count, `{ expires_at: 1 }` TTL for the sweep.

---

## 4. Domain events

Emitted:

```
FeedbackSubmitted      { ticket_id, ticket_no, kind, category, severity, subject }
FeedbackStatusChanged  { ticket_id, ticket_no, from, to }
FeedbackResponded      { ticket_id, ticket_no, reporter_user_id, responded_at }   // attributed tickets only
```

`responded_at` is the ISO timestamp the reply was stored with (`response.at`). Notification keys its
dedupe on it; reading `response.at` at consume time let two quick replies collapse into one notice.

`FeedbackSubmitted` exists so staff can be told in-app without this service learning who staff are —
the Notification Service already knows how to fan out to a role floor (`notification-model.md §4`).

Consumed:

```
UserProfileUpdated { user_id, changed_fields }  → rename the reporter snapshot
UserDeleted        { user_id }                  → erase it (relationships.md §4.1) and null contact_email (the account's own address);
                                                  only while the account is deleted NOW — a late copy after UserRestored is a no-op
UserRestored       { user_id }                  → re-snapshot with deleted: false; refill contact_email from users where it was nulled
```

An anonymous ticket has no reporter, so it has nothing to rename and nothing to erase — which is
the one case where these consumers do nothing, and the point of the toggle.

---

## 5. Deferred, with the ceiling named

| Deferred | Why / upgrade path |
|---|---|
| Real email | There is no SMTP provider anywhere in this repo; `mailer.ts` is dev-console + prod stub, the same shape as `auth-service`'s. When a provider lands, one module replaces two |
| Attachment upload | Media Service, BE-1's Week 4 Saturday task |
| Contact directory, FAQ (Spec §5.12) | Not in the MVP plan's bullets; the directory is a PII policy decision for the spec owner |
| Assignment / ownership of a ticket | Spec does not model a triage queue beyond status. `status_history` records who moved it |
| Reporter-visible threading | One `response` field, not a conversation. A second exchange is an email reply today |
