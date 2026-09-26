import { Event, IUser, User, config, successEnvelope } from '@bgsc/shared';
import express from 'express';
import { AddressInfo } from 'net';
import mongoose from 'mongoose';
import { v4 as uuid } from 'uuid';
import { promises as fs } from 'fs';

/**
 * Shared by the three selfchecks.
 *
 * They run against their OWN database, dropped at the start: they used to write fixtures into
 * `bgsc_dev` — the database a developer's running stack reads.
 */
const SCRATCH_DB = config.mongoUri.replace(/\/([^/?]+)(\?|$)/, '/bgsc_selfcheck_registration$2');

export async function openScratchDb(): Promise<void> {
    await mongoose.connect(SCRATCH_DB, { serverSelectionTimeoutMS: 5000 });
    await mongoose.connection.dropDatabase();
    // The partial unique index is what rejects duplicate registrations: build what the app builds.
    await Promise.all(
        ['FormDefinition', 'FormDefinitionVersion', 'FormSubmission', 'FormUpload', 'Team', 'TeamMembership'].map((name) =>
            mongoose.model(name).syncIndexes()
        )
    );
}

export async function closeScratchDb(): Promise<void> {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await fs.rm(config.uploadDir, { recursive: true, force: true });
}

/** Registrations embed a user snapshot read straight from `users`, so a selfcheck needs real rows. */
export async function seedUser(fullName: string): Promise<IUser> {
    const id = uuid();
    return User.create({
        _id: id,
        email: `${id}@selfcheck.local`,
        username: `sc_${id.slice(0, 8)}`,
        profile: { full_name: fullName },
    });
}

export async function dropUsers(ids: string[]): Promise<void> {
    await User.deleteMany({ _id: { $in: ids } });
}

/**
 * The fields of an event this service reads (registration form, window, teaming). Inserted raw:
 * the Event model's invariants belong to the Event Service and are not what is under test here.
 */
export async function seedEvent(opts: {
    id?: string;
    formId: string;
    createdBy: string;
    teamSize?: [number, number];
    closesInMs?: number;
    status?: string;
    type?: string;
    auctionStatus?: string;
    maxParticipants?: number | null;
    requiresApproval?: boolean;
    /** Teamed events only; defaults to true so a captain registers pending. */
    captainApplication?: boolean;
    maxTeams?: number | null;
}): Promise<string> {
    const id = opts.id ?? uuid();
    await Event.collection.insertOne({
        _id: id as any,
        slug: `sc-${id}`, // unique, in case the events indexes exist in this database
        status: opts.status ?? 'upcoming',
        type: opts.type ?? 'LE',
        deleted_at: null,
        // Who administers it: the creator; coordinator+ platform-wide.
        created_by: opts.createdBy,
        core_admins: [],
        start_at: new Date(),
        auction: opts.auctionStatus ? { status: opts.auctionStatus, captain_user_ids: [] } : null,
        seat_holders: [],
        registration: {
            opens_at: null,
            closes_at: new Date(Date.now() + (opts.closesInMs ?? 86_400_000)),
            form_id: opts.formId,
            waitlist_enabled: true,
            max_participants: opts.maxParticipants ?? null,
            requires_approval: opts.requiresApproval ?? false,
        },
        teaming: opts.teamSize
            ? {
                  is_teamed: true,
                  team_size_min: opts.teamSize[0],
                  team_size_max: opts.teamSize[1],
                  max_teams: opts.maxTeams ?? null,
                  captain_application_required: opts.captainApplication ?? true,
              }
            : { is_teamed: false, team_size_min: null, team_size_max: null, max_teams: null, captain_application_required: false },
    });
    return id;
}

/**
 * A stand-in Event Service speaking the contract: seat holders per event, idempotent
 * reserve/release, `capacity_full` when full with a waitlist, `waitlist_disabled` without one — and
 * every reply wrapped by the REAL `successEnvelope`. A client that forgets to unwrap reads
 * `reserved` as undefined against this stub, which is exactly how that bug once shipped unnoticed.
 */
export interface EventStub {
    capacity: Map<string, number>;
    waitlist: Map<string, boolean>;
    holders: Map<string, Set<string>>;
    reserveCalls: number;
    down: boolean;
    close(): Promise<void>;
}

export async function startEventStub(): Promise<EventStub> {
    const stub: EventStub = {
        capacity: new Map(),
        waitlist: new Map(),
        holders: new Map(),
        reserveCalls: 0,
        down: false,
        close: async () => undefined,
    };
    const holdersOf = (id: string) => stub.holders.get(id) ?? stub.holders.set(id, new Set()).get(id)!;

    const app = express();
    app.use(express.json());
    app.use(successEnvelope);
    app.post('/internal/events/:id/reserve-seat', (req, res) => {
        stub.reserveCalls++;
        if (stub.down) return void res.status(503).json({ error: 'unavailable' });
        const holders = holdersOf(req.params.id);
        const reg = req.body.registration_id as string;
        if (holders.has(reg)) return void res.json({ reserved: true });
        const cap = stub.capacity.get(req.params.id) ?? Infinity;
        if (holders.size >= cap) {
            const reason = stub.waitlist.get(req.params.id) === false ? 'waitlist_disabled' : 'capacity_full';
            return void res.json({ reserved: false, reason });
        }
        holders.add(reg);
        res.json({ reserved: true });
    });
    app.post('/internal/events/:id/release-seat', (req, res) => {
        if (stub.down) return void res.status(503).json({ error: 'unavailable' });
        res.json({ released: holdersOf(req.params.id).delete(req.body.registration_id) });
    });

    const server = await new Promise<import('http').Server>((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    (config.services as { event: string }).event = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    stub.close = () => new Promise((resolve) => server.close(() => resolve()));
    return stub;
}
