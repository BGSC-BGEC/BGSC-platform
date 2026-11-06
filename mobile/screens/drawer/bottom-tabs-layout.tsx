import * as React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import Home from './home';
import Announcement from './announcement';
import { TabBar } from '../../src/navigation/TabBar';
import Social from './social';

const Tab = createBottomTabNavigator();

// v2: Home · Announcements · Social. Every other section lives in the drawer (see layout.tsx).
export default function BottomTabsLayout() {
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="HomeTab" component={Home} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="AnnouncementsTab" component={Announcement} options={{ tabBarLabel: 'Announcements' }} />
      <Tab.Screen name="SocialTab" component={Social} options={{ tabBarLabel: 'Social' }} />
    </Tab.Navigator>
  );
}
