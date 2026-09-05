import React from 'react';
import { View, Text, Button, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../../store/auth';

export default function LoginScreen() {
  const { login, isLoading } = useAuth();

  return (
    <View>
      <Text>BGSC Platform</Text>
      
      {isLoading ? (
        <ActivityIndicator size="large" />
      ) : (
        <Button title="Login with Dummy Data" onPress={() => login('jeet@example.com', 'demo')} />
      )}
    </View>
  );
}

