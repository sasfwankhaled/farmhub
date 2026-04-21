import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  Sprout, ChevronDown, TrendingUp, Droplets, Users, Package, ArrowUpRight, Wallet,
  Layout, BarChart3, Calendar, Plus, X, Loader2
} from 'lucide-react';
import { useFarmAnalytics } from '../hooks/useFarmAnalytics';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { createDocument, updateDocument, deleteDocument, getDocument } from '../services/db';
import { FarmExpense, Shipment, Entity, Attendance, WorkerPayment, Crop, Farm, GlobalPrice, Settings } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { useData } from '../contexts/DataContext';

import { FarmSummaryTab } from '../features/farm/components/FarmSummaryTab';
import { FarmExpensesTab } from '../features/farm/components/FarmExpensesTab';
import { FarmWorkersTab } from '../features/farm/components/FarmWorkersTab';
import { FarmReportsTab } from '../features/farm/components/FarmReportsTab';

const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

export default function FarmManagementPage() {
  const { farmerSession } = useAuth();
  const isFarmerReadonly = !!farmerSession;

  // ── Admin data from Global Context ────────────────────────────────────
  const {
    farmExpenses, attendance, workerPayments, entities, crops, farms, globalPrices, shipments, settings
  } = useData();

  // ── Farmer-only state (loaded via SECURITY DEFINER RPC) ─────────────
  const [farmerData, setFarmerData] = useState<any>(null);
  const [farmerLoading, setFarmerLoading] = useState(false);

  // ── Shared state ─────────────────────────────────────────────────────
  const [selectedFarmId, setSelectedFarmId] = useState<string>(() =>
    // Farmers always use their assigned farmId — NO localStorage dependency
    farmerSession?.farmId || localStorage.getItem('selectedFarmId') || ''
  );
  const [activeTab, setActiveTab] = useState<'summary' | 'expenses' | 'workers' | 'reports'>('summary');
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState<Shipment['status'] | 'all'>('all');
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isAddingAttendance, setIsAddingAttendance] = useState(false);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedWorkerForDetails, setSelectedWorkerForDetails] = useState<Entity | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newFarmExpense, setNewFarmExpense] = useState<Partial<FarmExpense>>({ type: 'water', quantity: 0, cost: 0, date: new Date().toISOString().split('T')[0], day: '' });
  const [newAttendance, setNewAttendance] = useState<Partial<Attendance>>({ date: new Date().toISOString().split('T')[0], day: '', startTime: '07:00', endTime: '16:00' });
  const [newPayment, setNewPayment] = useState<Partial<WorkerPayment>>({ date: new Date().toISOString().split('T')[0], day: '', amount: 0 });
  const [bulkAttendance, setBulkAttendance] = useState({ date: new Date().toISOString().split('T')[0], day: '', startTime: '07:00', endTime: '15:00', selectedWorkerIds: [] as string[] });

  // ── Effect: Persist selectedFarmId for admins only ────────────────────
  useEffect(() => {
    if (!isFarmerReadonly) localStorage.setItem('selectedFarmId', selectedFarmId);
  }, [selectedFarmId, isFarmerReadonly]);

  // ── Effect: Farmers always use their farmId from session ─────────────
  useEffect(() => {
    if (farmerSession?.farmId) setSelectedFarmId(farmerSession.farmId);
  }, [farmerSession?.farmId]);

  // ── Effect: Fetch full data via RPC for FARMERS ───────────────────────
  const fetchFarmerData = useCallback(async (farmId: string) => {
    if (!farmId || !isFarmerReadonly) return;
    setFarmerLoading(true);
    try {
      const { data, error } = await supabase.rpc('fetch_farm_full_data', { p_farm_id: farmId });
      if (error) {
        console.error('RPC Error:', error);
        toast.error('تعذّر تحميل بيانات المزرعة');
      } else if (data && !data.error) {
        setFarmerData(data);
      }
    } finally {
      setFarmerLoading(false);
    }
  }, [isFarmerReadonly]);

  useEffect(() => {
    if (selectedFarmId && isFarmerReadonly) {
      fetchFarmerData(selectedFarmId);
    }
  }, [selectedFarmId, isFarmerReadonly, fetchFarmerData]);


  // ── Derived data: FARMER (from RPC, bypasses RLS) ────────────────────
  const farmerFarm = farmerData
    ? { id: farmerData.farm_id, name: farmerData.farm_name, farmerIds: farmerData.farmer_ids, isActive: true, createdAt: '' } as Farm
    : null;

  const farmerShipments: Shipment[] = isFarmerReadonly ? (farmerData?.shipments || []) : [];
  const farmerExpenses: FarmExpense[] = isFarmerReadonly ? (farmerData?.farm_expenses || []) : [];
  const farmerAttendance: Attendance[] = isFarmerReadonly ? (farmerData?.attendance || []) : [];
  const farmerWorkerPayments: WorkerPayment[] = isFarmerReadonly ? (farmerData?.worker_payments || []) : [];
  const farmerWorkers: Entity[] = isFarmerReadonly ? (farmerData?.workers || []) : [];
  const farmerAnalytics = isFarmerReadonly ? (farmerData?.analytics || null) : null;

  // ── Derived data: ADMIN (from subscribeToCollection) ─────────────────
  const selectedFarm = isFarmerReadonly ? farmerFarm : farms.find(f => f.id === selectedFarmId) || null;
  const visibleFarms = isFarmerReadonly ? (farmerFarm ? [farmerFarm] : []) : farms;
  const farmerIds = selectedFarm?.farmerIds || [];

  const adminShipments = shipments.filter(s => s.farmId === selectedFarmId || farmerIds.includes(s.farmerId));
  const adminExpenses = farmExpenses.filter(e => e.farmId === selectedFarmId || farmerIds.includes(e.farmerId));
  const adminAttendance = attendance.filter(a => a.farmId === selectedFarmId || farmerIds.includes(a.farmerId));
  const adminWorkerPayments = workerPayments.filter(p => p.farmId === selectedFarmId || farmerIds.includes(p.farmerId));
  const adminWorkers = entities.filter(e => e.type === 'worker');

  // ── Final unified lists (farmer RPC data vs admin subscription data) ──
  const farmShipments = isFarmerReadonly ? farmerShipments : adminShipments;
  const farmExpensesList = isFarmerReadonly ? farmerExpenses : adminExpenses;
  const attendanceList = isFarmerReadonly ? farmerAttendance : adminAttendance;
  const workerPaymentsList = isFarmerReadonly ? farmerWorkerPayments : adminWorkerPayments;
  const workersList = isFarmerReadonly ? farmerWorkers : adminWorkers;

  const filteredFarmShipments = shipmentStatusFilter === 'all' ? farmShipments : farmShipments.filter(s => s.status === shipmentStatusFilter);

  // ── Crops & Merchants lists (from RPC for farmers) ────────────────────
  // For farmers: build from shipments data that already has resolved names
  const allRelevantCrops: Crop[] = isFarmerReadonly
    ? Array.from(new Map(farmerShipments.filter(s => s.cropId).map(s => [s.cropId, { id: s.cropId!, name: s.cropName || 'محصول غير محدد' } as Crop])).values())
    : (() => {
        const base = [...crops];
        adminShipments.forEach(s => {
          if (s.cropId && !base.find(c => c.id === s.cropId) && s.cropName) base.push({ id: s.cropId, name: s.cropName } as Crop);
        });
        return base;
      })();

  const allRelevantMerchants: Entity[] = isFarmerReadonly
    ? Array.from(new Map(farmerShipments.filter(s => s.merchantId).map(s => [s.merchantId, { id: s.merchantId!, name: s.merchantName || 'تاجر غير محدد', type: 'merchant' } as Entity])).values())
    : (() => {
        const base = [...entities.filter(e => e.type === 'merchant')];
        adminShipments.forEach(s => {
          if (s.merchantId && !base.find(m => m.id === s.merchantId) && s.merchantName) base.push({ id: s.merchantId, name: s.merchantName, type: 'merchant' } as Entity);
        });
        return base;
      })();

  // ── Analytics: farmer uses RPC result, admin uses dbReport ───────────
  // ── Analytics Aggregator (Unified Calculation for Local & Farmers) ──
  const analytics = useFarmAnalytics({
    shipments: farmShipments,
    farmExpenses: farmExpensesList,
    attendance: attendanceList,
    workerPayments: workerPaymentsList
  });

  const farmSales = isFarmerReadonly ? analytics.totalFarmerNet : analytics.totalSales;
  const collectedSales = isFarmerReadonly ? analytics.collectedFarmerNet : analytics.collectedSales;
  const pendingSales = isFarmerReadonly ? analytics.pendingFarmerNet : analytics.pendingSales;
  const farmProduction = analytics.totalProduction;
  const totalExpenses = analytics.totalOperatingExpenses;
  const netProfit = isFarmerReadonly ? analytics.farmerNetProfit : analytics.netProfit;

  const expenseBreakdown = [
    { label: 'مياه', value: analytics.waterExpenses || 0, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'كراتين', value: analytics.boxesExpenses || 0, color: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'لوازم', value: analytics.suppliesExpenses || 0, color: 'text-indigo-700', bg: 'bg-indigo-50' },
    { label: 'أجور العمال', value: analytics.laborCosts || 0, color: 'text-rose-700', bg: 'bg-rose-50' },
    { label: 'دفعات العمال', value: analytics.workerPaymentsTotal || 0, color: 'text-purple-700', bg: 'bg-purple-50' },
  ];

  // ── Crop Report (for FarmReportsTab) → built from farmShipments ───────
  const cropReport = (() => {
    const map = new Map<string, any>();
    farmShipments.forEach(s => {
      const key = s.cropId || 'unknown';
      const name = s.cropName || allRelevantCrops.find(c => c.id === s.cropId)?.name || 'غير محدد';
      if (!map.has(key)) {
        map.set(key, { id: key, name, shipmentsCount: 0, productionQuantity: 0, collectedQuantity: 0, sales: 0, farmerNet: 0, collected: 0, collectedNet: 0, pending: 0, pendingNet: 0, averagePricePerUnit: 0 });
      }
      const r = map.get(key)!;
      r.shipmentsCount++;
      r.productionQuantity += s.packagesCount || 0;
      r.sales += s.totalSaleAmount || 0;
      r.farmerNet += s.farmerNetAmount || 0;
      if (['collected', 'farmer_delivered', 'archived'].includes(s.status)) {
        r.collected += s.totalSaleAmount || 0;
        r.collectedNet += s.farmerNetAmount || 0;
        r.collectedQuantity += s.packagesCount || 0;
      }
    });
    return Array.from(map.values()).map(r => ({
      ...r,
      // For farmers show net amounts
      sales: isFarmerReadonly ? r.farmerNet : r.sales,
      collected: isFarmerReadonly ? r.collectedNet : r.collected,
      pending: isFarmerReadonly ? (r.farmerNet - r.collectedNet) : (r.sales - r.collected),
      pendingNet: r.farmerNet - r.collectedNet,
      averagePricePerUnit: r.collectedQuantity > 0 ? (isFarmerReadonly ? r.collectedNet : r.collected) / r.collectedQuantity : 0,
    }));
  })();

  // ── Timeline Data (Last 30 Days) ──────────────────────────────────────
  const timelineData = (() => {
    const map = new Map<string, { date: string, sales: number, production: number }>();
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const recentShipments = [...farmShipments]
      .filter(s => new Date(s.date) >= last30Days)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    recentShipments.forEach(s => {
       const dateObj = new Date(s.date);
       const dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
       if (!map.has(dateStr)) map.set(dateStr, { date: dateStr, sales: 0, production: 0 });
       const r = map.get(dateStr)!;
       r.production += s.packagesCount || 0;
       
       if (['collected', 'farmer_delivered', 'archived'].includes(s.status)) {
         r.sales += isFarmerReadonly ? (s.farmerNetAmount || 0) : (s.totalSaleAmount || 0);
       }
    });
    let cumulative = 0;
    return Array.from(map.values()).map(point => {
      cumulative += point.production;
      return { ...point, cumulativeProduction: cumulative };
    });
  })();

  // ── Utility functions ─────────────────────────────────────────────────
  const getFarmExpenseTypeLabel = (type: FarmExpense['type']) => {
    switch (type) { case 'water': return 'مياه'; case 'workers': return 'عمال'; case 'boxes': return 'كراتين'; case 'supplies': return 'لوازم'; default: return type; }
  };

  const getFixedPriceForFarmExpenseType = (type: FarmExpense['type']) => {
    if (type === 'water' && settings?.waterPrice) return settings.waterPrice;
    if (type === 'boxes' && settings?.boxPrice) return settings.boxPrice;
    const np = globalPrices.map(p => ({ ...p, key: p.name.trim().toLowerCase() }));
    const aliases: Record<FarmExpense['type'], string[]> = { water: ['مياه', 'water'], boxes: ['كراتين', 'boxes', 'box'], workers: ['عمال', 'workers'], supplies: ['لوازم', 'supplies'] };
    const m = np.find(p => aliases[type].some(a => p.key.includes(a)));
    return m?.value ?? null;
  };

  const calculateHours = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    return diff / 60;
  };

  const handleShareWhatsApp = () => {
    if (!selectedFarm) return;
    const msg = `*تقرير المزرعة: ${selectedFarm.name}*\nالتاريخ: ${new Date().toLocaleDateString('en-GB')}\n\n*الإنتاج:* ${farmProduction} طرد\n*المبيعات (الصافي):* ${formatCurrency(farmSales)}\n*صافي الربح:* ${formatCurrency(netProfit)}\n`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const confirmDelete = async (collection: string, id: string) => {
    if (isFarmerReadonly) return;
    if (window.confirm('هل أنت متأكد من الحذف؟')) { await deleteDocument(collection, id); toast.success('تم الحذف بنجاح'); }
  };

  const handleBulkAttendance = async () => {
    if (isFarmerReadonly) return;
    if (bulkAttendance.selectedWorkerIds.length === 0) return toast.error('يرجى اختيار عامل واحد على الأقل');
    const farmerId = farmerIds[0];
    if (!farmerId) return toast.error('لا يوجد مزارعين مرتبطين بهذه المزرعة');
    const hours = calculateHours(bulkAttendance.startTime, bulkAttendance.endTime);
    setIsSubmitting(true);
    try {
      await Promise.all(bulkAttendance.selectedWorkerIds.map(workerId => {
        const worker = entities.find(e => e.id === workerId);
        if (!worker) return Promise.resolve();
        const hourlyRate = worker.hourlyRate || 0;
        return createDocument('attendance', { workerId, workerName: worker.name, farmerId, farmId: selectedFarmId || '', date: bulkAttendance.date, day: bulkAttendance.day, startTime: bulkAttendance.startTime, endTime: bulkAttendance.endTime, totalHours: hours, hourlyRate, totalCost: (hours * hourlyRate) });
      }));
      toast.success(`تم تسجيل دوام ${bulkAttendance.selectedWorkerIds.length} عمال بنجاح`);
      setBulkAttendance(prev => ({ ...prev, selectedWorkerIds: [] }));
    } catch { toast.error('حدث خطأ'); } finally { setIsSubmitting(false); }
  };

  const handleAddFarmExpense = async () => {
    if (isFarmerReadonly || !selectedFarmId || farmerIds.length === 0) return;
    try {
      const total = (newFarmExpense.quantity || 0) * (newFarmExpense.cost || 0);
      const data = { ...newFarmExpense, total, farmerId: farmerIds[0], farmId: selectedFarmId };
      if (editingId) { await updateDocument('farm_expenses', editingId, data); toast.success('تم التحديث بنجاح'); }
      else { await createDocument('farm_expenses', data); toast.success('تمت الإضافة بنجاح'); }
      setIsAddingExpense(false); setEditingId(null);
    } catch { toast.error('حدث خطأ'); }
  };

  const handleAddAttendance = async () => {
    if (isFarmerReadonly || !selectedFarmId || farmerIds.length === 0) return;
    try {
      const worker = entities.find(e => e.id === newAttendance.workerId);
      const hours = calculateHours(newAttendance.startTime || '00:00', newAttendance.endTime || '00:00');
      const rate = worker?.hourlyRate || 0;
      const data = { ...newAttendance, workerName: worker?.name, totalHours: hours, hourlyRate: rate, totalCost: (hours * rate), farmerId: farmerIds[0], farmId: selectedFarmId };
      if (editingId) { await updateDocument('attendance', editingId, data); toast.success('تم التحديث بنجاح'); }
      else { await createDocument('attendance', data); toast.success('تمت الإضافة بنجاح'); }
      setIsAddingAttendance(false); setEditingId(null);
    } catch { toast.error('حدث خطأ'); }
  };

  const handleAddPayment = async () => {
    if (isFarmerReadonly || !selectedFarmId || farmerIds.length === 0) return;
    try {
      const data = { ...newPayment, farmerId: farmerIds[0], farmId: selectedFarmId };
      if (editingId) { await updateDocument('worker_payments', editingId, data); toast.success('تم التحديث بنجاح'); }
      else { await createDocument('worker_payments', data); toast.success('تمت الإضافة بنجاح'); }
      setIsAddingPayment(false); setEditingId(null);
    } catch { toast.error('حدث خطأ'); }
  };

  // ── Loading state for farmer ──────────────────────────────────────────
  if (isFarmerReadonly && farmerLoading && !farmerData) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-green-600 animate-spin" />
        <p className="text-gray-500 font-bold">جاري تحميل بيانات مزرعتك...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 text-right" dir="rtl">
      {/* Premium Header */}
      <header className="relative bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center shadow-inner">
              <Sprout className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">إدارة المزرعة</h1>
              {selectedFarm && (
                <p className="text-green-600 font-bold text-sm mt-0.5">
                  {selectedFarm.name}
                  {selectedFarm.location && <span className="text-gray-400 font-medium mr-2">— {selectedFarm.location}</span>}
                </p>
              )}
            </div>
          </div>

          {/* Farm selector — admins only */}
          {!isFarmerReadonly && (
            <div className="relative group min-w-[280px]">
              <label className="absolute -top-2.5 right-4 px-2 bg-white text-[10px] font-black text-green-600 uppercase tracking-widest z-10">
                اختيار المزرعة
              </label>
              <select
                value={selectedFarmId}
                onChange={(e) => setSelectedFarmId(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-[1.5rem] outline-none font-bold text-gray-700 transition-all appearance-none cursor-pointer pr-12"
              >
                <option value="">اختر المزرعة المستهدفة...</option>
                {visibleFarms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <ChevronDown className="w-6 h-6" />
              </div>
            </div>
          )}

          {/* Farmer badge */}
          {isFarmerReadonly && selectedFarm && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-700 font-black text-sm">عرض المزرعة فقط (للقراءة)</span>
            </div>
          )}
        </div>
      </header>

      {/* No farm selected (admins only) */}
      {!isFarmerReadonly && !selectedFarmId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-16 rounded-[3rem] border-2 border-dashed border-gray-100 text-center flex flex-col items-center gap-6"
        >
          <div className="w-24 h-24 bg-green-50 p-6 rounded-[2rem] text-green-600 animate-pulse">
            <Sprout className="w-full h-full" />
          </div>
          <div className="max-w-xs">
            <h3 className="text-2xl font-black text-gray-900 mb-2">في انتظار اختيار المزرعة</h3>
            <p className="text-gray-500 font-medium">الرجاء اختيار مزرعة من القائمة العلوية لعرض لوحة التحكم</p>
          </div>
        </motion.div>
      )}

      {/* Farm not found for farmer (edge case) */}
      {isFarmerReadonly && !farmerLoading && !farmerData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-16 rounded-[3rem] border-2 border-dashed border-red-100 text-center flex flex-col items-center gap-6"
        >
          <div className="w-24 h-24 bg-red-50 p-6 rounded-[2rem] text-red-400">
            <Sprout className="w-full h-full" />
          </div>
          <div className="max-w-xs">
            <h3 className="text-2xl font-black text-gray-900 mb-2">تعذّر تحميل بيانات المزرعة</h3>
            <p className="text-gray-500 font-medium">يرجى التحقق من اتصالك بالإنترنت أو التواصل مع المسؤول</p>
            <button onClick={() => fetchFarmerData(selectedFarmId)} className="mt-4 px-6 py-2.5 bg-green-600 text-white rounded-2xl font-black text-sm hover:bg-green-700 transition-all">
              إعادة المحاولة
            </button>
          </div>
        </motion.div>
      )}

      {/* Main dashboard (shown when farm is loaded) */}
      {(selectedFarm || (isFarmerReadonly && farmerData)) && (
        <div className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickStatCard label="إجمالي الإنتاج" value={farmProduction} subValue="طرد" icon={Package} color="bg-blue-500" />
            <QuickStatCard label={isFarmerReadonly ? 'صافي المبيعات (لك)' : 'إجمالي المبيعات'} value={formatCurrency(farmSales)} icon={TrendingUp} color="bg-green-500" />
            <QuickStatCard label="إجمالي المصاريف" value={formatCurrency(totalExpenses)} icon={Droplets} color="bg-rose-500" />
            <QuickStatCard label="صافي الربح" value={formatCurrency(netProfit)} icon={Wallet} color="bg-purple-500" />
          </div>

          {/* Navigation Tabs */}
          <div className="flex overflow-x-auto hide-scrollbar gap-2 p-1.5 bg-gray-100/50 rounded-3xl border border-gray-100">
            {[
              { id: 'summary', label: 'ملخص الإنتاج', icon: Layout },
              { id: 'expenses', label: 'المصاريف', icon: Droplets },
              { id: 'workers', label: 'العمال', icon: Users },
              { id: 'reports', label: 'التقارير', icon: BarChart3 }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-black transition-all whitespace-nowrap',
                  activeTab === tab.id ? 'bg-white text-green-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-900 hover:bg-white/50'
                )}
              >
                <tab.icon className={cn('w-4 h-4', activeTab === tab.id ? 'text-green-600' : 'text-gray-400')} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <motion.div key={activeTab} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
            {activeTab === 'summary' && (
              <FarmSummaryTab
                shipmentStatusFilter={shipmentStatusFilter}
                setShipmentStatusFilter={setShipmentStatusFilter}
                handleShareWhatsApp={handleShareWhatsApp}
                filteredFarmShipments={filteredFarmShipments}
                crops={allRelevantCrops}
                entities={allRelevantMerchants}
              />
            )}

            {activeTab === 'expenses' && (
              <FarmExpensesTab
                farmExpensesList={farmExpensesList}
                isFarmerReadonly={isFarmerReadonly}
                getFarmExpenseTypeLabel={getFarmExpenseTypeLabel}
                onDeleteExpense={(id) => confirmDelete('farm_expenses', id)}
                onEditExpense={(expense) => { setNewFarmExpense(expense); setEditingId(expense.id); setIsAddingExpense(true); }}
                onAddExpense={() => {
                  setIsAddingExpense(true); setEditingId(null);
                  const t = 'water';
                  setNewFarmExpense({ type: t, quantity: 0, cost: getFixedPriceForFarmExpenseType(t) || 0, date: new Date().toISOString().split('T')[0], day: '' });
                }}
              />
            )}

            {activeTab === 'workers' && (
              <FarmWorkersTab
                workers={workersList}
                attendanceList={attendanceList}
                workerPaymentsList={workerPaymentsList}
                isFarmerReadonly={isFarmerReadonly}
                bulkAttendance={bulkAttendance}
                setBulkAttendance={setBulkAttendance}
                handleBulkAttendance={handleBulkAttendance}
                calculateHours={calculateHours}
                isSubmitting={isSubmitting}
                onAddAttendance={() => { setIsAddingAttendance(true); setEditingId(null); setNewAttendance({ date: new Date().toISOString().split('T')[0], day: '', startTime: '07:00', endTime: '16:00' }); }}
                onAddPayment={() => { setIsAddingPayment(true); setEditingId(null); setNewPayment({ date: new Date().toISOString().split('T')[0], day: '', amount: 0 }); }}
                onEditAttendance={(record) => { setNewAttendance(record); setEditingId(record.id); setIsAddingAttendance(true); }}
                onDeleteAttendance={(id) => confirmDelete('attendance', id)}
                selectedWorkerForDetails={selectedWorkerForDetails}
                setSelectedWorkerForDetails={setSelectedWorkerForDetails}
              />
            )}

            {activeTab === 'reports' && selectedFarm && (
              <FarmReportsTab
                cropReport={cropReport}
                selectedFarm={selectedFarm}
                farmProduction={farmProduction}
                farmSales={farmSales}
                totalExpenses={totalExpenses}
                netProfit={netProfit}
                collectedSales={collectedSales}
                pendingSales={pendingSales}
                farmShipments={farmShipments}
                topCropByProduction={[...cropReport].sort((a, b) => b.productionQuantity - a.productionQuantity)[0]}
                topCropBySales={[...cropReport].sort((a, b) => b.sales - a.sales)[0]}
                totalFarmQuantity={cropReport.reduce((s: number, i: any) => s + i.productionQuantity, 0)}
                expenseBreakdown={expenseBreakdown}
                timelineData={timelineData}
              />
            )}
          </motion.div>

          {/* Worker Details Modal */}
          <AnimatePresence>
            {selectedWorkerForDetails && (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setSelectedWorkerForDetails(null)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }}
                  className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-8 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-inner">
                        <Users className="w-8 h-8" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-black text-gray-900">{selectedWorkerForDetails.name}</h2>
                        <span className="text-blue-600 font-bold text-xs">{selectedWorkerForDetails.hourlyRate} ₪ / ساعة</span>
                      </div>
                    </div>
                    <button onClick={() => setSelectedWorkerForDetails(null)} className="p-3 bg-gray-50 text-gray-400 hover:bg-gray-100 rounded-2xl transition-all">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">إجمالي المستحقات</p>
                        <p className="text-2xl font-black text-gray-900">{formatCurrency(attendanceList.filter(a => a.workerId === selectedWorkerForDetails.id).reduce((s, a) => s + a.totalCost, 0))}</p>
                      </div>
                      <div className="p-6 bg-emerald-50 rounded-[2rem] border border-emerald-100">
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">إجمالي المدفوع</p>
                        <p className="text-2xl font-black text-emerald-700">{formatCurrency(workerPaymentsList.filter(p => p.workerId === selectedWorkerForDetails.id).reduce((s, p) => s + p.amount, 0))}</p>
                      </div>
                      <div className="p-6 bg-rose-50 rounded-[2rem] border border-rose-100">
                        <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-1">الرصيد المتبقي</p>
                        <p className="text-2xl font-black text-rose-700">{formatCurrency(
                          attendanceList.filter(a => a.workerId === selectedWorkerForDetails.id).reduce((s, a) => s + a.totalCost, 0) -
                          workerPaymentsList.filter(p => p.workerId === selectedWorkerForDetails.id).reduce((s, p) => s + p.amount, 0)
                        )}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                          <Calendar className="w-5 h-5 text-blue-500" /> سجل الدوام
                        </h3>
                        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                          <table className="w-full text-right text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              <tr><th className="p-4">التاريخ</th><th className="p-4">الساعات</th><th className="p-4">الأجر</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {attendanceList.filter(a => a.workerId === selectedWorkerForDetails.id).slice(0, 20).map(a => (
                                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="p-4 font-bold text-gray-900">{formatDate(a.date)}</td>
                                  <td className="p-4 text-gray-600">{a.totalHours} س</td>
                                  <td className="p-4 font-black text-rose-600">{formatCurrency(a.totalCost)}</td>
                                </tr>
                              ))}
                              {attendanceList.filter(a => a.workerId === selectedWorkerForDetails.id).length === 0 && (
                                <tr><td colSpan={3} className="p-8 text-center text-gray-400">لا يوجد سجل دوام</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                          <Wallet className="w-5 h-5 text-emerald-500" /> سجل الدفعات
                        </h3>
                        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                          <table className="w-full text-right text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              <tr><th className="p-4">التاريخ</th><th className="p-4">المبلغ</th><th className="p-4">ملاحظات</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {workerPaymentsList.filter(p => p.workerId === selectedWorkerForDetails.id).slice(0, 20).map(p => (
                                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="p-4 font-bold text-gray-900">{formatDate(p.date)}</td>
                                  <td className="p-4 font-black text-emerald-600">{formatCurrency(p.amount)}</td>
                                  <td className="p-4 text-[10px] text-gray-500 max-w-[120px] truncate">{p.notes || '-'}</td>
                                </tr>
                              ))}
                              {workerPaymentsList.filter(p => p.workerId === selectedWorkerForDetails.id).length === 0 && (
                                <tr><td colSpan={3} className="p-8 text-center text-gray-400">لا توجد دفعات مسجلة</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-8 border-t border-gray-100 bg-gray-50/30 flex justify-end">
                    <button onClick={() => setSelectedWorkerForDetails(null)} className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all active:scale-95 shadow-xl">
                      إغلاق الكشف
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {/* Add/Edit Modal (Admin only) */}
            {!isFarmerReadonly && (isAddingExpense || isAddingAttendance || isAddingPayment) && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => { setIsAddingExpense(false); setIsAddingAttendance(false); setIsAddingPayment(false); setEditingId(null); }}
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
                  <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-gray-900">
                        {isAddingExpense ? (editingId ? 'تعديل مصروف' : 'إضافة مصروف') : isAddingAttendance ? (editingId ? 'تعديل دوام' : 'تسجيل دوام') : (editingId ? 'تعديل دفعة' : 'إضافة دفعة')}
                      </h2>
                      <p className="text-gray-500 font-medium text-sm">أدخل البيانات المطلوبة بدقة</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-2xl">
                      {isAddingExpense ? <Droplets className="w-6 h-6 text-rose-500" /> : isAddingAttendance ? <Users className="w-6 h-6 text-blue-500" /> : <Wallet className="w-6 h-6 text-purple-500" />}
                    </div>
                  </div>
                  <div className="p-8 space-y-5">
                    {isAddingExpense && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-black text-gray-700 mr-1">نوع المصروف</label>
                          <select value={newFarmExpense.type} onChange={(e) => { const t = e.target.value as FarmExpense['type']; setNewFarmExpense({ ...newFarmExpense, type: t, cost: getFixedPriceForFarmExpenseType(t) ?? (newFarmExpense.cost || 0) }); }} className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-[1.25rem] focus:border-green-500 focus:bg-white outline-none font-bold">
                            <option value="water">مياه</option>
                            <option value="boxes">كراتين</option>
                            <option value="supplies">لوازم أخرى</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <InputGroup label="الكمية" type="number" value={newFarmExpense.quantity} onChange={(v) => setNewFarmExpense({ ...newFarmExpense, quantity: Number(v) })} />
                          <InputGroup label="التكلفة للوحدة" type="number" value={newFarmExpense.cost} onChange={(v) => setNewFarmExpense({ ...newFarmExpense, cost: Number(v) })} />
                        </div>
                      </>
                    )}
                    {isAddingAttendance && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-black text-gray-700 mr-1">العامل</label>
                          <select value={newAttendance.workerId || ''} onChange={(e) => setNewAttendance({ ...newAttendance, workerId: e.target.value })} className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-[1.25rem] focus:border-green-500 focus:bg-white outline-none font-bold">
                            <option value="">اختر العامل...</option>
                            {adminWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <InputGroup label="من الساعة" type="time" value={newAttendance.startTime} onChange={(v) => setNewAttendance({ ...newAttendance, startTime: v })} />
                          <InputGroup label="إلى الساعة" type="time" value={newAttendance.endTime} onChange={(v) => setNewAttendance({ ...newAttendance, endTime: v })} />
                        </div>
                      </>
                    )}
                    {isAddingPayment && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-black text-gray-700 mr-1">العامل</label>
                          <select value={newPayment.workerId || ''} onChange={(e) => setNewPayment({ ...newPayment, workerId: e.target.value })} className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-[1.25rem] focus:border-green-500 focus:bg-white outline-none font-bold">
                            <option value="">اختر العامل...</option>
                            {adminWorkers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                          </select>
                        </div>
                        <InputGroup label="المبلغ (شيكل)" type="number" value={newPayment.amount} onChange={(v) => setNewPayment({ ...newPayment, amount: Number(v) })} />
                        <InputGroup label="ملاحظات إضافية" type="text" value={newPayment.notes} onChange={(v) => setNewPayment({ ...newPayment, notes: v })} />
                      </>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-black text-gray-700 mr-1">اليوم</label>
                        <select
                          value={isAddingExpense ? newFarmExpense.day : isAddingAttendance ? newAttendance.day : newPayment.day}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (isAddingExpense) setNewFarmExpense({ ...newFarmExpense, day: v });
                            else if (isAddingAttendance) setNewAttendance({ ...newAttendance, day: v });
                            else setNewPayment({ ...newPayment, day: v });
                          }}
                          className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-[1.25rem] focus:border-green-500 focus:bg-white outline-none font-bold"
                        >
                          <option value="">اليوم...</option>
                          {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <InputGroup
                        label="التاريخ"
                        type="date"
                        value={isAddingExpense ? newFarmExpense.date : isAddingAttendance ? newAttendance.date : newPayment.date}
                        onChange={(v) => {
                          if (isAddingExpense) setNewFarmExpense({ ...newFarmExpense, date: v });
                          else if (isAddingAttendance) setNewAttendance({ ...newAttendance, date: v });
                          else setNewPayment({ ...newPayment, date: v });
                        }}
                      />
                    </div>
                  </div>
                  <div className="p-8 border-t border-gray-50 bg-gray-50/30 flex gap-4">
                    <button onClick={() => { if (isAddingExpense) handleAddFarmExpense(); else if (isAddingAttendance) handleAddAttendance(); else handleAddPayment(); }} className="flex-1 bg-green-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-green-700 transition-all shadow-xl shadow-green-100 active:scale-95">
                      حفظ البيانات
                    </button>
                    <button onClick={() => { setIsAddingExpense(false); setIsAddingAttendance(false); setIsAddingPayment(false); setEditingId(null); }} className="flex-1 bg-white text-gray-500 border border-gray-200 py-4 rounded-2xl font-black text-lg hover:bg-gray-50 transition-all active:scale-95">
                      إلغاء
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function QuickStatCard({ label, value, subValue, icon: Icon, color }: { label: string, value: any, subValue?: string, icon: any, color: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center gap-5 hover:border-green-100 transition-colors group">
      <div className={cn('w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform', color)}>
        <Icon className="w-8 h-8 text-white" />
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-2xl font-black text-gray-900 leading-none">{value}</p>
          {subValue && <span className="text-[10px] font-bold text-gray-400">{subValue}</span>}
        </div>
      </div>
    </motion.div>
  );
}

function InputGroup({ label, type, value, onChange }: { label: string, type: string, value: any, onChange: (val: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-black text-gray-700 mr-1">{label}</label>
      <input type={type} value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-[1.25rem] focus:border-green-500 focus:bg-white outline-none font-bold transition-all" />
    </div>
  );
}
