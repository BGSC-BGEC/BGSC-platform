import {
    Announcement,
    FormSubmission,
    IAnnouncement,
    REGISTERED_STATUS,
    ROLE_RANK,
    RoleName,
    User,
    UserStatus,
    roleRank,
} from '@bgsc/shared';
import { mutedUserIds } from '../notifications/preferences';
import { NotificationInput, createMany, retract, updateContent } from '../notifications/notification.service';
import { RenderedMessage, renderMessage } from './templates';
import { dispatchAnnouncement } from './dispatch';

/**
 * The in-app half of a broadcast: who gets a card, and what it says.
 *
 * `dispatch.ts` is the outbound half. Keeping them apart is deliberate — one answers "which of our
 * users may see this", the other "does this go out to a public group", and the second question has
 * a much sharper failure mode than the first.
 */

/** Dedupe keys, in one place. Each is derived from the document that caused the notification. */
export const dedupe = {
    announcement: (announcementId: string) => `announcement:${announcementId}`,
    // Per confirmation, not per registration: a row confirmed, rejected by an admin and confirmed
    // again is good news twice. `nth` counts the row's transitions into 'confirmed'.
    registrationConfirmed: (registrationId: string, nth: number) => `registration.confirmed:${registrationId}:${nth}`,
    registrationWaitlisted: (registrationId: string) => `registration.waitlisted:${registrationId}`,
    challengeApproved: (participationId: string) => `challenge.approved:${participationId}`,
    // A rejected participation can be resubmitted and rejected again (`SUBMITTABLE_FROM` includes
    // 'rejected'), so the key carries which rejection this is — or the second one is deduped away.
    challengeRejected: (participationId: string, nth: number) => `challenge.rejected:${participationId}:${nth}`,
    eventCancelled: (eventId: string) => `event.cancelled:${eventId}`,
    // The ledger row, not the user: one card per credit, and the row is already idempotent.
    pointsEarned: (transactionId: string) => `points.earned:${transactionId}`,
    feedbackSubmitted: (ticketId: string) => `feedback.submitted:${ticketId}`,
    // Keyed on the response time: a reply that is replaced by a newer one is a second card.
    feedbackResponded: (ticketId: string, respondedAtMs: number) => `feedback.responded:${ticketId}:${respondedAtMs}`,
    // Per invite, not per (team, user): an invite that lapsed or was declined can be sent again.
    teamInvite: (teamId: string, userId: string, invitedAtMs: number) =>
        `team.invite:${teamId}:${userId}:${invitedAtMs}`,
    auctionSold: (lotId: string, side: 'player' | 'captain') => `auction.sold:${lotId}:${side}`,
};

/** The card body is a teaser, not the announcement. The full text is one tap away. */
const SUMMARY_MAX = 200;

export function summarize(body: string): string {
    const flat = body.replace(/\s+/g, ' ').trim();
    return flat.length <= SUMMARY_MAX ? flat : `${flat.slice(0, SUMMARY_MAX - 1).trimEnd()}…`;
}

/**
 * Who may see this announcement, which is the announcement feed's filter (`audience.ts`) evaluated
 * in the other direction: the feed asks which announcements a user may see, the fan-out asks which
 * users may see an announcement. The two must agree, or someone gets a card that 404s when tapped.
 *
 * `ROLE_RANK` is ordered, so "rank at or above the floor" is a suffix of it. `roleRank` answers -1
 * for a role it does not know, and `slice(-1)` would return only the LAST role — so an unknown
 * floor is clamped to 0 rather than quietly narrowing the audience to founders.
 *
 * The author is included: this inbox is a record of what was published to them, not a feed of
 * other people's actions.
 */
export async function recipientsFor(a: Pick<IAnnouncement, 'audience'>): Promise<string[]> {
    const floor = Math.max(0, roleRank(a.audience.min_role));
    const filter: Record<string, unknown> = {
        role: { $in: ROLE_RANK.slice(floor) },
        status: UserStatus.ACTIVE,
        deleted_at: null,
    };

    if (a.audience.event_id !== null) {
        // The event gate is server-side and reads registrations directly — the same rule, and the
        // same source, the announcement feed uses.
        const registrants = await FormSubmission.distinct('user.user_id', {
            'owner.type': 'event',
            'owner.id': a.audience.event_id,
            status: REGISTERED_STATUS,
        });
        if (registrants.length === 0) return [];
        filter._id = { $in: registrants };
    }

    const [users, muted] = await Promise.all([
        User.find(filter).select('_id').lean<{ _id: string }[]>(),
        mutedUserIds('announcement'),
    ]);

    return users.map((u) => u._id).filter((id) => !muted.has(id));
}

/**
 * Deliver one published announcement: in-app first, then the outbound channels.
 *
 * The order matters. Spec §9.4's fallback is "in-app notification if WhatsApp delivery fails", so
 * the in-app cards must already exist before anything can fail — and if the process dies between
 * the two halves, the reconciliation sweep finds an announcement with fewer dispatch rows
 * than it has channels and runs the whole thing again, which is safe because both halves are
 * idempotent.
 */
export async function deliverAnnouncement(announcementId: string): Promise<{ created: number } | null> {
    const a = await Announcement.findById(announcementId);
    // Deleted, or the event is a replay of a publish that has since been retracted. Nothing to do,
    // and the payload could not have told us: it carries no status.
    if (!a || a.deleted_at !== null || a.status !== 'published') return null;

    const message = renderMessage('announcement.published', {
        title: a.title,
        summary: summarize(a.body),
    });

    const recipients = await recipientsFor(a);
    const created = await createMany(
        recipients.map((user_id) => ({
            user_id,
            ...message,
            data: { announcement_id: a._id, categories: a.categories, priority: a.priority },
            dedupe_key: dedupe.announcement(a._id),
        }))
    );

    // A delete or an edit can land between the read above and the insert, and its event has then
    // already been handled against zero cards — the retraction deleted nothing, the refresh rewrote
    // nothing. Re-read once and settle the cards against what the announcement is NOW.
    const now = await Announcement.findById(announcementId).select('title body status deleted_at').lean();
    if (!now || now.deleted_at !== null || now.status !== 'published') {
        await retract(dedupe.announcement(announcementId));
        return { created: 0 };
    }
    if (now.title !== a.title || now.body !== a.body) await refreshAnnouncementCards(announcementId);

    await dispatchAnnouncement(a);
    return { created };
}

/**
 * Bring already-delivered cards back in line with an edited announcement.
 *
 * Title and body stay editable after publish — only `categories` and `audience` freeze, because the
 * fan-out keys off those (`announcement.service.ts`). So the *audience* of a card can never change
 * under an edit, which is what makes rewriting the text safe: nobody gains or loses a card, the
 * wording just stops being wrong.
 */
export async function refreshAnnouncementCards(announcementId: string): Promise<number> {
    const a = await Announcement.findById(announcementId);
    if (!a || a.deleted_at !== null || a.status !== 'published') return 0;

    const message = renderMessage('announcement.published', {
        title: a.title,
        summary: summarize(a.body),
    });
    return updateContent(dedupe.announcement(a._id), { title: message.title, body: message.body });
}

/**
 * One message to everyone registered for an event, confirmed or waiting for a place. Used by
 * `EventCancelled`, and the reason `recipientsFor` is not the only fan-out path — this one has no
 * role floor to apply: everyone who registered is entitled to know, whatever their rank. The
 * waitlist is included: a person holding position 3 is waiting on this event too.
 */
export async function fanOutToRegistrants(
    eventId: string,
    message: RenderedMessage,
    dedupeKey: string,
    data: Record<string, unknown>
): Promise<number> {
    const registrants = await FormSubmission.distinct('user.user_id', {
        'owner.type': 'event',
        'owner.id': eventId,
        status: { $in: [REGISTERED_STATUS, 'waitlisted'] },
    });
    if (registrants.length === 0) return 0;

    // A registration outlives the account that made it, so the ids have to be resolved against
    // `users` rather than trusted — otherwise a suspended or deleted account collects inbox rows
    // that appear the day it is restored. `recipientsFor` applies exactly this filter; two fan-out
    // paths disagreeing about who counts as a person is how one of them goes wrong.
    const [users, muted] = await Promise.all([
        User.find({ _id: { $in: registrants }, status: UserStatus.ACTIVE, deleted_at: null })
            .select('_id')
            .lean<{ _id: string }[]>(),
        mutedUserIds(message.category),
    ]);

    const rows: NotificationInput[] = users
        .map((u) => u._id)
        .filter((id) => !muted.has(id))
        .map((user_id) => ({ user_id, ...message, data, dedupe_key: dedupeKey }));

    return createMany(rows);
}

/**
 * Send one message to all active staff members at or above a given role floor.
 * Defaults to 'core' floor for system notices like feedback tickets.
 */
export async function fanOutToStaff(
    message: RenderedMessage,
    dedupeKey: string,
    data: Record<string, unknown>,
    minRoleFloor: RoleName = 'core'
): Promise<number> {
    const floor = Math.max(0, roleRank(minRoleFloor));
    const filter: Record<string, unknown> = {
        role: { $in: ROLE_RANK.slice(floor) },
        status: UserStatus.ACTIVE,
        deleted_at: null,
    };
    const [users, muted] = await Promise.all([
        User.find(filter)
            .select('_id')
            .lean<{ _id: string }[]>(),
        mutedUserIds(message.category),
    ]);

    const rows: NotificationInput[] = users
        .map((u) => u._id)
        .filter((id) => !muted.has(id))
        .map((user_id) => ({ user_id, ...message, data, dedupe_key: dedupeKey }));

    return createMany(rows);
}

