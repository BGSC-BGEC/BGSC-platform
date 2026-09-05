import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import {Platform} from 'react-native';

const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    try {
      let token = null;
      if (Platform.OS === 'web') {
        token = localStorage.getItem('authToken');
      } else {
        token = await SecureStore.getItemAsync('authToken');
      }
      
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error fetching token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default apiClient;