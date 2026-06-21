import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;
const CURRENT_YEAR = new Date().getUTCFullYear();

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

async function seed() {
  const url =
    process.env.DATABASE_URL ??
    'postgresql://bgsc:bgsc_pass@localhost:5432/bgsc_dev';

  const ds = new DataSource({ type: 'postgres', url });
  await ds.initialize();
  console.log('Connected to database');

  const userIds = new Map<string, string>();
  let insertedUsers = 0;
  let skippedUsers = 0;

  for (const u of users) {
    const existing = await ds.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [u.username, u.email],
    );

    if (existing.length > 0) {
      console.log(`  SKIP  ${u.username} (already exists)`);
      userIds.set(u.username, existing[0].id);
      skippedUsers++;
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);

    const inserted = await ds.query(
      `INSERT INTO users (username, email, password_hash, role, status, interests, contact, points_balance, socials, settings, newsletter_subscriptions)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, '{}'::jsonb, '{}'::jsonb, '{}')
       RETURNING id`,
      [
        u.username,
        u.email,
        passwordHash,
        u.role,
        u.interests,
        u.contact,
        u.pointsBalance ?? 0,
      ],
    );

    userIds.set(u.username, inserted[0].id);
    console.log(`  INSERT  ${u.username} (${u.role})`);
    insertedUsers++;
  }

  const sponsorIds = new Map<string, string>();
  let upsertedSponsors = 0;

  for (const sponsor of sponsors) {
    const result = await ds.query(
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
      [
        sponsor.name,
        sponsor.logoUrl,
        sponsor.description,
        sponsor.websiteUrl,
        sponsor.tenureStart,
        sponsor.tenureEnd,
        sponsor.status,
      ],
    );

    sponsorIds.set(sponsor.key, result[0].id);
    upsertedSponsors++;
    console.log(`  UPSERT  ${sponsor.name} (${sponsor.status})`);
  }

  let upsertedAffiliations = 0;

  for (const assignment of sponsorAssignments) {
    const userId = userIds.get(assignment.username);
    const sponsorId = sponsorIds.get(assignment.sponsorKey);

    if (!userId || !sponsorId) {
      console.log(
        `  SKIP  ${assignment.username} sponsor assignment (missing user or sponsor)`,
      );
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
      [
        userId,
        sponsorId,
        assignment.fanCount,
        assignment.eventsWon,
        assignment.totalPointsContributed,
      ],
    );

    await ds.query(
      `UPDATE users
       SET active_sponsor_id = $1
       WHERE id = $2 AND active_sponsor_id IS NULL`,
      [sponsorId, userId],
    );

    upsertedAffiliations++;
    console.log(`  UPSERT  ${assignment.username} sponsor affiliation`);
  }

  for (const sponsorId of sponsorIds.values()) {
    await ds.query(
      `UPDATE sponsors
       SET total_fans = (
         SELECT COALESCE(SUM(fan_count), 0)
         FROM user_sponsor_affiliations
         WHERE sponsor_id = $1
       )
       WHERE id = $1`,
      [sponsorId],
    );
  }

  console.log(
    `\nSeeding complete: ${insertedUsers} users inserted, ${skippedUsers} users skipped, ${upsertedSponsors} sponsors upserted, ${upsertedAffiliations} affiliations upserted`,
  );
  await ds.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
