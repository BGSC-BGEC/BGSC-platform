/**
 * A deliberate, client-facing refusal. Thrown anywhere, mapped to its status by the shared error
 * handler — so no route can forget and turn a 409 into a 500.
 *
 * Lives here rather than in a service so the shared error handler can recognise it without
 * importing from a service (which would invert the dependency).
 */
export class ServiceError extends Error {
    /**
     * `details` carries the per-field reasons behind a refusal — the form validation engine's
     * output, for instance. Without it a `validation_failed` tells a client that something is
     * wrong and nothing about what, which is not an error message, it is a shrug.
     */
    constructor(public status: number, public code: string, public details?: unknown) {
        super(code);
        this.name = 'ServiceError';
        // Restores the prototype chain when the class is extended across a compiled boundary, so
        // `err instanceof ServiceError` in the shared error handler stays true.
        Object.setPrototypeOf(this, ServiceError.prototype);
    }
}
