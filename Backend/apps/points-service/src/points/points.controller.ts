import { IPointTransaction, UserRole, rankOf, wrap } from '@bgsc/shared';
import { Request, Response } from 'express';
import * as rules from '../rules/rules.service';
import { actorOf } from './actor';
import * as svc from './points.service';
import { AdjustBodyInput, AwardBodyInput, EventLedgerQueryInput, HistoryQueryInput, RulePatchBodyInput } from './points.schemas';

/**
 * Thin by contract: parse, call the service, return a bare object. The `{ success, data }`
 * envelope is added centrally by `createServiceApp`.
 */

const isAdmin = (req: Request) => rankOf(req.user!.role) >= rankOf(UserRole.CORE);

/**
 * `note` is an admin's free-text justification on a clawback and `actor.user_id` is who wrote it;
 * neither is owed to the member it happened to. Both stay for core+.
 */
function present(tx: IPointTransaction, admin: boolean): Record<string, unknown> {
    const row = {
        id: tx._id,
        user_id: tx.user_id,
        amount: tx.amount,
        type: tx.type,
        source: tx.source,
        reason: tx.reason,
        reference: tx.reference,
        balance_after: tx.balance_after,
        expires_at: tx.expires_at,
        created_at: tx.created_at,
    };
    return admin ? { ...row, note: tx.note, actor: tx.actor, idempotency_key: tx.idempotency_key } : row;
}

const presentPage = (page: svc.Page, admin: boolean) => ({
    transactions: page.transactions.map((tx) => present(tx, admin)),
    next_cursor: page.next_cursor,
});

/* ---------------------------------- user ---------------------------------- */

export const me = wrap(async (req: Request, res: Response) => {
    res.json(await svc.summary(req.user!.id));
});

export const myTransactions = wrap(async (req: Request, res: Response) => {
    const page = await svc.history(req.user!.id, req.query as unknown as HistoryQueryInput);
    res.json(presentPage(page, false));
});

export const myBreakdown = wrap(async (req: Request, res: Response) => {
    res.json(await svc.breakdown(req.user!.id));
});

export const opportunities = wrap(async (_req: Request, res: Response) => {
    res.json({ opportunities: await rules.opportunities() });
});

/* --------------------------------- admin ---------------------------------- */

export const userSummary = wrap(async (req: Request, res: Response) => {
    res.json(await svc.adminSummary((req.params as Record<string, string>).id));
});

export const userTransactions = wrap(async (req: Request, res: Response) => {
    const page = await svc.history(
        (req.params as Record<string, string>).id,
        req.query as unknown as HistoryQueryInput
    );
    res.json(presentPage(page, isAdmin(req)));
});

export const eventLedger = wrap(async (req: Request, res: Response) => {
    const page = await svc.eventLedger(
        (req.params as Record<string, string>).eventId,
        req.query as unknown as EventLedgerQueryInput
    );
    res.json({ ...presentPage(page, isAdmin(req)), podium_conflicts: page.podium_conflicts });
});

export const transactionAudit = wrap(async (req: Request, res: Response) => {
    res.json({ audit: await svc.transactionAudit((req.params as Record<string, string>).id) });
});

export const adjust = wrap(async (req: Request, res: Response) => {
    const result = await svc.adjust(req.body as AdjustBodyInput, actorOf(res));
    // A replay is the same decision arriving twice: 200 with the row it already wrote, not 201.
    res.status(result.replayed ? 200 : 201).json({
        transaction: present(result.tx, true),
        replayed: result.replayed,
    });
});

export const award = wrap(async (req: Request, res: Response) => {
    const result = await svc.awardPodium(req.body as AwardBodyInput, actorOf(res));
    res.status(result.replayed ? 200 : 201).json({
        transaction: present(result.tx, true),
        replayed: result.replayed,
    });
});

export const recalculate = wrap(async (req: Request, res: Response) => {
    res.json(await svc.recalculate((req.params as Record<string, string>).id, actorOf(res)));
});

/* --------------------------------- rules ---------------------------------- */

export const listRules = wrap(async (_req: Request, res: Response) => {
    res.json({ rules: await rules.listRules() });
});

export const updateRule = wrap(async (req: Request, res: Response) => {
    const rule = await rules.updateRule(
        (req.params as Record<string, string>).id,
        req.body as RulePatchBodyInput,
        actorOf(res)
    );
    res.json({ rule });
});
