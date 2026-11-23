import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ProfileLayout } from '../profile/profile-layout';
import { usersRepository } from '../../src/repositories/UsersRepository';
import { pointsRepository } from '../../src/repositories/PointsRepository';
import { registrationRepository } from '../../src/repositories/RegistrationRepository';
import { useAsyncResource } from '../../src/hooks/useAsyncResource';
import { useAuth } from '../../store/auth';
import { useConfirmLogout } from '../../src/hooks/useConfirmLogout';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { BottomSheet } from '../../src/components/BottomSheet';
import { CustomizeCardSheet } from '../../src/components/playercard/CustomizeCardSheet';
import { useSharePlayerCard } from '../../src/components/playercard/useSharePlayerCard';
import { CARD_STYLES, DEFAULT_CARD_STYLE, PlayerCard, type CardStyleId } from '../../src/components/playercard/cardStyles';
import { CARD_LOGOS, DEFAULT_CARD_LOGO, type CardLogoId } from '../../src/components/playercard/cardLogos';
import { loadCardPrefs, saveCardPrefs, type CardPrefs } from '../../src/components/playercard/cardPrefs';
import {
  PLAYER_CARD_HEIGHT,
  PLAYER_CARD_WIDTH,
  type PlayerCardViewProps,
} from '../../src/components/playercard/PlayerCardView';
import { useResponsive } from '../../src/responsive';
import { ListRow } from '../../src/components/ListRow';
import { SectionHeader } from '../../src/components/SectionHeader';
import { Typography } from '../../src/typography/Typography';
import { Icon } from '../../src/icons/Icon';
import { Skeleton } from '../../src/feedback/Skeleton';
import { ErrorState } from '../../src/feedback/ErrorState';
import { formatNumber, formatDate, REGISTRATION_STATUS } from '../../src/utils/format';
import { usePopup } from '../../src/popups/PopupProvider';
import { useTheme } from '../../src/theme/ThemeProvider';
import { FONT_FAMILIES } from '../../src/theme/typography';

const ROLE_LABELS: Record<string, string> = {
  guest: 'Guest',
  user: 'Member',
  member: 'Member',
  core: 'Core Team',
  coordinator: 'Coordinator',
  founder: 'Founder',
};

// 'actions' opens the Account Management sheet; anything else is a route name.
const ACCOUNT_ROWS: Array<{ title: string; subtitle: string; target: string }> = [
  { title: 'Personal Information', subtitle: 'Profile, handle and verification', target: 'actions' },
  { title: 'Settings & Privacy', subtitle: 'Theme, notifications and security', target: 'Settings' },
  { title: 'Help & Feedback', subtitle: 'FAQ, tickets and community support', target: 'Feedback' },
];

const REG_ROLE_LABELS: Record<string, string> = {
  solo: 'Solo entry',
  captain: 'Team captain',
  member: 'Team member',
};

/**
 * The player card (tier-styled, BDome backdrop) up top, a strip for role/points/bio with
 * edit and share actions, then interests, registrations and account as plain sections on one
 * continuous page (no boxed groups).
 */
export default function Profile() {
  const { width: windowWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const { user } = useAuth();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const popup = usePopup();
  const confirmLogout = useConfirmLogout();
  const [actions, setActions] = useState(false);
  // Design and logo picked in Customize card, saved on this device per account (cardPrefs).
  const [cardStyle, setCardStyle] = useState<CardStyleId>(DEFAULT_CARD_STYLE);
  const [cardLogo, setCardLogo] = useState<CardLogoId>(DEFAULT_CARD_LOGO);
  const [prefs, setPrefs] = useState<CardPrefs | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const prompted = useRef(false);
  const cardRef = useRef<React.ComponentRef<typeof View>>(null);
  const ref = route.params?.ref ?? user?.id;
  const isSelf = !route.params?.ref || ref === user?.id || ref === user?.username;
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let live = true;
    void loadCardPrefs(userId).then((p) => {
      if (!live) return;
      if (CARD_STYLES.some((s) => s.id === p.style)) setCardStyle(p.style as CardStyleId);
      if (CARD_LOGOS.some((l) => l.id === p.logo)) setCardLogo(p.logo as CardLogoId);
      setPrefs(p);
    });
    return () => {
      live = false;
    };
  }, [userId]);

  const chooseStyle = (style: CardStyleId) => {
    setCardStyle(style);
    if (userId) void saveCardPrefs(userId, { style });
  };
  const chooseLogo = (logo: CardLogoId) => {
    setCardLogo(logo);
    if (userId) void saveCardPrefs(userId, { logo });
  };
  // Opened from the bottom tab bar there is nothing to go back to: show the menu button instead.
  const isTabRoot = route.name === 'ProfileTab';

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
    }
  };

  const person = profile.data?.person;
  const card = profile.data?.card;
  const summary = profile.data?.summary;
  const inputs = card?.stats?.inputs;
  const go = (name: string) => navigation.navigate(name);

  const fullName = person?.profile?.full_name || person?.username || 'Player';
  const roleLabel = ROLE_LABELS[person?.role ?? ''] ?? 'Member';
  const memberSince = person?.created_at ? formatDate(person.created_at, { day: undefined }) : null;

  const cardProps: PlayerCardViewProps = {
    fullName,
    username: person?.username ?? '',
    avatarUrl: card?.avatar_url,
    tier: card?.card_tier ?? 'Rookie',
    rating: card?.rating ?? 0,
    events: inputs?.participations ?? 0,
    podiums: inputs?.podiums ?? 0,
    challenges: inputs?.challenges ?? 0,
    points: summary?.balance ?? inputs?.points_balance ?? 0,
    interests: card?.interests ?? [],
  };
  // The card has a fixed design size; shrink it on phones narrower than card + gutters.
  const cardScale = Math.min(1, (windowWidth - gutter * 2) / PLAYER_CARD_WIDTH);

  // Someone else's card shows the default look: their choice lives on their device for now.
  const shownStyle = isSelf ? cardStyle : DEFAULT_CARD_STYLE;
  const shownLogo = isSelf ? cardLogo : undefined;
  const { share, sharing } = useSharePlayerCard(
    cardRef,
    `${fullName} (@${cardProps.username}) · ${cardProps.tier} · BGSC rating ${cardProps.rating}`,
  );

  // First visit to your own profile: offer to customize the card, once.
  const hasCard = !!card;
  useEffect(() => {
    if (!isSelf || !hasCard || !userId || !prefs || prefs.introSeen || prompted.current) return;
    prompted.current = true;
    void saveCardPrefs(userId, { introSeen: true });
    void popup
      .confirm({
        title: 'Make your card yours',
        message: 'Pick a design and a logo for your player card. You can change them any time with Customize card.',
        confirmLabel: 'Customize',
        cancelLabel: 'Later',
      })
      .then((yes) => yes && setCustomizeOpen(true));
  }, [isSelf, hasCard, userId, prefs, popup]);

  return (
    <ProfileLayout title="Profile" refreshing={profile.refreshing} onRefresh={refresh} isRoot={isTabRoot}>
      {profile.loading && !card && <Skeleton.Card />}
      {profile.error && <ErrorState message={profile.error} onRetry={() => void profile.reload()} />}

      {person && card && (
        <>
          {/* Player card */}
          <View style={styles.cardStage}>
            <Pressable
              disabled={!isSelf}
              onPress={() => setCustomizeOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Customize card"
              style={{
                width: PLAYER_CARD_WIDTH * cardScale,
                height: PLAYER_CARD_HEIGHT * cardScale,
              }}
            >
              <View
                style={{
                  width: PLAYER_CARD_WIDTH,
                  height: PLAYER_CARD_HEIGHT,
                  transform: [{ scale: cardScale }],
                  marginLeft: -(PLAYER_CARD_WIDTH * (1 - cardScale)) / 2,
                  marginTop: -(PLAYER_CARD_HEIGHT * (1 - cardScale)) / 2,
                }}
              >
                {/* Unscaled capture target for Share card; collapsable={false} keeps it on Android. */}
                <View ref={cardRef} collapsable={false}>
                  <PlayerCard {...cardProps} logo={shownLogo} cardStyle={shownStyle} />
                </View>
              </View>
            </Pressable>
            {isSelf && (
              <Button
                label="Customize card"
                variant="secondary"
                onPress={() => setCustomizeOpen(true)}
                containerStyle={{ ...styles.customize, width: PLAYER_CARD_WIDTH * cardScale }}
              />
            )}
          </View>

          {/* What the card doesn't show: role, tenure, points, bio — and the actions */}
          <View style={styles.metaBlock}>
            <View style={styles.metaRow}>
              <Typography variant="bodySmall" color="textMuted" style={styles.metaItem} numberOfLines={1}>
                {roleLabel}
                {memberSince ? ` · since ${memberSince}` : ''}
              </Typography>
              <Typography variant="bodySmall" color="text" style={styles.metaPoints}>
                {formatNumber(summary?.balance ?? inputs?.points_balance ?? 0)} pts
              </Typography>
            </View>

            {!!card.bio && (
              <Typography variant="body" color="text" style={styles.bioText}>
                {card.bio}
              </Typography>
            )}

            <View style={styles.actionRow}>
              {isSelf && (
                <Button
                  label="Edit profile"
                  variant="outline"
                  leftIcon="edit"
                  onPress={() => go('EditProfile')}
                  containerStyle={styles.flex}
                />
              )}
              <Button
                label="Share card"
                leftIcon="share"
                loading={sharing}
                onPress={() => void share()}
                containerStyle={styles.flex}
              />
            </View>
          </View>

          <CustomizeCardSheet
            visible={customizeOpen}
            onClose={() => setCustomizeOpen(false)}
            card={cardProps}
            cardStyle={cardStyle}
            onCardStyleChange={chooseStyle}
            logo={cardLogo}
            onLogoChange={chooseLogo}
          />

          {/* Interests: quiet outlined tags (hairline, no fill, no icons) that wrap cleanly */}
          <View style={styles.section}>
            <SectionHeader title="Interests" actionLabel={isSelf ? 'Edit' : undefined} onAction={() => go('EditProfile')} />
            {card.interests.length ? (
              <View style={styles.interests}>
                {card.interests.map((interest) => (
                  <View key={interest} style={[styles.interestTag, { borderColor: colors.border }]}>
                    <Typography color="text" style={styles.interestText} numberOfLines={1}>
                      {interest}
                    </Typography>
                  </View>
                ))}
              </View>
            ) : (
              <Typography color="textMuted">No public interests added yet.</Typography>
            )}
          </View>

          {isSelf && (
            <>
              {/* Registrations: plain rows; the status pill stays (it is a status) */}
              <View style={styles.section}>
                <SectionHeader title="My registrations" actionLabel="Browse" onAction={() => go('Events')} />
                {registrations.loading && <Skeleton.Card />}
                {registrations.error && <ErrorState message={registrations.error} onRetry={() => void registrations.reload()} />}
                {registrations.data &&
                  (registrations.data.length ? (
                    <View>
                      {registrations.data.slice(0, 4).map((reg, i, list) => {
                        const statusPill = REGISTRATION_STATUS[reg.status] ?? { label: reg.status, variant: 'muted' as const };
                        const role = reg.context?.event?.role;
                        // Only event registrations have an event to open; owner.id can be null.
                        const eventId = reg.owner?.type === 'event' ? reg.owner.id : null;
                        return (
                          <PlainRow
                            key={reg._id}
                            title={`Event registration · ${role ? REG_ROLE_LABELS[role] ?? role : 'Participant'}`}
                            caption={`Registered ${formatDate(reg.submitted_at || reg.created_at)}`}
                            trailing={<Badge label={statusPill.label} variant={statusPill.variant} />}
                            last={i === list.length - 1}
                            onPress={eventId ? () => navigation.navigate('EventDetails', { ref: eventId }) : undefined}
                          />
                        );
                      })}
                    </View>
                  ) : (
                    <Typography color="textMuted">No tournament registrations yet.</Typography>
                  ))}
              </View>

              {/* Account: plain rows, title and what's inside, chevron */}
              <View style={styles.section}>
                <SectionHeader title="Account" />
                <View>
                  {ACCOUNT_ROWS.map((row, i) => (
                    <PlainRow
                      key={row.title}
                      title={row.title}
                      caption={row.subtitle}
                      last={i === ACCOUNT_ROWS.length - 1}
                      onPress={() => (row.target === 'actions' ? setActions(true) : go(row.target))}
                    />
                  ))}
                </View>
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

/** A plain list row (as on Home's Explore list): title and caption, optional trailing item, chevron when tappable. */
function PlainRow({
  title,
  caption,
  trailing,
  last,
  onPress,
}: {
  title: string;
  caption?: string;
  trailing?: React.ReactNode;
  last: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={caption ? `${title}, ${caption}` : title}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.flex}>
        <Typography color="text" style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Typography>
        {caption ? (
          <Typography color="textMuted" style={styles.rowCaption} numberOfLines={1}>
            {caption}
          </Typography>
        ) : null}
      </View>
      {trailing}
      {onPress ? <Icon name="chevron-right" size={18} color="textMuted" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  cardStage: {
    alignItems: 'center',
    paddingTop: 4,
  },
  customize: {
    marginTop: 12,
  },
  // No surrounding card: role/points/bio and the two buttons sit directly on the page.
  metaBlock: {
    gap: 12,
    paddingHorizontal: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaItem: {
    flexShrink: 1,
  },
  metaPoints: {
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Sections sit straight on the page; extra top margin separates them instead of boxes.
  section: {
    gap: 10,
    marginTop: 8,
  },
  interests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  interestText: {
    fontFamily: FONT_FAMILIES.bodyMedium,
    fontSize: 14,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowTitle: {
    fontFamily: FONT_FAMILIES.bodySemiBold,
    fontSize: 16,
    lineHeight: 21,
  },
  rowCaption: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 1,
  },
  sheetTitle: {
    marginBottom: 12,
  },
  logoutWrap: {
    marginTop: 16,
  },
});
