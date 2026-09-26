import { EventEmitter } from 'events';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { config } from '../config/env';
import { redisOptions } from '../config/redis';

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

/**
 * This process, for own-message suppression. A publisher hears its own message back from Redis and
 * has already delivered it locally. Suppression used to be a bounded set of recent message ids, so
 * a burst of more than ~2500 publishes before the echoes arrived (a Redis outage drains the ioredis
 * offline queue all at once) evicted ids and delivered those events a second time.
 * An id per process has no capacity to run out of.
 */
export const INSTANCE_ID: string = randomUUID();

/**
 * Wire format: `{ v: 1, sig, body }`, where `body` is the event JSON (plus `instance`) as a string
 * and `sig` is HMAC-SHA256(body) keyed by INTERNAL_API_TOKEN. Signing the string, not a re-serialized
 * object, means there is no canonical-JSON question to get wrong.
 *
 * Why: consumers act on payloads (points-service credits `award_points` from ChallengeCompleted), and
 * anything that could reach Redis could PUBLISH a forged one. Only a holder of the
 * internal token can now produce a message a service will accept.
 *
 * ponytail: no replay window. A captured message can be re-sent by whoever can read the channel —
 * which already requires the Redis password — and consumers dedupe on their own idempotency keys.
 * Add a timestamp check against `occurred_at` if the bus ever crosses an untrusted network.
 */
interface WireMessage {
    v: 1;
    sig: string;
    body: string;
}

const sign = (body: string, key: string = config.internalToken): string =>
    createHmac('sha256', key).update(body).digest('hex');

/**
 * Keys a received message may be signed with: the current token and, during a rotation, the
 * previous one (INTERNAL_API_TOKEN_PREVIOUS, verification only — this process always signs with the
 * current key). Rotation is still "restart every service at once": the window this covers is the
 * messages already in flight while the fleet restarts.
 */
const verificationKeys = (): string[] =>
    [config.internalToken, config.internalTokenPrevious].filter((k): k is string => !!k);

function signatureMatches(body: string, sig: string): boolean {
    const given = Buffer.from(sig, 'hex');
    return verificationKeys().some((key) => {
        const expected = Buffer.from(sign(body, key), 'hex');
        return given.length === expected.length && timingSafeEqual(given, expected);
    });
}

export function encodeWire(event: DomainEvent, instance: string = INSTANCE_ID): string {
    const body = JSON.stringify({ ...event, instance });
    return JSON.stringify({ v: 1, sig: sign(body), body } satisfies WireMessage);
}

/**
 * The inverse, or `null` for anything that must not be delivered: unparseable, unsigned, a bad
 * signature, or this process's own echo. Exported so the selfcheck can drive it without Redis.
 */
export function decodeWire(raw: string): DomainEvent | null {
    let wire: Partial<WireMessage>;
    try {
        wire = JSON.parse(raw);
    } catch {
        console.error('Event bus: dropped an unparseable message');
        return null;
    }
    if (typeof wire?.body !== 'string' || typeof wire.sig !== 'string') {
        console.error('Event bus: dropped an unsigned message');
        return null;
    }
    if (!signatureMatches(wire.body, wire.sig)) {
        console.error('Event bus: dropped a message with a bad signature');
        return null;
    }
    const parsed = JSON.parse(wire.body) as DomainEvent & { occurred_at: string; instance?: string };
    if (parsed.instance === INSTANCE_ID) return null;
    const { instance: _instance, ...event } = parsed;
    return { ...event, occurred_at: new Date(parsed.occurred_at) };
}

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
    let pub: InstanceType<typeof Redis>;
    let sub: InstanceType<typeof Redis>;
    try {
        // Options object, password separate (config/redis.ts): a raw password in the URL either
        // failed to parse — and `new Redis` threw out of startService, crash-looping every service —
        // or silently failed auth. A bad URL is now the same as an unreachable Redis.
        const conn = redisOptions();
        pub = new Redis({ ...conn, maxRetriesPerRequest: null, lazyConnect: true });
        sub = new Redis({ ...conn, maxRetriesPerRequest: null, lazyConnect: true });
    } catch (err) {
        console.error(`Event bus disabled: REDIS_URL is not usable (${(err as Error).message}).`);
        return;
    }

    sub.on('message', (_channel: string, raw: string) => {
        const event = decodeWire(raw);
        if (event) deliver(event);
    });

    // Redis dropping is not fatal: the service keeps serving, it just stops hearing other services.
    pub.on('error', (err: Error) => console.error('Event bus (pub) error:', err.message));
    sub.on('error', (err: Error) => console.error('Event bus (sub) error:', err.message));

    transport = {
        publish: (event) => {
            pub.publish(CHANNEL, encodeWire(event)).catch((err: Error) =>
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

/**
 * Fan out to local subscribers. Shared by the in-process path and the Redis path.
 *
 * Each listener is isolated. `bus.emit` stops at the first listener that throws, so one broken
 * consumer used to silently skip every other consumer of the same type and the `'*'` listeners —
 * and an async listener's rejection escaped the try/catch entirely. A consumer
 * failing must not fail the request that produced the event either: the write already committed.
 */
function deliver(event: DomainEvent): void {
    const report = (err: unknown) => console.error(`Event consumer threw for ${event.type}:`, err);
    for (const listener of [...bus.listeners(event.type), ...bus.listeners('*')]) {
        try {
            const result = (listener as (e: DomainEvent) => unknown)(event);
            if (result && typeof (result as Promise<unknown>).then === 'function') {
                (result as Promise<unknown>).then(undefined, report);
            }
        } catch (err) {
            report(err);
        }
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
}
