import {
    INotification,
    Notification,
    NotificationCategory,
    ServiceError,
    notificationExpiry,
} from '@bgsc/shared';
import { v4 as uuid } from 'uuid';
import { allOf, keysetFilter, pageOf } from './cursor';
import { ListNotificationsInput } from './notification.schemas';

/**
 * The inbox: writes that create notifications, and the four reads a client makes of its own.
 *
 * Every read and every write is scoped by `user_id` taken from the verified token — never from a
 * query string or a body. A notification belonging to someone else answers 404 rather than 403:
 * a viewer who may not see a row should not learn that it exists (adding-a-service.md §6.6).
 */

export interface NotificationInput {
    user_id: string;
    category: NotificationCategory;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    /**
     * Derived from the document that caused this notification, never from the event envelope —
     * a replay carries a fresh message_id, so envelope dedupe cannot survive one.
     */
    dedupe_key: string;
}

const MONGO_DUPLICATE_KEY = 11000;

interface MongoWriteError {
    code?: number;
    writeErrors?: { code?: number; err?: { code?: number } }[];
}

/** A single-document insert that collided with the `(dedupe_key, user_id)` unique index. */
function isDuplicate(err: unknown): boolean {
    return (err as MongoWriteError)?.code === MONGO_DUPLICATE_KEY;
}

/**
 * An unordered `insertMany` inserts every non-duplicate document and *then* throws, carrying one
 * entry per rejected document. Duplicates are the expected outcome of a replay and mean the work
 * was already done; anything else — a validation failure, a full disk — must not be mistaken for a
 * delivered broadcast, so it is rethrown.
 */
function allDuplicates(err: unknown): boolean {
    const errors = (err as MongoWriteError)?.writeErrors;
    if (!Array.isArray(errors) || errors.length === 0) return isDuplicate(err);
    return errors.every((e) => (e?.code ?? e?.err?.code) === MONGO_DUPLICATE_KEY);
}

function documentFor(input: NotificationInput): Record<string, unknown> {
    return {
        _id: uuid(),
        user_id: input.user_id,
        category: input.category,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data ?? {},
        channel: 'in_app',
        dedupe_key: input.dedupe_key,
        read_at: null,
        expires_at: notificationExpiry(),
    };
}

/** One recipient. Returns false when the notification already existed — a replay, not a failure. */
export async function createOne(input: NotificationInput): Promise<boolean> {
    try {
        await Notification.create(documentFor(input));
        return true;
    } catch (err) {
        if (isDuplicate(err)) return false;
        throw err;
    }
}

/** Batch size for the fan-out. Large enough to matter, small enough that one failure is cheap. */
export const INSERT_BATCH = 500;

/**
 * Many recipients, in batches. Returns how many rows were actually created, so a caller can tell a
 * first delivery from a replay.
 *
 * `ordered: false` is load-bearing: an ordered insert stops at the first duplicate, so a partially
 * delivered batch would never deliver its tail.
 */
export async function createMany(inputs: NotificationInput[]): Promise<number> {
    let created = 0;

    for (let i = 0; i < inputs.length; i += INSERT_BATCH) {
        const docs = inputs.slice(i, i + INSERT_BATCH).map(documentFor);
        try {
            const inserted = await Notification.insertMany(docs, { ordered: false });
            created += inserted.length;
        } catch (err) {
            if (!allDuplicates(err)) throw err;
            // Some of the batch may still have landed; count what the driver managed.
            const rejected = (err as MongoWriteError).writeErrors?.length ?? docs.length;
            created += docs.length - rejected;
        }
    }

    return created;
}

/**
 * Retract every copy of one notification (plan D17). Used when the announcement behind it is
 * deleted: a card that opens onto a 404 is worse than no card.
 *
 * Served by the `{ dedupe_key, user_id }` index, whose leading key is exactly this filter.
 */
export async function retract(dedupeKey: string): Promise<number> {
    const res = await Notification.deleteMany({ dedupe_key: dedupeKey });
    return res.deletedCount ?? 0;
}

/**
 * Rewrite the text of every card created by one cause.
 *
 * A notification is a snapshot of something that lives elsewhere, and this repo refreshes its
 * snapshots rather than letting them rot (`relationships.md §4` — every service consuming
 * `UserProfileUpdated` does the same thing for display names). A published announcement can still
 * have its title and body edited, so without this a card reads "Match at 5pm" for the rest of its
 * ninety days while the announcement it deep-links to says 7pm.
 *
 * Only existing rows are touched: `updateMany` creates nothing, so a user who was muted at publish
 * time does not acquire a card by someone editing a typo.
 */
export async function updateContent(dedupeKey: string, patch: { title: string; body: string }): Promise<number> {
    const res = await Notification.updateMany(
        { dedupe_key: dedupeKey },
        { $set: { title: patch.title, body: patch.body } }
    );
    return res.modifiedCount ?? 0;
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export interface ListResult {
    notifications: INotification[];
    next_cursor: string | null;
}

export async function list(userId: string, input: ListNotificationsInput): Promise<ListResult> {
    const conditions: Record<string, unknown>[] = [{ user_id: userId }];
    if (input.unread === true) conditions.push({ read_at: null });
    if (input.unread === false) conditions.push({ read_at: { $ne: null } });
    if (input.category) conditions.push({ category: input.category });
    // Combined with $and, never by spreading: the cursor carries a top-level $or of its own.
    if (input.cursor) conditions.push(keysetFilter(input.cursor));

    const rows = await Notification.find(allOf(conditions))
        .sort({ created_at: -1, _id: -1 })
        .limit(input.limit)
        .lean<INotification[]>();

    const { rows: page, next_cursor } = pageOf(rows, input.limit);
    return { notifications: page, next_cursor };
}

export async function unreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({ user_id: userId, read_at: null });
}

/**
 * Marking read is idempotent: the `read_at: null` guard means a second call matches nothing, so
 * the original read time is never overwritten by a double-tap. A row that exists but is already
 * read is therefore a success, not a 404 — which is why existence is checked separately.
 */
export async function markRead(userId: string, id: string): Promise<Date> {
    const now = new Date();
    const updated = await Notification.findOneAndUpdate(
        { _id: id, user_id: userId, read_at: null },
        { $set: { read_at: now } },
        { returnDocument: 'after' }
    ).lean<INotification>();
    if (updated) return updated.read_at as Date;

    const existing = await Notification.findOne({ _id: id, user_id: userId }).lean<INotification>();
    if (!existing) throw new ServiceError(404, 'notification_not_found');
    return existing.read_at as Date;
}

export async function markAllRead(userId: string): Promise<number> {
    const res = await Notification.updateMany(
        { user_id: userId, read_at: null },
        { $set: { read_at: new Date() } }
    );
    return res.modifiedCount ?? 0;
}

export async function dismiss(userId: string, id: string): Promise<void> {
    const res = await Notification.deleteOne({ _id: id, user_id: userId });
    if ((res.deletedCount ?? 0) === 0) throw new ServiceError(404, 'notification_not_found');
}
