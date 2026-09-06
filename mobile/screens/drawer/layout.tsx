import * as React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';

import HallOfFame from './hall-of-fame';
import Feedback from './feedback';
import Events from './events';
import Announcement from './announcement';
import Home from './home';
import Leaderboard from './leaderboard';
import { useAuth } from '../../store/auth';

import LoginScreen from '../login/login';
import RegisterScreen from '../login/register';
import OtpScreen from '../login/otp';
import CompleteProfileScreen from '../login/complete-profile';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

function LogoutScreen() {
  const { logout } = useAuth();

  React.useEffect(() => {
    void logout();
  }, [logout]);

  return <View style={{ flex: 1, backgroundColor: '#FFF8F2' }} />;
}

function DrawerLayout() {
  const { isLoggedIn, logout } = useAuth();

  return (
    <NavigationContainer>
      {isLoggedIn ? (
        <Drawer.Navigator>
          <Drawer.Screen name="Home" component={Home} />
          <Drawer.Screen name="Announcement" component={Announcement} />
          <Drawer.Screen name="Events" component={Events} />
          <Drawer.Screen name="Feedback" component={Feedback} />
          <Drawer.Screen name="Hall of Fame" component={HallOfFame} />
          <Drawer.Screen name="Leaderboard" component={Leaderboard} />
          <Drawer.Screen
            name="Logout"
            component={LogoutScreen}
            options={{
              drawerLabel: 'Logout',
              drawerLabelStyle: {
                color: '#D32F2F',
                fontWeight: '700',
              },
              drawerActiveTintColor: '#D32F2F',
              drawerInactiveTintColor: '#D32F2F',
            }}
            listeners={{
              drawerItemPress: (e) => {
                e.preventDefault();
                void logout();
              },
            }}
          />
        </Drawer.Navigator>
      ) : (
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="OTP" component={OtpScreen} />
          <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

export default DrawerLayout;