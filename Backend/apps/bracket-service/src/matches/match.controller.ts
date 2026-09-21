import { IMatch, RoleName, wrap } from '@bgsc/shared';
import { Request } from 'express';
import { Viewer, actorOf } from '../brackets/actor';
import { ListMatchesInput, ReportResultInput, ScheduleMatchInput } from '../brackets/bracket.schemas';
import * as brackets from '../brackets/bracket.service';
import * as svc from './match.service';

const viewerOf = (req: Request): Viewer => ({ id: req.user?.id ?? null, role: req.user?.role as RoleName | undefined });

const strip = (m: IMatch): Omit<IMatch, '__v'> => {
    const plain = typeof (m as { toObject?: unknown }).toObject === 'function'
        ? (m as unknown as { toObject: () => IMatch }).toObject()
        : m;
    const { __v, ...rest } = plain as IMatch & { __v?: number };
    return rest as Omit<IMatch, '__v'>;
};

export const list = wrap(async (req, res) => {
    const q = req.query as unknown as ListMatchesInput;
    const matches = await brackets.listMatchesFor(q.event_id, viewerOf(req), { round: q.round, status: q.status });
    res.json({ matches: matches.map(strip) });
});

export const get = wrap(async (req, res) => {
    const id = (req.params as Record<string, string>).id;
    res.json(strip(await brackets.getMatch(id, viewerOf(req))));
});

export const report = wrap(async (req, res) => {
    const id = (req.params as Record<string, string>).id;
    res.json(strip(await svc.reportResult(id, req.body as ReportResultInput, actorOf(req))));
});

export const schedule = wrap(async (req, res) => {
    const id = (req.params as Record<string, string>).id;
    res.json(strip(await svc.scheduleMatch(id, req.body as ScheduleMatchInput, actorOf(req))));
});
