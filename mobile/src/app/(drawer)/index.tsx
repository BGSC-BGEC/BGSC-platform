import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AnnouncementsTab } from '@/components/home/AnnouncementsTab';
import { FeedTab } from '@/components/home/FeedTab';
import { IntroTab } from '@/components/home/IntroTab';
import { useColors } from '@/hooks/use-colors';

const SCREEN_W = Dimensions.get('window').width;

const TABS = [
  { key: 'intro', label: 'Introduction', icon: '⌂' },
  { key: 'announcements', label: 'Announcements', icon: '📣' },
  { key: 'feed', label: 'Feed', icon: '📰' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

/**
 * Home screen (spec §2). Three-tab view:
 *  Tab 0 — Introduction / Landing
 *  Tab 1 — Announcements
 *  Tab 2 — General Social Feed (with FAB)
 *
 * Tab switching supports both tap and horizontal swipe.
 * The incoming tab content slides in from the appropriate edge.
 */
export default function HomeScreen() {
  const colors = useColors();
  const [activeTab, setActiveTab] = useState<TabKey>('intro');
  const [scrollToAnnouncementId, setScrollToAnnouncementId] = useState<string | null>(null);
  const [introHasError, setIntroHasError] = useState(false);

  // Ref tracks the current tab index so PanResponder closure is never stale.
  const activeIdxRef = useRef(0);
  // Animation driving the incoming tab's horizontal slide.
  const slideAnim = useRef(new Animated.Value(0)).current;

  const switchTab = useCallback(
    (key: TabKey, index: number) => {
      const direction = index > activeIdxRef.current ? 1 : -1;
      activeIdxRef.current = index;

      // Position the new content off-screen in the correct direction,
      // then animate it to centre (translateX = 0).
      slideAnim.setValue(direction * SCREEN_W);
      setActiveTab(key);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    },
    [slideAnim],
  );

  // Horizontal-only swipe gesture that does not conflict with vertical scrolling.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, { dx, dy }) =>
          Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 2,
        onPanResponderRelease: (_, { dx, vx }) => {
          const idx = activeIdxRef.current;
          if ((dx < -60 || vx < -0.8) && idx < TABS.length - 1) {
            switchTab(TABS[idx + 1].key, idx + 1);
          } else if ((dx > 60 || vx > 0.8) && idx > 0) {
            switchTab(TABS[idx - 1].key, idx - 1);
          }
        },
      }),
    [switchTab],
  );

  const handleCoordinatorAnnouncementTap = (announcementId: string) => {
    setScrollToAnnouncementId(announcementId);
    switchTab('announcements', 1);
    setTimeout(() => setScrollToAnnouncementId(null), 3000);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Sticky Tab Bar ── */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {TABS.map((tab, i) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={styles.tabItem}
              onPress={() => switchTab(tab.key, i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}>
              <Text style={[styles.tabIcon, { color: isActive ? colors.accent : colors.textMuted }]}>
                {tab.icon}
              </Text>
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? colors.accent : colors.textMuted },
                  isActive && styles.tabLabelActive,
                ]}>
                {tab.label}
              </Text>
              {isActive && (
                <View style={[styles.tabUnderline, { backgroundColor: colors.accent }]} />
              )}
            </Pressable>
          );
        })}
      </View>

      {/* ── Tab Content with swipe gesture + slide animation ── */}
      <Animated.View
        style={[styles.content, { transform: [{ translateX: slideAnim }] }]}
        {...panResponder.panHandlers}>
        {activeTab === 'intro' && (
          <IntroTab
            hasError={introHasError}
            onRetry={() => setIntroHasError(false)}
            onSeeAllAnnouncements={() => switchTab('announcements', 1)}
            onCoordinatorAnnouncementTap={handleCoordinatorAnnouncementTap}
          />
        )}
        {activeTab === 'announcements' && (
          <AnnouncementsTab scrollToAnnouncementId={scrollToAnnouncementId} />
        )}
        {activeTab === 'feed' && <FeedTab showFab />}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 3,
    position: 'relative',
  },
  tabIcon: { fontSize: 18 },
  tabLabel: { fontSize: 12, fontWeight: '500' },
  tabLabelActive: { fontWeight: '700' },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2.5,
    borderRadius: 2,
  },

  content: { flex: 1 },
});
