import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { StatTile } from '../../src/components/StatTile';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Alert } from '../../src/feedback/Alert';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useResponsive } from '../../src/responsive/useResponsive';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { bracketsRepository } from '../../src/repositories/BracketsRepository';
import { getErrorMessage } from '../../src/api/client';
import { formatShortDate } from '../../src/utils/format';

export default function MatchScreen() {
  const { colors } = useTheme();
  const { gutter, isCompactPhone } = useResponsive();
  const navigation = useNavigation<any>();
  const { params } = useRoute<any>();
  const [shareError, setShareError] = useState<string | null>(null);
  const match = useAsyncResource(() => bracketsRepository.match(params.id), [params.id]);
  const next = useAsyncResource(() => bracketsRepository.match(match.data!.advances_to!.match_id), [match.data?.advances_to?.match_id], { enabled: !!match.data?.advances_to?.match_id });
  useEffect(() => navigation.addListener('focus', () => { void match.reload(); }), [navigation, match.reload]);
  const m = match.data;
  const opponentSlot = m?.advances_to?.slot === 'a' ? 'b' : 'a';
  const opponent = next.data?.[opponentSlot];
  const winner = m?.winner === 'a' ? m.a : m?.winner === 'b' ? m.b : null;
  const avatarSize = isCompactPhone ? 48 : 56;
  async function share() {
    if (!m) return;
    try {
      await Share.share({ message: `${m.a?.display_name ?? 'TBD'} ${m.score_a ?? '—'} – ${m.score_b ?? '—'} ${m.b?.display_name ?? 'TBD'} · ${m.status} · Round ${m.round}${m.venue ? ` · ${m.venue}` : ''}` });
      setShareError(null);
    } catch (err) { setShareError(getErrorMessage(err)); }
  }
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['left', 'right', 'bottom']}>
    <AppHeader title="Match" showBackButton showMenuButton={false} />
    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingTop: gutter }]} refreshControl={<RefreshControl refreshing={match.refreshing} onRefresh={() => { void match.reload(); if (m?.advances_to) void next.reload(); }} tintColor={colors.accent} />}>
      {match.loading ? <><Skeleton.Card /><Skeleton.Card /></> : match.error ? <ErrorState title="Could not load the match" message={match.error} onRetry={() => void match.reload()} /> : m && <>
        <Card style={{ borderWidth: 1, borderColor: m.status === 'ongoing' ? colors.danger : colors.border }}>
          <View style={{ alignItems: 'center' }}><Badge label={m.status === 'ongoing' ? 'Live' : m.status} variant={m.status === 'ongoing' ? 'danger' : m.status === 'completed' ? 'success' : 'muted'} /></View>
          <View style={styles.scoreboard}>
            <View style={styles.side}>
              <Avatar name={m.a?.display_name} size={avatarSize} />
              <Typography align="center" variant="h3" numberOfLines={2}>{m.a?.display_name ?? 'To be decided'}</Typography>
              <Typography variant="caption" color="textMuted" numberOfLines={1}>{m.a ? `Seed ${m.a.seed}` : 'Awaiting result'}</Typography>
            </View>
            <View style={styles.score}>
              <Typography variant={isCompactPhone ? 'h1' : 'displayTitle'} align="center" numberOfLines={1}>
                {m.score_a ?? '—'} : {m.score_b ?? '—'}
              </Typography>
            </View>
            <View style={styles.side}>
              <Avatar name={m.b?.display_name} size={avatarSize} />
              <Typography align="center" variant="h3" numberOfLines={2}>{m.b?.display_name ?? (m.status === 'bye' ? 'Bye' : 'To be decided')}</Typography>
              <Typography variant="caption" color="textMuted" numberOfLines={1}>{m.b ? `Seed ${m.b.seed}` : 'Awaiting result'}</Typography>
            </View>
          </View>
          {winner && <Typography align="center" color="success">{winner.display_name} {m.status === 'bye' ? 'advances with a bye' : 'wins'}</Typography>}
          {m.winner === 'draw' && <Typography align="center">Match drawn</Typography>}
        </Card>
        <View style={styles.stats}>
          <StatTile value={m.venue ?? 'TBA'} caption="Venue" />
          <StatTile value={m.scheduled_at ? formatShortDate(m.scheduled_at) : 'TBA'} caption="Scheduled" />
          <StatTile value={m.round} caption="Round" />
        </View>
        <Typography variant="displayTitle">Match updates</Typography>
        <Card>
          <Typography variant="h3">{m.status === 'completed' ? 'Result published' : m.status === 'ongoing' ? 'Match in progress' : m.status === 'cancelled' ? 'Match cancelled' : m.status === 'bye' ? 'Automatic advancement' : 'Fixture scheduled'}</Typography>
          <Typography variant="caption" color="textMuted">Updated {new Date(m.updated_at).toLocaleString()}</Typography>
          <Typography variant="body" color="textMuted">Round-by-round commentary is not available. Pull down to refresh the latest match status.</Typography>
        </Card>
        {m.advances_to && <Card onPress={() => navigation.push('Match', { id: m.advances_to!.match_id })} accessibilityLabel="View the next match">
          <Typography variant="h3">{opponent ? `Winner meets ${opponent.display_name}` : 'Winner advances to the next match'}</Typography>
          {next.loading ? <Skeleton height={20} /> : next.error ? <Typography variant="caption" color="textMuted">Next-match details could not be loaded. Tap to retry.</Typography> : <Typography variant="caption" color="textMuted">Round {next.data?.round ?? m.round + 1}{next.data?.venue ? ` · ${next.data.venue}` : ''}</Typography>}
        </Card>}
        <Button label="View tournament bracket" variant="outline" onPress={() => navigation.navigate('EventStandings', { ref: m.event_id, view: 'bracket' })} />
        <Button label="Share match" variant="outline" onPress={() => void share()} />
        {shareError && <Alert variant="error" title="Could not share" description={shareError} />}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 32, gap: 20 },
  scoreboard: { flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  side: { flex: 1, minWidth: 0, alignItems: 'center', gap: 8 },
  score: { minWidth: 64, maxWidth: 108, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
