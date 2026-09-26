import { AnnouncementCategory, DeliveryStatus, InternalCallError, callInternal, config } from '@bgsc/shared';

/**
 * The one thing this service cannot do for itself: write the delivery outcome onto the
 * announcement document.
 *
 * `announcements` is written by the Announcement Service alone (relationships.md §1), and a
 * delivery receipt is a write — so this is HTTP to its `/internal` endpoint, not a direct save,
 * even though we share the database (adding-a-service.md §6.5). Reading the announcement to
 * decide what to send is a read, and reads go straight to the model.
 *
 * Best-effort **by design**. The local dispatch row is the truth and carries `writeback_at`; an
 * unreachable Announcement Service costs a composer view that trails reality until the next tick
 * retries it. Failing the dispatch instead would risk not sending — and a send cannot be undone,
 * while a late receipt can always be caught up.
 */

const TIMEOUT_MS = 5000;

export interface WhatsAppDeliveryRow {
    category: AnnouncementCategory;
    /** Masked (`dispatch.ts:maskDestination`) — never the raw destination. */
    group_id: string;
    status: DeliveryStatus;
    message_id?: string | null;
    attempted_at?: Date | null;
    error?: string | null;
    /** The dispatch row's revision; the receiver ignores anything older than what it holds. */
    revision: number;
}

export interface DeliveryPayload {
    whatsapp?: WhatsAppDeliveryRow[];
    push?: { status: DeliveryStatus; sent_count?: number | null; revision: number };
}

/**
 * Three outcomes, not two.
 *
 * `retry` and `permanent` both mean "it did not land", but conflating them starves the sweep: rows
 * whose announcement was deleted (404) or unpublished (409) can never be written back, and a
 * boolean would leave them at `writeback_at: null` forever — re-read, re-sent and re-logged every
 * 60 seconds, and, because the sweep takes a bounded page, permanently occupying the slots that
 * genuinely stale rows need.
 *
 * ONLY those two are permanent. A 401 is our token being wrong (a rotation mid-deploy), a 422 a
 * contract drift between two versions of these services — both are fixed by a deploy, and a
 * receipt stamped "done" in the meantime would be lost for good. They are retried, and logged
 * every time, which is the alarm.
 */
export type WritebackResult = 'ok' | 'retry' | 'permanent';

const PERMANENT = new Set([404, 409]);

export async function recordDelivery(
    announcementId: string,
    payload: DeliveryPayload
): Promise<WritebackResult> {
    try {
        await callInternal(config.services.announcement, `/internal/announcements/${announcementId}/delivery`, {
            method: 'PATCH',
            body: payload,
            timeoutMs: TIMEOUT_MS,
        });
        return 'ok';
    } catch (err) {
        if (!(err instanceof InternalCallError)) throw err;
        console.error(
            `[notification-service] delivery writeback ${announcementId} failed: ${err.status} ${err.code}`
        );
        return PERMANENT.has(err.status) ? 'permanent' : 'retry';
    }
}
