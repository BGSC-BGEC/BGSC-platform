import React, {createContext, useState, useContext} from 'react';
import apiClient from '../services/apiclient';
import * as SecureStore from 'expo-secure-store';
import {Platform} from 'react-native';

const Dummy={
    id:'001',
    username:'Jeet',
    email:'jeet@example.com',
    role:'user',
}

export const auth = createContext<any>(null);

export const AuthProvider = ({children}: {children: React.ReactNode})=>{
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const login = async (email?:string, password?:string) => {
        setIsLoading(true);
        setError(null);

        try{
            const response = await apiClient.post('/auth/login', { email, password });
            const data = response.data;
            const validToken = data.token ? String(data.token) : 'dummy_token_string';
            if(Platform.OS === 'web') {
                localStorage.setItem('authToken', validToken);
            } else {
                await SecureStore.setItemAsync('authToken', validToken);
            }
            setUser(data.user);
            setIsLoggedIn(true);
            setIsLoading(false);

        } catch(error){
            console.log('backend error:', error);
            if(Platform.OS === 'web') {
                localStorage.setItem('authToken', 'dummy_token_string');
            } else {
                await SecureStore.setItemAsync('authToken', 'dummy_token_string');
            }
            setTimeout(()=>{
                setUser(Dummy);
                setIsLoggedIn(true);
                setIsLoading(false);
            }, 1000);
        }
    };
    const logout = async () => {
        if(Platform.OS === 'web') {
            localStorage.removeItem('authToken');
        } else {
            await SecureStore.deleteItemAsync('authToken');
        }
        setIsLoggedIn(false);
        setUser(null);
    };
    return (
        <auth.Provider value={{isLoggedIn, user, isLoading, error, login, logout}}>
            {children}
        </auth.Provider>
    );
}

export const useAuth = () => useContext(auth);

