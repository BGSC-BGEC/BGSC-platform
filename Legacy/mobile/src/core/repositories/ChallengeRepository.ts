import type {
  Challenge,
  ChallengeDifficulty,
  ChallengeDomain,
  ChallengeSubmission,
  SubmitProofDto,
} from '../types';

/**
 * Challenge endpoints (master §13.5) are **Phase 2** — the challenge-service
 * does not exist yet. This repository returns mock data so the full UI flow
 * (browser → detail → accept → submission) is exercisable end to end.
 *
 * TODO(Phase 2): replace every mock below with an apiClient call, keeping the
 * method signatures and shapes identical. Expected mapping:
 *   listChallenges  → GET /challenges?domain=&difficulty=&page=&limit=
 *   getChallenge    → GET /challenges/:id
 *   getActiveChallenges → GET /challenges?mine=active (or client-side filter)
 *   acceptChallenge → POST /challenges/:id/accept
 *   getSubmission   → GET /challenges/:id/submission   (404 → null)
 *   submitProof     → POST /challenges/:id/submission
 */

const daysFromNow = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString();

const hoursFromNow = (hours: number): string =>
  new Date(Date.now() + hours * 3_600_000).toISOString();

const MOCK_CHALLENGES: Challenge[] = [
  {
    id: 'ch-spring-slam',
    title: 'Spring Slam — 5K Campus Run',
    description:
      'Run the full 5K campus loop and log your time on Strava. A medal and participation points go to everyone who finishes. Podium finishers earn extra points and a Hall of Fame nomination.',
    domain: 'sports',
    difficulty: 'easy',
    mode: 'physical',
    teamLimit: 1,
    timeLimitDays: 7,
    awardPoints: 150,
    status: 'active',
    hallOfFameEligible: false,
    userState: 'accepted',
    deadline: daysFromNow(3), // accepted 4 days ago; countdown visible (<72 h)
    resources: [
      { name: 'Route map', url: 'https://example.com/spring-slam-route' },
      { name: 'Strava club', url: 'https://www.strava.com/clubs/bgsc' },
    ],
  },
  {
    id: 'ch-fgc-gauntlet',
    title: 'FGC Gauntlet — Best of 5 Online Qualifier',
    description:
      'Compete in the online qualifier for the BGSC fighting game circuit. Details, brackets, and the exact format are revealed after you accept — scout the competition before you commit.',
    domain: 'esports',
    difficulty: 'medium',
    mode: 'digital',
    teamLimit: 4,
    timeLimitDays: 5,
    awardPoints: 250,
    status: 'active',
    hallOfFameEligible: false,
    userState: 'not_accepted',
    deadline: null,
    resources: [{ name: 'Tournament rules', url: 'https://example.com/fgc-rules' }],
  },
  {
    id: 'ch-game-jam',
    title: 'Game Jam — Build a 2D Platformer',
    description:
      'Build a playable 2D platformer in a weekend. Upload a playable build plus a 2-minute demo video. Judges score on gameplay, polish, and creativity. Source repo required as proof.',
    domain: 'game_dev',
    difficulty: 'hard',
    mode: 'digital',
    teamLimit: 2,
    timeLimitDays: null, // no deadline — submit whenever it ships
    awardPoints: 350,
    status: 'active',
    hallOfFameEligible: false,
    userState: 'submitted',
    deadline: null,
    resources: [
      { name: 'Jam theme reveal', url: 'https://example.com/jam-theme' },
      { name: 'Asset pack', url: 'https://example.com/asset-pack' },
      { name: 'Submission guide', url: 'https://example.com/jam-submit' },
    ],
  },
  {
    id: 'ch-photowalk',
    title: 'Campus Photowalk — Monsoon Frames',
    description:
      'Shoot the campus in the rain and submit your best three frames. Any camera works — phone photos welcome. Best set gets featured on the BGSC media wall.',
    domain: 'general',
    difficulty: 'easy',
    mode: 'physical',
    teamLimit: 2,
    timeLimitDays: null,
    awardPoints: 100,
    status: 'active',
    hallOfFameEligible: false,
    userState: 'not_accepted',
    deadline: null,
    resources: [],
  },
  {
    id: 'ch-legend-ironman',
    title: 'Ironman Weekend — 3 Events, 1 Weekend',
    description:
      'Complete three different BGSC events in a single weekend and submit proof of attendance for each. The ultimate endurance challenge — Hall of Fame eligible for finishers.',
    domain: 'sports',
    difficulty: 'legend',
    mode: 'physical',
    teamLimit: 5,
    timeLimitDays: 14,
    awardPoints: 500,
    status: 'active',
    hallOfFameEligible: true,
    userState: 'rejected',
    deadline: daysFromNow(9),
    resources: [{ name: 'Event calendar', url: 'https://example.com/weekend-calendar' }],
  },
  {
    id: 'ch-speedrun',
    title: 'Speedrun Sprint — Any% Sub-10',
    description:
      'Beat the BGSC favourite in under ten minutes. Submit your full run as an unlisted video with a visible timer. Leaderboard points scale with your time.',
    domain: 'esports',
    difficulty: 'hard',
    mode: 'digital',
    teamLimit: 1,
    timeLimitDays: 3,
    awardPoints: 300,
    status: 'active',
    hallOfFameEligible: false,
    userState: 'approved',
    deadline: null,
    resources: [{ name: 'Run rules', url: 'https://example.com/speedrun-rules' }],
  },
];

/** Mock proof items used for challenges that have already been submitted. */
const MOCK_PROOF: { image: { uri: string }[] } = {
  image: [
    { uri: 'https://picsum.photos/seed/bgsc1/400/400' },
    { uri: 'https://picsum.photos/seed/bgsc2/400/400' },
  ],
};

export const ChallengeRepository = {
  /**
   * TODO(Phase 2): GET /challenges?domain=&difficulty=&page=&limit=
   * `difficulties: null` means "no difficulty filter". `page`/`limit` are
   * accepted for the future endpoint; the mock returns everything in one page.
   */
  async listChallenges(filters: {
    domain?: ChallengeDomain | null;
    difficulties?: ChallengeDifficulty[] | null;
    page?: number;
    limit?: number;
  }): Promise<Challenge[]> {
    const { domain, difficulties } = filters;
    return MOCK_CHALLENGES.filter(
      (c) =>
        (!domain || c.domain === domain) &&
        (!difficulties || difficulties.includes(c.difficulty)),
    );
  },

  /** TODO(Phase 2): GET /challenges/:id */
  async getChallenge(id: string): Promise<Challenge | null> {
    return MOCK_CHALLENGES.find((c) => c.id === id) ?? null;
  },

  /** Challenges the viewing user is working on (points spec §9.3). */
  // M-16: accept userId so when Phase 2 lands the backend call can be
  // parameterised; today the mock ignores it.
  async getActiveChallenges(_userId?: string): Promise<Challenge[]> {
    return MOCK_CHALLENGES.filter(
      (c) => c.userState === 'accepted' || c.userState === 'submitted',
    );
  },

  /**
   * TODO(Phase 2): POST /challenges/:id/accept
   * 201 on success; 409 if already accepted. Mutates the mock in place so the
   * detail screen flips to "View Submission" after accepting.
   */
  async acceptChallenge(id: string): Promise<void> {
    const challenge = MOCK_CHALLENGES.find((c) => c.id === id);
    if (!challenge) throw new Error('Challenge not found');
    if (challenge.userState !== 'not_accepted') {
      throw new Error('Challenge already accepted');
    }
    challenge.userState = 'accepted';
    challenge.deadline =
      challenge.timeLimitDays != null ? daysFromNow(challenge.timeLimitDays) : null;
    await delay(600); // simulate network round-trip
  },

  /** TODO(Phase 2): GET /challenges/:id/submission — 404 maps to null. */
  async getSubmission(challengeId: string): Promise<ChallengeSubmission | null> {
    const challenge = MOCK_CHALLENGES.find((c) => c.id === challengeId);
    if (!challenge) return null;
    return submissionFor(challenge);
  },

  /** TODO(Phase 2): POST /challenges/:id/submission */
  async submitProof(challengeId: string, dto: SubmitProofDto): Promise<ChallengeSubmission> {
    const challenge = MOCK_CHALLENGES.find((c) => c.id === challengeId);
    if (!challenge) throw new Error('Challenge not found');
    challenge.userState = 'submitted';
    await delay(600);
    return {
      challengeId,
      status: 'under_review',
      proofItems: dto.proofItems,
      notes: dto.notes,
      submittedAt: new Date().toISOString(),
    };
  },
};

function submissionFor(challenge: Challenge): ChallengeSubmission | null {
  switch (challenge.userState) {
    case 'accepted':
      return { challengeId: challenge.id, status: 'in_progress', proofItems: [], notes: '' };
    case 'submitted':
      return {
        challengeId: challenge.id,
        status: 'under_review',
        proofItems: [
          { id: 'p1', type: 'image', uri: MOCK_PROOF.image[0].uri },
          { id: 'p2', type: 'image', uri: MOCK_PROOF.image[1].uri },
          { id: 'p3', type: 'link', uri: 'https://github.com/bgsc/game-jam-submission' },
        ],
        notes: 'Repo is public with a README walkthrough. Demo video included in the repo.',
        submittedAt: hoursFromNow(-20),
      };
    case 'approved':
      return {
        challengeId: challenge.id,
        status: 'approved',
        proofItems: [
          { id: 'p1', type: 'link', uri: 'https://youtu.be/bgsc-speedrun-demo' },
        ],
        notes: 'Full run with visible timer, unlisted.',
        submittedAt: daysFromNow(-12),
        reviewedAt: daysFromNow(-10),
        adminNote: 'Time verified — great run!',
        pointsAwarded: challenge.awardPoints,
      };
    case 'rejected':
      return {
        challengeId: challenge.id,
        status: 'rejected',
        proofItems: [
          { id: 'p1', type: 'image', uri: MOCK_PROOF.image[0].uri },
        ],
        notes: 'Attendance screenshots attached.',
        submittedAt: daysFromNow(-2),
        reviewedAt: hoursFromNow(-10),
        adminNote: 'Proof unclear — retake the screenshots with the event name visible.',
      };
    default:
      return null;
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
