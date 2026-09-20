import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { config } from '../config/env';

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
 * Cross-process transport. Services are separate processes now, so an in-memory emitter only
 * reaches subscribers inside the publishing service. Redis pub/sub carries the same envelope to
 * every other service; Kafka replaces this in Phase 2 (Spec §2.3) and no call site changes.
 *
 * Absent REDIS_URL, publishing stays in-process — which is correct for a single service running
 * alone in dev and for every test in this repo.
 */
const CHANNEL = 'bgsc.events';

interface Transport {
    publish(event: DomainEvent): void;
    close(): Promise<void>;
}

let transport: Transport | null = null;
/** Retry handle for a bus that was not reachable at startup. Cleared on shutdown. */
let reconnectTimer: NodeJS.Timeout | null = null;

const RECONNECT_MS = 10_000;

/**
 * Wire the bus, but never make it a reason not to serve.
 *
 * The initial `connect()` used to be awaited, so an unreachable Redis rejected out of
 * `startService()` and the process exited — every service in the platform crash-looping because
 * the *event* bus was down, while producers stayed up and dropped their events silently. That
 * contradicted this module's own contract two lines below ("Redis dropping is not fatal: the
 * service keeps serving, it just stops hearing other services"), which held only *after* a
 * successful first connect.
 *
 * Now the first connect happens in the background and retries until it lands. A service that boots
 * during a Redis outage answers HTTP immediately and starts hearing events when Redis returns.
 * What is lost either way is events published during the outage: Redis pub/sub has no persistence,
 * so this is the same exposure a producer already had, not a new one.
 */
export async function connectEventBus(): Promise<void> {
    if (!config.redisUrl || transport) return;

    // Required lazily so a service with no Redis configured never loads the driver.
    const { default: Redis } = await import('ioredis');
    const pub = new Redis(config.redisUrl, { maxRetriesPerRequest: null, lazyConnect: true });
    const sub = new Redis(config.redisUrl, { maxRetriesPerRequest: null, lazyConnect: true });

    sub.on('message', (_channel: string, raw: string) => {
        try {
            const event = JSON.parse(raw) as DomainEvent & { occurred_at: string };
            // A publisher receives its own message back; it already emitted locally.
            if (event.message_id && seen.has(event.message_id)) return;
            deliver({ ...event, occurred_at: new Date(event.occurred_at) });
        } catch (err) {
            console.error('Malformed event on the bus:', err);
        }
    });

    // Redis dropping is not fatal: the service keeps serving, it just stops hearing other services.
    pub.on('error', (err: Error) => console.error('Event bus (pub) error:', err.message));
    sub.on('error', (err: Error) => console.error('Event bus (sub) error:', err.message));

    transport = {
        publish: (event) => {
            pub.publish(CHANNEL, JSON.stringify(event)).catch((err: Error) =>
                console.error('Failed to publish event:', err.message)
            );
        },
        close: async () => {
            if (reconnectTimer) clearInterval(reconnectTimer);
            reconnectTimer = null;
            await Promise.allSettled([pub.quit(), sub.quit()]);
            transport = null;
        },
    };

    const attempt = async (): Promise<boolean> => {
        try {
            // A client that already connected throws rather than connecting twice; either way the
            // only thing that matters is that the subscription is live.
            if (pub.status !== 'ready') await pub.connect();
            if (sub.status !== 'ready') await sub.connect();
            await sub.subscribe(CHANNEL);
            console.log('Event bus connected (redis pub/sub).');
            return true;
        } catch (err) {
            return false;
        }
    };

    if (!(await attempt())) {
        console.error(
            `Event bus unreachable at startup; serving without cross-service events, retrying every ${
                RECONNECT_MS / 1000
            }s.`
        );
        reconnectTimer = setInterval(() => {
            void attempt().then((ok) => {
                if (ok && reconnectTimer) {
                    clearInterval(reconnectTimer);
                    reconnectTimer = null;
                }
            });
        }, RECONNECT_MS);
        // Never hold the process open on a retry timer during shutdown.
        reconnectTimer.unref();
    }
}

export async function disconnectEventBus(): Promise<void> {
    await transport?.close();
}

/** Own-message suppression. Bounded so a long-lived process cannot grow it without limit. */
const seen = new Set<string>();
function remember(id: string): void {
    seen.add(id);
    if (seen.size > 5000) {
        for (const old of seen) {
            seen.delete(old);
            if (seen.size <= 2500) break;
        }
    }
}

/** Fan out to local subscribers. Shared by the in-process path and the Redis path. */
function deliver(event: DomainEvent): void {
    // A throwing consumer must not fail the request that produced the event: the write already
    // committed, and the emitter is fire-and-forget by contract.
    try {
        bus.emit(event.type, event);
        bus.emit('*', event);
    } catch (err) {
        console.error(`Event consumer threw for ${event.type}:`, err);
    }
}

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

    remember(event.message_id);
    deliver(event);
    transport?.publish(event);

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
    seen.clear();
}
