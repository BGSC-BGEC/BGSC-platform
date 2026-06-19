import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useAuthStore } from '@/core/stores/authStore';
import { useViewModel } from '@/core/viewmodel/useViewModel';
import { ProfileViewModel } from '@/viewmodels/ProfileViewModel';
import { useColors } from '@/hooks/use-colors';

export default function ProfileScreen() {
  const colors = useColors();
  const status = useAuthStore((s) => s.status);

  const [vm] = useState(() => new ProfileViewModel());
  const { profile } = useViewModel(vm);

  useEffect(() => {
    if (status === 'authenticated') void vm.load();
  }, [status, vm]);

  if (status !== 'authenticated') {
    return (
      <Screen center>
        <Text style={[styles.title, { color: colors.text }]}>You&apos;re signed out</Text>
        <Pressable
          onPress={() => router.push('/login')}
          style={[styles.button, { backgroundColor: colors.primary }]}>
          <Text style={[styles.buttonText, { color: colors.primaryText }]}>Login / Register</Text>
        </Pressable>
      </Screen>
    );
  }

  if (profile.status === 'loading' || profile.status === 'idle') {
    return (
      <Screen center>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (profile.status === 'error') {
    return (
      <Screen center>
        <Text style={{ color: '#dc2626' }}>{profile.error}</Text>
      </Screen>
    );
  }

  const user = profile.data!;
  return (
    <Screen>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.primaryText }]}>
            {user.username.slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{user.username}</Text>
        <Text style={[styles.row, { color: colors.textMuted }]}>{user.email}</Text>
        <Text style={[styles.row, { color: colors.textMuted }]}>Role: {user.role}</Text>
        {typeof user.pointsBalance === 'number' && (
          <Text style={[styles.row, { color: colors.textMuted }]}>
            Points: {user.pointsBalance}
          </Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  button: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 8 },
  buttonText: { fontSize: 15, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 12, padding: 20, alignItems: 'center', gap: 6 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  avatarText: { fontSize: 30, fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700' },
  row: { fontSize: 14 },
});
