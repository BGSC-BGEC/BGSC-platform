import { AnnouncementCategory, DeliveryStatus, config } from '@bgsc/shared';

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
    group_id: string;
    status: DeliveryStatus;
    message_id?: string | null;
    attempted_at?: Date | null;
    error?: string | null;
}

export interface DeliveryPayload {
    whatsapp?: WhatsAppDeliveryRow[];
    push?: { status: DeliveryStatus; sent_count?: number | null };
}

/**
 * Three outcomes, not two.
 *
 * `retry` and `permanent` both mean "it did not land", but conflating them starves the sweep: rows
 * whose announcement was deleted (404) or unpublished (409) can never be written back, and a
 * boolean would leave them at `writeback_at: null` forever — re-read, re-sent and re-logged every
 * 60 seconds, and, because the sweep takes a bounded page, permanently occupying the slots that
 * genuinely stale rows need.
 */
export type WritebackResult = 'ok' | 'retry' | 'permanent';

export async function recordDelivery(
    announcementId: string,
    payload: DeliveryPayload
): Promise<WritebackResult> {
    try {
        const res = await fetch(`${config.services.announcement}/internal/announcements/${announcementId}/delivery`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-Internal-Token': config.internalToken },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.ok) return 'ok';

        console.error(`[notification-service] delivery writeback ${announcementId} responded ${res.status}`);
        // 404: the announcement was deleted between publish and delivery. 409: it is not published.
        // 422: this body will never be accepted. 401: our token is wrong, and retrying a rejected
        // credential every minute is a way to lock an account out, not a way to recover.
        // None of those get better by asking again; a 5xx or a timeout might.
        return res.status >= 400 && res.status < 500 ? 'permanent' : 'retry';
    } catch (err) {
        // Unreachable, or timed out. The announcement service may simply be restarting.
        console.error(
            `[notification-service] delivery writeback ${announcementId} unreachable:`,
            (err as Error).message
        );
        return 'retry';
    }
}
