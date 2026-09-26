import { ServiceError, wrap } from '@bgsc/shared';
import { Request, Response } from 'express';
import * as svc from './strava.service';

/** Thin by contract. The `{ success, data }` envelope is added centrally. */

/**
 * JSON `{ url }`, not a 302. The route is Bearer-authenticated and a browser navigation cannot carry
 * a Bearer header, while a `fetch` that follows the redirect lands on strava.com cross-origin with
 * an unreadable `Location` — so as a redirect nobody could actually start the flow. The client
 * opens the returned URL itself (browser tab, system browser or web view).
 */
export const connect = wrap(async (req: Request, res: Response) => {
    res.json({ url: svc.authorizeUrl(req.user!.id) });
});

/**
 * The one browser-facing route in this backend: Strava sends the user here as a top-level
 * navigation, not as an API call. **Every outcome is a redirect**, never a JSON body.
 *
 * It links nothing: it checks the state and bounces `code`/`state`/`scope` to the app, which
 * completes the link with `POST /strava/link` under its own session (see `strava.service.ts`
 * `signState` for why). A failure the user cannot act on still has to put them back where they
 * started, with a reason the frontend can render.
 */
export const callback = wrap(async (req: Request, res: Response) => {
    const { code, state, error, scope } = req.query as { code?: unknown; state?: unknown; error?: unknown; scope?: unknown };
    // The user pressed Cancel on Strava's consent screen. Changing your mind is not an error.
    if (error || typeof code !== 'string' || !code) {
        res.redirect(302, svc.settingsUrl({ strava: 'denied' }));
        return;
    }

    try {
        // A repeated query key arrives as an array; only a single string is a state.
        res.redirect(
            302,
            svc.callbackTarget(code, typeof state === 'string' ? state : undefined, typeof scope === 'string' ? scope : undefined)
        );
    } catch (err) {
        // A deliberate refusal carries a code the frontend can turn into a sentence. Anything else
        // is ours and stays ours: log it, tell the user the link failed, and do not leak the shape
        // of the failure into a URL bar.
        const reason = err instanceof ServiceError ? err.code : 'error';
        if (!(err instanceof ServiceError)) {
            console.error('[challenge-service] strava callback failed:', err);
        }
        res.redirect(302, svc.settingsUrl({ strava: reason }));
    }
});

export const link = wrap(async (req: Request, res: Response) => {
    const { code, state, scope } = req.body as { code: string; state: string; scope: string };
    await svc.link(req.user!.id, code, state, scope);
    res.json(await svc.connectionOf(req.user!.id));
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
 * Another user's feed, for the profile screen. Private activities, private profiles and deleted
 * accounts are all filtered — reading your own feed does not filter.
 */
export const userActivities = wrap(async (req: Request, res: Response) => {
    const page = await svc.feedOf(req.params.id as string, req.user!.id, req.query as never);
    res.json({ activities: page.rows, next_cursor: page.next_cursor });
});
