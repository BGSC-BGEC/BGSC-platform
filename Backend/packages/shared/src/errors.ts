/**
 * A deliberate, client-facing refusal. Thrown anywhere, mapped to its status by the shared error
 * handler — so no route can forget and turn a 409 into a 500.
 *
 * Lives here rather than in a service so the shared error handler can recognise it without
 * importing from a service (which would invert the dependency).
 */
export class ServiceError extends Error {
    constructor(public status: number, public code: string) {
        super(code);
        this.name = 'ServiceError';
    }
}
