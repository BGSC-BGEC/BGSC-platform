import { Request, Response } from 'express';
import * as service from './hallOfFame.service';

export async function listEntries(req: Request, res: Response) {
    const result = await service.listEntries(req.query as any);
    res.json(result);
}

export async function getFeaturedEntries(req: Request, res: Response) {
    const items = await service.getFeaturedEntries();
    res.json({ items });
}

export async function getEntryBySlugOrId(req: Request, res: Response) {
    const slugOrId = req.params.slugOrId as string;
    const entry = await service.getEntryBySlugOrId(slugOrId);
    res.json(entry);
}

export async function createEntry(req: Request, res: Response) {
    const actorId = req.actor!._id;
    const entry = await service.createEntry(req.body, actorId);
    res.status(201).json(entry);
}

export async function updateEntry(req: Request, res: Response) {
    const id = req.params.id as string;
    const actorId = req.actor!._id;
    const entry = await service.updateEntry(id, req.body, actorId);
    res.json(entry);
}

export async function deleteEntry(req: Request, res: Response) {
    const id = req.params.id as string;
    const actorId = req.actor!._id;
    const result = await service.deleteEntry(id, actorId);
    res.json(result);
}
