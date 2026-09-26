import { DELETED_DISPLAY_NAME, HallOfFameEntry, IHallOfFameEntry, ServiceError, User, escapeRegex } from '@bgsc/shared';

export async function listEntries(query: {
    category?: string;
    year?: number;
    domain?: string;
    search?: string;
    featured?: boolean;
    limit: number;
    page: number;
}) {
    const filter: any = { deleted_at: null };
    if (query.category) filter.category = query.category;
    if (query.year) filter['achievement.year'] = query.year;
    if (query.domain) filter['achievement.domain'] = query.domain;
    if (query.featured !== undefined) filter.featured = query.featured;
    if (query.search) {
        const pattern = { $regex: escapeRegex(query.search), $options: 'i' };
        filter.$or = [{ title: pattern }, { 'honoree.display_name': pattern }];
    }

    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
        HallOfFameEntry.find(filter)
            .sort({ 'achievement.year': -1, featured_order: 1, created_at: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        HallOfFameEntry.countDocuments(filter)
    ]);

    return { items, total, page: query.page, limit: query.limit };
}

export async function getFeaturedEntries() {
    return HallOfFameEntry.find({ deleted_at: null, featured: true })
        .sort({ featured_order: 1, 'achievement.year': -1 })
        .lean();
}

export async function getEntryBySlugOrId(slugOrId: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
    const filter: any = { deleted_at: null };

    if (isUuid) {
        filter._id = slugOrId;
    } else {
        filter.slug = slugOrId;
    }

    const entry = await HallOfFameEntry.findOne(filter).lean();
    if (!entry) {
        throw new ServiceError(404, 'entry_not_found');
    }

    return entry;
}

async function generateUniqueSlug(title: string, year: number): Promise<string> {
    const baseSlug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${year}`;
    let slug = baseSlug;
    let suffix = 1;

    while (true) {
        const existing = await HallOfFameEntry.findOne({ slug, deleted_at: null }).lean();
        if (!existing) return slug;
        slug = `${baseSlug}-${suffix}`;
        suffix++;
    }
}

type DuplicateKeyError = { code?: number; keyPattern?: Record<string, unknown> };

/** Which unique index a duplicate-key error came from: the slug, or the (category, honoree, source) identity. */
const duplicateOf = (err: unknown): 'slug' | 'identity' | null => {
    const e = err as DuplicateKeyError | null;
    if (e?.code !== 11000) return null;
    return e.keyPattern && 'slug' in e.keyPattern ? 'slug' : 'identity';
};

const SLUG_ATTEMPTS = 5;

/**
 * Save with a fresh slug when asked. The slug check is a read before the write, so two saves of the
 * same title race to one slug and the loser gets a duplicate key: pick the next slug and try again,
 * rather than surfacing the raw 11000 as a 500.
 */
export async function saveEntry(entry: IHallOfFameEntry, regenerateSlug: boolean): Promise<IHallOfFameEntry> {
    for (let attempt = 0; attempt < SLUG_ATTEMPTS; attempt++) {
        if (regenerateSlug) entry.slug = await generateUniqueSlug(entry.title, entry.achievement.year);
        try {
            return await entry.save();
        } catch (err) {
            const dup = duplicateOf(err);
            if (dup === 'identity') throw new ServiceError(409, 'entry_exists');
            if (dup !== 'slug' || !regenerateSlug) throw dup === 'slug' ? new ServiceError(409, 'slug_conflict') : err;
        }
    }
    throw new ServiceError(409, 'slug_conflict');
}

type Snapshot = { display_name: string; avatar_url?: string | null; deleted?: boolean };

/**
 * A NEW snapshot of a deleted account never carries its name: an admin typing one
 * in, or copying it from an old page, gets the anonymized form stored instead.
 */
async function anonymizeDeleted(input: Partial<IHallOfFameEntry>): Promise<void> {
    // A list, not a map by user id: the honoree is often a member too, and both snapshots need it.
    const snaps: Array<[string, Snapshot]> = [];
    if (input.honoree?.type === 'user' && input.honoree.id) snaps.push([input.honoree.id, input.honoree]);
    for (const m of input.members ?? []) snaps.push([m.user_id, m]);
    if (snaps.length === 0) return;
    const live = new Set(await User.find({ _id: { $in: snaps.map(([id]) => id) }, deleted_at: null }).distinct('_id'));
    for (const [id, snap] of snaps) {
        if (!live.has(id)) Object.assign(snap, { display_name: DELETED_DISPLAY_NAME, avatar_url: null, deleted: true });
    }
}

export async function createEntry(input: Partial<IHallOfFameEntry>, actorId: string) {
    await anonymizeDeleted(input);
    const entry = new HallOfFameEntry({ ...input, created_by: actorId });
    return (await saveEntry(entry, true)).toObject();
}

export async function updateEntry(id: string, input: Partial<IHallOfFameEntry>, actorId: string) {
    const entry = await HallOfFameEntry.findOne({ _id: id, deleted_at: null });
    if (!entry) {
        throw new ServiceError(404, 'entry_not_found');
    }

    const newTitle = input.title ?? entry.title;
    const newYear = input.achievement?.year ?? entry.achievement.year;
    const reslug = newTitle !== entry.title || newYear !== entry.achievement.year;

    // Nested groups are merged, never replaced: `Object.assign` of `{ achievement: { season } }` used
    // to drop the year, and a replaced honoree lost its `deleted` flag (un-anonymizing a deleted
    // user). `deleted` is never taken from a body; it survives unless the honoree itself changes.
    const { honoree, source, achievement, members, ...flat } = input;
    const plain = <T>(v: T): T => ((v as { toObject?: () => T })?.toObject?.() ?? v);
    Object.assign(entry, flat);
    if (achievement) entry.set('achievement', { ...plain(entry.achievement), ...achievement });
    if (source) entry.set('source', { ...plain(entry.source), ...source });
    if (honoree) {
        const same = !honoree.id || honoree.id === entry.honoree.id;
        const { deleted: _ignored, ...fromBody } = honoree;
        entry.set('honoree', { ...plain(entry.honoree), ...fromBody, deleted: same ? !!entry.honoree.deleted : false });
    }
    if (members) {
        const before = new Map((entry.members ?? []).map((m) => [m.user_id, plain(m)]));
        entry.set(
            'members',
            members.map((m) => (before.get(m.user_id)?.deleted ? before.get(m.user_id) : { ...m, deleted: false }))
        );
    }
    // Over the merged result, members included: a name typed onto a deleted honoree is not stored.
    await anonymizeDeleted(entry);
    return (await saveEntry(entry, reslug)).toObject();
}

export async function deleteEntry(id: string, actorId: string) {
    const entry = await HallOfFameEntry.findOne({ _id: id, deleted_at: null });
    if (!entry) {
        throw new ServiceError(404, 'entry_not_found');
    }

    entry.deleted_at = new Date();
    await entry.save();
    return { deleted: true };
}
