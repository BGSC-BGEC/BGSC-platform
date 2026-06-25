import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;
const CURRENT_YEAR = new Date().getUTCFullYear();

// ── Types ─────────────────────────────────────────────────────────────────────

type SeedUser = {
  username: string;
  email: string;
  password: string;
  role: string;
  interests: string[];
  contact: string | null;
  pointsBalance?: number;
};

type SeedSponsor = {
  key: string;
  name: string;
  logoUrl: string;
  description: string;
  websiteUrl: string;
  tenureStart: string;
  tenureEnd: string;
  status: 'active' | 'inactive';
};

type SeedSponsorAssignment = {
  username: string;
  sponsorKey: string;
  fanCount: number;
  eventsWon: string[];
  totalPointsContributed: number;
};

type SeedEvent = {
  id: string;
  title: string;
  description: string;
  type: 'LE' | 'DE' | 'ALL' | 'DLL';
  status: 'upcoming' | 'ongoing' | 'past';
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  venue: string | null;
  needsLeaderboard: boolean;
  maxParticipants: number | null;
  tags: string[];
  createdByUsername: string;
};

type SeedRegistration = {
  eventId: string;
  username: string;
};

type SeedScore = {
  eventId: string;
  username: string;
  score: number;
  submittedByUsername: string;
};

type SeedTransaction = {
  username: string;
  amount: number;
  type: 'earn' | 'spend' | 'refund';
  source: 'event' | 'challenge' | 'store' | 'leaderboard';
  referenceId: string | null;
};

// ── Seed data ─────────────────────────────────────────────────────────────────

const users: SeedUser[] = [
  {
    username: 'founder01',
    email: 'founder@bgsc.in',
    password: 'Founder@123',
    role: 'founder',
    interests: ['management', 'gaming'],
    contact: '9000000001',
  },
  {
    username: 'coordinator01',
    email: 'coordinator@bgsc.in',
    password: 'Coord@123',
    role: 'coordinator',
    interests: ['cricket', 'esports'],
    contact: '9000000002',
  },
  {
    username: 'core01',
    email: 'core@bgsc.in',
    password: 'Core@123',
    role: 'core',
    interests: ['football', 'fitness'],
    contact: '9000000003',
  },
  {
    username: 'core02',
    email: 'core2@bgsc.in',
    password: 'Core@123',
    role: 'core',
    interests: ['badminton', 'chess'],
    contact: '9000000004',
  },
  {
    username: 'member01',
    email: 'member@bgsc.in',
    password: 'Member@123',
    role: 'member',
    interests: ['basketball', 'gaming'],
    contact: '9000000005',
    pointsBalance: 150,
  },
  {
    username: 'member02',
    email: 'member2@bgsc.in',
    password: 'Member@123',
    role: 'member',
    interests: ['cricket', 'running'],
    contact: '9000000006',
    pointsBalance: 200,
  },
  {
    username: 'player01',
    email: 'player@bgsc.in',
    password: 'Player@123',
    role: 'user',
    interests: ['esports', 'table-tennis'],
    contact: '9000000007',
    pointsBalance: 50,
  },
  {
    username: 'player02',
    email: 'player2@bgsc.in',
    password: 'Player@123',
    role: 'user',
    interests: ['football', 'chess'],
    contact: '9000000008',
    pointsBalance: 75,
  },
  {
    username: 'guest01',
    email: 'guest@bgsc.in',
    password: 'Guest@123',
    role: 'guest',
    interests: [],
    contact: null,
  },
];

const sponsors: SeedSponsor[] = [
  {
    key: 'blue-hawks',
    name: 'Blue Hawks Gaming',
    logoUrl: 'https://example.com/sponsors/blue-hawks.png',
    description: 'Campus esports and competitive gaming partner.',
    websiteUrl: 'https://example.com/blue-hawks',
    tenureStart: `${CURRENT_YEAR}-01-01`,
    tenureEnd: `${CURRENT_YEAR}-12-31`,
    status: 'active',
  },
  {
    key: 'campus-fuel',
    name: 'Campus Fuel',
    logoUrl: 'https://example.com/sponsors/campus-fuel.png',
    description: 'Sports nutrition and event-day refreshment sponsor.',
    websiteUrl: 'https://example.com/campus-fuel',
    tenureStart: `${CURRENT_YEAR}-01-01`,
    tenureEnd: `${CURRENT_YEAR}-12-31`,
    status: 'active',
  },
  {
    key: 'stride-labs',
    name: 'Stride Labs',
    logoUrl: 'https://example.com/sponsors/stride-labs.png',
    description: 'Fitness tracking and performance analytics sponsor.',
    websiteUrl: 'https://example.com/stride-labs',
    tenureStart: `${CURRENT_YEAR}-01-01`,
    tenureEnd: `${CURRENT_YEAR}-12-31`,
    status: 'active',
  },
];

const sponsorAssignments: SeedSponsorAssignment[] = [
  {
    username: 'member01',
    sponsorKey: 'blue-hawks',
    fanCount: 25,
    eventsWon: ['bgsc-opening-cup'],
    totalPointsContributed: 150,
  },
  {
    username: 'player01',
    sponsorKey: 'blue-hawks',
    fanCount: 10,
    eventsWon: [],
    totalPointsContributed: 50,
  },
  {
    username: 'member02',
    sponsorKey: 'campus-fuel',
    fanCount: 30,
    eventsWon: ['bgsc-cricket-showdown'],
    totalPointsContributed: 200,
  },
  {
    username: 'player02',
    sponsorKey: 'stride-labs',
    fanCount: 15,
    eventsWon: ['bgsc-chess-night'],
    totalPointsContributed: 75,
  },
];

// Stable UUIDs — deterministic so re-runs stay idempotent
const EVENT_ID = {
  openingCup:      '10000000-0000-4000-8000-000000000001',
  cricketShowdown: '10000000-0000-4000-8000-000000000002',
  chessNight:      '10000000-0000-4000-8000-000000000003',
  airball5v5:      '10000000-0000-4000-8000-000000000004',
  valorantOpen:    '10000000-0000-4000-8000-000000000005',
} as const;

const events: SeedEvent[] = [
  // ── Past events ──────────────────────────────────────────────────────────
  {
    id: EVENT_ID.openingCup,
    title: 'BGSC Opening Cup',
    description: 'Annual 5v5 football league kicking off the academic year. Teams compete for the cup and sponsor fans.',
    type: 'LE',
    status: 'past',
    startDate: '2025-09-01T09:00:00Z',
    endDate: '2025-09-01T18:00:00Z',
    registrationDeadline: '2025-08-25T23:59:59Z',
    venue: 'Main Ground, BITS Goa',
    needsLeaderboard: true,
    maxParticipants: 32,
    tags: ['football', '5v5', 'sports'],
    createdByUsername: 'founder01',
  },
  {
    id: EVENT_ID.cricketShowdown,
    title: 'Cricket Showdown',
    description: 'T10 cricket tournament open to all BITS Goa students.',
    type: 'LE',
    status: 'past',
    startDate: '2025-10-15T08:00:00Z',
    endDate: '2025-10-15T20:00:00Z',
    registrationDeadline: '2025-10-10T23:59:59Z',
    venue: 'Cricket Ground, BITS Goa',
    needsLeaderboard: true,
    maxParticipants: 20,
    tags: ['cricket', 'sports'],
    createdByUsername: 'coordinator01',
  },
  {
    id: EVENT_ID.chessNight,
    title: 'Chess Night',
    description: 'Single-elimination rapid chess tournament. No scores — winner declared directly.',
    type: 'DE',
    status: 'past',
    startDate: '2025-11-08T18:00:00Z',
    endDate: '2025-11-08T23:00:00Z',
    registrationDeadline: '2025-11-06T23:59:59Z',
    venue: 'SAC Room 101, BITS Goa',
    needsLeaderboard: false,
    maxParticipants: 16,
    tags: ['chess', 'esports'],
    createdByUsername: 'core01',
  },
  // ── Ongoing ───────────────────────────────────────────────────────────────
  {
    id: EVENT_ID.valorantOpen,
    title: 'Valorant Open',
    description: 'BGEC Valorant team-deathmatch tournament. Live leaderboard updated after each round.',
    type: 'LE',
    status: 'ongoing',
    startDate: '2026-06-20T14:00:00Z',
    endDate: '2026-07-05T22:00:00Z',
    registrationDeadline: '2026-06-18T23:59:59Z',
    venue: 'Online — Discord Server',
    needsLeaderboard: true,
    maxParticipants: 32,
    tags: ['valorant', 'esports', 'bgec'],
    createdByUsername: 'coordinator01',
  },
  // ── Upcoming ──────────────────────────────────────────────────────────────
  {
    id: EVENT_ID.airball5v5,
    title: 'Airball 5v5 Season 2',
    description: 'Season 2 of the flagship basketball 5v5 league. Register early — only 20 slots.',
    type: 'LE',
    status: 'upcoming',
    startDate: '2027-01-15T09:00:00Z',
    endDate: '2027-01-15T18:00:00Z',
    registrationDeadline: '2027-01-08T23:59:59Z',
    venue: 'Basketball Court, BITS Goa',
    needsLeaderboard: true,
    maxParticipants: 20,
    tags: ['basketball', 'airball', 'sports'],
    createdByUsername: 'founder01',
  },
];

// Registrations: who is signed up for which event
const registrations: SeedRegistration[] = [
  // Opening Cup (past-LE)
  { eventId: EVENT_ID.openingCup, username: 'member01' },
  { eventId: EVENT_ID.openingCup, username: 'player01' },
  { eventId: EVENT_ID.openingCup, username: 'core01' },
  { eventId: EVENT_ID.openingCup, username: 'core02' },
  // Cricket Showdown (past-LE)
  { eventId: EVENT_ID.cricketShowdown, username: 'member02' },
  { eventId: EVENT_ID.cricketShowdown, username: 'player02' },
  { eventId: EVENT_ID.cricketShowdown, username: 'coordinator01' },
  // Chess Night (past-DE)
  { eventId: EVENT_ID.chessNight, username: 'player02' },
  { eventId: EVENT_ID.chessNight, username: 'player01' },
  // Valorant Open (ongoing-LE)
  { eventId: EVENT_ID.valorantOpen, username: 'player01' },
  { eventId: EVENT_ID.valorantOpen, username: 'player02' },
  { eventId: EVENT_ID.valorantOpen, username: 'member01' },
  // Airball 5v5 (upcoming - registered but no points yet)
  { eventId: EVENT_ID.airball5v5, username: 'member01' },
  { eventId: EVENT_ID.airball5v5, username: 'player01' },
  { eventId: EVENT_ID.airball5v5, username: 'player02' },
  { eventId: EVENT_ID.airball5v5, username: 'member02' },
];

// Scores: only for LE events (past or ongoing)
const scores: SeedScore[] = [
  // Opening Cup — member01 wins
  { eventId: EVENT_ID.openingCup, username: 'member01', score: 100, submittedByUsername: 'founder01' },
  { eventId: EVENT_ID.openingCup, username: 'player01',  score: 80,  submittedByUsername: 'founder01' },
  { eventId: EVENT_ID.openingCup, username: 'core01',    score: 60,  submittedByUsername: 'founder01' },
  { eventId: EVENT_ID.openingCup, username: 'core02',    score: 40,  submittedByUsername: 'founder01' },
  // Cricket Showdown — member02 wins
  { eventId: EVENT_ID.cricketShowdown, username: 'member02',     score: 95, submittedByUsername: 'coordinator01' },
  { eventId: EVENT_ID.cricketShowdown, username: 'player02',     score: 70, submittedByUsername: 'coordinator01' },
  { eventId: EVENT_ID.cricketShowdown, username: 'coordinator01', score: 55, submittedByUsername: 'coordinator01' },
  // Valorant Open (ongoing mid-tournament scores)
  { eventId: EVENT_ID.valorantOpen, username: 'player01',  score: 120, submittedByUsername: 'coordinator01' },
  { eventId: EVENT_ID.valorantOpen, username: 'player02',  score: 95,  submittedByUsername: 'coordinator01' },
  { eventId: EVENT_ID.valorantOpen, username: 'member01',  score: 80,  submittedByUsername: 'coordinator01' },
];

// Point transactions: participation (10pts) for all completed/ongoing registrations
// + podium bonuses (50/30/20pts) for past LE events
// ponytail: upcoming events get no transactions — points awarded on participation, not registration
const transactions: SeedTransaction[] = [
  // ── Opening Cup participation ─────────────────────────────────────────────
  { username: 'member01',     amount: 10, type: 'earn', source: 'event', referenceId: EVENT_ID.openingCup },
  { username: 'player01',     amount: 10, type: 'earn', source: 'event', referenceId: EVENT_ID.openingCup },
  { username: 'core01',       amount: 10, type: 'earn', source: 'event', referenceId: EVENT_ID.openingCup },
  { username: 'core02',       amount: 10, type: 'earn', source: 'event', referenceId: EVENT_ID.openingCup },
  // Opening Cup podium bonuses
  { username: 'member01', amount: 50, type: 'earn', source: 'leaderboard', referenceId: EVENT_ID.openingCup },
  { username: 'player01', amount: 30, type: 'earn', source: 'leaderboard', referenceId: EVENT_ID.openingCup },
  { username: 'core01',   amount: 20, type: 'earn', source: 'leaderboard', referenceId: EVENT_ID.openingCup },

  // ── Cricket Showdown participation ────────────────────────────────────────
  { username: 'member02',      amount: 10, type: 'earn', source: 'event', referenceId: EVENT_ID.cricketShowdown },
  { username: 'player02',      amount: 10, type: 'earn', source: 'event', referenceId: EVENT_ID.cricketShowdown },
  { username: 'coordinator01', amount: 10, type: 'earn', source: 'event', referenceId: EVENT_ID.cricketShowdown },
  // Cricket Showdown podium bonuses
  { username: 'member02',      amount: 50, type: 'earn', source: 'leaderboard', referenceId: EVENT_ID.cricketShowdown },
  { username: 'player02',      amount: 30, type: 'earn', source: 'leaderboard', referenceId: EVENT_ID.cricketShowdown },
  { username: 'coordinator01', amount: 20, type: 'earn', source: 'leaderboard', referenceId: EVENT_ID.cricketShowdown },

  // ── Chess Night participation (DE — no podium points, just participation) ─
  { username: 'player02', amount: 10, type: 'earn', source: 'event', referenceId: EVENT_ID.chessNight },
  { username: 'player01', amount: 10, type: 'earn', source: 'event', referenceId: EVENT_ID.chessNight },

  // ── Valorant Open participation (ongoing) ─────────────────────────────────
  { username: 'player01', amount: 10, type: 'earn', source: 'event', referenceId: EVENT_ID.valorantOpen },
  { username: 'player02', amount: 10, type: 'earn', source: 'event', referenceId: EVENT_ID.valorantOpen },
  { username: 'member01', amount: 10, type: 'earn', source: 'event', referenceId: EVENT_ID.valorantOpen },
];

// ── Seed runner ───────────────────────────────────────────────────────────────

async function seed() {
  const url =
    process.env.DATABASE_URL ??
    'postgresql://bgsc:bgsc_pass@localhost:5432/bgsc_dev';

  const ds = new DataSource({ type: 'postgres', url });
  await ds.initialize();
  console.log('Connected to database\n');

  // ── Users ──────────────────────────────────────────────────────────────────
  console.log('── Users ──');
  const userIds = new Map<string, string>();
  let insertedUsers = 0;
  let skippedUsers = 0;

  for (const u of users) {
    const existing = await ds.query<Array<{ id: string }>>(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [u.username, u.email],
    );

    if (existing.length > 0) {
      console.log(`  SKIP  ${u.username}`);
      userIds.set(u.username, existing[0].id);
      skippedUsers++;
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);

    const inserted = await ds.query<Array<{ id: string }>>(
      `INSERT INTO users (username, email, password_hash, role, status, interests, contact, points_balance, socials, settings, newsletter_subscriptions)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, '{}'::jsonb, '{}'::jsonb, '{}')
       RETURNING id`,
      [u.username, u.email, passwordHash, u.role, u.interests, u.contact, u.pointsBalance ?? 0],
    );

    userIds.set(u.username, inserted[0].id);
    console.log(`  INSERT  ${u.username} (${u.role})`);
    insertedUsers++;
  }

  // ── Sponsors ──────────────────────────────────────────────────────────────
  console.log('\n── Sponsors ──');
  const sponsorIds = new Map<string, string>();
  let upsertedSponsors = 0;

  for (const sponsor of sponsors) {
    const result = await ds.query<Array<{ id: string }>>(
      `INSERT INTO sponsors (name, logo_url, description, website_url, tenure_start, tenure_end, status, total_fans)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0)
       ON CONFLICT (name) DO UPDATE SET
         logo_url = EXCLUDED.logo_url,
         description = EXCLUDED.description,
         website_url = EXCLUDED.website_url,
         tenure_start = EXCLUDED.tenure_start,
         tenure_end = EXCLUDED.tenure_end,
         status = EXCLUDED.status,
         updated_at = now()
       RETURNING id`,
      [sponsor.name, sponsor.logoUrl, sponsor.description, sponsor.websiteUrl, sponsor.tenureStart, sponsor.tenureEnd, sponsor.status],
    );

    sponsorIds.set(sponsor.key, result[0].id);
    upsertedSponsors++;
    console.log(`  UPSERT  ${sponsor.name}`);
  }

  // ── Sponsor affiliations ──────────────────────────────────────────────────
  console.log('\n── Sponsor affiliations ──');
  let upsertedAffiliations = 0;

  for (const assignment of sponsorAssignments) {
    const userId = userIds.get(assignment.username);
    const sponsorId = sponsorIds.get(assignment.sponsorKey);

    if (!userId || !sponsorId) {
      console.log(`  SKIP  ${assignment.username} affiliation (missing user or sponsor)`);
      continue;
    }

    await ds.query(
      `INSERT INTO user_sponsor_affiliations (user_id, sponsor_id, fan_count, events_won, total_points_contributed)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, sponsor_id) DO UPDATE SET
         fan_count = EXCLUDED.fan_count,
         events_won = EXCLUDED.events_won,
         total_points_contributed = EXCLUDED.total_points_contributed,
         updated_at = now()`,
      [userId, sponsorId, assignment.fanCount, assignment.eventsWon, assignment.totalPointsContributed],
    );

    await ds.query(
      `UPDATE users SET active_sponsor_id = $1 WHERE id = $2 AND active_sponsor_id IS NULL`,
      [sponsorId, userId],
    );

    upsertedAffiliations++;
    console.log(`  UPSERT  ${assignment.username} → ${assignment.sponsorKey}`);
  }

  for (const sponsorId of sponsorIds.values()) {
    await ds.query(
      `UPDATE sponsors
       SET total_fans = (SELECT COALESCE(SUM(fan_count), 0) FROM user_sponsor_affiliations WHERE sponsor_id = $1)
       WHERE id = $1`,
      [sponsorId],
    );
  }

  // ── Events ────────────────────────────────────────────────────────────────
  console.log('\n── Events ──');
  let insertedEvents = 0;
  let skippedEvents = 0;

  for (const ev of events) {
    const createdBy = userIds.get(ev.createdByUsername);
    if (!createdBy) {
      console.log(`  SKIP  ${ev.title} (createdByUsername not found: ${ev.createdByUsername})`);
      continue;
    }

    await ds.query(
      `INSERT INTO events
         (id, title, description, type, status, start_date, end_date, registration_deadline,
          venue, needs_leaderboard, max_participants, tags, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         status = EXCLUDED.status,
         venue = EXCLUDED.venue,
         needs_leaderboard = EXCLUDED.needs_leaderboard,
         max_participants = EXCLUDED.max_participants,
         tags = EXCLUDED.tags,
         updated_at = now()`,
      [
        ev.id, ev.title, ev.description, ev.type, ev.status,
        ev.startDate, ev.endDate, ev.registrationDeadline,
        ev.venue, ev.needsLeaderboard, ev.maxParticipants, ev.tags, createdBy,
      ],
    );

    console.log(`  UPSERT  ${ev.title} (${ev.type}/${ev.status})`);
    insertedEvents++;
  }

  // ── Registrations ─────────────────────────────────────────────────────────
  console.log('\n── Registrations ──');
  let insertedRegs = 0;
  let skippedRegs = 0;

  for (const reg of registrations) {
    const userId = userIds.get(reg.username);
    if (!userId) {
      console.log(`  SKIP  ${reg.username} reg (user not found)`);
      continue;
    }

    const result = await ds.query<Array<{ id: string }>>(
      `INSERT INTO registrations (event_id, user_id, status)
       VALUES ($1, $2, 'confirmed')
       ON CONFLICT (event_id, user_id) DO NOTHING
       RETURNING id`,
      [reg.eventId, userId],
    );

    if (result.length > 0) {
      console.log(`  INSERT  ${reg.username} → ${eventTitle(reg.eventId)}`);
      insertedRegs++;
    } else {
      skippedRegs++;
    }
  }

  // ── Event scores ──────────────────────────────────────────────────────────
  console.log('\n── Event scores ──');
  let insertedScores = 0;
  let skippedScores = 0;

  for (const s of scores) {
    const userId = userIds.get(s.username);
    const submittedBy = userIds.get(s.submittedByUsername);
    if (!userId || !submittedBy) {
      console.log(`  SKIP  score for ${s.username} (user not found)`);
      continue;
    }

    const result = await ds.query<Array<{ id: string }>>(
      `INSERT INTO event_scores (event_id, user_id, score, submitted_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id, user_id) DO UPDATE SET
         score = EXCLUDED.score,
         submitted_by = EXCLUDED.submitted_by
       RETURNING id`,
      [s.eventId, userId, s.score, submittedBy],
    );

    if (result.length > 0) {
      console.log(`  UPSERT  ${s.username} score=${s.score} @ ${eventTitle(s.eventId)}`);
      insertedScores++;
    } else {
      skippedScores++;
    }
  }

  // ── Point transactions ────────────────────────────────────────────────────
  // Idempotent: skip if identical (user, amount, type, source, referenceId) already exists
  console.log('\n── Point transactions ──');
  let insertedTxns = 0;
  let skippedTxns = 0;

  for (const tx of transactions) {
    const userId = userIds.get(tx.username);
    if (!userId) {
      console.log(`  SKIP  tx for ${tx.username} (user not found)`);
      continue;
    }

    const exists = await ds.query<Array<{ id: string }>>(
      `SELECT id FROM point_transactions
       WHERE user_id = $1 AND type = $2 AND source = $3
         AND (reference_id = $4 OR ($4 IS NULL AND reference_id IS NULL))
         AND amount = $5
       LIMIT 1`,
      [userId, tx.type, tx.source, tx.referenceId, tx.amount],
    );

    if (exists.length > 0) {
      skippedTxns++;
      continue;
    }

    await ds.query(
      `INSERT INTO point_transactions (user_id, amount, type, source, reference_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, tx.amount, tx.type, tx.source, tx.referenceId],
    );

    console.log(`  INSERT  ${tx.username} +${tx.amount}pts (${tx.source}/${tx.type})`);
    insertedTxns++;
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`
── Done ──────────────────────────────────────
  users:         ${insertedUsers} inserted, ${skippedUsers} skipped
  sponsors:      ${upsertedSponsors} upserted
  affiliations:  ${upsertedAffiliations} upserted
  events:        ${insertedEvents} upserted
  registrations: ${insertedRegs} inserted, ${skippedRegs} skipped
  scores:        ${insertedScores} upserted, ${skippedScores} skipped
  transactions:  ${insertedTxns} inserted, ${skippedTxns} skipped
──────────────────────────────────────────────`);

  await ds.destroy();
}

function eventTitle(id: string): string {
  return (
    Object.entries(EVENT_ID).find(([, v]) => v === id)?.[0] ?? id.slice(0, 8)
  );
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
