import { ServiceError, requireServiceToken } from '@bgsc/shared';
import { Router } from 'express';
import * as registrationService from '../registrations/registration.service';
import * as teamService from '../teams/team.service';
import { Request, Response, NextFunction } from 'express';

export const internalRoutes = Router();

// All internal routes require service token
internalRoutes.use(requireServiceToken);

// POST /internal/registrations/confirm - mark submission confirmed (called by Event Service)
internalRoutes.post('/registrations/confirm', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const registrationId = typeof req.body?.registration_id === 'string' ? req.body.registration_id : '';
        const registration = await registrationService.getRegistration(registrationId);

        // Via the shared transition so this path clears waitlist_position and records the real
        // `from` status, exactly like every other status change.
        await registrationService.transition(registration, 'confirmed', 'system', 'internal_confirmation');
        await registration.save();
        res.json(registration);
    } catch (err) {
        next(err);
    }
});

// POST /internal/teams/:id/debit-purse - debit team purse (called by Event Service for auction)
internalRoutes.post('/teams/:id/debit-purse', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const teamId = req.params.id as string;
        const amount = typeof req.body?.amount === 'number' ? req.body.amount : 0;
        if (!amount || amount <= 0) {
            throw new ServiceError(400, 'invalid_amount');
        }

        const team = await teamService.debitPurse(teamId, amount);
        res.json(team);
    } catch (err) {
        next(err);
    }
});

// POST /internal/teams/:id/add-member - add member to team (called by Event Service for auction)
internalRoutes.post('/teams/:id/add-member', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const teamId = req.params.id as string;
        const userId = typeof req.body?.user_id === 'string' ? req.body.user_id : '';
        const registrationId = typeof req.body?.registration_id === 'string' ? req.body.registration_id : '';

        if (!userId || !registrationId) {
            throw new ServiceError(400, 'user_id_and_registration_id_required');
        }

        const team = await teamService.addMemberToTeam(teamId, userId, registrationId, 'auction');
        res.json(team);
    } catch (err) {
        next(err);
    }
});

// GET /internal/teams/snapshot?ids=id1,id2 - bulk team snapshots
internalRoutes.get('/teams/snapshot', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const idsParam = typeof req.query.ids === 'string' ? req.query.ids : '';
        const ids = idsParam.split(',').filter(Boolean);
        const snapshots = await teamService.getTeamSnapshots(ids);
        res.json(snapshots);
    } catch (err) {
        next(err);
    }
});
