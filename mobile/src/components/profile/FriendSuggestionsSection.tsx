import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { SkeletonBox } from '@/components/home/SkeletonBox';
import { UserRepository } from '@/core/repositories/UserRepository';
import { useAuthStore } from '@/core/stores/authStore';
import type { FriendSuggestion } from '@/core/types';
import { useColors } from '@/hooks/use-colors';

export function FriendSuggestionsSection() {
  const colors = useColors();
  const status = useAuthStore((s) => s.status);

  const { data: suggestions = [], isLoading, error, refetch } = useQuery({
    queryKey: ['friendSuggestions'],
    queryFn: UserRepository.getFriendSuggestions,
    enabled: status === 'authenticated',
  });

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>👥 Friend Suggestions</Text>
        <Pressable onPress={() => router.push('/friends')}>
          <Text style={[s.seeAll, { color: colors.accent }]}>See All →</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <FlatList
          horizontal
          data={[1, 2, 3]}
          keyExtractor={(i) => String(i)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.listContent}
          renderItem={() => (
            <View style={s.skeletonCard}>
              <SkeletonBox width={56} height={56} borderRadius={28} style={{ alignSelf: 'center', marginBottom: 8 }} />
              <SkeletonBox width="80%" height={12} style={{ alignSelf: 'center', marginBottom: 6 }} />
              <SkeletonBox width="60%" height={10} style={{ alignSelf: 'center' }} />
            </View>
          )}
        />
      ) : error ? (
        <View style={s.stateBox}>
          <Text style={[s.stateText, { color: colors.textMuted }]}>Couldn't load suggestions</Text>
          <Pressable onPress={() => refetch()}>
            <Text style={[s.retryText, { color: colors.accent }]}>Retry</Text>
          </Pressable>
        </View>
      ) : suggestions.length === 0 ? (
        <View style={s.stateBox}>
          <Text style={[s.stateText, { color: colors.textMuted }]}>No suggestions right now</Text>
        </View>
      ) : (
        <FlatList
          horizontal
          data={suggestions}
          keyExtractor={(item) => item.userId}
          showsHorizontalScrollIndicator={false}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => <FriendCard item={item} colors={colors} />}
        />
      )}
    </View>
  );
}

function FriendCard({ item, colors }: { item: FriendSuggestion; colors: ReturnType<typeof useColors> }) {
  const queryClient = useQueryClient();
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: () => UserRepository.sendFriendRequest(item.userId),
    onSuccess: () => setSent(true),
    onError: () => setSent(false),
  });

  const onAdd = () => {
    if (sent || mutation.isPending) return;
    setSent(true); // optimistic
    mutation.mutate();
  };

  const displayName = item.displayName || item.username;

  return (
    <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Avatar */}
      <View style={[s.avatar, { backgroundColor: colors.accent }]}>
        <Text style={[s.avatarText, { color: colors.accentText }]}>
          {displayName.slice(0, 1).toUpperCase()}
        </Text>
      </View>

      <Text style={[s.name, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
      <Text style={[s.mutual, { color: colors.textMuted }]}>
        {item.mutualCount > 0 ? `Mutual: ${item.mutualCount}` : 'Suggested'}
      </Text>

      <Pressable
        onPress={onAdd}
        disabled={sent}
        style={[
          s.addBtn,
          sent
            ? { borderWidth: 1, borderColor: colors.border }
            : { backgroundColor: colors.primary },
        ]}
      >
        <Text style={[s.addBtnText, { color: sent ? colors.textMuted : colors.primaryText }]}>
          {sent ? 'Requested' : '✚ Add'}
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  seeAll: { fontSize: 13, fontWeight: '600' },

  listContent: { paddingHorizontal: 16, gap: 10 },

  card: { width: 120, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, alignItems: 'center', gap: 6 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 22, fontWeight: '700' },
  name: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  mutual: { fontSize: 11, textAlign: 'center' },

  addBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 4 },
  addBtnText: { fontSize: 12, fontWeight: '600' },

  skeletonCard: { width: 120, alignItems: 'center', gap: 6 },

  stateBox: { paddingHorizontal: 16, gap: 6 },
  stateText: { fontSize: 13 },
  retryText: { fontSize: 13, fontWeight: '600' },
});
