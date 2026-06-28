import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuthStore } from '@/core/stores/authStore';
import { useColors } from '@/hooks/use-colors';

import { AddPostModal } from './AddPostModal';
import { CommentSheet } from './CommentSheet';
import { MediaCarousel } from './MediaCarousel';
import { MOCK_POSTS } from './mock-data';
import { SkeletonBox } from './SkeletonBox';
import { relativeTime, type Post } from './types';

interface Props {
  isLoading?: boolean;
  showFab?: boolean;
}

export function FeedTab({ isLoading, showFab = true }: Props) {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);

  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const [showAddPost, setShowAddPost] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Snackbar state for guest FAB tap
  const snackOpacity = useRef(new Animated.Value(0)).current;
  const [snackMsg, setSnackMsg] = useState('');

  const showSnackbar = (msg: string) => {
    setSnackMsg(msg);
    Animated.sequence([
      Animated.timing(snackOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(snackOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const handleFabPress = () => {
    if (!user) {
      showSnackbar('Log in to post');
      setTimeout(() => router.push('/login'), 1600);
    } else {
      setShowAddPost(true);
    }
  };

  const handleLike = (postId: string) => {
    if (!user) {
      router.push('/login');
      return;
    }
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked: !p.liked, likeCount: p.liked ? p.likeCount - 1 : p.likeCount + 1 }
          : p
      )
    );
  };

  const handleShare = async (post: Post) => {
    try {
      await Share.share({
        message: `${post.caption ?? 'Check this out on BGSC!'}\n\nShared from BGSC Platform`,
        title: post.caption ?? 'BGSC Post',
      });
    } catch {
      // user cancelled — no action needed
    }
  };

  if (isLoading) {
    return <FeedSkeleton colors={colors} />;
  }

  if (hasError) {
    return (
      <View style={[styles.stateBox, { backgroundColor: colors.background }]}>
        <Text style={styles.stateIcon}>⚠️</Text>
        <Text style={[styles.stateTitle, { color: colors.text }]}>Failed to load feed</Text>
        <Text style={[styles.stateBody, { color: colors.textMuted }]}>
          Check your connection and try again.
        </Text>
        <Pressable
          style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          onPress={() => setHasError(false)}>
          <Text style={[styles.retryBtnText, { color: colors.primaryText }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {posts.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateIcon}>🏟️</Text>
          <Text style={[styles.stateTitle, { color: colors.text }]}>
            {user ? 'No posts yet — be the first!' : 'Log in to join the conversation'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          onRefresh={() => { /* production: refetch */ }}
          refreshing={false}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              colors={colors}
              isAuthenticated={!!user}
              currentUserId={user?.id}
              onLike={() => handleLike(item.id)}
              onComment={() => setCommentPost(item)}
              onShare={() => handleShare(item)}
              onAvatarPress={() => {
                if (!user) router.push('/login');
                else router.push('/(drawer)/profile');
              }}
            />
          )}
        />
      )}

      {/* FAB */}
      {showFab && (
        <Pressable
          style={[styles.fab, { backgroundColor: colors.accent }]}
          onPress={handleFabPress}
          accessibilityLabel={user ? 'Create new post' : 'Log in to post'}
          accessibilityRole="button">
          <Text style={[styles.fabIcon, { color: colors.accentText }]}>+</Text>
        </Pressable>
      )}

      {/* Guest snackbar */}
      <Animated.View
        style={[styles.snackbar, { backgroundColor: colors.text, opacity: snackOpacity }]}
        pointerEvents="none">
        <Text style={[styles.snackbarText, { color: colors.surface }]}>{snackMsg}</Text>
      </Animated.View>

      {/* Modals */}
      <CommentSheet
        postId={commentPost?.id ?? null}
        commentsEnabled={commentPost?.commentsEnabled ?? true}
        commentVisibility={commentPost?.commentVisibility ?? 'public'}
        isPostAuthor={!!commentPost && commentPost.author.id === (user?.id ?? '')}
        onClose={() => setCommentPost(null)}
      />
      <AddPostModal visible={showAddPost} onClose={() => setShowAddPost(false)} />
    </View>
  );
}

interface CardProps {
  post: Post;
  colors: ReturnType<typeof import('@/hooks/use-colors').useColors>;
  isAuthenticated: boolean;
  currentUserId?: string;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onAvatarPress: () => void;
}

function PostCard({ post, colors, isAuthenticated, onLike, onComment, onShare, onAvatarPress }: CardProps) {
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [showAbsoluteTime, setShowAbsoluteTime] = useState(false);
  const absoluteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTimestampLongPress = () => {
    setShowAbsoluteTime(true);
    if (absoluteTimerRef.current) clearTimeout(absoluteTimerRef.current);
    absoluteTimerRef.current = setTimeout(() => setShowAbsoluteTime(false), 3000);
  };

  const absoluteTimeStr = new Date(post.createdAt).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Bounce animation for the heart icon
  const heartScale = useRef(new Animated.Value(1)).current;

  const handleLike = () => {
    onLike();
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.5, speed: 80, bounciness: 12, useNativeDriver: true }),
      Animated.spring(heartScale, { toValue: 1, speed: 40, bounciness: 6, useNativeDriver: true }),
    ]).start();
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Author row */}
      <View style={styles.authorRow}>
        <Pressable onPress={onAvatarPress}>
          <View style={[styles.avatar, { backgroundColor: post.author.avatarColor }]}>
            <Text style={styles.avatarText}>{post.author.avatarInitial}</Text>
          </View>
        </Pressable>
        <Pressable onPress={onAvatarPress} style={{ flex: 1 }}>
          <Text style={[styles.displayName, { color: colors.text }]}>{post.author.displayName}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            <Text style={[styles.usernameMeta, { color: colors.textMuted }]}>
              @{post.author.username} ·{' '}
            </Text>
            <Pressable onLongPress={handleTimestampLongPress} delayLongPress={350} hitSlop={6}>
              <Text style={[styles.usernameMeta, { color: colors.textMuted }]}>
                {showAbsoluteTime ? absoluteTimeStr : relativeTime(post.createdAt)}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </View>

      {/* Media — carousel, single image, or inline video */}
      {post.media.length > 0 && (
        <View style={styles.mediaContainer}>
          <MediaCarousel media={post.media} />
        </View>
      )}

      {/* Caption */}
      {!!post.caption && (
        <Pressable onPress={() => setCaptionExpanded((e) => !e)}>
          <Text
            style={[styles.caption, { color: colors.text }]}
            numberOfLines={captionExpanded ? undefined : 2}>
            {post.caption}
          </Text>
          {!captionExpanded && post.caption.length > 100 && (
            <Text style={[styles.moreText, { color: colors.accent }]}>more</Text>
          )}
        </Pressable>
      )}

      {/* Tags */}
      {post.tags.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll}>
          {post.tags.map((tag) => (
            <Pressable key={tag} style={[styles.tagPill, { borderColor: colors.border }]}>
              <Text style={[styles.tagPillText, { color: colors.accent }]}>{tag}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* Action row */}
      <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
        {/* Like with bounce animation */}
        <Pressable style={styles.actionBtn} onPress={handleLike} accessibilityLabel="Like">
          <Animated.Text
            style={[
              styles.actionIcon,
              { color: post.liked ? colors.danger : colors.textMuted },
              { transform: [{ scale: heartScale }] },
            ]}>
            {post.liked ? '♥' : '♡'}
          </Animated.Text>
          {post.likeCount > 0 && (
            <Text style={[styles.actionCount, { color: colors.textMuted }]}>{post.likeCount}</Text>
          )}
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={onComment} accessibilityLabel="Comment">
          <Text style={[styles.actionIcon, { color: colors.textMuted }]}>💬</Text>
          {post.commentCount > 0 && (
            <Text style={[styles.actionCount, { color: colors.textMuted }]}>{post.commentCount}</Text>
          )}
        </Pressable>

        {post.sharingEnabled && (
          <Pressable style={styles.actionBtn} onPress={onShare} accessibilityLabel="Share">
            <Text style={[styles.actionIcon, { color: colors.textMuted }]}>↗</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function FeedSkeleton({ colors }: { colors: ReturnType<typeof import('@/hooks/use-colors').useColors> }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 12, gap: 12 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, gap: 12 }]}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <SkeletonBox width={40} height={40} borderRadius={20} />
            <View style={{ flex: 1, gap: 6 }}>
              <SkeletonBox height={14} width="50%" />
              <SkeletonBox height={12} width="35%" />
            </View>
          </View>
          <SkeletonBox height={180} borderRadius={10} />
          <SkeletonBox height={14} />
          <SkeletonBox height={14} width="80%" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  feedContent: { padding: 12, gap: 12, paddingBottom: 100 },

  card: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 0,
    gap: 10,
  },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  displayName: { fontSize: 14, fontWeight: '700' },
  usernameMeta: { fontSize: 12 },

  // Break out of the card's paddingHorizontal: 14 so media is full card-width.
  // overflow: 'hidden' on the card clips the image to the card's border-radius.
  mediaContainer: { marginHorizontal: -14 },

  caption: { fontSize: 14, lineHeight: 20 },
  moreText: { fontSize: 13, fontWeight: '600' },

  tagsScroll: { marginVertical: 2 },
  tagPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, marginRight: 6 },
  tagPillText: { fontSize: 12, fontWeight: '500' },

  actionRow: {
    flexDirection: 'row',
    gap: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    marginTop: 2,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionIcon: { fontSize: 20 },
  actionCount: { fontSize: 13 },

  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  fabIcon: { fontSize: 30, fontWeight: '300', lineHeight: 34 },

  snackbar: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  snackbarText: { fontSize: 14, fontWeight: '500' },

  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  stateIcon: { fontSize: 48 },
  stateTitle: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  stateBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  retryBtnText: { fontSize: 15, fontWeight: '600' },
});
