import type { Announcement, Comment, Coordinator, Post } from './types';

const h = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString();
const d = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export const MOCK_COORDINATORS: Coordinator[] = [
  {
    id: 'c1',
    name: 'Rahul Mehta',
    role: 'BGEC Head Coordinator',
    avatarInitial: 'R',
    avatarColor: '#3b82f6',
    latestAnnouncement: {
      id: 'a1',
      body: 'BGEC Valorant Tournament qualifiers begin this weekend! Register your team on the platform before slots fill up.',
    },
  },
  {
    id: 'c2',
    name: 'Priya Sharma',
    role: 'FitSoc Head Coordinator',
    avatarInitial: 'P',
    avatarColor: '#22c55e',
    latestAnnouncement: {
      id: 'a2',
      body: 'FitSoc Football League Season 3 kicks off Monday. All registered players report to the main ground by 6 PM sharp.',
    },
  },
  {
    id: 'c3',
    name: 'Arjun Nair',
    role: 'BGSC Founder',
    avatarInitial: 'A',
    avatarColor: '#7c3aed',
    latestAnnouncement: {
      id: 'a3',
      body: "Welcome to the new BGSC Platform! Explore events, track your points, and connect with the campus sports community.",
    },
  },
  {
    id: 'c4',
    name: 'Meera Iyer',
    role: 'Airball Coordinator',
    avatarInitial: 'M',
    avatarColor: '#f59e0b',
  },
];

export const MOCK_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'a1',
    title: 'BGEC Valorant Tournament — Qualifiers Open',
    body: "BGEC Valorant Tournament qualifiers begin this weekend! Register your team on the platform before all slots are taken. The top 8 teams from qualifiers will advance to the main bracket on Saturday. Prizes include gaming peripherals and BGSC merch. See you on the server!",
    tags: ['BGEC'],
    author: { id: 'c1', name: 'Rahul Mehta', role: 'BGEC Head Coordinator', avatarInitial: 'R', avatarColor: '#3b82f6' },
    createdAt: h(2),
  },
  {
    id: 'a2',
    title: 'FitSoc Football League Season 3 Kickoff',
    body: "FitSoc Football League Season 3 kicks off this Monday evening. All registered players are expected on the main ground by 6 PM. Bring your kit and plenty of energy. Fixtures will be posted after the opening round. Let's have a great season!",
    tags: ['FitSoc', 'Offside'],
    author: { id: 'c2', name: 'Priya Sharma', role: 'FitSoc Head Coordinator', avatarInitial: 'P', avatarColor: '#22c55e' },
    createdAt: d(1),
  },
  {
    id: 'a3',
    title: 'BGSC Platform — Now Live!',
    body: "We're thrilled to announce the official launch of the BGSC Platform! You can now track your points, register for events, follow announcements, and connect with the entire campus sports & esports community in one place. More features are coming soon — stay tuned.",
    tags: ['BGEC', 'FitSoc', 'Highlight Events'],
    author: { id: 'c3', name: 'Arjun Nair', role: 'BGSC Founder', avatarInitial: 'A', avatarColor: '#7c3aed' },
    createdAt: d(3),
  },
  {
    id: 'a4',
    title: 'PowerPlay Championship — Open Registration',
    body: "PowerPlay Championship qualifiers are now open for registration. This season features a brand new tournament format with group stages and a double-elimination bracket. Top performers will earn exclusive PowerPlay points multipliers. Register by Thursday midnight.",
    tags: ['PowerPlay'],
    author: { id: 'c3', name: 'Arjun Nair', role: 'BGSC Founder', avatarInitial: 'A', avatarColor: '#7c3aed' },
    createdAt: d(5),
  },
  {
    id: 'a5',
    title: 'Around The Net — Tennis Practice Sessions',
    body: "Weekly tennis practice sessions resume from next week. Sessions will be held every Tuesday and Thursday from 5:30 PM on courts 3 and 4. Open to all skill levels. Equipment will be available at the sports office. See you on the court!",
    tags: ['Around The Net'],
    author: { id: 'c4', name: 'Meera Iyer', role: 'Airball Coordinator', avatarInitial: 'M', avatarColor: '#f59e0b' },
    createdAt: d(7),
  },
  {
    id: 'a6',
    title: 'Deuce Table Tennis Finals — This Friday',
    body: "The Deuce Table Tennis Finals are happening this Friday at the SAC. Doors open at 4 PM. Come support your favourite players as they battle for the semester trophy. Refreshments will be available. Entry is free for all BITS Goa students.",
    tags: ['Deuce'],
    author: { id: 'c2', name: 'Priya Sharma', role: 'FitSoc Head Coordinator', avatarInitial: 'P', avatarColor: '#22c55e' },
    createdAt: d(10),
  },
];

export const MOCK_POSTS: Post[] = [
  {
    id: 'p1',
    author: { id: 'c1', displayName: 'Rahul Mehta', username: 'rahulm', avatarInitial: 'R', avatarColor: '#3b82f6' },
    // 2 images — demonstrates the carousel + dot indicator
    media: [
      { type: 'image', uri: 'https://picsum.photos/seed/bgec-val1/800/600' },
      { type: 'image', uri: 'https://picsum.photos/seed/bgec-val2/800/600' },
    ],
    caption: "Day 1 of BGEC qualifiers in the books. Incredible plays from every team — this season's competition is something else! 🎮 See you all at the main bracket this Saturday.",
    tags: ['#BGEC', '#Valorant', '#esports'],
    likeCount: 47,
    liked: false,
    commentCount: 12,
    createdAt: h(3),
    sharingEnabled: true,
    commentsEnabled: true,
    commentVisibility: 'public',
  },
  {
    id: 'p2',
    author: { id: 'c2', displayName: 'Priya Sharma', username: 'priya_s', avatarInitial: 'P', avatarColor: '#22c55e' },
    // 1 image — demonstrates single-image tap to full-screen viewer
    media: [
      { type: 'image', uri: 'https://picsum.photos/seed/fitsoc-team/800/600' },
    ],
    caption: "Season 3 training is underway and the energy is unreal! Proud of how far this squad has come. Hard work always pays off. 💪⚽",
    tags: ['#FitSoc', '#Football', '#Season3'],
    likeCount: 63,
    liked: true,
    commentCount: 8,
    createdAt: d(1),
    sharingEnabled: true,
    commentsEnabled: true,
    commentVisibility: 'protected',
  },
  {
    id: 'p3',
    author: { id: 'c3', displayName: 'Arjun Nair', username: 'arjun_n', avatarInitial: 'A', avatarColor: '#7c3aed' },
    // Text-only post — no media section rendered
    media: [],
    caption: "From a WhatsApp group to a full platform — BGSC has come a long way. Thank you to every player, coordinator, and supporter who made this possible. This is just the beginning. 🏆",
    tags: ['#BGSC', '#Community', '#Sports'],
    likeCount: 132,
    liked: false,
    commentCount: 31,
    createdAt: d(3),
    sharingEnabled: false,
    commentsEnabled: true,
    commentVisibility: 'public',
  },
  {
    id: 'p4',
    author: { id: 'u1', displayName: 'Kiran Rao', username: 'kiran_r', avatarInitial: 'K', avatarColor: '#06b6d4' },
    // 1 video — demonstrates inline VideoPlayer
    media: [
      { type: 'video', uri: '' },
    ],
    caption: "Table tennis practice session was 🔥 today. Deuce finals this Friday — can't wait! Who else is coming?",
    tags: ['#Deuce', '#TableTennis', '#BGSC'],
    likeCount: 19,
    liked: false,
    commentCount: 5,
    createdAt: d(2),
    sharingEnabled: true,
    commentsEnabled: false,
    commentVisibility: 'public',
  },
];

export const MOCK_COMMENTS: Comment[] = [
  {
    id: 'cm1',
    author: { id: 'u1', displayName: 'Kiran Rao', avatarInitial: 'K', avatarColor: '#06b6d4' },
    body: 'This is so exciting! Registered my team earlier today.',
    likeCount: 4,
    liked: false,
    createdAt: h(1),
    replies: [
      {
        id: 'r1',
        author: { id: 'c1', displayName: 'Rahul Mehta', avatarInitial: 'R', avatarColor: '#3b82f6' },
        body: 'Good luck to you and your team! See you on the server 🎮',
        likeCount: 2,
        liked: false,
        createdAt: h(0.5),
      },
    ],
  },
  {
    id: 'cm2',
    author: { id: 'u2', displayName: 'Sneha Das', avatarInitial: 'S', avatarColor: '#ec4899' },
    body: 'Will there be a live stream of the main bracket?',
    likeCount: 7,
    liked: true,
    createdAt: h(2),
    replies: [],
  },
  {
    id: 'cm3',
    author: { id: 'u3', displayName: 'Dev Patel', avatarInitial: 'D', avatarColor: '#f97316' },
    body: "Let's gooo! BGEC season is always the best time of semester.",
    likeCount: 1,
    liked: false,
    createdAt: h(3),
    replies: [
      {
        id: 'r2',
        author: { id: 'u1', displayName: 'Kiran Rao', avatarInitial: 'K', avatarColor: '#06b6d4' },
        body: 'Absolutely agree 🙌',
        likeCount: 0,
        liked: false,
        createdAt: h(2.5),
      },
    ],
  },
];
