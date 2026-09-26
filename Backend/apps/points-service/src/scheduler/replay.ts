import { Event, FormSubmission, PointTransaction, idempotencyKey } from '@bgsc/shared';
import { handlers } from '../events/consumers';

/**
 * Replay sweeps. The bus is fire-and-forget with no outbox, so a message this
 * service missed (down, restarting, Redis blip) is simply gone. Every 5 minutes, re-derive what the
 * last 7 days should have produced; every step is idempotent by the ledger's own keys, so running it
 * against work already done writes nothing.
 */

const INTERVAL_MS = 5 * 60_000;
const WINDOW_MS = 7 * 86_400_000;
/** Rows per read. Each step pages by `_id` to the end, so a big event cannot hide the rows past it. */
const PAGE = 500;

const log = (what: string, err: unknown) => console.error(`[points-service] replay: ${what} failed:`, err);

/** Walk a query in `_id` order, one page at a time, until a short page. */
async function eachPage<T extends { _id: string }>(
    read: (after: { _id?: { $gt: string } }) => Promise<T[]>,
    each: (page: T[]) => Promise<void>
): Promise<void> {
    let after: { _id?: { $gt: string } } = {};
    for (;;) {
        const page = await read(after);
        if (page.length > 0) await each(page);
        if (page.length < PAGE) return;
        after = { _id: { $gt: page[page.length - 1]._id } };
    }
}

/** Which of these keys already have a row. */
const written = async (keys: string[]): Promise<Set<unknown>> =>
    new Set(await PointTransaction.distinct('idempotency_key', { idempotency_key: { $in: keys } }));

export async function replayTick(
    now: Date = new Date()
): Promise<{ cancelled: number; credited: number; reversed: number }> {
    const since = new Date(now.getTime() - WINDOW_MS);

    // 1. EventCancelled: refunds and reversals. The sweep itself skips what is already done.
    // ponytail: every cancelled event in the window is re-walked each tick; cheap while cancels are rare.
    const cancelled = await Event.distinct('_id', { status: 'cancelled', cancelled_at: { $gte: since } });
    for (const event_id of cancelled) {
        try {
            await handlers.onEventCancelled({ event_id });
        } catch (err) {
            log(`cancel sweep for event ${event_id}`, err);
        }
    }

    const running = await Event.distinct('_id', {
        deleted_at: null,
        $or: [{ status: 'ongoing' }, { status: 'past', completed_at: { $gte: since } }],
    });

    // 2. ParticipantAttended: attended, confirmed registrations of recently running events with no
    //    participation row yet. One failing row (a since-deleted user) is logged, not fatal.
    let credited = 0;
    await eachPage(
        (after) =>
            FormSubmission.find({
                'owner.type': 'event',
                'owner.id': { $in: running },
                status: 'confirmed',
                'context.event.attended': true,
                ...after,
            })
                .select('_id owner user.user_id')
                .sort({ _id: 1 })
                .limit(PAGE)
                .lean(),
        async (page) => {
            const paid = await written(page.map((r) => idempotencyKey.eventParticipation(r._id)));
            for (const r of page) {
                if (paid.has(idempotencyKey.eventParticipation(r._id))) continue;
                try {
                    await handlers.creditParticipation({ event_id: r.owner.id!, registration_id: r._id, user_id: r.user.user_id });
                    credited++;
                } catch (err) {
                    log(`participation credit for registration ${r._id}`, err);
                }
            }
        }
    );

    // 3. RegistrationCancelled / ParticipantAttendanceRevoked: a participation credit on those events
    //    whose registration no longer stands, and that has no reversal yet.
    const registrationOf = (key: string) => key.slice(idempotencyKey.eventParticipation('').length);
    let reversed = 0;
    await eachPage(
        (after) =>
            PointTransaction.find({
                'reference.type': 'event',
                'reference.id': { $in: running },
                reason: 'event.participation',
                type: 'earn',
                ...after,
            })
                .select('_id idempotency_key')
                .sort({ _id: 1 })
                .limit(PAGE)
                .lean(),
        async (page) => {
            const regs = new Map(
                (
                    await FormSubmission.find({ _id: { $in: page.map((c) => registrationOf(c.idempotency_key)) } })
                        .select('status context.event.attended')
                        .lean()
                ).map((r) => [r._id, r])
            );
            const done = await written(page.map((c) => idempotencyKey.participationReversal(c._id)));
            for (const c of page) {
                const reg = regs.get(registrationOf(c.idempotency_key));
                if (done.has(idempotencyKey.participationReversal(c._id))) continue;
                if (reg?.status === 'confirmed' && reg.context?.event?.attended) continue;
                try {
                    await handlers.reverseParticipation({
                        registration_id: registrationOf(c.idempotency_key),
                        reason: reg?.status === 'confirmed' ? 'attendance_revoked' : 'registration_cancelled',
                    });
                    reversed++;
                } catch (err) {
                    log(`participation reversal for transaction ${c._id}`, err);
                }
            }
        }
    );
    return { cancelled: cancelled.length, credited, reversed };
}

export function startReplaySweeper(): void {
    let running = false;
    const sweep = async (): Promise<void> => {
        if (running) return;
        running = true;
        try {
            await replayTick();
        } catch (err) {
            console.error('[points-service] replay sweep failed:', err);
        } finally {
            running = false;
        }
    };
    const timer = setInterval(() => void sweep(), INTERVAL_MS);
    timer.unref();
}
