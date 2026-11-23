import React, { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';

import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { authorColor } from '../../src/components/AnnouncementCard';
import { Badge } from '../../src/components/Badge';
import { SectionHeader } from '../../src/components/SectionHeader';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useAuth } from '../../store/auth';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { auctionRepository } from '../../src/repositories/AuctionRepository';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import { registrationRepository } from '../../src/repositories/RegistrationRepository';
import { formatNumber } from '../../src/utils/format';

type Params = { MyBids: { eventRef: string } };

/** v2 Auction · my bids (43:1383) — a captain's purse, roster and bid history. */
export default function MyBids() {
  const { colors } = useTheme();
  const { eventRef } = useRoute<RouteProp<Params, 'MyBids'>>().params;
  const { user } = useAuth();

  const { data, loading, refreshing, error, reload } = useAsyncResource(async () => {
    const [live, lots, event] = await Promise.all([
      auctionRepository.live(eventRef),
      auctionRepository.lots(eventRef),
      eventsRepository.get(eventRef).catch(() => null),
    ]);
    const myTeam = live.teams.find((t) => t.captain_user_id === user?.id) ?? null;
    const team = myTeam ? await registrationRepository.getTeam(myTeam.team_id).catch(() => null) : null;
    return { live, lots, event, myTeam, team };
  }, [eventRef, user?.id]);

  const history = useMemo(() => {
    if (!data?.myTeam) return [];
    const mine = data.myTeam.team_id;
    return data.lots
      .filter((l) => l.bids.some((b) => b.team_id === mine))
      .map((l) => {
        const top = Math.max(...l.bids.filter((b) => b.team_id === mine).map((b) => b.amount));
        const won = l.status === 'sold' && l.sold_to_team_id === mine;
        const leading = (l.status === 'on_block' || l.status === 'settling') && l.current_bidder?.team_id === mine;
        const winner = l.sold_to_team_id ? data.live.teams.find((t) => t.team_id === l.sold_to_team_id)?.name : null;
        return { lot: l, top, won, leading, winner };
      })
      .sort((a, b) => b.lot.order - a.lot.order);
  }, [data]);

  const paidFor = useMemo(() => {
    const map = new Map<string, number>();
    data?.lots.forEach((l) => {
      if (l.status === 'sold' && l.sold_to_team_id === data.myTeam?.team_id) map.set(l.player.user_id, l.sold_amount ?? 0);
    });
    return map;
  }, [data]);

  const myTeam = data?.myTeam;
  const minSize = data?.event?.teaming.team_size_min ?? null;
  const roster = data?.team?.members ?? [];
  const bought = roster.filter((m) => paidFor.has(m.user_id));
  const avg = bought.length ? Math.round(bought.reduce((n, m) => n + (paidFor.get(m.user_id) ?? 0), 0) / bought.length) : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="My bids" showBackButton showMenuButton={false} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload()} tintColor={colors.primary} />}
      >
        {loading ? (
          <>
            <Skeleton height={230} borderRadius={24} />
            <Skeleton height={260} borderRadius={20} />
          </>
        ) : !data ? (
          <ErrorState title="Couldn’t load your bids" message={error ?? undefined} onRetry={() => reload()} />
        ) : !myTeam ? (
          <EmptyState icon="gavel" title="You’re not a captain here" description="Only approved captains bid in this auction." />
        ) : (
          <>
            {/* Team header: name, status pill (it is a status), then the purse as the big number */}
            <View style={styles.teamBlock}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Typography color="text" style={styles.teamName} numberOfLines={1}>
                    {myTeam.name}
                  </Typography>
                  <Typography variant="bodySmall" color="textMuted">
                    Captain · you
                  </Typography>
                </View>
                <Badge
                  label={data.live.status === 'live' ? 'Live' : data.live.status === 'finished' ? 'Final' : data.live.status === 'paused' ? 'Paused' : 'Soon'}
                  variant={data.live.status === 'live' ? 'success' : 'muted'}
                />
              </View>
              <View>
                <Typography color="textMuted" style={styles.kicker}>
                  PURSE LEFT
                </Typography>
                <Typography color="text" style={styles.purse} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {formatNumber(myTeam.purse_remaining)}
                  <Typography color="textMuted" style={styles.purseUnit}>
                    {' '}cr
                  </Typography>
                </Typography>
              </View>
              <View style={styles.statsRow}>
                {[
                  [formatNumber(myTeam.purse_spent), 'cr spent'],
                  [`${myTeam.members_count}${myTeam.size_max ? `/${myTeam.size_max}` : ''}`, 'roster'],
                  [avg != null ? formatNumber(avg) : '—', 'avg cr'],
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
              {minSize && myTeam.members_count < minSize ? (
                <View style={styles.need}>
                  <View style={[styles.needRule, { backgroundColor: colors.warning }]} />
                  <Typography variant="bodySmall" color="text" style={styles.flex}>
                    Still need {minSize - myTeam.members_count} more — {minSize} players minimum to field a side.
                  </Typography>
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <SectionHeader title="Your roster" />
              <View>
                {roster.length === 0 ? (
                  <Typography variant="body" color="textMuted" style={styles.empty}>
                    No players yet.
                  </Typography>
                ) : (
                  roster.map((m, i) => (
                    <View key={m.user_id} style={[styles.listRow, i < roster.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                      <Avatar name={m.display_name} uri={m.avatar_url} size={36} color={authorColor(m.display_name, colors)} />
                      <View style={styles.flex}>
                        <Typography variant="body" color="text" style={styles.semibold} numberOfLines={1}>
                          {m.display_name}
                        </Typography>
                        <Typography variant="bodySmall" color={m.user_id === user?.id ? 'primary' : 'textMuted'}>
                          {m.user_id === user?.id ? 'Captain · you' : 'Player'}
                        </Typography>
                      </View>
                      {m.user_id !== user?.id && paidFor.has(m.user_id) ? (
                        <Typography color="text" style={styles.amount} numberOfLines={1}>
                          {formatNumber(paidFor.get(m.user_id))}
                          <Typography color="textMuted" style={styles.tiny}>
                            {' '}cr
                          </Typography>
                        </Typography>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeader title="Bid history" />
              <View>
                {history.length === 0 ? (
                  <Typography variant="body" color="textMuted" style={styles.empty}>
                    You haven’t bid yet.
                  </Typography>
                ) : (
                  history.map((h, i) => (
                    <View key={h.lot._id} style={[styles.listRow, i < history.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
                      <View style={styles.flex}>
                        <Typography variant="body" color="text" style={styles.semibold} numberOfLines={1}>
                          {h.lot.player.display_name}
                        </Typography>
                        <Typography variant="mono" color="textMuted" style={styles.mono12}>
                          Lot {h.lot.order} · {h.won ? formatNumber(h.lot.sold_amount) : `your top ${formatNumber(h.top)}`}
                        </Typography>
                      </View>
                      <View style={styles.right}>
                        <Badge
                          label={h.won ? 'Won' : h.leading ? 'Leading' : h.lot.status === 'sold' ? 'Outbid' : h.lot.status === 'unsold' ? 'Unsold' : 'Outbid'}
                          variant={h.won ? 'success' : h.leading ? 'info' : 'danger'}
                        />
                        {!h.won && h.lot.status === 'sold' ? (
                          <Typography color="textMuted" style={[styles.tiny, styles.winner]} numberOfLines={1}>
                            {formatNumber(h.lot.sold_amount)} by {h.winner ?? 'another team'}
                          </Typography>
                        ) : null}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  semibold: { fontFamily: FONT_FAMILIES.bodySemiBold },
  tiny: { fontSize: 11, lineHeight: 16 },
  mono12: { fontSize: 12 },
  kicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 10, lineHeight: 15, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 28 },
  teamBlock: { gap: 18 },
  teamName: { fontFamily: FONT_FAMILIES.bodyBold, fontSize: 22, lineHeight: 28 },
  purse: { fontFamily: FONT_FAMILIES.hero, fontSize: 56, lineHeight: 62 },
  purseUnit: { fontSize: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 1 },
  statDivider: { width: StyleSheet.hairlineWidth * 2, height: 28 },
  statValue: { fontFamily: FONT_FAMILIES.hero, fontSize: 18, lineHeight: 22 },
  need: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  needRule: { width: 3, borderRadius: 2 },
  amount: { fontFamily: FONT_FAMILIES.hero, fontSize: 17, lineHeight: 22 },
  winner: { maxWidth: 160 },
  section: { gap: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  right: { alignItems: 'flex-end', gap: 4 },
  empty: { paddingVertical: 8 },
});
