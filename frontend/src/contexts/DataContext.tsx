/**
 * GlobalDataContext — Single Source of Truth for all shared collections.
 * Establishes ONE set of Supabase Realtime subscriptions for the entire app.
 * All pages consume shared data via the `useData()` hook — zero re-fetching on navigation.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { subscribeToCollection, getDocument, updateDocument, createDocument, deleteDocument } from '../services/db';
import {
  Shipment, Entity, Crop, Farm, FarmExpense, VehicleExpense,
  Attendance, WorkerPayment, GlobalPrice, Settings, FarmerAccount,
} from '../types';

interface DataContextValue {
  // Core collections
  shipments: Shipment[];
  entities: Entity[];
  crops: Crop[];
  farms: Farm[];
  farmExpenses: FarmExpense[];
  vehicleExpenses: VehicleExpense[];
  attendance: Attendance[];
  workerPayments: WorkerPayment[];
  globalPrices: GlobalPrice[];
  farmerAccounts: FarmerAccount[];
  settings: Settings | null;

  // Loading flag — true only during the very first fetch
  isDataReady: boolean;

  // Mutation helpers (pass-through wrappers so pages don't touch db.ts directly)
  refreshSettings: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children, isAdminMode }: { children: ReactNode; isAdminMode: boolean }) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmExpenses, setFarmExpenses] = useState<FarmExpense[]>([]);
  const [vehicleExpenses, setVehicleExpenses] = useState<VehicleExpense[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [workerPayments, setWorkerPayments] = useState<WorkerPayment[]>([]);
  const [globalPrices, setGlobalPrices] = useState<GlobalPrice[]>([]);
  const [farmerAccounts, setFarmerAccounts] = useState<FarmerAccount[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isDataReady, setIsDataReady] = useState(false);

  const sortByDate = <T extends { date?: string; createdAt?: string }>(data: T[]) =>
    [...data].sort((a, b) => {
      const dateA = a.createdAt || a.date || '';
      const dateB = b.createdAt || b.date || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  const refreshSettings = useCallback(async () => {
    const st = await getDocument<Settings>('settings', 'global');
    if (st) setSettings(st);
  }, []);

  useEffect(() => {
    if (!isAdminMode) {
      // Farmer-only mode: minimal subscriptions, farms/crops only
      const u1 = subscribeToCollection<Shipment>('shipments', (d) => setShipments(sortByDate(d)));
      const u2 = subscribeToCollection<Crop>('crops', setCrops);
      const u3 = subscribeToCollection<Entity>('entities', setEntities);
      const u4 = subscribeToCollection<Farm>('farms', setFarms);
      const u5 = subscribeToCollection<GlobalPrice>('global_prices', setGlobalPrices);
      refreshSettings().finally(() => setIsDataReady(true));
      return () => { u1(); u2(); u3(); u4(); u5(); };
    }

    // Admin mode: all collections
    let initialLoadCount = 0;
    const totalCollections = 10;
    const markReady = () => {
      initialLoadCount++;
      if (initialLoadCount >= totalCollections) setIsDataReady(true);
    };

    const u1 = subscribeToCollection<Shipment>('shipments', (d) => { setShipments(sortByDate(d)); markReady(); });
    const u2 = subscribeToCollection<Entity>('entities', (d) => { setEntities(d); markReady(); });
    const u3 = subscribeToCollection<Crop>('crops', (d) => { setCrops(d); markReady(); });
    const u4 = subscribeToCollection<Farm>('farms', (d) => { setFarms(d); markReady(); });
    const u5 = subscribeToCollection<FarmExpense>('farm_expenses', (d) => { setFarmExpenses(sortByDate(d)); markReady(); });
    const u6 = subscribeToCollection<VehicleExpense>('vehicle_expenses', (d) => { setVehicleExpenses(d); markReady(); });
    const u7 = subscribeToCollection<Attendance>('attendance', (d) => { setAttendance(sortByDate(d)); markReady(); });
    const u8 = subscribeToCollection<WorkerPayment>('worker_payments', (d) => { setWorkerPayments(sortByDate(d)); markReady(); });
    const u9 = subscribeToCollection<GlobalPrice>('global_prices', (d) => { setGlobalPrices(d); markReady(); });
    const u10 = subscribeToCollection<FarmerAccount>('farmer_accounts', (d) => { setFarmerAccounts(d); markReady(); });
    refreshSettings();

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); u10(); };
  }, [isAdminMode]);

  return (
    <DataContext.Provider value={{
      shipments, entities, crops, farms, farmExpenses, vehicleExpenses,
      attendance, workerPayments, globalPrices, farmerAccounts, settings,
      isDataReady, refreshSettings,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
