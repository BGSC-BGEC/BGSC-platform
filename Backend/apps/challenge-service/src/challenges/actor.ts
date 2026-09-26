import { Response } from 'express';
import { IUser } from '@bgsc/shared';
import { Actor } from './challenge.service';

/**
 * What `requireActiveUser` (from `@bgsc/shared`) parked on `res.locals`: the LIVE user document and
 * the audit actor built from it. Write handlers read these rather than `req.user`, whose role is the
 * token's claim and outlives a demotion by up to fifteen minutes.
 */
export const userOf = (res: Response): IUser => res.locals.user;
export const actorOf = (res: Response): Actor => res.locals.actor;
