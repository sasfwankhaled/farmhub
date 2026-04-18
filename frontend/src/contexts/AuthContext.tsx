import { createContext, useContext } from 'react';
import { FarmerAccount } from '../types';

export const AuthContext = createContext<{
  user: { email: string } | null;
  farmerSession: FarmerAccount | null;
  loading: boolean;
  signInWithEmail: (email: string, pass: string, remember?: boolean) => Promise<void>;
  signInFarmer: (email: string, pass: string, remember?: boolean) => Promise<void>;
  logOut: () => Promise<void>;
}>({
  user: null,
  farmerSession: null,
  loading: true,
  signInWithEmail: async () => {},
  signInFarmer: async () => {},
  logOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);
