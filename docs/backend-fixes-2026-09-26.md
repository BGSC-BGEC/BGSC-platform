# Backend fixes — audit #1 (Sep 26, 2026)

One line per bug fixed. Source: `docs/backend-audit-2026-09-26.md`. Done by BE-2 with BE-1's agreement.

## Shared (lead)
- shared: internal calls read the `{success,data}` envelope raw → `callInternal` helper unwraps + types failures.
- shared: envelope skipped bodies with any `success`/`error` key → only real envelopes skipped.
- shared: escaped ZodError answered 500 → 422 `validation_failed`.
- shared: malformed `%` in a path param answered 500 → 400 `bad_request`.
- shared: every service built all 27 models' indexes → `models:` option builds only owned ones.
- shared: four services wrote private upload dirs → one `config.uploadDir` for the platform.

## Gateway
- gateway: strict login limit bypassed via `/auth/Login` or trailing slash → paths normalised.
- gateway: strict list had dead paths, missed OTP/resend routes → corrected.
- gateway: successful logins used up the 5/15min bucket → successes free, keyed IP+login, 30/IP ceiling.
- gateway: `/gateway/services` exposed internal topology publicly → coordinator only.
- gateway: no production secret check → runs at start.
- gateway: `/INTERNAL/...` case variants → blocked.

## Shared / event bus
- bus: any Redis message trusted (forged points possible) → HMAC-signed, unsigned dropped.
- bus: one throwing listener starved the others → listeners isolated.
- bus: own events could double-deliver after outage → per-process instance id.
- guard: prod allowed default Mongo password / password-less Redis → refused.
- requireActiveUser: uncalled mount threw 500 → defaults to guest floor.
- requireSelfOr: unknown role admitted everyone → throws at boot.
- AuditLog: `save()`/`bulkWrite` could rewrite history → blocked.

## Docker / compose
- compose: Mongo, Redis, mongo-express open to network → bound to 127.0.0.1.
- compose: Redis had no password → `requirepass`, all `REDIS_URL`s carry it.
- compose: event-service missing `CORS_ORIGIN` → added.
- compose: event-service couldn't reach registration-service → URL + depends_on added.
- compose: uploads written outside volumes → one `uploads` volume at `/app/uploads`.
- docker: nested `uploads/` leaked into build context → ignored.
- docs: README/dev guide stale → updated for 12 services and new conventions.

## Challenge + Strava
- challenge: PATCH wiped defaulted fields → default-free update schema, nested merges.
- challenge: team member could also accept solo (paid twice) → overlap guard.
- challenge: drafts visible below Core → list 403, detail 404.
- challenge: accept allowed after `submissions_close_at` → 409.
- challenge: solo+team shared one counter across two caps → teamed challenges are team-only.
- challenge: `max_files:0` with proof required = uncompletable → 422.
- challenge: `javascript:` URLs accepted → http(s) only.
- challenge: rejected resubmit auto-approved after toggle → routed to review.
- challenge: double first-submit double-counted → CAS, version `$inc`.
- challenge: approved no-proof rows stopped paging → page by `accepted_at`.
- challenge: submit/accept trusted token role → `requireActiveUser`.
- challenge: restored users stayed "Deleted user" → `UserRestored` consumer.
- challenge: leaderboard wrote our participations → consume `HallOfFameEntryCreated`.
- challenge: tags lowercase / proof_types enum not enforced by model → fixed on elements.
- strava: link CSRF (attacker binds victim's Strava) → callback writes nothing; `POST /strava/link` by same user.
- strava: followers-only activities treated public → only `everyone` is public.
- strava: other-user feed ignored privacy/deleted → 404.
- strava: upstream auth failure answered 401 → 409 `strava_reauth_required`.
- strava: `/connect` 302 unusable from apps → returns `{url}`.
- strava: disconnect 500 on unreadable token → fixed.
- strava: disconnect/deletion left tokens + activities → purged.
- strava: granted scope never stored → stored; missing scope 409.
- strava: concurrent refresh clobbered tokens → CAS.
- strava: sync racing disconnect → 404, orphans removed.
- strava: `StravaActivitySynced` on every rewrite → only real inserts.

## Announcement + Notification
- notification: WhatsApp 1/tag/hour beaten by concurrency → atomic per-tag slot.
- notification: failed send kept the tag's hour → slot released.
- notification: per-user notices ignored mutes → mute checked.
- notification: empty rejection reason crashed the notice → "not stated".
- notification: second rejection silently deduped → key per rejection.
- notification: `user`-only announcements went to public WhatsApp → public floor is guest.
- notification: every 4xx writeback dropped forever → only 404/409 permanent.
- notification: writeback leaked phone destination → masked; scrubbed from errors.
- notification: interrupted 5th attempt stuck "pending" → closed as failed.
- notification: one throwing attempt killed the sweep → per-item isolation.
- notification: delete/edit mid-delivery left orphan/stale cards → re-check after delivery.
- notification: deletes missed during bus outage never retracted → retraction sweep.
- notification: reconcile page filled by finished items → only unfinished counted.
- notification: cancelled-event notice skipped waitlisted → included.
- notification: duplicate confirm events → single `RegistrationCreated` card.
- announcement: out-of-order receipts overwrote newer → revision-guarded.
- announcement: concurrent receipts lost one → retried.
- announcement: pin edit racing publish slipped past check → re-checked, 422.
- announcement: restored authors stayed "[deleted]" → `UserRestored` consumer.
- announcement: profile event could un-anonymize deleted user → skipped.
- announcement: tags lowercase ignored by model → fixed.
- announcement: e2e shared DB with user-service → own scratch DB.

## Feedback
- feedback: signed-in anonymous ticket traceable via `user:<id>` throttle → hashed IP.
- feedback: IPv6 rotation bypassed throttle → /64 normalised.
- feedback: signed-in `contact_email` could target anyone → account email only.
- feedback: CR/LF in subject (mail header injection) → stripped.
- feedback: deleted user's email stayed on tickets → nulled; restored on `UserRestored`.
- feedback: prod log paired ticket no. with email → address dropped.

## Bracket
- bracket: correction racing downstream report → undone, 409.
- bracket: correcting completed bracket silent → re-emits `BracketCompleted` (corrected).
- bracket: delete guard check-then-act → atomic claim.
- bracket: draft vs missing event distinguishable → same 404.
- bracket: duplicate solo registrations → 500 → deduped.
- bracket: participant names never refreshed/restored → consumers added.

## Media
- media: files outside volume → shared upload dir.
- media: pending/rejected files publicly served → held in `.pending/`, moved on approve, deleted on reject.
- media: hidden items / private albums readable → 404.
- media: likes only ever +1 → one per user, real toggle.
- media: bad query/body → 500 → 422.
- media: upload trusted token role, took any type → live role, media types only.
- media: 50MB buffered before size check → Content-Length pre-check.
- media: uploader name was a uuid → real snapshot.
- media: `event_id` used as raw path segment → uuid, must exist.
- media: album slug races/empty slugs → 500 → suffix/409/422.
- media: duplicate event albums, uuid titles → one per event, real title.
- media: owner edits after approval stayed approved → back to pending.
- media: unbounded tags → capped.
- media: `media_count` counted pending, private albums open → fixed.
- media: deleted users shown by literal name → `anonymizedSnapshot`, restore consumer.

## Event
- event: PATCH applied every default and wiped the event → default-free schema, `$set` sent keys only.
- event: any status jump allowed, no CAS → transition map + compare-and-swap.
- event: any core admin could cancel → coordinator+; cancel closes running auction.
- event: past/cancelled events editable → 409 `event_is_terminal`.
- event: PATCH trusted token; `core_admins` took any account → live role; core+ only.
- event: anyone could replace an event's cover/logo → event admins only.
- event: seat reserve non-idempotent, waitlist inverted → `seat_holders`, contract reasons.
- event: seats reservable on drafts / before opening → refused.
- event: waitlisted counter drifted → derived from registrations.
- event: attendance + promotion wrote registration data directly → registration internal endpoints.
- event: captain approval put auction on league events (bricked saves) → ALL events only.
- event: raw regex search (500/ReDoS) → escaped, capped.
- event: bad dates/cursor 500s, page 2 dropped search → validated, `$and`.
- event: unlisted events in public lists → admins only.
- event: `?status=` exposed rejected participants → confirmed only for non-admins.
- event: invalid create input → 500 → 422.
- event: slug check ignored deleted events → covered, retried.
- event: rejected users counted as registered → excluded.
- event: stats/waitlist/attendance loaded every row → aggregates.
- event: `EventCompleted` lacked title → added.
- event: nothing started due events → scheduler, once each.
- event: tags never lowercased → fixed on model.
- event: restored/renamed users stale on contacts & lots; deleted contact detail kept → consumers fixed.
- auction: lot sold from stale read, no timer check → version CAS + server timer.
- auction: fallbacks wrote teams directly → `callInternal` with lot-keyed request ids.
- auction: unknown registration outcome → rollback, 503, safe replay.
- auction: refused debit wedged lot → marked unsold.
- auction: failed player add left purse charged → refunded.
- auction: any core could run any auction → event admins only.
- auction: config changeable mid-auction → frozen once live.
- auction: resume / new lots never put a lot on the block → fixed.
- auction: close stranded a lot, double `AuctionClosed` → fixed.
- auction: start had no CAS, wrote teams → registration endpoint + CAS.
- auction: budget override wrote teams → registration endpoint.
- auction: `createLots` 500s, no checks → validated, 409 on duplicates.
- auction: override quota 0 became 3/7; config max 1 → fixed.
- auction: prices changeable on live/sold lots → queued only.
- auction: live cache stale via slug → all aliases invalidated.
- auction: public reads exposed draft events → 404.
- auction: bids trusted token, allowed on inactive events → live user, refused.

## Auth
- auth: refresh tokens bcrypt-hashed (72-byte truncation, unrevocable) → sha256 + `jti`, timing-safe compare.
- auth: parallel refreshes both won → CAS rotation; replayed token ends session.
- auth: Google linked accounts by unverified email → `verified_email` required, no re-linking.
- auth: OAuth state not tied to browser (login CSRF) → nonce cookie.
- auth: tokens in OAuth redirect URL → one-time `login_code` exchange.
- auth: OTP limit bypassed via resend / parallel → atomic attempts, not reset.
- auth: login leaked account status + existence timing → password first, dummy bcrypt.
- auth: reset/verify tokens stored plaintext → sha256, single use.
- auth: verify-email link logged user in → verify only.
- auth: reactivate lifted a suspension → prior status restored; suspended refused.
- auth: restore audit had no rollback/ip → claim-audit-rollback, ip recorded.
- auth: register/Google races 500 → 409; Google profile without email → 401.
- auth: phone OTP routes accepted dead sessions → live user required.
- auth: OTP could never be 999999 → range fixed.
- gateway: `/auth/google/exchange` added to strict limiter.

## User
- user: delete-then-reactivate escaped suspension → prior status kept.
- user: role/status audited before write, no CAS → claim-audit-rollback with CAS.
- user: coordinator could suspend a peer → must strictly outrank target.
- user: phone PATCH raced OTP verification → verified badge dropped on change only.
- user: search exposed private profiles by full name → public profiles only.
- user: profiles/player cards readable anonymously → auth required; private = stub.
- user: wrong-type cursor → 500 → 422.
- user: audit view 404'd deleted accounts → included.
- user: dead sessions got 403 with reason → 401.
- user: unsuspend mislabelled, no event → correct action + `UserEnabled`.
- user: update mid-deletion → 500 → 401.
- user: rating cache did `save()` on GET → single-field update.
- user: avatars on private disk, self-served → shared upload dir via media.
- user: dead snapshot route returned deleted users un-anonymised → removed.
- user: e2e shared DB with announcement → own scratch DB.

## Points
- points: refund route minted points for any request id → must match the real spend.
- points: compensation + cancel sweep could both refund one spend → one shared key.
- points: debits accepted on non-ongoing events → 409.
- points: ledger rows rewritable via `save()`/`bulkWrite` → blocked.
- points: adjust replay with different user/amount silently "replayed" → 409.
- points: podium place shareable, non-participants payable → refused.
- points: zero pool gave misleading `rule_disabled` → 422 `event_pays_no_podium`.
- points: final podium never paid automatically → paid from `LeaderboardFrozen`.
- points: attendance credited cancelled/waitlisted → confirmed only.
- points: un-marked attendance kept credit → reversed on `ParticipantAttendanceRevoked`.
- points: expiry sweep stuck on first 200 rows → keyset cursor.
- points: expiry took newer points, re-expired reversed credits → FIFO-capped, skipped.

## Leaderboard + Hall of Fame
- leaderboard: timeout fallbacks wrote balances/ledger directly (double debit) → `callInternal` only, no fallback.
- leaderboard: upstream 401 shown to members → 503.
- leaderboard: refunded even after investment landed → only when it didn't.
- leaderboard: investment cap raceable → cap in the update filter.
- leaderboard: eliminated entries accepted investment → 409.
- leaderboard: invest trusted token → live user.
- leaderboard: late recompute reopened final board → no-op once final.
- leaderboard: scores/invest accepted on final board → refused.
- leaderboard: stale recompute overwrote investments → serialized, derived in-update.
- leaderboard: unscored entries skewed normalization → scored only.
- leaderboard: raw scores kept old weights → recomputed.
- leaderboard: scores minted entries for anyone → registered/locked-team only, validated first.
- leaderboard: event cancel deleted entries (refunds lost) → freeze only.
- leaderboard: final freeze had no podium → podium payload.
- leaderboard: below-threshold freeze spammed → once per transition.
- leaderboard: global board kept reversed credits → netted.
- leaderboard: cache vs DB tie order differed → aligned.
- leaderboard: raw regex search (500/ReDoS) → escaped, capped.
- leaderboard: `TeamLocked` no-op, forming teams ranked → built on lock only.
- leaderboard: pre-start decided by date → by status; invested entries kept.
- leaderboard: cancels after completion changed the final → ignored.
- leaderboard: profile refresh on every edit → gated.
- leaderboard: hand-rolled deleted snapshots → `anonymizedSnapshot` + flag; restore clears.
- leaderboard: wrote challenge participations → publishes `HallOfFameEntryCreated`.
- hall of fame: every write returned 500 → guard called properly.
- hall of fame: slug collisions 500 → retry / 409.
- leaderboard: global board lagged points by up to 10 min → evicted on points events (5s debounce).

## Registration + Teams
- registration: event replies read raw envelope → every registration rejected (C1) → `callInternal`, correct reason mapping.
- registration: status changes read-then-save (double release/promote) → CAS on previous status.
- registration: captain approval revived cancelled rows / double-reserved → requires pending + submitted.
- registration: `CaptainApproved` fired without a seat → only when confirmed.
- registration: waitlist promotion not exclusive → reserve then CAS; loser releases.
- registration: `freed_seat` sent after failed release → only on confirmed release.
- registration: lost reserve stranded rows as `submitted` → resubmit retries; cancel releases.
- registration: admin demotion published nothing → publishes cancel, frees seat, leaves team.
- registration: reviving rejected row 500'd, leaked seat → 409, seat released.
- registration: second published form = second seat → must be the event's form.
- registration: admin-rejected users could re-register → 409.
- registration: `files[]` trusted from client → must reference user's own upload record.
- registration: uploads unbounded, any form/field → published form, admin fields admin-only, rate-limited.
- registration: hidden fields could still control visibility (required skipped) → dependency order, coerced values.
- registration: admin regex could hang service (ReDoS) → checked at save, length cap, 50ms timeout.
- registration: invalid pattern → every submission 500 → 422 at save.
- registration: loose types (false consent, whitespace, Infinity, `javascript:`) → strict.
- registration: `constructor` field key read prototype → own properties only.
- registration: hidden fields' files stored unchecked → dropped.
- registration: edits validated against draft v2 → row's own version; archived refused.
- registration: files-only edit blocked by admin fields → held aside.
- registration: `closes_at` edit window ignored → enforced.
- registration: bad form input 500'd and bricked the form → 422, archive upsert.
- registration: archived forms editable / silently republished → 409.
- registration: forms leaked admin-only fields and drafts → stripped/hidden.
- registration: 400 for validation, 403 leaking existence → 422, 404.
- registration: admin branches trusted token → live user.
- registration: unpaginated lists → limit/offset.
- registration: private upload dir + static mount → shared upload dir.
- registration: selfchecks wrote to `bgsc_dev` → scratch DB, real envelope stub.
- teams: invites seated users without consent → pending until they join; `closed` refused.
- teams: join / one-team-per-user raceable → membership claim + conditional push.
- teams: challenge captain could be on two teams → same claim.
- teams: event team size hardcoded 1–10 → from event.
- teams: bad sizes / duplicate names → 500 → 409.
- teams: cancelled members stayed on roster → removed.
- teams: lock/disband not atomic, `TeamLocked` lacked owner → CAS, owner added.
- teams: purse ops not idempotent, refunds clamped → request ids, 409s.
- internal: added attendance/promote/purses/budget endpoints; removed dead confirm/snapshot routes.
- registration: restored users stayed "Deleted user" → `UserRestored` consumer.

## Seam re-check (after fixes)
- event: late `RegistrationCancelled` could strip a re-confirmed seat → skipped if row confirmed.
- event: upstream token refusal shown to user as 401 (logout) → 503.
- leaderboard: lost `HallOfFameEntryCreated` never re-sent → replay re-announces.
- points: attendance-revoked reversal labelled "registration_cancelled" → "attendance_revoked".
- registration: teamed events never ranked until admin locked every team → ready rosters lock on `EventStarted`.

## Deliberately left (with `ponytail:` notes in code)
- auction: quota checks for price/budget overrides are check-then-write (concurrent overrides can exceed quota).
- auction: pause doesn't stop the timer; resume resets it.
- registration: waitlist position number is read-max+1, so two simultaneous waitlistings can share one; promotion order is `waitlist_position`, then `submitted_at` (the tie-break).
- teams: no decline/revoke route for pending invites (they expire after 72h).
- auth: one active session per account.
- event: events created before this change have empty `seat_holders` → backfill from confirmed registrations, or wipe dev DB.

## Frontend / client changes these fixes require
- auth: Google sign-in returns `login_code` → `POST /auth/google/exchange`; verify-email no longer logs in; don't refresh tokens in parallel; everyone re-logs in once after deploy.
- users: `/users/:ref` and player card need a token.
- strava: `/strava/connect` returns `{url}`; finish with `POST /strava/link {code,state,scope}`; handle `strava_reauth_required` / `strava_scope_insufficient` / `oauth_state_mismatch`.
- challenges: teamed challenges are team-only (`409 team_required` for solo).
- teams: invites are pending until the invitee calls `POST /teams/:id/join`.
- registrations: `files[]` entries come from the upload response; validation errors are 422.
- events: `counts.registrations_waitlisted` removed (use `/participants/stats`); `type`/`auction` not editable via PATCH; cancel needs coordinator+.
- media: uploads need `Content-Length` and a media content type; like returns `liked`; delete returns `{id, deleted}`.
- brackets: `GET /matches` for a draft event → 404 `event_not_found`; `BracketCompleted` may repeat with `corrected:true`.
- all: every file URL is served under `/uploads/...` by media-service.

## Ops
- Redis now needs a password: set `REDIS_PASSWORD` in `.env`; recreate containers (`docker compose up -d mongodb redis`). (Audit #2: the password no longer goes inside `REDIS_URL`.)
- Mongo/Redis/mongo-express ports now bind to 127.0.0.1 only.
- All services must share one `INTERNAL_API_TOKEN` (event bus is signed with it).

---

# Audit #2 fixes (Sep 26)

Source: `docs/backend-audit-2-2026-09-26.md`. Owner decisions: mail stays dev-logger (launch blocker), WhatsApp + push deferred to post-MVP, founder via `npm run seed:founder`, many manual albums per event, announcement edit = author or outranking, attendance only while an event is running.

## Shared (lead)
- shared: "event admin" checked differently per service (or not at all) → one `isEventAdmin` / `requireEventAdmin`.
- shared: unreadable 2xx internal reply treated as null success → outcome-unknown error.
- shared: internal 422 field details dropped → carried through.
- shared: every service still auto-built every model's indexes → `autoIndex` off; owned models only.

## Challenge + Strava (audit #2)
- challenge: lost `ChallengeCompleted` never replayed → 5-min sweep republishes unpaid approvals.
- challenge: lost legend/HoF event never retried → sweep reads HoF back or republishes.
- challenge: review 403 to non-reviewers (existence leak) → 404.
- challenge: rejection notices couldn't tell repeats apart → `rejection_no` in payload.
- challenge: profile refresh / replayed deletion could un-anonymize or re-anonymize wrongly → guarded.
- strava: sync unthrottled, suspended users allowed → 5-min cooldown, live user.
- strava: OAuth code in redirect query, refused codes stayed usable → fragment; refused codes revoked.
- strava: relink kept old athlete's activities/watermark → unlink first.

## Auth + User (audit #2)
- auth: Google sign-in linked into unverified account, squatter kept password → credentials cleared on link, audited.
- auth: old device's refresh replay logged out all devices → session families (`sid`).
- auth: login could survive a concurrent password reset → session write pinned to password hash.
- auth: login code outlived a suspension; reactivate raced reset → conditional writes.
- auth: legacy deletions restored as active (lifting suspensions) → prior status from audit, else admin review.
- auth: email/phone on the event bus → user id only.
- auth: prod mailer logged recipient address → user id.
- auth: Google return path unvalidated (open redirect) → relative paths only.
- auth: Google signup username race → retried.
- auth: lost `UserRestored` never re-sent → 5-min replay sweep (7 days).
- user: suspended user could self-delete into limbo → refused.
- user: PII visibility used token role → live role.
- user: lost `UserDeleted` never re-sent → 5-min replay sweep (7 days).
- user: no way to create first founder → `npm run seed:founder` (FOUNDER_EMAIL), audited, one-time.

## Event + Auction (audit #2)
- event: draft couldn't exist without a form (creation deadlock) → drafts may have none.
- event: event went live pointing at missing/foreign/draft form → form validated on publish and change.
- event: eligibility said "eligible" without a usable form → refused.
- event: no lifecycle timestamps for replay → `started_at`/`completed_at`/`cancelled_at`.
- event: scheduler would start long-ended events; no boot tick → `end_at` bound, boot tick.
- event: attendance markable outside the event → only while running (409 otherwise).
- event: captain approval after registration close rejected the captain → seats pre-close registrations.
- event: cancel left an on-block lot sellable → closed unsold.
- event: captain list showed deleted users' names → anonymized.
- event: `rules_pdf_url` accepted `javascript:` → http(s)/uploads only.
- event: concurrent nested PATCHes lost updates → dotted-path `$set`.
- event: cancelled captains kept bidding → removed from captain pool.
- auction: lot marked sold before charging → `settling` state, replayable.
- auction: purse keys per lot (wrong team refunded) → per lot + team.
- auction: token refusal made lots permanently unsold → treated as unknown, retried.
- auction: expired lots needed manual advance → auto-settle tick.
- auction: locked teams / unconfirmed captains could bid → refused.
- auction: new lot could open while one settling → one active lot per event.
- auction: failed batch left partial lots; duplicate orders → cleaned up, unique order.
- auction: budget preview open to any core; draft lots 403 → admin only; 404.
- auction: repeated identical budget override 409 → 200.

## Announcement + Notification (audit #2)
- notification: WhatsApp timeout/5xx resent (duplicate group post, cap broken) → terminal `outcome_unknown`, slot kept.
- notification: crash after send could resend → `sending_at` marker, never re-sent.
- notification: WhatsApp/push deferral silent → boot log + note.
- announcement: any core could edit anyone's post → author or strictly higher rank.
- notification: dismiss deleted the dedupe row (cards came back) → `dismissed_at`.
- notification: re-confirmed registration got no card → per-confirmation key.
- notification: repeat rejections collapsed → keyed on `rejection_no`.
- announcement: raw WhatsApp destinations on old announcements → masked at boot.
- notification: cards sent to deleted/suspended users → live accounts only.
- announcement: profile refresh could touch anonymized rows → guarded.
- notification: team invites, player sales, feedback replies had no notice → new cards.

## Shared + Gateway + Infra (audit #2)
- redis: password inside `REDIS_URL` crash-looped on special chars → sent separately (`REDIS_PASSWORD`).
- bus: bad Redis URL threw at boot → bus disabled with a log line.
- bus: token rotation dropped in-flight events → previous key accepted for verification.
- gateway: chunked/gzip login answered 400 → stale encoding headers removed.
- gateway: junk `login` field reset per-account limit → each route keys on the field it reads.
- gateway: successful signups counted toward the per-IP ceiling (campus NAT) → failures only.
- gateway: MaxListeners warning at boot → raised to fit the proxies.
- compose: missing `CORS_ORIGIN` silently defaulted to localhost → required.
- compose: auth-service lacked Google / frontend URLs → passed through.
- ops: no founder bootstrap → `npm run seed:founder`.
- ops: no upgrade path for non-wiped DBs → `npm run migrate:audit2` (dry-run default, idempotent, tested); also drops audit #1's too-broad album index.
- migrate: duplicate lot `order` values sent lots to the queue end → renumbered in place, relative order kept.
- migrate: extra `settling` lot only reported → re-queued like any extra active lot, logged "!!" for a purse check.
- docs: README / dev guide / adding-a-service updated (Redis password, autoIndex, event-admin, attendance window, replay sweeps, upgrade checklist).

## Feedback + Bracket + Media (audit #2)
- feedback: throttle beaten by parallel submits → insert-first, count, roll back.
- feedback: staff view trusted token role → live user.
- feedback: anonymous receipt echoed subject to any address → subject dropped.
- feedback: signed-in reporter never told of a reply → `FeedbackResponded` event.
- feedback/bracket/media: late profile events could restore deleted names → guarded.
- bracket: report/delete race left brackets never completed; crashed delete stuck in draft → completion re-run, stale claims released.
- bracket: correction CAS pinned only status → pins participants and loaded score.
- bracket: identical re-report treated as correction → no-op.
- bracket: 403 before draft visibility (existence leak) → 404.
- media: one-album-per-event blocked manual albums → only system album unique.
- media: private-album items in the public gallery → excluded.
- media: no uploader quota → 20 pending / 200MB / 30 per hour.
- media: any core could create albums for any event; draft event ids accepted → event admin only.
- media: approving a missing file, approve/delete and edit/approve races → 409 / claimed / file follows row.
- media: like and album counts drifted → recounted.
- media: gallery files cached immutable 7 days → 5 minutes.

## Registration + Teams (audit #2)
- registration: any core acted on any event's forms/rows/teams → event-admin scope on live actor.
- registration: admins could set admin-only fields on own row → separate owner-admin `PATCH /registrations/:id/admin-answers`.
- registration: admin list returned every registration → needs `owner_id`/`form_id` the caller administers.
- registration: others' rows readable/cancellable → owner or owner-admin, else 404.
- registration: rejected user could cancel own rejected row → 409 `registration_rejected`.
- registration: losing concurrent admin confirm freed winner's seat → re-read, release only if unconfirmed.
- registration: `CaptainApproved` only on immediate seat → every path confirming an approved captain.
- registration: demoted row promoted itself back → promotion skips departing row.
- registration: single promote attempt, deleted users promoted → up to 10 tries, deleted rows cancelled.
- registration: freed seats stayed free after a missed event → 5-min promotion sweep.
- registration: rosters never locked → lock on `EventStarted` (or `AuctionClosed` for leagues) + sweep.
- registration: files public under `/uploads` → `.private/`, served by authed `/registrations/:id/files/:field_key`.
- registration: add-member repeat 409'd → `request_id` recorded with `$push`, repeats 200.
- registration: event-service 401/403 read as refusal → 503.
- registration: `RegistrationCancelled` lacked `role` → added.
- registration: 422 submits free to spam → 20/min per user.
- registration: UserDeleted left email/phone answers → scrubbed.
- registration: late profile events rewrote deleted users' names → guarded.
- registration: legacy files rejected on edit; stored dates failed re-validation → accepted.
- registration: upload quota count-then-insert, body buffered first → precheck, insert-then-count.
- forms: event forms without the event / non-admin → event must exist, caller its admin.
- forms: drafts and admin-only fields leaked → admins of owner only.
- forms: catastrophic regexes (alternation in repeats), 50ms per field → refused at save; 100ms per request.
- forms: concurrent saves lost updates → optimistic concurrency, 409 `form_changed`.
- teams: expired invites blocked re-invites → cleared; `GET /teams?invited=me` lists live invites.
- teams: `TeamInviteCreated` payload mismatch → exactly what notification reads.
- teams: detach used stale `team_id` → found by `members.registration_id`.

## Points + Leaderboard + Hall of Fame (audit #2)
- points: two same-key `record()` calls both moved balance → key claimed first (`point_tx_claims`), loser replays.
- points: failed-credit compensation could go negative → guarded like a debit.
- points: refunds under retired keys not recognised → all three formats read.
- points: late spend after a "nothing to refund" answer → spend key voided, 409 `request_voided`.
- points: spend landing after cancel sweep stayed debited → re-checked, refunded.
- points: `/award` had no event scope → event admin only.
- points: admin award could pre-empt final standings → 409 `podium_mismatch` once final exists.
- points: podium conflicts only logged → audit row, shown in event-ledger read.
- points: attendance credited without `attended:true` → required, reversed if revoked meanwhile.
- points: missed `EventCancelled`/attendance/cancellation/revocation messages lost → 5-min replay sweep, 7-day window, paged to the end; a failing row is logged, not fatal.
- points: expiry FIFO counted refunds/reversals as fresh points → excluded.
- ledger: history rewritable via `save()`/bulk ops → append-only guard.
- leaderboard: any core could score any event → event admin only.
- leaderboard: invest retries could double-invest → client `request_id`/`Idempotency-Key`, replayed.
- leaderboard: debit then `$inc` had no repair → pending-first record + 1-min settle sweep refunds.
- leaderboard: unknown debit outcome treated as nothing taken → 503 `investment_pending`.
- leaderboard: investment after final → undone and refunded.
- leaderboard: cancel freeze overtaken by recompute → same per-event serialization.
- leaderboard: missed finals never finalized; every instance published → sweep; finals serialized per process (a duplicate across instances is harmless: points pays by key).
- leaderboard: re-registration never revived eliminated entry → revived; unconfirmed withdrawn.
- leaderboard: deleted users' names in new snapshots / global board → anonymized.
- leaderboard: raw docs in public responses; drafts readable → projected fields; 404.
- leaderboard: rate-limit window lost after INCR → `SET NX EX` first.
- leaderboard: Redis client gave up forever on first failure, no password → reconnects, `redisOptions()`.
- leaderboard: unbounded score/param input → capped.
- HoF: nested PATCH wiped groups and reset `deleted` → merged; `deleted` never from body.
- HoF: `javascript:`/`data:` URLs accepted, `/uploads/` refused → http(s) or `/uploads/` only.
- HoF: no search/domain filter → added (escaped).
- HoF: new entries and PATCHes (honoree or members) could store deleted user's name → anonymized.

## Seam re-check (audit #2, after fixes)
- registration: every file download 404'd (`send` ignores the `.private` dot-dir) → `dotfiles: 'allow'`, path already confined.
- event: any core read any event's full participant list (token role) → event admins only, live role.
- event: any core read any event's waitlist and attendance → `requireActiveUser` + event admin.
- registration: roster-lock sweep keyed on scheduled `start_at` → `started_at` (scheduled start only for older events).
- points: attendance replay could starve just-ended events behind ongoing ones → most recently completed first.
- leaderboard: late cancel withdrew a re-confirmed entry, fallback could hit a newer row → both guarded.

## Deliberately left (audit #2)
- mail: still the dev logger — **launch blocker** until a real provider is wired.
- WhatsApp + push: code kept, deferred to post-MVP (boot log says so).
- replay sweeps instead of an outbox: a lost event is re-sent within ~5 min, for 7 days.
- sweep timers aren't cleared on shutdown (unref'd; `process.exit` follows).
- registration: submit rate limit is per instance (memory); admin-only file fields have no upload path.
- registration: rosters below `size_min` stay `forming` for an admin; only email/phone answers scrubbed on `UserDeleted`.
- registration: a system refusal (event cancelled/closed) is a 201 with a `rejected` row, not a 4xx.
- feedback: an anonymous ticket's number is its bearer credential (anyone holding it can read it; submitter hidden).
- points: a claim stuck mid-move after a crash answers 409 `request_in_flight` for its key until an admin runs recalculate on that user (which drops their expired claims).
- leaderboard: an investment undone after the final keeps any podium already announced.
- auction: a bid landing in the few ms between a lot's raise and its post-raise check keeps that lot on the block after a close (admin can advance it).
- events: a demoted former creator still sees their own draft (reads only).
- points: a missed credit/reversal that keeps failing (deleted user, unaffordable reversal) is retried and logged every 5 min until it leaves the 7-day window.
- ops: dev avatars under the old `apps/user-service/uploads/` are not moved to the shared upload dir (wipe dev data).
- all services: an unread body is drained before an early reply only up to 64MB / 15s with a Content-Length; a chunked upload refused early can still surface as 502.

## Frontend / client changes (audit #2)
- auth: Google `?state=` return path must be relative; suspended users can't self-delete.
- strava: settings page reads `code`/`state`/`scope` from `location.hash` (then clears it); 429 `sync_cooldown` (`details.retry_after`).
- challenges: non-reviewer on review routes → 404.
- events: attendance only while `ongoing` and before `end_at` (409 `attendance_window_closed`); going live needs a published form of that event (422 `registration_form_invalid`); drafts may have no form.
- events: waitlist, attendance and full participant lists are for that event's admins only (others see confirmed participants).
- auction: a locked team can't bid (409 `team_locked`), nor an unconfirmed captain (403 `captain_not_confirmed`); lots may show `settling`.
- registrations: download files via `GET /registrations/:id/files/:field_key`; `files[].url` is an opaque `private://…` reference.
- registrations: admin lists need `owner_id` or `form_id`; admin-only answers via `PATCH /registrations/:id/admin-answers`; rejected rows can't be cancelled (409); 429 on >20 submits/min.
- teams: `GET /teams?invited=me` lists live invites.
- forms: stale save → 409 `form_changed` (reload and retry).
- leaderboard invest: send `request_id` (uuid) or `Idempotency-Key`, reuse it on retry; handle 503 `investment_pending` and `replayed`; 409 `investment_in_flight` while that request is pending. A pending request is refunded, never applied: once 503 `investment_pending` resolves (reuse → 409 `request_voided`), start over with a new `request_id`.
- media: 429 `pending_quota_exceeded` / `upload_rate_exceeded`; 415 `unsupported_media_type` on an unaccepted upload Content-Type (was 422); 409 `file_missing` on approve; album with `event_id` needs event admin; outsider on draft bracket/match/album → 404.
- notifications: new cards for team invites, player sales, feedback replies.

## Ops (audit #2)
- `.env`: `REDIS_PASSWORD` carries the password; `REDIS_URL=redis://host:6379` (no password inside).
- first founder: `FOUNDER_EMAIL=… npm run seed:founder` (one-time, audited).
- non-wiped DBs: `npm run migrate:audit2` (dry run) then `--apply`; any `!!` line = a `settling` lot re-queued → check that team's purse before re-running the lot.
- indexes: `autoIndex` is off; each service builds its own on boot (`models:`).
- registration files: boot moves `<uploadDir>/registrations` (the shared upload dir) into `<uploadDir>/.private/registrations`; keep the `uploads` volume. Files a very old build kept in `apps/registration-service/uploads/` are not moved (dev data; wipe).

## Final recheck (audit #2)
- strava: a refused code (state mismatch / scope / athlete taken) deauthorized the athlete, cutting any existing link → revoked only when that athlete is linked to nobody.
- challenge: reward-id fill bumped `updated_at`, so a partial payout replayed forever → fill writes without timestamps.
- media: unaccepted upload Content-Type was a 422 empty body → 415 `unsupported_media_type`.
- media: a replayed `UserDeleted` after a restore re-anonymized → only while the user is deleted.
- notification: `team.invited` offered a decline that doesn't exist → "Accept it from the team page; it expires in 72 hours."
- auction: a lot raised while a close/cancel was stopping the auction goes back to the queue; close now pauses the auction before settling the last lot, so the auto-settle tick can't put a new lot up behind it.
- events: a formless draft can be cancelled (was 422 `invalid_event`).
- events: full participant list needs core+ as well as event-admin (a demoted creator/admin sees confirmed rows only).
- auction: dropped the unused `invalidateAuctionLiveCache` re-export from auction.service.
- teams: a keyed auction add that read the team after the first call linked the registration but before its seat landed 409'd (`already_in_team`) → the auction refunded and the player sat free; a link to the SAME team now waits for that seat (200).
- registration: the promotion sweep re-promoted a row an admin had demoted to the waitlist → promotion skips rows whose last change is an admin confirmed→waitlisted (stands until an admin promotes); the consumer's `exclude` is gone.
- registration: file download took Content-Type from the user's filename (`x.html` → text/html) → stored mime set after `attachment()`, plus `nosniff`.
- registration: an owner edit rewrote the whole `answers` object, reverting a concurrent admin-answers write → per-key `$set`/`$unset` of the owner's keys only.
- registration: `UserDeleted` scrubbed email/phone keys of the form's current fields only → keys that were email/phone in any archived version too.
- registration: dropped the never-passed `regexBudgetMs` validation option.
- points: one failing row aborted the whole replay tick; big events never reached past 500 rows → per-row isolation, keyset paging.
- points: missed cancellations / attendance revocations never replayed → replay reverses credits whose registration no longer stands.
- points: an abandoned key claim blocked its key forever → `voidKey` takes over expired claims; `record()` releases on early failure; recalculate clears the user's stale claims.
- leaderboard: settle sweep refunded a request the slow invest had just applied (double pay) → refunds only if still pending.
- leaderboard: refund to a deleted investor retried forever → final, request dropped.
- HoF: PATCH could store a real name on a deleted honoree or member → guarded on every write.
- auth: Google return path passed `/\t/evil` (browsers strip tabs → `//evil`) → control chars and backslashes refused anywhere.
- auth: prod SMS stub logged the phone number → user id.
- bracket: delete that found a played draw left a finished bracket `active` forever → completes it before the 409.
- gateway: failures-only IP ceiling stopped counting always-200 reset/resend sends → sends count every call again.
- compose: challenge/leaderboard/notification lacked `depends_on` for the services they call → added.
- docs: founder bootstrap order (register first) and the in-image command (`-e FOUNDER_EMAIL`) fixed.
- docker: image never built — `package-lock.json` lacked the media-service workspace (`npm ci` refused) → lock synced.
- all services: an early refusal of a big upload (expired token, 413/415) raced the gateway's streaming → 502 instead of 401 → body drained before replying.
