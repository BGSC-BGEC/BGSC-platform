/**
 * Mock API Gateway Server for BGSC Mobile Frontend Development
 * Runs on http://localhost:3000 and serves all 12 backend microservices routes
 */
const http = require('http');

const PORT = 3000;

// In-memory mock data
const mockUser = {
  id: 'dev-user-001',
  username: 'zenodev',
  email: 'zeno@goa.bits-pilani.ac.in',
  role: 'member',
  status: 'active',
  is_email_verified: true,
  is_phone_verified: true,
  points_balance: 1250,
  profile: {
    full_name: 'Zeno Developer',
    avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
    phone_number: '+91 9876543210',
    bio: 'Frontend engineer & esports enthusiast @ BITS Goa',
    college_id: '2023A7PS0001G',
    interests: ['badminton', 'football', 'valorant', 'chess'],
    social_links: {
      instagram: 'zenodev',
      discord_id: 'zeno#1337',
      steam_id: 'zenodev',
    },
  },
  player_card: {
    card_tier: 'Gold',
    stats: { matches: 24, wins: 18, mvp_count: 6 },
  },
  settings: {
    theme: 'dark',
    privacy: { is_profile_public: true },
    notifications: { email: true, whatsapp: true },
  },
};

const mockPlayerCard = {
  user_id: 'dev-user-001',
  username: 'zenodev',
  avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
  bio: 'Frontend engineer & esports enthusiast @ BITS Goa',
  interests: ['badminton', 'football', 'valorant', 'chess'],
  card_tier: 'Gold',
  rating: 1850,
  social_links: { instagram: 'zenodev', linkedin: null, steam_id: 'zenodev' },
  stats: {
    inputs: {
      participations: 12,
      podiums: 4,
      challenges: 8,
      points_balance: 1250,
    },
  },
};

const mockStandings = [
  {
    rank: 1,
    user_id: 'user-001',
    display_name: 'Maverick',
    username: 'maverick',
    avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
    points: 3444,
  },
  {
    rank: 2,
    user_id: 'user-002',
    display_name: 'CoolCat',
    username: 'coolcat',
    avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=120&q=80',
    points: 2412,
  },
  {
    rank: 3,
    user_id: 'user-003',
    display_name: 'Sunshine',
    username: 'sunshine',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    points: 2299,
  },
  {
    rank: 4,
    user_id: 'user-004',
    display_name: 'Quirky',
    username: 'quirky',
    avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
    points: 1241,
  },
  {
    rank: 5,
    user_id: 'user-005',
    display_name: 'Sneaky',
    username: 'sneaky',
    avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&q=80',
    points: 1104,
  },
  {
    rank: 6,
    user_id: 'user-006',
    display_name: 'StarryEyed',
    username: 'starryeyed',
    avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80',
    points: 974,
  },
  {
    rank: 7,
    user_id: 'user-007',
    display_name: 'Shadowfax',
    username: 'shadowfax',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
    points: 890,
  },
  {
    rank: 8,
    user_id: 'user-008',
    display_name: 'Blaze',
    username: 'blaze',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80',
    points: 810,
  },
  {
    rank: 9,
    user_id: 'user-009',
    display_name: 'Storm',
    username: 'storm',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
    points: 740,
  },
  {
    rank: 10,
    user_id: 'dev-user-001',
    display_name: 'Zeno Developer',
    username: 'zenodev',
    avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
    points: 680,
  },
];

const mockEvents = [
  {
    _id: 'evt-001',
    id: 'evt-001',
    slug: 'valorant-championship-2026',
    title: 'Inter-Hostel Valorant Championship',
    description: 'The premier 5v5 tactical shooter tournament at BITS Goa. Double elimination bracket with prizes worth 10,000 points.',
    type: 'DE',
    category: 'bgec',
    domain: 'esports',
    tags: ['valorant', 'esports', 'bgec'],
    status: 'ongoing',
    visibility: 'public',
    start_at: new Date(Date.now() + 86400000).toISOString(),
    end_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    venue: 'LT-1 & SAC Gaming Lounge',
    timezone: 'Asia/Kolkata',
    cover_media_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80',
    logo_url: null,
    rules_pdf_url: null,
    rules_summary: 'Standard competitive 5v5 rules. Map vetos done 15m before match start.',
    registration: {
      opens_at: new Date(Date.now() - 7 * 86400000).toISOString(),
      closes_at: new Date(Date.now() + 86400000).toISOString(),
      roster_finalizes_at: null,
      form_id: 'form-001',
      max_participants: 64,
      waitlist_enabled: true,
      requires_approval: false,
    },
    teaming: {
      is_teamed: true,
      team_size_min: 5,
      team_size_max: 6,
      max_teams: 16,
      captain_application_required: false,
    },
    awards: [
      { place: 1, title: 'Grand Champion', description: '5,000 BGSC Points + Trophy' },
      { place: 2, title: 'Finalist', description: '2,500 BGSC Points' },
      { place: 3, title: 'Semi-Finalist', description: '1,000 BGSC Points' },
    ],
    contacts: [
      { user_id: 'user-001', display_name: 'Maverick', role_label: 'Tournament Director', contact: 'maverick@bits-goa.ac.in' },
    ],
    leaderboard: {
      format: 'double_elimination',
      min_participants: 8,
    },
    auction: null,
    counts: {
      registrations_confirmed: 64,
    },
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    _id: 'evt-002',
    id: 'evt-002',
    slug: 'badminton-premier-league',
    title: 'BGSC Badminton Premier League (BPL)',
    description: 'Men and Women singles, doubles and mixed doubles championship. Live player auction for captain franchises.',
    type: 'ALL',
    category: 'leagues',
    domain: 'sports',
    tags: ['badminton', 'bpl', 'leagues'],
    status: 'ongoing',
    visibility: 'public',
    start_at: new Date(Date.now() + 2 * 86400000).toISOString(),
    end_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    venue: 'Student Activity Centre (SAC)',
    timezone: 'Asia/Kolkata',
    cover_media_url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80',
    logo_url: null,
    rules_pdf_url: null,
    rules_summary: 'BWF standard rules. Synthetic courts; non-marking indoor shoes mandatory.',
    registration: {
      opens_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      closes_at: new Date(Date.now() + 86400000).toISOString(),
      roster_finalizes_at: null,
      form_id: 'form-002',
      max_participants: 40,
      waitlist_enabled: true,
      requires_approval: true,
    },
    teaming: {
      is_teamed: true,
      team_size_min: 4,
      team_size_max: 6,
      max_teams: 8,
      captain_application_required: true,
    },
    awards: [
      { place: 1, title: 'BPL Champions', description: '10,000 BGSC Points + Shield' },
      { place: 2, title: 'Runners-up', description: '5,000 BGSC Points' },
    ],
    contacts: [
      { user_id: 'admin-001', display_name: 'Sports Secretary', role_label: 'Sports Secretary', contact: 'sports@bits-goa.ac.in' },
    ],
    leaderboard: {
      format: 'round_robin',
      min_participants: 8,
    },
    auction: {
      k_multiplier: 1.2,
      min_bid_increment: 100,
      bid_timer_seconds: 30,
      status: 'live',
      captain_user_ids: ['user-001', 'user-002'],
      purse_per_team: 100000,
    },
    counts: {
      registrations_confirmed: 32,
    },
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    _id: 'evt-003',
    id: 'evt-003',
    slug: 'campus-5k-night-run',
    title: 'FitSoc Midnight 5K Campus Run',
    description: 'A 5-kilometer neon run across the campus ring road with electronic timing and Strava sync.',
    type: 'DE',
    category: 'fitsoc',
    domain: 'fitness',
    tags: ['fitsoc', 'running', 'fitness'],
    status: 'upcoming',
    visibility: 'public',
    start_at: new Date(Date.now() + 4 * 86400000).toISOString(),
    end_at: new Date(Date.now() + 4 * 86400000 + 7200000).toISOString(),
    venue: 'Main Gate Roundabout',
    timezone: 'Asia/Kolkata',
    cover_media_url: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=800&q=80',
    logo_url: null,
    rules_pdf_url: null,
    rules_summary: 'Wear neon wristbands provided at registration desk.',
    registration: {
      opens_at: new Date(Date.now() - 86400000).toISOString(),
      closes_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      roster_finalizes_at: null,
      form_id: 'form-003',
      max_participants: 200,
      waitlist_enabled: false,
      requires_approval: false,
    },
    teaming: {
      is_teamed: false,
      team_size_min: null,
      team_size_max: null,
      max_teams: null,
      captain_application_required: false,
    },
    awards: [
      { place: 1, title: 'First Across Line', description: 'FitSoc Trophy + 1,000 Points' },
    ],
    contacts: [
      { user_id: 'admin-002', display_name: 'FitSoc Lead', role_label: 'Convener', contact: 'fitsoc@bits-goa.ac.in' },
    ],
    leaderboard: null,
    auction: null,
    counts: {
      registrations_confirmed: 112,
    },
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    _id: 'evt-004',
    id: 'evt-004',
    slug: 'bgsc-annual-sports-quiz',
    title: 'BGSC Annual Sports & Esports Trivia Night',
    description: 'Test your knowledge on sports history, tactical esports trivia, and campus gaming lore. Exciting prizes and club points.',
    type: 'ALL',
    category: 'general',
    domain: 'general',
    tags: ['general', 'quiz', 'trivia', 'social'],
    status: 'upcoming',
    visibility: 'public',
    start_at: new Date(Date.now() + 6 * 86400000).toISOString(),
    end_at: new Date(Date.now() + 6 * 86400000 + 10800000).toISOString(),
    venue: 'Main Auditorium · Hall A',
    timezone: 'Asia/Kolkata',
    cover_media_url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=800&q=80',
    logo_url: null,
    rules_pdf_url: null,
    rules_summary: 'Teams of 2 or solo. 4 rounds: Buzzer, Audio-Visual, Rapid Fire, and Wagering.',
    registration: {
      opens_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      closes_at: new Date(Date.now() + 5 * 86400000).toISOString(),
      roster_finalizes_at: null,
      form_id: 'form-004',
      max_participants: 120,
      waitlist_enabled: true,
      requires_approval: false,
    },
    teaming: {
      is_teamed: true,
      team_size_min: 1,
      team_size_max: 2,
      max_teams: 60,
      captain_application_required: false,
    },
    awards: [
      { place: 1, title: 'Quiz Champions', description: '3,000 BGSC Points + Trophies' },
      { place: 2, title: 'Runners-up', description: '1,500 BGSC Points' },
    ],
    contacts: [
      { user_id: 'admin-001', display_name: 'Club Lead', role_label: 'Convener', contact: 'lead@bits-goa.ac.in' },
    ],
    leaderboard: null,
    auction: null,
    counts: {
      registrations_confirmed: 48,
    },
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockAnnouncements = [
  {
    _id: 'ann-001',
    id: 'ann-001',
    title: 'BPL 2026 Captain Registrations are now LIVE!',
    body: 'Captains can now submit their team registrations and download the player draft pool. Auction purse is fixed at 100k BGSC coins per franchise.',
    categories: ['teams', 'highlight'],
    tags: ['bpl', 'badminton'],
    priority: 'important',
    audience: { min_role: 'member', event_id: 'evt-002' },
    pinned_until: new Date(Date.now() + 86400000 * 3).toISOString(),
    author: {
      user_id: 'admin-001',
      display_name: 'Sports Secretary',
      role_label: 'Sports Secretary',
      avatar_url: null,
    },
    published_at: new Date(Date.now() - 3600000).toISOString(),
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    _id: 'ann-002',
    id: 'ann-002',
    title: 'SAC Badminton Courts Resurfacing Complete',
    body: 'All 3 synthetic badminton courts at SAC are back open starting tomorrow morning. Please use non-marking shoes only.',
    categories: ['general'],
    tags: ['sac', 'facility'],
    priority: 'normal',
    audience: { min_role: 'member', event_id: null },
    pinned_until: null,
    author: {
      user_id: 'admin-002',
      display_name: 'BGSC Logistics',
      role_label: 'Operations Lead',
      avatar_url: null,
    },
    published_at: new Date(Date.now() - 86400000).toISOString(),
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

const mockChallenges = [
  {
    _id: 'ch-001',
    slug: 'weekly-15k-run',
    title: '15km Weekly Distance Quest',
    description: 'Log a total of 15 kilometers of running or jogging this week using Strava.',
    cover_media_url: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=600&q=80',
    brief_hidden_until_accept: false,
    domain: 'sports',
    kind: 'physical',
    difficulty: 'medium',
    award_points: 350,
    grants_hall_of_fame: false,
    status: 'active',
    window: {
      opens_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      closes_at: new Date(Date.now() + 5 * 86400000).toISOString(),
      submissions_close_at: new Date(Date.now() + 5 * 86400000).toISOString(),
      time_limit_minutes: null,
    },
    teaming: { enabled: false, team_size_min: null, team_size_max: null },
    location: { name: 'Campus Ring Road', details: null },
    resources: [],
    submission: { requires_proof: true, proof_types: ['strava', 'screenshot'], max_files: 2, auto_approve: false },
    counts: { accepted: 88, submitted: 34, approved: 22 },
  },
  {
    _id: 'ch-002',
    slug: '30-day-pushup-streak',
    title: 'Daily 50 Push-Up Streak',
    description: 'Complete 50 pushups daily for 7 consecutive days. Upload photo or Strava workout proof.',
    cover_media_url: null,
    brief_hidden_until_accept: false,
    domain: 'general',
    kind: 'physical',
    difficulty: 'hard',
    award_points: 500,
    grants_hall_of_fame: true,
    status: 'active',
    window: {
      opens_at: new Date(Date.now() - 4 * 86400000).toISOString(),
      closes_at: new Date(Date.now() + 10 * 86400000).toISOString(),
      submissions_close_at: new Date(Date.now() + 10 * 86400000).toISOString(),
      time_limit_minutes: null,
    },
    teaming: { enabled: false, team_size_min: null, team_size_max: null },
    location: null,
    resources: [],
    submission: { requires_proof: true, proof_types: ['photo'], max_files: 3, auto_approve: false },
    counts: { accepted: 42, submitted: 15, approved: 8 },
  },
];

const mockParticipations = [
  {
    _id: 'part-01',
    challenge_id: 'ch-001',
    challenge_snapshot: {
      title: '15km Weekly Distance Quest',
      difficulty: 'medium',
      award_points: 350,
    },
    participant: { type: 'user', id: 'dev-user-001', display_name: 'Zeno Developer' },
    status: 'accepted',
    accepted_at: new Date(Date.now() - 86400000).toISOString(),
    deadline_at: new Date(Date.now() + 5 * 86400000).toISOString(),
    progress: {
      percent: 60,
      notes: 'Completed 9km of 15km so far.',
      steps: [
        { key: 'run-1', label: 'First 5km run', done: true },
        { key: 'run-2', label: 'Second 5km run', done: true },
        { key: 'run-3', label: 'Final 5km run', done: false },
      ],
    },
    submission: null,
    review: null,
    reward: null,
  },
];

const mockNotifications = [
  {
    _id: 'notif-001',
    id: 'notif-001',
    title: 'Points Credited!',
    body: 'You earned 120 BGSC points for competing in Valorant match.',
    category: 'points',
    read: false,
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    _id: 'notif-002',
    id: 'notif-002',
    title: 'Auction Starting in 2 Hours',
    body: 'Badminton Premier League live player bidding begins at 7:00 PM.',
    category: 'events',
    read: false,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
];

const mockHallOfFameEntries = [
  {
    _id: 'hof-001',
    slug: 'valorant-champions-2025',
    category: 'event_winner',
    title: 'Valorant Fall Championship 2025 Winners',
    description: 'Undefeated run through the double elimination upper bracket to claim the Fall Trophy.',
    quote: 'We spent late nights practicing strats in C-Block LAN room.',
    honoree: {
      type: 'team',
      id: 'team-phoenix',
      display_name: 'Team Phoenix',
      avatar_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=120&q=80',
    },
    members: [
      { user_id: 'u-1', display_name: 'Maverick', avatar_url: null },
      { user_id: 'u-2', display_name: 'CoolCat', avatar_url: null },
    ],
    source: { type: 'event', id: 'evt-001', title: 'Valorant Championship' },
    achievement: { domain: 'esports', season: 'Autumn 2025', year: 2025, difficulty: 'Legendary', award_points: 2500 },
    media_url: null,
    cover_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=800&q=80',
    tags: ['valorant', 'champions'],
    featured: true,
    featured_order: 1,
    created_at: '2025-11-20T10:00:00.000Z',
  },
  {
    _id: 'hof-002',
    slug: 'marathon-legend-2025',
    category: 'challenge_legend',
    title: '500km Endurance Marathon Club',
    description: 'Logged over 500 kilometers on Strava during the monsoon term.',
    quote: 'Consistency beats intensity every single morning.',
    honoree: {
      type: 'user',
      id: 'user-002',
      display_name: 'Coolcat',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
    },
    members: [],
    source: { type: 'challenge', id: 'ch-001', title: '500km Yearly Running' },
    achievement: { domain: 'fitness', season: 'Monsoon 2025', year: 2025, difficulty: 'Epic', award_points: 3000 },
    media_url: null,
    cover_url: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=800&q=80',
    tags: ['marathon', 'fitsoc'],
    featured: true,
    featured_order: 2,
    created_at: '2025-10-15T08:00:00.000Z',
  },
];

const mockAlbums = [
  { _id: 'alb-1', title: 'Valorant Finals 2026', media_count: 14, category: 'event' },
  { _id: 'alb-2', title: 'BPL Badminton 2026', media_count: 8, category: 'event' },
];

const mockMediaItems = [
  {
    _id: 'media-01',
    id: 'media-01',
    title: 'Valorant Finals Winning Moment',
    caption: 'Championship point winning ace!',
    url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80',
    thumbnail_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=300&q=80',
    media_type: 'image',
    likes_count: 42,
    liked_by_me: true,
    uploader: {
      user_id: 'user-001',
      display_name: 'Maverick',
      avatar_url: null,
    },
  },
  {
    _id: 'media-02',
    id: 'media-02',
    title: 'BPL Smash Shot - Court 1',
    caption: 'Jump smash in the doubles semifinals',
    url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=600&q=80',
    thumbnail_url: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=300&q=80',
    media_type: 'image',
    likes_count: 28,
    liked_by_me: false,
    uploader: {
      user_id: 'user-002',
      display_name: 'Coolcat',
      avatar_url: null,
    },
  },
];

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Idempotency-Key',
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Idempotency-Key',
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;
  const query = Object.fromEntries(searchParams.entries());

  let reqBody = '';
  req.on('data', (chunk) => {
    reqBody += chunk;
  });

  req.on('end', () => {
    let parsedBody = {};
    if (reqBody) {
      try {
        parsedBody = JSON.parse(reqBody);
      } catch (e) {
        parsedBody = {};
      }
    }

    console.log(`[MockServer] ${req.method} ${pathname}`);

    // Health
    if (pathname === '/health') {
      return sendJson(res, 200, { status: 'healthy', version: '2.0.0-mock' });
    }

    // Auth Routes
    if (pathname === '/auth/login' || pathname === '/auth/magic-link/verify') {
      return sendJson(res, 200, {
        success: true,
        data: {
          user: mockUser,
          tokens: {
            access_token: 'mock-access-token-zeno-dev',
            refresh_token: 'mock-refresh-token-zeno-dev',
          },
        },
      });
    }

    if (pathname === '/auth/refresh') {
      return sendJson(res, 200, {
        success: true,
        data: {
          tokens: {
            access_token: 'mock-access-token-zeno-dev-refreshed',
            refresh_token: 'mock-refresh-token-zeno-dev-refreshed',
          },
        },
      });
    }

    if (pathname === '/auth/logout') {
      return sendJson(res, 200, { success: true, message: 'Logged out successfully' });
    }

    // User Player Cards
    if (pathname.includes('/player-card')) {
      return sendJson(res, 200, {
        success: true,
        data: mockPlayerCard,
      });
    }

    // Users / Profile
    if (pathname === '/users/me' || pathname === '/auth/me') {
      return sendJson(res, 200, {
        success: true,
        data: mockUser,
      });
    }

    if (pathname === '/users/me/profile' || pathname === '/users/me') {
      if (req.method === 'PATCH' || req.method === 'PUT') {
        Object.assign(mockUser.profile, parsedBody);
      }
      return sendJson(res, 200, {
        success: true,
        data: mockUser.profile,
      });
    }

    if (pathname.startsWith('/users/')) {
      const idOrName = pathname.split('/')[2];
      const match = mockStandings.find((s) => s.user_id === idOrName || s.username === idOrName);
      return sendJson(res, 200, {
        success: true,
        data: {
          ...mockUser,
          id: idOrName,
          username: match ? match.username : idOrName,
          profile: {
            ...mockUser.profile,
            full_name: match ? match.display_name : idOrName,
            avatar_url: match ? match.avatar_url : null,
          },
        },
      });
    }

    // Points Service
    if (pathname === '/points/me') {
      return sendJson(res, 200, {
        success: true,
        data: {
          balance: mockUser.points_balance,
          lifetime_earned: 2450,
          lifetime_spent: 1200,
        },
      });
    }

    if (pathname === '/points/me/breakdown') {
      return sendJson(res, 200, {
        success: true,
        data: {
          event: 650,
          challenge: 400,
          leaderboard: 150,
          engagement: 50,
        },
      });
    }

    if (pathname === '/points/me/transactions') {
      return sendJson(res, 200, {
        success: true,
        data: {
          transactions: [
            {
              id: 'tx-1',
              amount: 120,
              type: 'earn',
              source: 'event',
              reason: 'event.participation',
              description: 'Won Valorant Group Stage match',
              reference: { type: 'event', id: 'evt-001' },
              balance_after: 1250,
              created_at: new Date(Date.now() - 3600000).toISOString(),
            },
            {
              id: 'tx-2',
              amount: 350,
              type: 'earn',
              source: 'challenge',
              reason: 'challenge.completion',
              description: 'Completed 15km Weekly Run',
              reference: { type: 'challenge', id: 'ch-001' },
              balance_after: 1130,
              created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
            },
            {
              id: 'tx-3',
              amount: -50,
              type: 'spend',
              source: 'store',
              reason: 'store.redemption',
              description: 'BGSC Campus Merch Sticker Pack',
              reference: { type: 'store', id: 'item-01' },
              balance_after: 780,
              created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
            },
          ],
          total: 3,
        },
      });
    }

    if (pathname === '/points/opportunities') {
      return sendJson(res, 200, {
        success: true,
        data: [
          { title: 'Attend Campus Run', points: 100, category: 'fitness' },
          { title: 'Win Esports Bracket', points: 500, category: 'esports' },
        ],
      });
    }

    // Global Leaderboard
    if (pathname === '/leaderboards/global') {
      return sendJson(res, 200, {
        success: true,
        data: {
          standings: mockStandings,
          page: 1,
          total_pages: 1,
          total: mockStandings.length,
          period: query.period || 'all',
        },
      });
    }

    // Event Leaderboards
    if (pathname.includes('/leaderboards/events/') && pathname.endsWith('/project')) {
      const amount = Number(query.amount) || 100;
      return sendJson(res, 200, {
        success: true,
        data: {
          amount,
          current_rank: 10,
          projected_rank: 7,
          projected_score: 680 + amount * 2,
        },
      });
    }

    if (pathname.includes('/leaderboards/events/') && pathname.endsWith('/invest')) {
      return sendJson(res, 200, {
        success: true,
        data: {
          success: true,
          message: 'Investment confirmed',
        },
      });
    }

    if (pathname.includes('/leaderboards/events/') && pathname.endsWith('/me')) {
      return sendJson(res, 200, {
        success: true,
        data: {
          rank: 10,
          participant: { id: mockUser.id, display_name: mockUser.profile.full_name, avatar_url: mockUser.profile.avatar_url, type: 'user' },
          final_score: 680,
        },
      });
    }

    if (pathname.includes('/leaderboards/events/')) {
      return sendJson(res, 200, {
        success: true,
        data: {
          event_id: 'evt-001',
          event_title: 'Inter-Hostel Valorant Championship',
          format: 'double_elimination',
          min_participants: 8,
          threshold_met: true,
          page: 1,
          limit: 50,
          total: mockStandings.length,
          total_pages: 1,
          standings: mockStandings.map((s, idx) => ({
            _id: `st-${idx}`,
            rank: idx + 1,
            previous_rank: idx + 1,
            participant: { id: s.user_id, display_name: s.display_name, avatar_url: s.avatar_url, type: 'user' },
            final_score: s.points,
            invested_points: 0,
          })),
        },
      });
    }

    // Event Eligibility & Registrations
    if (pathname.includes('/events/') && pathname.endsWith('/eligibility')) {
      return sendJson(res, 200, {
        success: true,
        data: {
          eligible: true,
          reason: null,
          capacity_status: 'open',
          seats_remaining: 32,
          form_id: 'form-001',
          waitlist_enabled: true,
          requires_approval: false,
          is_teamed: false,
          captain_application_required: false,
          existing_registration_id: null,
        },
      });
    }

    if (pathname.includes('/events/') && pathname.endsWith('/my-registration')) {
      return sendJson(res, 404, { success: false, message: 'No registration found' });
    }

    if (pathname.includes('/events/') && pathname.endsWith('/teams')) {
      return sendJson(res, 200, { success: true, data: [] });
    }

    // Events List & Detail
    if (pathname === '/events') {
      return sendJson(res, 200, {
        success: true,
        data: {
          events: mockEvents,
          total: mockEvents.length,
          page: 1,
          total_pages: 1,
          limit: 20,
        },
      });
    }

    if (pathname.startsWith('/events/')) {
      const slugOrId = pathname.split('/')[2];
      const ev = mockEvents.find((e) => e.slug === slugOrId || e._id === slugOrId) || mockEvents[0];
      return sendJson(res, 200, {
        success: true,
        data: ev,
      });
    }

    // Announcements
    if (pathname === '/announcements') {
      return sendJson(res, 200, {
        success: true,
        data: {
          announcements: mockAnnouncements,
          total: mockAnnouncements.length,
          next_cursor: null,
        },
      });
    }

    if (pathname === '/announcements/unread-count') {
      return sendJson(res, 200, {
        success: true,
        data: { count: 1 },
      });
    }

    if (pathname === '/announcements/heads') {
      return sendJson(res, 200, {
        success: true,
        data: [
          {
            coordinator: {
              user_id: 'admin-001',
              display_name: 'Sports Secretary',
              avatar_url: null,
              role_label: 'Sports Secretary',
            },
            announcement: mockAnnouncements[0],
          },
        ],
      });
    }

    // Challenges
    if (pathname === '/challenges') {
      return sendJson(res, 200, {
        success: true,
        data: {
          challenges: mockChallenges,
          total: mockChallenges.length,
          next_cursor: null,
        },
      });
    }

    if (pathname === '/challenges/me/participations') {
      return sendJson(res, 200, {
        success: true,
        data: {
          participations: mockParticipations,
          next_cursor: null,
        },
      });
    }

    if (pathname.startsWith('/challenges/')) {
      const slugOrId = pathname.split('/')[2];
      const ch = mockChallenges.find((c) => c.slug === slugOrId || c._id === slugOrId) || mockChallenges[0];
      return sendJson(res, 200, {
        success: true,
        data: {
          challenge: ch,
          my_participation: mockParticipations[0],
        },
      });
    }

    // Notifications
    if (pathname === '/notifications') {
      return sendJson(res, 200, {
        success: true,
        data: {
          notifications: mockNotifications,
          unread_count: 2,
        },
      });
    }

    if (pathname === '/notifications/unread-count') {
      return sendJson(res, 200, {
        success: true,
        data: { unread_count: 2 },
      });
    }

    if (pathname === '/notifications/preferences') {
      return sendJson(res, 200, {
        success: true,
        data: { email: true, push: true, in_app: true },
      });
    }

    // Registrations
    if (pathname === '/registrations' || pathname === '/registrations/me') {
      return sendJson(res, 200, {
        success: true,
        data: [
          {
            _id: 'reg-001',
            event_id: 'evt-001',
            status: 'confirmed',
            role: 'captain',
            owner: { type: 'event' },
            event: mockEvents[0],
          },
        ],
      });
    }

    // Strava
    if (pathname === '/strava/status') {
      return sendJson(res, 200, {
        success: true,
        data: { connected: false, athlete: null },
      });
    }

    // Media
    if (pathname === '/media/albums') {
      return sendJson(res, 200, {
        success: true,
        data: {
          items: mockAlbums,
          total: mockAlbums.length,
          page: 1,
          limit: 20,
          total_pages: 1,
        },
      });
    }

    if (pathname === '/media') {
      if (query.mine === 'true' && query.status === 'pending') {
        return sendJson(res, 200, {
          success: true,
          data: {
            items: [],
            total: 0,
            page: 1,
            limit: 30,
            total_pages: 1,
          },
        });
      }

      return sendJson(res, 200, {
        success: true,
        data: {
          items: mockMediaItems,
          total: mockMediaItems.length,
          page: 1,
          limit: 30,
          total_pages: 1,
        },
      });
    }

    // Hall of Fame
    if (pathname === '/hall-of-fame/featured') {
      return sendJson(res, 200, {
        success: true,
        data: {
          items: mockHallOfFameEntries.filter((e) => e.featured),
        },
      });
    }

    if (pathname === '/hall-of-fame') {
      return sendJson(res, 200, {
        success: true,
        data: {
          items: mockHallOfFameEntries,
          total: mockHallOfFameEntries.length,
          page: 1,
          limit: 50,
          total_pages: 1,
        },
      });
    }

    if (pathname.startsWith('/hall-of-fame/')) {
      const slugOrId = pathname.split('/')[2];
      const entry = mockHallOfFameEntries.find((e) => e.slug === slugOrId || e._id === slugOrId) || mockHallOfFameEntries[0];
      return sendJson(res, 200, {
        success: true,
        data: entry,
      });
    }

    // Auction
    if (pathname.includes('/auction/events/') && pathname.endsWith('/live')) {
      return sendJson(res, 200, {
        success: true,
        data: {
          event_id: 'evt-002',
          slug: 'badminton-premier-league',
          title: 'BGSC Badminton Premier League (BPL)',
          status: 'live',
          config: {
            k_multiplier: 1.2,
            min_bid_increment: 100,
            bid_timer_seconds: 30,
            purse_per_team: 100000,
            captains_count: 8,
          },
          active_lot: {
            lot_id: 'lot-1',
            order: 1,
            player_name: 'Maverick',
            base_price: 500,
            current_bid: 1200,
            current_bidder: 'Team Phoenix',
            status: 'on_block',
          },
          timer: { seconds_remaining: 24 },
          team_purses: [
            { team_name: 'Team Phoenix', remaining: 48000 },
            { team_name: 'Titans', remaining: 52000 },
          ],
        },
      });
    }

    if (pathname.includes('/auction/events/') && pathname.endsWith('/lots')) {
      return sendJson(res, 200, {
        success: true,
        data: [
          { id: 'lot-1', player_name: 'Maverick', base_price: 500, current_bid: 1200, status: 'in_progress' },
          { id: 'lot-2', player_name: 'Coolcat', base_price: 500, current_bid: null, status: 'upcoming' },
        ],
      });
    }

    // Brackets & Draws
    if (pathname.startsWith('/brackets/') || pathname.startsWith('/draws/')) {
      return sendJson(res, 200, {
        success: true,
        data: {
          bracket: {
            rounds: [
              {
                name: 'Quarterfinals',
                matches: [
                  { id: 'm-1', teamA: 'Vipers', teamB: 'Titans', scoreA: 2, scoreB: 1, status: 'completed' },
                  { id: 'm-2', teamA: 'Phoenix', teamB: 'Dragons', scoreA: 0, scoreB: 2, status: 'completed' },
                ],
              },
              {
                name: 'Semifinals',
                matches: [
                  { id: 'm-3', teamA: 'Vipers', teamB: 'Dragons', scoreA: 1, scoreB: 0, status: 'ongoing' },
                ],
              },
            ],
            matches: [
              { id: 'm-1', round: 1, teamA: 'Vipers', teamB: 'Titans', scoreA: 2, scoreB: 1, status: 'completed' },
            ],
          },
          standings: {
            rows: mockStandings.map((s) => ({
              id: s.user_id,
              display_name: s.display_name,
              points: s.points,
              played: 3,
              won: 2,
              drawn: 0,
              lost: 1,
              eliminated: false,
            })),
          },
        },
      });
    }

    // Feedback
    if (pathname === '/feedback') {
      return sendJson(res, 200, { success: true, data: { ticket_no: 'BGSC-1024', status: 'received' } });
    }

    // Fallback default response
    return sendJson(res, 200, { success: true, data: {} });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 BGSC Mock Gateway Server running on http://localhost:${PORT}`);
});
