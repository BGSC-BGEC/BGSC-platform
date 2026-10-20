import React, { useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput as RNTextInput, View } from 'react-native';
import { StackActions, useNavigation, useRoute, type NavigationProp, type ParamListBase, type RouteProp } from '@react-navigation/native';

import { AppHeader } from '../../src/components/AppHeader';
import { Avatar } from '../../src/components/Avatar';
import { authorColor } from '../../src/components/AnnouncementCard';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { SearchInput } from '../../src/forms/SearchInput';
import { EmptyState } from '../../src/feedback/EmptyState';
import { ErrorState } from '../../src/feedback/ErrorState';
import { Skeleton } from '../../src/feedback/Skeleton';
import { Icon } from '../../src/icons/Icon';
import { Typography } from '../../src/typography/Typography';
import { FONT_FAMILIES } from '../../src/theme/typography';
import { useTheme } from '../../src/theme/ThemeProvider';
import { usePopup } from '../../src/popups/PopupProvider';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import { registrationRepository } from '../../src/repositories/RegistrationRepository';
import { getErrorMessage } from '../../src/api/client';
import type { Team } from '../../src/api/types';

type Params = { TeamJoin: { eventId: string; code?: string } };
type Mode = 'browse' | 'code';
const MODES: Array<{ label: string; value: Mode }> = [
  { label: 'Browse teams', value: 'browse' },
  { label: 'Join by code', value: 'code' },
];
const CODE_LENGTH = 8;

/** v2 Join a team (40:1058) — for registered members of team events. */
export default function TeamJoin() {
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { eventId: eventRef, code: initialCode } = useRoute<RouteProp<Params, 'TeamJoin'>>().params;
  const popup = usePopup();
  const [mode, setMode] = useState<Mode>(initialCode ? 'code' : 'browse');
  const [query, setQuery] = useState('');
  const [code, setCode] = useState((initialCode ?? '').replace(/[^0-9a-f]/gi, '').toUpperCase().slice(0, CODE_LENGTH));
  const [busy, setBusy] = useState<string | null>(null);

  const { data, loading, refreshing, error, reload } = useAsyncResource(async () => {
    const event = await eventsRepository.get(eventRef);
    const [teams, registration] = await Promise.all([
      registrationRepository.teamsForEvent(event._id, 'all').catch(() => [] as Team[]),
      eventsRepository.myRegistration(eventRef).catch(() => null),
    ]);
    return { event, teams, registration };
  }, [eventRef]);

  const teams = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.teams ?? []).filter((t) => {
      if (t.status !== 'forming') return false;
      if (!q) return true;
      const captain = t.members.find((m) => m.user_id === t.captain_user_id)?.display_name ?? '';
      return t.name.toLowerCase().includes(q) || captain.toLowerCase().includes(q);
    });
  }, [data?.teams, query]);

  const joined = async (team: Team) => {
    await popup.success(`You’re on ${team.name}`, 'Your captain can see you on the roster now.');
    navigation.goBack();
  };

  const join = async (team: Team) => {
    setBusy(team._id);
    try {
      await joined(await registrationRepository.joinTeam(team._id));
    } catch (err) {
      await popup.error('Couldn’t join', getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const joinByCode = async () => {
    setBusy('code');
    try {
      await joined(await registrationRepository.joinTeamByCode(code));
    } catch (err) {
      await popup.error('Code didn’t work', getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const event = data?.event;
  const confirmed = data?.registration?.status === 'confirmed';
  // Captains run their own team; only confirmed members can join one.
  const isCaptain = data?.registration?.context.event?.role === 'captain';
  const canJoin = confirmed && !isCaptain && !data?.event.auction;
  const size = event?.teaming;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Join a team" showBackButton showMenuButton={false} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload()} tintColor={colors.primary} />}
      >
        {loading ? (
          <>
            <Skeleton height={68} borderRadius={20} />
            <Skeleton height={140} borderRadius={20} />
            <Skeleton height={140} borderRadius={20} />
          </>
        ) : !event ? (
          <ErrorState title="Couldn’t load teams" message={error ?? undefined} onRetry={() => reload()} />
        ) : (
          <>
            <View style={[styles.card, styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.iconTile, { backgroundColor: colors.infoMuted }]}>
                <Icon name="zap" size={18} color="info" />
              </View>
              <View style={styles.flex}>
                <Typography variant="body" color="text" style={styles.semibold} numberOfLines={1}>
                  {event.title}
                </Typography>
                <Typography variant="bodySmall" color="textMuted">
                  Teams of {size?.team_size_min ?? '?'}–{size?.team_size_max ?? '?'}
                  {size?.max_teams ? ` · ${data?.teams.filter((t) => t.status !== 'disbanded').length ?? 0} / ${size.max_teams} teams` : ''}
                </Typography>
              </View>
            </View>

            {isCaptain || (confirmed && event.auction) ? (
              <View style={[styles.card, styles.notice, { backgroundColor: colors.infoMuted, borderColor: colors.info }]}>
                <Icon name="trophy" size={18} color="info" />
                <View style={styles.flex}>
                  <Typography color="text" style={[styles.semibold, styles.small]}>
                    {isCaptain ? 'You’re registered as a captain' : 'Teams are picked at the auction'}
                  </Typography>
                  <Typography variant="bodySmall" color="textMuted">
                    {isCaptain
                      ? 'Captains build their own team. Share your invite code from the event page instead.'
                      : 'Captains bid for players live — you’ll land on a team when you’re sold.'}
                  </Typography>
                </View>
              </View>
            ) : !confirmed ? (
              <View style={[styles.card, styles.notice, { backgroundColor: colors.warningMuted, borderColor: colors.warning }]}>
                <Icon name="lock" size={18} color="warning" />
                <View style={styles.flex}>
                  <Typography color="text" style={[styles.semibold, styles.small]}>
                    {data?.registration ? 'Waiting on your registration' : 'Register first'}
                  </Typography>
                  <Typography variant="bodySmall" color="textMuted">
                    {data?.registration
                      ? 'You can join a team once your registration is confirmed.'
                      : 'Only registered players can join a team for this event.'}
                  </Typography>
                </View>
                {!data?.registration ? (
                  <Button
                    label="Register"
                    size="sm"
                    onPress={() => navigation.dispatch(StackActions.replace('EventRegistration', { eventId: event.slug || event._id, role: 'member' }))}
                  />
                ) : null}
              </View>
            ) : null}

            <SegmentedTabs tabs={MODES} value={mode} onChange={setMode} />

            {mode === 'browse' ? (
              <>
                <SearchInput value={query} onChangeText={setQuery} onSearch={setQuery} placeholder="Search teams or captains" />
                {teams.length === 0 ? (
                  <EmptyState
                    icon="users"
                    title={query ? 'No teams match' : 'No teams forming yet'}
                    description={query ? 'Try another name.' : 'Captains are still setting up. Check back soon, or ask yours for an invite code.'}
                  />
                ) : (
                  teams.map((t) => (
                    <TeamCard key={t._id} team={t} canJoin={canJoin} busy={busy === t._id} locked={busy != null} onJoin={() => join(t)} />
                  ))
                )}
              </>
            ) : (
              <View style={[styles.card, styles.codeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Typography color="textMuted" style={styles.kicker}>
                  HAVE AN INVITE CODE?
                </Typography>
                <CodeCells value={code} onChange={setCode} />
                <Button
                  label="Join team"
                  fullWidth
                  disabled={!canJoin || code.length !== CODE_LENGTH || (busy != null && busy !== 'code')}
                  loading={busy === 'code'}
                  onPress={joinByCode}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function TeamCard({ team, canJoin, busy, locked, onJoin }: { team: Team; canJoin: boolean; busy: boolean; locked: boolean; onJoin: () => void }) {
  const { colors } = useTheme();
  const captain = team.members.find((m) => m.user_id === team.captain_user_id)?.display_name ?? 'TBA';
  const full = team.size_max != null && team.members.length >= team.size_max;
  const pill = full
    ? { label: 'Full', variant: 'muted' as const }
    : team.join_policy === 'open'
      ? { label: 'Open', variant: 'success' as const }
      : { label: team.join_policy === 'invite_only' ? 'Invite only' : 'Closed', variant: 'muted' as const };
  return (
    <View style={[styles.card, styles.team, { backgroundColor: colors.surface, borderColor: colors.border, opacity: full ? 0.55 : 1 }]}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Typography variant="h3" color="text" numberOfLines={1}>
            {team.name}
          </Typography>
          <Typography variant="bodySmall" color="textMuted">
            Captain · {captain}
          </Typography>
        </View>
        <Badge label={pill.label} variant={pill.variant} />
      </View>
      <View style={styles.row}>
        <View style={styles.avatars}>
          {team.members.slice(0, 5).map((m, i) => (
            <Avatar
              key={m.user_id}
              name={m.display_name}
              uri={m.avatar_url}
              size={26}
              color={authorColor(m.display_name, colors)}
              style={[styles.stacked, { marginLeft: i === 0 ? 0 : -8, borderColor: colors.surface }]}
            />
          ))}
        </View>
        <Typography variant="mono" color="textMuted" style={[styles.flex, styles.monoSmall]}>
          {team.members.length}
          {team.size_max ? ` / ${team.size_max}` : ''} players
        </Typography>
        {!full && team.join_policy === 'open' ? (
          <Button label="Join" onPress={onJoin} loading={busy} disabled={!canJoin || (locked && !busy)} style={styles.joinBtn} />
        ) : !full ? (
          <Typography variant="bodySmall" color="textMuted">
            Ask for the code
          </Typography>
        ) : null}
      </View>
    </View>
  );
}

/** Eight boxes over one hidden input — letters and digits, auto-uppercased. */
function CodeCells({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { colors } = useTheme();
  const input = useRef<RNTextInput>(null);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Invite code">
      <View style={styles.cells}>
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const active = focused && i === Math.min(value.length, CODE_LENGTH - 1);
          return (
            <View
              key={i}
              style={[
                styles.cell,
                { backgroundColor: colors.surfaceInner, borderColor: active ? colors.primary : 'transparent' },
              ]}
            >
              <Typography variant="mono" color="text" style={styles.cellText}>
                {value[i] ?? ''}
              </Typography>
            </View>
          );
        })}
      </View>
      <RNTextInput
        ref={input}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^0-9a-f]/gi, '').toUpperCase().slice(0, CODE_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={CODE_LENGTH}
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  semibold: { fontFamily: FONT_FAMILIES.bodySemiBold },
  small: { fontSize: 13 },
  monoSmall: { fontSize: 12 },
  kicker: { fontFamily: FONT_FAMILIES.bodySemiBold, fontSize: 11, lineHeight: 15, letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 16 },
  card: { borderWidth: 1 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 20 },
  iconTile: { padding: 8, borderRadius: 12 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16 },
  team: { gap: 16, padding: 16, borderRadius: 20 },
  avatars: { flexDirection: 'row' },
  stacked: { borderWidth: 2 },
  joinBtn: { minWidth: 100 },
  codeCard: { gap: 16, padding: 16, borderRadius: 20 },
  cells: { flexDirection: 'row', gap: 6 },
  cell: { flex: 1, aspectRatio: 0.85, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 18 },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
