import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { authorColor } from '../../src/components/AnnouncementCard';
import { Badge } from '../../src/components/Badge';
import { SectionHeader } from '../../src/components/SectionHeader';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { SearchInput } from '../../src/forms/SearchInput';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { withAlpha } from '../../src/theme/colors';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { auctionRepository } from '../../src/repositories/AuctionRepository';
import type { AuctionLot } from '../../src/api/types';
import { formatNumber } from '../../src/utils/format';

type Params = { AuctionLots: { eventRef: string } };
type Tab = 'queued' | 'sold' | 'unsold';

/** v2 Auction · players (43:1243) — queue, sold and unsold lots. */
export default function AuctionLots() {
  const { colors } = useTheme();
  const { eventRef } = useRoute<RouteProp<Params, 'AuctionLots'>>().params;
  const [tab, setTab] = useState<Tab>('queued');
  const [query, setQuery] = useState('');

  const { data, loading, refreshing, error, reload } = useAsyncResource(async () => {
    const [lots, live] = await Promise.all([auctionRepository.lots(eventRef), auctionRepository.live(eventRef).catch(() => null)]);
    return { lots, live };
  }, [eventRef]);

  const teamName = (id: string | null) => (id ? data?.live?.teams.find((t) => t.team_id === id)?.name ?? 'A team' : null);

  const groups = useMemo(() => {
    const lots = data?.lots ?? [];
    return {
      queued: lots.filter((l) => l.status === 'queued').sort((a, b) => a.order - b.order),
      sold: lots.filter((l) => l.status === 'sold').sort((a, b) => (Date.parse(b.closed_at ?? '') || 0) - (Date.parse(a.closed_at ?? '') || 0)),
      unsold: lots.filter((l) => l.status === 'unsold'),
    };
  }, [data?.lots]);

  const onBlock = data?.lots.find((l) => l.status === 'on_block' || l.status === 'settling');
  const q = query.trim().toLowerCase();
  const visible = groups[tab].filter((l) => !q || l.player.display_name.toLowerCase().includes(q));

  const tabs = [
    { label: `Queued ${groups.queued.length}`, value: 'queued' as const },
    { label: `Sold ${groups.sold.length}`, value: 'sold' as const },
    { label: `Unsold ${groups.unsold.length}`, value: 'unsold' as const },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Players" showBackButton showMenuButton={false} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload()} tintColor={colors.primary} />}
      >
        {loading ? (
          <>
            <Skeleton height={44} borderRadius={16} />
            <Skeleton height={72} borderRadius={20} />
            <Skeleton height={320} borderRadius={20} />
          </>
        ) : !data ? (
          <ErrorState title="Couldn’t load players" message={error ?? undefined} onRetry={() => reload()} />
        ) : (
          <>
            <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} />

            {onBlock ? (
              <View style={[styles.card, styles.block, { backgroundColor: colors.dangerMuted, borderColor: withAlpha(colors.danger, 0.4) }]}>
                <Avatar name={onBlock.player.display_name} uri={onBlock.player.avatar_url} size={36} />
                <View style={styles.flex}>
                  <View style={styles.row}>
                    <View style={[styles.dot, { backgroundColor: colors.dangerText }]} />
                    <Typography style={[styles.kicker, { color: colors.dangerText }]}>ON THE BLOCK</Typography>
                  </View>
                  <Typography variant="body" color="text" style={styles.semibold} numberOfLines={1}>
                    {onBlock.player.display_name}
                  </Typography>
                </View>
                <Typography variant="mono" color="text">
                  {formatNumber(onBlock.current_bid ?? onBlock.oc_adjusted_price ?? onBlock.base_price)} cr
                </Typography>
              </View>
            ) : null}

            <SearchInput value={query} onChangeText={setQuery} onSearch={setQuery} placeholder="Search players" />

            {visible.length === 0 ? (
              <EmptyState
                icon="users"
                title={q ? 'No players match' : tab === 'queued' ? 'Queue is empty' : tab === 'sold' ? 'Nobody sold yet' : 'No unsold players'}
                description={q ? 'Try another name.' : 'This list fills in as the auction runs.'}
              />
            ) : tab === 'sold' ? (
              <>
                <SectionHeader title="Sold" />
                <LotList lots={visible} renderRight={(l) => `${formatNumber(l.sold_amount)} cr`} renderTag={(l) => teamName(l.sold_to_team_id)} />
              </>
            ) : (
              <>
                <View style={styles.row}>
                  <Typography color="textMuted" style={[styles.kicker, styles.flex]}>
                    {tab === 'queued' ? 'NEXT UP' : 'UNSOLD'}
                  </Typography>
                  <Typography color="textMuted" style={styles.kicker}>
                    BASE · OC
                  </Typography>
                </View>
                <LotList lots={visible} showOrder renderRight={(l) => formatNumber(l.base_price)} renderSub={(l) => (l.oc_adjusted_price != null ? `OC ${formatNumber(l.oc_adjusted_price)}` : '—')} />
              </>
            )}

            {tab === 'queued' && groups.sold.length ? (
              <View style={styles.section}>
                <SectionHeader title="Recently sold" actionLabel={`All ${groups.sold.length}`} onAction={() => setTab('sold')} />
                <LotList
                  lots={groups.sold.slice(0, 3)}
                  renderRight={(l) => `${formatNumber(l.sold_amount)} cr`}
                  renderTag={(l) => teamName(l.sold_to_team_id)}
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function LotList(props: {
  lots: AuctionLot[];
  showOrder?: boolean;
  renderRight: (l: AuctionLot) => string;
  renderSub?: (l: AuctionLot) => string;
  renderTag?: (l: AuctionLot) => string | null;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {props.lots.map((l, i) => {
        const tag = props.renderTag?.(l);
        return (
          <View
            key={l._id}
            accessible
            accessibilityLabel={`${l.player.display_name}, ${props.renderRight(l)}`}
            style={[styles.listRow, i < props.lots.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
          >
            {props.showOrder ? (
              <Typography variant="mono" color="textMuted" style={styles.order}>
                #{l.order}
              </Typography>
            ) : null}
            <Avatar name={l.player.display_name} uri={l.player.avatar_url} size={36} color={authorColor(l.player.display_name, colors)} />
            <View style={styles.flex}>
              <Typography variant="body" color="text" style={styles.semibold} numberOfLines={1}>
                {l.player.display_name}
              </Typography>
              {tag ? <Badge label={tag} variant="info" size="sm" /> : null}
            </View>
            <View style={styles.right}>
              <Typography variant="mono" color="text">
                {props.renderRight(l)}
              </Typography>
              {props.renderSub ? (
                <Typography variant="mono" color="textMuted" style={styles.tiny}>
                  {props.renderSub(l)}
                </Typography>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  semibold: { fontFamily: FONT_FAMILIES.bodySemiBold },
  tiny: { fontSize: 10, lineHeight: 15 },
  kicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 10, lineHeight: 15, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 16 },
  card: { borderWidth: 1 },
  block: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 20 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  section: { gap: 12 },
  list: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  order: { width: 32, fontSize: 12 },
  right: { alignItems: 'flex-end', gap: 2 },
});
