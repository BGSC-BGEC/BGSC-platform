import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

const users = [
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

async function seed() {
  const url =
    process.env.DATABASE_URL ??
    'postgresql://bgsc:bgsc_pass@localhost:5432/bgsc_dev';

  const ds = new DataSource({ type: 'postgres', url });
  await ds.initialize();
  console.log('Connected to database');

  let inserted = 0;
  let skipped = 0;

  for (const u of users) {
    const existing = await ds.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [u.username, u.email],
    );

    if (existing.length > 0) {
      console.log(`  SKIP  ${u.username} (already exists)`);
      skipped++;
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS);

    await ds.query(
      `INSERT INTO users (username, email, password_hash, role, status, interests, contact, points_balance, socials, settings, newsletter_subscriptions)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, '{}'::jsonb, '{}'::jsonb, '{}')`,
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

    console.log(`  INSERT  ${u.username} (${u.role})`);
    inserted++;
  }

  console.log(`\nSeeding complete: ${inserted} inserted, ${skipped} skipped`);
  await ds.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
