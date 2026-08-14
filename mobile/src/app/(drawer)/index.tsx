import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { HomeTabRail } from '@/components/home/HomeTabRail';
import { IntroTab } from '@/components/home/IntroTab';
import { AnnouncementsTab } from '@/components/home/AnnouncementsTab';
import { FeedTab } from '@/components/home/FeedTab';
import { useColors } from '@/hooks/use-colors';

/**
 * Home (master doc §9, home-page.md) — three tab surfaces behind a sticky
 * glass rail (home-page.md §5.2): Intro | Announcements | Feed. Tabs switch
 * by tap and horizontal swipe (§2.3); each tab owns its scroll position
 * because all three stay mounted inside the pager.
 *
 * Note: the shared `Screen` wrapper (single ScrollView) can't host a paged
 * root, so this uses the same canvas primitives (flex:1 + `colors.background`).
 */
export default function HomeScreen() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState(0);
  const pagerRef = useRef<ScrollView>(null);

  const selectTab = useCallback(
    (index: number) => {
      setActiveTab(index);
      pagerRef.current?.scrollTo({ x: index * width, animated: true });
    },
    [width],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <HomeTabRail active={activeTab} onChange={selectTab} />
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          if (index !== activeTab) setActiveTab(index);
        }}
      >
        <View style={{ width }}>
          <IntroTab onSwitchTab={selectTab} />
        </View>
        <View style={{ width }}>
          <AnnouncementsTab />
        </View>
        <View style={{ width }}>
          <FeedTab />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
