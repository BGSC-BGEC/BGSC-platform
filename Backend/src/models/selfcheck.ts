/**
 * Runnable check for the model invariants. No DB and no test framework: mongoose's
 * validate() runs the schema rules and the pre('validate') hooks in-process.
 * (validateSync() is not enough — it skips middleware, which is where the invariants live.)
 *
 *   npx tsc && node dist/models/selfcheck.js
 */
import assert from 'assert';
import {
    Event,
    AuctionLot,
    Team,
    FormDefinition,
    FormSubmission,
    PointTransaction,
    LeaderboardEntry,
    Challenge,
    ChallengeParticipation,
    Announcement,
    rawScore,
    normalize,
    isVisibleTo,
    expiryFor,
    idempotencyKey,
} from './index';

interface Validatable {
    validate(): Promise<void>;
}

async function errorOf(doc: Validatable): Promise<string> {
    try {
        await doc.validate();
        return '';
    } catch (e) {
        return (e as Error).message;
    }
}

/** Validates and hands the document back, so assertions can read fields the hooks derived. */
async function ok<T extends Validatable>(doc: T, what: string): Promise<T> {
    assert.strictEqual(await errorOf(doc), '', `${what} should validate`);
    return doc;
}

async function rejects(doc: Validatable, needle: string, what: string): Promise<void> {
    const msg = await errorOf(doc);
    assert.ok(msg.includes(needle), `${what} should be rejected with "${needle}", got: ${msg || '<no error>'}`);
}

const day = 24 * 60 * 60 * 1000;
const t0 = new Date('2026-10-01T00:00:00Z');
const at = (days: number) => new Date(t0.getTime() + days * day);

async function main(): Promise<void> {
    /* ------------------------------ events ------------------------------ */

    const leagueEvent = () =>
        new Event({
            slug: 'campus-league-2026',
            title: 'Campus League 2026',
            category: 'leagues',
            type: 'LE',
            domain: 'sports',
            start_at: at(10),
            end_at: at(20),
            registration: { closes_at: at(8), form_id: 'form-1' },
            created_by: 'user-1',
            leaderboard: { format: 'points_table', min_participants: 4 },
        });

    const league = await ok(leagueEvent(), 'a minimal LE event');
    assert.deepStrictEqual([...league.core_admins], ['user-1'], 'created_by is folded into core_admins');

    await rejects(
        new Event({ ...leagueEvent().toObject(), _id: undefined, start_at: at(20), end_at: at(10) }),
        'start_at must be before end_at',
        'an event ending before it starts'
    );

    await rejects(
        new Event({ ...leagueEvent().toObject(), _id: undefined, registration: { closes_at: at(15), form_id: 'f' } }),
        'closes_at must be at or before start_at',
        'registration closing after the event starts'
    );

    await rejects(
        new Event({ ...leagueEvent().toObject(), _id: undefined, type: 'DE' }),
        "leaderboard must be present exactly when type != 'DE'",
        'a DE event carrying a leaderboard'
    );

    await rejects(
        new Event({ ...leagueEvent().toObject(), _id: undefined, type: 'ALL' }),
        "auction must be present exactly when type == 'ALL'",
        'an ALL event with no auction block'
    );

    const auctionEvent = await ok(
        new Event({
            ...leagueEvent().toObject(),
            _id: undefined,
            type: 'ALL',
            teaming: { is_teamed: true, team_size_min: 5, team_size_max: 8, max_teams: 6 },
            registration: { closes_at: at(8), form_id: 'form-1', roster_finalizes_at: at(9) },
            auction: { k_multiplier: 1.2, min_bid_increment: 100 },
        }),
        'a teamed ALL event with an auction'
    );
    assert.strictEqual(auctionEvent.auction!.oc_override_quota, 3 / 7, 'oc_override_quota defaults to the 3/7 ceiling');

    await rejects(
        new Event({
            ...auctionEvent.toObject(),
            _id: undefined,
            auction: { k_multiplier: 1, min_bid_increment: 100, oc_override_quota: 0.9 },
        }),
        'oc_override_quota exceeds the 3/7 ceiling',
        'an auction overriding more than 3/7ths'
    );

    await rejects(
        new Event({ ...leagueEvent().toObject(), _id: undefined, teaming: { is_teamed: true, team_size_min: 9, team_size_max: 4 } }),
        'team_size_min <= team_size_max',
        'a team with an inverted size range'
    );

    await rejects(
        new Event({ ...leagueEvent().toObject(), _id: undefined, scoring: { normalization: { lower: 800, upper: 200 } } }),
        '0 <= lower < upper <= 1000',
        'normalization bounds in the wrong order'
    );

    await rejects(
        new Event({ ...leagueEvent().toObject(), _id: undefined, points_pool: { podium_multipliers: [1, 2, 3] } }),
        'podium_multipliers must be non-increasing',
        'podium multipliers that reward second place more than first'
    );

    await rejects(
        new Event({
            ...leagueEvent().toObject(),
            _id: undefined,
            scoring: {
                parameters: [
                    { key: 'goals', label: 'Goals', kind: 'int', weight: 1 },
                    { key: 'goals', label: 'Again', kind: 'int', weight: 2 },
                ],
            },
        }),
        'parameters[].key must be unique',
        'duplicate scoring parameter keys'
    );

    /* --------------------------- auction lots --------------------------- */

    await ok(
        new AuctionLot({
            event_id: 'e1',
            player: { user_id: 'u1', display_name: 'Ana' },
            registration_id: 'r1',
            base_price: 500,
            order: 0,
        }),
        'a queued auction lot'
    );

    /* ------------------------------ teams ------------------------------- */

    const team = () =>
        new Team({
            owner: { type: 'event', id: 'e1' },
            name: 'Red Foxes',
            captain_user_id: 'u1',
            members: [{ user_id: 'u1', display_name: 'Ana', registration_id: 'r1', acquired_via: 'created' }],
            invite_code: 'ABCD1234',
            size_min: 1,
            size_max: 5,
        });

    const forming = await ok(team(), 'a forming event team');
    assert.strictEqual(forming.name_lower, 'red foxes', 'name_lower is derived from name');

    await rejects(
        new Team({ ...team().toObject(), _id: undefined, captain_user_id: 'u9' }),
        'captain_user_id must be one of',
        'a captain who is not a member'
    );

    await rejects(
        new Team({
            ...team().toObject(),
            _id: undefined,
            members: [
                { user_id: 'u1', display_name: 'Ana', registration_id: 'r1', acquired_via: 'created' },
                { user_id: 'u1', display_name: 'Ana again', registration_id: 'r2', acquired_via: 'invite' },
            ],
        }),
        'user_id must be unique',
        'the same user twice on one roster'
    );

    await rejects(
        new Team({ ...team().toObject(), _id: undefined, owner: { type: 'challenge', id: 'c1' } }),
        'challenge teams have no registrations',
        'a challenge team carrying registration ids'
    );

    await rejects(
        new Team({ ...team().toObject(), _id: undefined, status: 'complete', size_min: 3 }),
        'requires at least size_min members',
        'a complete team below its minimum size'
    );

    const auctionTeam = await ok(
        new Team({ ...team().toObject(), _id: undefined, auction: { purse_total: 1000, purse_spent: 250 } }),
        'a team with an auction purse'
    );
    assert.strictEqual((auctionTeam as unknown as { purse_remaining: number }).purse_remaining, 750, 'purse_remaining is derived');

    await rejects(
        new Team({ ...team().toObject(), _id: undefined, auction: { purse_total: 100, purse_spent: 500 } }),
        'purse_spent exceeds purse_total',
        'a team that overspent its purse'
    );

    /* ------------------------ forms & submissions ----------------------- */

    await ok(
        new FormDefinition({
            owner: { type: 'event', id: 'e1' },
            title: 'League signup',
            created_by: 'u1',
            fields: [
                { key: 'fide_elo', label: 'FIDE Elo', type: 'number', order: 0, validation: { min: 0, max: 3500 } },
                { key: 'shirt', label: 'Shirt size', type: 'select', order: 1, options: [{ value: 's', label: 'S' }] },
            ],
        }),
        'a two-field registration form'
    );

    await rejects(
        new FormDefinition({
            owner: { type: 'event', id: 'e1' },
            title: 'Bad',
            created_by: 'u1',
            fields: [{ key: 'pick', label: 'Pick', type: 'select', order: 0 }],
        }),
        'needs options',
        'a select field with no options'
    );

    await rejects(
        new FormDefinition({ owner: { type: 'generic', id: null }, title: 'Empty', created_by: 'u1', status: 'published' }),
        'cannot publish a form with no fields',
        'publishing an empty form'
    );

    const submission = () =>
        new FormSubmission({
            form_id: 'form-1',
            form_version: 1,
            owner: { type: 'event', id: 'e1' },
            user: { user_id: 'u1', display_name: 'Ana' },
            context: { event: { role: 'solo' } },
            status: 'confirmed',
        });

    await ok(submission(), 'a confirmed solo registration');

    await rejects(
        new FormSubmission({ ...submission().toObject(), _id: undefined, context: { challenge: { team_id: null } } }),
        "owner 'event' requires context.event",
        'an event submission carrying the challenge context branch'
    );

    await rejects(
        new FormSubmission({
            ...submission().toObject(),
            _id: undefined,
            status: 'submitted',
            context: { event: { role: 'member', team_id: 't1' } },
        }),
        'only be set on a confirmed registration',
        'a team assigned before the registration is confirmed'
    );

    await rejects(
        new FormSubmission({ ...submission().toObject(), _id: undefined, status: 'waitlisted' }),
        "waitlist_position must be set exactly when status == 'waitlisted'",
        'a waitlisted registration with no position'
    );

    /* ------------------------------ points ------------------------------ */

    const credit = () =>
        new PointTransaction({
            user_id: 'u1',
            amount: 10,
            type: 'earn',
            source: 'event',
            reason: 'event.participation',
            reference: { type: 'registration', id: 'r1' },
            idempotency_key: idempotencyKey.eventParticipation('r1'),
            balance_after: 10,
            actor: { type: 'system' },
        });

    await ok(credit(), 'a participation credit');
    assert.strictEqual(idempotencyKey.eventPodium('e1', 'u1'), 'event.podium:e1:u1', 'podium idempotency key shape');

    await rejects(new PointTransaction({ ...credit().toObject(), _id: undefined, amount: 0 }), 'must not be zero', 'a zero-value ledger row');
    await rejects(new PointTransaction({ ...credit().toObject(), _id: undefined, amount: 1.5 }), 'must be an integer', 'a fractional ledger row');
    await rejects(
        new PointTransaction({ ...credit().toObject(), _id: undefined, type: 'spend', amount: 10 }),
        "type 'spend' must be negative",
        'a spend with a positive amount'
    );
    await rejects(
        new PointTransaction({ ...credit().toObject(), _id: undefined, type: 'spend', amount: -10, expires_at: at(30) }),
        'only a credit may carry an expires_at',
        'an expiring debit'
    );
    await rejects(
        new PointTransaction({ ...credit().toObject(), _id: undefined, reference: { type: 'event', id: null } }),
        'must be set together',
        'a half-filled reference'
    );
    await rejects(
        new PointTransaction({ ...credit().toObject(), _id: undefined, actor: { type: 'admin', user_id: null } }),
        'must name a user_id',
        'an admin action with no admin'
    );

    // The ledger is append-only: every mutating query is blocked at the schema.
    await assert.rejects(
        () => PointTransaction.updateOne({ _id: 'x' }, { $set: { amount: 999 } }).exec(),
        /append-only/,
        'updating a ledger row'
    );
    await assert.rejects(
        () => PointTransaction.deleteOne({ _id: 'x' }).exec(),
        /append-only/,
        'deleting a ledger row'
    );

    /* --------------------------- leaderboard ---------------------------- */

    const entry = await ok(
        new LeaderboardEntry({
            event_id: 'e1',
            participant: { type: 'user', id: 'u1', display_name: 'Ana' },
            registration_id: 'r1',
            normalized_score: 400,
            invested_points: 50,
        }),
        'a solo leaderboard entry'
    );
    assert.strictEqual(entry.final_score, 450, 'final_score = normalized_score + invested_points');

    await rejects(
        new LeaderboardEntry({ event_id: 'e1', participant: { type: 'team', id: 't1', display_name: 'Foxes' }, registration_id: 'r1' }),
        "registration_id must be set exactly when participant.type == 'user'",
        'a team entry carrying a registration id'
    );

    const params = [
        { key: 'goals', kind: 'int' as const, weight: 3 },
        { key: 'mvp', kind: 'bool' as const, weight: 10 },
    ];
    assert.strictEqual(rawScore({ goals: 4, mvp: true }, params), 22, 'rawScore weights ints and counts booleans as 0/1');
    assert.strictEqual(rawScore({ goals: 4 }, params), 12, 'rawScore skips parameters with no recorded value');
    assert.strictEqual(normalize(5, 0, 10, 0, 1000), 500, 'normalize maps the midpoint to the middle of the range');
    assert.strictEqual(normalize(7, 7, 7, 100, 900), 100, 'a flat field normalizes everyone to the lower bound');

    /* ---------------------------- challenges ---------------------------- */

    const challenge = () =>
        new Challenge({
            slug: 'run-5k',
            title: 'Run 5k',
            description: 'Run five kilometres.',
            domain: 'sports',
            kind: 'digital',
            difficulty: 'easy',
            award_points: 25,
            created_by: 'u1',
        });

    const digital = await ok(challenge(), 'a digital challenge');
    assert.deepStrictEqual([...digital.submission.proof_types], ['url', 'text'], 'proof types default to the pre-Media set');

    await rejects(
        new Challenge({ ...challenge().toObject(), _id: undefined, kind: 'physical' }),
        "'physical' challenge needs a location",
        'a physical challenge with no location'
    );
    await rejects(
        new Challenge({ ...challenge().toObject(), _id: undefined, award_points: 0 }),
        'award_points',
        'a challenge worth no points'
    );
    await rejects(
        new Challenge({
            ...challenge().toObject(),
            _id: undefined,
            submission: { requires_proof: false, auto_approve: true, proof_types: [] },
        }),
        'auto_approve needs requires_proof',
        'auto-approving a challenge that asks for nothing'
    );
    await rejects(
        new Challenge({ ...challenge().toObject(), _id: undefined, window: { opens_at: at(10), closes_at: at(2) } }),
        'window dates must be ordered',
        'a challenge that closes before it opens'
    );
    await rejects(
        new Challenge({ ...challenge().toObject(), _id: undefined, teaming: { enabled: true, team_size_min: 5, team_size_max: 2 } }),
        'team_size_min <= team_size_max',
        'a teammable challenge with an inverted size range'
    );

    const participation = () =>
        new ChallengeParticipation({
            challenge_id: 'c1',
            challenge_snapshot: { title: 'Run 5k', difficulty: 'easy', award_points: 25 },
            participant: { type: 'user', id: 'u1', display_name: 'Ana' },
            member_user_ids: ['u1'],
        });

    await ok(participation(), 'a solo challenge acceptance');

    await rejects(
        new ChallengeParticipation({ ...participation().toObject(), _id: undefined, member_user_ids: ['u1', 'u2'] }),
        'exactly its own user id',
        'a solo participation listing extra members'
    );
    await rejects(
        new ChallengeParticipation({ ...participation().toObject(), _id: undefined, reward: { points_awarded: 25 } }),
        'only an approved participation carries a reward',
        'a reward paid before approval'
    );

    /* --------------------------- announcements -------------------------- */

    const announcement = () =>
        new Announcement({
            title: 'Trials on Friday',
            body: 'Turn up at 6pm.',
            categories: ['bgec'],
            author: { user_id: 'u1', display_name: 'Ana', role_label: 'Coordinator' },
        });

    await ok(announcement(), 'a draft announcement');

    const teamsPost = await ok(
        new Announcement({ ...announcement().toObject(), _id: undefined, categories: ['teams'] }),
        'a Teams-tagged announcement'
    );
    assert.strictEqual(teamsPost.audience.min_role, 'core', "the 'teams' category forces min_role up to core");

    const published = await ok(
        new Announcement({ ...announcement().toObject(), _id: undefined, status: 'published', published_at: t0 }),
        'a published announcement'
    );
    assert.strictEqual(published.expires_at!.getTime(), expiryFor(t0).getTime(), 'expires_at is derived as published_at + 4 months');

    await rejects(
        new Announcement({ ...announcement().toObject(), _id: undefined, status: 'published' }),
        'requires published_at',
        'a published announcement with no publish time'
    );
    await rejects(
        new Announcement({ ...announcement().toObject(), _id: undefined, published_at: t0 }),
        'must leave published_at and expires_at null',
        'a draft that already claims to be published'
    );
    await rejects(
        new Announcement({ ...announcement().toObject(), _id: undefined, categories: ['bgec', 'bgec'] }),
        'categories must be unique',
        'a duplicated category'
    );
    await rejects(
        new Announcement({
            ...announcement().toObject(),
            _id: undefined,
            delivery: { whatsapp: { requested: true, per_category: [{ category: 'fitsoc', group_id: 'g1' }] } },
        }),
        'is not on this announcement',
        'a delivery row for a category the post does not carry'
    );

    const viewer = (role: 'guest' | 'core', ids: string[] = []) => ({ role, confirmed_event_ids: ids });
    assert.ok(isVisibleTo(published, viewer('guest')), 'a public published post is visible to a guest');
    assert.ok(!isVisibleTo(announcement(), viewer('core')), 'a draft is visible to nobody');
    assert.ok(
        !isVisibleTo({ status: 'published', audience: { min_role: 'core', event_id: null } }, viewer('guest')),
        'the role gate hides a Core-only post from a guest'
    );
    assert.ok(
        !isVisibleTo({ status: 'published', audience: { min_role: 'guest', event_id: 'e1' } }, viewer('guest')),
        'an event-scoped post is hidden from a non-registrant'
    );
    assert.ok(
        isVisibleTo({ status: 'published', audience: { min_role: 'guest', event_id: 'e1' } }, viewer('guest', ['e1'])),
        'an event-scoped post is visible to a registrant'
    );

    console.log('models selfcheck: all assertions passed');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
