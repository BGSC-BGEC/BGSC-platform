import { CATEGORY_COLORS } from '@/core/theme/tokens';
import type { FeedPost } from './types';

/**
 * Mock social feed for the Home Feed tab.
 *
 * TODO(phase2): delete this file once the feed service ships — the feed is
 * Phase 2 and has no backend contract yet (no FeedRepository exists).
 * Avatar colours reuse CATEGORY_COLORS so no hex is introduced.
 */
const now = Date.now();
const h = (hours: number) => new Date(now - hours * 3_600_000).toISOString();
const m = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

const bgecHead = {
  id: 'u-bgec-1',
  name: 'Rahul Sharma',
  username: 'rahul.bgec',
  avatarInitial: 'R',
  avatarColor: CATEGORY_COLORS.BGEC,
};

const fitsocLead = {
  id: 'u-fit-1',
  name: 'Ananya Iyer',
  username: 'ananya.runs',
  avatarInitial: 'A',
  avatarColor: CATEGORY_COLORS.FitSoc,
};

const airballCap = {
  id: 'u-air-1',
  name: 'Kabir Mehta',
  username: 'kabir.airball',
  avatarInitial: 'K',
  avatarColor: CATEGORY_COLORS.Airball,
};

export const MOCK_FEED_POSTS: FeedPost[] = [
  {
    id: 'p-1',
    author: bgecHead,
    text: 'VALORANT open quals are live — register before Friday midnight. Solo queue and premades both get brackets. Bring your A-game, the finals stream on campus big screen.',
    tags: ['#BGEC', '#VALORANT'],
    likes: 42,
    likedByMe: false,
    createdAt: m(35),
    comments: [
      {
        id: 'c-1',
        author: airballCap,
        body: 'Can we get the stream link in the announcement too?',
        createdAt: m(22),
        replies: [
          {
            id: 'c-1r1',
            author: bgecHead,
            body: 'Yes — dropping it in the official announcement today.',
            createdAt: m(18),
            replies: [],
          },
        ],
      },
      {
        id: 'c-2',
        author: fitsocLead,
        body: 'Good luck to everyone grinding this!',
        createdAt: m(12),
        replies: [],
      },
    ],
  },
  {
    id: 'p-2',
    author: fitsocLead,
    text: 'Morning run along the field at 6:30 — anyone in? Easy 5k pace, no drop-backs. Post-match stretch session after.',
    tags: ['#FitSoc', '#RunClub'],
    likes: 28,
    likedByMe: true,
    createdAt: h(2),
    comments: [
      {
        id: 'c-3',
        author: bgecHead,
        body: 'I\'m in if the 5k keeps the pace easy 🙌',
        createdAt: h(1),
        replies: [],
      },
    ],
  },
  {
    id: 'p-3',
    author: airballCap,
    text: 'Matchday! Airball vs Offside at the court tonight. We need the crowd — home advantage is real. Highlights will be up on the Media page tomorrow.',
    tags: ['#Airball', '#Matchday'],
    likes: 61,
    likedByMe: false,
    createdAt: h(5),
    comments: [
      {
        id: 'c-4',
        author: fitsocLead,
        body: 'The court crowd last time was electric. See you there!',
        createdAt: h(4),
        replies: [
          {
            id: 'c-4r1',
            author: airballCap,
            body: 'We\'re counting on it 🏀',
            createdAt: h(3),
            replies: [],
          },
          {
            id: 'c-4r2',
            author: airballCap,
            body: 'Doors at 7, tip-off 7:30.',
            createdAt: h(3),
            replies: [],
          },
        ],
      },
    ],
  },
];
