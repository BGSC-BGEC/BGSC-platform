import { Request, Response } from 'express';
import { ServiceError, wrap } from '@bgsc/shared';
import { z } from 'zod';
import * as svc from './leaderboard.service';
import {
    QueryGlobalLeaderboardInput,
    QueryEventLeaderboardInput,
    SubmitScoresInput,
    InvestPointsInput,
    ProjectInvestmentInput,
} from './leaderboard.schemas';

export const writeActor = (req: Request) =>
    req.actor ? { id: req.actor._id, role: req.actor.role } : req.user!;

export const getGlobalLeaderboard = wrap(async (req: Request, res: Response) => {
    const result = await svc.getGlobalLeaderboard(req.query as unknown as QueryGlobalLeaderboardInput);
    res.json(result);
});

export const getEventLeaderboard = wrap(async (req: Request, res: Response) => {
    const ref = req.params.ref as string;
    const result = await svc.getEventLeaderboard(
        ref,
        req.query as unknown as QueryEventLeaderboardInput
    );
    res.json(result);
});

export const getPodium = wrap(async (req: Request, res: Response) => {
    const ref = req.params.ref as string;
    const result = await svc.getPodium(ref);
    res.json(result);
});

export const getSnapshots = wrap(async (req: Request, res: Response) => {
    const ref = req.params.ref as string;
    const result = await svc.getSnapshots(ref);
    res.json(result);
});

export const getMyEntry = wrap(async (req: Request, res: Response) => {
    const ref = req.params.ref as string;
    const actor = writeActor(req);
    const entry = await svc.getMyEntry(ref, actor.id);
    res.json(entry);
});

export const projectInvestment = wrap(async (req: Request, res: Response) => {
    const ref = req.params.ref as string;
    const actor = writeActor(req);
    const query = req.query as unknown as ProjectInvestmentInput;
    const result = await svc.projectInvestment(ref, actor, query.amount);
    res.json(result);
});

export const investPoints = wrap(async (req: Request, res: Response) => {
    const ref = req.params.ref as string;
    const actor = writeActor(req);
    const body = req.body as InvestPointsInput;
    // The client's idempotency key: body `request_id`, else the `Idempotency-Key` header. A retry
    // with the same key is the same investment.
    const header = req.header('idempotency-key');
    if (header !== undefined && !z.string().uuid().safeParse(header).success) {
        throw new ServiceError(422, 'invalid_idempotency_key');
    }
    const result = await svc.investPoints(ref, actor, body.amount, body.request_id ?? header);
    res.json(result);
});

export const submitScores = wrap(async (req: Request, res: Response) => {
    const ref = req.params.ref as string;
    const actor = writeActor(req);
    const body = req.body as SubmitScoresInput;
    const result = await svc.submitScores(ref, actor, body);
    res.json(result);
});
