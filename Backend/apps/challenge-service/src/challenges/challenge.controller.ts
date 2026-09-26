import { ChallengeParticipation, IChallenge, IChallengeParticipation, UserRole, rankOf, wrap } from '@bgsc/shared';
import { Request, Response } from 'express';
import { actorOf, userOf } from './actor';
import * as catalog from './challenge.service';
import * as part from './participation.service';

/**
 * Thin by contract: parse, call the service, return a bare object. The `{ success, data }`
 * envelope is added centrally by `createServiceApp`.
 */

const actorOfRequest = (req: Request) => ({ id: req.user!.id, ip: req.ip ?? null });
const isAdmin = (req: Request) => rankOf(req.user!.role) >= rankOf(UserRole.CORE);

/**
 * Spec §5.7: a digital challenge's full brief may be hidden until acceptance. Stripped here rather
 * than in the service because it is a presentation rule — the document keeps the description, and
 * a reviewer or an admin reading the same document sees it.
 */
function present(c: IChallenge, opts: { revealBrief: boolean }): Record<string, unknown> {
    const row = c.toObject() as Record<string, unknown>;
    if (c.brief_hidden_until_accept && !opts.revealBrief) row.description = null;
    return row;
}

export const create = wrap(async (req: Request, res: Response) => {
    const challenge = await catalog.createChallenge(req.body, actorOf(res));
    res.status(201).json(present(challenge, { revealBrief: true }));
});

export const update = wrap(async (req: Request, res: Response) => {
    const challenge = await catalog.updateChallenge(req.params.id as string, req.body, actorOf(res));
    res.json(present(challenge, { revealBrief: true }));
});

const transitionHandler = (verb: 'activate' | 'complete' | 'archive') =>
    wrap(async (req: Request, res: Response) => {
        const challenge = await catalog.transition(req.params.id as string, verb, actorOf(res));
        res.json(present(challenge, { revealBrief: true }));
    });

export const activate = transitionHandler('activate');
export const complete = transitionHandler('complete');
export const archive = transitionHandler('archive');

export const remove = wrap(async (req: Request, res: Response) => {
    await catalog.softDelete(req.params.id as string, actorOf(res));
    res.status(204).end();
});

export const list = wrap(async (req: Request, res: Response) => {
    const admin = isAdmin(req);
    const page = await catalog.listChallenges(req.query as never, { admin });
    res.json({
        challenges: page.rows.map((c) => present(c, { revealBrief: admin })),
        next_cursor: page.next_cursor,
    });
});

export const detail = wrap(async (req: Request, res: Response) => {
    const admin = isAdmin(req);
    const challenge = await catalog.getByKey(req.params.key as string, { admin });
    // One extra indexed read, and it is what turns the browser card into a stateful one: accepted,
    // submitted, approved. Served by { member_user_ids, status, accepted_at }.
    const mine = await ChallengeParticipation.findOne({
        challenge_id: challenge._id,
        member_user_ids: req.user!.id,
    });
    res.json({
        challenge: present(challenge, { revealBrief: admin || mine != null }),
        my_participation: mine ? await part.fillRewardIds(mine) : null,
    });
});

export const accept = wrap(async (req: Request, res: Response) => {
    const participation = await part.accept(req.params.id as string, req.body, actorOf(res));
    res.status(201).json(participation);
});

export const progress = wrap(async (req: Request, res: Response) => {
    const participation = await part.updateProgress(req.params.id as string, req.body, actorOfRequest(req));
    res.json(participation);
});

export const submit = wrap(async (req: Request, res: Response) => {
    const participation = await part.submit(req.params.id as string, req.body, actorOf(res));
    res.json(participation);
});

export const review = wrap(async (req: Request, res: Response) => {
    const participation = await part.review(
        req.params.id as string,
        req.body,
        actorOf(res),
        // The LIVE role, not the token's claim: `requireActiveUser` loaded the user document and
        // this decision publishes a payout. Read through `userOf` rather than `res.locals` with a
        // fallback to `req.user` — that fallback could never fire while the middleware is mounted,
        // and the day someone unmounts it, the route would quietly start trusting the token again.
        userOf(res).role as UserRole
    );
    res.json(participation);
});

export const withdraw = wrap(async (req: Request, res: Response) => {
    const participation = await part.withdraw(req.params.id as string, req.body.reason, actorOf(res));
    res.json(participation);
});

export const myParticipations = wrap(async (req: Request, res: Response) => {
    const page = await part.myParticipations(req.user!.id, req.query as never);
    res.json({ participations: page.rows, next_cursor: page.next_cursor });
});

export const participationDetail = wrap(async (req: Request, res: Response) => {
    const p: IChallengeParticipation = await part.getParticipation(
        req.params.id as string,
        actorOfRequest(req),
        req.user!.role as UserRole
    );
    res.json(p);
});

export const queue = wrap(async (req: Request, res: Response) => {
    const challenge = await catalog.getById(req.params.id as string);
    if (!part.mayReview(challenge, req.user!.id, req.user!.role as UserRole)) {
        // A non-reviewer must not learn which challenges have a queue.
        res.status(404).json({ error: 'challenge_not_found' });
        return;
    }
    const page = await part.queue(challenge._id, req.query as never);
    res.json({ participations: page.rows, next_cursor: page.next_cursor });
});
