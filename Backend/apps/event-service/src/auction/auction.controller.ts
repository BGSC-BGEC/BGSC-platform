import { Request, Response } from 'express';
import { wrap } from '@bgsc/shared';
import * as svc from './auction.service';

const writeActor = (req: Request) =>
    req.actor ? { id: req.actor._id, role: req.actor.role } : req.user!;

export const liveState = wrap(async (req: Request, res: Response) => {
    const ref = (req.params as Record<string, string>).ref;
    const state = await svc.getAuctionLiveState(ref);
    res.json(state);
});

export const listLots = wrap(async (req: Request, res: Response) => {
    const ref = (req.params as Record<string, string>).ref;
    const status = req.query.status as any;
    const lots = await svc.listLots(ref, status);
    res.json(lots);
});

export const getLot = wrap(async (req: Request, res: Response) => {
    const id = (req.params as Record<string, string>).id;
    const lot = await svc.getLot(id);
    res.json(lot);
});

export const createLots = wrap(async (req: Request, res: Response) => {
    const actor = writeActor(req);
    const ref = (req.params as Record<string, string>).ref;
    const lots = await svc.createLots(ref, actor, req.body);
    res.status(201).json(lots);
});

export const start = wrap(async (req: Request, res: Response) => {
    const actor = writeActor(req);
    const ref = (req.params as Record<string, string>).ref;
    const state = await svc.startAuction(ref, actor);
    res.json(state);
});

export const pause = wrap(async (req: Request, res: Response) => {
    const actor = writeActor(req);
    const ref = (req.params as Record<string, string>).ref;
    const state = await svc.pauseAuction(ref, actor);
    res.json(state);
});

export const resume = wrap(async (req: Request, res: Response) => {
    const actor = writeActor(req);
    const ref = (req.params as Record<string, string>).ref;
    const state = await svc.resumeAuction(ref, actor);
    res.json(state);
});

export const close = wrap(async (req: Request, res: Response) => {
    const actor = writeActor(req);
    const ref = (req.params as Record<string, string>).ref;
    const state = await svc.closeAuction(ref, actor);
    res.json(state);
});

export const updateConfig = wrap(async (req: Request, res: Response) => {
    const actor = writeActor(req);
    const ref = (req.params as Record<string, string>).ref;
    const state = await svc.updateAuctionConfig(ref, actor, req.body);
    res.json(state);
});

export const bid = wrap(async (req: Request, res: Response) => {
    const bidder = writeActor(req);
    const id = (req.params as Record<string, string>).id;
    const { amount, version } = req.body;
    const updated = await svc.placeBid(id, bidder, amount, version);
    res.json(updated);
});

export const advance = wrap(async (req: Request, res: Response) => {
    const actor = writeActor(req);
    const id = (req.params as Record<string, string>).id;
    const result = await svc.advanceLot(id, actor);
    res.json(result);
});

export const overridePrice = wrap(async (req: Request, res: Response) => {
    const actor = writeActor(req);
    const id = (req.params as Record<string, string>).id;
    const updated = await svc.overrideLotPrice(id, actor, req.body);
    res.json(updated);
});

export const overrideCaptainBudget = wrap(async (req: Request, res: Response) => {
    const actor = writeActor(req);
    const { ref, teamId } = req.params as Record<string, string>;
    const team = await svc.overrideCaptainBudget(ref, teamId, actor, req.body);
    res.json(team);
});

export const budgetPreview = wrap(async (req: Request, res: Response) => {
    const ref = (req.params as Record<string, string>).ref;
    const preview = await svc.getBudgetPreview(ref);
    res.json(preview);
});
