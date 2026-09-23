import { createServiceApp, startService } from '@bgsc/shared';
import express from 'express';
import { initializeConsumers } from './events/consumers';
import { leaderboardRoutes } from './leaderboard/leaderboard.routes';

/**
 * Leaderboard Service — :3007.
 * Owns `leaderboard_entries` and `leaderboard_snapshots`.
 * Config lives on `events` (Event Service); the Global leaderboard is a query over `point_transactions`.
 */

const NAME = 'leaderboard-service';
const PORT = parseInt(process.env.PORT || '3007', 10);

const options = {
    name: NAME,
    port: PORT,
    routes(app: express.Express) {
        app.use('/leaderboards', leaderboardRoutes);
    },
    async onReady() {
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
