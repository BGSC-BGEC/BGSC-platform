import { Drawer } from 'expo-router/drawer';

import { DrawerContent } from '@/components/drawer-content';
import { DynamicStatusBar } from '@/components/dynamic-status-bar';
import { useColors } from '@/hooks/use-colors';

/**
 * Side Drawer navigator (spec §3.2). Each screen registers a drawerLabel that
 * DrawerItemList renders automatically. Role-gated links (Union, Users) are
 * intentionally omitted until RBAC-aware navigation lands.
 */
export default function DrawerLayout() {
  const colors = useColors();

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        header: (props) => <DynamicStatusBar {...props} />,
        drawerActiveTintColor: colors.accent,
        drawerInactiveTintColor: colors.text,
      }}>
      <Drawer.Screen name="index" options={{ drawerLabel: 'Home', title: 'Home' }} />
      <Drawer.Screen name="events" options={{ drawerLabel: 'Events', title: 'Events' }} />
      <Drawer.Screen name="points" options={{ drawerLabel: 'Points & Challenges', title: 'Points' }} />
      <Drawer.Screen name="sponsors" options={{ drawerLabel: 'Sponsors', title: 'Sponsors' }} />
      <Drawer.Screen name="friends" options={{ drawerLabel: 'Friends', title: 'Friends' }} />
      <Drawer.Screen name="leaderboards" options={{ drawerLabel: 'Leaderboards', title: 'Leaderboards' }} />
      <Drawer.Screen name="hall-of-fame" options={{ drawerLabel: 'Hall of Fame', title: 'Hall of Fame' }} />
      <Drawer.Screen name="store" options={{ drawerLabel: 'Store', title: 'Store' }} />
      <Drawer.Screen name="media" options={{ drawerLabel: 'Media', title: 'Media' }} />
      <Drawer.Screen name="feedback" options={{ drawerLabel: 'Feedback & Contact', title: 'Feedback' }} />
      <Drawer.Screen
        name="profile"
        options={{ drawerLabel: 'My Profile', title: 'Profile' }}
      />
    </Drawer>
  );
}
