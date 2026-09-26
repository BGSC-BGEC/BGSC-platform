import { NotificationCategory } from '@bgsc/shared';

/**
 * The message templating system (MVP plan Week 4 Saturday).
 *
 * One registry keyed by notification type, so the wording of every message the platform sends is
 * in one file rather than inlined at six call sites. `{{var}}` interpolation, nothing more —
 * `ponytail:` string replacement, not a template engine. The upgrade path is WhatsApp's own
 * *approved message templates*, which a business-initiated conversation outside the 24h service
 * window requires; that needs a WhatsApp Business account to register them against, so it is not
 * today's work (notification-model.md §7).
 */

export interface Template {
    category: NotificationCategory;
    /** In-app card heading. Clamped to the model's 140. */
    title: string;
    /** In-app card body. Clamped to the model's 500. */
    body: string;
    /**
     * The WhatsApp text, when this type is ever broadcast. Deliberately a separate string, not the
     * in-app body re-used: the two have different length budgets and different markup (`*bold*` is
     * WhatsApp's, and would be literal asterisks in the app).
     */
    whatsapp?: string;
}

/** Model limits, mirrored here so `render` clamps rather than letting mongoose reject at insert. */
export const TITLE_MAX = 140;
export const BODY_MAX = 500;
/** WhatsApp's text limit is 4096; the margin covers the title and the attribution line. */
export const WHATSAPP_MAX = 3500;

export const TEMPLATES = {
    'announcement.published': {
        category: 'announcement',
        title: '{{title}}',
        body: '{{summary}}',
        whatsapp: '*{{title}}*\n\n{{body}}\n\n— {{author}}',
    },
    'registration.confirmed': {
        category: 'event',
        title: "You're in: {{event_title}}",
        body: 'Your registration for {{event_title}} is confirmed. See you there.',
    },
    'registration.waitlisted': {
        category: 'event',
        title: 'Waitlisted: {{event_title}}',
        body: "You're number {{position}} on the waitlist for {{event_title}}. We'll tell you if a place opens up.",
    },
    'challenge.approved': {
        category: 'challenge',
        title: 'Challenge approved: {{challenge_title}}',
        body: 'Your submission for {{challenge_title}} was approved and {{award_points}} points are on their way.',
    },
    'challenge.rejected': {
        category: 'challenge',
        title: 'Submission not approved: {{challenge_title}}',
        body: 'Your submission for {{challenge_title}} was not approved. Reason: {{reason}}',
    },
    'points.earned': {
        category: 'system',
        title: 'You earned {{amount}} points',
        body: '{{reason}} — your balance is now {{balance}}.',
    },
    'event.cancelled': {
        category: 'event',
        title: 'Cancelled: {{event_title}}',
        body: '{{event_title}} has been cancelled. Any points awarded for it are reversed automatically.',
    },
    'feedback.submitted': {
        category: 'system',
        title: 'New {{kind}}: {{ticket_no}}',
        body: '{{subject}} ({{category}})',
    },
    'feedback.responded': {
        category: 'system',
        title: 'Reply to {{ticket_no}}',
        body: 'The team has responded to your ticket {{ticket_no}}. Open it to read the reply.',
    },
    // `category` is overridden to 'challenge' for a challenge team (consumers.ts:onTeamInviteCreated).
    'team.invited': {
        category: 'event',
        title: 'Team invite: {{team_name}}',
        body: "You've been invited to join {{team_name}}. Accept it from the team page; it expires in 72 hours.",
    },
    'auction.sold.player': {
        category: 'event',
        title: 'Signed to {{team_name}}',
        body: '{{team_name}} bought you for {{amount}} in the {{event_title}} auction.',
    },
    'auction.sold.captain': {
        category: 'event',
        title: 'You signed {{player_name}}',
        body: '{{player_name}} joins {{team_name}} for {{amount}} in the {{event_title}} auction.',
    },
} as const satisfies Record<string, Template>;

export type TemplateKey = keyof typeof TEMPLATES;

export type TemplateVars = Record<string, string | number | null | undefined>;

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/**
 * Substitute, strictly.
 *
 * A missing variable **throws** rather than rendering an empty string or leaving the placeholder
 * in place. Every caller runs inside the consumer's `safe()` wrapper, so the failure becomes a
 * logged, undelivered notification — which is recoverable. A notification that reaches four
 * hundred people reading "Cancelled: {{event_title}}" is not.
 */
export function render(text: string, vars: TemplateVars): string {
    return text.replace(PLACEHOLDER, (_match, key: string) => {
        const value = vars[key];
        if (value === undefined || value === null || value === '') {
            throw new Error(`template variable '${key}' is missing`);
        }
        return String(value);
    });
}

function clamp(text: string, max: number): string {
    return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export interface RenderedMessage {
    category: NotificationCategory;
    type: TemplateKey;
    title: string;
    body: string;
}

/** The in-app half: title and body, rendered and clamped to what the model will accept. */
export function renderMessage(type: TemplateKey, vars: TemplateVars): RenderedMessage {
    const t: Template = TEMPLATES[type];
    return {
        category: t.category,
        type,
        title: clamp(render(t.title, vars), TITLE_MAX),
        body: clamp(render(t.body, vars), BODY_MAX),
    };
}

/** The WhatsApp half. Returns null for a type that is not broadcast on that channel. */
export function renderWhatsApp(type: TemplateKey, vars: TemplateVars): string | null {
    const t: Template = TEMPLATES[type];
    if (!t.whatsapp) return null;
    return clamp(render(t.whatsapp, vars), WHATSAPP_MAX);
}
