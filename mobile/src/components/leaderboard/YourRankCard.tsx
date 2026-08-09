import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';

export type YourRankState =
  | { kind: 'participant'; rank: number; score: number }
  | { kind: 'registered' }
  | { kind: 'guest' }
  | { kind: 'spectator' }
  | { kind: 'ended' };

export interface YourRankCardProps {
  state: YourRankState;
  /** Event still running + investment enabled → show the primary CTA. */
  investable: boolean;
  onInvest: () => void;
  onLogin: () => void;
}

/**
 * Sticky "Your Rank" row (leaderboard.md §4.1 / §4.7 states matrix).
 * Guest → Log in to participate (write gate). Spectator → read-only note.
 * Ended → final result note. Participant → rank + [ Invest Points ] primary CTA.
 *
 * ponytail: rendered inline after the standings (not pinned absolute-bottom —
 * the spec's detach/re-dock sticky behaviour needs a layout-animation pass;
 * add it when standings exceed one screen).
 */
export function YourRankCard({ state, investable, onInvest, onLogin }: YourRankCardProps) {
  const colors = useColors();

  const caption = {
    participant: 'Your rank is shown below.',
    registered: 'Registered — your standing appears once scores publish.',
    guest: 'Rankings are public — participate to climb them.',
    spectator: 'You are spectating this event.',
    ended: 'Event ended — final standings.',
  }[state.kind];

  return (
    <GlassCard accessibilityLabel={caption}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Your Rank</Text>
          <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
            {state.kind === 'participant' ? (
              <>
                <Text style={{ color: colors.accent }}>#{state.rank}</Text>
                {'  ·  '}
                {state.score.toLocaleString()} pts
              </>
            ) : (
              caption
            )}
          </Text>
          {state.kind === 'participant' && !investable ? (
            <Text style={[styles.helper, { color: colors.textMuted }]}>
              Point investment is not enabled for this event.
            </Text>
          ) : null}
        </View>
        {state.kind === 'participant' ? (
          <PillButton
            variant="primary"
            label="Invest Points"
            onPress={onInvest}
            disabled={!investable}
            fullWidth={false}
            accessibilityLabel="Invest points to boost your rank"
            style={styles.cta}
          />
        ) : state.kind === 'guest' ? (
          <Pressable
            onPress={onLogin}
            accessibilityRole="button"
            accessibilityLabel="Log in to participate"
            hitSlop={8}
            style={styles.login}
          >
            <Text style={[styles.loginText, { color: colors.accent }]}>Log in to participate</Text>
          </Pressable>
        ) : null}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  value: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  helper: {
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 2,
  },
  cta: {
    paddingHorizontal: 16,
    minWidth: 140,
  },
  login: {
    minHeight: 44,
    justifyContent: 'center',
  },
  loginText: {
    fontFamily: FONTS.semibold,
    fontSize: 14,
  },
});
