import { useCallback, useRef, useState } from 'react';
import { FlatList, Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { usePopup } from '../../src/popups/PopupProvider';
import { TermsPopup } from '../../src/popups/TermsPopup';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import { registrationRepository } from '../../src/repositories/RegistrationRepository';
import { mediaRepository } from '../../src/repositories/MediaRepository';
import { getErrorMessage } from '../../src/api/client';
import { resolveMediaUrl } from '../../src/api/config';
import type { EligibilityReason } from '../../src/api/types';
import {
  capacityLabel,
  eventStatusPill,
  EVENT_CATEGORY_LABELS,
  EVENT_TYPE_LABELS,
  formatDateTime,
  REGISTRATION_STATUS,
} from '../../src/utils/format';

const INELIGIBLE_LABEL: Record<NonNullable<EligibilityReason>, string> = {
  already_registered: 'Already registered',
  event_cancelled: 'Event cancelled',
  event_past: 'Event has finished',
  not_yet_open: 'Registration opens soon',
  registration_closed: 'Registration closed',
  capacity_full: 'Event is full',
  registration_form_unavailable: 'Registration form coming soon',
};

export default function EventDetails() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const popup = usePopup();
  const eventRef: string = route.params?.eventId;
  const [rulesVisible, setRulesVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const { data, loading, refreshing, error, reload } = useAsyncResource(async () => {
    const [event, eligibility, registration] = await Promise.all([
      eventsRepository.get(eventRef),
      eventsRepository.eligibility(eventRef).catch(() => null),
      eventsRepository.myRegistration(eventRef).catch(() => null),
    ]);
    const gallery = await mediaRepository
      .list({ event_id: event._id, media_type: 'image', limit: 10 })
      .then((res) => res.items)
      .catch(() => []);
    return { event, eligibility, registration, gallery };
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
        <AppHeader title="Event details" showBackButton showMenuButton={false} />
        <View style={styles.content}>
          <Skeleton height={180} borderRadius={24} />
          <Skeleton.Card />
          <Skeleton.Card />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
        <AppHeader title="Event details" showBackButton showMenuButton={false} />
        <ErrorState title="Could not load this event" message={error ?? undefined} onRetry={() => void reload()} />
      </SafeAreaView>
    );
  }

  const { event, eligibility, registration, gallery } = data;
  const pill = eventStatusPill(event);
  const activeRegistration = registration && registration.status !== 'cancelled' ? registration : null;
  const regStatus = activeRegistration ? REGISTRATION_STATUS[activeRegistration.status] : null;
  const canRegister = !activeRegistration && (eligibility ? eligibility.eligible : pill.registrationOpen);
  const blockedLabel = eligibility?.reason ? INELIGIBLE_LABEL[eligibility.reason] : pill.label === 'Soon' ? 'Registration opens soon' : 'Registration closed';
  const cover = resolveMediaUrl(event.cover_media_url);
  const ruleLines = event.rules_summary
    ?.split(/\n+/)
    .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(Boolean);

  const cancelRegistration = async () => {
    if (!activeRegistration) return;
    const confirmed = await popup.confirm({
      title: 'Cancel registration?',
      message: `You will lose your place in ${event.title}. You can register again while registration is open.`,
      confirmLabel: 'Cancel registration',
      cancelLabel: 'Keep my place',
      destructive: true,
    });
    if (!confirmed) return;
    setCancelling(true);
    try {
      await registrationRepository.cancel(activeRegistration._id);
      await popup.success('Registration cancelled', `You are no longer registered for ${event.title}.`);
      await reload({ silent: true });
    } catch (err) {
      await popup.error('Could not cancel', getErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Event details" showBackButton showMenuButton={false} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload()} tintColor={colors.accent} />}
      >
        <View style={[styles.hero, { backgroundColor: colors.accentMuted }]}>
          {cover ? <Image source={{ uri: cover }} style={styles.cover} contentFit="cover" transition={200} /> : null}
          <View style={styles.heroRow}>
            <Badge label={pill.label} variant={pill.variant} />
            <Badge label={EVENT_CATEGORY_LABELS[event.category]} variant="muted" />
          </View>
          <Typography variant="displayTitle">{event.title}</Typography>
          <Typography variant="body" color="textMuted">
            {formatDateTime(event.start_at)}
            {event.venue ? ` · ${event.venue}` : ''}
          </Typography>
        </View>

        {gallery.length > 0 ? (
          <FlatList
            horizontal
            data={gallery}
            keyExtractor={(item) => item._id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.gallery}
            renderItem={({ item, index }) => (
              <Card
                variant="inner"
                style={styles.galleryCard}
                onPress={() => navigation.navigate('MediaViewer', { items: gallery, index })}
                accessibilityLabel="Open photo"
              >
                <Image source={{ uri: resolveMediaUrl(item.url) }} style={styles.galleryImage} contentFit="cover" />
              </Card>
            )}
          />
        ) : null}

        <Card variant="solid">
          <Card.Header title="About this event" />
          <Card.Body>
            <Typography variant="body" color="textMuted">
              {event.description}
            </Typography>
            {event.tags.length > 0 ? (
              <View style={styles.tags}>
                {event.tags.map((tag) => (
                  <Badge key={tag} label={tag} variant="muted" />
                ))}
              </View>
            ) : null}
            <View style={styles.details}>
              <Typography variant="body" color="textMuted">Format: {EVENT_TYPE_LABELS[event.type]}{event.teaming.is_teamed ? ' · Team event' : ' · Individual'}</Typography>
              <Typography variant="body" color="textMuted">Capacity: {capacityLabel(event)}</Typography>
              {event.teaming.is_teamed && event.teaming.team_size_max ? (
                <Typography variant="body" color="textMuted">
                  Team size: {event.teaming.team_size_min ?? 1}–{event.teaming.team_size_max} players
                </Typography>
              ) : null}
              <Typography variant="body" color="textMuted">Ends: {formatDateTime(event.end_at)}</Typography>
              {event.registration.closes_at ? (
                <Typography variant="body" color="textMuted">Registration closes: {formatDateTime(event.registration.closes_at)}</Typography>
              ) : null}
            </View>
          </Card.Body>
          {ruleLines?.length || event.rules_pdf_url ? (
            <Card.Footer>
              {ruleLines?.length ? <Button label="Read event rules" size="sm" variant="outline" onPress={() => setRulesVisible(true)} /> : null}
              {event.rules_pdf_url ? (
                <Button
                  label="Rulebook PDF"
                  size="sm"
                  variant="ghost"
                  rightIcon="open-outline"
                  onPress={() => void Linking.openURL(resolveMediaUrl(event.rules_pdf_url)!)}
                />
              ) : null}
            </Card.Footer>
          ) : null}
        </Card>

        <Card variant="accent">
          <Card.Header
            title="Your registration"
            rightAction={<Badge label={regStatus ? regStatus.label : canRegister ? 'Required' : pill.label} variant={regStatus ? regStatus.variant : 'warning'} />}
          />
          <Card.Body>
            <Typography variant="body" color="textMuted">
              {activeRegistration
                ? activeRegistration.status === 'waitlisted'
                  ? `You are on the waitlist${activeRegistration.waitlist_position ? ` at position #${activeRegistration.waitlist_position}` : ''}. We will notify you if a place opens up.`
                  : activeRegistration.status === 'submitted'
                    ? 'Your registration is waiting for admin approval.'
                    : activeRegistration.status === 'rejected'
                      ? 'Your registration was not approved for this event.'
                      : `You are on the participant list${activeRegistration.context.event?.role === 'captain' ? ' as a team captain' : ''}. Fixtures will be shared here.`
                : canRegister
                  ? eligibility?.capacity_status === 'waitlist_only'
                    ? 'The event is full — registering now adds you to the waitlist.'
                    : 'Reserve your place by completing the short registration form.'
                  : 'Registration is not available for this event right now.'}
            </Typography>
          </Card.Body>
          <Card.Footer>
            {activeRegistration ? (
              activeRegistration.status !== 'rejected' ? (
                <Button label="Cancel registration" size="sm" variant="destructive" loading={cancelling} onPress={() => void cancelRegistration()} />
              ) : (
                <Typography variant="caption" color="textMuted">Contact the organisers for details.</Typography>
              )
            ) : (
              <Button
                label={canRegister ? (eligibility?.capacity_status === 'waitlist_only' ? 'Join waitlist' : 'Register now') : blockedLabel}
                size="sm"
                variant="primary"
                disabled={!canRegister}
                onPress={() => navigation.navigate('EventRegistration', { eventId: event.slug || event._id })}
              />
            )}
          </Card.Footer>
        </Card>

        {event.auction ? (
          <Card variant="solid">
            <Card.Header
              title="Player auction"
              rightAction={
                <Badge
                  label={event.auction.status === 'live' ? 'Live' : event.auction.status === 'finished' ? 'Finished' : event.auction.status === 'paused' ? 'Paused' : 'Not started'}
                  variant={event.auction.status === 'live' ? 'success' : event.auction.status === 'paused' ? 'warning' : 'muted'}
                />
              }
            />
            <Card.Body>
              <Typography variant="body" color="textMuted">
                Approved captains draft registered players with their team purse. Watch the bidding live or bid if you are a captain.
              </Typography>
            </Card.Body>
            <Card.Footer>
              <Button
                label={event.auction.status === 'finished' ? 'View results' : 'Open live auction'}
                size="sm"
                variant="outline"
                onPress={() => navigation.navigate('Auction', { eventRef: event.slug || event._id })}
              />
            </Card.Footer>
          </Card>
        ) : null}

        {event.leaderboard ? (
          <Card variant="solid" onPress={() => navigation.navigate('EventLeaderboard', { eventRef: event.slug || event._id, title: event.title })}>
            <Card.Header title="Standings" subtitle="Live rankings for this event" rightAction={<Badge label="Leaderboard" variant="primary" icon="trophy" />} />
          </Card>
        ) : null}

        {event.awards.length > 0 ? (
          <Card variant="solid">
            <Card.Header title="Awards" />
            {event.awards.map((award) => (
              <View key={`${award.place}-${award.title}`} style={[styles.row, { borderBottomColor: colors.border }]}>
                <Typography variant="h3" color="accent">#{award.place}</Typography>
                <View style={styles.rowText}>
                  <Typography variant="body">{award.title}</Typography>
                  {award.description ? <Typography variant="caption" color="textMuted">{award.description}</Typography> : null}
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        {event.contacts.filter((c) => !c.deleted).length > 0 ? (
          <Card variant="solid">
            <Card.Header title="Contacts" />
            {event.contacts
              .filter((c) => !c.deleted)
              .map((contact) => (
                <View key={contact.user_id} style={[styles.row, { borderBottomColor: colors.border }]}>
                  <View style={styles.rowText}>
                    <Typography variant="body">{contact.display_name}</Typography>
                    <Typography variant="caption" color="textMuted">{contact.role_label}</Typography>
                  </View>
                  {contact.contact ? (
                    <Button
                      label="Contact"
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        const value = contact.contact.trim();
                        void Linking.openURL(value.includes('@') ? `mailto:${value}` : `tel:${value.replace(/\s/g, '')}`);
                      }}
                    />
                  ) : null}
                </View>
              ))}
          </Card>
        ) : null}

        <Button label="Back to events" variant="outline" fullWidth onPress={() => navigation.goBack()} />
      </ScrollView>

      <TermsPopup
        visible={rulesVisible}
        title={`${event.title} rules`}
        terms={ruleLines}
        onAccept={() => setRulesVisible(false)}
        onClose={() => setRulesVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  hero: { padding: 20, borderRadius: 24, gap: 10, overflow: 'hidden' },
  heroRow: { flexDirection: 'row', gap: 8 },
  cover: { height: 160, borderRadius: 16, marginBottom: 4 },
  gallery: { gap: 12, paddingVertical: 4 },
  galleryCard: { padding: 0, overflow: 'hidden' },
  galleryImage: { width: 140, height: 100, borderRadius: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  details: { gap: 8, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1, gap: 2 },
});
