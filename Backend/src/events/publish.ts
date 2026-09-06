import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

/**
 * Domain event bus. MVP is an in-process emitter (docs/modeldocs/README.md); Kafka is Phase 2
 * (Spec §2.3). The point of having it now is that call sites are correct before the bus is real —
 * swapping the body of `publish()` for a Kafka producer should not touch a single caller.
 *
 * Envelope per docs/modeldocs/relationships.md §6.
 */

export interface DomainEvent<P = Record<string, unknown>> {
    message_id: string;
    type: string;
    occurred_at: Date;
    producer: string;
    schema_version: number;
    payload: P;
}

const bus = new EventEmitter();
// Every service subscribes to the events it consumes; the default cap of 10 is quickly hit.
bus.setMaxListeners(50);

/**
 * `message_id`, not `event_id` — an Event-domain payload already carries an `event_id` meaning the
 * Event entity, and consumers dedupe on the envelope id.
 */
export function publish<P extends Record<string, unknown>>(
    type: string,
    producer: string,
    payload: P
): DomainEvent<P> {
    const event: DomainEvent<P> = {
        message_id: randomUUID(),
        type,
        occurred_at: new Date(),
        producer,
        schema_version: 1,
        payload,
    };

    // A throwing consumer must not fail the request that produced the event: the write already
    // committed, and the emitter is fire-and-forget by contract.
    try {
        bus.emit(type, event);
        bus.emit('*', event);
    } catch (err) {
        console.error(`Event consumer threw for ${type}:`, err);
    }

    return event;
}

export function subscribe<P extends Record<string, unknown>>(
    type: string,
    handler: (event: DomainEvent<P>) => void
): () => void {
    bus.on(type, handler as (e: DomainEvent) => void);
    return () => bus.off(type, handler as (e: DomainEvent) => void);
}

/** Test seam. Do not call from service code. */
export function resetBus(): void {
    bus.removeAllListeners();
    bus.setMaxListeners(50);
}
