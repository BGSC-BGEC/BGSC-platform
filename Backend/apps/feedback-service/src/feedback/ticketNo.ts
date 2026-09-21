import { randomInt } from 'crypto';

/**
 * The human-readable ticket id (Spec §5.12: "auto-reply with ticket ID").
 *
 * A uuid is not something a person reads back over a phone or types into a search box, and for an
 * anonymous ticket this string is the only way back in — so it is also, deliberately, hard to
 * guess: eight characters from a 32-symbol alphabet is 2^40 possibilities behind a rate-limited
 * lookup (plan D15).
 *
 * Crockford base32 minus the vowels: no `0/O`, no `1/I/L`, and nothing that can accidentally spell
 * a word in a ticket number somebody has to read out.
 */
const ALPHABET = '23456789BCDFGHJKMNPQRSTVWXYZ';
const LENGTH = 8;

export const TICKET_PREFIX = 'BG-';

export function ticketNo(): string {
    let out = '';
    for (let i = 0; i < LENGTH; i++) {
        // randomInt, not Math.random: this is a capability, not a shuffle.
        out += ALPHABET[randomInt(ALPHABET.length)];
    }
    return `${TICKET_PREFIX}${out}`;
}

/** What the route accepts, so a lookup cannot be used to probe the collection with junk. */
export const TICKET_NO_PATTERN = new RegExp(`^${TICKET_PREFIX}[${ALPHABET}]{${LENGTH}}$`);
