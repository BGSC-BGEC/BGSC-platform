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
import { Icon } from '../../src/icons/Icon';
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
            <View style={[styles.card, styles.teamCard, { backgroundColor: colors.accentMuted, borderColor: colors.primary }]}>
              <View style={styles.row}>
                <View style={[styles.iconTile, { backgroundColor: colors.accentMuted }]}>
                  <Icon name="gavel" size={20} color="primary" />
                </View>
                <View style={styles.flex}>
                  <Typography variant="h3" color="text" numberOfLines={1}>
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
              <View style={styles.row}>
                {[
                  [formatNumber(myTeam.purse_remaining), 'cr left'],
                  [formatNumber(myTeam.purse_spent), 'cr spent'],
                  [`${myTeam.members_count}${myTeam.size_max ? `/${myTeam.size_max}` : ''}`, 'roster'],
                  [avg != null ? formatNumber(avg) : '—', 'avg cr'],
                ].map(([v, l]) => (
                  <View key={l} style={[styles.stat, { backgroundColor: colors.background }]}>
                    <Typography variant="mono" color="text" style={styles.mono15} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {v}
                    </Typography>
                    <Typography color="textMuted" style={styles.tiny}>
                      {l}
                    </Typography>
                  </View>
                ))}
              </View>
              {minSize && myTeam.members_count < minSize ? (
                <View style={[styles.need, { backgroundColor: colors.warningMuted }]}>
                  <Icon name="users" size={16} color="warning" />
                  <Typography variant="bodySmall" color="text" style={styles.flex}>
                    Still need {minSize - myTeam.members_count} more — {minSize} players minimum to field a side.
                  </Typography>
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <SectionHeader title="Your roster" />
              <View style={[styles.card, styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {roster.length === 0 ? (
                  <Typography variant="body" color="textMuted" style={styles.empty}>
                    No players yet.
                  </Typography>
                ) : (
                  roster.map((m, i) => (
                    <View key={m.user_id} style={[styles.listRow, i < roster.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                      <Avatar name={m.display_name} uri={m.avatar_url} size={36} color={authorColor(m.display_name, colors)} />
                      <View style={styles.flex}>
                        <Typography variant="body" color="text" style={styles.semibold} numberOfLines={1}>
                          {m.display_name}
                        </Typography>
                        <Typography variant="bodySmall" color="textMuted">
                          {m.user_id === user?.id ? 'Captain' : 'Player'}
                        </Typography>
                      </View>
                      {m.user_id === user?.id ? (
                        <Typography variant="mono" color="primary" style={styles.mono13}>
                          Captain
                        </Typography>
                      ) : paidFor.has(m.user_id) ? (
                        <Typography variant="mono" color="text" style={styles.mono13}>
                          {formatNumber(paidFor.get(m.user_id))} cr
                        </Typography>
                      ) : null}
                    </View>
                  ))
                )}
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeader title="Bid history" />
              <View style={[styles.card, styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {history.length === 0 ? (
                  <Typography variant="body" color="textMuted" style={styles.empty}>
                    You haven’t bid yet.
                  </Typography>
                ) : (
                  history.map((h, i) => (
                    <View key={h.lot._id} style={[styles.listRow, i < history.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
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
                          <Typography color="textMuted" style={styles.tiny}>
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
  mono13: { fontSize: 13 },
  mono15: { fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 20 },
  card: { borderWidth: 1 },
  teamCard: { gap: 16, padding: 20, borderRadius: 24 },
  iconTile: { padding: 8, borderRadius: 12 },
  stat: { flex: 1, gap: 2, padding: 12, borderRadius: 16 },
  need: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16 },
  section: { gap: 12 },
  list: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  right: { alignItems: 'flex-end', gap: 4 },
  empty: { paddingVertical: 16 },
});
