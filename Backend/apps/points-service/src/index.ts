import { createServiceApp, startService } from '@bgsc/shared';
import express from 'express';
import { initializeConsumers } from './events/consumers';
import { internalRoutes } from './internal/internal.routes';
import { pointsRoutes } from './points/points.routes';
import { seedRules } from './rules/rules.service';
import { startExpirySweeper } from './scheduler/expiry';
import { startReplaySweeper } from './scheduler/replay';

/**
 * Points Service — :3006. Owns `point_transactions` (append-only ledger) and `point_rules`, and is
 * the only writer of `users.points_balance` (relationships.md, an agreed cross-service
 * exception).
 *
 * Makes no outbound HTTP calls: everything it needs from another domain is a read or an event, and
 * everything another domain needs from it is an inbound internal route.
 */

const NAME = 'points-service';
const PORT = parseInt(process.env.PORT || '3006', 10);

const options = {
    name: NAME,
    port: PORT,
    models: ['PointTransaction', 'PointRule', 'PointExpiryCursor', 'PointTxClaim'],
    routes(app: express.Express) {
        app.use('/points', pointsRoutes);
        // The leaderboard investment debit. The gateway refuses /internal from the edge; the
        // router mounts requireServiceToken regardless.
        app.use('/internal', internalRoutes);
    },
    async onReady() {
        // Insert-only: a restart must never revert an admin's toggle.
        await seedRules();
        // Attendance credits, cancellation reversals, challenge awards.
        initializeConsumers();
        // Credits past their expires_at become negative 'expire' rows.
        startExpirySweeper();
        // Missed EventCancelled / ParticipantAttended messages, re-derived.
        startReplaySweeper();
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
