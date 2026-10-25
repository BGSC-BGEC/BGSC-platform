import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { FilterChips } from '../../src/components/FilterChips';
import { SectionHeader } from '../../src/components/SectionHeader';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { SkeletonCard } from '../../src/feedback/Skeleton';
import { Icon, type IconName } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useResponsive } from '../../src/responsive/useResponsive';
import { getErrorMessage } from '../../src/api/client';
import { pointsRepository } from '../../src/repositories/PointsRepository';
import type { PointsSummary, PointTransactionPage } from '../../src/api/types';
import { formatNumber, humanizeReason } from '../../src/utils/format';

const filters = [{ label: 'All', value: '' }, { label: 'Earned', value: 'earn' }, { label: 'Spent', value: 'spend' }, { label: 'Refunds', value: 'refund' }, { label: 'Expired', value: 'expire' }];
const sourceIcons: Record<string, IconName> = { event: 'trophy', challenge: 'target', leaderboard: 'coins', engagement: 'sparkles', admin: 'settings' };
type Wallet = { summary: PointsSummary; sources: Awaited<ReturnType<typeof pointsRepository.breakdown>>['breakdown']; opportunities: Awaited<ReturnType<typeof pointsRepository.opportunities>>['opportunities'] };

export default function Points() {
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [type, setType] = useState('');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [page, setPage] = useState<PointTransactionPage>({ transactions: [], next_cursor: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  const load = useCallback(async (refresh = false) => {
    const request = ++version.current;
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [summary, breakdown, opportunities, transactions] = await Promise.all([
        pointsRepository.me(), pointsRepository.breakdown(), pointsRepository.opportunities(), pointsRepository.transactions({ type }),
      ]);
      if (version.current !== request) return;
      setWallet({ summary, sources: breakdown.breakdown, opportunities: opportunities.opportunities }); setPage(transactions);
    } catch (err) { if (version.current === request) setError(getErrorMessage(err)); }
    finally { if (version.current === request) { setLoading(false); setRefreshing(false); } }
  }, [type]);
  useFocusEffect(useCallback(() => { void load(); return () => { version.current += 1; }; }, [load]));
  const loadMore = async () => {
    if (!page.next_cursor || more) return;
    const request = version.current;
    setMore(true); setError(null);
    try {
      const next = await pointsRepository.transactions({ type, cursor: page.next_cursor });
      if (version.current === request) setPage(current => ({ next_cursor: next.next_cursor, transactions: [...current.transactions, ...next.transactions.filter(tx => !current.transactions.some(old => old.id === tx.id))] }));
    } catch (err) { if (version.current === request) setError(getErrorMessage(err)); }
    finally { setMore(false); }
  };
  const tones = [colors.primary, colors.success, colors.warning, colors.info, colors.textMuted];
  const donutSegments = useMemo(() => {
    const sources = wallet?.sources ?? [];
    const positiveTotal = sources.reduce((sum, source) => sum + Math.max(source.total, 0), 0);
    let runningOffset = 0;
    return sources.map((source, index) => {
      const length = positiveTotal ? (Math.max(0, source.total) / positiveTotal) * 270.18 : 0;
      const start = runningOffset;
      runningOffset += length;
      return { source: source.source, index, length, start };
    });
  }, [wallet?.sources]);

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <AppHeader title="Points" showBackButton showMenuButton={false} />
    <FlatList data={loading ? [] : page.transactions} keyExtractor={tx => tx.id}
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter, paddingTop: gutter, paddingBottom: insets.bottom + 32 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
      ListHeaderComponent={<View style={styles.stack}>
        {error && <ErrorState message={error} onRetry={() => void load(true)} />}
        {loading ? <><SkeletonCard /><SkeletonCard /></> : wallet && <>
          <Card>
            <View style={styles.balanceRow}>
              <View style={styles.balanceText}><Typography variant="label" color="textMuted">Balance</Typography><Typography variant="displayHero" numberOfLines={1}>{formatNumber(wallet.summary.balance)}</Typography><Typography variant="caption" color="success">{formatNumber(wallet.summary.lifetime_earned)} earned overall</Typography><Typography variant="caption" color="textMuted">{formatNumber(Math.abs(wallet.summary.lifetime_spent))} spent overall</Typography></View>
              <Svg width={104} height={104} viewBox="0 0 104 104" accessibilityLabel="Positive net points by source" accessibilityRole="image">
                <Circle cx={52} cy={52} r={43} fill="none" stroke={colors.surfaceInner} strokeWidth={13} />
                {donutSegments.map((seg) =>
                  seg.length > 0 ? (
                    <Circle
                      key={seg.source}
                      cx={52}
                      cy={52}
                      r={43}
                      fill="none"
                      stroke={tones[seg.index % tones.length]}
                      strokeWidth={13}
                      strokeDasharray={`${Math.max(0, seg.length - 3)} 270.18`}
                      strokeDashoffset={-seg.start}
                      rotation={-90}
                      origin="52,52"
                    />
                  ) : null
                )}
              </Svg>
            </View>
          </Card>
          <View style={styles.legend}>{wallet.sources.map((source, index) => <View key={source.source} style={[styles.legendItem, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.dot, { backgroundColor: tones[index % tones.length] }]} /><Typography variant="caption" numberOfLines={1} style={styles.flex}>{humanizeReason(source.source)}</Typography><Typography variant="mono" color={source.total < 0 ? 'danger' : 'textMuted'}>{formatNumber(source.total)}</Typography></View>)}</View>
          {wallet.sources.length > 0 && <Typography variant="caption" color="textMuted">Net points by source. The ring shows positive balances; deductions appear in the legend.</Typography>}
          <SectionHeader title="Ways to earn" />
          {wallet.opportunities.length === 0 ? <Typography color="textMuted">New opportunities will appear here.</Typography> : <View style={styles.opportunities}>{wallet.opportunities.map(op => <View style={styles.opportunity} key={op.reason}><Card onPress={op.source === 'challenge' || op.source === 'event' ? () => navigation.navigate(op.source === 'challenge' ? 'Challenges' : 'Events') : undefined}>
            <Icon name={sourceIcons[op.source] ?? 'sparkles'} color="primary" size={22} />
            <Typography variant="button" numberOfLines={2}>{op.label}</Typography>
            <Typography variant="mono" color="success">{op.amount == null ? 'Reward varies' : `+${formatNumber(op.amount)} pts`}</Typography>
            {op.expires_after_days != null && <Typography variant="caption" color="textMuted">Expires after {op.expires_after_days} days</Typography>}
          </Card></View>)}</View>}
        </>}
        <SectionHeader title="History" />
        <FilterChips options={filters} value={type} onChange={setType} />
      </View>}
      ListEmptyComponent={!loading && !error ? <EmptyState icon="coins" title="No transactions yet" description="Your points activity will appear here as you participate." /> : null}
      renderItem={({ item, index }) => {
        const day = new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
        const previousDay = index ? new Date(page.transactions[index - 1].created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
        return <View>{day !== previousDay && <Typography variant="label" color="textMuted" style={styles.date}>{day}</Typography>}<View style={[styles.transaction, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name={sourceIcons[item.source] ?? 'coins'} size={20} color={item.amount >= 0 ? 'success' : 'textMuted'} />
          <View style={styles.flex}><Typography variant="button">{humanizeReason(item.reason)}</Typography><View style={styles.meta}><Badge size="sm" label={item.type} variant={item.amount >= 0 ? 'success' : 'muted'} /><Typography variant="caption" color="textMuted">{item.source}</Typography></View></View>
          <View style={styles.amount}><Typography variant="mono" color={item.amount >= 0 ? 'success' : 'danger'}>{item.amount > 0 ? '+' : ''}{formatNumber(item.amount)}</Typography><Typography variant="caption" color="textMuted">bal {formatNumber(item.balance_after)}</Typography></View>
        </View></View>;
      }}
      ListFooterComponent={page.next_cursor && !loading ? <Button label="Load more history" variant="outline" loading={more} onPress={() => void loadMore()} containerStyle={{ marginTop: 20 }} /> : null}
    />
  </View>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20 }, stack: { gap: 16 }, flex: { flex: 1, minWidth: 0 }, balanceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 }, balanceText: { flex: 1, minWidth: 130, gap: 4 }, legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, legendItem: { flexGrow: 1, flexBasis: '46%', minWidth: 120, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 }, dot: { width: 8, height: 8, borderRadius: 4 }, opportunities: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, opportunity: { flexGrow: 1, flexBasis: '46%', minWidth: 128 }, date: { marginTop: 20, marginBottom: 8 }, transaction: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 8 }, meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 }, amount: { alignItems: 'flex-end', maxWidth: '35%', gap: 4 } });
