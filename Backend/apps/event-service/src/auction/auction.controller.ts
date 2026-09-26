import { Request, Response } from 'express';
import { wrap } from '@bgsc/shared';
import * as svc from './auction.service';
import { LotStatus } from '@bgsc/shared';

/**
 * The actor for a write: the live user `requireActiveUser` loaded, never the token claim — a claim
 * outlives a demotion or suspension by up to fifteen minutes. Every write route mounts the guard.
 */
const writeActor = (req: Request) => ({ id: req.actor!._id, role: req.actor!.role });
const ref = (req: Request) => (req.params as Record<string, string>).ref;
const lotId = (req: Request) => (req.params as Record<string, string>).id;

export const liveState = wrap(async (req: Request, res: Response) => {
    res.json(await svc.getAuctionLiveState(ref(req), req.user));
});

export const listLots = wrap(async (req: Request, res: Response) => {
    res.json(await svc.listLots(ref(req), req.query.status as LotStatus | undefined, req.user));
});

export const getLot = wrap(async (req: Request, res: Response) => {
    res.json(await svc.getLot(lotId(req), req.user));
});

export const createLots = wrap(async (req: Request, res: Response) => {
    res.status(201).json(await svc.createLots(ref(req), writeActor(req), req.body));
});

export const start = wrap(async (req: Request, res: Response) => {
    res.json(await svc.startAuction(ref(req), writeActor(req)));
});

export const pause = wrap(async (req: Request, res: Response) => {
    res.json(await svc.pauseAuction(ref(req), writeActor(req)));
});

export const resume = wrap(async (req: Request, res: Response) => {
    res.json(await svc.resumeAuction(ref(req), writeActor(req)));
});

export const close = wrap(async (req: Request, res: Response) => {
    res.json(await svc.closeAuction(ref(req), writeActor(req)));
});

export const updateConfig = wrap(async (req: Request, res: Response) => {
    res.json(await svc.updateAuctionConfig(ref(req), writeActor(req), req.body));
});

export const bid = wrap(async (req: Request, res: Response) => {
    const { amount, version } = req.body;
    res.json(await svc.placeBid(lotId(req), writeActor(req), amount, version));
});

export const advance = wrap(async (req: Request, res: Response) => {
    res.json(await svc.advanceLot(lotId(req), writeActor(req)));
});

export const overridePrice = wrap(async (req: Request, res: Response) => {
    res.json(await svc.overrideLotPrice(lotId(req), writeActor(req), req.body));
});

export const overrideCaptainBudget = wrap(async (req: Request, res: Response) => {
    const { teamId } = req.params as Record<string, string>;
    res.json(await svc.overrideCaptainBudget(ref(req), teamId, writeActor(req), req.body));
});

export const budgetPreview = wrap(async (req: Request, res: Response) => {
    res.json(await svc.getBudgetPreview(ref(req), writeActor(req)));
});
