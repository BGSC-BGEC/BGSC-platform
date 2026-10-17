import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { Badge, type BadgeVariant } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Spinner } from '../../src/feedback/Spinner';
import { Typography } from '../../src/typography/Typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { usePopup } from '../../src/popups/PopupProvider';
import { BidConfirmPopup } from '../../src/popups/BidConfirmPopup';
import { PopupShell } from '../../src/popups/PopupShell';
import { useAuth } from '../../store/auth';
import { auctionRepository, minimumBid } from '../../src/repositories/AuctionRepository';
import { ApiError, getErrorMessage } from '../../src/api/client';
import type { AuctionLiveState, AuctionLot, AuctionStatus, LotStatus } from '../../src/api/types';
import { formatNumber, formatRelative } from '../../src/utils/format';

type Tab = 'live' | 'players' | 'mine';

const POLL_MS = 1000;

const AUCTION_STATUS: Record<AuctionStatus, { label: string; variant: BadgeVariant }> = {
  not_started: { label: 'Not started', variant: 'muted' },
  live: { label: 'Live now', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  finished: { label: 'Finished', variant: 'primary' },
};

const LOT_STATUS: Record<LotStatus, { label: string; variant: BadgeVariant }> = {
  queued: { label: 'Up next', variant: 'muted' },
  on_block: { label: 'On the block', variant: 'success' },
  settling: { label: 'Settling', variant: 'warning' },
  sold: { label: 'Sold', variant: 'primary' },
  unsold: { label: 'Unsold', variant: 'danger' },
};

interface LastResult {
  lot: AuctionLot;
  teamName: string | null;
}

export default function Auction() {
  const { colors } = useTheme();
  const route = useRoute<any>();
  const popup = usePopup();
  const { user } = useAuth();
  const eventRef: string = route.params?.eventRef;

  const [tab, setTab] = useState<Tab>('live');
  const [live, setLive] = useState<AuctionLiveState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [receivedAt, setReceivedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const [lots, setLots] = useState<AuctionLot[] | null>(null);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [historyLot, setHistoryLot] = useState<AuctionLot | null>(null);

  const [bidAmount, setBidAmount] = useState<number | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [bidding, setBidding] = useState(false);

  const previousLotId = useRef<string | null>(null);
  const teamsRef = useRef<AuctionLiveState['teams']>([]);

  const myTeam = useMemo(
    () => live?.teams.find((t) => t.captain_user_id === user?.id) ?? null,
    [live?.teams, user?.id],
  );
  const teamName = useCallback(
    (teamId?: string | null) => (teamId ? live?.teams.find((t) => t.team_id === teamId)?.name ?? 'Unknown team' : null),
    [live?.teams],
  );

  // ---------------------------------------------------------------- polling
  const announceResult = useCallback(
    async (lotId: string) => {
      try {
        const lot = await auctionRepository.lot(lotId);
        if (lot.status !== 'sold' && lot.status !== 'unsold') return;
        const winner = lot.sold_to_team_id ? teamsRef.current.find((t) => t.team_id === lot.sold_to_team_id)?.name ?? null : null;
        setLastResult({ lot, teamName: winner });
        if (lot.status === 'sold') {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const mine = teamsRef.current.find((t) => t.team_id === lot.sold_to_team_id)?.captain_user_id === user?.id;
          if (mine) {
            void popup.success(
              `${lot.player.display_name} joins your team!`,
              `You won the bidding at ${formatNumber(lot.sold_amount)} credits.`,
            );
          }
        }
      } catch {
        // Result card is a nice-to-have; ignore failures.
      }
    },
    [popup, user?.id],
  );

  const poll = useCallback(async () => {
    try {
      const state = await auctionRepository.live(eventRef);
      teamsRef.current = state.teams;
      const currentId = state.active_lot?.lot_id ?? null;
      if (previousLotId.current && previousLotId.current !== currentId) {
        void announceResult(previousLotId.current);
      }
      previousLotId.current = currentId;
      setLive(state);
      setReceivedAt(Date.now());
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [eventRef, announceResult]);

  useFocusEffect(
    useCallback(() => {
      void poll();
      const pollTimer = setInterval(() => void poll(), POLL_MS);
      const clock = setInterval(() => setNow(Date.now()), 250);
      return () => {
        clearInterval(pollTimer);
        clearInterval(clock);
      };
    }, [poll]),
  );

  const loadLots = useCallback(async () => {
    setLotsLoading(true);
    try {
      setLots(await auctionRepository.lots(eventRef));
    } catch (err) {
      void popup.error('Could not load players', getErrorMessage(err));
    } finally {
      setLotsLoading(false);
    }
  }, [eventRef, popup]);

  useEffect(() => {
    if (tab !== 'live') void loadLots();
  }, [tab, loadLots]);

  // ------------------------------------------------------------- derived
  const lot = live?.active_lot ?? null;
  const secondsLeft =
    lot?.seconds_remaining != null ? Math.max(0, Math.ceil(lot.seconds_remaining - (now - receivedAt) / 1000)) : null;
  const minBid = lot && live ? minimumBid(lot, live.config.min_bid_increment) : 0;
  const isHighest = Boolean(lot?.current_bidder && myTeam && lot.current_bidder.team_id === myTeam.team_id);
  const isSelf = lot?.player.user_id === user?.id;
  const isPaused = live?.status === 'paused';
  const canBid =
    Boolean(myTeam) && live?.status === 'live' && lot?.status === 'on_block' && !isHighest && !isSelf && (secondsLeft ?? 1) > 0;

  // Keep the bid amount at or above the current minimum.
  useEffect(() => {
    setBidAmount((prev) => (prev == null || prev < minBid ? minBid : prev));
  }, [minBid, lot?.lot_id]);

  const placeBid = async () => {
    if (!lot || bidAmount == null) return;
    setBidding(true);
    try {
      await auctionRepository.bid(lot.lot_id, bidAmount, lot.version);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setConfirmVisible(false);
      await poll();
    } catch (err) {
      setConfirmVisible(false);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      await poll();
      const title = err instanceof ApiError && err.code === 'conflict_concurrent_bid' ? 'Outbid!' : 'Bid not placed';
      await popup.error(title, getErrorMessage(err));
    } finally {
      setBidding(false);
    }
  };

  const myBids = useMemo(() => {
    if (!lots || !user) return [];
    return lots
      .flatMap((l) => l.bids.filter((b) => b.bidder_user_id === user.id).map((b) => ({ bid: b, lot: l })))
      .sort((a, b) => new Date(b.bid.placed_at).getTime() - new Date(a.bid.placed_at).getTime());
  }, [lots, user]);

  // --------------------------------------------------------------- render
  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
        <AppHeader title="Live auction" showBackButton showMenuButton={false} />
        <View style={styles.content}>
          <Skeleton height={140} borderRadius={24} />
          <Skeleton.Card />
          <Skeleton.Card />
        </View>
      </SafeAreaView>
    );
  }

  if (!live) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
        <AppHeader title="Live auction" showBackButton showMenuButton={false} />
        <ErrorState title="Auction unavailable" message={error ?? undefined} onRetry={() => void poll()} />
      </SafeAreaView>
    );
  }

  const status = AUCTION_STATUS[live.status];
  const increment = live.config.min_bid_increment;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <AppHeader title="Live auction" showBackButton showMenuButton={false} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          tab !== 'live' ? (
            <RefreshControl refreshing={lotsLoading} onRefresh={() => void loadLots()} tintColor={colors.accent} />
          ) : undefined
        }
      >
        <View style={[styles.hero, { backgroundColor: colors.accentMuted }]}>
          <View style={styles.heroRow}>
            <Badge label={status.label} variant={status.variant} />
            {myTeam ? <Badge label={`Captain · ${myTeam.name}`} variant="primary" /> : <Badge label="Spectating" variant="muted" />}
          </View>
          <Typography variant="displayTitle">{live.title}</Typography>
          <Typography variant="body" color="textMuted">
            {live.status === 'finished'
              ? 'The auction is complete. Final squads and spending are below.'
              : `${live.config.captains_count} captains are drafting registered players. Each bid resets the ${live.config.bid_timer_seconds}s timer.`}
          </Typography>
        </View>

        {error ? <Typography variant="caption" color="warning">Connection unstable — retrying…</Typography> : null}

        <SegmentedTabs
          tabs={[
            { label: 'Live', value: 'live' },
            { label: 'Players', value: 'players' },
            ...(myTeam ? [{ label: 'My bids', value: 'mine' as const }] : []),
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'live' ? (
          <>
            {lastResult ? (
              <Card variant={lastResult.lot.status === 'sold' ? 'accent' : 'solid'}>
                <Card.Header
                  title={lastResult.lot.status === 'sold' ? 'SOLD!' : 'Unsold'}
                  subtitle="Previous lot"
                  rightAction={<Badge {...LOT_STATUS[lastResult.lot.status]} />}
                />
                <View style={styles.playerRow}>
                  <Avatar name={lastResult.lot.player.display_name} uri={lastResult.lot.player.avatar_url} size={44} />
                  <View style={styles.flex}>
                    <Typography variant="h3">{lastResult.lot.player.display_name}</Typography>
                    <Typography variant="caption" color="textMuted">
                      {lastResult.lot.status === 'sold'
                        ? `${lastResult.teamName ?? 'A team'} · ${formatNumber(lastResult.lot.sold_amount)} credits`
                        : 'No bids — returns to the pool'}
                    </Typography>
                  </View>
                </View>
              </Card>
            ) : null}

            {lot ? (
              <Card variant="accent">
                <Card.Header
                  title={lot.status === 'settling' ? 'Settling…' : isPaused ? 'On the block · paused' : 'Currently on the block'}
                  rightAction={
                    isPaused ? (
                      <Badge label="Paused" variant="warning" icon="pause" />
                    ) : (
                      <Typography variant="h2" color={secondsLeft != null && secondsLeft <= 5 ? 'danger' : 'accent'}>
                        {secondsLeft != null ? `${secondsLeft}s` : '—'}
                      </Typography>
                    )
                  }
                />
                <Card.Body>
                  <View style={styles.playerRow}>
                    <Avatar name={lot.player.display_name} uri={lot.player.avatar_url} size={56} />
                    <View style={styles.flex}>
                      <Typography variant="h1">{lot.player.display_name}</Typography>
                      <Typography variant="body" color="textMuted">
                        Lot #{lot.order} · Base price {formatNumber(lot.oc_adjusted_price ?? lot.base_price)} credits
                      </Typography>
                    </View>
                  </View>
                  <View style={styles.currentBid}>
                    <Typography variant="caption" color="textMuted">CURRENT BID</Typography>
                    <Typography variant="h1" color="accent">
                      {lot.current_bid != null ? `${formatNumber(lot.current_bid)} credits` : 'No bids yet'}
                    </Typography>
                    <Typography variant="body" color="textMuted">
                      {lot.current_bidder
                        ? `${teamName(lot.current_bidder.team_id)}${isHighest ? ' (you)' : ''}`
                        : `Opening bid ${formatNumber(minBid)} credits`}
                    </Typography>
                  </View>
                </Card.Body>
              </Card>
            ) : (
              <Card variant="inner">
                <EmptyState
                  icon="hourglass-outline"
                  title={live.status === 'finished' ? 'Auction complete' : live.status === 'paused' ? 'Auction paused' : 'Waiting for the next player'}
                  description={
                    live.status === 'not_started'
                      ? 'The auctioneer has not started yet. This screen updates automatically.'
                      : live.status === 'finished'
                        ? 'Every lot has been settled.'
                        : 'The next player will appear here as soon as the admin puts them on the block.'
                  }
                />
              </Card>
            )}

            {myTeam && lot && live.status !== 'finished' ? (
              <Card variant="solid">
                <Card.Header
                  title="Place a bid"
                  subtitle={`${formatNumber(myTeam.purse_remaining)} credits left · ${myTeam.members_count}${myTeam.size_max ? `/${myTeam.size_max}` : ''} players`}
                />
                {isPaused ? (
                  <Typography variant="body" color="warning">
                    The auctioneer has paused bidding. You can bid as soon as it resumes — this screen updates on its own.
                  </Typography>
                ) : isHighest ? (
                  <Typography variant="body" color="success">You hold the highest bid. Hold tight!</Typography>
                ) : isSelf ? (
                  <Typography variant="body" color="textMuted">You cannot bid on yourself.</Typography>
                ) : (
                  <>
                    <View style={styles.stepper}>
                      <Button
                        label="−"
                        variant="secondary"
                        size="sm"
                        disabled={!canBid || (bidAmount ?? 0) - increment < minBid}
                        onPress={() => setBidAmount((v) => Math.max(minBid, (v ?? minBid) - increment))}
                        accessibilityLabel="Decrease bid"
                      />
                      <View style={styles.flexCenter}>
                        <Typography variant="h2" color="accent">{formatNumber(bidAmount ?? minBid)}</Typography>
                        <Typography variant="caption" color="textMuted">min {formatNumber(minBid)}</Typography>
                      </View>
                      <Button
                        label="+"
                        variant="secondary"
                        size="sm"
                        disabled={!canBid}
                        onPress={() => setBidAmount((v) => (v ?? minBid) + increment)}
                        accessibilityLabel="Increase bid"
                      />
                    </View>
                    <View style={styles.quickRow}>
                      {[1, 2, 5].map((mult) => (
                        <Button
                          key={mult}
                          label={`+${formatNumber(increment * mult)}`}
                          size="sm"
                          variant="outline"
                          disabled={!canBid}
                          onPress={() => setBidAmount(minBid + increment * (mult - 1))}
                        />
                      ))}
                    </View>
                    <Button
                      label={canBid ? `Bid ${formatNumber(bidAmount ?? minBid)} credits` : live.status === 'live' ? 'Bidding closed for this lot' : 'Auction not live'}
                      fullWidth
                      disabled={!canBid || (bidAmount ?? minBid) > myTeam.purse_remaining}
                      onPress={() => setConfirmVisible(true)}
                    />
                    {(bidAmount ?? minBid) > myTeam.purse_remaining ? (
                      <Typography variant="bodySmall" color="danger">This bid is more than your remaining purse.</Typography>
                    ) : null}
                  </>
                )}
              </Card>
            ) : null}

            {lot ? (
              <Card variant="solid">
                <Card.Header title="Live bid log" rightAction={<Badge label={`${lot.recent_bids.length} bids`} variant="muted" />} />
                {lot.recent_bids.length === 0 ? (
                  <Typography variant="body" color="textMuted">No bids yet for this player.</Typography>
                ) : (
                  lot.recent_bids.map((bid, index) => (
                    <View key={bid.bid_id} style={[styles.bidRow, { borderBottomColor: colors.border }]}>
                      <View style={styles.flex}>
                        <Typography variant="body">{teamName(bid.team_id)}</Typography>
                        <Typography variant="caption" color="textMuted">
                          {index === 0 ? 'Leading · ' : ''}
                          {formatRelative(bid.placed_at)}
                        </Typography>
                      </View>
                      <Typography variant="h3" color={index === 0 ? 'accent' : 'textMuted'}>{formatNumber(bid.amount)} credits</Typography>
                    </View>
                  ))
                )}
              </Card>
            ) : null}

            <Card variant="solid">
              <Card.Header title="Team purses" />
              {live.teams.length === 0 ? (
                <Typography variant="body" color="textMuted">Teams appear once captains are approved.</Typography>
              ) : (
                live.teams.map((team) => {
                  const pct = team.purse_total > 0 ? Math.min(1, team.purse_spent / team.purse_total) : 0;
                  return (
                    <View key={team.team_id} style={styles.walletRow}>
                      <View style={styles.walletHeader}>
                        <Typography variant="body" color={team.team_id === myTeam?.team_id ? 'accent' : 'text'}>{team.name}</Typography>
                        <Typography variant="caption" color="textMuted">{formatNumber(team.purse_remaining)} credits left</Typography>
                      </View>
                      <View style={[styles.track, { backgroundColor: colors.surfaceInner }]}>
                        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: colors.accent }]} />
                      </View>
                      <Typography variant="caption" color="textMuted">
                        {team.members_count}{team.size_max ? `/${team.size_max}` : ''} players · {formatNumber(team.purse_spent)} spent
                      </Typography>
                    </View>
                  );
                })
              )}
            </Card>
          </>
        ) : null}

        {tab === 'players' ? (
          lots === null ? (
            <Spinner style={styles.spinner} />
          ) : lots.length === 0 ? (
            <Card variant="inner">
              <EmptyState icon="people-outline" title="No players yet" description="Players appear here once the admin builds the auction pool." />
            </Card>
          ) : (
            <Card variant="solid">
              <Card.Header title="Auction pool" subtitle="Tap a player to see their bid history" rightAction={<Badge label={`${lots.length}`} variant="muted" />} />
              {lots.map((l) => (
                <Pressable
                  key={l._id}
                  onPress={() => setHistoryLot(l)}
                  style={({ pressed }) => [styles.lotRow, { borderBottomColor: colors.border }, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Typography variant="mono" color="textMuted" style={styles.order}>#{l.order}</Typography>
                  <Avatar name={l.player.display_name} uri={l.player.avatar_url} size={32} />
                  <View style={styles.flex}>
                    <Typography variant="body" numberOfLines={1}>{l.player.display_name}</Typography>
                    <Typography variant="caption" color="textMuted" numberOfLines={1}>
                      {l.status === 'sold'
                        ? `${teamName(l.sold_to_team_id)} · ${formatNumber(l.sold_amount)}`
                        : `Base ${formatNumber(l.oc_adjusted_price ?? l.base_price)}`}
                    </Typography>
                  </View>
                  <Badge size="sm" {...LOT_STATUS[l.status]} />
                </Pressable>
              ))}
            </Card>
          )
        ) : null}

        {tab === 'mine' ? (
          lots === null ? (
            <Spinner style={styles.spinner} />
          ) : myBids.length === 0 ? (
            <Card variant="inner">
              <EmptyState icon="hammer-outline" title="No bids yet" description="Bids you place as captain will be listed here." />
            </Card>
          ) : (
            <Card variant="solid">
              <Card.Header title="My bids" rightAction={<Badge label={`${myBids.length}`} variant="muted" />} />
              {myBids.map(({ bid, lot: l }) => {
                const won = l.status === 'sold' && l.sold_to_team_id === bid.team_id && l.sold_amount === bid.amount;
                const leading = (l.status === 'on_block' || l.status === 'settling') && l.current_bid === bid.amount;
                return (
                  <View key={bid.bid_id} style={[styles.bidRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.flex}>
                      <Typography variant="body">{l.player.display_name}</Typography>
                      <Typography variant="caption" color="textMuted">{formatRelative(bid.placed_at)}</Typography>
                    </View>
                    <View style={styles.alignEnd}>
                      <Typography variant="h3" color="accent">{formatNumber(bid.amount)}</Typography>
                      <Badge
                        size="sm"
                        label={won ? 'Won' : leading ? 'Leading' : l.status === 'queued' ? 'Pending' : 'Outbid'}
                        variant={won ? 'success' : leading ? 'primary' : 'muted'}
                      />
                    </View>
                  </View>
                );
              })}
            </Card>
          )
        ) : null}
      </ScrollView>

      {lot && myTeam ? (
        <BidConfirmPopup
          visible={confirmVisible}
          playerName={lot.player.display_name}
          amount={bidAmount ?? minBid}
          purseRemaining={myTeam.purse_remaining}
          secondsRemaining={secondsLeft}
          submitting={bidding}
          onConfirm={() => void placeBid()}
          onCancel={() => setConfirmVisible(false)}
        />
      ) : null}

      <PopupShell
        visible={historyLot !== null}
        onRequestClose={() => setHistoryLot(null)}
        title={historyLot?.player.display_name ?? ''}
        message={historyLot ? `${LOT_STATUS[historyLot.status].label} · ${historyLot.bids.length} bids` : undefined}
      >
        <ScrollView style={styles.historyScroll}>
          {historyLot?.bids.length ? (
            [...historyLot.bids].reverse().map((bid) => (
              <View key={bid.bid_id} style={[styles.bidRow, { borderBottomColor: colors.border }]}>
                <View style={styles.flex}>
                  <Typography variant="body">{teamName(bid.team_id)}</Typography>
                  <Typography variant="caption" color="textMuted">{formatRelative(bid.placed_at)}</Typography>
                </View>
                <Typography variant="h3" color="accent">{formatNumber(bid.amount)}</Typography>
              </View>
            ))
          ) : (
            <Typography variant="body" color="textMuted">No bids were placed on this player.</Typography>
          )}
        </ScrollView>
        <Button label="Close" variant="outline" fullWidth onPress={() => setHistoryLot(null)} />
      </PopupShell>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  hero: { padding: 20, borderRadius: 24, gap: 10 },
  heroRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  flex: { flex: 1, gap: 2 },
  flexCenter: { flex: 1, alignItems: 'center' },
  alignEnd: { alignItems: 'flex-end', gap: 4 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  currentBid: { gap: 4, marginTop: 18 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  quickRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  bidRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  walletRow: { paddingVertical: 8, gap: 6 },
  walletHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  lotRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  order: { width: 32 },
  pressed: { opacity: 0.7 },
  spinner: { paddingVertical: 32 },
  historyScroll: { maxHeight: 320 },
});
