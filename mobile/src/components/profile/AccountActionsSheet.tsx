import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState, useEffect } from 'react';

import { BottomSheet } from '@/components/home/BottomSheet';
import { UserRepository } from '@/core/repositories/UserRepository';
import { useAuthStore } from '@/core/stores/authStore';
import type { ProfileInterest, UpdateProfileInput, UserProfile } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

type SheetTab = 'edit' | 'actions';

interface Props {
  visible: boolean;
  onClose: () => void;
  initialTab?: SheetTab;
}

export function AccountActionsSheet({ visible, onClose, initialTab = 'edit' }: Props) {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<SheetTab>(initialTab);

  useEffect(() => {
    if (visible) setActiveTab(initialTab);
  }, [visible, initialTab]);

  return (
    <BottomSheet visible={visible} onClose={onClose} heightRatio={0.85}>
      {/* Tab row */}
      <View style={[s.tabBar, { borderBottomColor: colors.border }]}>
        {(['edit', 'actions'] as SheetTab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setActiveTab(t)}
            style={[s.tab, activeTab === t && [s.tabActive, { borderBottomColor: colors.accent }]]}
          >
            <Text style={[s.tabLabel, { color: activeTab === t ? colors.accent : colors.textMuted }]}>
              {t === 'edit' ? 'Edit Profile' : 'Account Actions'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.sheetBody}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'edit' ? (
          <EditTab colors={colors} onSaved={onClose} />
        ) : (
          <ActionsTab colors={colors} onClose={onClose} />
        )}
      </ScrollView>
    </BottomSheet>
  );
}

// ─── Edit Tab ────────────────────────────────────────────────────────────────

const DOMAIN_LABELS: Record<string, string> = {
  sports: 'Sports',
  esports: 'Esports',
  gaming_industry: 'Gaming Industry',
  game_dev: 'Game Dev',
};

const DOMAIN_COLORS: Record<string, string> = {
  sports: '#f59e0b',
  esports: '#8b5cf6',
  gaming_industry: '#3b82f6',
  game_dev: '#e8662a',
};

function EditTab({ colors, onSaved }: { colors: ReturnType<typeof useColors>; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const status = useAuthStore((s) => s.status);

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: UserRepository.getProfile,
    enabled: status === 'authenticated',
  });

  const { data: allInterests = [] } = useQuery({
    queryKey: ['interests'],
    queryFn: UserRepository.getInterests,
    enabled: status === 'authenticated',
  });

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [contact, setContact] = useState('');
  const [selectedInterestIds, setSelectedInterestIds] = useState<string[]>([]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName ?? '');
      setBio(profile.bio ?? '');
      setContact(profile.contact ?? '');
      setSelectedInterestIds(profile.interests.map((i) => i.id));
    }
  }, [profile]);

  const mutation = useMutation({
    mutationFn: (input: UpdateProfileInput) => UserRepository.updateProfile(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      onSaved();
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save profile.');
    },
  });

  const interestsMutation = useMutation({
    mutationFn: (ids: string[]) => UserRepository.updateInterests(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  });

  const toggleInterest = (id: string) => {
    setSelectedInterestIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const onSave = () => {
    const input: UpdateProfileInput = {};
    if (displayName.trim()) input.displayName = displayName.trim();
    if (bio.trim() !== (profile?.bio ?? '')) input.bio = bio.trim();
    if (contact.trim() !== (profile?.contact ?? '')) input.contact = contact.trim();

    const originalIds = (profile?.interests ?? []).map((i) => i.id).sort().join(',');
    const newIds = [...selectedInterestIds].sort().join(',');
    if (originalIds !== newIds) {
      interestsMutation.mutate(selectedInterestIds);
    }

    mutation.mutate(input);
  };

  return (
    <View style={{ gap: 16 }}>
      <EditField
        label="USERNAME"
        value={profile?.username ?? ''}
        editable={false}
        colors={colors}
        note="Username changes coming soon"
      />
      <EditField
        label="DISPLAY NAME"
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Your display name"
        maxLength={50}
        colors={colors}
      />
      <EditField
        label="EMAIL"
        value={profile?.email ?? ''}
        editable={false}
        colors={colors}
        note="Email change requires verification"
      />
      <EditField
        label="CONTACT"
        value={contact}
        onChangeText={setContact}
        keyboardType="phone-pad"
        placeholder="+91"
        colors={colors}
      />
      <View style={s.fieldWrap}>
        <View style={s.labelRow}>
          <Text style={[s.fieldLabel, { color: colors.textMuted }]}>BIO</Text>
          <Text style={[s.charCount, { color: colors.textMuted }]}>{bio.length}/300</Text>
        </View>
        <View style={[s.textArea, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people about yourself…"
            placeholderTextColor={colors.textMuted}
            style={[s.textAreaInput, { color: colors.text }]}
            multiline
            maxLength={300}
          />
        </View>
      </View>

      {/* Interests multi-select picker */}
      {allInterests.length > 0 && (
        <View style={s.fieldWrap}>
          <Text style={[s.fieldLabel, { color: colors.textMuted }]}>INTERESTS</Text>
          {(Object.keys(DOMAIN_LABELS) as Array<keyof typeof DOMAIN_LABELS>).map((domain) => {
            const group = allInterests.filter((i: ProfileInterest) => i.domain === domain);
            if (group.length === 0) return null;
            const domainColor = DOMAIN_COLORS[domain];
            return (
              <View key={domain} style={{ marginBottom: 8 }}>
                <Text style={[s.fieldNote, { color: domainColor, fontWeight: '600', marginBottom: 6 }]}>
                  {DOMAIN_LABELS[domain]}
                </Text>
                <View style={s.chipRow}>
                  {group.map((interest: ProfileInterest) => {
                    const selected = selectedInterestIds.includes(interest.id);
                    return (
                      <Pressable
                        key={interest.id}
                        onPress={() => toggleInterest(interest.id)}
                        style={[
                          s.chip,
                          selected
                            ? { backgroundColor: domainColor + '22', borderColor: domainColor }
                            : { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[s.chipText, { color: selected ? domainColor : colors.textMuted }]}>
                          {interest.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Newsletters */}
      {profile && (
        <View style={s.fieldWrap}>
          <Text style={[s.fieldLabel, { color: colors.textMuted }]}>NEWSLETTERS</Text>
          {(['Gaming News', 'Indie Spotlights', 'Game Dev', 'Campus Studio'] as const).map((name) => {
            const active = profile.newsletterSubscriptions.includes(name);
            return (
              <View key={name} style={s.toggleRow}>
                <Text style={[s.toggleLabel, { color: colors.text }]}>{name}</Text>
                <View style={[s.toggleBadge, { backgroundColor: active ? colors.success + '22' : colors.border }]}>
                  <Text style={[s.toggleBadgeText, { color: active ? colors.success : colors.textMuted }]}>
                    {active ? 'On' : 'Off'}
                  </Text>
                </View>
              </View>
            );
          })}
          <Text style={[s.fieldNote, { color: colors.textMuted }]}>Toggle management coming soon</Text>
        </View>
      )}

      <Pressable
        onPress={onSave}
        disabled={mutation.isPending}
        style={[s.saveBtn, { backgroundColor: colors.primary, opacity: mutation.isPending ? 0.6 : 1 }]}
      >
        <Text style={[s.saveBtnText, { color: colors.primaryText }]}>
          {mutation.isPending ? 'Saving…' : 'Save Changes'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Actions Tab ──────────────────────────────────────────────────────────────

function ActionsTab({ colors, onClose }: { colors: ReturnType<typeof useColors>; onClose: () => void }) {
  const logout = useAuthStore((s) => s.logout);

  const onDisable = () => Alert.alert(
    'Disable Account',
    'Your account will become dormant. You can re-enable it by logging in again.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disable', style: 'destructive', onPress: () => Alert.alert('Coming soon') },
    ]
  );

  const onDelete = () => Alert.alert(
    'Delete Account',
    'This will permanently delete your account after a 7-day grace period. Your data will be exported first.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Coming soon') },
    ]
  );

  const onExport = () => Alert.alert(
    'Export Data',
    'We will email you a full data export including posts, chats, points, and sponsor history within 24 hours.',
    [{ text: 'Request Export', onPress: () => Alert.alert('Export request received') }, { text: 'Cancel', style: 'cancel' }]
  );

  return (
    <View style={{ gap: 12 }}>
      <ActionButton
        label="Log Out"
        icon="log-out-outline"
        description="Sign out of your account on this device"
        onPress={() => { logout(); onClose(); }}
        colors={colors}
      />
      <View style={[s.divider, { backgroundColor: colors.border }]} />
      <ActionButton
        label="Disable Account"
        icon="pause-circle-outline"
        description="Temporarily deactivate — reversible by logging in again"
        onPress={onDisable}
        colors={colors}
      />
      <ActionButton
        label="Delete Account"
        icon="trash-outline"
        description="Permanently delete after 7-day grace period"
        onPress={onDelete}
        danger
        colors={colors}
      />
      <ActionButton
        label="Export My Data"
        icon="download-outline"
        description="GDPR-style full data dump including all chat history"
        onPress={onExport}
        colors={colors}
      />
      <View style={[s.divider, { backgroundColor: colors.border }]} />
      <Pressable
        onPress={() => Linking.openURL('https://bgsc.in/tos').catch(() => Alert.alert('Error', 'Could not open link.'))}
        style={s.legalLink}
      >
        <Text style={[s.legalLinkText, { color: colors.accent }]}>Terms of Service ↗</Text>
      </Pressable>
      <Pressable
        onPress={() => Linking.openURL('https://bgsc.in/privacy').catch(() => Alert.alert('Error', 'Could not open link.'))}
        style={s.legalLink}
      >
        <Text style={[s.legalLinkText, { color: colors.accent }]}>Privacy Policy ↗</Text>
      </Pressable>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  description,
  onPress,
  danger,
  colors,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  description: string;
  onPress: () => void;
  danger?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const tint = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      style={[s.actionBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
    >
      <Ionicons name={icon} size={22} color={tint} />
      <View style={{ flex: 1 }}>
        <Text style={[s.actionBtnLabel, { color: tint }]}>{label}</Text>
        <Text style={[s.actionBtnDesc, { color: colors.textMuted }]}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

function EditField({
  label,
  note,
  colors,
  ...input
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  note?: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={s.fieldWrap}>
      <Text style={[s.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={[s.inputRow, { borderColor: colors.border, backgroundColor: colors.surface, opacity: input.editable === false ? 0.6 : 1 }]}>
        <TextInput
          placeholderTextColor={colors.textMuted}
          style={[s.inputText, { color: colors.text }]}
          {...input}
        />
      </View>
      {note && <Text style={[s.fieldNote, { color: colors.textMuted }]}>{note}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  tabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 0 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: {},
  tabLabel: { fontSize: 14, fontWeight: '600' },

  sheetBody: { padding: 16, paddingBottom: 40 },

  fieldWrap: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  fieldNote: { fontSize: 11, marginTop: 2 },
  charCount: { fontSize: 11 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    height: 48,
  },
  inputText: { flex: 1, fontSize: 15 },

  textArea: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 90 },
  textAreaInput: { fontSize: 14, lineHeight: 20 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12 },

  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  toggleLabel: { fontSize: 14 },
  toggleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  toggleBadgeText: { fontSize: 12, fontWeight: '600' },

  saveBtn: { borderRadius: 999, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveBtnText: { fontSize: 16, fontWeight: '600' },

  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },

  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 14, padding: 14 },
  actionBtnLabel: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  actionBtnDesc: { fontSize: 12 },

  legalLink: { paddingVertical: 4 },
  legalLinkText: { fontSize: 14, fontWeight: '500' },
});
