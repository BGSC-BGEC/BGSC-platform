import { config } from '@bgsc/shared';

/**
 * Outgoing mail for feedback (Spec §5.12's auto-reply).
 *
 * The same dev-console / prod-stub shape as `auth-service/src/auth/mailer.service.ts`, and
 * deliberately a second copy rather than a shared module (plan D5): there is no SMTP provider
 * configured anywhere in this repo, so both files are `console.log` in development and a stub in
 * production. Promoting a stub into `@bgsc/shared` would invent a contract for a thing that does
 * not exist yet; when a real provider lands, one module replaces two and this file is deleted.
 */
export class FeedbackMailer {
    /** Spec §5.12: the submitter is told their ticket id, whoever they are. */
    static async sendTicketReceipt(toEmail: string, ticketNo: string, subject: string): Promise<void> {
        const body = `We have your message. Your ticket is ${ticketNo} — quote it if you write back.`;

        if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
            console.log('----------------------------------------------------');
            console.log(`📧 [DEV EMAIL] To: ${toEmail}`);
            console.log(`Subject: [${ticketNo}] ${subject}`);
            console.log(body);
            console.log('----------------------------------------------------');
            return;
        }

        console.log(`[PROD EMAIL STUB] Ticket receipt ${ticketNo} sent to ${toEmail}`);
    }

    /** A reply from staff, which is the other half of a ticket system that is worth having. */
    static async sendResponse(toEmail: string, ticketNo: string, response: string): Promise<void> {
        if (config.nodeEnv === 'development' || config.nodeEnv === 'test') {
            console.log('----------------------------------------------------');
            console.log(`📧 [DEV EMAIL] To: ${toEmail}`);
            console.log(`Subject: Re: [${ticketNo}]`);
            console.log(response);
            console.log('----------------------------------------------------');
            return;
        }

        console.log(`[PROD EMAIL STUB] Response for ${ticketNo} sent to ${toEmail}`);
    }
}
