import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuthStore } from '@/core/stores/authStore';
import { useColors } from '@/hooks/use-colors';

import { BottomSheet } from './BottomSheet';
import { MOCK_COMMENTS } from './mock-data';
import { SkeletonBox } from './SkeletonBox';
import { relativeTime, type Comment, type Reply } from './types';

interface Props {
  postId: string | null;
  commentsEnabled: boolean;
  commentVisibility: 'public' | 'private' | 'protected';
  /** True when the current user is the author of the post being commented on. */
  isPostAuthor: boolean;
  onClose: () => void;
}

export function CommentSheet({ postId, commentsEnabled, commentVisibility, isPostAuthor, onClose }: Props) {
  const colors = useColors();
  const user = useAuthStore((s) => s.user);
  const visible = postId !== null;

  const [comments, setComments] = useState<Comment[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  // Simulate an async fetch every time the sheet opens for a new post.
  // In production: replace with a real API call keyed on postId.
  const fetchComments = () => {
    setLoadState('loading');
    setComments([]);
    const timer = setTimeout(() => {
      setComments(MOCK_COMMENTS);
      setLoadState('ready');
    }, 600);
    return () => clearTimeout(timer);
  };

  useEffect(() => {
    if (postId === null) return;
    return fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // ── Paginated "Load more" at top of thread ────────────────────────────────
  const [loadedAll, setLoadedAll] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await new Promise<void>((r) => setTimeout(r, 700));
    setLoadingMore(false);
    setLoadedAll(true); // mock: no older comments beyond initial load
  };

  // ── Undo delete snackbar ──────────────────────────────────────────────────
  const [pendingUndo, setPendingUndo] = useState<Comment | null>(null);
  const undoOpacity = useRef(new Animated.Value(0)).current;
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissUndo = () => {
    Animated.timing(undoOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() =>
      setPendingUndo(null)
    );
  };

  const showUndoSnackbar = (comment: Comment) => {
    setPendingUndo(comment);
    Animated.timing(undoOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(dismissUndo, 4000);
  };

  const handleUndoDelete = () => {
    if (!pendingUndo) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setComments((prev) =>
      [...prev, pendingUndo].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    );
    Animated.timing(undoOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setPendingUndo(null)
    );
  };

  const handleDeleteComment = (comment: Comment) => {
    setComments((prev) => prev.filter((c) => c.id !== comment.id));
    showUndoSnackbar(comment);
  };

  // ── Visibility gate ───────────────────────────────────────────────────────
  const canReadComments = (() => {
    if (!commentsEnabled) return false;
    if (commentVisibility === 'public') return true;
    if (commentVisibility === 'private') return isPostAuthor;
    // protected: visible to everyone except the post author
    if (commentVisibility === 'protected') return !isPostAuthor;
    return true;
  })();
  // Suppress unused-variable warning from type narrowing
  void canReadComments;

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !user) return;
    if (replyingTo) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === replyingTo
            ? {
                ...c,
                replies: [
                  ...c.replies,
                  {
                    id: `r${Date.now()}`,
                    author: {
                      id: user.id,
                      displayName: user.username,
                      avatarInitial: user.username[0].toUpperCase(),
                      avatarColor: colors.accent,
                    },
                    body: text,
                    likeCount: 0,
                    liked: false,
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : c
        )
      );
    } else {
      setComments((prev) => [
        ...prev,
        {
          id: `cm${Date.now()}`,
          author: {
            id: user.id,
            displayName: user.username,
            avatarInitial: user.username[0].toUpperCase(),
            avatarColor: colors.accent,
          },
          body: text,
          likeCount: 0,
          liked: false,
          createdAt: new Date().toISOString(),
          replies: [],
        },
      ]);
    }
    setInputText('');
    setReplyingTo(null);
  };

  const toggleLikeComment = (commentId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? { ...c, liked: !c.liked, likeCount: c.liked ? c.likeCount - 1 : c.likeCount + 1 }
          : c
      )
    );
  };

  const toggleExpandReplies = (commentId: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const renderBlockedState = () => {
    if (!commentsEnabled) {
      return (
        <View style={styles.blockedState}>
          <Text style={[styles.blockedText, { color: colors.textMuted }]}>
            Comments are turned off for this post.
          </Text>
        </View>
      );
    }
    if (commentVisibility === 'protected' && isPostAuthor) {
      return (
        <View style={styles.blockedState}>
          <Text style={[styles.blockedText, { color: colors.textMuted }]}>
            Comments are hidden from you on this post.
          </Text>
        </View>
      );
    }
    if (commentVisibility === 'private' && !isPostAuthor) {
      return (
        <View style={styles.blockedState}>
          <Text style={[styles.blockedText, { color: colors.textMuted }]}>
            Comments are private.
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} heightRatio={0.76}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Comments</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={[styles.closeBtn, { color: colors.textMuted }]}>✕</Text>
          </Pressable>
        </View>

        {renderBlockedState() ?? (
          <>
            {/* Loading skeleton — 3 comment-shaped rows */}
            {loadState === 'loading' && (
              <View style={styles.skeletonWrap}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.skeletonRow}>
                    <SkeletonBox width={32} height={32} borderRadius={16} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <SkeletonBox height={12} width="40%" />
                      <SkeletonBox height={13} />
                      <SkeletonBox height={13} width="80%" />
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Error state with inline retry */}
            {loadState === 'error' && (
              <View style={styles.errorState}>
                <Text style={[styles.errorText, { color: colors.textMuted }]}>
                  Couldn't load comments.{' '}
                </Text>
                <Pressable onPress={fetchComments}>
                  <Text style={[styles.retryLink, { color: colors.accent }]}>Retry</Text>
                </Pressable>
              </View>
            )}

            {loadState === 'ready' && comments.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No comments yet — be the first!
                </Text>
              </View>
            ) : loadState === 'ready' ? (
              <FlatList
                data={comments}
                keyExtractor={(c) => c.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                  loadedAll ? null : (
                    <Pressable
                      onPress={handleLoadMore}
                      disabled={loadingMore}
                      style={styles.loadMoreRow}>
                      {loadingMore ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Text style={[styles.loadMoreText, { color: colors.accent }]}>
                          Load more comments…
                        </Text>
                      )}
                    </Pressable>
                  )
                }
                renderItem={({ item }) => (
                  <CommentRow
                    comment={item}
                    colors={colors}
                    currentUserId={user?.id ?? null}
                    expanded={expandedReplies.has(item.id)}
                    onLike={() => toggleLikeComment(item.id)}
                    onReply={() => {
                      setReplyingTo(item.id);
                      setInputText(`@${item.author.displayName} `);
                    }}
                    onDelete={() => handleDeleteComment(item)}
                    onToggleReplies={() => toggleExpandReplies(item.id)}
                  />
                )}
                ListFooterComponent={<View style={{ height: 8 }} />}
              />
            ) : null}

            {/* Undo delete snackbar */}
            <Animated.View
              pointerEvents={pendingUndo ? 'auto' : 'none'}
              style={[
                styles.undoSnackbar,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: undoOpacity },
              ]}>
              <Text style={[styles.undoText, { color: colors.text }]}>Comment deleted</Text>
              <Pressable onPress={handleUndoDelete} hitSlop={8}>
                <Text style={[styles.undoBtn, { color: colors.accent }]}>Undo</Text>
              </Pressable>
            </Animated.View>

            {/* Input row — hidden while loading or in error */}
            {loadState === 'ready' && commentsEnabled && !(commentVisibility === 'protected' && isPostAuthor) && (
              <View
                style={[
                  styles.inputContainer,
                  { borderTopColor: colors.border, backgroundColor: colors.surface },
                ]}>
                {user && (
                  <View style={[styles.inputAvatar, { backgroundColor: colors.accent }]}>
                    <Text style={styles.inputAvatarText}>{user.username[0].toUpperCase()}</Text>
                  </View>
                )}
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
                  ]}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder={
                    user
                      ? replyingTo
                        ? 'Write a reply…'
                        : 'Write a comment…'
                      : 'Log in to comment'
                  }
                  placeholderTextColor={colors.textMuted}
                  editable={!!user}
                  maxLength={500}
                  multiline
                />
                <Pressable
                  onPress={handleSend}
                  disabled={!inputText.trim() || !user}
                  style={[
                    styles.sendBtn,
                    { backgroundColor: inputText.trim() && user ? colors.accent : colors.border },
                  ]}
                  accessibilityLabel="Send comment">
                  <Text style={[styles.sendBtnText, { color: colors.accentText }]}>▶</Text>
                </Pressable>
              </View>
            )}
            {inputText.length >= 400 && (
              <Text style={[styles.charCount, { color: colors.textMuted }]}>
                {inputText.length}/500
              </Text>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

interface CommentRowProps {
  comment: Comment;
  colors: ReturnType<typeof import('@/hooks/use-colors').useColors>;
  currentUserId: string | null;
  expanded: boolean;
  onLike: () => void;
  onReply: () => void;
  onDelete: () => void;
  onToggleReplies: () => void;
}

function CommentRow({ comment, colors, currentUserId, expanded, onLike, onReply, onDelete, onToggleReplies }: CommentRowProps) {
  const isOwnComment = currentUserId !== null && comment.author.id === currentUserId;

  const handleLongPress = () => {
    if (isOwnComment) {
      // Own comment: delete immediately — undo snackbar in parent handles recovery
      onDelete();
    } else {
      Alert.alert('Report comment', 'Why are you reporting this?', [
        { text: 'Spam', onPress: () => {} },
        { text: 'Harassment or hate speech', onPress: () => {} },
        { text: 'Inappropriate content', onPress: () => {} },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <View style={styles.commentWrap}>
      <Pressable style={styles.commentRow} onLongPress={handleLongPress} delayLongPress={400}>
        <View style={[styles.avatar, { backgroundColor: comment.author.avatarColor }]}>
          <Text style={styles.avatarText}>{comment.author.avatarInitial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.commentMeta}>
            <Text style={[styles.commentAuthor, { color: colors.text }]}>
              {comment.author.displayName}
            </Text>
            <Text style={[styles.commentTime, { color: colors.textMuted }]}>
              {relativeTime(comment.createdAt)}
            </Text>
          </View>
          <Text style={[styles.commentBody, { color: colors.text }]}>{comment.body}</Text>
          <View style={styles.commentActions}>
            <Pressable onPress={onLike} style={styles.commentAction}>
              <Text style={[styles.commentActionText, { color: comment.liked ? colors.danger : colors.textMuted }]}>
                {comment.liked ? '♥' : '♡'}{comment.likeCount > 0 ? ` ${comment.likeCount}` : ''}
              </Text>
            </Pressable>
            <Pressable onPress={onReply} style={styles.commentAction}>
              <Text style={[styles.commentActionText, { color: colors.textMuted }]}>Reply</Text>
            </Pressable>
            {isOwnComment && (
              <Pressable onPress={onDelete}>
                <Text style={[styles.commentActionText, { color: colors.danger }]}>Delete</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>

      {/* Replies */}
      {comment.replies.length > 0 && (
        <View style={styles.repliesWrap}>
          {!expanded && comment.replies.length > 2 ? (
            <Pressable onPress={onToggleReplies}>
              <Text style={[styles.viewMoreReplies, { color: colors.accent }]}>
                View {comment.replies.length} replies
              </Text>
            </Pressable>
          ) : (
            <>
              {(expanded ? comment.replies : comment.replies.slice(0, 2)).map((reply) => (
                <ReplyRow key={reply.id} reply={reply} colors={colors} />
              ))}
              {expanded && comment.replies.length > 2 && (
                <Pressable onPress={onToggleReplies}>
                  <Text style={[styles.viewMoreReplies, { color: colors.accent }]}>
                    Collapse replies
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

function ReplyRow({ reply, colors }: { reply: Reply; colors: ReturnType<typeof import('@/hooks/use-colors').useColors> }) {
  return (
    <View style={styles.replyRow}>
      <View style={[styles.replyAvatar, { backgroundColor: reply.author.avatarColor }]}>
        <Text style={styles.replyAvatarText}>{reply.author.avatarInitial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.commentMeta}>
          <Text style={[styles.commentAuthor, { color: colors.text }]}>{reply.author.displayName}</Text>
          <Text style={[styles.commentTime, { color: colors.textMuted }]}>{relativeTime(reply.createdAt)}</Text>
        </View>
        <Text style={[styles.commentBody, { color: colors.text }]}>{reply.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  closeBtn: { fontSize: 18 },

  blockedState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  blockedText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  listContent: { paddingHorizontal: 16, paddingTop: 8 },

  loadMoreRow: { alignItems: 'center', paddingVertical: 12 },
  loadMoreText: { fontSize: 13, fontWeight: '600' },

  commentWrap: { marginBottom: 16 },
  commentRow: { flexDirection: 'row', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  commentMeta: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 3 },
  commentAuthor: { fontSize: 13, fontWeight: '700' },
  commentTime: { fontSize: 12 },
  commentBody: { fontSize: 14, lineHeight: 20 },
  commentActions: { flexDirection: 'row', gap: 14, marginTop: 6 },
  commentAction: {},
  commentActionText: { fontSize: 13 },

  repliesWrap: { marginLeft: 42, marginTop: 8, gap: 10 },
  viewMoreReplies: { fontSize: 13, fontWeight: '600' },

  replyRow: { flexDirection: 'row', gap: 8 },
  replyAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  replyAvatarText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  skeletonWrap: { paddingHorizontal: 16, paddingTop: 12, gap: 18 },
  skeletonRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },

  errorState: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  errorText: { fontSize: 14 },
  retryLink: { fontSize: 14, fontWeight: '700' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14 },

  undoSnackbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  undoText: { fontSize: 14 },
  undoBtn: { fontSize: 14, fontWeight: '700' },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  inputAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnText: { fontSize: 14, fontWeight: '700' },
  charCount: { fontSize: 11, textAlign: 'right', paddingRight: 14, paddingBottom: 4 },
});
