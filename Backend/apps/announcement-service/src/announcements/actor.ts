import { Response } from 'express';
import { IUser } from '@bgsc/shared';
import { Editor } from './announcement.service';

/**
 * What `requireActiveUser` (from `@bgsc/shared`) leaves on `res.locals` for a write: the live user
 * document, and the `Editor` built from it — its role, not the token's claim.
 */
export const userOf = (res: Response): IUser => res.locals.user;
export const actorOf = (res: Response): Editor => res.locals.actor;
