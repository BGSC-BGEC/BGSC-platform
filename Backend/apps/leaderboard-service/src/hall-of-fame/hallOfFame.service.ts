import { HallOfFameEntry, IHallOfFameEntry, ServiceError } from '@bgsc/shared';
import mongoose from 'mongoose';

export async function listEntries(query: { category?: string; year?: number; featured?: boolean; limit: number; page: number }) {
    const filter: any = { deleted_at: null };
    if (query.category) filter.category = query.category;
    if (query.year) filter['achievement.year'] = query.year;
    if (query.featured !== undefined) filter.featured = query.featured;

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

export async function createEntry(input: Partial<IHallOfFameEntry>, actorId: string) {
    const slug = await generateUniqueSlug(input.title!, input.achievement!.year);

    const entry = new HallOfFameEntry({
        ...input,
        slug,
        created_by: actorId
    });

    await entry.save();
    return entry.toObject();
}

export async function updateEntry(id: string, input: Partial<IHallOfFameEntry>, actorId: string) {
    const entry = await HallOfFameEntry.findOne({ _id: id, deleted_at: null });
    if (!entry) {
        throw new ServiceError(404, 'entry_not_found');
    }

    if (input.title || (input.achievement && input.achievement.year)) {
        const newTitle = input.title ?? entry.title;
        const newYear = input.achievement?.year ?? entry.achievement.year;
        if (newTitle !== entry.title || newYear !== entry.achievement.year) {
            entry.slug = await generateUniqueSlug(newTitle, newYear);
        }
    }

    Object.assign(entry, input);
    await entry.save();
    return entry.toObject();
}

export async function deleteEntry(id: string, actorId: string) {
    const entry = await HallOfFameEntry.findOne({ _id: id, deleted_at: null });
    if (!entry) {
        throw new ServiceError(404, 'entry_not_found');
    }

    entry.deleted_at = new Date();
    await entry.save();
    return { success: true };
}
