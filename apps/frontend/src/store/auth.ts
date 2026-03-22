import { create } from 'zustand';
import { authApi, type Merchant } from '@/lib/api';

interface AuthState {
  token: string | null;
  merchant: Merchant | null;
  isLoading: boolean;
  setAuth: (token: string, merchant: Merchant) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  merchant: null,
  isLoading: true,

  setAuth: (token, merchant) => {
    localStorage.setItem('payfuse_token', token);
    set({ token, merchant, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('payfuse_token');
    set({ token: null, merchant: null, isLoading: false });
  },

  fetchMe: async () => {
    try {
      const { data } = await authApi.me();
      set({ merchant: data.data, isLoading: false });
    } catch {
      localStorage.removeItem('payfuse_token');
      set({ token: null, merchant: null, isLoading: false });
    }
  },

  hydrate: () => {
    const token = localStorage.getItem('payfuse_token');
    if (token) {
      set({ token });
    } else {
      set({ isLoading: false });
    }
  },
}));
