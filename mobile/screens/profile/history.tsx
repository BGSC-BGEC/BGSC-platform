import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { AppHeader } from '../../src/components/AppHeader';
import { Button } from '../../src/components/Button';
import { FilterChips } from '../../src/components/FilterChips';
import { SectionHeader } from '../../src/components/SectionHeader';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { SkeletonCard } from '../../src/feedback/Skeleton';
import { Icon } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useResponsive } from '../../src/responsive/useResponsive';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { getErrorMessage } from '../../src/api/client';
import { pointsRepository } from '../../src/repositories/PointsRepository';
import type { PointsSummary, PointTransactionPage } from '../../src/api/types';
import { formatNumber, humanizeReason } from '../../src/utils/format';

const filters = [{ label: 'All', value: '' }, { label: 'Earned', value: 'earn' }, { label: 'Spent', value: 'spend' }, { label: 'Refunds', value: 'refund' }, { label: 'Expired', value: 'expire' }];

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

  const hairline = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border };

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <AppHeader title="Points" showBackButton showMenuButton={false} />
    <FlatList data={loading ? [] : page.transactions} keyExtractor={tx => tx.id}
      contentContainerStyle={[styles.content, { paddingHorizontal: Math.max(gutter, 16), paddingTop: 20, paddingBottom: insets.bottom + 32 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
      ListHeaderComponent={<View style={styles.stack}>
        {error && <ErrorState message={error} onRetry={() => void load(true)} />}
        {loading ? <><SkeletonCard /><SkeletonCard /></> : wallet && <>
          {/* Balance straight on the page: the number first, the ring beside it */}
          <View style={styles.balanceRow}>
            <View style={styles.balanceText}>
              <Typography variant="caption" color="textMuted" style={styles.kicker}>TOTAL POINTS</Typography>
              <Typography color="text" style={styles.balance} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatNumber(wallet.summary.balance)}</Typography>
              <Typography color="textMuted" style={styles.balanceSub}>
                {formatNumber(wallet.summary.lifetime_earned)} earned · {formatNumber(Math.abs(wallet.summary.lifetime_spent))} spent
              </Typography>
            </View>
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

          {/* Legend: plain two-column key, no tiles */}
          {wallet.sources.length > 0 && <View>
            <View style={styles.legend}>{wallet.sources.map((source, index) => <View key={source.source} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: tones[index % tones.length] }]} />
              <Typography color="text" numberOfLines={1} style={[styles.flex, styles.small]}>{humanizeReason(source.source)}</Typography>
              <Typography variant="mono" color={source.total < 0 ? 'danger' : 'textMuted'} style={styles.small}>{formatNumber(source.total)}</Typography>
            </View>)}</View>
            <Typography color="textMuted" style={styles.note}>Net points by source. The ring shows sources that added points; deductions appear in the key.</Typography>
          </View>}

          {/* Ways to earn: a plain list, reward on the right */}
          <View style={styles.section}>
            <SectionHeader title="Ways to earn" />
            {wallet.opportunities.length === 0 ? <Typography color="textMuted">New opportunities will appear here.</Typography> : <View>{wallet.opportunities.map((op, i) => {
              const target = op.source === 'challenge' ? 'Challenges' : op.source === 'event' ? 'Events' : null;
              return <Pressable
                key={op.reason}
                onPress={target ? () => navigation.navigate(target) : undefined}
                disabled={!target}
                accessibilityRole={target ? 'button' : undefined}
                style={({ pressed }) => [styles.row, i > 0 && hairline, pressed && styles.pressed]}
              >
                <View style={styles.flex}>
                  <Typography color="text" style={styles.rowTitle} numberOfLines={2}>{op.label}</Typography>
                  {op.expires_after_days != null && <Typography color="textMuted" style={styles.rowSub}>Expires after {op.expires_after_days} days</Typography>}
                </View>
                <Typography variant="mono" color="success" style={styles.reward}>{op.amount == null ? 'Varies' : `+${formatNumber(op.amount)}`}</Typography>
                {target ? <Icon name="chevron-right" size={18} color="textMuted" /> : null}
              </Pressable>;
            })}</View>}
          </View>
        </>}
        <View style={styles.section}>
          <SectionHeader title="History" />
          <FilterChips options={filters} value={type} onChange={setType} />
        </View>
      </View>}
      ListEmptyComponent={!loading && !error ? <EmptyState icon="coins" title="No transactions yet" description="Your points activity will appear here as you participate." /> : undefined}
      renderItem={({ item, index }) => {
        const day = new Date(item.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
        const previousDay = index ? new Date(page.transactions[index - 1].created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
        const firstOfDay = day !== previousDay;
        return <View>
          {firstOfDay && <Typography color="text" style={styles.date}>{day}</Typography>}
          <View style={[styles.row, !firstOfDay && hairline]}>
            <View style={styles.flex}>
              <Typography color="text" style={styles.rowTitle} numberOfLines={1}>{humanizeReason(item.reason)}</Typography>
              <Typography color="textMuted" style={styles.rowSub} numberOfLines={1}>{TYPE_LABELS[item.type] ?? item.type} · {humanizeReason(item.source)}</Typography>
            </View>
            <View style={styles.amount}>
              <Typography variant="mono" color={item.amount >= 0 ? 'success' : 'danger'} style={styles.amountValue}>{item.amount > 0 ? '+' : ''}{formatNumber(item.amount)}</Typography>
              <Typography color="textMuted" style={styles.rowSub}>{formatNumber(item.balance_after)} after</Typography>
            </View>
          </View>
        </View>;
      }}
      ListFooterComponent={page.next_cursor && !loading ? <Button label="Load more history" variant="ghost" loading={more} onPress={() => void loadMore()} containerStyle={{ marginTop: 12 }} /> : undefined}
    />
  </View>;
}

const TYPE_LABELS: Record<string, string> = { earn: 'Earned', spend: 'Spent', refund: 'Refund', adjust: 'Adjustment', expire: 'Expired' };

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  stack: { gap: 28 },
  section: { gap: 10 },
  flex: { flex: 1, minWidth: 0 },
  small: { fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.6 },
  kicker: { letterSpacing: 1.2 },
  balanceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16 },
  balanceText: { flex: 1, minWidth: 130 },
  balance: { fontFamily: FONT_FAMILIES.hero, fontSize: 52, lineHeight: 60, marginTop: 2 },
  balanceSub: { fontSize: 13.5, lineHeight: 19 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 20, rowGap: 10 },
  legendItem: { flexGrow: 1, flexBasis: '42%', minWidth: 120, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  note: { fontSize: 12, lineHeight: 17, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  rowTitle: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 15, lineHeight: 20 },
  rowSub: { fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  reward: { fontWeight: '700' },
  date: { fontFamily: FONT_FAMILIES.bodyBold, fontSize: 14, lineHeight: 19, marginTop: 18, marginBottom: 2 },
  amount: { alignItems: 'flex-end', maxWidth: '35%' },
  amountValue: { fontWeight: '700' },
});
