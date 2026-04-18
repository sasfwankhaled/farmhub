/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { Sprout, Loader2, WifiOff } from 'lucide-react';
import { isAllowedAdminEmail } from './lib/authz';
import { FarmerAccount } from './types';
import { supabase } from './supabase';

import { AuthContext } from './contexts/AuthContext';
import { Navigation } from './components/layout/Navigation';
import { Login } from './pages/auth/Login';

const SettingsPage = lazy(() => import('./pages/Settings'));
const FarmManagementPage = lazy(() => import('./pages/FarmManagement'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ShipmentsPage = lazy(() => import('./pages/Shipments'));
const ShipmentCollectionsPage = lazy(() => import('./pages/ShipmentCollections'));
const FarmerDeliveryPage = lazy(() => import('./pages/FarmerDelivery'));

const ADMIN_REMEMBER_KEY = 'admin_remember_me';

export default function App() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [farmerSession, setFarmerSession] = useState<FarmerAccount | null>(() => {
    try {
      const raw = localStorage.getItem('farmer_session') || sessionStorage.getItem('farmer_session');
      return raw ? (JSON.parse(raw) as FarmerAccount) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const hydrate = async () => {
      try {
        const farmerRaw = localStorage.getItem('farmer_session') || sessionStorage.getItem('farmer_session');
        const farmer = farmerRaw ? (JSON.parse(farmerRaw) as FarmerAccount) : null;
        const { data } = await supabase.auth.getUser();
        const authEmail = data.user?.email?.toLowerCase();
        if (authEmail && isAllowedAdminEmail(authEmail)) {
          setUser({ email: authEmail });
          setFarmerSession(null);
          sessionStorage.removeItem('farmer_session');
          localStorage.removeItem('farmer_session');
        } else if (farmer) {
          setUser({ email: `farmer:${farmer.email || farmer.username || farmer.id}` });
          setFarmerSession(farmer);
        } else if (authEmail) {
          await supabase.auth.signOut();
          setUser(null);
          setFarmerSession(null);
          sessionStorage.removeItem('farmer_session');
          localStorage.removeItem('farmer_session');
        } else {
          setUser(null);
          setFarmerSession(null);
        }
      } catch {
        setUser(null);
        setFarmerSession(null);
        sessionStorage.removeItem('farmer_session');
        localStorage.removeItem('farmer_session');
      } finally {
        setLoading(false);
      }
    };
    hydrate();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const signInAdmin = async (email: string, pass: string, remember: boolean = true) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: pass,
    });
    if (error || !data.user?.email) {
      throw new Error('invalid-admin-credentials');
    }
    const normalizedEmail = data.user.email.toLowerCase();
    if (!isAllowedAdminEmail(normalizedEmail)) {
      await supabase.auth.signOut();
      throw new Error('admin-not-allowed');
    }
    setUser({ email: normalizedEmail });
    setFarmerSession(null);
    sessionStorage.removeItem('farmer_session');
    localStorage.removeItem('farmer_session');
    localStorage.setItem(ADMIN_REMEMBER_KEY, remember ? 'true' : 'false');
  };

  const signInFarmer = async (email: string, pass: string, remember: boolean = true) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: pass,
    });
    if (error || !data.user) {
      throw new Error('invalid-farmer-credentials');
    }

    const authUserId = data.user.id;
    const authEmail = (data.user.email || '').toLowerCase();

    let { data: account, error: accountError } = await supabase
      .from('farmer_accounts')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if ((!account || accountError) && authEmail) {
      const fallback = await supabase
        .from('farmer_accounts')
        .select('*')
        .eq('email', authEmail)
        .maybeSingle();
      account = fallback.data;
      accountError = fallback.error;
    }

    if (accountError || !account || !account.is_active) {
      await supabase.auth.signOut();
      throw new Error('farmer-account-not-linked');
    }

    const farmer: FarmerAccount = {
      id: account.id,
      username: account.username,
      email: account.email,
      authUserId: account.auth_user_id,
      farmerId: account.farmer_id,
      farmId: account.farm_id,
      isActive: account.is_active,
      createdAt: account.created_at,
    };

    setUser({ email: `farmer:${farmer.email || farmer.id}` });
    setFarmerSession(farmer);
    
    // Farmers use ONLY sessionStorage to avoid persistent storage on disk
    sessionStorage.setItem('farmer_session', JSON.stringify(farmer));
    localStorage.removeItem('farmer_session');
    
    // selectedFarmId for farmers is derived from session, not stored in localStorage
    localStorage.removeItem('selectedFarmId');
  };

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setFarmerSession(null);
    sessionStorage.removeItem('farmer_session');
    localStorage.removeItem('farmer_session');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Sprout className="w-12 h-12 text-green-600" />
        </motion.div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      farmerSession,
      loading, 
      signInWithEmail: async (e, p, remember) => { await signInAdmin(e, p, remember); },
      signInFarmer,
      logOut: handleLogOut,
    }}>
      <Toaster 
        position="top-center" 
        toastOptions={{
          duration: 3000,
          style: {
            background: '#333',
            color: '#fff',
            fontFamily: 'inherit',
            borderRadius: '1rem',
          },
          success: {
            style: { background: '#16a34a' },
          },
          error: {
            style: { background: '#dc2626' },
          },
        }} 
      />
      
      <AnimatePresence>
        {isOffline && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-0 left-0 right-0 z-[100] bg-red-500 text-white p-2 text-center text-sm font-bold flex items-center justify-center gap-2"
          >
            <WifiOff className="w-4 h-4" />
            أنت حالياً غير متصل بالإنترنت. التطبيق يعمل في وضع عدم الاتصال.
          </motion.div>
        )}
      </AnimatePresence>

      <Router>
        {!user ? (
          <div dir="rtl">
            <Login />
          </div>
        ) : (
          <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row-reverse" dir="rtl">
            <Navigation />
            <main className="flex-1 w-full max-w-full overflow-x-hidden lg:mr-64 lg:w-[calc(100%-16rem)] p-4 sm:p-6 lg:p-8">
              <Suspense
                fallback={
                  <div className="min-h-[40vh] flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
                  </div>
                }
              >
                <Routes>
                  {farmerSession ? (
                    <>
                      <Route path="/farm" element={<FarmManagementPage />} />
                      <Route path="*" element={<Navigate to="/farm" replace />} />
                    </>
                  ) : (
                    <>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/farm" element={<FarmManagementPage />} />
                      <Route path="/shipments" element={<ShipmentsPage />} />
                      <Route path="/shipment-collections" element={<ShipmentCollectionsPage />} />
                      <Route path="/farmer-delivery" element={<FarmerDeliveryPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </>
                  )}
                </Routes>
              </Suspense>
            </main>
          </div>
        )}
      </Router>
    </AuthContext.Provider>
  );
}
