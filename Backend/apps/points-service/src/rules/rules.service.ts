import {
    IPointRule,
    POINT_RULE_SEED,
    PointRule,
    PointsSource,
    ServiceError,
    recordAudit,
} from '@bgsc/shared';

/**
 * The rules engine: a table of `reason -> amount` with two override sources. No DSL
 * (points-model.md §3) — Spec §5.15.3's "Point Award Toggles" asks
 * for amounts and switches, and an expression language on admin input is a security surface
 * nobody asked for.
 */

const DAY_MS = 86_400_000;

/** What a rule resolves to. `null` from `resolve()` means "no transaction", not "zero points". */
export interface Resolved {
    amount: number;
    expires_at: Date | null;
}

/**
 * Seeded insert-only: a restart must never revert an admin's toggle, so `$setOnInsert`, not `$set`.
 * That makes the seed a floor ("these rules exist"), not a policy ("these amounts are correct").
 *
 * `point_rules` is config, not a ledger — it carries no append-only guard, unlike
 * `point_transactions`, where `updateOne` throws by design.
 */
export async function seedRules(): Promise<void> {
    await Promise.all(
        POINT_RULE_SEED.map((rule) =>
            PointRule.updateOne(
                { _id: rule._id },
                { $setOnInsert: { ...rule, updated_by: 'system' } },
                { upsert: true }
            ).catch((err: { code?: number }) => {
                // Two instances booting at the same second race on the same _id, and MongoDB
                // resolves a lost upsert with a duplicate-key error. The row exists either way,
                // which is all this function promises — but an unhandled rejection here would
                // fail `onReady` and stop the service from listening at all.
                if (err?.code !== 11000) throw err;
            })
        )
    );
}

/**
 * Resolution order: trigger override -> rule default. Disabled rule, or an amount of zero, means
 * no transaction at all.
 *
 * Returns the expiry alongside the amount so a credit cannot be priced in one place and have its
 * clock set (or forgotten) in another.
 */
export async function resolve(reason: string, override?: number | null): Promise<Resolved | null> {
    const rule = await PointRule.findById(reason);
    // A typo in a consumer ('event.podiun.1') fails at the first event instead of writing rows
    // nothing can group.
    if (!rule) throw new ServiceError(422, 'unknown_reason');
    if (!rule.enabled) return null;

    const raw = override ?? rule.default_amount;
    if (!Number.isFinite(raw)) throw new ServiceError(422, 'invalid_amount');
    // Multipliers are floats (1.5) and amounts are integers by model invariant, so the rounding is
    // required, not cosmetic: 7 x 1.5 would otherwise reach the model and surface as a 500.
    const amount = Math.round(raw);
    if (amount === 0) return null;

    return {
        amount,
        expires_at: rule.expires_after_days ? new Date(Date.now() + rule.expires_after_days * DAY_MS) : null,
    };
}

/** Cheap existence check for the ledger's `reason` guard. */
export async function ruleExists(reason: string): Promise<boolean> {
    return (await PointRule.exists({ _id: reason })) !== null;
}

export async function listRules(): Promise<IPointRule[]> {
    return PointRule.find().sort({ source: 1, _id: 1 }).lean<IPointRule[]>();
}

/**
 * Spec §5.7's "points earning opportunities": what a user can actually go and do. `leaderboard`
 * and `admin` are not opportunities; `store` and `sponsor` are out of MVP and unseeded.
 *
 * Served by the `{ enabled: 1, source: 1 }` index on `point_rules`.
 */
const OPPORTUNITY_SOURCES: PointsSource[] = ['event', 'challenge', 'engagement'];

export interface Opportunity {
    reason: string;
    label: string;
    source: PointsSource;
    /** null when the trigger always supplies the amount — "varies by challenge". */
    amount: number | null;
    expires_after_days: number | null;
}

export async function opportunities(): Promise<Opportunity[]> {
    const rules = await PointRule.find({ enabled: true, source: { $in: OPPORTUNITY_SOURCES } })
        .sort({ source: 1, _id: 1 })
        .lean<IPointRule[]>();

    return rules.map((r) => ({
        reason: r._id,
        label: r.label,
        source: r.source,
        // Showing a user "earn 0 points" is worse than saying the amount depends on the thing.
        amount: r.default_amount === 0 ? null : r.default_amount,
        expires_after_days: r.expires_after_days,
    }));
}

export interface RuleUpdate {
    default_amount?: number;
    enabled?: boolean;
    expires_after_days?: number | null;
}

/**
 * `source` and `overridable_by` are deliberately not editable: the resolver branches on them, so an
 * admin flipping `overridable_by` would produce a rule the engine silently ignores.
 *
 * Changing a rule never rewrites history — existing rows keep the amount they were issued at.
 */
export async function updateRule(
    id: string,
    patch: RuleUpdate,
    actor: { id: string; ip: string | null }
): Promise<IPointRule> {
    const rule = await PointRule.findById(id);
    if (!rule) throw new ServiceError(404, 'rule_not_found');

    const previous = {
        default_amount: rule.default_amount,
        enabled: rule.enabled,
        expires_after_days: rule.expires_after_days,
    };

    if (patch.default_amount !== undefined) rule.default_amount = patch.default_amount;
    if (patch.enabled !== undefined) rule.enabled = patch.enabled;
    if (patch.expires_after_days !== undefined) rule.expires_after_days = patch.expires_after_days;
    rule.updated_by = actor.id;
    await rule.save();

    await recordAudit({
        actor_id: actor.id,
        action: 'points.rule_updated',
        target_type: 'point_rule',
        target_id: rule._id,
        previous_value: previous,
        new_value: {
            default_amount: rule.default_amount,
            enabled: rule.enabled,
            expires_after_days: rule.expires_after_days,
        },
        ip: actor.ip,
    });

    return rule;
}
