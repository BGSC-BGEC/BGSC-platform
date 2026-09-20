import { ServiceError, config, wrap } from '@bgsc/shared';
import { Request, Response } from 'express';
import * as svc from './strava.service';

/** Thin by contract. The `{ success, data }` envelope is added centrally. */

/** Where the user lands after any outcome of the OAuth round trip. */
const settings = (outcome: string) =>
    `${config.frontendUrl}/settings/integrations?strava=${encodeURIComponent(outcome)}`;

export const connect = wrap(async (req: Request, res: Response) => {
    res.redirect(302, svc.authorizeUrl(req.user!.id));
});

/**
 * The one browser-facing route in this backend: Strava sends the user here as a top-level
 * navigation, not as an API call. **Every outcome is a redirect**, never a JSON body.
 *
 * It used to throw like any other route, so a forged state, an already-linked athlete or an
 * unconfigured client left the user staring at `{"error":"..."}` in their address bar, outside the
 * app, with no way back. Only the Cancel path redirected. A failure the user cannot act on still
 * has to put them back where they started, with a reason the frontend can render.
 */
export const callback = wrap(async (req: Request, res: Response) => {
    const { code, state, error } = req.query as { code?: string; state?: string; error?: string };
    // The user pressed Cancel on Strava's consent screen. Changing your mind is not an error.
    if (error || !code) {
        res.redirect(302, settings('denied'));
        return;
    }

    try {
        res.redirect(302, await svc.handleCallback(code, state));
    } catch (err) {
        // A deliberate refusal carries a code the frontend can turn into a sentence. Anything else
        // is ours and stays ours: log it, tell the user the link failed, and do not leak the shape
        // of the failure into a URL bar.
        const reason = err instanceof ServiceError ? err.code : 'error';
        if (!(err instanceof ServiceError)) {
            console.error('[challenge-service] strava callback failed:', err);
        }
        res.redirect(302, settings(reason));
    }
});

export const disconnect = wrap(async (req: Request, res: Response) => {
    await svc.disconnect(req.user!.id);
    res.status(204).end();
});

export const status = wrap(async (req: Request, res: Response) => {
    res.json(await svc.connectionOf(req.user!.id));
});

export const sync = wrap(async (req: Request, res: Response) => {
    res.json(await svc.sync(req.user!.id));
});

export const myActivities = wrap(async (req: Request, res: Response) => {
    const page = await svc.listActivities(req.user!.id, req.query as never);
    res.json({ activities: page.rows, next_cursor: page.next_cursor });
});

/**
 * Another user's feed, for the profile screen. Private activities are filtered out — reading your
 * own feed is `/strava/activities`, which does not filter.
 */
export const userActivities = wrap(async (req: Request, res: Response) => {
    const targetId = req.params.id as string;
    const page = await svc.listActivities(targetId, req.query as never, { publicOnly: targetId !== req.user!.id });
    res.json({ activities: page.rows, next_cursor: page.next_cursor });
});
