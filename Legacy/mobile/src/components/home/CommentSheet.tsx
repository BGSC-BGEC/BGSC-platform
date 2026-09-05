import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { GlassInput } from '@/components/GlassInput';
import { PillButton } from '@/components/PillButton';
import { FONTS } from '@/core/theme/fonts';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { useColors } from '@/hooks/use-colors';
import type { FeedComment, FeedPost } from './types';
import { relativeTime } from './utils';

export interface CommentSheetProps {
  /** `null` hides the sheet. Keyed by post id in the parent so state resets per post. */
  post: FeedPost | null;
  onClose: () => void;
}

function CommentRow({ comment, depth }: { comment: FeedComment; depth: number }) {
  const colors = useColors();
  const requireAuth = useRequireAuth();
  const [liked, setLiked] = useState(false);

  const like = () => {
    if (!requireAuth('Log in to like this comment.')) return;
    setLiked((l) => !l);
    // TODO(phase2): real mutation once the feed service exists.
  };

  return (
    <View style={[styles.comment, { marginLeft: depth * 20, borderBottomColor: colors.border }]}>
      <View style={styles.commentHeader}>
        <View
          style={[
            styles.commentAvatar,
            { backgroundColor: comment.author.avatarColor ?? colors.accent },
          ]}
        >
          <Text style={[styles.commentAvatarText, { color: colors.accentText }]}>
            {comment.author.avatarInitial}
          </Text>
        </View>
        <Text style={[styles.commentName, { color: colors.text }]} numberOfLines={1}>
          {comment.author.name}
        </Text>
        <Text style={[styles.commentTime, { color: colors.textMuted }]}>
          {relativeTime(comment.createdAt)}
        </Text>
      </View>
      <Text style={[styles.commentBody, { color: colors.text }]}>{comment.body}</Text>
      <View style={styles.commentActions}>
        <Pressable
          onPress={like}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Unlike comment' : 'Like comment'}
          accessibilityState={{ selected: liked }}
          hitSlop={8}
          style={styles.commentAction}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={15}
            color={liked ? colors.accent : colors.textMuted}
          />
          <Text style={[styles.commentActionLabel, { color: liked ? colors.accent : colors.textMuted }]}>
            Like
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            // TODO(phase2): reply pre-fill (home-page.md §12.2) once posting exists.
          }}
          accessibilityRole="button"
          accessibilityLabel={`Reply to ${comment.author.name}`}
          hitSlop={8}
          style={styles.commentAction}
        >
          <Text style={[styles.commentActionLabel, { color: colors.textMuted }]}>Reply</Text>
        </Pressable>
      </View>
    </View>
  );
}

function CommentThread({ comment }: { comment: FeedComment }) {
  const colors = useColors();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? comment.replies : comment.replies.slice(0, 2);
  const hidden = comment.replies.length - visible.length;

  return (
    <>
      <CommentRow comment={comment} depth={0} />
      {visible.map((reply) => (
        <CommentRow key={reply.id} comment={reply} depth={1} />
      ))}
      {hidden > 0 ? (
        <Pressable
          onPress={() => setShowAll(true)}
          accessibilityRole="button"
          accessibilityLabel={`View ${hidden} more replies`}
          hitSlop={6}
          style={styles.repliesToggle}
        >
          <Text style={[styles.repliesToggleLabel, { color: colors.textMuted }]}>
            View {hidden} more repl{hidden === 1 ? 'y' : 'ies'}
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}

/**
 * Comment sheet (home-page.md H7): top-level comments + one reply level
 * (replies beyond two collapse behind "View N replies"), keyboard-safe input.
 * Guests read freely; writing opens the H9 login gate (§12.3).
 */
export function CommentSheet({ post, onClose }: CommentSheetProps) {
  const colors = useColors();
  const requireAuth = useRequireAuth();
  const [comments, setComments] = useState<FeedComment[]>(post?.comments ?? []);
  const [draft, setDraft] = useState('');

  const canWrite = post !== null;

  const send = () => {
    const text = draft.trim();
    if (!text || !post) return;
    setComments((list) => [
      ...list,
      {
        id: `local-${Date.now()}`,
        author: {
          id: 'me',
          name: 'You',
          username: 'you',
          avatarInitial: 'Y',
          avatarColor: colors.accent,
        },
        body: text,
        createdAt: new Date().toISOString(),
        replies: [],
      },
    ]);
    setDraft('');
    // TODO(phase2): replace local append with FeedRepository.addComment once the feed service exists.
  };

  const commentInput = canWrite ? (
    <>
      <View style={styles.inputRow}>
        <GlassInput
          label="Write a comment"
          value={draft}
          onChangeText={setDraft}
          placeholder="Share your thoughts…"
          accessibilityLabel="Write a comment"
        />
        <Pressable
          onPress={send}
          disabled={draft.trim().length === 0}
          accessibilityRole="button"
          accessibilityLabel="Send comment"
          style={[
            styles.send,
            { backgroundColor: draft.trim().length === 0 ? colors.border : colors.accent },
          ]}
        >
          <Ionicons name="send" size={18} color={colors.accentText} />
        </Pressable>
      </View>
    </>
  ) : (
    <PillButton
      label="Log in to comment"
      variant="ghost"
      onPress={() => requireAuth('Log in to comment.')}
      accessibilityLabel="Log in to comment"
    />
  );

  return (
    <BottomSheet visible={post !== null} onClose={onClose} title="Comments">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {comments.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>No comments yet.</Text>
          ) : (
            comments.map((comment) => <CommentThread key={comment.id} comment={comment} />)
          )}
        </ScrollView>
        {commentInput}
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: Dimensions.get('window').height * 0.55,
    paddingBottom: 8,
  },
  empty: {
    fontFamily: FONTS.body,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  comment: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
  },
  commentName: {
    fontFamily: FONTS.semibold,
    fontSize: 13,
    flexShrink: 1,
  },
  commentTime: {
    fontFamily: FONTS.body,
    fontSize: 11,
  },
  commentBody: {
    fontFamily: FONTS.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  commentAction: {
    minHeight: 36,
    minWidth: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
  },
  repliesToggle: {
    marginLeft: 48,
    paddingVertical: 6,
  },
  repliesToggleLabel: {
    fontFamily: FONTS.semibold,
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingTop: 12,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
