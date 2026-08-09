import { Ionicons } from '@expo/vector-icons';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { EmptyState, ErrorState } from '@/components/events/SectionStates';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import type { PlatformEvent } from '@/core/types';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

// TODO(events, Phase 2): point at the real Web Console URL when it ships.
const WEB_CONSOLE_URL = 'http://localhost:5173';

/**
 * Spectator bracket (spec §8). Bracket generation is Web-Console-only, so the
 * mobile surface is: skeleton while loading, then the "not generated yet"
 * state with the hard-rule "Manage on Web →" link (§8.2).
 *
 * TODO(events, Phase 2): no bracket endpoint exists in event-service.md —
 * when it lands, render the horizontally-scrollable round columns here.
 */
export function BracketView({
  event,
  isLoading,
  isError,
  onRetry,
}: {
  event?: PlatformEvent;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const colors = useColors();

  if (isLoading || !event) {
    return (
      <View style={styles.rounds}>
        {[0, 1, 2].map((col) => (
          <View key={col} style={styles.roundCol}>
            {[0, 1].map((card) => (
              <GlassCard key={card} style={styles.matchCard}>
                <SkeletonBlock height={14} style={{ marginBottom: 8 }} />
                <SkeletonBlock height={14} width="60%" />
              </GlassCard>
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (isError) {
    return <ErrorState message="Couldn't load this bracket." onRetry={onRetry} />;
  }

  return (
    <>
      <GlassCard>
        <View style={styles.row}>
          <Ionicons name="git-branch-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.title, { color: colors.text }]}>{event.title}</Text>
        </View>
        <EmptyState message="Bracket has not been generated yet." />
      </GlassCard>
      <PressableLink
        label="Manage on Web →"
        onPress={() => void Linking.openURL(WEB_CONSOLE_URL).catch(() => {})}
      />
    </>
  );
}

function PressableLink({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.linkWrap}>
      <Text
        accessibilityRole="link"
        accessibilityLabel={label}
        onPress={onPress}
        style={[styles.link, { color: colors.accent }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rounds: {
    flexDirection: 'row',
    gap: 12,
    overflow: 'hidden',
  },
  roundCol: {
    flex: 1,
    gap: 12,
  },
  matchCard: {
    padding: 12,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: FONTS.heading,
    fontSize: 20,
    flex: 1,
  },
  linkWrap: {
    alignItems: 'center',
    paddingVertical: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  link: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
  },
});
