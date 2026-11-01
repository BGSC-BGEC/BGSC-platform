import { useCallback, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ProfileLayout } from '../profile/profile-layout';
import { usersRepository } from '../../src/repositories/UsersRepository';
import { pointsRepository } from '../../src/repositories/PointsRepository';
import { eventsRepository } from '../../src/repositories/EventsRepository';
import { registrationRepository } from '../../src/repositories/RegistrationRepository';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { useAuth } from '../../store/auth';
import { useConfirmLogout } from '../../src/hooks/useConfirmLogout';
import { Avatar } from '../../src/components/Avatar';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { BottomSheet } from '../../src/components/BottomSheet';
import { ListRow } from '../../src/components/ListRow';
import { SectionHeader } from '../../src/components/SectionHeader';
import { GlobePattern } from '../../src/components/GlobePattern';
import { Typography } from '../../src/typography/Typography';
import { Icon } from '../../src/icons/Icon';
import { Skeleton } from '../../src/feedback/Skeleton';
import { ErrorState } from '../../src/feedback/ErrorState';
import { formatNumber, formatDate, REGISTRATION_STATUS } from '../../src/utils/format';
import { usePopup } from '../../src/popups/PopupProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { getErrorMessage } from '../../src/api/client';

/**
 * Centered user hero, signature 4-column flight stat counter bar,
 * boarding-pass tier card, and structured account list groups.
 */
export default function Profile() {
  const { colors, shadow } = useTheme();
  const { user } = useAuth();
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

  useFocusEffect(
    useCallback(() => {
      void profile.reload({ silent: true });
      if (isSelf) {
        void activity.reload({ silent: true });
        void registrations.reload({ silent: true });
      }
    }, [ref, isSelf]),
  );

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
  const inputs = card?.stats?.inputs;
  const go = (name: string) => navigation.navigate(name);

  const fullName = person?.profile?.full_name || person?.username || 'Player';

  return (
    <ProfileLayout title="Profile" refreshing={profile.refreshing} onRefresh={refresh}>
      {profile.loading && !card && <Skeleton.Card />}
      {profile.error && <ErrorState message={profile.error} onRetry={() => void profile.reload()} />}

      {person && card && (
        <>
          {/* Profile Hero Card */}
          <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadow('raised')]}>
            <GlobePattern height={140} />
            <View style={styles.heroCenter}>
              <Avatar name={fullName} uri={card.avatar_url} size={84} ring />

              <View style={styles.nameBlock}>
                <Typography variant="h1" color="text" style={styles.heroName} numberOfLines={1}>
                  {fullName}
                </Typography>
                <Typography variant="caption" color="textMuted">
                  @{person.username} · {person.role || 'Member'}
                </Typography>
              </View>

              <View style={styles.locationTag}>
                <Icon name="map-pin" size={13} color="primary" />
                <Typography variant="caption" color="textMuted">
                  Competes in BGSC · Bangalore
                </Typography>
              </View>

              {isSelf && (
                <Pressable
                  onPress={() => go('EditProfile')}
                  accessibilityRole="button"
                  accessibilityLabel="Edit profile"
                  style={({ pressed }) => [
                    styles.editPill,
                    { backgroundColor: colors.surfaceInner, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="edit" size={13} color="text" />
                  <Typography variant="bodySmall" color="text" style={styles.editLabel}>
                    Edit profile
                  </Typography>
                </Pressable>
              )}
            </View>
          </View>

          {/* Stats Row */}
          {inputs && (
            <View style={[styles.statStrip, { backgroundColor: colors.surface, borderColor: colors.border }, shadow('flat')]}>
              <View style={styles.statCol}>
                <Typography variant="h2" color="text" style={styles.statNumber}>
                  {inputs.participations}
                </Typography>
                <Typography variant="caption" color="textMuted" style={styles.statCaption}>
                  Events
                </Typography>
              </View>

              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

              <View style={styles.statCol}>
                <Typography variant="h2" color="text" style={styles.statNumber}>
                  {inputs.podiums}
                </Typography>
                <Typography variant="caption" color="textMuted" style={styles.statCaption}>
                  Podiums
                </Typography>
              </View>

              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

              <View style={styles.statCol}>
                <Typography variant="h2" color="primary" style={styles.statNumber}>
                  {formatNumber(summary?.balance ?? inputs.points_balance)}
                </Typography>
                <Typography variant="caption" color="textMuted" style={styles.statCaption}>
                  Points
                </Typography>
              </View>

              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

              <View style={styles.statCol}>
                <Typography variant="h2" color="text" style={styles.statNumber}>
                  {card.rating}
                </Typography>
                <Typography variant="caption" color="textMuted" style={styles.statCaption}>
                  Rating
                </Typography>
              </View>
            </View>
          )}

          <View style={[styles.passCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadow('raised')]}>
            <View style={styles.passHeader}>
              <View style={styles.tierBadgeGroup}>
                <Badge label={card.card_tier.toUpperCase()} variant="primary" />
                <Typography variant="caption" color="textMuted" style={styles.tierCode}>
                  TIER RANK
                </Typography>
              </View>
              <Typography variant="mono" color="textMuted" style={styles.tierCode}>
                RATING {card.rating}
              </Typography>
            </View>

            {!!card.bio && (
              <Typography variant="body" color="text" style={styles.bioText}>
                {card.bio}
              </Typography>
            )}

            <Button
              label="Share Player Pass"
              variant="outline"
              leftIcon="share"
              onPress={() => {
                void Share.share({
                  message: `${fullName} (@${person.username}) · ${card.card_tier} · BGSC rating ${card.rating}`,
                }).catch((err) => popup.error('Could not share', getErrorMessage(err)));
              }}
            />
          </View>

          <SectionHeader title="Interests & Disciplines" actionLabel={isSelf ? 'Edit' : undefined} onAction={() => go('EditProfile')} />
          <View style={styles.interestsRow}>
            {card.interests.length ? (
              card.interests.map((interest) => (
                <View key={interest} style={[styles.interestPill, { backgroundColor: colors.surfaceInner, borderColor: colors.border }]}>
                  <Icon name="trophy" size={12} color="primary" />
                  <Typography variant="bodySmall" color="text">
                    {interest}
                  </Typography>
                </View>
              ))
            ) : (
              <Typography color="textMuted">No public interests added yet.</Typography>
            )}
          </View>

          {isSelf && (
            <>
              <SectionHeader title="My Match Registrations" actionLabel="Browse" onAction={() => go('Events')} />
              {registrations.loading && <Skeleton.Card />}
              {registrations.error && <ErrorState message={registrations.error} onRetry={() => void registrations.reload()} />}
              {registrations.data && (
                <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadow('flat')]}>
                  {registrations.data.length ? (
                    registrations.data.slice(0, 4).map((reg) => {
                      const statusPill = REGISTRATION_STATUS[reg.status] ?? { label: reg.status, variant: 'muted' as const };
                      return (
                        <ListRow
                          key={reg._id}
                          icon="calendar"
                          title={`Match Pass · ${reg.context?.event?.role ?? 'Participant'}`}
                          subtitle={formatDate(reg.submitted_at || reg.created_at)}
                          trailing={<Badge label={statusPill.label} variant={statusPill.variant} />}
                          onPress={() => navigation.navigate('EventDetails', { ref: reg.owner.id })}
                        />
                      );
                    })
                  ) : (
                    <View style={styles.emptyWrap}>
                      <Typography color="textMuted">No tournament registrations yet.</Typography>
                    </View>
                  )}
                </View>
              )}

              {/* Account & Preferences */}
              <SectionHeader title="Account & Preferences" />
              <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }, shadow('flat')]}>
                <ListRow
                  title="Personal Information"
                  subtitle="Profile, handle and verification"
                  icon="user"
                  onPress={() => setActions(true)}
                />
                <ListRow
                  title="Settings & Privacy"
                  subtitle="Theme, notifications and security"
                  icon="settings"
                  onPress={() => go('Settings')}
                />
                <ListRow
                  title="Help & Feedback"
                  subtitle="FAQ, tickets and community support"
                  icon="message"
                  onPress={() => go('Feedback')}
                />
              </View>

              {/* Actions Bottom Sheet */}
              <BottomSheet visible={actions} onClose={() => setActions(false)}>
                <Typography variant="h2" style={styles.sheetTitle}>
                  Account Management
                </Typography>
                <ListRow title="Edit Profile Details" icon="edit" onPress={() => { setActions(false); go('EditProfile'); }} />
                <ListRow
                  title="Request My Data"
                  subtitle="Download your tournament & points history"
                  icon="download"
                  onPress={() => {
                    setActions(false);
                    void popup.info(
                      'Data Export',
                      'Self-service data export will be enabled in the next release. Contact support via Feedback for an immediate copy.',
                    );
                  }}
                />
                <ListRow title="Delete Account" icon="delete" danger onPress={() => { setActions(false); go('DeleteAccount'); }} />
                <View style={styles.logoutWrap}>
                  <Button
                    label="Log Out"
                    variant="destructive"
                    onPress={() => {
                      setActions(false);
                      setTimeout(() => void confirmLogout(), 320);
                    }}
                  />
                </View>
              </BottomSheet>
            </>
          )}
        </>
      )}
    </ProfileLayout>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  heroCenter: {
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  nameBlock: {
    alignItems: 'center',
    gap: 2,
    marginTop: 6,
  },
  heroName: {
    fontSize: 26,
    lineHeight: 32,
    textAlign: 'center',
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
  },
  editLabel: {
    fontWeight: '600',
    fontSize: 13,
  },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '700',
  },
  statCaption: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  passCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  passHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierCode: {
    fontSize: 10,
    letterSpacing: 1,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
  },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  menuCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  emptyWrap: {
    padding: 16,
    alignItems: 'center',
  },
  sheetTitle: {
    marginBottom: 12,
  },
  logoutWrap: {
    marginTop: 16,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
