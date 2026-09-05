import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';

import { GlassCard } from '@/components/GlassCard';
import { GlassInput } from '@/components/GlassInput';
import { PillButton } from '@/components/PillButton';
import { SectionLabel } from '@/components/events/SectionStates';
import { SegmentedToggle } from '@/components/SegmentedToggle';
import { useToast } from '@/components/Toast';
import { useAuthStore } from '@/core/stores/authStore';
import type { PlatformEvent, Registration, RegisterPayload } from '@/core/types';
import { FONTS } from '@/core/theme/fonts';
import { useColors } from '@/hooks/use-colors';
import {
  useApplyForCaptain,
  useMyRegistration,
  useRegisterEvent,
  useWithdrawRegistration,
} from '@/hooks/use-events';

type Role = 'captain' | 'member';

/**
 * Registration section (spec §7.4–7.5): guest gate, register form (role →
 * captain/member fields), registered state with unregister, captain
 * application flow for leagues.
 *
 * TODO(events, Phase 2): invite-code + copy (auto-generated server-side) and
 * captain-application approval states are stubbed — no backend endpoint yet.
 */
export function RegistrationSection({ event }: { event: PlatformEvent }) {
  const colors = useColors();
  const toast = useToast();
  const pathname = usePathname();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthed = !!accessToken;

  const [role, setRole] = useState<Role>('member');
  const [displayName, setDisplayName] = useState('');
  const [gameName, setGameName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamStatus, setTeamStatus] = useState('Open');
  const [basePrice, setBasePrice] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  // Local registered state — the backend's my-registration endpoint is Phase 2,
  // so the register mutation's response drives the registered view.
  const [localReg, setLocalReg] = useState<Registration | null>(null);
  const [confirmingWithdraw, setConfirmingWithdraw] = useState(false);
  const [captainPending, setCaptainPending] = useState(false);

  const myRegQuery = useMyRegistration(event.id, isAuthed);
  const registerMut = useRegisterEvent(event.id);
  const withdrawMut = useWithdrawRegistration(event.id);
  const captainMut = useApplyForCaptain(event.id);

  const registered = myRegQuery.data ?? localReg;

  // Two-tap confirm auto-resets after 3 s.
  useEffect(() => {
    if (!confirmingWithdraw) return;
    const t = setTimeout(() => setConfirmingWithdraw(false), 3000);
    return () => clearTimeout(t);
  }, [confirmingWithdraw]);

  const gate = () =>
    router.replace({ pathname: '/login', params: { returnTo: pathname } });

  const submit = () => {
    if (!isAuthed) {
      gate();
      return;
    }
    if (!displayName.trim() || !gameName.trim()) {
      setFormError('Name and game name are required.');
      return;
    }
    if (event.isAuctionBased && !basePrice.trim()) {
      setFormError('Base price is required for auction leagues.');
      return;
    }
    setFormError(null);
    const payload: RegisterPayload = {
      role,
      displayName: displayName.trim(),
      gameName: gameName.trim(),
      teamName: role === 'captain' ? teamName.trim() || undefined : undefined,
      teamStatus:
        role === 'captain'
          ? (teamStatus.toLowerCase().replace(' ', '_') as RegisterPayload['teamStatus'])
          : undefined,
      basePrice: basePrice.trim() ? Number(basePrice) : undefined,
    };
    registerMut.mutate(payload, {
      onSuccess: (reg) => {
        setLocalReg(reg);
        toast.show('Registered! See you there.');
      },
      onError: (err) => toast.show(err instanceof Error ? err.message : 'Registration failed.'),
    });
  };

  const withdraw = () => {
    if (!registered) return;
    if (!confirmingWithdraw) {
      setConfirmingWithdraw(true);
      return;
    }
    setConfirmingWithdraw(false);
    withdrawMut.mutate(registered.id, {
      onSuccess: () => {
        setLocalReg(null);
        toast.show('Registration cancelled.');
      },
      onError: (err) =>
        toast.show(err instanceof Error ? err.message : "Couldn't cancel registration."),
    });
  };

  const applyCaptain = () => {
    if (!isAuthed) {
      gate();
      return;
    }
    captainMut.mutate(undefined, {
      onSuccess: () => {
        setCaptainPending(true);
        toast.show('Application submitted for review.');
      },
      // TODO(events, Phase 2): captain applications 404 until the backend
      // endpoint lands — surface it as "coming soon" rather than an error.
      onError: () => toast.show('Captain applications open soon.'),
    });
  };

  const isLeague = event.type === 'ALL' || event.type === 'DLL';
  const isPast = event.status === 'past';
  const isClosed =
    event.registrationStatus === 'closed' || event.registrationStatus === 'full';

  return (
    <View style={styles.wrap}>
      <SectionLabel label="REGISTER" />

      {isPast ? (
        <GlassCard>
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            This event has concluded — check back next season.
          </Text>
        </GlassCard>
      ) : isClosed ? (
        <GlassCard>
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            Registrations are closed for this event.
          </Text>
        </GlassCard>
      ) : registered ? (
        <GlassCard>
          <Text style={[styles.registeredText, { color: colors.success }]}>
            You&apos;re registered for {event.title}. See you there!
          </Text>
          <PillButton
            label={confirmingWithdraw ? 'Tap again to confirm' : 'Unregister'}
            variant="destructive"
            loading={withdrawMut.isPending}
            onPress={withdraw}
            accessibilityLabel="Unregister from this event"
          />
        </GlassCard>
      ) : !isAuthed ? (
        <GlassCard>
          <Text style={[styles.muted, { color: colors.textMuted }]}>
            Sign in to register for this event.
          </Text>
          <PillButton label="Login to register" variant="light" onPress={gate} />
        </GlassCard>
      ) : (
        <GlassCard style={styles.form}>
          <GlassInput label="Name" value={displayName} onChangeText={setDisplayName} placeholder="Full name" />
          <GlassInput label="Game name" value={gameName} onChangeText={setGameName} placeholder="In-game name" />

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Role</Text>
          <View style={styles.roleRow}>
            {(['member', 'captain'] as Role[]).map((r) => {
              const active = role === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRole(r)}
                  accessibilityRole="button"
                  accessibilityLabel={`Register as ${r === 'captain' ? 'Team Captain' : 'Team Member'}`}
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.roleChip,
                    {
                      backgroundColor: active ? colors.accent : 'transparent',
                      borderColor: active ? 'transparent' : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.roleChipText, { color: active ? colors.accentText : colors.textMuted }]}>
                    {r === 'captain' ? 'Team Captain' : 'Team Member'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {role === 'captain' ? (
            <>
              <GlassInput label="Team name" value={teamName} onChangeText={setTeamName} placeholder="Team name" />
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Team status</Text>
              <SegmentedToggle
                options={['Open', 'Invite Only', 'Closed']}
                value={teamStatus}
                onChange={setTeamStatus}
                accessibilityLabel="Team status"
              />
              {/* TODO(events, Phase 2): invite code is auto-generated server-side —
                  render read-only + Copy once the backend ships it. */}
            </>
          ) : null}

          {event.isAuctionBased ? (
            <GlassInput
              label={role === 'captain' ? 'Reserve / Base price' : 'Base price'}
              value={basePrice}
              onChangeText={setBasePrice}
              keyboardType="numeric"
              placeholder="₹ amount"
            />
          ) : null}

          {formError ? <Text style={[styles.error, { color: colors.danger }]}>{formError}</Text> : null}

          <PillButton
            label="Register"
            loading={registerMut.isPending}
            onPress={submit}
            accessibilityLabel="Register for this event"
          />

          {isLeague ? (
            captainPending ? (
              <Text style={[styles.muted, { color: colors.textMuted }]}>
                Application under review by the Core member(s) assigned to this league.
              </Text>
            ) : (
              <PillButton
                label="Apply for Team Captain"
                variant="ghost"
                loading={captainMut.isPending}
                onPress={applyCaptain}
                accessibilityLabel="Apply for Team Captain"
              />
            )
          ) : null}
        </GlassCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 20,
    gap: 8,
  },
  form: {
    gap: 12,
  },
  fieldLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChipText: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
  },
  error: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },
  muted: {
    fontFamily: FONTS.body,
    fontSize: 13,
    textAlign: 'center',
  },
  registeredText: {
    fontFamily: FONTS.medium,
    fontSize: 14,
    textAlign: 'center',
  },
});
