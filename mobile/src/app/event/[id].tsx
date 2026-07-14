import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';

import { SkeletonBox } from '@/components/home/SkeletonBox';
import { EventRepository } from '@/core/repositories/EventRepository';
import { useAuthStore } from '@/core/stores/authStore';
import type { EventType, RegisterPayload } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

const EVENT_TYPE_LABEL: Record<EventType, string> = {
  LE: 'Leaderboard Event',
  DE: 'Direct Event',
  ALL: 'Auction League',
  DLL: 'Direct League',
};

const CATEGORY_EMOJI: Record<string, string> = {
  leagues: '🏆',
  bgec: '🎮',
  fitsoc: '💪',
  general: '🌟',
};

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{label}</Text>;
}

function Divider() {
  const colors = useColors();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

function InfoBox({ text, variant = 'muted' }: { text: string; variant?: 'muted' | 'accent' }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.infoBox,
        {
          backgroundColor: variant === 'accent' ? colors.accentMuted : colors.surfaceMuted,
          borderColor: variant === 'accent' ? colors.accent : colors.border,
        },
      ]}>
      <Text style={[styles.infoBoxText, { color: variant === 'accent' ? colors.accent : colors.textMuted }]}>
        {text}
      </Text>
    </View>
  );
}

function PillInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  const colors = useColors();
  return (
    <>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType ?? 'default'}
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
      />
    </>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  // Form state
  const [role, setRole] = useState<'member' | 'captain'>('member');
  const [displayName, setDisplayName] = useState('');
  const [gameName, setGameName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamStatus, setTeamStatus] = useState<'open' | 'invite_only' | 'closed'>('open');
  const [inviteCode, setInviteCode] = useState('');
  const [basePrice, setBasePrice] = useState('');

  // Registration state — isRegistered tracks fresh mutations; alreadyRegistered merges server status
  const [isRegistered, setIsRegistered] = useState(false);
  const [registrationId, setRegistrationId] = useState<string | null>(null);

  // WhatsApp reveal: tracks which contact indices have been revealed
  const [revealedWhatsApp, setRevealedWhatsApp] = useState<Set<number>>(new Set());

  // Captain application state
  const [captainAppStatus, setCaptainAppStatus] = useState<
    'idle' | 'pending' | 'approved' | 'rejected'
  >('idle');

  // Seed display name from profile on first load
  useEffect(() => {
    if (user?.username && !displayName) setDisplayName(user.username);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.username]);

  const { data: event, isPending, isError } = useQuery({
    queryKey: ['events', id],
    queryFn: () => EventRepository.getById(id),
    enabled: !!id,
  });

  const alreadyRegisteredOnServer = event?.registrationStatus === 'registered';

  // Fetch the registration record for returning users (need the ID to withdraw)
  const { data: existingReg } = useQuery({
    queryKey: ['events', id, 'my-registration'],
    queryFn: () => EventRepository.getMyRegistration(id),
    enabled: !!id && !!user && alreadyRegisteredOnServer && !registrationId,
  });

  // Live leaderboard (only when event has one and is not upcoming)
  const { data: leaderboard } = useQuery({
    queryKey: ['events', id, 'leaderboard'],
    queryFn: () => EventRepository.getLeaderboard(id),
    enabled: !!id && !!event && event.needsLeaderboard && event.status !== 'upcoming',
  });

  const registerMutation = useMutation({
    mutationFn: () => {
      const payload: RegisterPayload = {
        role,
        displayName: displayName.trim() || undefined,
        gameName: gameName.trim() || undefined,
        teamName: role === 'captain' ? teamName.trim() || undefined : undefined,
        teamStatus: role === 'captain' ? teamStatus : undefined,
        inviteCode: role === 'member' ? inviteCode.trim() || undefined : undefined,
        basePrice:
          event?.type === 'ALL' && role === 'member' && basePrice
            ? Number(basePrice) || undefined
            : undefined,
      };
      return EventRepository.register(id, payload);
    },
    onSuccess: (data) => {
      setIsRegistered(true);
      setRegistrationId(data.id);
    },
  });

  // The effective registration ID — from fresh mutation or from a server fetch
  const effectiveRegistrationId = registrationId ?? existingReg?.id ?? null;

  const withdrawMutation = useMutation({
    mutationFn: () => EventRepository.withdrawRegistration(id, effectiveRegistrationId!),
    onSuccess: () => {
      setIsRegistered(false);
      setRegistrationId(null);
    },
  });

  const captainMutation = useMutation({
    mutationFn: () => EventRepository.applyForCaptain(id),
    onSuccess: () => setCaptainAppStatus('pending'),
  });

  const handleShare = async () => {
    if (!event) return;
    await Share.share({ message: `Check out ${event.title} on the BGSC Platform!` });
  };

  const handleViewRules = () => {
    if (event?.rulesPdfUrl) {
      Linking.openURL(event.rulesPdfUrl).catch(() => null);
    }
  };

  const statusColor =
    event?.status === 'upcoming' ? colors.info
    : event?.status === 'ongoing' ? colors.success
    : colors.textMuted;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isPending) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.backIcon, { color: colors.text }]}>←</Text>
          </Pressable>
          <SkeletonBox width={140} height={18} borderRadius={6} />
          <View style={{ width: 32 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <SkeletonBox width="100%" height={200} borderRadius={0} />
          <View style={{ padding: 16, gap: 12 }}>
            <SkeletonBox width="72%" height={26} borderRadius={6} />
            <SkeletonBox width="100%" height={14} borderRadius={6} />
            <SkeletonBox width="85%" height={14} borderRadius={6} />
            <SkeletonBox width="60%" height={14} borderRadius={6} />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Not found / Error ──────────────────────────────────────────────────────
  if (isError || !event) {
    return (
      <View
        style={[styles.container, styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Text style={styles.notFoundEmoji}>🔍</Text>
        <Text style={[styles.stateText, { color: colors.textMuted }]}>Event not found</Text>
        <Pressable style={[styles.retryBtn, { borderColor: colors.border }]} onPress={() => router.back()}>
          <Text style={[styles.retryText, { color: colors.accent }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const isLeague = event.type === 'ALL' || event.type === 'DLL';
  // Use the spec field (needsLeaderboard) rather than re-deriving from type
  const hasLeaderboard = event.needsLeaderboard;

  // Registration closes at the deadline, not just when the event ends (spec §6.4)
  const regDeadline = event.registrationDeadline ? new Date(event.registrationDeadline) : null;
  const registrationOpen = event.status !== 'past' && (!regDeadline || regDeadline > new Date());

  // Merge server-reported status with local mutation state
  const alreadyRegistered = alreadyRegisteredOnServer || isRegistered;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back">
          <Text style={[styles.backIcon, { color: colors.text }]}>←</Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Event Details
        </Text>
        <Pressable onPress={handleShare} hitSlop={12} accessibilityLabel="Share event">
          <Text style={[styles.shareIcon, { color: colors.accent }]}>↗</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 108 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* ── Hero ── */}
        <View style={[styles.hero, { backgroundColor: colors.surfaceMuted }]}>
          {event.coverImageUrl ? (
            <Image
              source={{ uri: event.coverImageUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.heroEmoji}>{CATEGORY_EMOJI[event.category] ?? '📋'}</Text>
          )}
          <View style={[styles.heroBadge, { backgroundColor: statusColor }]}>
            {/* color from token, not hardcoded */}
            <Text style={[styles.heroBadgeText, { color: colors.primaryText }]}>{event.status}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* ── Title + Type pills ── */}
          <Text style={[styles.title, { color: colors.text }]}>{event.title}</Text>

          <View style={styles.pillRow}>
            <View style={[styles.pill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.pillText, { color: colors.textMuted }]}>
                {EVENT_TYPE_LABEL[event.type]}
              </Text>
            </View>
            {isLeague && (
              <View style={[styles.pill, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}>
                <Text style={[styles.pillText, { color: colors.accent }]}>League</Text>
              </View>
            )}
          </View>

          {/* ── Description ── */}
          {event.description ? (
            <Text style={[styles.description, { color: colors.text }]}>{event.description}</Text>
          ) : null}

          {/* ── Schedule ── */}
          <SectionLabel label="SCHEDULE" />
          <Text style={[styles.infoRow, { color: colors.textMuted }]}>
            📅{'  '}{fmt(event.startDate)} → {fmt(event.endDate)}
          </Text>
          {event.registrationDeadline ? (
            <Text style={[styles.infoRow, { color: registrationOpen ? colors.accent : colors.textMuted }]}>
              ⏰{'  '}Registration closes {fmt(event.registrationDeadline)}
            </Text>
          ) : null}
          {event.venue ? (
            <Text style={[styles.infoRow, { color: colors.textMuted }]}>📍{'  '}{event.venue}</Text>
          ) : null}

          {/* ── Rules ── */}
          {event.rulesPdfUrl ? (
            <Pressable onPress={handleViewRules} accessibilityRole="link">
              <Text style={[styles.infoRow, { color: colors.accent }]}>📋{'  '}View Rules →</Text>
            </Pressable>
          ) : null}

          {/* ── Awards ── */}
          {event.awardsList && event.awardsList.length > 0 ? (
            <>
              <SectionLabel label="AWARDS" />
              {event.awardsList.map((award, i) => (
                <Text key={i} style={[styles.infoRow, { color: colors.textMuted }]}>· {award}</Text>
              ))}
            </>
          ) : null}

          {/* ── Coordinator Contacts — email + masked WhatsApp reveal (spec §6.2) ── */}
          {event.coordinatorContacts && event.coordinatorContacts.length > 0 ? (
            <>
              <SectionLabel label="CONTACTS" />
              {event.coordinatorContacts.map((c, i) => (
                <View key={i} style={styles.contactRow}>
                  <Text style={[styles.contactName, { color: colors.text }]}>{c.name}</Text>
                  <Text style={[styles.contactRole, { color: colors.textMuted }]}>{c.role}</Text>
                  {c.email ? (
                    <Pressable onPress={() => Linking.openURL(`mailto:${c.email}`)} accessibilityRole="link">
                      <Text style={[styles.contactLink, { color: colors.accent }]}>{c.email}</Text>
                    </Pressable>
                  ) : null}
                  {c.whatsappMasked ? (
                    revealedWhatsApp.has(i) ? (
                      <Text style={[styles.contactLink, { color: colors.success }]}>
                        📱 {c.whatsappMasked}
                      </Text>
                    ) : (
                      <Pressable
                        onPress={() => setRevealedWhatsApp((prev) => new Set([...prev, i]))}
                        accessibilityRole="button">
                        <Text style={[styles.contactLink, { color: colors.textMuted }]}>
                          Tap to reveal WhatsApp →
                        </Text>
                      </Pressable>
                    )
                  ) : null}
                </View>
              ))}
            </>
          ) : null}

          <Divider />

          {/* ── Sponsor Leaderboard Preview (Ongoing — top 3 per spec §6.3) ── */}
          {event.status === 'ongoing' && (
            <>
              <SectionLabel label="SPONSOR LEADERBOARD" />
              {(event.sponsorTop3?.length ?? 0) > 0 ? (
                event.sponsorTop3!.map((s) => (
                  <View
                    key={s.sponsorId}
                    style={[styles.sponsorRankRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.sponsorRankNum, { color: colors.textMuted }]}>#{s.rank}</Text>
                    <Text style={[styles.sponsorRankName, { color: colors.text }]}>{s.sponsorName}</Text>
                    {s.fanCount != null && (
                      <Text style={[styles.sponsorRankFans, { color: colors.accent }]}>
                        {s.fanCount} fans
                      </Text>
                    )}
                  </View>
                ))
              ) : event.sponsorLeader ? (
                <InfoBox
                  text={`🏅 ${event.sponsorLeader.sponsorName} is currently leading fan contributions`}
                  variant="accent"
                />
              ) : (
                <InfoBox text="🏅 Sponsor standings will appear once fans are earned" />
              )}
              <Pressable
                style={[styles.outlineBtn, { borderColor: colors.border }]}
                onPress={() => router.push('/(drawer)/sponsors' as any)}>
                <Text style={[styles.outlineBtnText, { color: colors.textMuted }]}>
                  View Full Leaderboard →
                </Text>
              </Pressable>
              <Divider />
            </>
          )}

          {/* ── League navigation ── */}
          {isLeague && event.status !== 'past' && (
            <>
              <SectionLabel label="BRACKET & AUCTION" />
              <View style={styles.leagueNavRow}>
                <Pressable
                  style={[styles.outlineBtn, { borderColor: colors.accent, flex: 1 }]}
                  onPress={() => router.push(`/event/bracket/${event.id}`)}>
                  <Text style={[styles.outlineBtnText, { color: colors.accent }]}>🗂 View Bracket</Text>
                </Pressable>
                {event.type === 'ALL' && (
                  <Pressable
                    style={[styles.outlineBtn, { borderColor: colors.accent, flex: 1 }]}
                    onPress={() => router.push(`/event/auction/${event.id}`)}>
                    <Text style={[styles.outlineBtnText, { color: colors.accent }]}>🔨 Live Auction</Text>
                  </Pressable>
                )}
              </View>
              <Divider />
            </>
          )}

          {/* ── Registration ── */}
          <SectionLabel label="REGISTRATION" />

          {alreadyRegistered ? (
            /* Already registered — show Edit + Withdraw (spec §6.4) */
            <View style={[styles.registeredCard, { backgroundColor: colors.accentMuted, borderColor: colors.accent }]}>
              <Text style={[styles.registeredTitle, { color: colors.accent }]}>✅ You're registered!</Text>
              <View style={styles.registeredActions}>
                {registrationOpen && (
                  <Pressable
                    style={[styles.outlineBtn, { borderColor: colors.border, flex: 1 }]}
                    onPress={() => setIsRegistered(false)}>
                    <Text style={[styles.outlineBtnText, { color: colors.text }]}>Edit</Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.withdrawBtn, { borderColor: colors.danger, flex: 1 }]}
                  onPress={() => withdrawMutation.mutate()}
                  disabled={!effectiveRegistrationId || withdrawMutation.isPending}>
                  {withdrawMutation.isPending ? (
                    <ActivityIndicator size="small" color={colors.danger} />
                  ) : (
                    <Text style={[styles.withdrawBtnText, { color: colors.danger }]}>
                      {effectiveRegistrationId ? 'Withdraw' : 'Withdraw (reload app)'}
                    </Text>
                  )}
                </Pressable>
              </View>
              {withdrawMutation.isError ? (
                <Text style={[styles.errorText, { color: colors.danger }]}>Withdrawal failed. Try again.</Text>
              ) : null}
            </View>
          ) : !user ? (
            <Pressable
              style={[styles.authGate, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
              onPress={() => router.push('/login')}>
              <Text style={[styles.authGateText, { color: colors.textMuted }]}>
                Log in to register for this event
              </Text>
              <Text style={[styles.authGateLink, { color: colors.accent }]}>Log in →</Text>
            </Pressable>
          ) : !registrationOpen ? (
            <InfoBox text="Registration closed · This event has ended" />
          ) : (
            <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <PillInput
                label="NAME"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your display name for this event"
              />

              <PillInput
                label="IN-GAME NAME / IGN (OPTIONAL)"
                value={gameName}
                onChangeText={setGameName}
                placeholder="e.g. xX_Sniper_Xx"
              />

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>ROLE</Text>
              <View style={[styles.segmentTrack, { backgroundColor: colors.surfaceMuted }]}>
                {(['member', 'captain'] as const).map((r) => (
                  <Pressable
                    key={r}
                    style={[
                      styles.segment,
                      role === r && [styles.segmentActive, { backgroundColor: colors.surface }],
                    ]}
                    onPress={() => setRole(r)}>
                    <Text
                      style={[
                        styles.segmentText,
                        { color: role === r ? colors.text : colors.textMuted },
                        role === r && { fontWeight: '700' },
                      ]}>
                      {r === 'captain' ? 'Team Captain' : 'Team Member'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {role === 'captain' && (
                <>
                  <PillInput
                    label="TEAM NAME"
                    value={teamName}
                    onChangeText={setTeamName}
                    placeholder="Enter your team name"
                  />

                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>TEAM STATUS</Text>
                  <View style={[styles.segmentTrack, { backgroundColor: colors.surfaceMuted }]}>
                    {(['open', 'invite_only', 'closed'] as const).map((s) => (
                      <Pressable
                        key={s}
                        style={[
                          styles.segment,
                          teamStatus === s && [styles.segmentActive, { backgroundColor: colors.surface }],
                        ]}
                        onPress={() => setTeamStatus(s)}>
                        <Text
                          style={[
                            styles.segmentText,
                            { color: teamStatus === s ? colors.text : colors.textMuted },
                            teamStatus === s && { fontWeight: '700' },
                          ]}>
                          {s === 'open' ? 'Open' : s === 'invite_only' ? 'Invite Only' : 'Closed'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <InfoBox
                    text="💡 As captain you'll receive an invite code after registration to share with your squad"
                    variant="accent"
                  />
                </>
              )}

              {role === 'member' && (
                <PillInput
                  label="INVITE CODE (OPTIONAL)"
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  placeholder="Enter invite code to join a specific team"
                />
              )}

              {event.type === 'ALL' && role === 'member' && (
                <>
                  <PillInput
                    label="YOUR BASE PRICE (PTS)"
                    value={basePrice}
                    onChangeText={setBasePrice}
                    placeholder="Set your starting bid price"
                    keyboardType="numeric"
                  />
                  <InfoBox text="📊 Avg · deviation · variance stats available once the registration pool forms" />
                </>
              )}

              {registerMutation.isError ? (
                <Text style={[styles.errorText, { color: colors.danger }]}>
                  Registration failed. Please try again.
                </Text>
              ) : null}
            </View>
          )}

          {/* ── Captain Application (leagues only) ── */}
          {isLeague && user && registrationOpen && !alreadyRegistered && (
            <>
              <Divider />
              <SectionLabel label="CAPTAIN APPLICATION" />
              {captainAppStatus === 'idle' ? (
                <>
                  <InfoBox text="🎖 Apply to lead a team. Core members review captain applications during the registration window." />
                  <Pressable
                    style={[styles.outlineBtn, { borderColor: colors.border }]}
                    onPress={() => captainMutation.mutate()}
                    disabled={captainMutation.isPending}>
                    {captainMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <Text style={[styles.outlineBtnText, { color: colors.text }]}>
                        Apply for Captain →
                      </Text>
                    )}
                  </Pressable>
                </>
              ) : captainAppStatus === 'pending' ? (
                <InfoBox text="⏳ Application submitted — under review by Core members" variant="accent" />
              ) : captainAppStatus === 'approved' ? (
                <InfoBox text="✅ Captain application approved!" variant="accent" />
              ) : (
                <InfoBox text="❌ Application not approved this time" />
              )}
            </>
          )}

          {/* ── Team Formation ── */}
          {user && registrationOpen && !alreadyRegistered && (
            <>
              <Divider />
              <SectionLabel label="TEAM FORMATION" />
              <InfoBox text="🤝 Search registered teams, accept invites, and toggle your open/invite-only status here once the Team Service ships." />
            </>
          )}

          {/* ── Leaderboard — live entries via needsLeaderboard (spec §6.6) ── */}
          {hasLeaderboard && (
            <>
              <Divider />
              <SectionLabel label="LEADERBOARD" />
              {event.status === 'upcoming' ? (
                <InfoBox text="⏳ Activates when the event goes live" />
              ) : leaderboard && leaderboard.length > 0 ? (
                leaderboard.slice(0, 5).map((entry) => (
                  <View key={entry.userId} style={[styles.lbRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.lbRank, { color: colors.textMuted }]}>#{entry.rank}</Text>
                    {/* ponytail: showing userId until user-service integration lands */}
                    <Text style={[styles.lbUserId, { color: colors.text }]}>
                      {entry.userId.slice(0, 8)}…
                    </Text>
                    <Text style={[styles.lbScore, { color: colors.accent }]}>{entry.score}</Text>
                  </View>
                ))
              ) : (
                <InfoBox
                  text={
                    event.status === 'past'
                      ? '🏁 Final standings published on the Leaderboards page'
                      : '📊 Live rankings — tap below for the full view'
                  }
                />
              )}
              {event.status !== 'upcoming' && (
                <Pressable
                  style={[styles.outlineBtn, { borderColor: colors.border }]}
                  onPress={() => router.push('/(drawer)/leaderboards' as any)}>
                  <Text style={[styles.outlineBtnText, { color: colors.textMuted }]}>
                    View Full Leaderboard →
                  </Text>
                </Pressable>
              )}
            </>
          )}

          {/* ── Results + Sponsor fan update ── */}
          {event.status === 'past' && (
            <>
              <Divider />
              <SectionLabel label="RESULTS" />
              {event.userFanEarned != null && event.sponsorLeader ? (
                <InfoBox
                  text={`🎉 +${event.userFanEarned} fans earned for ${event.sponsorLeader.sponsorName}!`}
                  variant="accent"
                />
              ) : null}
              <InfoBox text="Full results and standings will appear here once published by coordinators" />
            </>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky CTA ── */}
      {registrationOpen && !alreadyRegistered && (
        <View
          style={[
            styles.cta,
            { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 },
          ]}>
          <Pressable
            style={({ pressed }) => [
              styles.ctaBtn,
              { backgroundColor: colors.primary },
              (pressed || registerMutation.isPending) && { opacity: 0.8 },
            ]}
            onPress={user ? () => registerMutation.mutate() : () => router.push('/login')}
            disabled={registerMutation.isPending}
            accessibilityRole="button">
            {registerMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <Text style={[styles.ctaBtnText, { color: colors.primaryText }]}>
                {user ? 'Register for Event' : 'Log in to Register'}
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backIcon: { fontSize: 22, width: 32 },
  headerTitle: { fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
  shareIcon: { fontSize: 20, width: 32, textAlign: 'right' },

  hero: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  heroEmoji: { fontSize: 72 },
  heroBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },

  scrollContent: { flexGrow: 1 },
  body: { padding: 16, gap: 10 },

  title: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  description: { fontSize: 14, lineHeight: 21 },

  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 11, fontWeight: '500' },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  infoRow: { fontSize: 14 },

  contactRow: { gap: 2 },
  contactName: { fontSize: 14, fontWeight: '600' },
  contactRole: { fontSize: 12 },
  contactLink: { fontSize: 12, fontWeight: '600' },

  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6 },

  infoBox: { padding: 12, borderRadius: 10, borderWidth: 1 },
  infoBoxText: { fontSize: 13, lineHeight: 19 },

  leagueNavRow: { flexDirection: 'row', gap: 8 },

  outlineBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  outlineBtnText: { fontSize: 14, fontWeight: '600' },

  registeredCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  registeredTitle: { fontSize: 15, fontWeight: '700' },
  registeredActions: { flexDirection: 'row', gap: 8 },
  withdrawBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawBtnText: { fontSize: 13, fontWeight: '600' },

  authGate: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 6, alignItems: 'center' },
  authGateText: { fontSize: 14, textAlign: 'center' },
  authGateLink: { fontSize: 14, fontWeight: '700' },

  formCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
  segmentTrack: { flexDirection: 'row', borderRadius: 999, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 999 },
  segmentActive: {
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  segmentText: { fontSize: 13, fontWeight: '500' },
  input: {
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  errorText: { fontSize: 13, textAlign: 'center' },

  // Sponsor top-3 preview rows
  sponsorRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sponsorRankNum: { fontSize: 13, fontWeight: '700', minWidth: 28 },
  sponsorRankName: { fontSize: 14, fontWeight: '600', flex: 1 },
  sponsorRankFans: { fontSize: 13, fontWeight: '600' },

  // Inline leaderboard preview rows
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lbRank: { fontSize: 13, fontWeight: '700', minWidth: 28 },
  lbUserId: { fontSize: 13, flex: 1 },
  lbScore: { fontSize: 14, fontWeight: '700' },

  notFoundEmoji: { fontSize: 48 },
  stateText: { fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
  retryText: { fontSize: 14, fontWeight: '600' },

  cta: { paddingTop: 12, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth },
  ctaBtn: { height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ctaBtnText: { fontSize: 16, fontWeight: '700' },
});
