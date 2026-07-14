import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuthStore } from '@/core/stores/authStore';
import type { ThemeColors } from '@/core/theme/tokens';
import { useColors } from '@/hooks/use-colors';

import { MOCK_COORDINATORS } from './mock-data';
import { SkeletonBox } from './SkeletonBox';
import type { Coordinator } from './types';

interface Props {
  isLoading?: boolean;
  hasError?: boolean;
  onRetry?: () => void;
  onSeeAllAnnouncements: () => void;
  onCoordinatorAnnouncementTap: (announcementId: string) => void;
}

export function IntroTab({ isLoading, hasError, onRetry, onSeeAllAnnouncements, onCoordinatorAnnouncementTap }: Props) {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);

  const handlePortraitTap = () => {
    if (!user) {
      router.push('/login');
    } else {
      router.push('/(drawer)/profile');
    }
  };

  if (isLoading) {
    return <IntroSkeleton colors={colors} />;
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>

      {/* Hero Banner */}
      <View style={[styles.hero, { backgroundColor: colors.accent }]}>
        <View style={styles.heroLogoRow}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeMain}>BGSC</Text>
          </View>
          <View style={[styles.heroBadge, styles.heroBadgeSub]}>
            <Text style={styles.heroBadgeSub_text}>BGEC</Text>
          </View>
          <View style={[styles.heroBadge, styles.heroBadgeSub]}>
            <Text style={styles.heroBadgeSub_text}>FitSoc</Text>
          </View>
        </View>
        <Text style={styles.heroTagline}>Where Campus Sports Meets Esports</Text>
      </View>

      {/* Coordinator Comic Strip */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          What Our Heads Have to Say
        </Text>

        {/* Inline error state — hero banner stays visible, only strip shows retry */}
        {hasError && (
          <View style={styles.errorRow}>
            <Text style={[styles.errorText, { color: colors.textMuted }]}>
              Couldn't load coordinator updates.{' '}
            </Text>
            <Pressable onPress={onRetry} accessibilityLabel="Retry loading coordinators">
              <Text style={[styles.retryLink, { color: colors.accent }]}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!hasError && MOCK_COORDINATORS.length > 0 && (
          <>
            {MOCK_COORDINATORS.map((coordinator) => (
              <CoordinatorCard
                key={coordinator.id}
                coordinator={coordinator}
                colors={colors}
                onPortraitTap={handlePortraitTap}
                onBubbleTap={() => {
                  if (coordinator.latestAnnouncement) {
                    onCoordinatorAnnouncementTap(coordinator.latestAnnouncement.id);
                  } else {
                    onSeeAllAnnouncements();
                  }
                }}
              />
            ))}

            <Pressable
              style={[styles.ctaButton, { borderColor: colors.accent }]}
              onPress={onSeeAllAnnouncements}
              accessibilityRole="button"
              accessibilityLabel="See all announcements">
              <Text style={[styles.ctaText, { color: colors.accent }]}>
                See all announcements →
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

interface CardProps {
  coordinator: Coordinator;
  colors: ThemeColors;
  onPortraitTap: () => void;
  onBubbleTap: () => void;
}

function CoordinatorCard({ coordinator, colors, onPortraitTap, onBubbleTap }: CardProps) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        onPress={onPortraitTap}
        accessibilityLabel={`View ${coordinator.name}'s profile`}>
        <View style={[styles.portrait, { backgroundColor: coordinator.avatarColor }]}>
          <Text style={styles.portraitInitial}>{coordinator.avatarInitial}</Text>
        </View>
      </Pressable>

      <Pressable style={styles.bubbleWrap} onPress={onBubbleTap}>
        <View style={[styles.bubble, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {coordinator.latestAnnouncement ? (
            <Text style={[styles.bubbleBody, { color: colors.text }]} numberOfLines={2}>
              {coordinator.latestAnnouncement.body}
            </Text>
          ) : (
            <Text style={[styles.bubbleBody, { color: colors.textMuted }]}>
              ¯\_(ツ)_/¯  No announcements yet.
            </Text>
          )}
          <Text style={[styles.coordMeta, { color: colors.textMuted }]}>
            {coordinator.name} · {coordinator.role}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function IntroSkeleton({ colors }: { colors: ThemeColors }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <SkeletonBox height={180} borderRadius={0} />
      <View style={styles.section}>
        <SkeletonBox height={22} width="65%" style={{ marginBottom: 20 }} />
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 14 }]}>
            <SkeletonBox width={72} height={72} borderRadius={36} />
            <View style={{ flex: 1, gap: 8 }}>
              <SkeletonBox height={14} />
              <SkeletonBox height={14} width="85%" />
              <SkeletonBox height={12} width="45%" />
            </View>
          </View>
        ))}
        <SkeletonBox height={48} borderRadius={10} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 40 },

  hero: {
    paddingTop: 44,
    paddingBottom: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 14,
  },
  heroLogoRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  heroBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroBadgeSub: { backgroundColor: 'rgba(255,255,255,0.12)' },
  heroBadgeMain: { color: '#fff', fontWeight: '800', fontSize: 20, letterSpacing: 1 },
  heroBadgeSub_text: { color: 'rgba(255,255,255,0.9)', fontWeight: '700', fontSize: 15 },
  heroTagline: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  section: { paddingHorizontal: 16, paddingTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 18 },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  portrait: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portraitInitial: { color: '#fff', fontSize: 26, fontWeight: '700' },

  bubbleWrap: { flex: 1 },
  bubble: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 6 },
  bubbleBody: { fontSize: 14, lineHeight: 20 },
  coordMeta: { fontSize: 12 },

  ctaButton: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  ctaText: { fontSize: 15, fontWeight: '600' },

  errorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20 },
  errorText: { fontSize: 14 },
  retryLink: { fontSize: 14, fontWeight: '700' },
});
