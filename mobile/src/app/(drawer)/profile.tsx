import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

import { AccountActionsSheet } from '@/components/profile/AccountActionsSheet';
import { EventSuggestionsSection } from '@/components/profile/EventSuggestionsSection';
import { FriendSuggestionsSection } from '@/components/profile/FriendSuggestionsSection';
import { HistorySection } from '@/components/profile/HistorySection';
import { PlayerCard } from '@/components/profile/PlayerCard';
import { UserInfoPanel } from '@/components/profile/UserInfoPanel';
import { useAuthStore } from '@/core/stores/authStore';
import { useColors } from '@/hooks/use-colors';

type SheetTab = 'edit' | 'actions';

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetTab, setSheetTab] = useState<SheetTab>('edit');

  const openSheet = (tab: SheetTab = 'edit') => {
    setSheetTab(tab);
    setSheetVisible(true);
  };

  if (status !== 'authenticated' || !user) {
    return (
      <View style={[s.gate, { backgroundColor: colors.background, paddingTop: insets.top + 16 }]}>
        <Text style={[s.gateTitle, { color: colors.text }]}>Sign in to view your profile</Text>
        <Pressable
          onPress={() => router.push('/login')}
          style={[s.gateBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[s.gateBtnText, { color: colors.primaryText }]}>Login / Register</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Custom status bar — spec §2 */}
      <View
        style={[
          s.topBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.topBarBtn}>
          <Text style={[s.topBarBack, { color: colors.text }]}>←</Text>
        </Pressable>

        <Pressable onPress={() => openSheet('edit')} hitSlop={8}>
          <Text style={[s.topBarCenter, { color: colors.text }]}>Account Actions</Text>
        </Pressable>

        {/* Right: avatar circle — tap opens Account Actions (spec §2) */}
        <Pressable onPress={() => openSheet('edit')} style={s.topBarBtn}>
          <View style={[s.topBarAvatar, { backgroundColor: colors.accent }]}>
            <Text style={[s.topBarAvatarText, { color: colors.accentText }]}>
              {user.username.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <PlayerCard onEditProfile={() => openSheet('edit')} />
        <UserInfoPanel />
        <EventSuggestionsSection />
        <FriendSuggestionsSection />
        <HistorySection />
      </ScrollView>

      <AccountActionsSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        initialTab={sheetTab}
      />
    </View>
  );
}

const s = StyleSheet.create({
  gate: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  gateTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  gateBtn: { borderRadius: 999, paddingHorizontal: 28, paddingVertical: 13 },
  gateBtnText: { fontSize: 15, fontWeight: '600' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarBtn: { width: 40, alignItems: 'center' },
  topBarBack: { fontSize: 22 },
  topBarCenter: { fontSize: 15, fontWeight: '600' },
  topBarAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  topBarAvatarText: { fontSize: 15, fontWeight: '700' },

  scroll: { paddingTop: 8 },
});
