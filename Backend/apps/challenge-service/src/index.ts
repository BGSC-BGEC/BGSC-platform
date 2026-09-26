import { createServiceApp, startService } from '@bgsc/shared';
import express from 'express';
import { challengeRoutes } from './challenges/challenge.routes';
import { initializeConsumers } from './events/consumers';
import { startExpirySweeper } from './scheduler/expiry';
import { startReplaySweeper } from './scheduler/replay';
import { stravaRoutes } from './strava/strava.routes';
import { assertStravaKeyConfigured } from './strava/tokens';

/**
 * Challenge Service — :3008. Owns `challenges`, `challenge_participations`, and Strava account
 * linking (`strava_credentials`, `strava_activities`).
 *
 * It is the PRODUCER of `ChallengeCompleted`; the Points Service has consumed that event since
 * Sep 19 and pays every `member_user_id`, deduping on
 * `challenge.completed:<participation_id>:<user_id>`. Nothing here calls Points.
 *
 * Strava lives here rather than in auth-service + user-service as
 * docs/SystemDesignDocs/strava-integration.md §3 proposes: that doc predates this stack (it is
 * written for TypeORM, NestJS and BullMQ) and physical challenges are what the activities are
 * proof for. `/strava` is a second gateway routing row onto the same target.
 *
 * One outbound HTTP call, best-effort: the team lock on Registration Service.
 */

const NAME = 'challenge-service';
const PORT = parseInt(process.env.PORT || '3008', 10);

const options = {
    name: NAME,
    port: PORT,
    routes(app: express.Express) {
        app.use('/challenges', challengeRoutes);
        app.use('/strava', stravaRoutes);
        // No /internal: nothing calls this service service-to-service today, and a contract with
        // no second party is a guess (adding-a-service.md §6.4).
    },
    async onReady() {
        // A malformed or (in production) missing STRAVA_TOKEN_ENCRYPTION_KEY fails the boot rather
        // than the first connect, so a misconfigured deploy never half-works.
        assertStravaKeyConfigured();
        // Participant snapshot refresh and anonymization.
        initializeConsumers();
        // The only exit from `accepted`, plus challenge auto-complete at window.closes_at.
        startExpirySweeper();
        // Republishes approval events the bus may have lost.
        startReplaySweeper();
    },
    // What this service owns (relationships.md §1), and so the only indexes it builds at boot.
    models: ['Challenge', 'ChallengeParticipation', 'StravaCredential', 'StravaActivity'],
};

export const app = createServiceApp(options);
export const start = () => startService(app, options);

if (require.main === module) {
    start().catch((err) => {
        console.error(`[${NAME}] Fatal: failed to start:`, err);
        process.exit(1);
    });
}
