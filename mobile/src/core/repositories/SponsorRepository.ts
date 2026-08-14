/**
 * Sponsor domain repository (sponsors-page.md).
 *
 * Active sponsor data is real — delegates to HallOfFameRepository
 * (GET /hall-of-fame/sponsor-champions). Prizes, archive, and newsletter
 * subscriptions are Phase 2 mocks; the user's own affiliation hits the user-
 * service. Phase 2 swaps mocked bodies for apiClient calls.
 *
 * TODO(Phase 2):
 *   GET  /sponsors/active            → active campaigns with tenure countdowns
 *   GET  /sponsors/prizes            → prize pool per sponsor
 *   GET  /sponsors/archive           → past sponsors
 *   GET  /users/me/newsletter-subs   → newsletter subscriptions
 *   PATCH /users/me/newsletter-subs  → update subscriptions
 *   PATCH /users/me/sponsor          → change affiliation (once per semester)
 */

import { HallOfFameRepository } from './HallOfFameRepository';
import { apiClient } from '../api/ApiClient';
import { ApiError } from '../api/ApiError';
import type { SponsorStats } from '../types';

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const NEWSLETTER_CATEGORIES = [
  'Gaming News',
  'Indie Spotlights',
  'Game Dev',
  'Campus Studio',
] as const;

export type NewsletterCategory = (typeof NEWSLETTER_CATEGORIES)[number];

export interface SponsorPrize {
  id: string;
  title: string;
  sponsorName: string;
  criteria: string;
  leader: string;
  status: 'available' | 'claimed' | 'locked';
}

export interface PastSponsor {
  id: string;
  name: string;
  logoColor: string;
  tenure: string;
  linkedEvents: string[];
  socialLinks: { platform: 'web' | 'instagram' | 'twitter' | 'linkedin'; url: string }[];
}

const MOCK_PRIZES: SponsorPrize[] = [
  {
    id: 'prize_1',
    title: 'Grand Prize Pool',
    sponsorName: 'TechCorp',
    criteria: 'Most fans referred this semester',
    leader: '@priya_k',
    status: 'available',
  },
  {
    id: 'prize_2',
    title: 'Gaming Peripherals Bundle',
    sponsorName: 'IntelGaming',
    criteria: 'Top scorer in Esports Open Qualifier',
    leader: '@alex_ng',
    status: 'available',
  },
  {
    id: 'prize_3',
    title: 'Exclusive Merch Drop',
    sponsorName: 'RedBull Esports',
    criteria: 'Most event wins in Spring semester',
    leader: 'Claimed',
    status: 'claimed',
  },
];

const MOCK_ARCHIVE: PastSponsor[] = [
  {
    id: 'arch_1',
    name: 'ByteWave Studios',
    logoColor: '#3b82f6',
    tenure: 'Spring 2025',
    linkedEvents: ['Campus Game Jam', 'Dev Sprint 2025'],
    socialLinks: [
      { platform: 'web', url: 'https://example.com' },
      { platform: 'instagram', url: 'https://instagram.com' },
    ],
  },
  {
    id: 'arch_2',
    name: 'NexGen Energy',
    logoColor: '#22c55e',
    tenure: 'Fall 2024',
    linkedEvents: ['BGSC Invitational', 'Fitness Challenge Cup'],
    socialLinks: [
      { platform: 'web', url: 'https://example.com' },
      { platform: 'twitter', url: 'https://x.com' },
    ],
  },
  {
    id: 'arch_3',
    name: 'PixelForge',
    logoColor: '#8b5cf6',
    tenure: 'Spring 2024',
    linkedEvents: ['Indie Showcase'],
    socialLinks: [
      { platform: 'instagram', url: 'https://instagram.com' },
      { platform: 'linkedin', url: 'https://linkedin.com' },
    ],
  },
];

export const SponsorRepository = {
  /** Real data — delegates to hall-of-fame endpoint. */
  getActiveSponsors() {
    return HallOfFameRepository.getSponsorChampions();
  },

  /** Real data from user-service; null if guest or no affiliation. */
  async getMyAffiliation(): Promise<SponsorStats | null> {
    try {
      return await apiClient.get<SponsorStats>('/users/me/sponsor-stats');
    } catch (err) {
      // M-10: only treat 401/404 as "no affiliation" — 500s should propagate
      // so callers can distinguish a data absence from a server failure.
      if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
        return null;
      }
      throw err;
    }
  },

  /** TODO(Phase 2): PATCH /users/me/sponsor { sponsorId } — once per semester. */
  async updateAffiliation(sponsorId: string): Promise<void> {
    // Do NOT catch here. The mutation layer (useChangeSponsor) has onError
    // handlers; swallowing the error caused a silent success toast on failure.
    await apiClient.patch('/users/me/sponsor', { sponsorId });
  },

  /** TODO(Phase 2): GET /sponsors/prizes */
  async getPrizes(): Promise<SponsorPrize[]> {
    await delay(350);
    return MOCK_PRIZES;
  },

  /** TODO(Phase 2): GET /sponsors/archive */
  async getPastSponsors(): Promise<PastSponsor[]> {
    await delay(350);
    return MOCK_ARCHIVE;
  },

  /** TODO(Phase 2): GET /users/me/newsletter-subs */
  async getNewsletterSubscriptions(): Promise<NewsletterCategory[]> {
    try {
      return await apiClient.get<NewsletterCategory[]>('/users/me/newsletter-subscriptions');
    } catch (err) {
      // L-08: only fabricate defaults for 404 (no subscription record yet).
      // Other errors (5xx, network) should propagate so the UI can show an error state.
      if (err instanceof ApiError && err.status === 404) {
        return [];
      }
      throw err;
    }
  },

  /** TODO(Phase 2): PATCH /users/me/newsletter-subs */
  async updateNewsletterSubscriptions(subs: NewsletterCategory[]): Promise<void> {
    // Do NOT catch here. useUpdateNewsletterSubs has a complete optimistic-
    // update / onError rollback pattern that is unreachable when this resolves
    // successfully on failure.
    await apiClient.patch('/users/me/newsletter-subscriptions', { subscriptions: subs });
  },
};
