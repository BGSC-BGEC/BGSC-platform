import * as React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import HallOfFame from './hall-of-fame';
import Feedback from './feedback';
import Announcement from './announcement';
import BottomTabsLayout from './bottom-tabs-layout';
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

function DrawerWithTabs() {
  const { logout } = useAuth();

  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerActiveTintColor: '#FF6B35',
        drawerInactiveTintColor: '#6E665D',
        drawerType: 'front',
      }}
    >
      <Drawer.Screen
        name="MainTabs"
        component={BottomTabsLayout}
        options={{
          drawerLabel: 'Home',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Announcements"
        component={Announcement}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="megaphone-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Hall of Fame"
        component={HallOfFame}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="star-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Feedback"
        component={Feedback}
        options={{
          drawerIcon: ({ color, size }) => (
            <Ionicons name="chatbox-outline" size={size} color={color} />
          ),
        }}
      />
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
          drawerIcon: ({ color, size }) => (
            <Ionicons name="log-out-outline" size={size} color={color} />
          ),
        }}
        listeners={{
          drawerItemPress: (e) => {
            e.preventDefault();
            void logout();
          },
        }}
      />
    </Drawer.Navigator>
  );
}

function DrawerLayout() {
  const { isLoggedIn } = useAuth();

  return (
    <NavigationContainer>
      {isLoggedIn ? (
        <DrawerWithTabs />
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