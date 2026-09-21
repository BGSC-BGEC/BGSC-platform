import { createServiceApp, startService } from '@bgsc/shared';
import express from 'express';
import { initializeConsumers } from './events/consumers';
import { bracketRoutes } from './brackets/bracket.routes';
import { matchRoutes } from './matches/match.routes';

/**
 * Bracket Service — :3012. Owns `brackets` and `matches`
 * (docs/modeldocs/bracket-model.md).
 *
 * Draws a tournament from an event's participants, tracks its fixtures, and advances winners as
 * results come in. Everything it needs from another domain is a read — `events`, `teams`,
 * `form_submissions` — so it makes no outbound service calls at all, and it writes nothing outside
 * its own two collections: the reserved `events.bracket` slot stays null by decision, not by
 * omission (be2-feedback-bracket-plan.md D3).
 */

const NAME = 'bracket-service';
const PORT = parseInt(process.env.PORT || '3012', 10);

const options = {
    name: NAME,
    port: PORT,
    routes(app: express.Express) {
        app.use('/brackets', bracketRoutes);
        app.use('/matches', matchRoutes);
        // No /internal: nothing calls this service.
    },
    async onReady() {
        // A bracket is drawn when an organiser says so, never in reaction to an event — the one
        // thing this service listens for is an account being deleted out from under a draw.
        initializeConsumers();
    },
};

export const app = createServiceApp(options);
export const start = () => startService(app, options);

if (require.main === module) {
    start().catch((err) => {
        console.error(`[${NAME}] Fatal: failed to start:`, err);
        process.exit(1);
    });
}
