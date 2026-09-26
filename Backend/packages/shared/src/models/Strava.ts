import { Schema, model, Document } from 'mongoose';
import { uuidId, timestamps } from './shared';

/**
 * Strava account linking. See docs/modeldocs/strava-model.md.
 * Collections: `strava_credentials` (one row per connected user), `strava_activities`.
 *
 * Strava is a CONNECTION, never a login method (Spec §9.1, §12.4 "Connect / Disconnect Strava"):
 * a user must already hold a BGSC account before they can link one. Nothing here participates in
 * authentication.
 *
 * Owned by the Challenge Service — physical challenges are what
 * the activities are proof for. They have a second reader, the user profile, which queries
 * `strava_activities` directly rather than through an API (adding-a-service.md §6.5).
 *
 * docs/SystemDesignDocs/strava-integration.md describes these as TypeORM entities on Postgres with
 * a `raw` jsonb column. The stack is Mongoose on Mongo and the blob is deliberately not stored:
 * keeping a whole third-party response "for future use" is keeping personal data with no reader
 * and no retention story.
 */

export interface IStravaCredential extends Document<string> {
    _id: string;
    user_id: string;
    athlete_id: string;
    /** AES-256-GCM, `iv:tag:ciphertext` hex. Never logged, never published on the event bus. */
    access_token_enc: string;
    refresh_token_enc: string;
    /** When Strava's access token dies. Refreshed inside a 5-minute margin. */
    expires_at: Date;
    scope: string;
    /** Watermark for the next sync's `after=`. Null until the first successful sync. */
    last_synced_at: Date | null;
    /** When the last sync was allowed to start: the per-user cooldown is a CAS on this. */
    last_sync_started_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

const StravaCredentialSchema = new Schema<IStravaCredential>(
    {
        _id: uuidId,
        user_id: { type: String, required: true, unique: true },
        athlete_id: { type: String, required: true },
        access_token_enc: { type: String, required: true },
        refresh_token_enc: { type: String, required: true },
        expires_at: { type: Date, required: true },
        scope: { type: String, default: '' },
        last_synced_at: { type: Date, default: null },
        last_sync_started_at: { type: Date, default: null },
    },
    timestamps
);

StravaCredentialSchema.pre('validate', function (this: IStravaCredential) {
    const c = this;
    // An unencrypted token is the one failure this schema can still catch: `seal()` always produces
    // three colon-separated hex fields, and a plain Strava token contains no colon at all.
    for (const field of ['access_token_enc', 'refresh_token_enc'] as const) {
        if (!/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/.test(c[field])) {
            throw new Error(`StravaCredential invariant: ${field} must be sealed, not a raw token`);
        }
    }
});

/**
 * Athlete -> user, and **unique**: one Strava athlete belongs to one BGSC account.
 *
 * Without the uniqueness two accounts could link the same athlete, and because
 * `strava_activities` is keyed by Strava's own activity id, whichever of them synced last would
 * silently take ownership of the other's rows — the activity would move between profiles on every
 * sync. Enforced in the index rather than in a check-then-insert, which two simultaneous callbacks
 * would both pass.
 */
StravaCredentialSchema.index({ athlete_id: 1 }, { unique: true });

export const StravaCredential = model<IStravaCredential>(
    'StravaCredential',
    StravaCredentialSchema,
    'strava_credentials'
);

/* ------------------------------------------------------------------ */

export interface IStravaActivity extends Document<string> {
    /** Strava's own activity id, as a string: it is the upsert key, which is the whole dedupe. */
    _id: string;
    user_id: string;
    athlete_id: string;
    type: string;
    name: string;
    distance_meters: number;
    moving_time_seconds: number;
    elapsed_time_seconds: number;
    total_elevation_gain: number | null;
    /**
     * Strava's own privacy flag, carried so ours can honour it. `activity:read_all` returns
     * private activities; republishing one on a public BGSC profile would be this integration
     * leaking data the user hid on the platform it came from.
     */
    is_private: boolean;
    start_date: Date;
    synced_at: Date;
}

const StravaActivitySchema = new Schema<IStravaActivity>(
    {
        _id: { type: String, required: true },
        user_id: { type: String, required: true },
        athlete_id: { type: String, required: true },
        type: { type: String, required: true, maxlength: 100 },
        name: { type: String, required: true, maxlength: 255 },
        distance_meters: { type: Number, default: 0, min: 0 },
        moving_time_seconds: { type: Number, default: 0, min: 0 },
        elapsed_time_seconds: { type: Number, default: 0, min: 0 },
        total_elevation_gain: { type: Number, default: null },
        // Defaults to private: an activity whose privacy we could not read is not one to publish.
        is_private: { type: Boolean, default: true },
        start_date: { type: Date, required: true },
        synced_at: { type: Date, required: true, default: Date.now },
    },
    // No created_at/updated_at: `start_date` is when it happened and `synced_at` is when we heard,
    // and a row that is re-upserted has no meaningful "created".
    { timestamps: false }
);

// The activity feed, for the challenge screen and the user profile alike. `is_private` is not in
// the key: another user's feed filters on it, but the selectivity that matters is the user.
StravaActivitySchema.index({ user_id: 1, start_date: -1 });

export const StravaActivity = model<IStravaActivity>('StravaActivity', StravaActivitySchema, 'strava_activities');
