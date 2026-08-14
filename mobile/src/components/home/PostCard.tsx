import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Animated, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/GlassCard';
import { FONTS } from '@/core/theme/fonts';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useColors } from '@/hooks/use-colors';
import type { FeedPost } from './types';
import { relativeTime } from './utils';

export interface PostCardProps {
  post: FeedPost;
  onComment: () => void;
}

const EXPAND_THRESHOLD = 140;

/**
 * Social feed post card (home-page.md §10.2): author row, two-line caption
 * with explicit More, quiet tag chips, 44×44 action row. Like is optimistic
 * with a Heart Confirm bounce (§15.8) and gates guests before toggling.
 */
export function PostCard({ post, onComment }: PostCardProps) {
  const colors = useColors();
  const requireAuth = useRequireAuth();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likes);
  const [expanded, setExpanded] = useState(false);
  const [heartScale] = useState(() => new Animated.Value(1));

  const needsExpand = post.text.length > EXPAND_THRESHOLD;

  const toggleLike = () => {
    if (!requireAuth('Log in to like this post.')) return;
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    // Heart Confirm (§15.8): 1 → 1.35 → 1, spring, only the heart moves.
    if (next) {
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1.35, speed: 40, bounciness: 12, useNativeDriver: true }),
        Animated.spring(heartScale, { toValue: 1, speed: 40, bounciness: 8, useNativeDriver: true }),
      ]).start();
    }
    // TODO(phase2): replace local toggle with FeedRepository.toggleLike mutation —
    // optimistic update + rollback on failure (home-page.md §10.3) once the feed service exists.
  };

  const share = () => {
    void Share.share({ message: `${post.author.name}: ${post.text}` });
  };

  return (
    <GlassCard style={styles.card}>
      <View style={styles.authorRow}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: post.author.avatarColor ?? colors.accent },
          ]}
        >
          <Text style={[styles.avatarText, { color: colors.accentText }]}>
            {post.author.avatarInitial}
          </Text>
        </View>
        <View style={styles.authorIdentity}>
          <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
            {post.author.name}
          </Text>
          <Text style={[styles.authorMeta, { color: colors.textMuted }]} numberOfLines={1}>
            @{post.author.username} · {relativeTime(post.createdAt)}
          </Text>
        </View>
      </View>

      {/* TODO(phase2): media region — reserve ~220 dp for image/video/carousel
          once the feed backend ships media (home-page.md §10.2/§11). Mock
          posts are text-only today. */}
      <Text style={[styles.caption, { color: colors.text }]} numberOfLines={expanded ? undefined : 2}>
        {post.text}
      </Text>
      {needsExpand ? (
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show less' : 'Show more'}
          hitSlop={8}
        >
          <Text style={[styles.more, { color: colors.accent }]}>
            {expanded ? 'less' : 'more'}
          </Text>
        </Pressable>
      ) : null}

      {post.tags.length > 0 ? (
        <View style={styles.tagsRow}>
          {post.tags.map((tag) => (
            <View key={tag} style={[styles.tag, { borderColor: colors.border }]}>
              <Text style={[styles.tagLabel, { color: colors.textMuted }]}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.actions}>
        <Pressable
          onPress={toggleLike}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Unlike post' : 'Like post'}
          accessibilityState={{ selected: liked }}
          hitSlop={6}
          style={styles.action}
        >
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={22}
              color={liked ? colors.accent : colors.textMuted}
            />
          </Animated.View>
          <Text style={[styles.actionLabel, { color: liked ? colors.accent : colors.textMuted }]}>
            {likes}
          </Text>
        </Pressable>
        <Pressable
          onPress={onComment}
          accessibilityRole="button"
          accessibilityLabel={`Comment on post (${post.comments.length})`}
          hitSlop={6}
          style={styles.action}
        >
          <Ionicons name="chatbubble-outline" size={21} color={colors.textMuted} />
          <Text style={[styles.actionLabel, { color: colors.textMuted }]}>
            {post.comments.length}
          </Text>
        </Pressable>
        <Pressable
          onPress={share}
          accessibilityRole="button"
          accessibilityLabel="Share post"
          hitSlop={6}
          style={styles.action}
        >
          <Ionicons name="share-social-outline" size={21} color={colors.textMuted} />
          <Text style={[styles.actionLabel, { color: colors.textMuted }]}>Share</Text>
        </Pressable>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    gap: 10,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  authorIdentity: {
    flex: 1,
  },
  authorName: {
    fontFamily: FONTS.semibold,
    fontSize: 15,
  },
  authorMeta: {
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 1,
  },
  caption: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 21,
  },
  more: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  tagLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  action: {
    minHeight: 44,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  actionLabel: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
});
