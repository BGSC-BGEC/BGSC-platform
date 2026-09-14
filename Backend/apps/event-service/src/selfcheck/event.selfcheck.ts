import assert from 'assert';
import { slugify, validateEventInvariants } from '../events/event.service';
import { sniffImage } from '../storage/storage';

console.log('--- Event Service Selfcheck ---');

// 1. Slugify logic
assert.strictEqual(slugify('Football Championship 2026!'), 'football-championship-2026', 'slugifies title properly');
assert.strictEqual(slugify('  Valorant -- BGEC Tourney  '), 'valorant-bgec-tourney', 'strips excess whitespace and hyphens');

// 2. Date Invariants
assert.throws(() => {
    validateEventInvariants({
        start_at: new Date('2026-10-10T10:00:00Z'),
        end_at: new Date('2026-10-09T10:00:00Z'),
    });
}, /start_must_be_before_end/, 'rejects start_at >= end_at');

assert.throws(() => {
    validateEventInvariants({
        start_at: new Date('2026-10-10T10:00:00Z'),
        end_at: new Date('2026-10-12T10:00:00Z'),
        registration: {
            opens_at: new Date('2026-10-05T10:00:00Z'),
            closes_at: new Date('2026-10-04T10:00:00Z'),
            roster_finalizes_at: null,
            form_id: null,
            max_participants: null,
            waitlist_enabled: false,
            requires_approval: false,
        },
    });
}, /registration_opens_must_be_before_closes/, 'rejects opens_at >= closes_at');

assert.throws(() => {
    validateEventInvariants({
        start_at: new Date('2026-10-10T10:00:00Z'),
        end_at: new Date('2026-10-12T10:00:00Z'),
        registration: {
            opens_at: new Date('2026-10-01T10:00:00Z'),
            closes_at: new Date('2026-10-11T10:00:00Z'), // closes after start!
            roster_finalizes_at: null,
            form_id: null,
            max_participants: null,
            waitlist_enabled: false,
            requires_approval: false,
        },
    });
}, /registration_closes_must_be_before_event_start/, 'rejects closes_at > start_at');

// 3. Teaming Invariants
assert.throws(() => {
    validateEventInvariants({
        teaming: {
            is_teamed: true,
            team_size_min: 5,
            team_size_max: 3,
            max_teams: 10,
            captain_application_required: false,
        },
    });
}, /team_size_min_exceeds_max/, 'rejects min team size > max team size');

// 4. Scoring Normalization Invariants
assert.throws(() => {
    validateEventInvariants({
        scoring: {
            parameters: [],
            normalization: { lower: 500, upper: 200 },
        },
    });
}, /normalization_lower_must_be_below_upper/, 'rejects lower >= upper normalization');

// 5. Unique Parameter Keys
assert.throws(() => {
    validateEventInvariants({
        scoring: {
            parameters: [
                { key: 'goals', label: 'Goals', kind: 'int', weight: 1 },
                { key: 'goals', label: 'Goals duplicate', kind: 'int', weight: 2 },
            ],
            normalization: { lower: 0, upper: 1000 },
        },
    });
}, /duplicate_scoring_parameter_key/, 'rejects duplicate scoring parameter keys');

// 6. Roster finalization invariants
assert.throws(() => {
    validateEventInvariants({
        start_at: new Date('2026-10-10T10:00:00Z'),
        end_at: new Date('2026-10-12T10:00:00Z'),
        registration: {
            opens_at: new Date('2026-10-01T10:00:00Z'),
            closes_at: new Date('2026-10-08T10:00:00Z'),
            roster_finalizes_at: new Date('2026-10-05T10:00:00Z'), // before closes_at!
            form_id: null,
            max_participants: null,
            waitlist_enabled: false,
            requires_approval: false,
        },
    });
}, /roster_finalizes_must_be_after_closes/, 'rejects roster_finalizes_at < closes_at');

// 7. Image Magic Byte Sniffing
const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const fakeFile = Buffer.from('hello world not an image');

assert.strictEqual(sniffImage(jpegHeader), 'image/jpeg', 'sniffs JPEG correctly');
assert.strictEqual(sniffImage(pngHeader), 'image/png', 'sniffs PNG correctly');
assert.strictEqual(sniffImage(fakeFile), null, 'rejects non-image bytes');

console.log('event service selfcheck: all assertions passed');
