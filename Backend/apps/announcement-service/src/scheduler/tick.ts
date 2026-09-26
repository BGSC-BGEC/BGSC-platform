import { ACTIVE_MONTHS, ARCHIVE_MONTHS, Announcement } from '@bgsc/shared';
import { Actor, announcePublished, publishedSet } from '../announcements/announcement.service';

/**
 * The scheduler.
 *
 * No cron dependency for one timer, and no second timer for the purge: both extra queries are
 * indexed and match nothing on virtually every pass.
 *
 * ponytail: one in-process 60s timer, running in every instance. Correct under concurrency
 * because the publish step is a compare-and-swap, wasteful at N instances. Move to a leader
 * election or a real scheduler when there is more than one instance to care about.
 */

/** The scheduler has no human to attribute: audit rows carry a null actor (AuditLog.ts). */
const SYSTEM: Actor = { id: null, ip: null };

export const TICK_INTERVAL_MS = 60_000;

function minusMonths(from: Date, months: number): Date {
    const d = new Date(from);
    d.setMonth(d.getMonth() - months);
    return d;
}

/**
 * Claim and publish every announcement whose scheduled time has arrived.
 *
 * `findOneAndUpdate` filtered on `status` is a compare-and-swap: with two instances ticking, only
 * one wins each document, so `AnnouncementPublished` is emitted exactly once.
 *
 * It also means `pre('validate')` never runs — that hook is document middleware and does not fire
 * on query updates — which is why `publishedSet` writes `expires_at` itself. Using `.save()` instead
 * would run the hook but reintroduce the double-publish race.
 */
async function publishDue(now: Date): Promise<number> {
    let published = 0;

    for (;;) {
        const claimed = await Announcement.findOneAndUpdate(
            { status: 'scheduled', scheduled_for: { $lte: now }, deleted_at: null },
            { $set: publishedSet(now) },
            { returnDocument: 'after', sort: { scheduled_for: 1 } }
        );
        if (!claimed) break;

        // Same event and audit row as Send Now, from the same function, so the two cannot drift.
        await announcePublished(claimed, SYSTEM);
        published += 1;
    }

    return published;
}

export interface TickResult {
    published: number;
    archived: number;
    purged: number;
}

export async function tick(now: Date = new Date()): Promise<TickResult> {
    const published = await publishDue(now);

    // Spec §5.2: only the past 4 months are displayed. Not a TTL index — Spec §15.3 wants the
    // archive to survive another 8 months before anything is destroyed.
    const archived = await Announcement.updateMany(
        { status: 'published', expires_at: { $lte: now } },
        { $set: { status: 'archived' } }
    );

    // Spec §15.3: 1 year in total.
    const purged = await Announcement.deleteMany({
        status: 'archived',
        expires_at: { $lte: minusMonths(now, ARCHIVE_MONTHS) },
    });

    // A soft-deleted draft or scheduled item never gets an expires_at, so the purge above never
    // reaches it and it would sit in the collection forever. Same one-year horizon, counted from
    // the delete. (A deleted *published* one still archives and purges on its expires_at.)
    const purgedDeleted = await Announcement.deleteMany({
        status: { $in: ['draft', 'scheduled'] },
        deleted_at: { $lte: minusMonths(now, ACTIVE_MONTHS + ARCHIVE_MONTHS) },
    });

    return {
        published,
        archived: archived.modifiedCount ?? 0,
        purged: (purged.deletedCount ?? 0) + (purgedDeleted.deletedCount ?? 0),
    };
}

export function startScheduler(): NodeJS.Timeout {
    // setInterval's first fire is a full period away, so a restart would leave anything already
    // due sitting until the next minute — and a service that restarts more often than the period
    // would never publish a scheduled announcement at all. Run once now, then on the interval.
    void tick().catch((err) => console.error('[announcement-service] First scheduler tick failed:', err));

    const timer = setInterval(() => {
        // A failing tick must not take the process down: the next one is 60 seconds away and the
        // documents it could not move are still exactly where it left them.
        void tick().catch((err) => console.error('[announcement-service] Scheduler tick failed:', err));
    }, TICK_INTERVAL_MS);

    // Nothing here should hold the process open on its own.
    timer.unref();
    return timer;
}
