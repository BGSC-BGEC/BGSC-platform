import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackActions, useNavigation, usePreventRemove, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';

import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { SectionHeader } from '../../src/components/SectionHeader';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { StickyCTABar } from '../../src/components/StickyCTABar';
import { Checkbox } from '../../src/forms/Checkbox';
import { TextInput } from '../../src/forms/TextInput';
import { DynamicFormField, serializeAnswer, validateField, visibleFields, type FormValues } from '../../src/forms/DynamicFormField';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Icon, type IconName } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { withAlpha } from '../../src/theme/colors';
import { usePopup } from '../../src/popups/PopupProvider';
import { TermsPopup } from '../../src/popups/TermsPopup';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import { auctionRepository } from '../../src/repositories/AuctionRepository';
import { registrationRepository, type UploadedFormFile } from '../../src/repositories/RegistrationRepository';
import { ApiError, getErrorMessage, getFieldErrors } from '../../src/api/client';
import type { ApiEvent, FormField, FormSubmission, RegistrationRole, Team } from '../../src/api/types';
import { EVENT_TYPE_LABELS, formatNumber, REGISTRATION_STATUS } from '../../src/utils/format';

type Params = { EventRegistration: { eventId: string; role?: 'captain' | 'member' } };
type Step = 'details' | 'review' | 'done';
type JoinPolicy = 'open' | 'invite_only' | 'closed';
const JOIN_POLICIES: Array<{ label: string; value: JoinPolicy }> = [
  { label: 'Open', value: 'open' },
  { label: 'Invite only', value: 'invite_only' },
  { label: 'Closed', value: 'closed' },
];
const JOIN_POLICY_COPY: Record<JoinPolicy, string> = {
  open: 'Any registered player can join your team.',
  invite_only: 'Players join with your invite code. You can change this until the roster locks.',
  closed: 'Players can only join with your invite code.',
};

/** "Sat 24 Oct, 4 PM" */
function when(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d
    .toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
    .replace(',', '')}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).toUpperCase()}`;
}

/** Human-readable value of an answer for the review step. */
function displayAnswer(field: FormField, value: unknown, file?: UploadedFormFile): string {
  if (field.type === 'file') return file?.name ?? '—';
  if (value === undefined || value === null || value === '') return '—';
  if (field.type === 'checkbox') return value ? 'Yes' : 'No';
  const label = (v: unknown) => field.options?.find((o) => o.value === v)?.label ?? String(v);
  if (Array.isArray(value)) return value.map(label).join(', ');
  return label(value);
}

/** Google Calendar "add event" link — no calendar permission needed. */
function calendarUrl(event: ApiEvent): string {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${fmt(event.start_at)}/${fmt(event.end_at)}`,
    location: event.venue ?? '',
    details: 'BGSC event',
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** v2 registration flow — role & details (39:994 / 39:1114), review (40:1182), outcome (40:1263). */
export default function EventRegistration() {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { eventId: eventRef, role: initialRole } = useRoute<RouteProp<Params, 'EventRegistration'>>().params;
  const popup = usePopup();

  const [step, setStep] = useState<Step>('details');
  const [values, setValues] = useState<FormValues>({});
  const [files, setFiles] = useState<Record<string, UploadedFormFile>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [role, setRole] = useState<'captain' | 'member'>(initialRole ?? 'member');
  const [teamName, setTeamName] = useState('');
  const [joinPolicy, setJoinPolicy] = useState<JoinPolicy>('invite_only');
  const [basePrice, setBasePrice] = useState<number | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ registration: FormSubmission; team: Team | null; teamNote: string | null } | null>(null);

  // Back (header or hardware) on Review returns to the form instead of discarding it.
  usePreventRemove(step === 'review' && !submitting, () => setStep('details'));

  const { data, loading, error, reload } = useAsyncResource(async () => {
    const event = await eventsRepository.get(eventRef);
    const [form, existing, lots] = await Promise.all([
      event.registration.form_id ? registrationRepository.getForm(event.registration.form_id) : Promise.resolve(null),
      eventsRepository.myRegistration(eventRef).catch(() => null),
      event.type === 'ALL' ? auctionRepository.lots(event.slug || event._id).catch(() => []) : Promise.resolve([]),
    ]);
    return { event, form, existing: existing && !['cancelled', 'rejected'].includes(existing.status) ? existing : null, lots };
  }, [eventRef]);

  const event = data?.event;
  const form = data?.form;
  const editing = data?.existing ?? null;
  const isTeamed = !!event?.teaming.is_teamed;
  const isAuction = event?.type === 'ALL';
  const hasRoles = isTeamed || isAuction;
  const isCaptain = hasRoles && role === 'captain';
  const step_ = event?.auction?.min_bid_increment ?? 10;

  // Edit mode: start from the saved answers; role and base price are fixed once submitted.
  useEffect(() => {
    if (!editing) return;
    // Inputs are text: stored numbers/dates come back typed, so turn them back into what the fields edit.
    const answers: FormValues = { ...editing.answers };
    for (const f of form?.fields ?? []) {
      const v = answers[f.key];
      if (typeof v === 'number') answers[f.key] = String(v);
      else if (f.type === 'date' && typeof v === 'string') answers[f.key] = v.slice(0, 10);
    }
    setValues(answers);
    setFiles(Object.fromEntries((editing.files ?? []).map((f) => [f.field_key, f])));
    const ctxRole = editing.context.event?.role;
    if (ctxRole === 'captain' || ctxRole === 'member') setRole(ctxRole);
    setBasePrice(editing.context.event?.base_price ?? null);
    setAgreed(true);
  }, [editing, form]);

  // Pool stats for the base-price card come from the auction lots, when there are enough of them.
  const pool = useMemo(() => {
    const prices = (data?.lots ?? []).map((l) => l.base_price).filter((p) => p > 0);
    if (prices.length < 3) return null;
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const sd = Math.sqrt(prices.reduce((a, p) => a + (p - avg) ** 2, 0) / prices.length);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const bins = 8;
    const width = Math.max(1, (max - min) / bins);
    const counts = Array.from({ length: bins }, () => 0);
    prices.forEach((p) => (counts[Math.min(bins - 1, Math.floor((p - min) / width))] += 1));
    return { avg, sd, min, width, counts, size: prices.length };
  }, [data?.lots]);

  useEffect(() => {
    if (isAuction && basePrice == null && !editing) setBasePrice(pool ? Math.round(pool.avg / step_) * step_ : step_ * 10);
  }, [isAuction, pool, basePrice, editing, step_]);

  const fields = useMemo(() => visibleFields(form?.fields ?? [], values), [form, values]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    for (const f of fields) {
      const msg = validateField(f, values[f.key], files[f.key]);
      if (msg) e[f.key] = msg;
    }
    if (!editing && isCaptain && isTeamed && !teamName.trim()) e.__team = 'Give your team a name.';
    if (!editing && isAuction && role === 'member' && !(basePrice && basePrice > 0)) e.__price = 'Set a base price.';
    if (!agreed) e.__terms = 'Accept the event rules to continue.';
    return e;
  }, [fields, values, files, editing, isCaptain, isTeamed, teamName, isAuction, role, basePrice, agreed]);

  const errorFor = (key: string) => serverErrors[key] || (attempted ? errors[key] : undefined);
  const setValue = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (serverErrors[key]) setServerErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const goReview = () => {
    setAttempted(true);
    if (Object.keys(errors).length) {
      void popup.warning('Almost there', 'A few details are missing — they’re marked in red.');
      return;
    }
    setStep('review');
  };

  const submit = async () => {
    if (!event || !form) return;
    setSubmitting(true);
    const answers: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.type === 'file') continue;
      const v = serializeAnswer(f, values[f.key]);
      if (v !== undefined) answers[f.key] = v;
    }
    try {
      if (editing) {
        await registrationRepository.update(editing._id, answers, Object.values(files));
        await popup.success('Details updated', 'Your registration has been saved.');
        navigation.goBack();
        return;
      }
      const regRole: RegistrationRole = hasRoles ? role : 'solo';
      const registration = await registrationRepository.submit({
        formId: form._id,
        eventId: event._id,
        answers,
        files: Object.values(files),
        role: regRole,
        teamVisibility: regRole === 'captain' ? joinPolicy : undefined,
        basePrice: isAuction && regRole === 'member' ? basePrice : undefined,
      });

      // A team can only be created once the captain's registration is confirmed (and approved).
      let team: Team | null = null;
      let teamNote: string | null = null;
      if (regRole === 'captain' && isTeamed && registration.status !== 'confirmed') {
        // Teams need a confirmed captain: keep the name for later instead of dropping it silently.
        teamNote = `Once you’re confirmed, create “${teamName.trim()}” from the event page.`;
      } else if (regRole === 'captain' && isTeamed) {
        try {
          team = await registrationRepository.createTeam(event._id, teamName.trim(), joinPolicy);
        } catch (err) {
          const code = err instanceof ApiError ? err.code : null;
          teamNote =
            code === 'captain_not_approved'
              ? `You can create “${teamName.trim()}” from the event page once Core approves you as captain.`
              : `Your registration is in, but the team wasn’t created: ${getErrorMessage(err)} Create it from the event page.`;
        }
      }
      setResult({ registration, team, teamNote });
      setStep('done');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'validation_failed') {
        setServerErrors(getFieldErrors(err));
        setAttempted(true);
        setStep('details');
      }
      await popup.error(editing ? 'Couldn’t save' : 'Registration failed', getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !data || !event) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title="Register" showBackButton showMenuButton={false} />
        <View style={[styles.pad, styles.gap]}>
          {loading ? (
            <>
              <Skeleton height={40} borderRadius={8} />
              <Skeleton height={68} borderRadius={20} />
              <Skeleton height={140} borderRadius={20} />
              <Skeleton height={200} borderRadius={20} />
            </>
          ) : (
            <ErrorState title="Couldn’t load registration" message={error ?? undefined} onRetry={() => reload()} />
          )}
        </View>
      </View>
    );
  }

  if (step === 'done' && result) {
    return (
      <Outcome
        event={event}
        result={result}
        role={hasRoles ? role : null}
        basePrice={basePrice}
        onBack={() => navigation.goBack()}
        onFindTeam={() => navigation.dispatch(StackActions.replace('TeamJoin', { eventId: event.slug || event._id }))}
      />
    );
  }

  const subtitle = `${EVENT_TYPE_LABELS[event.type]}${
    isTeamed && event.teaming.max_teams ? ` · ${event.teaming.max_teams} ${isAuction ? 'franchises' : 'teams'}` : ''
  }`;
  const rules = event.rules_summary?.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title={step === 'review' ? 'Review' : editing ? 'Edit registration' : 'Register'}
        showBackButton
        showMenuButton={false}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Stepper current={step === 'review' ? 3 : 2} />

        {step === 'review' ? (
          <View>
            <Typography variant="displayHero" color="text" style={styles.reviewTitle}>
              Check it over
            </Typography>
            <Typography variant="body" color="textMuted">
              You can edit details until registration closes.
            </Typography>
          </View>
        ) : null}

        <View style={[styles.card, styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.iconTile, { backgroundColor: colors.accentMuted }]}>
            <Icon name="trophy" size={18} color="primary" />
          </View>
          <View style={styles.flex}>
            <Typography variant="body" color="text" style={styles.semibold} numberOfLines={1}>
              {event.title}
            </Typography>
            <Typography variant="bodySmall" color="textMuted" numberOfLines={1}>
              {step === 'review' ? `${when(event.start_at)}${event.venue ? ` · ${event.venue}` : ''}` : subtitle}
            </Typography>
          </View>
        </View>

        {!form ? (
          <ErrorState
            title="Registration form isn’t open yet"
            message="The organisers haven’t published the form. Check back soon."
          />
        ) : step === 'details' ? (
          <>
            {hasRoles ? (
              <View style={styles.section}>
                <Typography color="textMuted" style={styles.kicker}>
                  {editing ? 'YOU REGISTERED AS' : 'I’M REGISTERING AS'}
                </Typography>
                <View style={styles.row}>
                  <RoleCard
                    icon="gavel"
                    title="Captain"
                    body={isAuction ? 'Lead a franchise and bid at the auction.' : 'Create a team and lead it.'}
                    selected={role === 'captain'}
                    disabled={!!editing}
                    onPress={() => setRole('captain')}
                  />
                  <RoleCard
                    icon="user"
                    title="Member"
                    body={isAuction ? 'Enter the player pool with a base price.' : 'Join a team after registering.'}
                    selected={role === 'member'}
                    disabled={!!editing}
                    onPress={() => setRole('member')}
                  />
                </View>
              </View>
            ) : null}

            {isCaptain && event.teaming.captain_application_required && !editing ? (
              <Notice
                tone="info"
                icon="lock"
                title="Captains need Core approval"
                body="If Core declines your application, your registration is rejected and you can register again as a member."
              />
            ) : null}

            {isCaptain && isTeamed && !editing ? (
              <View style={styles.section}>
                <SectionHeader title={isAuction ? 'Your franchise' : 'Your team'} />
                <TextInput
                  label="TEAM NAME"
                  value={teamName}
                  onChangeText={setTeamName}
                  maxLength={60}
                  placeholder="North Stars"
                  helperText="Visible to everyone in the event."
                  error={errorFor('__team')}
                />
                <View style={styles.fieldGap}>
                  <Typography color="textMuted" style={styles.kicker}>
                    JOIN POLICY
                  </Typography>
                  <SegmentedTabs tabs={JOIN_POLICIES} value={joinPolicy} onChange={setJoinPolicy} />
                  <Typography variant="bodySmall" color="textMuted">
                    {JOIN_POLICY_COPY[joinPolicy]}
                  </Typography>
                </View>
              </View>
            ) : null}

            {isAuction && role === 'member' ? (
              <BasePriceCard
                value={basePrice ?? 0}
                step={step_}
                pool={pool}
                locked={!!editing}
                error={errorFor('__price')}
                onChange={setBasePrice}
              />
            ) : null}

            {fields.length ? (
              <View style={styles.section}>
                <SectionHeader title={isAuction && role === 'member' ? 'Player profile' : 'About you'} />
                {fields.map((field) => (
                  <DynamicFormField
                    key={field.key}
                    field={field}
                    value={values[field.key]}
                    file={files[field.key]}
                    error={errorFor(field.key)}
                    onChange={(v) => setValue(field.key, v)}
                    onUploadFile={async (asset) => {
                      try {
                        const uploaded = await registrationRepository.uploadFile({
                          formId: form._id,
                          fieldKey: field.key,
                          uri: asset.uri,
                          name: asset.name,
                          mimeType: asset.mimeType,
                        });
                        setFiles((prev) => ({ ...prev, [field.key]: uploaded }));
                      } catch (err) {
                        await popup.error('Upload failed', getErrorMessage(err));
                      }
                    }}
                  />
                ))}
              </View>
            ) : null}

            <Terms agreed={agreed} onChange={setAgreed} onRead={rules?.length ? () => setRulesOpen(true) : undefined} error={errorFor('__terms')} />
          </>
        ) : (
          <>
            {hasRoles ? (
              <ReviewCard
                title={isCaptain ? (isAuction ? 'ROLE & FRANCHISE' : 'ROLE & TEAM') : 'ROLE'}
                onEdit={() => setStep('details')}
                rows={[
                  {
                    label: 'Role',
                    value: isCaptain ? (event.teaming.captain_application_required ? 'Captain (application)' : 'Captain') : 'Member',
                  },
                  ...(isCaptain && isTeamed && !editing
                    ? [
                        { label: 'Team', value: teamName.trim() },
                        { label: 'Join policy', value: JOIN_POLICIES.find((p) => p.value === joinPolicy)!.label },
                      ]
                    : []),
                  ...(isAuction && role === 'member' ? [{ label: 'Base price', value: `${formatNumber(basePrice ?? 0)} cr` }] : []),
                ]}
              />
            ) : null}
            {fields.length ? (
              <ReviewCard
                title="ABOUT YOU"
                onEdit={() => setStep('details')}
                rows={fields.map((f) => ({ label: f.label, value: displayAnswer(f, values[f.key], files[f.key]) }))}
              />
            ) : null}
            {event.registration.requires_approval || (isCaptain && event.teaming.captain_application_required) ? (
              <Notice
                tone="warning"
                icon="clock"
                title="Admin approval required"
                body="Core reviews registrations within 48h. You’ll get a notification either way."
              />
            ) : null}
            <Terms agreed={agreed} onChange={setAgreed} onRead={rules?.length ? () => setRulesOpen(true) : undefined} />
          </>
        )}
      </ScrollView>

      {form ? (
        <StickyCTABar
          title={step === 'review' ? 'Step 3 of 3' : 'Step 2 of 3'}
          subtitle={
            step === 'review'
              ? editing
                ? 'Saves your updated answers'
                : event.registration.requires_approval
                  ? 'Submits to Core for review'
                  : 'Confirms your spot'
              : 'Next: review & submit'
          }
          cta={
            step === 'review'
              ? { label: editing ? 'Save' : 'Submit', onPress: submit, loading: submitting, disabled: !agreed }
              : { label: 'Review', onPress: goReview }
          }
        />
      ) : null}

      <TermsPopup
        visible={rulesOpen}
        title={`${event.title} rules`}
        terms={rules}
        onAccept={() => {
          setAgreed(true);
          setRulesOpen(false);
        }}
        onClose={() => setRulesOpen(false)}
      />
    </View>
  );
}

function Stepper({ current }: { current: 1 | 2 | 3 }) {
  const { colors } = useTheme();
  const labels = ['Role', 'Details', 'Review'];
  return (
    <View style={styles.stepper} accessibilityLabel={`Step ${current} of 3`}>
      <View style={styles.row}>
        {labels.map((l, i) => (
          <View key={l} style={[styles.bar, { backgroundColor: i < current ? colors.primary : colors.surfaceInner }]} />
        ))}
      </View>
      <View style={styles.row}>
        {labels.map((l, i) => (
          <Typography key={l} color={i + 1 === current ? 'text' : 'textMuted'} style={[styles.flex, styles.stepLabel]}>
            {i + 1}  {l}
          </Typography>
        ))}
      </View>
    </View>
  );
}

function RoleCard(props: { icon: IconName; title: string; body: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const { selected } = props;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: props.disabled }}
      style={[
        styles.card,
        styles.role,
        selected
          ? { backgroundColor: colors.accentMuted, borderColor: colors.primary, borderWidth: 1.5 }
          : { backgroundColor: colors.surface, borderColor: colors.border, opacity: props.disabled ? 0.5 : 1 },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.iconTile, { backgroundColor: selected ? colors.accentMuted : colors.mutedTint }]}>
          <Icon name={props.icon} size={20} color={selected ? 'primary' : 'textMuted'} />
        </View>
        <View style={styles.flex} />
        {selected ? (
          <View style={[styles.radioOn, { backgroundColor: colors.primarySolid }]}>
            <Icon name="check" size={14} color="white" />
          </View>
        ) : (
          <View style={[styles.radioOff, { borderColor: colors.textMuted }]} />
        )}
      </View>
      <Typography color="text" style={[styles.semibold, styles.roleTitle]}>
        {props.title}
      </Typography>
      <Typography variant="bodySmall" color="textMuted">
        {props.body}
      </Typography>
    </Pressable>
  );
}

function BasePriceCard(props: {
  value: number;
  step: number;
  pool: { avg: number; sd: number; min: number; width: number; counts: number[]; size: number } | null;
  locked: boolean;
  error?: string;
  onChange: (v: number) => void;
}) {
  const { colors } = useTheme();
  const { value, step, pool } = props;
  const peak = pool ? Math.max(...pool.counts) : 1;
  const myBin = pool ? Math.min(pool.counts.length - 1, Math.max(0, Math.floor((value - pool.min) / pool.width))) : -1;
  const diff = pool ? Math.round(((value - pool.avg) / pool.avg) * 100) : 0;
  const stepBtn = (sign: 1 | -1) => (
    <Pressable
      onPress={() => props.onChange(Math.max(step, value + sign * step))}
      disabled={props.locked}
      accessibilityRole="button"
      accessibilityLabel={sign > 0 ? 'Increase base price' : 'Decrease base price'}
      style={({ pressed }) => [styles.stepBtn, { backgroundColor: colors.surfaceInner }, (pressed || props.locked) && styles.pressed]}
    >
      <Typography color="text" style={styles.stepSign}>
        {sign > 0 ? '+' : '–'}
      </Typography>
    </Pressable>
  );
  return (
    <View style={[styles.card, styles.price, { backgroundColor: colors.surface, borderColor: props.error ? colors.danger : colors.border }]}>
      <Typography color="textMuted" style={styles.kicker}>
        YOUR BASE PRICE
      </Typography>
      <View style={styles.row}>
        {stepBtn(-1)}
        <View style={[styles.flex, styles.centerItems]}>
          <Typography color="text" style={styles.priceValue}>
            {formatNumber(value)}
          </Typography>
          <Typography variant="bodySmall" color="textMuted">
            credits
          </Typography>
        </View>
        {stepBtn(1)}
      </View>
      {pool ? (
        <View style={[styles.chart, { backgroundColor: colors.surfaceInner }]}>
          <View style={styles.bars}>
            {pool.counts.map((c, i) => (
              <View
                key={i}
                style={[
                  styles.binBar,
                  { height: 8 + (c / peak) * 48, backgroundColor: i === myBin ? colors.primary : colors.textMuted },
                ]}
              />
            ))}
          </View>
          <View style={styles.row}>
            {[
              [formatNumber(Math.round(pool.avg)), 'avg'],
              [`±${Math.round(pool.sd)}`, 'std dev'],
              [String(pool.size), 'in pool'],
            ].map(([v, l]) => (
              <View key={l} style={styles.flex}>
                <Typography variant="mono" color="text">
                  {v}
                </Typography>
                <Typography color="textMuted" style={styles.tiny}>
                  {l}
                </Typography>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <Typography variant="bodySmall" color="textMuted">
        {props.locked
          ? 'Base price is fixed once you’ve registered.'
          : pool
            ? `You’re ${Math.abs(diff)}% ${diff <= 0 ? 'below' : 'above'} the pool average${diff <= 0 ? ' — likely to get picked early' : ''}. Higher prices drain captains’ purses faster.`
            : 'Captains see this on your auction card. Lower prices get picked earlier; higher prices drain purses faster.'}
      </Typography>
      {props.error ? (
        <Typography variant="bodySmall" style={{ color: colors.dangerText }}>
          {props.error}
        </Typography>
      ) : null}
    </View>
  );
}

function Notice({ tone, icon, title, body }: { tone: 'info' | 'warning'; icon: IconName; title: string; body: string }) {
  const { colors } = useTheme();
  const c = tone === 'info' ? colors.info : colors.warning;
  return (
    <View style={[styles.card, styles.notice, { backgroundColor: withAlpha(c, 0.16), borderColor: withAlpha(c, 0.6) }]}>
      <Icon name={icon} size={18} color={c} />
      <View style={styles.flex}>
        <Typography color="text" style={[styles.semibold, styles.small]}>
          {title}
        </Typography>
        <Typography variant="bodySmall" color="textMuted">
          {body}
        </Typography>
      </View>
    </View>
  );
}

function Terms({ agreed, onChange, onRead, error }: { agreed: boolean; onChange: (v: boolean) => void; onRead?: () => void; error?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.fieldGap}>
      <Checkbox checked={agreed} onChange={onChange} label="I’ve read the event rules and agree to the BGSC code of conduct." />
      {onRead ? (
        <Pressable onPress={onRead} hitSlop={8} accessibilityRole="link">
          <Typography color="primary" style={styles.link}>
            Read the rules
          </Typography>
        </Pressable>
      ) : null}
      {error ? (
        <Typography variant="bodySmall" style={{ color: colors.dangerText }}>
          {error}
        </Typography>
      ) : null}
    </View>
  );
}

function ReviewCard({ title, rows, onEdit }: { title: string; rows: Array<{ label: string; value: string }>; onEdit: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, styles.review, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Typography color="textMuted" style={[styles.kicker, styles.flex]}>
          {title}
        </Typography>
        <Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button">
          <Typography color="primary" style={styles.link}>
            Edit
          </Typography>
        </Pressable>
      </View>
      {rows.map((r, i) => (
        <View key={r.label} style={[styles.reviewRow, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
          <Typography variant="bodySmall" color="textMuted" style={styles.reviewLabel}>
            {r.label}
          </Typography>
          <Typography variant="body" color="text" style={styles.flex}>
            {r.value || '—'}
          </Typography>
        </View>
      ))}
    </View>
  );
}

/** Registration submitted (40:1263) — outcome per status, next steps, back to event. */
function Outcome(props: {
  event: ApiEvent;
  result: { registration: FormSubmission; team: Team | null; teamNote: string | null };
  role: 'captain' | 'member' | null;
  basePrice: number | null;
  onBack: () => void;
  onFindTeam: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { event, result, role } = props;
  const reg = result.registration;
  const status = REGISTRATION_STATUS[reg.status];
  const tone = reg.status === 'confirmed' ? colors.success : reg.status === 'rejected' ? colors.danger : colors.warning;
  const copy = {
    confirmed: { title: 'You’re in.', body: `You’re confirmed for ${event.title}.${event.auction && role === 'member' ? ' Captains will see your card at the auction.' : ''}` },
    waitlisted: { title: 'On the waitlist.', body: `${event.title} is full. You’re #${reg.waitlist_position ?? '—'} in line — we’ll auto-confirm you if a spot opens.` },
    submitted: { title: 'Sent for approval.', body: 'Core reviews registrations within 48h. You’ll get a notification either way.' },
    rejected: { title: 'Not approved.', body: 'This registration wasn’t accepted. Contact the organisers for details.' },
    draft: { title: 'Saved as draft.', body: 'Finish your registration from the event page.' },
    cancelled: { title: 'Cancelled.', body: 'This registration was cancelled.' },
  }[reg.status];
  const icon: IconName = reg.status === 'confirmed' ? 'check' : reg.status === 'rejected' ? 'lock' : 'clock';
  const next: Array<{ icon: IconName; title: string; body: string }> =
    reg.status !== 'confirmed'
      ? [{ icon: 'bell', title: 'We’ll notify you', body: 'As soon as your status changes' }]
      : event.auction
        ? [
            { icon: 'bell', title: 'We’ll remind you', body: 'Before the auction starts' },
            { icon: 'gavel', title: 'Watch it live', body: role === 'captain' ? 'Bid for your squad in real time' : 'See who picks you, in real time' },
            { icon: 'users', title: 'Meet your team', body: 'Rosters are revealed after the auction' },
          ]
        : [
            { icon: 'bell', title: 'We’ll remind you', body: 'The day before the event' },
            ...(event.teaming.is_teamed && role === 'member'
              ? [{ icon: 'users' as IconName, title: 'Find a team', body: 'Join one now or wait for a captain’s invite' }]
              : []),
          ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, styles.outcome, { paddingTop: insets.top + 28 }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.ring, { backgroundColor: withAlpha(tone, 0.16) }]}>
          <View style={[styles.ringInner, { backgroundColor: tone }]}>
            <Icon name={icon} size={36} color="white" />
          </View>
        </View>
        <Typography variant="displayHero" color="text" align="center" style={styles.outcomeTitle}>
          {copy.title}
        </Typography>
        <Typography variant="body" color="textMuted" align="center">
          {copy.body}
        </Typography>

        <View style={[styles.card, styles.review, styles.stretch, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Typography color="textMuted" style={styles.kicker}>
                REGISTRATION
              </Typography>
              <Typography variant="mono" color="text" style={styles.regId}>
                REG-{reg._id.replace(/-/g, '').slice(-6).toUpperCase()}
              </Typography>
            </View>
            <Badge label={status.label} variant={status.variant} />
          </View>
          {[
            ...(role ? [{ label: 'Role', value: role === 'captain' ? 'Captain' : `Member${props.basePrice ? ` · base ${props.basePrice} cr` : ''}` }] : []),
            ...(result.team ? [{ label: 'Team', value: result.team.name }] : []),
            { label: event.auction ? 'Auction' : 'Starts', value: when(event.start_at) },
          ].map((r) => (
            <View key={r.label} style={[styles.reviewRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Typography variant="bodySmall" color="textMuted" style={styles.reviewLabel}>
                {r.label}
              </Typography>
              <Typography variant="body" color="text" style={styles.flex}>
                {r.value}
              </Typography>
            </View>
          ))}
        </View>

        {result.team?.invite_code ? (
          <View style={[styles.card, styles.invite, styles.stretch, { backgroundColor: colors.surfaceInner, borderColor: colors.primary }]}>
            <View style={styles.flex}>
              <Typography color="textMuted" style={styles.kicker}>
                INVITE CODE
              </Typography>
              <Typography variant="mono" color="text" style={styles.code}>
                {result.team.invite_code}
              </Typography>
            </View>
            <Pressable
              onPress={() =>
                void Share.share({ message: `Join ${result.team!.name} for ${event.title} on BGSC — invite code ${result.team!.invite_code}` })
              }
              accessibilityRole="button"
              style={({ pressed }) => [styles.shareBtn, { backgroundColor: colors.accentMuted }, pressed && styles.pressed]}
            >
              <Icon name="share" size={16} color="primary" />
              <Typography color="primary" style={styles.link}>
                Share
              </Typography>
            </Pressable>
          </View>
        ) : null}
        {result.teamNote ? <Notice tone="info" icon="users" title="Your team" body={result.teamNote} /> : null}

        <View style={[styles.stretch, styles.section]}>
          <SectionHeader title="What happens next" />
          {next.map((n) => (
            <View key={n.title} style={styles.row}>
              <View style={[styles.iconTile, { backgroundColor: colors.accentMuted }]}>
                <Icon name={n.icon} size={18} color="primary" />
              </View>
              <View style={styles.flex}>
                <Typography color="text" style={[styles.semibold, styles.small]}>
                  {n.title}
                </Typography>
                <Typography variant="bodySmall" color="textMuted">
                  {n.body}
                </Typography>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.stretch, styles.gap]}>
          {reg.status === 'confirmed' && event.teaming.is_teamed && role === 'member' && !event.auction ? (
            <Button label="Find a team" fullWidth onPress={props.onFindTeam} />
          ) : null}
          <Button
            label="Back to event"
            fullWidth
            variant={reg.status === 'confirmed' && event.teaming.is_teamed && role === 'member' && !event.auction ? 'outline' : 'primary'}
            onPress={props.onBack}
          />
          {reg.status === 'confirmed' || reg.status === 'waitlisted' ? (
            <Button label="Add to calendar" variant="outline" fullWidth onPress={() => void Linking.openURL(calendarUrl(event))} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  gap: { gap: 12 },
  stretch: { alignSelf: 'stretch' },
  centerItems: { alignItems: 'center' },
  pad: { paddingHorizontal: 20, paddingTop: 8 },
  pressed: { opacity: 0.6 },
  semibold: { fontFamily: FONT_FAMILIES.bodySemiBold },
  small: { fontSize: 13 },
  tiny: { fontSize: 11, lineHeight: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 20 },
  title: { fontSize: 34, lineHeight: 48 },
  reviewTitle: { fontSize: 32, lineHeight: 48 },
  outcomeTitle: { fontSize: 44, lineHeight: 52 },
  kicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 11, lineHeight: 15, letterSpacing: 1 },
  link: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 13, lineHeight: 20 },
  card: { borderWidth: 1 },
  stepper: { gap: 8 },
  bar: { flex: 1, height: 4, borderRadius: 999 },
  stepLabel: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 11, lineHeight: 15 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20 },
  iconTile: { padding: 8, borderRadius: 12 },
  section: { gap: 12 },
  fieldGap: { gap: 8 },
  role: { flex: 1, gap: 12, padding: 16, borderRadius: 20 },
  roleTitle: { fontSize: 15 },
  radioOn: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radioOff: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 16 },
  price: { gap: 16, padding: 20, borderRadius: 24 },
  stepBtn: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepSign: { fontFamily: FONT_FAMILIES.bodyBold, fontSize: 20 },
  priceValue: { fontFamily: FONT_FAMILIES.hero, fontSize: 44, lineHeight: 52 },
  chart: { gap: 12, padding: 16, borderRadius: 16 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 56 },
  binBar: { flex: 1, borderRadius: 4 },
  review: { gap: 4, padding: 16, borderRadius: 20 },
  reviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  reviewLabel: { width: 110 },
  outcome: { alignItems: 'center' },
  ring: { padding: 20, borderRadius: 999 },
  ringInner: { padding: 20, borderRadius: 999 },
  regId: { fontSize: 18, lineHeight: 24 },
  invite: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16 },
  code: { fontSize: 20, lineHeight: 26 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
});
