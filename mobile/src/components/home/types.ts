/**
 * Home-surface domain types (home-page.md surfaces H1–H9).
 *
 * Announcement/AnnouncementTag/AnnouncementAuthor live in `core/types.ts`
 * (shared with AnnouncementRepository) — feed types are local to Home because
 * the social feed is Phase 2 and has no backend contract yet.
 */

import type { AnnouncementTag } from '@/core/types';

/** Full category taxonomy (home-page.md §7.2) — drives the filter rail + composer. */
export const ANNOUNCEMENT_TAGS: AnnouncementTag[] = [
  'BGEC',
  'FitSoc',
  'Airball',
  'Offside',
  'PowerPlay',
  'Around The Net',
  'Deuce',
  'Highlight Events',
  'Teams',
];

export interface FeedAuthor {
  id: string;
  name: string;
  username: string;
  avatarInitial: string;
  avatarColor: string;
}

export interface FeedComment {
  id: string;
  author: FeedAuthor;
  body: string;
  createdAt: string;
  /** One visible reply level (home-page.md §12.2). */
  replies: FeedComment[];
}

export interface FeedPost {
  id: string;
  author: FeedAuthor;
  text: string;
  tags: string[];
  likes: number;
  likedByMe: boolean;
  comments: FeedComment[];
  createdAt: string;
}
