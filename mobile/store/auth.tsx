import React, {createContext, useState, useContext} from 'react';

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
            const response = await fetch('https://example.com/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({email, password}),
            });
            const data = await response.json();
            setUser(data.user);
            setIsLoggedIn(true);

        } catch(error){
            console.log('backend error:', error);
            setTimeout(()=>{
                setUser(Dummy);
                setIsLoggedIn(true);
                setIsLoading(false);
            }, 1000);
        } finally {
            setIsLoading(false);
        }
    };
    const logout = () => {
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

