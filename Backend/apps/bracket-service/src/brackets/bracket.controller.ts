import { IBracket, IMatch, wrap } from '@bgsc/shared';
import { RoleName } from '@bgsc/shared';
import { Request } from 'express';
import { Viewer, actorOf } from './actor';
import * as svc from './bracket.service';
import { GenerateBracketInput } from './bracket.schemas';
import { standingsOf } from './standings';

/**
 * Thin: parse, call, answer. Refusals are `ServiceError`s raised in the service and mapped centrally.
 *
 * `__v` is mongoose bookkeeping and never leaves. Everything else here is public by design — Spec
 * §5.5 makes the spectator bracket view a public screen.
 */

const viewerOf = (req: Request): Viewer => ({ id: req.user?.id ?? null, role: req.user?.role as RoleName | undefined });

const strip = <T extends object>(doc: T): Omit<T, '__v'> => {
    const { __v, ...rest } = doc as T & { __v?: number };
    return rest as Omit<T, '__v'>;
};

const present = (bracket: IBracket, matches: IMatch[]) => ({
    bracket: strip(typeof (bracket as { toObject?: unknown }).toObject === 'function'
        ? (bracket as unknown as { toObject: () => IBracket }).toObject()
        : bracket),
    matches: matches.map(strip),
});

export const generate = wrap(async (req, res) => {
    const { bracket, matches } = await svc.generateBracket(req.body as GenerateBracketInput, actorOf(req));
    res.status(201).json(present(bracket, matches));
});

export const get = wrap(async (req, res) => {
    const eventId = (req.params as Record<string, string>).event_id;
    const { bracket, matches } = await svc.getBracket(eventId, viewerOf(req));
    res.json(present(bracket, matches));
});

export const standings = wrap(async (req, res) => {
    const eventId = (req.params as Record<string, string>).event_id;
    const { bracket, matches } = await svc.getBracket(eventId, viewerOf(req));
    res.json(standingsOf(bracket, matches));
});

export const remove = wrap(async (req, res) => {
    const eventId = (req.params as Record<string, string>).event_id;
    await svc.deleteBracket(eventId, actorOf(req));
    res.status(204).send();
});
