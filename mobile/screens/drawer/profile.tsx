import { useCallback, useState } from 'react';
import { Share, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ProfileLayout } from '../profile/profile-layout';
import { usersRepository } from '../../src/repositories/UsersRepository';
import { pointsRepository } from '../../src/repositories/PointsRepository';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import { registrationRepository } from '../../src/repositories/RegistrationRepository';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { useAuth } from '../../store/auth';
import { useConfirmLogout } from '../../src/hooks/useConfirmLogout';
import { useResponsive } from '../../src/responsive/useResponsive';
import { Avatar } from '../../src/components/Avatar';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { BottomSheet } from '../../src/components/BottomSheet';
import { Card } from '../../src/components/Card';
import { ListRow } from '../../src/components/ListRow';
import { StatTile } from '../../src/components/StatTile';
import { SectionHeader } from '../../src/components/SectionHeader';
import { Typography } from '../../src/typography/Typography';
import { Skeleton } from '../../src/feedback/Skeleton';
import { ErrorState } from '../../src/feedback/ErrorState';
import { formatNumber, humanizeReason, formatDate, REGISTRATION_STATUS } from '../../src/utils/format';
import { usePopup } from '../../src/popups/PopupProvider';
import { getErrorMessage } from '../../src/api/client';

export default function Profile() {
  const { user } = useAuth();
  const { isCompactPhone } = useResponsive();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const popup = usePopup();
  const confirmLogout = useConfirmLogout();
  const [actions, setActions] = useState(false);
  const ref = route.params?.ref ?? user?.id;
  const isSelf = !route.params?.ref || ref === user?.id || ref === user?.username;
  const profile = useAsyncResource(async () => {
    if (!ref) throw new Error('Sign in to see your player card.');
    const [person, card, summary] = await Promise.all([
      isSelf ? usersRepository.me() : usersRepository.get(ref),
      usersRepository.card(ref),
      isSelf ? pointsRepository.me().catch(() => null) : Promise.resolve(null),
    ]);
    return { person, card, summary };
  }, [ref, isSelf]);
  const activity = useAsyncResource(() => pointsRepository.transactions({ limit: 3 }), [ref], { enabled: isSelf && !!user });
  const registrations = useAsyncResource(() => registrationRepository.mine({ limit: 10 }), [ref], { enabled: isSelf && !!user });
  const picks = useAsyncResource(() => eventsRepository.list({ status: ['upcoming'], limit: 3 }), [], { enabled: isSelf });
  useFocusEffect(useCallback(() => {
    void profile.reload({ silent: true });
    if (isSelf) {
      void activity.reload({ silent: true });
      void registrations.reload({ silent: true });
    }
  }, [ref, isSelf]));
  const refresh = () => {
    void profile.reload();
    if (isSelf) {
      void activity.reload();
      void registrations.reload();
      void picks.reload();
    }
  };
  const person = profile.data?.person;
  const card = profile.data?.card;
  const summary = profile.data?.summary;
  const inputs = card?.stats.inputs;
  const statTileStyle = isCompactPhone ? { flexBasis: '46%' as const } : undefined;
  const go = (name: string) => navigation.navigate(name);
  return <ProfileLayout title="Profile" refreshing={profile.refreshing} onRefresh={refresh}>
    {profile.loading && !card && <Skeleton.Card />}
    {profile.error && <ErrorState message={profile.error} onRetry={() => void profile.reload()} />}
    {person && card && <>
      <Card variant="accent">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}><Badge label={card.card_tier} variant="primary" /><Typography variant="caption" color="textMuted">Rating {card.rating}</Typography></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}><Avatar name={person.profile.full_name || person.username} uri={card.avatar_url} size={76} ring /><View style={{ flex: 1, minWidth: 0 }}><Typography variant="h2" numberOfLines={1}>{person.profile.full_name || person.username}</Typography><Typography variant="caption" color="textMuted" numberOfLines={1}>@{person.username} · {person.role}</Typography></View></View>
        {!!card.bio && <Typography>{card.bio}</Typography>}
        {inputs && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <StatTile value={inputs.participations} caption="events" style={statTileStyle} />
            <StatTile value={inputs.podiums} caption="podiums" style={statTileStyle} />
            <StatTile value={formatNumber(summary?.balance ?? inputs.points_balance)} caption="points" style={statTileStyle} />
            <StatTile value={inputs.challenges} caption="challenges" style={statTileStyle} />
          </View>
        )}
        <Button label="Share card" variant="secondary" leftIcon="share" onPress={() => { void Share.share({ message: `${person.profile.full_name || person.username} (@${person.username}) · ${card.card_tier} · BGSC rating ${card.rating}` }).catch(err => popup.error('Could not share', getErrorMessage(err))); }} />
      </Card>
      <SectionHeader title="Achievements" actionLabel="Hall of Fame" onAction={() => go('HallOfFame')} />
      <Card>
        <ListRow
          icon="trophy"
          title={`${card.card_tier} tier · Rating ${card.rating}`}
          subtitle={inputs?.podiums ? `${inputs.podiums} podium finish${inputs.podiums === 1 ? '' : 'es'} & ${inputs.challenges} completed challenge${inputs.challenges === 1 ? '' : 's'}` : 'Compete in events and challenges to earn badges and climb tiers.'}
          trailing={<Badge label={card.card_tier} variant="primary" />}
        />
      </Card>
      <SectionHeader title="Interests" actionLabel={isSelf ? 'Edit' : undefined} onAction={() => go('EditProfile')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{card.interests.length ? card.interests.map(interest => <Badge key={interest} label={interest} variant="muted" />) : <Typography color="textMuted">No public interests yet.</Typography>}</View>
      {isSelf && <>
        <SectionHeader title="My registrations" actionLabel="Browse events" onAction={() => go('Events')} />
        {registrations.loading && <Skeleton.Card />}{registrations.error && <ErrorState message={registrations.error} onRetry={() => void registrations.reload()} />}
        {registrations.data && (
          <Card>
            {registrations.data.length ? registrations.data.slice(0, 5).map(reg => {
              const statusPill = REGISTRATION_STATUS[reg.status] ?? { label: reg.status, variant: 'muted' as const };
              return (
                <ListRow
                  key={reg._id}
                  icon="calendar"
                  title={`Event registration · ${reg.context?.event?.role ?? 'participant'}`}
                  subtitle={formatDate(reg.submitted_at || reg.created_at)}
                  trailing={<Badge label={statusPill.label} variant={statusPill.variant} />}
                  onPress={() => navigation.navigate('EventDetails', { ref: reg.owner.id })}
                />
              );
            }) : <Typography color="textMuted">You haven’t registered for any events yet.</Typography>}
          </Card>
        )}
        <SectionHeader title="Picked for you" actionLabel="More" onAction={() => go('Events')} />
        {picks.loading && <Skeleton.Card />}{picks.error && <ErrorState message={picks.error} onRetry={() => void picks.reload()} />}
        {picks.data?.events.map(event => <Card key={event._id} onPress={() => navigation.navigate('EventDetails', { ref: event.slug || event._id })}><Typography variant="h3">{event.title}</Typography><Typography variant="caption" color="textMuted">{event.domain} · {formatDate(event.start_at)}</Typography></Card>)}
        {picks.data?.events.length === 0 && <Typography color="textMuted">New events will appear here when announced.</Typography>}
        <SectionHeader title="History" actionLabel="View all" onAction={() => go('Points')} />
        {activity.loading && <Skeleton.Card />}{activity.error && <ErrorState message={activity.error} onRetry={() => void activity.reload()} />}
        <Card>{activity.data?.transactions.length ? activity.data.transactions.map(tx => <ListRow key={tx.id} title={humanizeReason(tx.reason)} subtitle={formatDate(tx.created_at)} trailing={<Typography color={tx.amount >= 0 ? 'success' : 'danger'}>{tx.amount > 0 ? '+' : ''}{formatNumber(tx.amount)}</Typography>} />) : <Typography color="textMuted">No points activity yet.</Typography>}</Card>
        <Card><ListRow title="Account & security" subtitle="Profile, phone and account actions" icon="user" onPress={() => setActions(true)} /><ListRow title="Settings" subtitle="Theme, notifications and privacy" icon="settings" onPress={() => go('Settings')} /><ListRow title="Help & feedback" subtitle="FAQ, contact and your tickets" icon="message" onPress={() => go('Feedback')} /></Card>
        <BottomSheet visible={actions} onClose={() => setActions(false)}>
          <Typography variant="h2">Account & security</Typography>
          <ListRow title="Edit profile" icon="edit" onPress={() => { setActions(false); go('EditProfile'); }} />
          <ListRow
            title="Request my data"
            subtitle="Request a copy of your account data"
            icon="download"
            onPress={() => {
              setActions(false);
              void popup.info('Data export', 'Self-service data export will be enabled in the next release. Contact support via Feedback for an immediate copy.');
            }}
          />
          <ListRow title="Delete account" icon="delete" danger onPress={() => { setActions(false); go('DeleteAccount'); }} />
          <Button label="Log out" variant="destructive" onPress={() => { setActions(false); setTimeout(() => void confirmLogout(), 320); }} />
        </BottomSheet>
      </>}
    </>}
  </ProfileLayout>;
}
