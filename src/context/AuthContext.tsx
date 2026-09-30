import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { api, setApiToken, getApiToken } from '../api/client';

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  token: string | null;
  isLoading: boolean;
  login: (identifier: string, password: string, roleHint?: string) => Promise<User>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  quickSwitch: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getApiToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize session
  useEffect(() => {
    async function initAuth() {
      const savedToken = getApiToken();
      if (savedToken) {
        try {
          const res = await api.auth.me();
          setUser(res.user);
        } catch {
          setApiToken(null);
          setToken(null);
          setUser(null);
        }
      } else {
        // Auto-login as Admin on first launch for immediate review
        try {
          const res = await api.auth.login('admin@election.gov.in', 'AdminPassword@2026', 'ADMIN');
          setApiToken(res.token);
          setToken(res.token);
          setUser(res.user);
        } catch {
          // If server not yet running or fails
        }
      }
      setIsLoading(false);
    }
    initAuth();
  }, []);

  const login = async (identifier: string, password: string, roleHint?: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await api.auth.login(identifier, password, roleHint);
      setApiToken(res.token);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore
    } finally {
      setApiToken(null);
      setToken(null);
      setUser(null);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const res = await api.auth.changePassword(currentPassword, newPassword);
    setApiToken(res.token);
    setToken(res.token);
    if (user) {
      setUser({ ...user, mustChangePassword: false, status: 'ACTIVE' });
    }
  };

  const refreshUser = async () => {
    try {
      const res = await api.auth.me();
      setUser(res.user);
    } catch {
      // Ignore
    }
  };

  const quickSwitch = async (targetRole: UserRole) => {
    setIsLoading(true);
    try {
      if (targetRole === 'ADMIN') {
        const res = await api.auth.login('admin@election.gov.in', 'AdminPassword@2026', 'ADMIN');
        setApiToken(res.token);
        setToken(res.token);
        setUser(res.user);
      } else if (targetRole === 'LEADER') {
        // Leader: Ananya Sharma
        const res = await api.auth.login('ananya.sharma@council.org', 'LeaderPassword@2026', 'LEADER');
        setApiToken(res.token);
        setToken(res.token);
        setUser(res.user);
      } else if (targetRole === 'VOTER') {
        // Voter: Aarav Gupta (House 102, Voter ID HOUSE-102-001)
        const res = await api.auth.login('aarav.voter@gmail.com', 'Voter@102A', 'VOTER');
        setApiToken(res.token);
        setToken(res.token);
        setUser(res.user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        token,
        isLoading,
        login,
        logout,
        changePassword,
        refreshUser,
        quickSwitch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
