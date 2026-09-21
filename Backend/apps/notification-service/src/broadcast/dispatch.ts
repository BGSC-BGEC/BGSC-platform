import {
    Announcement,
    AnnouncementCategory,
    DISPATCH_MAX_ATTEMPTS,
    DISPATCH_RETRYABLE,
    DeliveryStatus,
    DispatchChannel,
    IAnnouncement,
    INotificationDispatch,
    NotificationDispatch,
    RoleName,
    config,
    isTerminalDispatch,
    roleRank,
} from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import * as client from './announcement-client';
import { renderWhatsApp } from './templates';
import { ProviderError, destinationFor, isConfigured, sendText } from './whatsapp';

/**
 * The outbound half of a broadcast: claim, gate, send, record, retry
 * (be2-broadcast-service-plan.md §5, §8).
 *
 * Nothing here decides *who* sees an announcement in the app — that is `broadcast.ts`. This file
 * only answers "does this announcement go out on a channel, to which destination, and what
 * happened when it did".
 */

const HOUR_MS = 3_600_000;

/* ------------------------------------------------------------------ *
 * The audience gate (plan §5.0) — the guard that must not be got wrong
 * ------------------------------------------------------------------ */

/**
 * The highest `audience.min_role` that is still effectively public. `guest` and `user` are the two
 * ranks any reader of the public feed already holds; `member` and above describe someone the club
 * admitted.
 */
const PUBLIC_MAX_ROLE: RoleName = 'user';

/**
 * A WhatsApp community group is a PUBLIC destination, so a restricted announcement must never
 * reach one.
 *
 * This is load-bearing rather than defensive. The Announcement model raises `audience.min_role` to
 * `core` whenever the `teams` category is tagged (Spec §7.1, Announcement.ts) — so a dispatch loop
 * that read only `categories` would take the platform's Core-internal announcements and post them
 * to a group chat anyone can be added to, inverting the exact gate that raise exists to enforce.
 * The same argument covers an event-scoped announcement: it is addressed to one event's
 * registrants, not to a community.
 *
 * In-app delivery is unaffected — it is per-user and rank-checked — so a restricted announcement
 * still reaches precisely the right inboxes.
 */
export function audienceGate(a: Pick<IAnnouncement, 'audience'>): string | null {
    if (roleRank(a.audience.min_role) > roleRank(PUBLIC_MAX_ROLE)) return 'audience_restricted';
    if (a.audience.event_id !== null) return 'audience_scoped';
    return null;
}

/* ------------------------------------------------------------------ *
 * Claim
 * ------------------------------------------------------------------ */

/** Exponential backoff in minutes: 2, 4, 8, 16, 32 (plan §8.1). */
export function nextRetryAt(attempts: number, from: Date = new Date()): Date {
    return new Date(from.getTime() + 2 ** Math.max(1, attempts) * 60_000);
}

/**
 * Take ownership of one send, exactly once.
 *
 * The unique index on `(source, channel, category)` is what makes this safe: a colliding insert
 * means another instance — or an earlier delivery of the same event — already owns it, and the
 * right answer is to do nothing. A read-then-insert would let a replayed `AnnouncementPublished`
 * through twice, which is precisely the double-send Spec §9.4's rate limit exists to prevent.
 *
 * The claim is deliberately LOCAL. Claiming by writing to the announcement document would be a
 * compare-and-swap against a document another service owns and is concurrently editing.
 */
export async function claim(
    announcementId: string,
    channel: DispatchChannel,
    category: AnnouncementCategory | null,
    destination: string | null
): Promise<INotificationDispatch | null> {
    try {
        return await NotificationDispatch.create({
            _id: uuid(),
            channel,
            source: { type: 'announcement', id: announcementId },
            category,
            destination,
            status: 'pending',
            attempts: 0,
            // A retryable row must always carry a date or the sweep's `$lte` filter never sees it.
            next_attempt_at: new Date(),
        });
    } catch (err) {
        if ((err as { code?: number }).code === 11000) return null;
        throw err;
    }
}

/* ------------------------------------------------------------------ *
 * Settle
 * ------------------------------------------------------------------ */

export interface Outcome {
    status: DeliveryStatus;
    error?: string | null;
    providerMessageId?: string | null;
    /** Set when a provider call was actually made — the rate limiter reads `attempted_at`. */
    attempted?: boolean;
    /** `rate_limited` gives back the attempt it did not spend. */
    attemptsOverride?: number;
    /** Overrides the default backoff (the hour boundary, for a rate-limited row). */
    retryAt?: Date;
}

/**
 * Write an outcome, keeping the model's central invariant true: `next_attempt_at` is null exactly
 * when the status is terminal, and a real date whenever it is not. A retryable row with a null date
 * is invisible to the sweep forever; a terminal row with one is re-sent. Both fail silently, which
 * is why this is one function rather than an update at each call site.
 *
 * `writeback_at` is cleared on every settle: the state just changed, so whatever the announcement
 * document holds is now stale and the writeback sweep should pick it up again.
 */
export async function settle(row: INotificationDispatch, outcome: Outcome): Promise<void> {
    const now = new Date();
    const terminal = isTerminalDispatch(outcome.status);

    const set: Record<string, unknown> = {
        status: outcome.status,
        error: outcome.error ?? null,
        provider_message_id: outcome.providerMessageId ?? null,
        next_attempt_at: terminal ? null : outcome.retryAt ?? nextRetryAt(row.attempts, now),
        writeback_at: null,
    };
    if (outcome.attempted) set.attempted_at = now;
    if (outcome.attemptsOverride !== undefined) set.attempts = outcome.attemptsOverride;

    // Every state change bumps the revision; the writeback pins its stamp to the one it read.
    await NotificationDispatch.updateOne({ _id: row._id }, { $set: set, $inc: { revision: 1 } });
}

/* ------------------------------------------------------------------ *
 * Rate limit (Spec §9.4: 1 per tag per hour)
 * ------------------------------------------------------------------ */

/**
 * Returns when the window frees, or null when a send is allowed now.
 *
 * Answered from our own durable rows rather than a Redis key with a TTL (plan D4): Redis is
 * optional in this repo and holds no state across a restart, so a TTL-key limiter would silently
 * reset and permit exactly the double-send it exists to stop.
 *
 * The row being sent is `pending` at this point, not `sent`, so it never counts itself.
 */
export async function rateLimitedUntil(category: AnnouncementCategory): Promise<Date | null> {
    const rate = Math.max(1, config.whatsapp.ratePerHour);
    const since = new Date(Date.now() - HOUR_MS);

    const recent = await NotificationDispatch.find({
        channel: 'whatsapp',
        category,
        status: 'sent',
        attempted_at: { $gt: since },
    })
        .sort({ attempted_at: -1 })
        .limit(rate)
        .select('attempted_at')
        .lean<{ attempted_at: Date }[]>();

    if (recent.length < rate) return null;
    // The oldest send still inside the window is the one whose expiry frees a slot.
    const oldest = recent[recent.length - 1].attempted_at;
    return new Date(oldest.getTime() + HOUR_MS);
}

/* ------------------------------------------------------------------ *
 * Attempt
 * ------------------------------------------------------------------ */

/**
 * Run one WhatsApp send attempt against a claimed row.
 *
 * The compare-and-swap at the top is exact on `attempts`, so two instances sweeping at the same
 * moment cannot both take the same attempt — the loser matches nothing. The backoff is written
 * *before* the send rather than after it, so a process that dies mid-send leaves a row that waits
 * its backoff instead of one another instance picks up immediately.
 *
 * `attempts` is therefore spent by the claim, not by the failure: a message that crashes its sender
 * cannot be retried forever.
 */
export async function attempt(row: INotificationDispatch): Promise<void> {
    if (row.attempts >= DISPATCH_MAX_ATTEMPTS) return;

    const claimed = await NotificationDispatch.findOneAndUpdate(
        { _id: row._id, status: { $in: DISPATCH_RETRYABLE }, attempts: row.attempts },
        {
            $inc: { attempts: 1, revision: 1 },
            $set: { status: 'pending', next_attempt_at: nextRetryAt(row.attempts + 1), writeback_at: null },
        },
        { returnDocument: 'after' }
    );
    if (!claimed) return; // someone else has this attempt, or the row moved on

    // A push row reaches this function only after a crash between its claim and its settle — the
    // happy path settles it inline. Without this branch it would fall through the WhatsApp checks
    // and be recorded as `no_group_mapped`, which would be a true statement about the wrong thing.
    if (claimed.channel === 'push') {
        await settle(claimed, { status: 'skipped', error: 'push_not_configured' });
        return;
    }

    // Re-read at send time rather than trusting a document the caller loaded earlier. The gap
    // between "we decided to broadcast" and "we are about to send" is where a delete or an
    // unpublish lands, and a message cannot be recalled once it is out. One indexed read per
    // category is the whole price.
    const a = await Announcement.findById(claimed.source.id);
    // Deleted or unpublished between publish and delivery. Not an error and not retryable: the
    // thing being broadcast no longer exists.
    if (!a || a.deleted_at !== null || a.status !== 'published') {
        await settle(claimed, { status: 'skipped', error: 'announcement_unavailable' });
        return;
    }

    const gate = audienceGate(a);
    if (gate) {
        await settle(claimed, { status: 'skipped', error: gate });
        return;
    }

    // Deployment-level state is checked BEFORE the per-category map: with nothing configured at
    // all, both are true, and "WhatsApp is not set up" is the useful half. Reversed, a deployment
    // that has never configured the provider reports `no_group_mapped` on every category and sends
    // whoever reads it hunting for a missing group id that was never the problem.
    if (!isConfigured()) {
        await settle(claimed, { status: 'skipped', error: 'not_configured' });
        return;
    }

    if (!claimed.category || !claimed.destination) {
        await settle(claimed, { status: 'skipped', error: 'no_group_mapped' });
        return;
    }

    const until = await rateLimitedUntil(claimed.category);
    if (until) {
        // No provider call was made, so the attempt is given back — five quiet hours must not burn
        // a row's whole retry budget.
        await settle(claimed, {
            status: 'rate_limited',
            error: 'rate_limited',
            attemptsOverride: row.attempts,
            retryAt: until,
        });
        return;
    }

    let body: string | null;
    try {
        body = renderWhatsApp('announcement.published', {
            title: a.title,
            body: a.body,
            author: a.author.display_name,
        });
    } catch (err) {
        // A template that cannot render is a bug, not a transient failure; retrying it forever
        // would just log the same thing five times.
        await settle(claimed, { status: 'skipped', error: `template: ${(err as Error).message}` });
        return;
    }

    // Null means this notification type has no WhatsApp body — not reachable today, since the only
    // broadcast type has one, but sending `null` to the provider is the failure mode worth one line.
    if (body === null) {
        await settle(claimed, { status: 'skipped', error: 'no_whatsapp_template' });
        return;
    }

    try {
        const messageId = await sendText(claimed.destination, body);
        await settle(claimed, { status: 'sent', providerMessageId: messageId, attempted: true });
    } catch (err) {
        const message = err instanceof ProviderError ? err.message : (err as Error).message;
        await settle(claimed, { status: 'failed', error: message, attempted: true });
    }
}

/* ------------------------------------------------------------------ *
 * Whole-announcement dispatch
 * ------------------------------------------------------------------ */

/**
 * Claim and attempt every channel this announcement owes, then write the outcomes back.
 *
 * Idempotent end to end: every claim collides on a second run, so a replayed event costs one failed
 * insert per category and nothing else.
 */
export async function dispatchAnnouncement(a: IAnnouncement): Promise<void> {
    for (const category of a.categories) {
        const row = await claim(a._id, 'whatsapp', category, destinationFor(category));
        if (row) await attempt(row);
    }

    // Push has no provider (plan D5). The row exists so the `delivery.push.requested` flag a
    // publish sets resolves to an honest `skipped` instead of reading as "still trying" forever,
    // and so reconciliation can tell "never processed" from "processed, nothing to send".
    const push = await claim(a._id, 'push', null, null);
    if (push) await settle(push, { status: 'skipped', error: 'push_not_configured' });

    await writeback(a._id);
}

/* ------------------------------------------------------------------ *
 * Writeback
 * ------------------------------------------------------------------ */

/**
 * Push the current state of every row for one announcement onto the announcement document, so the
 * composer sees delivery where Spec §6.4 put it.
 *
 * Every row is sent, not only the terminal ones: `failed` and `rate_limited` are exactly what a
 * composer needs to see. `writeback_at` is stamped only on success, and cleared by every later
 * `settle`, so the sweep retries precisely the rows whose stored state is stale.
 *
 * The stamp is guarded on `revision`, because the rows were read BEFORE the HTTP call and a
 * concurrent `settle` can land during it. Stamping blindly would then mark a row as written back
 * when what actually reached the announcement was its previous state — and if that settle was the
 * row's last (a terminal `sent`), nothing would ever clear the flag again and the composer would
 * show `pending` forever. A row that moved under us keeps `writeback_at: null` and is picked up by
 * the next sweep, which is exactly right: its current state has not been reported.
 *
 * A counter and not `updated_at`: timestamps are milliseconds, so a settle inside the same
 * millisecond as the read compares equal and the guard silently passes. That made the first version
 * of this guard — and its test — pass or fail on machine speed.
 */
export async function writeback(announcementId: string): Promise<boolean> {
    const rows = await NotificationDispatch.find({
        'source.type': 'announcement',
        'source.id': announcementId,
    }).lean<INotificationDispatch[]>();
    if (rows.length === 0) return true;

    const whatsapp = rows
        .filter((r) => r.channel === 'whatsapp' && r.category !== null)
        .map((r) => ({
            category: r.category as AnnouncementCategory,
            // `group_id` is required on the announcement's delivery row, and an unmapped category
            // is the most actionable status a composer can be shown — so it is reported, with a
            // placeholder destination, rather than hidden by omitting the row.
            group_id: r.destination ?? '(unmapped)',
            status: r.status,
            message_id: r.provider_message_id,
            attempted_at: r.attempted_at,
            error: r.error,
        }));

    const push = rows.find((r) => r.channel === 'push');

    const result = await client.recordDelivery(announcementId, {
        whatsapp: whatsapp.length > 0 ? whatsapp : undefined,
        push: push ? { status: push.status, sent_count: null } : undefined,
    });

    // `permanent` stamps too, and deliberately: the announcement is gone or was never published,
    // so this outcome has nowhere to land and never will. Leaving the rows unstamped would make
    // the writeback sweep re-read and re-send them every 60 seconds forever, and — because the
    // sweep takes a bounded page — crowd out the rows that could still be written.
    if (result === 'ok' || result === 'permanent') {
        const at = new Date();
        await NotificationDispatch.bulkWrite(
            rows.map((r) => ({
                updateOne: {
                    filter: { _id: r._id, revision: r.revision },
                    update: { $set: { writeback_at: at } },
                },
            }))
        );
    }
    return result === 'ok';
}
