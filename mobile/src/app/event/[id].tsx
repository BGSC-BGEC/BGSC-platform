import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { LeaderboardList } from '@/components/events/LeaderboardList';
import { RegistrationSection } from '@/components/events/RegistrationSection';
import { RouteHeader } from '@/components/events/RouteHeader';
import { ErrorState, SectionLabel, StatusPill } from '@/components/events/SectionStates';
import { LiveDot } from '@/components/events/EventCard';
import { Screen } from '@/components/screen';
import { SkeletonBlock, SkeletonCard } from '@/components/SkeletonBlock';
import type { PlatformEvent } from '@/core/types';
import type { ThemeColors } from '@/core/theme/tokens';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';
import { useEventDetail } from '@/hooks/use-events';
import { formatEventRange } from '@/lib/dates';

/**
 * Event detail (events-page1.md §7): info block, sponsor leader preview,
 * registration (guest-gated), bracket / auction entry points, leaderboard
 * and the post-event fan-reward card. Sections render per the spec's own
 * conditions ("if active", "if enabled", "post-completion").
 */
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = String(id);
  const colors = useColors();
  const { data: event, isLoading, isError, refetch } = useEventDetail(eventId);

  if (isLoading || !event) {
    return (
      <Screen>
        <RouteHeader title="Event Details" />
        <SkeletonCard lines={2} />
        <View style={styles.gap12}>
          <SkeletonBlock height={48} radius={16} />
          <SkeletonBlock height={48} radius={16} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen>
        <RouteHeader title="Event Details" />
        <ErrorState message="Couldn't load this event." onRetry={() => void refetch()} />
      </Screen>
    );
  }

  const hasBracket =
    // TODO(events, Phase 2): gate on a real backend bracket flag once it ships;
    // for now every score-bearing / league event gets the entry point.
    event.type === 'ALL' || event.type === 'DLL' || event.needsLeaderboard;

  return (
    <Screen>
      <RouteHeader title="Event Details" />
      <InfoBlock event={event} />

      {event.status === 'ongoing' && event.sponsorLeader ? (
        <GlassCard style={styles.sponsorCard}>
          <LiveDot size={10} />
          <Text style={[styles.sponsorText, { color: colors.text }]}>
            {event.sponsorLeader.sponsorName} is leading in fan support
          </Text>
        </GlassCard>
      ) : null}

      <RegistrationSection event={event} />

      {hasBracket ? (
        <EntryCard
          icon="git-branch-outline"
          title="Bracket"
          caption="View the tournament bracket"
          accessibilityLabel="Open bracket"
          onPress={() => router.push(`/event/bracket/${eventId}`)}
        />
      ) : null}

      {event.isAuctionBased ? (
        <EntryCard
          icon="pricetag-outline"
          title="Auction"
          caption="Spectate the player auction"
          accessibilityLabel="Open auction spectator view"
          onPress={() => router.push(`/event/auction/${eventId}`)}
        />
      ) : null}

      {event.needsLeaderboard ? <LeaderboardList eventId={eventId} /> : null}

      {event.status === 'past' && event.userFanEarned != null && event.sponsorLeader ? (
        <GlassCard style={styles.rewardCard}>
          <Text style={[styles.rewardText, { color: colors.success }]}>
            +{event.userFanEarned} fans earned for {event.sponsorLeader.sponsorName}
          </Text>
        </GlassCard>
      ) : null}
    </Screen>
  );
}

/** Spec §7.2 — static reading block: title, description, links, meta rows. */
function InfoBlock({ event }: { event: PlatformEvent }) {
  const colors = useColors();
  return (
    <View style={styles.gap12}>
      <View style={styles.infoHeader}>
        <Text style={[styles.title, { color: colors.text }]}>{event.title}</Text>
        <StatusPill status={event.status} />
      </View>
      {event.description ? (
        <Text style={[styles.description, { color: colors.text }]}>{event.description}</Text>
      ) : null}
      <GlassCard style={styles.meta}>
        <MetaRow colors={colors} icon="calendar-outline" text={formatEventRange(event.startDate, event.endDate)} />
        {event.venue ? <MetaRow colors={colors} icon="location-outline" text={event.venue} /> : null}
        {event.awardsList && event.awardsList.length > 0 ? (
          <MetaRow colors={colors} icon="trophy-outline" text={event.awardsList.join(' · ')} />
        ) : null}
        {event.rulesPdfUrl ? (
          <MetaRow
            colors={colors}
            icon="document-text-outline"
            text="Rules"
            isLink
            onPress={() => void Linking.openURL(event.rulesPdfUrl!).catch(() => {})}
          />
        ) : null}
        {event.coordinatorContacts && event.coordinatorContacts.length > 0 ? (
          <MetaRow
            colors={colors}
            icon="mail-outline"
            text={event.coordinatorContacts.map((c) => c.name).join(', ')}
            isLink
            onPress={() => {
              const email = event.coordinatorContacts?.find((c) => c.email)?.email;
              if (email) void Linking.openURL(`mailto:${email}`).catch(() => {});
            }}
          />
        ) : null}
      </GlassCard>
    </View>
  );
}

function MetaRow({
  colors,
  icon,
  text,
  isLink,
  onPress,
}: {
  colors: ThemeColors;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  isLink?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.metaRow}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text
        numberOfLines={2}
        style={[styles.metaText, { color: isLink ? colors.accent : colors.textMuted }]}
      >
        {text}
      </Text>
    </View>
  );
  if (isLink && onPress) {
    return (
      <Text
        accessibilityRole="link"
        accessibilityLabel={text}
        onPress={onPress}
        style={styles.metaRowWrap}
      >
        {content}
      </Text>
    );
  }
  return content;
}

/** Bracket / auction entry card — secondary navigation surface. */
function EntryCard({
  icon,
  title,
  caption,
  accessibilityLabel,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  caption: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.entryWrap}>
      <SectionLabel label={title.toUpperCase()} />
      <GlassCard onPress={onPress} accessibilityLabel={accessibilityLabel}>
        <View style={styles.entryRow}>
          <Ionicons name={icon} size={22} color={colors.accent} />
          <View style={styles.entryTextWrap}>
            <Text style={[styles.entryTitle, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.entryCaption, { color: colors.textMuted }]}>{caption}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  gap12: {
    gap: 12,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 26,
    flex: 1,
  },
  description: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 21,
  },
  meta: {
    gap: 10,
  },
  metaRowWrap: {
    minHeight: 44,
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    flex: 1,
  },
  sponsorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  sponsorText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    flex: 1,
  },
  entryWrap: {
    marginTop: 20,
    gap: 8,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  entryTextWrap: {
    flex: 1,
    gap: 2,
  },
  entryTitle: {
    fontFamily: FONTS.heading,
    fontSize: 18,
  },
  entryCaption: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  rewardCard: {
    marginTop: 16,
    alignItems: 'center',
  },
  rewardText: {
    fontFamily: FONTS.heading,
    fontSize: 18,
  },
});
