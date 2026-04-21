/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  UserPlus, 
  Settings as SettingsIcon,
  Package,
  DollarSign,
  Filter,
  Eye,
  Receipt,
  FileText,
  Calendar,
  Search,
  Archive,
  ArrowUpDown,
  ChevronDown,
  TrendingUp,
  ArrowUp,
  MapPin,
  Users,
  Leaf,
  Truck,
  Fuel,
  Wrench,
  ShieldCheck,
  BarChart3,
  PieChart,
  Target,
  FileDown
} from 'lucide-react';
import { 
  createDocument, 
  updateDocument, 
  deleteDocument,
  getDocument
} from '../services/db';
import { resolveReceiptUrl } from '../services/storage';
import { ensureFarmerAuthUser } from '../services/adminAuth';
import { Entity, Crop, Settings as SettingsType, GlobalPrice, Farm, FarmerAccount, Shipment, VehicleExpense } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { isAllowedAdminEmail } from '../lib/authz';
import { supabase } from '../supabase';
import { useData } from '../contexts/DataContext';
import { FinancialReports } from '../features/settings/components/FinancialReports';
import { LogisticsPanel } from '../features/settings/components/LogisticsPanel';
import { ArchiveBrowser } from '../features/settings/components/ArchiveBrowser';
import { QuickStatCard } from '../features/settings/components/QuickStatCard';
import { ModalContainer, ModalButton, ModalInput } from '../features/settings/components/ModalContainer';


const normalizeEntityType = (type?: string) => {
  const value = (type || '').toString().trim().toLowerCase();
  if (['farmer', 'مزارع'].includes(value)) return 'farmer';
  if (['merchant', 'تاجر'].includes(value)) return 'merchant';
  if (['worker', 'عامل'].includes(value)) return 'worker';
  return value;
};

export default function SettingsPage() {
  const {
    entities, crops, farms, farmerAccounts, globalPrices, shipments, vehicleExpenses, settings: ctxSettings
  } = useData();
  const settings: SettingsType = ctxSettings || { boxPrice: 0, waterPrice: 0, transportFeePerUnit: 0 };

  const [activeTab, setActiveTab] = useState<'prices' | 'farms' | 'entities' | 'crops' | 'archive' | 'transport' | 'reports'>('prices');
  const [activeReportSubTab, setActiveReportSubTab] = useState<'merchants' | 'farmers' | 'summary'>('summary');


  // Archive Specific States
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveFarmerFilter, setArchiveFarmerFilter] = useState('all');
  const [archiveMerchantFilter, setArchiveMerchantFilter] = useState('all');
  const [archiveCropFilter, setArchiveCropFilter] = useState('all');
  const [archiveStartDate, setArchiveStartDate] = useState('');
  const [archiveEndDate, setArchiveEndDate] = useState('');
  const [previewReceipt, setPreviewReceipt] = useState<string | null>(null);
  const [selectedArchivedShipment, setSelectedArchivedShipment] = useState<Shipment | null>(null);
  const [isReceiptLoading, setIsReceiptLoading] = useState(false);

  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);
  const [newEntity, setNewEntity] = useState<Partial<Entity>>({ type: 'farmer' });
  const [isAddingCrop, setIsAddingCrop] = useState(false);
  const [editingCropId, setEditingCropId] = useState<string | null>(null);
  const [newCrop, setNewCrop] = useState<Partial<Crop>>({ unit: 'box' });
  
  const [isAddingPrice, setIsAddingPrice] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState<Partial<GlobalPrice>>({ name: '', value: 0 });
  const [priceSearch, setPriceSearch] = useState('');
  const [priceSort, setPriceSort] = useState<'asc' | 'desc'>('desc');
  const [isAddingFarm, setIsAddingFarm] = useState(false);
  const [editingFarmId, setEditingFarmId] = useState<string | null>(null);
  const [newFarm, setNewFarm] = useState<Partial<Farm>>({ name: '', farmerIds: [] });
  const [isAddingFarmerAccount, setIsAddingFarmerAccount] = useState(false);
  const [editingFarmerAccountId, setEditingFarmerAccountId] = useState<string | null>(null);
  const [newFarmerAccount, setNewFarmerAccount] = useState<Partial<FarmerAccount>>({
    email: '',
    authUserId: '',
    farmerId: '',
    farmId: '',
    isActive: true,
  });
  
  const [isAddingVehicleExpense, setIsAddingVehicleExpense] = useState(false);
  const [editingVehicleExpenseId, setEditingVehicleExpenseId] = useState<string | null>(null);
  const [newVehicleExpense, setNewVehicleExpense] = useState<Partial<VehicleExpense>>({ 
    type: 'diesel', 
    cost: 0, 
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [farmerAuthPassword, setFarmerAuthPassword] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const isAdminUser = useMemo(() => isAllowedAdminEmail(currentUserEmail), [currentUserEmail]);

  // Stats for each section
  const entityStats = useMemo(() => ({
    total: entities.length,
    farmers: entities.filter(e => normalizeEntityType(e.type as string) === 'farmer').length,
    merchants: entities.filter(e => normalizeEntityType(e.type as string) === 'merchant').length,
    workers: entities.filter(e => normalizeEntityType(e.type as string) === 'worker').length,
  }), [entities]);

  const farmStats = useMemo(() => ({
    activeAccounts: farmerAccounts.filter(a => a.isActive).length,
  }), [farms, farmerAccounts]);

  const farmsForSelectedFarmer = useMemo(() => {
    if (!newFarmerAccount.farmerId) return [];
    return farms.filter(f => f.farmerIds.includes(newFarmerAccount.farmerId!));
  }, [newFarmerAccount.farmerId, farms]);

  const cropStats = useMemo(() => ({
    total: crops.length,
    boxUnits: crops.filter(c => c.unit === 'box' || c.unit === 'box_and_kg').length,
    kgUnits: crops.filter(c => c.unit === 'kg' || c.unit === 'box_and_kg').length,
  }), [crops]);

  const archiveStats = useMemo(() => {
    const archived = shipments.filter(s => s.status === 'archived');
    return {
      totalCount: archived.length,
      totalSales: archived.reduce((sum, s) => sum + (s.totalSaleAmount || 0), 0),
      totalNet: archived.reduce((sum, s) => sum + (s.farmerNetAmount || 0), 0),
    };
  }, [shipments]);

  const transportStats = useMemo(() => {
    const validTransports = shipments.filter(s => ['collected', 'farmer_delivered', 'archived'].includes(s.status));
    const totalPackages = validTransports.reduce((sum, s) => sum + (s.packagesCount || 0), 0);
    const totalRevenue = validTransports.reduce((sum, s) => sum + (s.boxRentalTotal || 0), 0);
    const totalExpenses = vehicleExpenses.reduce((sum, v) => sum + (v.cost || 0), 0);
    return {
      totalPackages,
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses
    };
  }, [shipments, vehicleExpenses]);

  // --- Reports Logic ---
  const filteredReportShipments = useMemo(() => {
    return shipments
      .filter(sh => ['collected', 'archived'].includes(sh.status))
      .filter(sh => {
        const farmer = entities.find(e => e.id === sh.farmerId);
        const crop = crops.find(c => c.id === sh.cropId);
        const merchant = entities.find(m => m.id === sh.merchantId);

        const q = archiveSearch.toLowerCase();
        const matchSearch = !q || 
          sh.shipmentNumber?.toLowerCase().includes(q) ||
          farmer?.name.toLowerCase().includes(q) ||
          merchant?.name.toLowerCase().includes(q) ||
          crop?.name.toLowerCase().includes(q);

        const matchFarmer = archiveFarmerFilter === 'all' || sh.farmerId === archiveFarmerFilter;
        const matchMerchant = archiveMerchantFilter === 'all' || sh.merchantId === archiveMerchantFilter;
        const matchCrop = archiveCropFilter === 'all' || sh.cropId === archiveCropFilter;
        const matchDate = (!archiveStartDate || sh.date >= archiveStartDate) && 
                         (!archiveEndDate || sh.date <= archiveEndDate);

        return matchSearch && matchFarmer && matchMerchant && matchCrop && matchDate;
      });
  }, [shipments, entities, crops, archiveSearch, archiveFarmerFilter, archiveMerchantFilter, archiveCropFilter, archiveStartDate, archiveEndDate]);

  const merchantReport = useMemo(() => {
    const data: Record<string, { name: string; sales: number; commission: number; count: number }> = {};
    filteredReportShipments.forEach(sh => {
      if (!sh.merchantId) return;
      if (!data[sh.merchantId]) {
        const m = entities.find(e => e.id === sh.merchantId);
        data[sh.merchantId] = { name: m?.name || 'تاجر غير معروف', sales: 0, commission: 0, count: 0 };
      }
      data[sh.merchantId].sales += (sh.totalSaleAmount || 0);
      data[sh.merchantId].commission += (sh.merchantCommissionAmount || 0);
      data[sh.merchantId].count += 1;
    });
    return Object.values(data).sort((a, b) => b.sales - a.sales);
  }, [filteredReportShipments, entities]);

  const farmerReport = useMemo(() => {
    const data: Record<string, { 
      name: string; 
      sales: number; 
      net: number; 
      packages: number; 
      crops: Record<string, { name: string; quantity: number }> 
    }> = {};
    
    filteredReportShipments.forEach(sh => {
      if (!data[sh.farmerId]) {
        const f = entities.find(e => e.id === sh.farmerId);
        data[sh.farmerId] = { name: f?.name || 'مزارع غير معروف', sales: 0, net: 0, packages: 0, crops: {} };
      }
      const entry = data[sh.farmerId];
      entry.sales += (sh.totalSaleAmount || 0);
      entry.net += (sh.farmerNetAmount || 0);
      entry.packages += (sh.packagesCount || 0);
      
      const crop = crops.find(c => c.id === sh.cropId);
      if (crop) {
        if (!entry.crops[crop.id]) entry.crops[crop.id] = { name: crop.name, quantity: 0 };
        entry.crops[crop.id].quantity += (sh.packagesCount || 0);
      }
    });
    return Object.values(data).sort((a, b) => b.sales - a.sales);
  }, [filteredReportShipments, entities, crops]);

  const globalSummary = useMemo(() => {
    const totalSales = filteredReportShipments.reduce((sum, s) => sum + (s.totalSaleAmount || 0), 0);
    const totalCommission = filteredReportShipments.reduce((sum, s) => sum + (s.merchantCommissionAmount || 0), 0);
    const totalNet = filteredReportShipments.reduce((sum, s) => sum + (s.farmerNetAmount || 0), 0);
    const totalPackages = filteredReportShipments.reduce((sum, s) => sum + (s.packagesCount || 0), 0);
    const transportRev = filteredReportShipments.reduce((sum, s) => sum + (s.boxRentalTotal || 0), 0);
    
    // Expenses in this period
    const transportExp = vehicleExpenses
      .filter(v => (!archiveStartDate || v.date >= archiveStartDate) && (!archiveEndDate || v.date <= archiveEndDate))
      .reduce((sum, v) => sum + (v.cost || 0), 0);

    return {
      totalSales,
      totalCommission,
      totalNet,
      totalPackages,
      transportRev,
      transportExp,
      netProfit: totalSales - totalNet - totalCommission // This is what the SHOP/Site makes if we consider transport as part of shop
    };
  }, [filteredReportShipments, vehicleExpenses, archiveStartDate, archiveEndDate]);

  const openReceiptArchive = async (url: string) => {
    setIsReceiptLoading(true);
    try {
      const resolved = await resolveReceiptUrl(url);
      if (resolved) setPreviewReceipt(resolved);
    } catch {
      toast.error('تعذر تحميل صورة الإيصال');
    } finally {
      setIsReceiptLoading(false);
    }
  };

  const tabs = [
    { id: 'prices', label: 'الأسعار والبنود', icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'farms', label: 'المزارع والحسابات', icon: SettingsIcon, color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 'entities', label: 'إدارة الجهات', icon: UserPlus, color: 'text-green-600', bg: 'bg-green-50' },
    { id: 'crops', label: 'المحاصيل', icon: Leaf, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'transport', label: 'النقل واللوجستيات', icon: Truck, color: 'text-purple-600', bg: 'bg-purple-50' },
    { id: 'reports', label: 'التقارير المالية', icon: BarChart3, color: 'text-rose-600', bg: 'bg-rose-50' },
    { id: 'archive', label: 'الأرشيف', icon: Archive, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  ] as const;

  const totalFixedPrices = useMemo(() => globalPrices.reduce((sum, p) => sum + (p.value || 0), 0), [globalPrices]);
  
  const topFixedPrice = useMemo(() => 
    [...globalPrices].sort((a, b) => (b.value || 0) - (a.value || 0))[0] || { name: 'لا يوجد', value: 0 }
  , [globalPrices]);

  const filteredPrices = useMemo(() => 
    globalPrices
      .filter(p => 
        p.name.toLowerCase().includes(priceSearch.toLowerCase()) || 
        p.value.toString().includes(priceSearch)
      )
      .sort((a, b) => priceSort === 'desc' ? (b.value || 0) - (a.value || 0) : (a.value || 0) - (b.value || 0))
  , [globalPrices, priceSearch, priceSort]);

  const filteredArchivedShipments = useMemo(() => {
    return shipments
      .filter(sh => sh.status === 'archived')
      .filter(sh => {
        const farmer = entities.find(e => e.id === sh.farmerId);
        const crop = crops.find(c => c.id === sh.cropId);
        const merchant = entities.find(m => m.id === sh.merchantId);

        const q = archiveSearch.toLowerCase();
        const matchSearch = !q || 
          sh.shipmentNumber?.toLowerCase().includes(q) ||
          farmer?.name.toLowerCase().includes(q) ||
          merchant?.name.toLowerCase().includes(q) ||
          crop?.name.toLowerCase().includes(q);

        const matchFarmer = archiveFarmerFilter === 'all' || sh.farmerId === archiveFarmerFilter;
        const matchMerchant = archiveMerchantFilter === 'all' || sh.merchantId === archiveMerchantFilter;
        const matchCrop = archiveCropFilter === 'all' || sh.cropId === archiveCropFilter;
        const matchDate = (!archiveStartDate || sh.date >= archiveStartDate) && 
                         (!archiveEndDate || sh.date <= archiveEndDate);

        return matchSearch && matchFarmer && matchMerchant && matchCrop && matchDate;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [shipments, entities, crops, archiveSearch, archiveFarmerFilter, archiveMerchantFilter, archiveCropFilter, archiveStartDate, archiveEndDate]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserEmail((data.user?.email || '').toLowerCase());
    });
  }, []);

  const handleAddPrice = async () => {
    const normalizedName = (newPrice.name || '').trim();
    if (!normalizedName) {
      toast.error('يرجى إدخال اسم البند');
      return;
    }
    const duplicate = globalPrices.find(
      (p) => p.name.trim().toLowerCase() === normalizedName.toLowerCase() && p.id !== editingPriceId
    );
    if (duplicate) {
      toast.error('يوجد بند بنفس الاسم بالفعل');
      return;
    }
    if (editingPriceId) {
      await updateDocument('global_prices', editingPriceId, { ...newPrice, name: normalizedName });
      toast.success('تم تحديث السعر بنجاح');
    } else {
      await createDocument('global_prices', { ...newPrice, name: normalizedName });
      toast.success('تمت إضافة السعر بنجاح');
    }
    setNewPrice({ name: '', value: 0 });
    setIsAddingPrice(false);
    setEditingPriceId(null);
  };

  const startEditPrice = (price: GlobalPrice) => {
    setNewPrice(price);
    setEditingPriceId(price.id);
    setIsAddingPrice(true);
  };

  const cancelEditPrice = () => {
    setIsAddingPrice(false);
    setEditingPriceId(null);
    setNewPrice({ name: '', value: 0 });
  };

  const handleDeletePrice = async (id: string) => {
    try {
      await deleteDocument('global_prices', id);
      toast.success('تم حذف السعر بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const addQuickPrice = async (name: string) => {
    const normalizedName = name.trim();
    if (!normalizedName) return;
    
    const exists = globalPrices.some((p) => p.name.trim().toLowerCase() === normalizedName.toLowerCase());
    if (exists) {
      toast('هذا البند موجود بالفعل');
      return;
    }
    
    try {
      await createDocument('global_prices', { name: normalizedName, value: 0 });
      toast.success(`تمت إضافة "${normalizedName}"`);
    } catch (error) {
      toast.error('تعذر إضافة البند السريع');
    }
  };

  const handleAddVehicleExpense = async () => {
    if (!newVehicleExpense.cost || newVehicleExpense.cost <= 0) {
      toast.error('يرجى إدخال تكلفة صحيحة');
      return;
    }

    // Try to find if the current admin has a linked farmer profile
    const currentAccount = farmerAccounts.find(a => a.email?.toLowerCase() === currentUserEmail);
    const farmerIdToUse = newVehicleExpense.farmerId || currentAccount?.farmerId || null;

    const expenseData = {
      ...newVehicleExpense,
      farmerId: farmerIdToUse
    };

    try {
      if (editingVehicleExpenseId) {
        await updateDocument('vehicle_expenses', editingVehicleExpenseId, expenseData);
        toast.success('تم تحديث المصروف بنجاح');
      } else {
        await createDocument('vehicle_expenses', expenseData);
        toast.success('تمت إضافة المصروف بنجاح');
      }
      setNewVehicleExpense({ type: 'diesel', cost: 0, date: new Date().toISOString().split('T')[0], notes: '' });
      setIsAddingVehicleExpense(false);
      setEditingVehicleExpenseId(null);
    } catch (error: any) {
      console.error('Error saving vehicle expense:', error);
      if (error?.message?.includes('violates not-null constraint')) {
        toast.error('خطأ: يجب تشغيل كود SQL المذكور لجعل خانة المزارع اختيارية.');
      } else {
        toast.error('فشل حفظ المصروف. تحقق من الصلاحيات.');
      }
    }
  };

  const startEditVehicleExpense = (v: VehicleExpense) => {
    setNewVehicleExpense(v);
    setEditingVehicleExpenseId(v.id);
    setIsAddingVehicleExpense(true);
  };

  const handleDeleteVehicleExpense = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
      await deleteDocument('vehicle_expenses', id);
      toast.success('تم الحذف بنجاح');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await createDocument('settings', settings, 'global');
      toast.success('تم حفظ الإعدادات بنجاح!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('فشل حفظ الإعدادات. يرجى التأكد من الصلاحيات.');
    }
  };

  const handleAddEntity = async () => {
    if (!newEntity.name) {
      toast.error('يرجى إدخال اسم الجهة');
      return;
    }
    try {
      if (editingEntityId) {
        await updateDocument('entities', editingEntityId, newEntity);
        toast.success('تم تحديث الجهة بنجاح');
      } else {
        await createDocument('entities', newEntity);
        toast.success('تم إضافة الجهة بنجاح');
      }
      setNewEntity({ type: 'farmer' });
      setIsAddingEntity(false);
      setEditingEntityId(null);
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  const handleAddCrop = async () => {
    if (!newCrop.name) {
      toast.error('يرجى إدخال اسم الصنف');
      return;
    }
    try {
      if (editingCropId) {
        await updateDocument('crops', editingCropId, newCrop);
        toast.success('تم تحديث الصنف بنجاح');
      } else {
        await createDocument('crops', newCrop);
        toast.success('تم إضافة الصنف بنجاح');
      }
      setNewCrop({ unit: 'box' });
      setIsAddingCrop(false);
      setEditingCropId(null);
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ');
    }
  };

  const startEditEntity = (entity: Entity) => {
    setNewEntity(entity);
    setEditingEntityId(entity.id);
    setIsAddingEntity(true);
  };

  const startEditCrop = (crop: Crop) => {
    setNewCrop(crop);
    setEditingCropId(crop.id);
    setIsAddingCrop(true);
  };

  const cancelEditEntity = () => {
    setIsAddingEntity(false);
    setEditingEntityId(null);
    setNewEntity({ type: 'farmer' });
  };

  const cancelEditCrop = () => {
    setIsAddingCrop(false);
    setEditingCropId(null);
    setNewCrop({ unit: 'box' });
  };

  const handleDeleteEntity = async (id: string) => {
    await deleteDocument('entities', id);
  };

  const handleDeleteCrop = async (id: string) => {
    await deleteDocument('crops', id);
  };

  const handleAddFarm = async () => {
    const farmName = (newFarm.name || '').trim();
    const ownerIds = Array.from(new Set((newFarm.farmerIds || []).map((id) => String(id)).filter(Boolean)));

    if (!farmName) {
      toast.error('يرجى إدخال اسم المزرعة');
      return;
    }
    if (ownerIds.length === 0) {
      toast.error('يرجى اختيار مالك واحد على الأقل');
      return;
    }

    try {
      if (editingFarmId) {
        await updateDocument('farms', editingFarmId, {
          name: farmName,
          farmerIds: ownerIds,
        });
        toast.success('تم تحديث المزرعة بنجاح');
      } else {
        await createDocument('farms', {
          name: farmName,
          farmerIds: ownerIds,
        });
        toast.success('تم إنشاء المزرعة بنجاح');
      }
      setNewFarm({ name: '', farmerIds: [] });
      setIsAddingFarm(false);
      setEditingFarmId(null);
    } catch (error: any) {
      const message = String(error?.message || '');
      if (message.includes('permission-denied')) {
        toast.error('لا توجد صلاحية لإنشاء/تعديل المزرعة. تأكد أنك مسجل بحساب المدير.');
      } else {
        toast.error('تعذر حفظ المزرعة. تأكد من اختيار ملاك ثم حاول مرة أخرى.');
      }
    }
  };

  const startEditFarm = (farm: Farm) => {
    setNewFarm({ name: farm.name, farmerIds: farm.farmerIds || [] });
    setEditingFarmId(farm.id);
    setIsAddingFarm(true);
  };

  const cancelEditFarm = () => {
    setIsAddingFarm(false);
    setEditingFarmId(null);
    setNewFarm({ name: '', farmerIds: [] });
  };

  const handleDeleteFarm = async (id: string) => {
    try {
      await deleteDocument('farms', id);
      toast.success('تم حذف المزرعة بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء حذف المزرعة');
    }
  };

  const farmers = useMemo(() => entities.filter((e) => normalizeEntityType(e.type as string) === 'farmer'), [entities]);

  const handleAddFarmerAccount = async () => {
    if (!newFarmerAccount.email?.trim()) {
      toast.error('يرجى إدخال البريد الإلكتروني');
      return;
    }
    if (!newFarmerAccount.farmerId || !newFarmerAccount.farmId) {
      toast.error('يرجى اختيار المزارع والمزرعة');
      return;
    }
    const normalizedEmail = newFarmerAccount.email.trim().toLowerCase();
    const duplicate = farmerAccounts.find(
      (a) => (a.email || '').toLowerCase() === normalizedEmail && a.id !== editingFarmerAccountId
    );
    if (duplicate) {
      toast.error('البريد الإلكتروني مستخدم مسبقًا');
      return;
    }
    const payload: Partial<FarmerAccount> = {
      email: normalizedEmail,
      authUserId: newFarmerAccount.authUserId?.trim() || undefined,
      farmerId: newFarmerAccount.farmerId,
      farmId: newFarmerAccount.farmId,
      isActive: newFarmerAccount.isActive ?? true,
      createdAt: newFarmerAccount.createdAt || new Date().toISOString(),
    };
    try {
      const shouldEnsureAuth = !editingFarmerAccountId || farmerAuthPassword.trim().length > 0;
      if (shouldEnsureAuth) {
        if (farmerAuthPassword.trim().length < 6) {
          toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
          return;
        }
        const ensured = await ensureFarmerAuthUser(normalizedEmail, farmerAuthPassword.trim());
        payload.authUserId = ensured.userId;
        payload.email = ensured.email;
      }

      if (editingFarmerAccountId) {
        await updateDocument('farmer_accounts', editingFarmerAccountId, payload);
        toast.success('تم تحديث حساب المزارع بنجاح');
      } else {
        await createDocument('farmer_accounts', payload);
        toast.success('تم إنشاء حساب المزارع بنجاد');
      }
      setIsAddingFarmerAccount(false);
      setEditingFarmerAccountId(null);
      setNewFarmerAccount({ email: '', authUserId: '', farmerId: '', farmId: '', isActive: true });
      setFarmerAuthPassword('');
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ حساب المزارع');
    }
  };

  const startEditFarmerAccount = (account: FarmerAccount) => {
    setNewFarmerAccount(account);
    setEditingFarmerAccountId(account.id);
    setFarmerAuthPassword('');
    setIsAddingFarmerAccount(true);
  };

  const handleDeleteFarmerAccount = async (id: string) => {
    try {
      await deleteDocument('farmer_accounts', id);
      toast.success('تم حذف الحساب بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء حذف الحساب');
    }
  };


  return (
    <div className="space-y-6 sm:space-y-8 pb-20 text-right" dir="rtl">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">الإعدادات</h1>
          <p className="text-gray-500 mt-1">تخصيص وإدارة كافة جوانب نظام المزرعة الخاص بك.</p>
        </div>
        
        <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
          <div className="inline-flex p-1.5 bg-gray-100/80 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-inner whitespace-nowrap">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 font-bold text-sm",
                    isActive 
                      ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200" 
                      : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
                  )}
                >
                  <tab.icon className={cn("w-4 h-4", isActive ? tab.color : "text-gray-400")} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'prices' && (
            <section className="space-y-6">
              {/* Price Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <QuickStatCard label="عدد البنود" value={globalPrices.length} icon={DollarSign} color="text-blue-600" bg="bg-blue-50" />
                <QuickStatCard label="مجموع القيم" value={formatCurrency(totalFixedPrices)} icon={TrendingUp} color="text-green-600" bg="bg-green-50" />
                <QuickStatCard label="أعلى بند" value={formatCurrency(topFixedPrice.value)} icon={ArrowUp} color="text-rose-600" bg="bg-rose-50" sub={topFixedPrice.name} />
              </div>

              {/* Price Management Card */}
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">الأسعار الثابتة</h2>
                      <p className="text-sm text-gray-500">إدارة القيم المستخدمة في الحسابات التلقائية.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAddingPrice(true)}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all font-bold shadow-lg shadow-blue-100 active:scale-95"
                  >
                    <Plus className="w-5 h-5" />
                    إضافة سعر جديد
                  </button>
                </div>

                <div className="p-6 bg-gray-50/50 border-b border-gray-100 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={priceSearch}
                        onChange={(e) => setPriceSearch(e.target.value)}
                        placeholder="ابحث عن اسم البند أو القيمة..."
                        className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm transition-all pr-12"
                      />
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    </div>
                    <select
                      value={priceSort}
                      onChange={(e) => setPriceSort(e.target.value as 'asc' | 'desc')}
                      className="px-5 py-3.5 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold shadow-sm"
                    >
                      <option value="desc">الأعلى سعراً</option>
                      <option value="asc">الأقل سعراً</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {['سعر الكرتونة', 'سعر المياه', 'رسوم النقل'].map((item) => (
                      <button
                        key={item}
                        onClick={() => addQuickPrice(item)}
                        className="px-4 py-2 text-[11px] font-black bg-white border border-blue-100 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                      >
                        + {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1">
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full min-w-[640px] text-right">
                      <thead>
                        <tr className="bg-gray-50/50 text-gray-500 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
                          <th className="px-8 py-4">اسم البند</th>
                          <th className="px-8 py-4">القيمة (شيكل)</th>
                          <th className="px-8 py-4 text-left">التحكم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredPrices.map((price) => (
                          <tr key={price.id} className="group hover:bg-blue-50/30 transition-all">
                            <td className="px-8 py-5">
                              <div className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{price.name}</div>
                            </td>
                            <td className="px-8 py-5">
                              <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm font-black tracking-tight">{price.value}</span>
                            </td>
                            <td className="px-8 py-5 text-left">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => startEditPrice(price)}
                                  className="p-2.5 text-blue-600 hover:bg-blue-100 rounded-xl transition-all"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeletePrice(price.id)}
                                  className="p-2.5 text-rose-600 hover:bg-rose-100 rounded-xl transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card Layout */}
                  <div className="sm:hidden divide-y divide-gray-100 bg-white">
                    {filteredPrices.map((price) => (
                      <div key={price.id} className="p-5 flex items-center justify-between group active:bg-gray-50 transition-colors">
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-gray-900">{price.name}</span>
                          <span className="font-black text-blue-600 text-sm bg-blue-50 px-2 py-0.5 rounded-lg inline-block w-fit">{price.value} شيكل</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <button onClick={() => startEditPrice(price)} className="p-3 text-blue-600 bg-blue-50 rounded-2xl active:scale-90 transition-transform"><Edit2 className="w-5 h-5" /></button>
                           <button onClick={() => handleDeletePrice(price.id)} className="p-3 text-rose-600 bg-rose-50 rounded-2xl active:scale-90 transition-transform"><Trash2 className="w-5 h-5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredPrices.length === 0 && (
                    <div className="px-8 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <Search className="w-10 h-10 opacity-20" />
                        <p className="text-sm font-medium italic">لم يتم العثور على أي نتائج مطابقة</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'farms' && (
            <section className="space-y-8">
              {/* Farm Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <QuickStatCard label="إجمالي المزارع" value={farmStats.total} icon={MapPin} color="text-amber-600" bg="bg-amber-50" />
                <QuickStatCard label="الحسابات النشطة" value={farmStats.activeAccounts} icon={Users} color="text-rose-600" bg="bg-rose-50" />
              </div>

              {/* Farms List */}
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">إدارة المزارع</h2>
                      <p className="text-sm text-gray-500">مشاهدة وتعديل بيانات المزارع الحالية.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsAddingFarm(true);
                      setEditingFarmId(null);
                      setNewFarm({ name: '', farmerIds: [] });
                    }}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-2xl hover:bg-amber-700 transition-all font-bold shadow-lg shadow-amber-100 active:scale-95"
                  >
                    <Plus className="w-5 h-5" />
                    إنشاء مزرعة جديدة
                  </button>
                </div>
                <div className="flex-1">
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full min-w-[680px] text-right">
                      <thead>
                        <tr className="bg-gray-50/50 text-gray-500 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
                          <th className="px-8 py-4">اسم المزرعة</th>
                          <th className="px-8 py-4">الملاك (المزارعون)</th>
                          <th className="px-8 py-4 text-left">التحكم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {farms.map((farm) => {
                          const ownerNames = (farm.farmerIds || [])
                            .map((farmerId) => farmers.find((f) => f.id === farmerId)?.name)
                            .filter(Boolean)
                            .join('، ');
                          return (
                            <tr key={farm.id} className="group hover:bg-amber-50/30 transition-all">
                              <td className="px-8 py-5">
                                <div className="font-bold text-gray-900">{farm.name}</div>
                              </td>
                              <td className="px-8 py-5">
                                <div className="flex flex-wrap gap-1.5">
                                  {ownerNames ? (farm.farmerIds || []).map(id => {
                                    const farmer = farmers.find(f => f.id === id);
                                    return (
                                      <span key={id} className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-lg text-[11px] font-bold">
                                        {farmer?.name || id}
                                      </span>
                                    );
                                  }) : <span className="text-gray-400 italic text-xs">لا يوجد ملاك</span>}
                                </div>
                              </td>
                              <td className="px-8 py-5 text-left">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => startEditFarm(farm)} className="p-2.5 text-amber-600 hover:bg-amber-100 rounded-xl transition-all">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDeleteFarm(farm.id)} className="p-2.5 text-rose-600 hover:bg-rose-100 rounded-xl transition-all">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card Layout */}
                  <div className="sm:hidden divide-y divide-gray-100 bg-white">
                    {farms.map((farm) => (
                      <div key={farm.id} className="p-5 flex flex-col gap-3 group active:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-black text-amber-600 uppercase tracking-wider mb-1 block">المزرعة</span>
                            <span className="font-black text-gray-900 text-lg">{farm.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <button onClick={() => startEditFarm(farm)} className="p-3 text-amber-600 bg-amber-50 rounded-2xl"><Edit2 className="w-5 h-5" /></button>
                             <button onClick={() => handleDeleteFarm(farm.id)} className="p-3 text-rose-600 bg-rose-50 rounded-2xl"><Trash2 className="w-5 h-5" /></button>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-gray-400 block mb-1.5">الملاك المسجلين</span>
                          <div className="flex flex-wrap gap-1.5">
                            {(farm.farmerIds || []).length > 0 ? (farm.farmerIds || []).map(id => {
                              const farmer = farmers.find(f => f.id === id);
                              return (
                                <span key={id} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-xl text-[11px] font-black">
                                  {farmer?.name || 'مزارع غير معروف'}
                                </span>
                              );
                            }) : <span className="text-gray-400 italic text-xs">لا يوجد ملاك</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {farms.length === 0 && (
                    <div className="px-8 py-16 text-center text-gray-400 font-medium italic">
                      لا توجد مزارع مسجلة حالياً.
                    </div>
                  )}
                </div>
              </div>

              {/* Farmer Accounts - Admin Only */}
              {isAdminUser && (
                <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-l from-rose-50/50 to-white">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">حسابات المزارعين</h2>
                        <p className="text-sm text-gray-500">إدارة صلاحيات الدخول للمزارعين (خاص بالمدير).</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setIsAddingFarmerAccount(true);
                        setEditingFarmerAccountId(null);
                        setNewFarmerAccount({ email: '', authUserId: '', farmerId: '', farmId: '', isActive: true });
                        setFarmerAuthPassword('');
                      }}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-2xl hover:bg-rose-700 transition-all font-bold shadow-lg shadow-rose-100 active:scale-95"
                    >
                      <Plus className="w-5 h-5" />
                      إنشاء حساب مزارع
                    </button>
                  </div>
                  <div className="flex-1">
                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full min-w-[880px] text-right">
                        <thead>
                          <tr className="bg-gray-50/50 text-gray-500 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
                            <th className="px-8 py-4">المستخدم (البريد)</th>
                            <th className="px-8 py-4">المزارع والمزرعة</th>
                            <th className="px-8 py-4">الحالة</th>
                            <th className="px-8 py-4 text-left">التحكم</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {farmerAccounts.map((acc) => {
                            const farmer = farmers.find(f => f.id === acc.farmerId);
                            const farm = farms.find(f => f.id === acc.farmId);
                            return (
                              <tr key={acc.id} className="group hover:bg-rose-50/30 transition-all">
                                <td className="px-8 py-5">
                                  <div className="font-bold text-gray-900">{acc.email}</div>
                                  <div className="text-[10px] font-mono text-gray-400 mt-0.5">{acc.authUserId}</div>
                                </td>
                                <td className="px-8 py-5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-700">{farmer?.name || '-'}</span>
                                    <span className="text-xs text-gray-400">←</span>
                                    <span className="text-sm text-gray-500">{farm?.name || '-'}</span>
                                  </div>
                                </td>
                                <td className="px-8 py-5">
                                  <span className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase",
                                    acc.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                                  )}>
                                    {acc.isActive ? 'نشط' : 'موقوف'}
                                  </span>
                                </td>
                                <td className="px-8 py-5 text-left">
                                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => startEditFarmerAccount(acc)} className="p-2.5 text-rose-600 hover:bg-rose-100 rounded-xl transition-all">
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteFarmerAccount(acc.id)} className="p-2.5 text-rose-900/40 hover:text-rose-600 hover:bg-rose-100 rounded-xl transition-all">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card Layout */}
                    <div className="sm:hidden divide-y divide-gray-100 bg-white">
                      {farmerAccounts.map((acc) => {
                        const farmer = farmers.find(f => f.id === acc.farmerId);
                        const farm = farms.find(f => f.id === acc.farmId);
                        return (
                          <div key={acc.id} className="p-5 flex flex-col gap-4 active:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-start">
                              <div className="flex flex-col">
                                <span className="font-black text-gray-900">{acc.email}</span>
                                <span className="text-[10px] font-mono text-gray-400 truncate w-40">{acc.authUserId}</span>
                              </div>
                              <span className={cn(
                                "px-2 py-1 rounded-lg text-[10px] font-black uppercase",
                                acc.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                              )}>
                                {acc.isActive ? 'نشط' : 'موقوف'}
                              </span>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-2xl flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-400 uppercase mb-1">المزارع</span>
                                <span className="text-sm font-bold text-gray-900">{farmer?.name || '-'}</span>
                              </div>
                              <div className="w-px h-8 bg-gray-200" />
                              <div className="flex flex-col text-left">
                                <span className="text-[10px] font-black text-gray-400 uppercase mb-1">المزرعة</span>
                                <span className="text-sm font-bold text-gray-900">{farm?.name || '-'}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                               <button onClick={() => startEditFarmerAccount(acc)} className="flex-1 flex items-center justify-center gap-2 py-3 text-rose-600 bg-rose-50 rounded-2xl font-bold"><Edit2 className="w-4 h-4" /> تعديل</button>
                               <button onClick={() => handleDeleteFarmerAccount(acc.id)} className="p-3 text-rose-900/40 bg-gray-50 rounded-2xl"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
          {activeTab === 'entities' && (
            <section className="space-y-8">
              {/* Entity Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <QuickStatCard label="الكل" value={entityStats.total} icon={Users} color="text-gray-600" bg="bg-gray-50" />
                <QuickStatCard label="مزارعون" value={entityStats.farmers} icon={Leaf} color="text-blue-600" bg="bg-blue-50" />
                <QuickStatCard label="تجار" value={entityStats.merchants} icon={TrendingUp} color="text-purple-600" bg="bg-purple-50" />
                <QuickStatCard label="عمال" value={entityStats.workers} icon={Users} color="text-amber-600" bg="bg-amber-50" />
              </div>

              <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
                      <UserPlus className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">الكيانات والجهات</h2>
                      <p className="text-sm text-gray-500">إدارة قوائم المزارعين والمشترين والقوى العاملة.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAddingEntity(true)}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-all font-bold shadow-lg shadow-green-100 active:scale-95"
                  >
                    <Plus className="w-5 h-5" />
                    إضافة جهة جديدة
                  </button>
                </div>

                <div className="flex-1">
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full min-w-[760px] text-right">
                      <thead>
                        <tr className="bg-gray-50/50 text-gray-500 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
                          <th className="px-8 py-4">الاسم الكامل</th>
                          <th className="px-8 py-4">التصنيف</th>
                          <th className="px-8 py-4">الرسوم / الأجرة</th>
                          <th className="px-8 py-4 text-left">التحكم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {isAddingEntity && (
                          <tr className="bg-green-50/20">
                            <td className="px-8 py-5">
                              <input
                                autoFocus
                                placeholder="ادخل الاسم الكامل..."
                                value={newEntity.name || ''}
                                onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm font-bold"
                              />
                            </td>
                            <td className="px-8 py-5">
                              <select
                                value={newEntity.type}
                                onChange={(e) => setNewEntity({ ...newEntity, type: e.target.value as any })}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm font-bold"
                              >
                                <option value="farmer">مزارع</option>
                                <option value="merchant">تاجر</option>
                                <option value="worker">عامل</option>
                              </select>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  placeholder={newEntity.type === 'merchant' ? 'العمولة %' : 'أجرة الساعة'}
                                  value={newEntity.type === 'merchant' ? newEntity.commissionRate || '' : newEntity.hourlyRate || ''}
                                  onChange={(e) => setNewEntity({ 
                                    ...newEntity, 
                                    [newEntity.type === 'merchant' ? 'commissionRate' : 'hourlyRate']: parseFloat(e.target.value) || 0 
                                  })}
                                  className="w-32 px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-500 text-sm font-bold"
                                />
                                <span className="text-xs font-bold text-gray-400">{newEntity.type === 'merchant' ? '%' : 'شيكل'}</span>
                              </div>
                            </td>
                            <td className="px-8 py-5 text-left">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={handleAddEntity} className="p-2.5 text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors">
                                  <Save className="w-4 h-4" />
                                </button>
                                <button onClick={cancelEditEntity} className="p-2.5 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                        {entities.map((entity) => {
                          const isEditing = editingEntityId === entity.id;
                          if (isEditing && !isAddingEntity) {
                            return (
                              <tr key={entity.id} className="bg-blue-50/20">
                                <td className="px-8 py-5">
                                  <input
                                    autoFocus
                                    value={newEntity.name || ''}
                                    onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                  />
                                </td>
                                <td className="px-8 py-5">
                                  <select
                                    value={newEntity.type}
                                    onChange={(e) => setNewEntity({ ...newEntity, type: e.target.value as any })}
                                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                  >
                                    <option value="farmer">مزارع</option>
                                    <option value="merchant">تاجر</option>
                                    <option value="worker">عامل</option>
                                  </select>
                                </td>
                                <td className="px-8 py-5">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      value={newEntity.type === 'merchant' ? newEntity.commissionRate || '' : newEntity.hourlyRate || ''}
                                      onChange={(e) => setNewEntity({ 
                                        ...newEntity, 
                                        [newEntity.type === 'merchant' ? 'commissionRate' : 'hourlyRate']: parseFloat(e.target.value) || 0 
                                      })}
                                      className="w-32 px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold"
                                    />
                                    <span className="text-xs font-bold text-gray-400">{newEntity.type === 'merchant' ? '%' : 'شيكل'}</span>
                                  </div>
                                </td>
                                <td className="px-8 py-5 text-left">
                                  <div className="flex items-center justify-end gap-1">
                                    <button onClick={handleAddEntity} className="p-2.5 text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors">
                                      <Save className="w-4 h-4" />
                                    </button>
                                    <button onClick={cancelEditEntity} className="p-2.5 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                          return (
                            <tr key={entity.id} className="group hover:bg-green-50/30 transition-all">
                              <td className="px-8 py-5">
                                <div className="font-bold text-gray-900">{entity.name}</div>
                              </td>
                              <td className="px-8 py-5">
                                <span className={cn(
                                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                                  entity.type === 'farmer' ? 'bg-blue-100 text-blue-700' :
                                  entity.type === 'merchant' ? 'bg-purple-100 text-purple-700' :
                                  'bg-amber-100 text-amber-700'
                                )}>
                                  {entity.type === 'farmer' ? 'مزارع' : entity.type === 'merchant' ? 'تاجر' : 'عامل'}
                                </span>
                              </td>
                              <td className="px-8 py-5">
                                <span className="text-sm font-black text-gray-600 italic">
                                  {entity.type === 'merchant' 
                                    ? `% ${entity.commissionRate || 0}`
                                    : `${entity.hourlyRate || 0} شيكل / ساعة`}
                                </span>
                              </td>
                              <td className="px-8 py-5 text-left">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => startEditEntity(entity)} className="p-2.5 text-green-600 hover:bg-green-100 rounded-xl transition-all">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDeleteEntity(entity.id)} className="p-2.5 text-rose-600 hover:bg-rose-100 rounded-xl transition-all">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card Layout */}
                  <div className="sm:hidden divide-y divide-gray-100 bg-white">
                    {isAddingEntity && (
                      <div className="p-5 bg-green-50/20 space-y-4">
                          <input
                          autoFocus
                          placeholder="الاسم الكامل..."
                          value={newEntity.name || ''}
                          onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-green-500 font-bold"
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <select
                            value={newEntity.type}
                            onChange={(e) => setNewEntity({ ...newEntity, type: e.target.value as any })}
                            className="px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none font-bold text-sm"
                          >
                            <option value="farmer">مزارع</option>
                            <option value="merchant">تاجر</option>
                            <option value="worker">عامل</option>
                          </select>
                          <input
                            type="number"
                            placeholder={newEntity.type === 'merchant' ? 'العمولة %' : 'الأجرة'}
                            value={newEntity.type === 'merchant' ? newEntity.commissionRate || '' : newEntity.hourlyRate || ''}
                            onChange={(e) => setNewEntity({ 
                              ...newEntity, 
                              [newEntity.type === 'merchant' ? 'commissionRate' : 'hourlyRate']: parseFloat(e.target.value) || 0 
                            })}
                            className="px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none font-bold text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleAddEntity} className="flex-1 py-3 bg-green-600 text-white rounded-2xl font-bold">حفظ</button>
                            <button onClick={cancelEditEntity} className="px-6 py-3 bg-gray-100 text-gray-500 rounded-2xl font-bold">إلغاء</button>
                        </div>
                      </div>
                    )}
                    {entities.map((entity) => {
                      const isEditing = editingEntityId === entity.id;
                      if (isEditing && !isAddingEntity) {
                        return (
                          <div key={entity.id} className="p-5 bg-blue-50/20 space-y-4">
                            <input
                              autoFocus
                              value={newEntity.name || ''}
                              onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none font-bold"
                            />
                            <div className="grid grid-cols-2 gap-3">
                              <select
                                value={newEntity.type}
                                onChange={(e) => setNewEntity({ ...newEntity, type: e.target.value as any })}
                                className="px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none font-bold text-sm"
                              >
                                <option value="farmer">مزارع</option>
                                <option value="merchant">تاجر</option>
                                <option value="worker">عامل</option>
                              </select>
                              <input
                                type="number"
                                value={newEntity.type === 'merchant' ? newEntity.commissionRate || '' : newEntity.hourlyRate || ''}
                                onChange={(e) => setNewEntity({ 
                                  ...newEntity, 
                                  [newEntity.type === 'merchant' ? 'commissionRate' : 'hourlyRate']: parseFloat(e.target.value) || 0 
                                })}
                                className="px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none font-bold text-sm"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={handleAddEntity} className="flex-1 py-3 bg-blue-600 text-white rounded-2xl font-bold">تحديث</button>
                              <button onClick={cancelEditEntity} className="px-6 py-3 bg-gray-100 text-gray-500 rounded-2xl font-bold">إلغاء</button>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={entity.id} className="p-5 flex items-center justify-between group active:bg-gray-50">
                          <div>
                            <p className="font-black text-gray-900 mb-1">{entity.name}</p>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider",
                                entity.type === 'farmer' ? 'bg-blue-100 text-blue-700' :
                                entity.type === 'merchant' ? 'bg-purple-100 text-purple-700' :
                                'bg-amber-100 text-amber-700'
                              )}>
                                {entity.type === 'farmer' ? 'مزارع' : entity.type === 'merchant' ? 'تاجر' : 'عامل'}
                              </span>
                              <span className="text-[10px] font-bold text-gray-400">
                                {entity.type === 'merchant' ? `% ${entity.commissionRate}` : `${entity.hourlyRate} شيكل`}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                             <button onClick={() => startEditEntity(entity)} className="p-3 text-green-600 bg-green-50 rounded-2xl"><Edit2 className="w-5 h-5" /></button>
                             <button onClick={() => handleDeleteEntity(entity.id)} className="p-3 text-rose-600 bg-rose-50 rounded-2xl"><Trash2 className="w-5 h-5" /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'crops' && (
            <section className="space-y-8">
              {/* Crop Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <QuickStatCard label="عدد الأصناف" value={cropStats.total} icon={Package} color="text-purple-600" bg="bg-purple-50" />
                <QuickStatCard label="وحدات الكرتونة" value={cropStats.boxUnits} icon={Package} color="text-blue-600" bg="bg-blue-50" />
                <QuickStatCard label="وحدات الكيلو" value={cropStats.kgUnits} icon={Leaf} color="text-green-600" bg="bg-green-50" />
              </div>

              <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">المحاصيل والمنتجات</h2>
                      <p className="text-sm text-gray-500">إدارة أنواع الخضروات والفواكه ووحدات بيعها.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAddingCrop(true)}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-2xl hover:bg-purple-700 transition-all font-bold shadow-lg shadow-purple-100 active:scale-95"
                  >
                    <Plus className="w-5 h-5" />
                    إضافة صنف جديد
                  </button>
                </div>

                <div className="flex-1">
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full min-w-[640px] text-right">
                      <thead>
                        <tr className="bg-gray-50/50 text-gray-500 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
                          <th className="px-8 py-4">اسم الصنف</th>
                          <th className="px-8 py-4">طريقة البيع / الوحدة</th>
                          <th className="px-8 py-4 text-left">التحكم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {isAddingCrop && (
                          <tr className="bg-purple-50/20">
                            <td className="px-8 py-5">
                              <input
                                autoFocus
                                placeholder="اسم الصنف..."
                                value={newCrop.name || ''}
                                onChange={(e) => setNewCrop({ ...newCrop, name: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold"
                              />
                            </td>
                            <td className="px-8 py-5">
                              <select
                                value={newCrop.unit}
                                onChange={(e) => setNewCrop({ ...newCrop, unit: e.target.value as any })}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold"
                              >
                                <option value="box">بالكرتونة</option>
                                <option value="kg">بالكيلوغرام</option>
                                <option value="box_and_kg">كرتونة وكيلو</option>
                              </select>
                            </td>
                            <td className="px-8 py-5 text-left">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={handleAddCrop} className="p-2.5 text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors">
                                  <Save className="w-4 h-4" />
                                </button>
                                <button onClick={cancelEditCrop} className="p-2.5 text-gray-400 hover:bg-gray-100 rounded-xl transition-colors">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                        {crops.map((crop) => (
                          <tr key={crop.id} className="group hover:bg-purple-50/30 transition-all">
                            <td className="px-8 py-5 font-bold text-gray-900">{crop.name}</td>
                            <td className="px-8 py-5">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                                crop.unit === 'box' ? "bg-amber-100 text-amber-700" :
                                crop.unit === 'kg' ? "bg-green-100 text-green-700" :
                                "bg-indigo-100 text-indigo-700"
                              )}>
                                {crop.unit === 'box' ? 'كرتونة' : crop.unit === 'kg' ? 'كيلو' : 'كرتونة وكيلو'}
                              </span>
                            </td>
                            <td className="px-8 py-5 text-left">
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => startEditCrop(crop)} className="p-2.5 text-purple-600 hover:bg-purple-100 rounded-xl transition-all">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeleteCrop(crop.id)} className="p-2.5 text-rose-600 hover:bg-rose-100 rounded-xl transition-all">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card Layout */}
                  <div className="sm:hidden divide-y divide-gray-100 bg-white">
                    {isAddingCrop && (
                      <div className="p-5 bg-purple-50/20 space-y-4">
                        <input
                          autoFocus
                          placeholder="اسم الصنف..."
                          value={newCrop.name || ''}
                          onChange={(e) => setNewCrop({ ...newCrop, name: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none font-bold"
                        />
                        <select
                          value={newCrop.unit}
                          onChange={(e) => setNewCrop({ ...newCrop, unit: e.target.value as any })}
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none font-bold text-sm"
                        >
                          <option value="box">بالكرتونة</option>
                          <option value="kg">بالكيلوغرام</option>
                          <option value="box_and_kg">كرتونة وكيلو</option>
                        </select>
                        <div className="flex gap-2">
                          <button onClick={handleAddCrop} className="flex-1 py-3 bg-purple-600 text-white rounded-2xl font-bold">حفظ</button>
                          <button onClick={cancelEditCrop} className="px-6 py-3 bg-gray-100 text-gray-500 rounded-2xl font-bold">إلغاء</button>
                        </div>
                      </div>
                    )}
                    {crops.map((crop) => (
                      <div key={crop.id} className="p-5 flex items-center justify-between group active:bg-gray-50">
                        <div>
                          <p className="font-black text-gray-900 mb-1">{crop.name}</p>
                          <span className={cn(
                            "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider",
                            crop.unit === 'box' ? "bg-amber-100 text-amber-700" :
                            crop.unit === 'kg' ? "bg-green-100 text-green-700" :
                            "bg-indigo-100 text-indigo-700"
                          )}>
                            {crop.unit === 'box' ? 'كرتونة' : crop.unit === 'kg' ? 'كيلو' : 'كرتونة وكيلو'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEditCrop(crop)} className="p-3 text-purple-600 bg-purple-50 rounded-2xl"><Edit2 className="w-5 h-5" /></button>
                          <button onClick={() => handleDeleteCrop(crop.id)} className="p-3 text-rose-600 bg-rose-50 rounded-2xl"><Trash2 className="w-5 h-5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}
          {activeTab === 'transport' && isAdminUser && <LogisticsPanel />}
          
          {activeTab === 'reports' && isAdminUser && <FinancialReports />}
          
          {activeTab === 'archive' && isAdminUser && <ArchiveBrowser />}
        </motion.div>
      </AnimatePresence>

      <FormModals 
        {...{
          isAddingPrice, cancelEditPrice, editingPriceId, newPrice, setNewPrice, handleAddPrice,
          isAddingFarm, cancelEditFarm, editingFarmId, newFarm, setNewFarm, handleAddFarm, farmers,
          isAddingFarmerAccount, isAdminUser, setIsAddingFarmerAccount, setEditingFarmerAccountId,
          editingFarmerAccountId, newFarmerAccount, setNewFarmerAccount, farmerAuthPassword, setFarmerAuthPassword,
          handleAddFarmerAccount, farmsForSelectedFarmer
        }}
      />

      
    </div>
  );
}

// Sub-components for better organization


function FormModals({
  isAddingPrice, cancelEditPrice, editingPriceId, newPrice, setNewPrice, handleAddPrice,
  isAddingFarm, cancelEditFarm, editingFarmId, newFarm, setNewFarm, handleAddFarm, farmers,
  isAddingFarmerAccount, isAdminUser, setIsAddingFarmerAccount, setEditingFarmerAccountId,
  editingFarmerAccountId, newFarmerAccount, setNewFarmerAccount, farmerAuthPassword, setFarmerAuthPassword,
  handleAddFarmerAccount, farmsForSelectedFarmer
}: any) {
  return (
    <>
      <AnimatePresence>
        {isAddingPrice && (
          <ModalContainer isOpen={isAddingPrice} onClose={cancelEditPrice} title={editingPriceId ? 'تعديل سعر' : 'إضافة سعر جديد'} themeColor="bg-blue-600">
            <div className="space-y-4">
              <ModalInput label="اسم البند" value={newPrice.name || ''} onChange={(val: string) => setNewPrice({ ...newPrice, name: val })} placeholder="مثال: سعر الكرتونة" />
              <ModalInput label="السعر" type="number" value={newPrice.value || ''} onChange={(val: string) => setNewPrice({ ...newPrice, value: parseFloat(val) || 0 })} placeholder="0.00" />
              <ModalButton onClick={handleAddPrice} label={editingPriceId ? 'تحديث السعر' : 'حفظ السعر'} color="bg-blue-600" />
            </div>
          </ModalContainer>
        )}

        {isAddingFarm && (
          <ModalContainer isOpen={isAddingFarm} onClose={cancelEditFarm} title={editingFarmId ? 'تعديل مزرعة' : 'إنشاء مزرعة جديدة'} themeColor="bg-amber-600">
            <div className="space-y-6">
              <ModalInput label="اسم المزرعة" value={newFarm.name || ''} onChange={(val: string) => setNewFarm({ ...newFarm, name: val })} placeholder="مثال: مزرعة الشمال" />
              <div className="space-y-2">
                <label className="text-sm font-black text-gray-700 mr-2">اختيار الملاك (المزارعون)</label>
                <div className="max-h-56 overflow-y-auto border border-gray-100 rounded-[1.5rem] p-3 bg-gray-50/50 space-y-2">
                  {farmers.map((farmer: any) => {
                    const selectedIds = newFarm.farmerIds || [];
                    const isChecked = selectedIds.includes(farmer.id);
                    return (
                      <label key={farmer.id} className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl border border-gray-50 cursor-pointer hover:border-amber-200 transition-all">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const currentIds = newFarm.farmerIds || [];
                            const nextIds = e.target.checked ? [...currentIds, farmer.id] : currentIds.filter((id: string) => id !== farmer.id);
                            setNewFarm({ ...newFarm, farmerIds: nextIds });
                          }}
                          className="w-5 h-5 text-amber-600 rounded-lg border-gray-200 focus:ring-amber-500"
                        />
                        <span className="text-sm font-bold text-gray-800">{farmer.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <ModalButton onClick={handleAddFarm} label={editingFarmId ? 'حفظ التعديلات' : 'إنشاء المزرعة'} color="bg-amber-600" />
            </div>
          </ModalContainer>
        )}

        {isAddingFarmerAccount && isAdminUser && (
          <ModalContainer 
            isOpen={isAddingFarmerAccount} 
            onClose={() => { setIsAddingFarmerAccount(false); setEditingFarmerAccountId(null); setFarmerAuthPassword(''); }} 
            title={editingFarmerAccountId ? 'تعديل حساب المزارع' : 'إنشاء حساب مزارع'} 
            themeColor="bg-rose-600"
          >
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ModalInput label="البريد الإلكتروني" type="email" value={newFarmerAccount.email || ''} onChange={(val: string) => setNewFarmerAccount({ ...newFarmerAccount, email: val })} />
                <ModalInput label="Auth User ID (اختياري)" value={newFarmerAccount.authUserId || ''} onChange={(val: string) => setNewFarmerAccount({ ...newFarmerAccount, authUserId: val })} />
              </div>
              <ModalInput 
                label={editingFarmerAccountId ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'} 
                type="password" 
                value={farmerAuthPassword} 
                onChange={(val: string) => setFarmerAuthPassword(val)} 
                placeholder={editingFarmerAccountId ? 'اتركها فارغة بدون تغيير' : 'كلمة المرور...'} 
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-500 mr-2">المزارع</label>
                  <select
                    value={newFarmerAccount.farmerId || ''}
                    onChange={(e) => setNewFarmerAccount({ ...newFarmerAccount, farmerId: e.target.value, farmId: '' })}
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold text-sm"
                  >
                    <option value="">اختر المزارع</option>
                    {farmers.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-500 mr-2">المزرعة</label>
                  <select
                    value={newFarmerAccount.farmId || ''}
                    onChange={(e) => setNewFarmerAccount({ ...newFarmerAccount, farmId: e.target.value })}
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold text-sm"
                  >
                    <option value="">اختر المزرعة</option>
                    {farmsForSelectedFarmer.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <input
                  id="isActiveCheck"
                  type="checkbox"
                  checked={newFarmerAccount.isActive ?? true}
                  onChange={(e) => setNewFarmerAccount({ ...newFarmerAccount, isActive: e.target.checked })}
                  className="w-5 h-5 text-rose-600 rounded-lg border-gray-200 focus:ring-rose-500"
                />
                <label htmlFor="isActiveCheck" className="text-sm font-black text-gray-700 cursor-pointer">الحساب نشط ويحق له الدخول</label>
              </div>
              <ModalButton onClick={handleAddFarmerAccount} label={editingFarmerAccountId ? 'حفظ الحساب' : 'إنشاء الحساب'} color="bg-rose-600" />
            </div>
          </ModalContainer>
        )}

        
      </AnimatePresence>
    </>
  );
}

