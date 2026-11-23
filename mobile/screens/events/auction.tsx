import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { authorColor } from '../../src/components/AnnouncementCard';
import { Badge } from '../../src/components/Badge';
import { BottomSheet } from '../../src/components/BottomSheet';
import { Button } from '../../src/components/Button';
import { CountdownRing } from '../../src/components/CountdownRing';
import { SectionHeader } from '../../src/components/SectionHeader';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Icon, type IconName } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { withAlpha, type UIThemeColors } from '../../src/theme/colors';
import { useAuth } from '../../store/auth';
import { auctionRepository, minimumBid } from '../../src/repositories/AuctionRepository';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import { ApiError, getErrorMessage } from '../../src/api/client';
import type { ApiEvent, AuctionLiveState, AuctionLot } from '../../src/api/types';
import { countdown, formatNumber, timeAgo } from '../../src/utils/format';

// The live endpoint is cached ~750ms server-side; 2s keeps us well inside the gateway's 100 req/min.
const POLL_MS = 2000;
const FEEDBACK_MS = 6000;
const RESULT_MS = 3500;

type Params = { Auction: { eventRef: string } };
type Tone = 'success' | 'danger' | 'warning' | 'info';
interface Feedback {
  tone: Tone;
  icon: IconName;
  title: string;
  body: string;
}
type ActiveLot = NonNullable<AuctionLiveState['active_lot']>;
interface PendingBid {
  lotId: string;
  version: number;
  amount: number;
  player: ActiveLot['player'];
  leaderName: string | null;
  leadingBid: number | null;
}

/** Bid errors → the v2 inline feedback cards (42:1210). */
function feedbackFor(err: unknown, ctx: { purse: number; teamName: string; size: string; minBid: number; timerOut: boolean }): Feedback {
  const code = err instanceof ApiError ? err.code : '';
  // The server answers a bid after the hammer with the same CAS conflict as a race; tell them apart by the clock.
  if (ctx.timerOut && ['conflict_concurrent_bid', 'lot_changed_retry', 'lot_conflict'].includes(code)) {
    return { tone: 'warning', icon: 'clock', title: 'Too late', body: 'The timer ran out before your bid landed.' };
  }
  switch (code) {
    case 'insufficient_purse':
      return { tone: 'danger', icon: 'coins', title: 'Not enough purse', body: `You have ${formatNumber(ctx.purse)} cr. Lower your bid or skip this lot.` };
    case 'conflict_concurrent_bid':
    case 'lot_changed_retry':
    case 'lot_conflict':
      return { tone: 'warning', icon: 'zap', title: 'Someone bid at the same time', body: 'Price refreshed — check the new minimum and bid again.' };
    case 'team_roster_full':
      return { tone: 'danger', icon: 'users', title: 'Roster full', body: `${ctx.teamName} has ${ctx.size} players. You can’t bid on more lots.` };
    case 'bid_below_minimum':
      return { tone: 'info', icon: 'lock', title: 'Below the minimum', body: `Next valid bid is ${formatNumber(ctx.minBid)} cr.` };
    case 'cannot_bid_on_self':
      return { tone: 'info', icon: 'user', title: 'That’s you on the block', body: 'You can’t bid on yourself — sit back and watch your price.' };
    case 'already_highest_bidder':
      return { tone: 'success', icon: 'check', title: 'You already lead', body: 'Wait for another captain to raise before bidding again.' };
    case 'auction_not_live':
    case 'lot_not_on_block':
      return { tone: 'warning', icon: 'clock', title: 'Bidding closed', body: 'This lot isn’t open for bids right now.' };
    default:
      return { tone: 'danger', icon: 'activity', title: 'Bid not placed', body: getErrorMessage(err) };
  }
}

function toneColors(tone: Tone, colors: UIThemeColors) {
  const c = tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.info;
  return { fg: tone === 'danger' ? colors.dangerText : c, bg: withAlpha(c, 0.16), border: withAlpha(c, 0.45) };
}

/** v2 Live auction (41:1158) with states (42:1210), confirm sheet (41:1309) and lot result (42:1311). */
export default function Auction() {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { eventRef } = useRoute<RouteProp<Params, 'Auction'>>().params;
  const { user } = useAuth();

  const [live, setLive] = useState<AuctionLiveState | null>(null);
  const [event, setEvent] = useState<ApiEvent | null>(null);
  const [totalLots, setTotalLots] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [receivedAt, setReceivedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [bidAmount, setBidAmount] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingBid | null>(null);
  const [bidding, setBidding] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [result, setResult] = useState<{ lot: AuctionLot; teamName: string | null; purseLeft: number | null; next: ActiveLot | null } | null>(null);

  const previousLotId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const pollAgain = useRef(false);
  const focused = useRef(false);
  const lastLotId = useRef<string | null>(null);
  // The SOLD! reveal is a Modal too — only present it once the confirm sheet's Modal is gone (iOS).
  const [sheetGone, setSheetGone] = useState(true);
  const teamsRef = useRef<AuctionLiveState['teams']>([]);
  const nextRef = useRef<ActiveLot | null>(null);

  useEffect(() => {
    eventsRepository.get(eventRef).then(setEvent).catch(() => undefined);
    auctionRepository
      .lots(eventRef)
      .then((l) => setTotalLots(l.length))
      .catch(() => undefined);
  }, [eventRef]);

  useEffect(() => {
    if (!feedback) return undefined;
    const t = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [feedback]);

  // Count the on-screen time only once the reveal is actually showing (after the sheet is gone).
  useEffect(() => {
    if (!result || !sheetGone) return undefined;
    const t = setTimeout(() => setResult(null), RESULT_MS);
    return () => clearTimeout(t);
  }, [result, sheetGone]);

  const announceResult = useCallback(async (lotId: string) => {
    try {
      const lot = await auctionRepository.lot(lotId);
      if (lot.status !== 'sold' && lot.status !== 'unsold') return;
      const winner = lot.sold_to_team_id ? teamsRef.current.find((t) => t.team_id === lot.sold_to_team_id) ?? null : null;
      setResult({ lot, teamName: winner?.name ?? null, purseLeft: winner?.purse_remaining ?? null, next: nextRef.current });
      void Haptics.notificationAsync(
        lot.status === 'sold' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
      );
    } catch {
      // The reveal is a nice-to-have.
    }
  }, []);

  const poll = useCallback(async () => {
    // One request at a time: a slow response must never land after a newer one.
    if (inFlight.current) {
      // Something (e.g. a bid) needs fresh state: run once more when this poll lands.
      pollAgain.current = true;
      return;
    }
    inFlight.current = true;
    try {
      const state = await auctionRepository.live(eventRef);
      teamsRef.current = state.teams;
      const currentId = state.active_lot?.lot_id ?? null;
      nextRef.current = state.active_lot;
      // A poll that lands after blur must not seed the reveal for lots that close while we're away.
      if (focused.current) {
        if (previousLotId.current && previousLotId.current !== currentId) void announceResult(previousLotId.current);
        previousLotId.current = currentId;
      }
      setLive(state);
      setReceivedAt(Date.now());
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      inFlight.current = false;
      setLoading(false);
      if (pollAgain.current) {
        pollAgain.current = false;
        void poll();
      }
    }
  }, [eventRef, announceResult]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      void poll();
      const pollTimer = setInterval(() => void poll(), POLL_MS);
      const clock = setInterval(() => setNow(Date.now()), 250);
      return () => {
        clearInterval(pollTimer);
        clearInterval(clock);
        // Lots that closed while we were away shouldn't replay their reveal on return.
        focused.current = false;
        pollAgain.current = false;
        previousLotId.current = null;
      };
    }, [poll]),
  );

  const isApprovedCaptain = !!user && !!event?.auction?.captain_user_ids.includes(user.id);
  const myTeam = useMemo(() => live?.teams.find((t) => t.captain_user_id === user?.id) ?? null, [live?.teams, user?.id]);
  const teamName = useCallback(
    (id?: string | null) => (id ? live?.teams.find((t) => t.team_id === id)?.name ?? 'A team' : null),
    [live?.teams],
  );

  const lot = live?.active_lot ?? null;
  const increment = live?.config.min_bid_increment ?? 1;
  const secondsLeft =
    lot?.seconds_remaining != null ? Math.max(0, Math.ceil(lot.seconds_remaining - (now - receivedAt) / 1000)) : null;
  const minBid = lot && live ? minimumBid(lot, increment) : 0;
  const isHighest = !!(lot?.current_bidder && myTeam && lot.current_bidder.team_id === myTeam.team_id);
  const isSelf = lot?.player.user_id === user?.id;
  const rosterFull = !!(myTeam?.size_max && myTeam.members_count >= myTeam.size_max);
  const canBid =
    !!myTeam && live?.status === 'live' && lot?.status === 'on_block' && !isHighest && !isSelf && !rosterFull && (secondsLeft ?? 1) > 0;
  const amount = Math.max(bidAmount ?? minBid, minBid);

  // A new lot starts at its minimum; a raise by someone else only lifts us to the new minimum.
  useEffect(() => {
    const newLot = lot?.lot_id !== lastLotId.current;
    lastLotId.current = lot?.lot_id ?? null;
    setBidAmount((prev) => (newLot || prev == null || prev < minBid ? minBid : prev));
  }, [minBid, lot?.lot_id]);

  // The confirm sheet is frozen to the lot it was opened for — close it if that lot moves on.
  useEffect(() => {
    if (pending && lot?.lot_id !== pending.lotId) {
      setPending(null);
      setFeedback({ tone: 'warning', icon: 'clock', title: 'That lot closed', body: 'The auction moved to the next player before your bid went in.' });
    }
  }, [lot?.lot_id, pending]);

  const openConfirm = () => {
    if (!lot) return;
    setSheetGone(false);
    setPending({
      lotId: lot.lot_id,
      version: lot.version,
      amount,
      player: lot.player,
      leaderName: teamName(lot.current_bidder?.team_id),
      leadingBid: lot.current_bid,
    });
  };

  const placeBid = async () => {
    if (!pending) return;
    setBidding(true);
    try {
      await auctionRepository.bid(pending.lotId, pending.amount, pending.version);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFeedback({
        tone: 'success',
        icon: 'check',
        title: 'You hold the highest bid',
        body: `${formatNumber(pending.amount)} cr on ${pending.player.display_name}. Hang tight.`,
      });
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFeedback(
        feedbackFor(err, {
          purse: myTeam?.purse_remaining ?? 0,
          teamName: myTeam?.name ?? 'Your team',
          size: `${myTeam?.members_count ?? 0} / ${myTeam?.size_max ?? '?'}`,
          minBid,
          timerOut: lot?.seconds_remaining != null && lot.seconds_remaining - (Date.now() - receivedAt) / 1000 <= 0,
        }),
      );
    } finally {
      setPending(null);
      setBidding(false);
      void poll();
    }
  };

  const bids = useMemo(
    () => [...(lot?.recent_bids ?? [])].sort((a, b) => Date.parse(b.placed_at) - Date.parse(a.placed_at)),
    [lot?.recent_bids],
  );

  if (loading || !live) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title="Live auction" showBackButton showMenuButton={false} />
        <View style={[styles.content, styles.gap]}>
          {loading ? (
            <>
              <Skeleton height={28} borderRadius={14} />
              <Skeleton height={260} borderRadius={24} />
              <Skeleton height={240} borderRadius={24} />
            </>
          ) : (
            <ErrorState title="Auction unavailable" message={error ?? undefined} onRetry={() => poll()} />
          )}
        </View>
      </View>
    );
  }

  const statusPill =
    live.status === 'live'
      ? { label: 'LIVE', tone: colors.dangerText, bg: colors.dangerMuted }
      : live.status === 'paused'
        ? { label: 'PAUSED', tone: colors.warning, bg: colors.warningMuted }
        : live.status === 'finished'
          ? { label: 'FINISHED', tone: colors.textMuted, bg: colors.mutedTint }
          : { label: 'NOT STARTED', tone: colors.info, bg: colors.infoMuted };
  const startsIn = countdown(event?.start_at);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Live auction" showBackButton showMenuButton={false} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status line: the status pill (it is a status), lot counter, and a link to bids/players */}
        <View style={styles.row}>
          <View style={[styles.pill, { backgroundColor: statusPill.bg }]}>
            {live.status === 'live' ? <View style={[styles.dot, { backgroundColor: colors.dangerText }]} /> : null}
            <Typography style={[styles.pillText, { color: statusPill.tone }]}>{statusPill.label}</Typography>
          </View>
          <Typography variant="mono" color="textMuted" style={[styles.flex, styles.mono12]} numberOfLines={1}>
            {lot ? `Lot ${lot.order}${totalLots ? ` / ${totalLots}` : ''}` : live.title}
          </Typography>
          <Pressable
            onPress={() => navigation.navigate(myTeam ? 'MyBids' : 'AuctionLots', { eventRef })}
            accessibilityRole="button"
            accessibilityLabel={myTeam ? `${myTeam.name}: my bids` : 'All players'}
            hitSlop={12}
            style={({ pressed }) => [styles.headerLink, pressed && styles.pressed]}
          >
            <Typography color="primary" style={[styles.linkText, styles.shrink]} numberOfLines={1}>
              {myTeam ? 'My bids' : 'Players'}
            </Typography>
            <Icon name="chevron-right" size={16} color="primary" />
          </Pressable>
        </View>

        {error ? (
          <Typography accessibilityRole="alert" style={[styles.small, { color: colors.warning }]}>
            Connection unstable — retrying…
          </Typography>
        ) : null}

        {live.status === 'not_started' ? (
          <View style={styles.center}>
            <Typography color="textMuted" style={styles.kicker}>
              AUCTION STARTS IN
            </Typography>
            <Typography color="text" style={styles.bigClock} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {startsIn || 'moments'}
            </Typography>
            <Typography variant="bodySmall" color="textMuted" align="center">
              {totalLots ?? '—'} players in the pool · {live.config.captains_count} captains approved
            </Typography>
          </View>
        ) : null}

        {live.status === 'paused' ? (
          <Notice
            tone="warning"
            icon="clock"
            title="Auction paused by the desk"
            body={`Timer frozen${lot ? ` on Lot ${lot.order}` : ''}. Bids resume when the desk restarts.`}
          />
        ) : null}

        {feedback ? <Notice {...feedback} /> : null}

        {/* On the block: the focal point — player, timer, then the current bid as the biggest number on screen */}
        {lot ? (
          <View style={styles.block}>
            <View style={styles.row}>
              <Avatar name={lot.player.display_name} uri={lot.player.avatar_url} size={64} />
              <View style={styles.flex}>
                <Typography color="primary" style={styles.kicker}>
                  {lot.status === 'settling' ? 'SETTLING…' : 'ON THE BLOCK'}
                </Typography>
                <Typography color="text" style={styles.playerName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {lot.player.display_name}
                </Typography>
                <Typography variant="bodySmall" color="textMuted">
                  {isSelf ? 'That’s you!' : `Lot #${lot.order}`}
                </Typography>
              </View>
              {live.status === 'live' ? <CountdownRing seconds={secondsLeft} total={live.config.bid_timer_seconds} /> : null}
            </View>

            <View>
              <Typography color="textMuted" style={styles.kicker}>
                {lot.current_bid != null ? 'CURRENT BID' : 'OPENING AT'}
              </Typography>
              <View style={[styles.row, styles.alignEnd, styles.gap8]}>
                <Typography color="text" style={[styles.bid, styles.shrink]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {formatNumber(lot.current_bid ?? minBid)}
                </Typography>
                <Typography variant="mono" color="textMuted" style={styles.cr}>
                  cr
                </Typography>
              </View>
              {lot.current_bidder ? (
                <Typography color="textMuted" style={styles.leadingLine} numberOfLines={1}>
                  Leading ·{' '}
                  <Typography style={[styles.semibold, { color: isHighest ? colors.success : colors.text }]}>
                    {isHighest ? 'You' : teamName(lot.current_bidder.team_id) ?? 'A team'}
                  </Typography>
                </Typography>
              ) : null}
            </View>

            {/* Lot facts: plain columns with hairline dividers, no tiles */}
            <View style={styles.statsRow}>
              {[
                [formatNumber(lot.base_price), 'Base'],
                [lot.oc_adjusted_price != null ? formatNumber(lot.oc_adjusted_price) : '—', 'OC-adjusted'],
                [`+${formatNumber(increment)}`, 'Min raise'],
              ].map(([v, l], i) => (
                <React.Fragment key={l}>
                  {i > 0 ? <View style={[styles.statDivider, { backgroundColor: colors.border }]} /> : null}
                  <View style={styles.stat}>
                    <Typography color="text" style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {v}
                    </Typography>
                    <Typography color="textMuted" style={styles.tiny}>
                      {l}
                    </Typography>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>
        ) : live.status !== 'not_started' ? (
          <EmptyState
            icon={live.status === 'finished' ? 'trophy' : 'clock'}
            title={live.status === 'finished' ? 'Auction complete' : 'Waiting for the next player'}
            description={
              live.status === 'finished'
                ? 'Every lot is settled. Squads are below.'
                : 'The next player appears here as soon as the desk puts them on the block.'
            }
          />
        ) : null}

        {/* Captain panel, or the spectator note */}
        {myTeam && live.status !== 'finished' ? (
          <View style={[styles.panel, { borderTopColor: colors.border }]}>
            <View style={[styles.row, styles.alignBaseline]}>
              <Typography color="text" style={[styles.panelTitle, styles.flex]} numberOfLines={1}>
                {myTeam.name}
              </Typography>
              <Typography color="textMuted" style={styles.small}>
                <Typography color="text" style={styles.purseValue}>
                  {formatNumber(myTeam.purse_remaining)}
                </Typography>
                {` / ${formatNumber(myTeam.purse_total)} cr`}
              </Typography>
            </View>
            <View style={[styles.track, { backgroundColor: colors.surfaceInner }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${myTeam.purse_total ? (myTeam.purse_remaining / myTeam.purse_total) * 100 : 0}%`, backgroundColor: colors.primary },
                ]}
              />
            </View>
            <Typography variant="bodySmall" color="textMuted">
              Roster {myTeam.members_count}
              {myTeam.size_max ? ` / ${myTeam.size_max}` : ''}
              {event?.teaming.team_size_min && myTeam.members_count < event.teaming.team_size_min
                ? ` · need ${event.teaming.team_size_min - myTeam.members_count} more to field a side`
                : ''}
            </Typography>

            {isHighest ? (
              <Notice tone="success" icon="check" title="You hold the highest bid" body={`${formatNumber(lot?.current_bid)} cr — wait for a raise.`} />
            ) : isSelf ? (
              <Notice tone="info" icon="user" title="That’s you on the block" body="You can’t bid on yourself — sit back and watch your price." />
            ) : rosterFull ? (
              <Notice tone="danger" icon="users" title="Roster full" body={`${myTeam.name} can’t take more players.`} />
            ) : (
              <>
                <View style={styles.row}>
                  <StepButton
                    label="−"
                    disabled={!canBid || amount - increment < minBid}
                    onPress={() => setBidAmount(Math.max(minBid, amount - increment))}
                  />
                  <View style={[styles.flex, styles.centerItems]}>
                    <Typography color="text" style={styles.yourBid} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                      {formatNumber(amount)}
                    </Typography>
                    <Typography color="textMuted" style={styles.tiny}>
                      your bid · cr
                    </Typography>
                  </View>
                  <StepButton label="+" disabled={!canBid} onPress={() => setBidAmount(amount + increment)} />
                </View>
                <View style={styles.row}>
                  {[1, 2, 4, 8].map((k) => {
                    const target = minBid + increment * (k - 1);
                    const selected = amount === target;
                    return (
                      <Pressable
                        key={k}
                        onPress={() => setBidAmount(target)}
                        disabled={!canBid}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled: !canBid }}
                        style={[
                          styles.chip,
                          selected
                            ? { backgroundColor: colors.primarySolid, borderColor: colors.primarySolid }
                            : { borderColor: colors.border },
                          !canBid && styles.disabled,
                        ]}
                      >
                        <Typography color={selected ? 'primaryText' : 'text'} style={styles.chipText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                          {lot?.current_bid != null ? `+${formatNumber(increment * k)}` : formatNumber(target)}
                        </Typography>
                      </Pressable>
                    );
                  })}
                </View>
                <Button
                  label={canBid ? `Bid ${formatNumber(amount)} cr` : live.status === 'live' ? 'Bidding closed for this lot' : 'Auction not live'}
                  fullWidth
                  disabled={!canBid || amount > myTeam.purse_remaining}
                  onPress={openConfirm}
                />
                {amount > myTeam.purse_remaining ? (
                  <Typography variant="bodySmall" style={{ color: colors.dangerText }}>
                    That’s more than your remaining purse.
                  </Typography>
                ) : null}
              </>
            )}
          </View>
        ) : !myTeam && live.status !== 'finished' ? (
          <View style={[styles.panel, { borderTopColor: colors.border }]}>
            <View>
              <Typography variant="body" color="text" style={styles.semibold}>
                {isApprovedCaptain ? 'Create your team to bid' : 'You’re spectating'}
              </Typography>
              <Typography variant="bodySmall" color="textMuted">
                {isApprovedCaptain
                  ? 'You’re an approved captain but don’t have a team yet. Create it from the event page.'
                  : 'Only approved captains can bid. The board updates on its own.'}
              </Typography>
            </View>
            {isApprovedCaptain ? (
              <Button label="Go to event" variant="outline" fullWidth onPress={() => navigation.navigate('EventDetails', { eventId: eventRef })} />
            ) : null}
          </View>
        ) : null}

        {/* Bid log */}
        {lot ? (
          <View style={styles.section}>
            <SectionHeader title="Bid log" actionLabel="All lots" onAction={() => navigation.navigate('AuctionLots', { eventRef })} />
            {bids.length === 0 ? (
              <Typography variant="bodySmall" color="textMuted">
                No bids yet for this player.
              </Typography>
            ) : (
              <View>
                {bids.map((b, i) => {
                  const name = teamName(b.team_id) ?? 'A team';
                  const mine = b.team_id === myTeam?.team_id;
                  const leading = i === 0 && lot.current_bidder?.team_id === b.team_id;
                  return (
                    <View
                      key={b.bid_id}
                      style={[styles.listRow, i < bids.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                    >
                      <Avatar name={name} size={32} color={authorColor(name, colors)} />
                      <View style={styles.flex}>
                        <Typography color={leading ? 'text' : 'textMuted'} style={[styles.semibold, styles.small]} numberOfLines={1}>
                          {name}
                          {mine ? ' (you)' : ''}
                        </Typography>
                        <Typography color="textMuted" style={styles.tiny}>
                          {leading ? 'Leading · ' : ''}
                          {timeAgo(b.placed_at)}
                        </Typography>
                      </View>
                      <Typography color={leading ? 'text' : 'textMuted'} style={styles.rowAmount} numberOfLines={1}>
                        {formatNumber(b.amount)}
                        <Typography color="textMuted" style={styles.tiny}>
                          {' '}cr
                        </Typography>
                      </Typography>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {/* Team purses: plain rows, purse on the right */}
        {live.teams.length ? (
          <View style={styles.section}>
            <SectionHeader title={live.status === 'finished' ? 'Final squads' : 'Team purses'} />
            <View>
              {live.teams.map((t, i) => (
                <View
                  key={t.team_id}
                  style={[styles.listRow, i < live.teams.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
                >
                  <View style={[styles.teamDot, { backgroundColor: authorColor(t.name, colors) }]} />
                  <View style={styles.flex}>
                    <Typography color="text" style={[styles.semibold, styles.small]} numberOfLines={1}>
                      {t.name}
                      {t.team_id === myTeam?.team_id ? ' (you)' : ''}
                    </Typography>
                    <Typography color="textMuted" style={styles.tiny}>
                      {t.members_count} {t.members_count === 1 ? 'player' : 'players'}
                    </Typography>
                  </View>
                  <Typography color="text" style={styles.rowAmount} numberOfLines={1}>
                    {formatNumber(t.purse_remaining)}
                    <Typography color="textMuted" style={styles.tiny}>
                      {' '}cr
                    </Typography>
                  </Typography>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Confirm bid — frozen to the lot it was opened for */}
      <BottomSheet visible={!!pending} onClose={() => !bidding && setPending(null)} onClosed={() => setSheetGone(true)}>
        {pending ? (
          <View style={styles.sheet}>
            <View style={styles.row}>
              <Avatar name={pending.player.display_name} uri={pending.player.avatar_url} size={48} />
              <View style={styles.flex}>
                <Typography color="textMuted" style={styles.kicker}>
                  CONFIRM BID
                </Typography>
                <Typography color="text" style={styles.sheetName} numberOfLines={1}>
                  {pending.player.display_name}
                </Typography>
              </View>
              <CountdownRing seconds={secondsLeft} total={live.config.bid_timer_seconds} size={44} stroke={3} />
            </View>
            <View style={styles.amountBox}>
              <Typography color="text" style={styles.sheetAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {formatNumber(pending.amount)} cr
              </Typography>
              {pending.leadingBid != null && pending.leaderName ? (
                <Typography variant="mono" color="success" style={styles.mono12}>
                  +{formatNumber(pending.amount - pending.leadingBid)} over {pending.leaderName}
                </Typography>
              ) : (
                <Typography variant="mono" color="success" style={styles.mono12}>
                  Opening bid
                </Typography>
              )}
            </View>
            {myTeam ? (
              <View>
                {[
                  ['Purse', `${formatNumber(myTeam.purse_remaining)} → ${formatNumber(myTeam.purse_remaining - pending.amount)} cr`],
                  ['Roster', `${myTeam.members_count} → ${myTeam.members_count + 1}${myTeam.size_max ? ` of ${myTeam.size_max}` : ''}`],
                ].map(([l, v], i) => (
                  <View key={l} style={[styles.sheetRow, i === 0 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                    <Typography variant="body" color="textMuted" style={styles.flex}>
                      {l}
                    </Typography>
                    <Typography variant="mono" color="text" style={styles.mono13}>
                      {v}
                    </Typography>
                  </View>
                ))}
              </View>
            ) : null}
            <Typography variant="bodySmall" color="textMuted" align="center">
              Bids are final. If someone outbids you, your purse is untouched.
            </Typography>
            <View style={styles.row}>
              <Button label="Cancel" variant="outline" disabled={bidding} onPress={() => setPending(null)} containerStyle={styles.flex} />
              <Button label="Place bid" loading={bidding} onPress={placeBid} containerStyle={styles.flex} />
            </View>
          </View>
        ) : null}
      </BottomSheet>

      <ResultReveal result={sheetGone ? result : null} onDismiss={() => setResult(null)} />
    </View>
  );
}

function StepButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Raise bid' : 'Lower bid'}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={({ pressed }) => [
        styles.stepBtn,
        { borderColor: colors.border },
        (pressed || disabled) && styles.disabled,
      ]}
    >
      <Typography color="text" style={styles.stepText}>
        {label}
      </Typography>
    </Pressable>
  );
}

/**
 * Inline bid feedback: no tinted box or icon tile — a coloured rule on the left carries the tone.
 * `icon` stays in the data (Feedback) for callers, but isn't drawn.
 */
function Notice({ tone, title, body }: { tone: Tone; icon?: IconName; title: string; body?: string }) {
  const { colors } = useTheme();
  const t = toneColors(tone, colors);
  return (
    <View accessibilityRole="alert" style={styles.notice}>
      <View style={[styles.noticeRule, { backgroundColor: t.fg }]} />
      <View style={styles.flex}>
        <Typography color="text" style={[styles.semibold, styles.small]}>
          {title}
        </Typography>
        {body ? (
          <Typography variant="bodySmall" color="textMuted">
            {body}
          </Typography>
        ) : null}
      </View>
    </View>
  );
}

// Confetti keeps to the side gutters of the top band so it never sits on the text.
const CONFETTI = Array.from({ length: 24 }, (_, i) => ({
  left: `${i % 2 ? 82 + ((i * 7) % 14) : 2 + ((i * 11) % 14)}%` as `${number}%`,
  top: (i * 53) % 360,
  rotate: `${(i * 47) % 180}deg`,
  w: 6 + (i % 3) * 3,
}));

/** Full-screen SOLD! reveal, or a compact unsold card, between lots (42:1311). Tap or wait to dismiss. */
function ResultReveal({
  result,
  onDismiss,
}: {
  result: { lot: AuctionLot; teamName: string | null; purseLeft: number | null; next: ActiveLot | null } | null;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Short phones (SE-class): tighten the reveal so the next-lot card still fits.
  const compact = useWindowDimensions().height < 760;
  if (!result) return null;
  const { lot } = result;
  const sold = lot.status === 'sold';
  const base = lot.oc_adjusted_price ?? lot.base_price;
  const over = sold && lot.sold_amount != null && base ? Math.round(((lot.sold_amount - base) / base) * 100) : null;
  const confettiColors = [colors.primary, colors.success, colors.info, colors.warning, colors.text];
  const next = result.next ? (
    <View style={[styles.revealNext, { borderTopColor: colors.border }]}>
      <Avatar name={result.next.player.display_name} uri={result.next.player.avatar_url} size={40} />
      <View style={styles.flex}>
        <Typography color="textMuted" style={styles.revealKicker}>
          NEXT LOT
        </Typography>
        <Typography color="text" style={[styles.semibold, styles.small]} numberOfLines={1}>
          {result.next.player.display_name}
        </Typography>
      </View>
      <Icon name="chevron-right" size={18} color="textMuted" />
    </View>
  ) : null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <Pressable
        style={[
          styles.reveal,
          compact && styles.revealCompact,
          { backgroundColor: colors.background, paddingTop: insets.top + (compact ? 20 : 52), justifyContent: sold ? 'flex-start' : 'center' },
        ]}
        onPress={onDismiss}
        accessibilityLabel="Dismiss result"
      >
        {sold ? (
          <>
            <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none">
              <Defs>
                {/* Theme colours only: the old fixed browns/near-black left a dark band in light mode. */}
                <LinearGradient id="reveal" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.primary} stopOpacity={0.35} />
                  <Stop offset="0.55" stopColor={colors.background} />
                  <Stop offset="1" stopColor={colors.background} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#reveal)" />
            </Svg>
            {CONFETTI.map((c, i) => (
              <View
                key={i}
                style={[
                  styles.confetti,
                  { left: c.left, top: insets.top + c.top, width: c.w, backgroundColor: confettiColors[i % confettiColors.length], transform: [{ rotate: c.rotate }] },
                ]}
              />
            ))}
            <Typography color="textMuted" style={styles.revealKicker}>
              LOT {lot.order}
            </Typography>
            <Typography style={[styles.sold, { color: colors.primary, ...(compact ? styles.soldCompact : {}) }]}>SOLD!</Typography>
            <View style={[styles.revealAvatar, { borderColor: colors.text }]}>
              <Avatar name={lot.player.display_name} uri={lot.player.avatar_url} size={compact ? 64 : 96} />
            </View>
            <Typography color="text" style={styles.revealName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {lot.player.display_name}
            </Typography>
            <View style={styles.revealCard}>
              <View style={[styles.row, styles.alignEnd]}>
                <View style={styles.flex}>
                  <Typography color="textMuted" style={styles.revealKicker}>
                    JOINS
                  </Typography>
                  <Typography color="text" style={styles.revealTeam} numberOfLines={1}>
                    {result.teamName ?? 'A team'}
                  </Typography>
                </View>
                <View style={styles.alignRight}>
                  <Typography color="text" style={styles.revealAmount} numberOfLines={1}>
                    {formatNumber(lot.sold_amount)} cr
                  </Typography>
                  {over != null ? (
                    <Typography variant="mono" color="success" style={styles.tiny}>
                      {over >= 0 ? '+' : ''}
                      {over}% over base {formatNumber(base)}
                    </Typography>
                  ) : null}
                </View>
              </View>
              <View style={[styles.statsRow, { borderTopColor: colors.border }, styles.revealStats]}>
                {[
                  [String(lot.bids.length), 'bids'],
                  [formatNumber(base), 'base cr'],
                  [result.purseLeft != null ? formatNumber(result.purseLeft) : '—', 'purse left'],
                ].map(([value, label], i) => (
                  <React.Fragment key={label}>
                    {i > 0 ? <View style={[styles.statDivider, { backgroundColor: colors.border }]} /> : null}
                    <View style={styles.stat}>
                      <Typography color="text" style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                        {value}
                      </Typography>
                      <Typography color="textMuted" style={styles.tiny}>
                        {label}
                      </Typography>
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </View>
            {next}
          </>
        ) : (
          <>
            <View style={styles.revealCard}>
              <View style={styles.row}>
                <Avatar name={lot.player.display_name} uri={lot.player.avatar_url} size={44} style={styles.muted} />
                <View style={styles.flex}>
                  <Typography color="text" style={styles.semibold} numberOfLines={1}>
                    {lot.player.display_name} — unsold
                  </Typography>
                  <Typography variant="bodySmall" color="textMuted">
                    No bids at {formatNumber(base)} cr. Back in the pool for the next round.
                  </Typography>
                </View>
                <Badge label="Unsold" variant="muted" />
              </View>
            </View>
            {next}
          </>
        )}
        <Typography variant="bodySmall" color="textMuted">
          Tap anywhere to continue
        </Typography>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  gap: { gap: 16 },
  gap8: { gap: 8 },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  semibold: { fontFamily: FONT_FAMILIES.bodySemiBold },
  small: { fontSize: 13 },
  tiny: { fontSize: 11, lineHeight: 16 },
  mono12: { fontSize: 12 },
  mono13: { fontSize: 13 },
  kicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 10, lineHeight: 15, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alignEnd: { alignItems: 'flex-end' },
  alignRight: { alignItems: 'flex-end' },
  center: { alignItems: 'center' },
  centerItems: { alignItems: 'center' },
  alignBaseline: { alignItems: 'baseline' },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 24 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 10, lineHeight: 15, letterSpacing: 0.8 },
  // 44pt tall tap target, text-only (no tinted pill).
  headerLink: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44, maxWidth: '45%' },
  linkText: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 14, lineHeight: 20 },
  bigClock: { fontFamily: FONT_FAMILIES.hero, fontSize: 48, lineHeight: 56 },
  block: { gap: 20 },
  playerName: { fontFamily: FONT_FAMILIES.hero, fontSize: 28, lineHeight: 34 },
  bid: { fontFamily: FONT_FAMILIES.hero, fontSize: 64, lineHeight: 70 },
  cr: { fontSize: 15, paddingBottom: 10 },
  leadingLine: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  shrink: { flexShrink: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statDivider: { width: StyleSheet.hairlineWidth * 2, height: 28 },
  statValue: { fontFamily: FONT_FAMILIES.hero, fontSize: 18, lineHeight: 22 },
  // Captain panel: a section under a hairline, not a card.
  panel: { gap: 14, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth },
  panelTitle: { fontFamily: FONT_FAMILIES.bodyBold, fontSize: 18, lineHeight: 24 },
  purseValue: { fontFamily: FONT_FAMILIES.hero, fontSize: 18 },
  track: { height: 6, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  // 52pt round steppers (were ~48×44 rounded boxes).
  stepBtn: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: FONT_FAMILIES.bodyBold, fontSize: 22, lineHeight: 26 },
  yourBid: { fontFamily: FONT_FAMILIES.hero, fontSize: 36, lineHeight: 42 },
  chip: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingHorizontal: 4, borderRadius: 999, borderWidth: 1 },
  chipText: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 13, lineHeight: 17 },
  notice: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  noticeRule: { width: 3, borderRadius: 2 },
  section: { gap: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowAmount: { fontFamily: FONT_FAMILIES.hero, fontSize: 17, lineHeight: 22 },
  teamDot: { width: 10, height: 10, borderRadius: 5 },
  sheet: { gap: 16 },
  sheetName: { fontFamily: FONT_FAMILIES.hero, fontSize: 23, lineHeight: 29 },
  amountBox: { alignItems: 'center', gap: 2, paddingVertical: 8 },
  sheetAmount: { fontFamily: FONT_FAMILIES.hero, fontSize: 48, lineHeight: 56 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  reveal: { flex: 1, alignItems: 'center', gap: 24, padding: 24 },
  confetti: { position: 'absolute', height: 14, borderRadius: 2, opacity: 0.85 },
  sold: { fontFamily: FONT_FAMILIES.hero, fontSize: 84, lineHeight: 92 },
  revealAvatar: { borderWidth: 4, borderRadius: 56, padding: 0 },
  revealCompact: { gap: 14 },
  soldCompact: { fontSize: 60, lineHeight: 66 },
  revealKicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 11, lineHeight: 15, letterSpacing: 1.2 },
  revealName: { fontFamily: FONT_FAMILIES.hero, fontSize: 32, lineHeight: 38, alignSelf: 'stretch', textAlign: 'center' },
  revealTeam: { fontFamily: FONT_FAMILIES.bodyBold, fontSize: 18, lineHeight: 24 },
  revealNext: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  muted: { opacity: 0.6 },
  revealCard: { alignSelf: 'stretch', gap: 18 },
  revealStats: { paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  revealAmount: { fontFamily: FONT_FAMILIES.hero, fontSize: 30, lineHeight: 36 },
});
