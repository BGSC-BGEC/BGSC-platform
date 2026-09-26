import { IFeedbackTicket, RoleName, wrap } from '@bgsc/shared';
import { Request } from 'express';
import { actorOf } from './actor';
import * as svc from './feedback.service';
import {
    ListTicketsInput,
    SubmitContactInput,
    SubmitFeedbackInput,
    UpdateSeverityInput,
    UpdateStatusInput,
} from './feedback.schemas';

/**
 * Thin: parse, call, answer.
 *
 * `present` is where the anonymity promise is kept on the way out as well as on the way in: a
 * ticket's `contact_email` is the reporter's address, and it goes to staff and to the reporter
 * themselves — never to whoever else happens to hold the number.
 */

const ticketNoOf = (req: Request): string => (req.params as Record<string, string>).ticket_no;

function present(ticket: IFeedbackTicket, viewer: { id: string | null; role: RoleName | undefined }) {
    // Some paths hand back a hydrated document and some a lean object. Destructuring a document
    // yields mongoose's internals and none of the fields, so it is flattened first — a 200 with an
    // empty body is the kind of bug that only shows up over HTTP.
    const plain = (
        typeof (ticket as { toObject?: unknown }).toObject === 'function'
            ? (ticket as unknown as { toObject: () => IFeedbackTicket }).toObject()
            : ticket
    ) as IFeedbackTicket & { __v?: number };
    const { __v, contact_email, ...rest } = plain;
    const staff = svc.isStaff(viewer.role);
    const mine = ticket.reporter?.user_id && ticket.reporter.user_id === viewer.id;
    return staff || mine ? { ...rest, contact_email } : rest;
}

/**
 * The LIVE viewer: `req.actor` where `requireActiveUser` already loaded it, otherwise one read of
 * the user. Never the token claim — the staff view hands out reporters' addresses.
 */
const viewerOf = async (req: Request): Promise<{ id: string | null; role: RoleName | undefined }> =>
    req.actor ? { id: req.actor._id, role: req.actor.role as RoleName } : svc.liveViewer(req.user);

export const submitFeedback = wrap(async (req, res) => {
    const submitter = await svc.submitterFor(req.user, req.ip ?? null);
    const ticket = await svc.submitFeedback(req.body as SubmitFeedbackInput, submitter);
    // The number is the receipt, and for an anonymous ticket it is the only way back in.
    res.status(201).json({ ticket_no: ticket.ticket_no, status: ticket.status, created_at: ticket.created_at });
});

export const submitContact = wrap(async (req, res) => {
    const submitter = await svc.submitterFor(req.user, req.ip ?? null);
    const ticket = await svc.submitContact(req.body as SubmitContactInput, submitter);
    res.status(201).json({ ticket_no: ticket.ticket_no, status: ticket.status, created_at: ticket.created_at });
});

export const getTicket = wrap(async (req, res) => {
    const viewer = await viewerOf(req);
    res.json(present(await svc.getTicket(ticketNoOf(req), viewer), viewer));
});

export const listMine = wrap(async (req, res) => {
    const viewer = await viewerOf(req);
    // A token whose account is gone or suspended is not a session.
    if (!viewer.id) return void res.status(401).json({ error: 'unauthorized' });
    const { tickets, next_cursor } = await svc.listMine(viewer.id, req.query as unknown as ListTicketsInput);
    res.json({ tickets: tickets.map((t) => present(t, viewer)), next_cursor });
});

export const listInbox = wrap(async (req, res) => {
    const viewer = await viewerOf(req);
    const { tickets, next_cursor } = await svc.listInbox(req.query as unknown as ListTicketsInput);
    res.json({ tickets: tickets.map((t) => present(t, viewer)), next_cursor });
});

export const updateStatus = wrap(async (req, res) => {
    const ticket = await svc.setStatus(ticketNoOf(req), req.body as UpdateStatusInput, actorOf(req));
    res.json(present(ticket, await viewerOf(req)));
});

export const updateSeverity = wrap(async (req, res) => {
    const { severity } = req.body as UpdateSeverityInput;
    const ticket = await svc.setSeverity(ticketNoOf(req), severity, actorOf(req));
    res.json(present(ticket, await viewerOf(req)));
});
