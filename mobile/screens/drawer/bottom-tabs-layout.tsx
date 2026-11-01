import * as React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import Home from './home';
import Events from './events';
import Announcement from './announcement';
import Profile from './profile';
import { TabBar } from '../../src/navigation/TabBar';

const Tab = createBottomTabNavigator();

/**
 * Bottom tab navigator for main app sections: Home, Events, Updates, and Profile.
 */
export default function BottomTabsLayout() {
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="HomeTab" component={Home} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="EventsTab" component={Events} options={{ tabBarLabel: 'Events' }} />
      <Tab.Screen name="AnnouncementsTab" component={Announcement} options={{ tabBarLabel: 'Updates' }} />
      <Tab.Screen name="ProfileTab" component={Profile} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}
