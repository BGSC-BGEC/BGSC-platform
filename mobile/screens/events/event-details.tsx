import React, { useCallback, useRef, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { authorColor } from '../../src/components/AnnouncementCard';
import { Badge } from '../../src/components/Badge';
import { BottomSheet } from '../../src/components/BottomSheet';
import { Button } from '../../src/components/Button';
import { EVENT_CATEGORY_STYLE } from '../../src/components/EventCard';
import { SectionHeader } from '../../src/components/SectionHeader';
import { StickyCTABar } from '../../src/components/StickyCTABar';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Icon } from '../../src/icons/Icon';
import { TextInput } from '../../src/forms/TextInput';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { usePopup } from '../../src/popups/PopupProvider';
import { TermsPopup } from '../../src/popups/TermsPopup';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import { registrationRepository } from '../../src/repositories/RegistrationRepository';
import { mediaRepository } from '../../src/repositories/MediaRepository';
import { getErrorMessage } from '../../src/api/client';
import { resolveMediaUrl } from '../../src/api/config';
import type { ApiEvent, EligibilityReason, FormSubmission, Team } from '../../src/api/types';
import TrophyWatermark from '../../assets/illustrations/trophy-watermark.svg';
import {
  countdown,
  EVENT_CATEGORY_LABELS,
  EVENT_TYPE_LABELS,
  eventStatusPill,
  formatDate,
  formatNumber,
  ordinal,
  REGISTRATION_STATUS,
} from '../../src/utils/format';

const BLOCKED: Record<NonNullable<EligibilityReason>, string> = {
  already_registered: 'Already registered',
  event_cancelled: 'Event cancelled',
  event_past: 'Event has finished',
  not_yet_open: 'Opens soon',
  registration_closed: 'Registration closed',
  capacity_full: 'Event is full',
  registration_form_unavailable: 'Form coming soon',
};

type Params = { EventDetails: { eventId: string } };

/** "Sat 24 Oct, 4 PM" — the compact v2 fact-tile date. */
function shortWhen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).replace(',', '');
  const t = d
    .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    .replace(':00', '')
    .toUpperCase();
  return `${day}, ${t}`;
}

/** Turns a contact string into something tappable: WhatsApp for numbers, mail for emails, else the URL. */
function contactUrl(contact: string): string {
  const v = contact.trim();
  if (v.includes('@') && !v.startsWith('http')) return `mailto:${v}`;
  const digits = v.replace(/[^\d]/g, '');
  if (!v.startsWith('http') && digits.length >= 10) return `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}`;
  return v;
}

/** v2 Event detail (38:904) and its registered state (38:1072). */
export default function EventDetails() {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { eventId: eventRef } = useRoute<RouteProp<Params, 'EventDetails'>>().params;
  const popup = usePopup();
  const [rulesVisible, setRulesVisible] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // An error popup must wait until the sheet's Modal is gone, or iOS never presents it.
  const cancelError = useRef<string | null>(null);
  const [teamSheet, setTeamSheet] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamError, setTeamError] = useState<string | undefined>();
  const [creatingTeam, setCreatingTeam] = useState(false);

  const { data, loading, refreshing, error, reload } = useAsyncResource(async () => {
    const [event, eligibility, registration] = await Promise.all([
      eventsRepository.get(eventRef),
      eventsRepository.eligibility(eventRef).catch(() => null),
      eventsRepository.myRegistration(eventRef).catch(() => null),
    ]);
    const [gallery, teams] = await Promise.all([
      mediaRepository
        .list({ event_id: event._id, media_type: 'image', limit: 10 })
        .then((res) => res.items)
        .catch(() => []),
      // Team slots count teams, not players; null when unavailable.
      event.teaming?.is_teamed ? registrationRepository.teamsForEvent(event._id, 'all').catch(() => null) : Promise.resolve(null),
    ]);
    return { event, eligibility, registration, gallery, teams };
  }, [eventRef]);

  // Coming back from the registration form should show the new status.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void reload({ silent: true });
    }, [reload]),
  );

  if (loading || !data) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title="Event" showBackButton showMenuButton={false} />
        {loading ? (
          <View style={styles.gap}>
            <Skeleton height={240} borderRadius={0} />
            <View style={[styles.pad, styles.gap]}>
              <Skeleton height={48} width={260} borderRadius={8} />
              <Skeleton height={160} borderRadius={20} />
              <Skeleton height={110} borderRadius={24} />
            </View>
          </View>
        ) : (
          <View style={styles.pad}>
            <ErrorState variant="screen" title="Couldn’t load this event" message={error ?? undefined} onRetry={() => reload()} />
          </View>
        )}
      </View>
    );
  }

  const { event, eligibility, gallery } = data;
  const ref = event.slug || event._id;
  const pill = eventStatusPill(event);
  // A cancelled row is history, not a registration.
  // A cancelled row is history; a rejected one too once the server lets them register again (e.g. captain declined).
  const registration =
    data.registration && data.registration.status !== 'cancelled' && !(data.registration.status === 'rejected' && eligibility?.eligible)
      ? data.registration
      : null;
  const canRegister = !registration && (eligibility ? eligibility.eligible : pill.registrationOpen);
  const waitlistOnly = eligibility?.capacity_status === 'waitlist_only';
  const blockedLabel = eligibility?.reason ? BLOCKED[eligibility.reason] : pill.label === 'Soon' ? 'Opens soon' : 'Registration closed';
  const ruleLines = event.rules_summary
    ?.split(/\n+/)
    .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(Boolean);

  const activeTeams = data.teams?.filter((t) => t.status !== 'disbanded') ?? null;
  const teamSlots = !!(event.teaming?.is_teamed && event.teaming.max_teams && activeTeams);
  const max = teamSlots ? event.teaming?.max_teams : event.registration.max_participants;
  const unit = teamSlots ? 'team slots' : 'player slots';
  const filled = teamSlots ? activeTeams!.length : event.counts.registrations_confirmed;
  const myTeam =
    registration && activeTeams
      ? activeTeams.find(
          (t) => t._id === registration.context.event?.team_id || t.members.some((m) => m.user_id === registration.user.user_id),
        ) ?? null
      : null;

  const createTeam = async () => {
    if (teamName.trim().length < 2) {
      setTeamError('Give your team a name.');
      return;
    }
    setCreatingTeam(true);
    setTeamError(undefined);
    try {
      // The join policy the captain picked when registering.
      await registrationRepository.createTeam(event._id, teamName.trim(), registration?.context.event?.team_visibility ?? 'invite_only');
      setTeamSheet(false);
      await reload({ silent: true });
    } catch (err) {
      setTeamError(getErrorMessage(err));
    } finally {
      setCreatingTeam(false);
    }
  };
  const left = max != null ? Math.max(0, max - filled) : null;
  const closesIn = countdown(event.registration.closes_at);

  const cancelRegistration = async () => {
    if (!registration) return;
    setCancelling(true);
    try {
      await registrationRepository.cancel(registration._id);
      setCancelOpen(false);
      await reload({ silent: true });
    } catch (err) {
      cancelError.current = getErrorMessage(err);
      setCancelOpen(false);
    } finally {
      setCancelling(false);
    }
  };

  const sticky = registration
    ? event.auction && event.auction.status !== 'finished'
      ? { title: countdown(event.start_at) ? `Auction starts in ${countdown(event.start_at)}` : 'Auction day', subtitle: 'You’ll get a notification before it starts' }
      : { title: countdown(event.start_at) ? `Starts in ${countdown(event.start_at)}` : 'Happening now', subtitle: event.venue ?? undefined }
    : {
        title: left != null ? `${left} ${left === 1 ? 'slot' : 'slots'} left` : `${filled} registered`,
        subtitle: closesIn ? `Closes in ${closesIn}` : undefined,
        cta: {
          label: canRegister ? (waitlistOnly ? 'Join waitlist' : 'Register now') : blockedLabel,
          disabled: !canRegister,
          onPress: () => navigation.navigate('EventRegistration', { eventId: ref }),
        },
      };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Event" showBackButton showMenuButton={false} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload()} tintColor={colors.primary} />}
      >
        <Hero event={event} registered={!!registration} />

        <View style={styles.body}>
          <View style={styles.titleBlock}>
            <Typography variant="displayHero" color="text" style={styles.title}>
              {event.title}
            </Typography>
          </View>

          {/* Key facts: a plain 2 × 2 grid of label over value, between hairlines */}
          <View style={[styles.facts, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
            <Fact label="STARTS" value={shortWhen(event.start_at)} />
            <Fact label="VENUE" value={event.venue ?? 'TBA'} />
            <Fact
              label={event.teaming?.is_teamed ? 'TEAM SIZE' : 'ENTRY'}
              value={
                event.teaming?.is_teamed
                  ? `${event.teaming.team_size_min ?? 1} – ${event.teaming.team_size_max ?? '?'} players`
                  : 'Individual'
              }
            />
            <Fact label="FORMAT" value={`${EVENT_TYPE_LABELS[event.type]} · ${EVENT_CATEGORY_LABELS[event.category]}`} />
          </View>

          {registration ? (
            <RegistrationCard
              event={event}
              registration={registration}
              onEdit={() => navigation.navigate('EventRegistration', { eventId: ref })}
              onCancel={() => setCancelOpen(true)}
              team={myTeam}
              onCreateTeam={() => setTeamSheet(true)}
              onFindTeam={() => navigation.navigate('TeamJoin', { eventId: ref })}
            />
          ) : max != null ? (
            <View style={styles.capacity}>
              <View style={styles.row}>
                <Typography variant="body" color="text" style={[styles.semibold, styles.flex]}>
                  {filled} of {max} {unit} filled
                </Typography>
                {left != null ? (
                  <Typography style={[styles.semibold, styles.small, { color: left === 0 ? colors.dangerText : colors.textMuted }]}>
                    {left === 0 ? 'Full' : `${left} left`}
                  </Typography>
                ) : null}
              </View>
              <View style={[styles.track, { backgroundColor: colors.surfaceInner }]}>
                <View style={[styles.fill, { width: `${max > 0 ? Math.min(100, (filled / max) * 100) : 0}%`, backgroundColor: left === 0 ? colors.dangerText : colors.primary }]} />
              </View>
              <View style={styles.row}>
                <Typography variant="bodySmall" color="textMuted" style={styles.flex}>
                  Registration closes {shortWhen(event.registration.closes_at)}
                  {event.registration.waitlist_enabled ? ' · waitlist after full' : ''}
                </Typography>
              </View>
            </View>
          ) : null}

          {event.auction ? (
            <Pressable
              onPress={() => navigation.navigate('Auction', { eventRef: ref })}
              accessibilityRole="button"
              style={({ pressed }) => [styles.auction, { borderColor: colors.border }, pressed && styles.pressed]}
            >
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Typography color="text" style={styles.blockTitle}>
                    {event.auction.status === 'live' ? 'Auction is live' : event.auction.status === 'finished' ? 'Auction results' : 'Live player auction'}
                  </Typography>
                  <Typography variant="bodySmall" color="textMuted" numberOfLines={1}>
                    {shortWhen(event.start_at)} · {event.auction.captain_user_ids.length} captains
                    {event.auction.purse_per_team ? ` · ${formatNumber(event.auction.purse_per_team)} cr purse` : ''}
                  </Typography>
                </View>
                {event.auction.status === 'live' ? <Badge label="Live" variant="danger" /> : null}
              </View>
              <Typography variant="body" color="textMuted" style={styles.small}>
                Captains bid on registered players in real time. Members set a base price when registering; unsold players go to a second round.
              </Typography>
              <View style={styles.inline}>
                <Typography color="primary" style={styles.link}>
                  {event.auction.status === 'finished' ? 'See who went where' : 'Open the auction room'}
                </Typography>
                <Icon name="chevron-right" size={16} color="primary" />
              </View>
            </Pressable>
          ) : null}

          {event.description ? (
            <View style={styles.section}>
              <SectionHeader title="About" />
              <Typography variant="body" color="text">
                {event.description}
              </Typography>
              {event.tags.length ? (
                <Typography color="textMuted" style={styles.tagText}>
                  {event.tags.map((tag) => `#${tag}`).join('   ')}
                </Typography>
              ) : null}
            </View>
          ) : null}

          {gallery.length ? (
            <View style={styles.section}>
              <SectionHeader title="Photos" />
              <FlatList
                horizontal
                data={gallery}
                keyExtractor={(m) => m._id}
                showsHorizontalScrollIndicator={false}
                style={styles.bleed}
                contentContainerStyle={styles.gallery}
                renderItem={({ item, index }) => (
                  <Pressable onPress={() => navigation.navigate('MediaViewer', { items: gallery, index })} accessibilityLabel="Open photo">
                    <Image source={{ uri: resolveMediaUrl(item.url) }} style={styles.photo} contentFit="cover" />
                  </Pressable>
                )}
              />
            </View>
          ) : null}

          {event.awards.length ? (
            <View style={styles.section}>
              <SectionHeader title="Awards" />
              <View>
                {event.awards.map((a, i) => {
                  return (
                    <View
                      key={`${a.place}-${a.title}`}
                      style={[
                        styles.listRow,
                        i < event.awards.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                      ]}
                    >
                      <Typography color="text" style={styles.place}>
                        {a.place > 0 ? ordinal(a.place) : '★'}
                      </Typography>
                      <View style={styles.flex}>
                        <Typography color="text" style={[styles.semibold, styles.small]}>
                          {a.title}
                        </Typography>
                        {a.description ? (
                          <Typography variant="bodySmall" color="textMuted">
                            {a.description}
                          </Typography>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {ruleLines?.length || event.rules_pdf_url || event.leaderboard ? (
            <View style={styles.section}>
              <SectionHeader title="Rules and standings" />
              <View>
              {[
                ruleLines?.length
                  ? { title: 'Read event rules', meta: 'In-app', onPress: () => setRulesVisible(true) }
                  : null,
                event.rules_pdf_url
                  ? {
                      title: 'Rulebook PDF',
                      meta: 'Opens in browser',
                      onPress: () => void Linking.openURL(resolveMediaUrl(event.rules_pdf_url)!),
                    }
                  : null,
                event.leaderboard
                  ? {
                      title: 'Standings',
                      meta: 'Live rankings for this event',
                      onPress: () => navigation.navigate('EventLeaderboard', { eventRef: ref, title: event.title }),
                    }
                  : null,
              ]
                .filter((x): x is NonNullable<typeof x> => !!x)
                .map((link, i, all) => (
                  <Pressable
                    key={link.title}
                    onPress={link.onPress}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.listRow,
                      i < all.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.flex}>
                      <Typography color="text" style={[styles.semibold, styles.small]}>
                        {link.title}
                      </Typography>
                      <Typography variant="bodySmall" color="textMuted">
                        {link.meta}
                      </Typography>
                    </View>
                    <Icon name="chevron-right" size={18} color="textMuted" />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {event.contacts.some((c) => !c.deleted) ? (
            <View style={styles.section}>
              <SectionHeader title="Organisers" />
              <View>
              {event.contacts
                .filter((c) => !c.deleted)
                .map((c, i, all) => (
                  <View
                    key={c.user_id}
                    style={[
                      styles.contact,
                      i < all.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                    ]}
                  >
                    <Avatar name={c.display_name} size={40} color={authorColor(c.display_name, colors)} />
                    <View style={styles.flex}>
                      <Typography variant="body" color="text" style={styles.semibold}>
                        {c.display_name}
                      </Typography>
                      <Typography variant="bodySmall" color="textMuted">
                        {c.role_label}
                      </Typography>
                    </View>
                    {c.contact ? (
                      <Pressable
                        onPress={() => void Linking.openURL(contactUrl(c.contact))}
                        accessibilityRole="button"
                        accessibilityLabel={`Message ${c.display_name}`}
                        hitSlop={10}
                        style={({ pressed }) => pressed && styles.pressed}
                      >
                        <Typography color="primary" style={styles.link}>
                          Message
                        </Typography>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <StickyCTABar {...sticky} />

      <TermsPopup
        visible={rulesVisible}
        title={`${event.title} rules`}
        terms={ruleLines}
        onAccept={() => setRulesVisible(false)}
        onClose={() => setRulesVisible(false)}
      />

      <BottomSheet
        visible={cancelOpen}
        onClose={() => !cancelling && setCancelOpen(false)}
        onClosed={() => {
          const message = cancelError.current;
          cancelError.current = null;
          if (message) void popup.error('Couldn’t cancel', message);
        }}
      >
        <View style={styles.sheet}>
          <Typography variant="h2" color="text">
            Cancel your registration?
          </Typography>
          <Typography variant="body" color="textMuted">
            You’ll leave {event.title}.
            {event.registration.waitlist_enabled ? ' Your spot goes to the next person on the waitlist.' : ''}
          </Typography>
          <View style={styles.notes}>
            {[
              'You can register again while registration is open',
              registration?.context.event?.base_price ? `Your ${registration.context.event.base_price} cr base price is removed from the pool` : null,
              'No points are deducted',
            ]
              .filter(Boolean)
              .map((line) => (
                <View key={line!} style={styles.row}>
                  <View style={[styles.bullet, { backgroundColor: colors.textMuted }]} />
                  <Typography variant="body" color="text" style={[styles.flex, styles.noteText]}>
                    {line}
                  </Typography>
                </View>
              ))}
          </View>
          <Button label="Cancel registration" variant="destructive" fullWidth loading={cancelling} onPress={cancelRegistration} />
          <Button label="Keep my spot" variant="outline" fullWidth disabled={cancelling} onPress={() => setCancelOpen(false)} />
        </View>
      </BottomSheet>

      <BottomSheet visible={teamSheet} onClose={() => !creatingTeam && setTeamSheet(false)}>
        <View style={styles.sheet}>
          <Typography variant="h2" color="text">
            Create your team
          </Typography>
          <Typography variant="body" color="textMuted">
            Players join with your invite code. You’ll find it here once the team exists.
          </Typography>
          <TextInput
            label="TEAM NAME"
            value={teamName}
            onChangeText={(t) => {
              setTeamName(t);
              if (teamError) setTeamError(undefined);
            }}
            maxLength={40}
            error={teamError}
          />
          <Button label="Create team" fullWidth loading={creatingTeam} onPress={createTeam} />
        </View>
      </BottomSheet>
    </View>
  );
}

/** Cover image, or the category gradient with a big trophy watermark; logo tile and pills on top. */
function Hero({ event, registered }: { event: ApiEvent; registered: boolean }) {
  const { colors } = useTheme();
  const cover = resolveMediaUrl(event.cover_media_url);
  const logo = resolveMediaUrl(event.logo_url);
  const tone = EVENT_CATEGORY_STYLE[event.category] ?? EVENT_CATEGORY_STYLE.general;
  const pill = eventStatusPill(event);
  return (
    <View style={styles.hero}>
      {cover ? (
        <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <>
          <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="event-hero" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={tone.cover} />
                <Stop offset="1" stopColor={colors.background} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#event-hero)" />
          </Svg>
          <View style={styles.heroWatermark} pointerEvents="none">
            <TrophyWatermark width={220} height={220} />
          </View>
        </>
      )}
      {logo ? (
        <View style={[styles.logo, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Image source={{ uri: logo }} style={styles.logoImage} contentFit="cover" />
        </View>
      ) : null}
      {/* Status only; category and format are in the facts below */}
      <View style={styles.pills}>
        <Badge label={registered ? 'Registered' : pill.label} variant={registered ? 'success' : pill.variant} />
      </View>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Typography color="textMuted" style={styles.factLabel}>
        {label}
      </Typography>
      <Typography color="text" style={styles.factValue} numberOfLines={2}>
        {value}
      </Typography>
    </View>
  );
}

/** Your registration: role + status, a short timeline, edit / cancel. */
function RegistrationCard({
  event,
  registration,
  onEdit,
  onCancel,
  team,
  onCreateTeam,
  onFindTeam,
}: {
  event: ApiEvent;
  registration: FormSubmission;
  onEdit: () => void;
  onCancel: () => void;
  team: Team | null;
  onCreateTeam: () => void;
  onFindTeam: () => void;
}) {
  const { colors } = useTheme();
  const status = REGISTRATION_STATUS[registration.status];
  const role = registration.context.event?.role;
  const tone = status.variant === 'success' ? colors.success : status.variant === 'danger' ? colors.danger : colors.warning;
  const roleLabel = role === 'captain' ? 'Captain' : role === 'member' ? 'Member' : null;
  const subtitle =
    registration.status === 'waitlisted'
      ? `Waitlist${registration.waitlist_position ? ` #${registration.waitlist_position}` : ''} — we’ll tell you if a spot opens`
      : registration.status === 'submitted'
        ? 'Waiting for Core to approve'
        : registration.status === 'rejected'
          ? 'Not approved for this event — contact the organisers'
          : registration.context.event?.base_price
            ? `Base price ${registration.context.event.base_price} cr · in auction pool`
            : 'You’re on the participant list';
  const steps = [
    { label: 'Registered', when: formatDate(registration.submitted_at, { day: 'numeric', month: 'short', year: undefined }), done: true },
    ...(event.auction ? [{ label: 'Auction', when: shortWhen(event.start_at), done: event.auction.status === 'finished' }] : []),
    { label: event.auction ? 'Team reveal' : 'Event day', when: event.auction ? 'After auction' : shortWhen(event.start_at), done: false },
  ];
  return (
    <View style={[styles.reg, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Typography color="text" style={styles.blockTitle}>
            {registration.status === 'confirmed' ? 'You’re in' : status.label}
            {roleLabel ? ` — ${roleLabel}` : ''}
          </Typography>
          <Typography variant="bodySmall" color="textMuted">
            {subtitle}
          </Typography>
        </View>
        <Badge label={status.label} variant={status.variant} />
      </View>
      {registration.status !== 'rejected' ? (
        <View style={[styles.timeline, styles.timelineTop, { borderTopColor: colors.border }]}>
          {steps.map((s) => (
            <View key={s.label} style={styles.row}>
              <View style={[styles.stepDot, s.done ? { backgroundColor: tone } : { borderWidth: 1.5, borderColor: colors.border }]} />
              <Typography variant="body" color={s.done ? 'text' : 'textMuted'} style={[styles.flex, styles.small]}>
                {s.label}
              </Typography>
              <Typography color="textMuted" style={styles.when}>
                {s.when}
              </Typography>
            </View>
          ))}
        </View>
      ) : null}
      {event.teaming?.is_teamed && registration.status === 'confirmed' ? (
        <TeamRow
          auction={!!event.auction}
          team={team}
          isCaptain={role === 'captain'}
          canCreate={role === 'captain' && !['pending', 'declined'].includes(registration.context.event?.captain_application.status ?? 'none')}
          onCreate={onCreateTeam}
          onFind={onFindTeam}
        />
      ) : null}
      {registration.status !== 'rejected' ? (
        <View style={styles.row}>
          <Button label="Edit details" variant="outline" onPress={onEdit} containerStyle={styles.flex} />
          <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button" style={[styles.flex, styles.cancel]}>
            <Typography style={[styles.semibold, styles.small, { color: colors.dangerText }]}>Cancel registration</Typography>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Your team inside the registration card: roster + invite code, or the way to get one. */
function TeamRow({
  auction,
  team,
  isCaptain,
  canCreate,
  onCreate,
  onFind,
}: {
  auction: boolean;
  team: Team | null;
  isCaptain: boolean;
  canCreate: boolean;
  onCreate: () => void;
  onFind: () => void;
}) {
  const { colors } = useTheme();
  if (!team) {
    if (isCaptain && !canCreate) return null;
    // Auction members get their team at the hammer, not by joining.
    if (!isCaptain && auction) return null;
    return (
      <View style={[styles.teamRow, { borderTopColor: colors.border }]}>
        <Typography variant="body" color="textMuted" style={[styles.flex, styles.small]}>
          {isCaptain ? 'You haven’t created your team yet.' : 'You’re not on a team yet.'}
        </Typography>
        <Button label={isCaptain ? 'Create team' : 'Find a team'} size="sm" onPress={isCaptain ? onCreate : onFind} />
      </View>
    );
  }
  const code = team.invite_code;
  return (
    <View style={[styles.teamRow, { borderTopColor: colors.border }]}>
      <View style={styles.flex}>
        <Typography variant="body" color="text" style={[styles.semibold, styles.small]} numberOfLines={1}>
          {team.name}
        </Typography>
        <Typography variant="bodySmall" color="textMuted">
          {team.members.length}
          {team.size_max ? ` / ${team.size_max}` : ''} players{code ? ` · code ${code}` : ''}
        </Typography>
      </View>
      {code ? (
        <Button
          label="Share"
          size="sm"
          variant="outline"
          onPress={() => void Share.share({ message: `Join ${team.name} on BGSC with invite code ${code}` })}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  gap: { gap: 20 },
  pad: { paddingHorizontal: 20 },
  pressed: { opacity: 0.85 },
  semibold: { fontFamily: FONT_FAMILIES.bodySemiBold },
  small: { fontSize: 13 },
  when: { fontSize: 12.5, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  center: { alignSelf: 'center' },
  hero: { height: 240, justifyContent: 'flex-end', gap: 12, padding: 20, overflow: 'hidden' },
  heroWatermark: { position: 'absolute', right: -15, top: 0, transform: [{ rotate: '12deg' }] },
  logo: { alignSelf: 'flex-start', padding: 6, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  logoImage: { width: 44, height: 44, borderRadius: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  body: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, gap: 30 },
  titleBlock: { gap: 8 },
  title: { fontSize: 34, lineHeight: 40 },
  // Facts: 2 × 2 grid of plain text between hairlines.
  facts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fact: { width: '50%', gap: 3, paddingRight: 12 },
  factLabel: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 10, lineHeight: 15, letterSpacing: 0.8 },
  factValue: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 15, lineHeight: 20 },
  capacity: { gap: 10 },
  track: { height: 6, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  // Auction and registration: plain blocks between hairlines, no box.
  auction: { gap: 10, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  blockTitle: { fontFamily: FONT_FAMILIES.bodyBold, fontSize: 18, lineHeight: 24 },
  link: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 13, lineHeight: 20 },
  section: { gap: 12 },
  tagText: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 13, lineHeight: 20 },
  // Photos run to the screen edges; the first lines up with the text.
  bleed: { marginHorizontal: -20 },
  gallery: { gap: 10, paddingHorizontal: 20 },
  photo: { width: 140, height: 100, borderRadius: 12 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  place: { width: 40, fontFamily: FONT_FAMILIES.hero, fontSize: 18, lineHeight: 24 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  reg: { gap: 16, paddingVertical: 18, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  timeline: { gap: 12 },
  timelineTop: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16 },
  stepDot: { width: 10, height: 10, borderRadius: 5 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  cancel: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 8 },
  sheet: { gap: 16 },
  notes: { gap: 12 },
  noteText: { fontSize: 13, lineHeight: 18 },
  bullet: { width: 6, height: 6, borderRadius: 3 },
});
