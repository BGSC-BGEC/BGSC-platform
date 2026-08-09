import { useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FAB } from '@/components/FAB';
import { GlassCard } from '@/components/GlassCard';
import { SkeletonBlock } from '@/components/SkeletonBlock';
import { useToast } from '@/components/Toast';
import { useAuthStore } from '@/core/stores/authStore';
import { useFeed } from '@/hooks/use-feed';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useColors } from '@/hooks/use-colors';
import { CommentSheet } from './CommentSheet';
import { PostCard } from './PostCard';
import { EmptyState, SectionError } from './StateViews';
import type { FeedPost } from './types';

function PostSkeleton() {
  return (
    <GlassCard>
      <View style={styles.skelHeader}>
        <SkeletonBlock width={40} height={40} radius={20} />
        <View style={styles.skelIdentity}>
          <SkeletonBlock width={140} height={13} />
          <SkeletonBlock width={100} height={11} style={{ marginTop: 6 }} />
        </View>
      </View>
      <SkeletonBlock height={13} style={{ marginTop: 12 }} />
      <SkeletonBlock height={13} style={{ marginTop: 8 }} />
      <SkeletonBlock height={13} width="70%" style={{ marginTop: 8 }} />
      <SkeletonBlock height={36} style={{ marginTop: 14 }} />
    </GlassCard>
  );
}

/**
 * Social feed surface (home-page.md H5): newest-first post list, pull to
 * refresh, Feed-only FAB. Loading/empty/error per §18.1 — guests see a
 * join message; authenticated users get a create CTA. Posting itself is
 * Phase 2 (TODO below).
 */
export function FeedTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const requireAuth = useRequireAuth();
  const status = useAuthStore((s) => s.status);
  const { data, isLoading, isError, isRefetching, refetch } = useFeed();
  const [commentPost, setCommentPost] = useState<FeedPost | null>(null);

  const onFab = () => {
    if (!requireAuth('Log in to post.')) return;
    // TODO(phase2): open the Add Post flow (home-page.md H8) when the feed
    // backend contract exists — until then posting is a stub.
    toast.show('Creating posts arrives in Phase 2.');
  };

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.textMuted}
          />
        }
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 104 }]}
      >
        {isLoading ? (
          <View style={styles.stack}>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </View>
        ) : isError ? (
          <SectionError message="The feed couldn't be loaded." onRetry={() => void refetch()} />
        ) : !data || data.length === 0 ? (
          status === 'authenticated' ? (
            <EmptyState
              icon="newspaper-outline"
              title="Be the first to post"
              message="Share a moment, a match result, or a hype clip with the campus."
              actionLabel="Create a post"
              onAction={onFab}
            />
          ) : (
            <EmptyState
              icon="newspaper-outline"
              title="Join the conversation"
              message="Log in to see and share posts from the BGSC community."
              actionLabel="Log in"
              onAction={() => requireAuth('Log in to see the community feed.')}
            />
          )
        ) : (
          <View style={styles.stack}>
            {data.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onComment={() => setCommentPost(post)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <FAB onPress={onFab} accessibilityLabel="Create a post" />

      <CommentSheet
        key={commentPost?.id ?? 'none'}
        post={commentPost}
        onClose={() => setCommentPost(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexGrow: 1,
  },
  stack: {
    gap: 12,
  },
  skelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skelIdentity: {
    flex: 1,
  },
});
