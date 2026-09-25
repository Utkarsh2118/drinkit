import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Address } from '../types.ts';
import { api } from '../services/api.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isLoggingOut: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone: string; dateOfBirth: string }) => Promise<void>;
  sendCustomerOtp: (phone: string) => Promise<{ phone: string; expiresInSeconds: number; resendCooldownSeconds: number; devOtp?: string; isExistingCustomer: boolean }>;
  verifyCustomerOtp: (phone: string, otp: string) => Promise<{ isNewUser: boolean; user?: User; token?: string }>;
  completeCustomerProfile: (phone: string, name: string, email?: string, dateOfBirth?: string) => Promise<User>;
  adminLogin: (adminId: string, pass: string) => Promise<User>;
  storeLogin: (staffId: string, pass: string) => Promise<User>;
  deliveryLogin: (agentId: string, credential: string) => Promise<User>;
  switchDemoUser: (email: string) => Promise<void>;
  verifyAge: (dateOfBirth: string) => Promise<void>;
  addAddress: (address: Omit<Address, 'id' | 'isDefault'>) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<User>;
  uploadAvatar: (avatarData: string, mimeType?: string) => Promise<string>;
  requestPhoneChangeOtp: () => Promise<string | undefined>;
  verifyPhoneChange: (currentPhoneOtp: string, newPhone: string, newPhoneOtp: string) => Promise<User>;
  deactivateAccount: (reason: string, confirmText: string) => Promise<void>;
  logout: () => Promise<void>;
  isAgeVerified: boolean;
  isCustomerAuthModalOpen: boolean;
  setIsCustomerAuthModalOpen: (open: boolean) => void;
  isAdminAuthModalOpen: boolean;
  setIsAdminAuthModalOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('drinkit_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [isCustomerAuthModalOpen, setIsCustomerAuthModalOpen] = useState<boolean>(false);
  const [isAdminAuthModalOpen, setIsAdminAuthModalOpen] = useState<boolean>(false);

  // Restore authenticated session from token or remain guest
  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        try {
          const userData = await api.get<User>('/auth/me');
          setUser(userData);
        } catch (e) {
          localStorage.removeItem('drinkit_token');
          setToken(null);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const sendCustomerOtp = async (phone: string) => {
    const res = await api.post<{ phone: string; expiresInSeconds: number; resendCooldownSeconds: number; devOtp?: string; isExistingCustomer: boolean }>(
      '/auth/otp/send',
      { phone }
    );
    return res;
  };

  const verifyCustomerOtp = async (phone: string, otp: string) => {
    const res = await api.post<{ isNewUser: boolean; user?: User; token?: string; phone?: string }>(
      '/auth/otp/verify',
      { phone, otp }
    );

    if (!res.isNewUser && res.token && res.user) {
      localStorage.setItem('drinkit_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setIsCustomerAuthModalOpen(false);
    }
    return { isNewUser: res.isNewUser, user: res.user, token: res.token };
  };

  const completeCustomerProfile = async (phone: string, name: string, email?: string, dateOfBirth?: string) => {
    const res = await api.post<{ user: User; token: string }>('/auth/otp/complete-profile', {
      phone,
      name,
      email,
      dateOfBirth,
    });
    localStorage.setItem('drinkit_token', res.token);
    setToken(res.token);
    setUser(res.user);
    setIsCustomerAuthModalOpen(false);
    return res.user;
  };

  const adminLogin = async (adminId: string, pass: string) => {
    const res = await api.post<{ user: User; token: string }>('/auth/admin/login', {
      adminId,
      password: pass,
    });
    localStorage.setItem('drinkit_token', res.token);
    setToken(res.token);
    setUser(res.user);
    setIsAdminAuthModalOpen(false);
    return res.user;
  };

  const storeLogin = async (staffId: string, pass: string) => {
    const res = await api.post<{ user: User; token: string }>('/auth/store/login', {
      staffId,
      password: pass,
    });
    localStorage.setItem('drinkit_token', res.token);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const deliveryLogin = async (agentId: string, credential: string) => {
    const res = await api.post<{ user: User; token: string }>('/auth/delivery/login', {
      agentId,
      password: credential,
      otp: credential,
    });
    localStorage.setItem('drinkit_token', res.token);
    setToken(res.token);
    setUser(res.user);
    return res.user;
  };

  const login = async (email: string, pass: string) => {
    const res = await api.post<{ user: User; token: string }>('/auth/login', { email, password: pass });
    localStorage.setItem('drinkit_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (data: { name: string; email: string; password: string; phone: string; dateOfBirth: string }) => {
    const res = await api.post<{ user: User; token: string }>('/auth/register', data);
    localStorage.setItem('drinkit_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const switchDemoUser = async (email: string) => {
    try {
      const res = await api.post<{ user: User; token: string }>('/auth/switch-role', { email });
      localStorage.setItem('drinkit_token', res.token);
      setToken(res.token);
      setUser(res.user);
    } catch (e) {
      console.error('Failed to switch demo user', e);
    }
  };

  const verifyAge = async (dateOfBirth: string) => {
    const updatedUser = await api.post<User>('/auth/verify-age', { dateOfBirth });
    setUser(updatedUser);
  };

  const addAddress = async (addrData: Omit<Address, 'id' | 'isDefault'>) => {
    const addresses = await api.post<Address[]>('/auth/addresses', addrData);
    if (user) {
      setUser({ ...user, addresses });
    }
  };

  const deleteAddress = async (id: string) => {
    const addresses = await api.delete<Address[]>(`/auth/addresses/${id}`);
    if (user) {
      setUser({ ...user, addresses });
    }
  };

  const updateProfile = async (data: Partial<User>): Promise<User> => {
    const res = await api.patch<User>('/profile', data);
    setUser(res);
    return res;
  };

  const uploadAvatar = async (avatarData: string, mimeType?: string): Promise<string> => {
    const res = await api.post<{ avatarUrl: string }>('/profile/avatar', { avatarData, mimeType });
    if (user) {
      setUser({ ...user, avatarUrl: res.avatarUrl });
    }
    return res.avatarUrl;
  };

  const requestPhoneChangeOtp = async (): Promise<string | undefined> => {
    const res = await api.post<{ devOtp?: string }>('/profile/change-phone/request-current-otp', {});
    return res.devOtp;
  };

  const verifyPhoneChange = async (currentPhoneOtp: string, newPhone: string, newPhoneOtp: string): Promise<User> => {
    const res = await api.post<User>('/profile/change-phone/verify-and-update', {
      currentPhoneOtp,
      newPhone,
      newPhoneOtp,
    });
    setUser(res);
    return res;
  };

  const deactivateAccount = async (reason: string, confirmText: string): Promise<void> => {
    await api.post('/profile/deactivate', { reason, confirmText });
    localStorage.removeItem('drinkit_token');
    setToken(null);
    setUser(null);
  };

  const logout = async () => {
    setIsLoggingOut(true);
    try {
      if (token) {
        await api.post('/auth/logout', {});
      }
    } catch (e) {
      // Proceed with client cleanup regardless
    } finally {
      localStorage.removeItem('drinkit_token');
      setToken(null);
      setUser(null);
      setIsLoggingOut(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isLoggingOut,
        login,
        register,
        sendCustomerOtp,
        verifyCustomerOtp,
        completeCustomerProfile,
        adminLogin,
        storeLogin,
        deliveryLogin,
        switchDemoUser,
        verifyAge,
        addAddress,
        deleteAddress,
        updateProfile,
        uploadAvatar,
        requestPhoneChangeOtp,
        verifyPhoneChange,
        deactivateAccount,
        logout,
        isAgeVerified: Boolean(user?.isAgeVerified),
        isCustomerAuthModalOpen,
        setIsCustomerAuthModalOpen,
        isAdminAuthModalOpen,
        setIsAdminAuthModalOpen,
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
