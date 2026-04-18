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
  subscribeToCollection, 
  createDocument, 
  updateDocument, 
  deleteDocument,
  getDocument,
  getCollection
} from '../services/db';
import { resolveReceiptUrl } from '../services/storage';
import { ensureFarmerAuthUser } from '../services/adminAuth';
import { Entity, Crop, Settings as SettingsType, GlobalPrice, Farm, FarmerAccount, Shipment, VehicleExpense } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { isAllowedAdminEmail } from '../lib/authz';
import { supabase } from '../supabase';

const normalizeEntityType = (type?: string) => {
  const value = (type || '').toString().trim().toLowerCase();
  if (['farmer', 'مزارع'].includes(value)) return 'farmer';
  if (['merchant', 'تاجر'].includes(value)) return 'merchant';
  if (['worker', 'عامل'].includes(value)) return 'worker';
  return value;
};

export default function SettingsPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [farmerAccounts, setFarmerAccounts] = useState<FarmerAccount[]>([]);
  const [globalPrices, setGlobalPrices] = useState<GlobalPrice[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [settings, setSettings] = useState<SettingsType>({
    boxPrice: 0,
    waterPrice: 0,
    transportFeePerUnit: 0
  });

  const [vehicleExpenses, setVehicleExpenses] = useState<VehicleExpense[]>([]);
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
    const totalPackages = shipments.reduce((sum, s) => sum + (s.packagesCount || 0), 0);
    const totalRevenue = shipments.reduce((sum, s) => sum + (s.boxRentalTotal || 0), 0);
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
    const unsubEntities = subscribeToCollection<Entity>('entities', setEntities);
    const unsubCrops = subscribeToCollection<Crop>('crops', setCrops);
    const unsubPrices = subscribeToCollection<GlobalPrice>('global_prices', setGlobalPrices);
    const unsubFarms = subscribeToCollection<Farm>('farms', setFarms);
    const unsubShipments = subscribeToCollection<Shipment>('shipments', setShipments);
    const unsubAccounts = subscribeToCollection<FarmerAccount>('farmer_accounts', setFarmerAccounts);
    const unsubVExpenses = subscribeToCollection<VehicleExpense>('vehicle_expenses', (data) => setVehicleExpenses(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())));
    
    // Load settings (legacy)
    getDocument<SettingsType>('settings', 'global').then(data => {
      if (data) setSettings(data);
    });

    return () => {
      unsubEntities();
      unsubCrops();
      unsubPrices();
      unsubFarms();
      unsubShipments();
      unsubAccounts();
      unsubVExpenses();
    };
  }, []);

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
        setFarmerAccounts((prev) =>
          prev.map((acc) => (acc.id === editingFarmerAccountId ? ({ ...acc, ...payload } as FarmerAccount) : acc))
        );
        toast.success('تم تحديث حساب المزارع بنجاح');
      } else {
        const createdId = await createDocument('farmer_accounts', payload);
        if (createdId) {
          setFarmerAccounts((prev) => [{ ...(payload as FarmerAccount), id: createdId }, ...prev]);
        }
        toast.success('تم إنشاء حساب المزارع بنجاح');
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
      setFarmerAccounts((prev) => prev.filter((acc) => acc.id !== id));
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
          {activeTab === 'transport' && isAdminUser && (
            <section className="space-y-8">
              {/* Transport Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <QuickStatCard label="إجمالي الطرود" value={transportStats.totalPackages} icon={Package} color="text-blue-600" bg="bg-blue-50" />
                <QuickStatCard label="دخل النقل التراكمي" value={formatCurrency(transportStats.totalRevenue)} icon={DollarSign} color="text-green-600" bg="bg-green-50" />
                <QuickStatCard label="مصاريف المركبات" value={formatCurrency(transportStats.totalExpenses)} icon={Fuel} color="text-rose-600" bg="bg-rose-50" />
                <QuickStatCard label="صافي ربح النقل" value={formatCurrency(transportStats.netProfit)} icon={TrendingUp} color="text-amber-600" bg="bg-amber-50" />
              </div>

              {/* Vehicle Expenses Management */}
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                  <div>
                    <h3 className="text-xl font-black text-gray-900">سجل مصاريف وصيانة المركبات</h3>
                    <p className="text-sm text-gray-500 font-bold">إدارة ديزل وصيانة وتأمين شاحنات النقل</p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingVehicleExpenseId(null);
                      setNewVehicleExpense({ type: 'diesel', cost: 0, date: new Date().toISOString().split('T')[0], notes: '' });
                      setIsAddingVehicleExpense(true);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-2xl hover:bg-purple-700 transition-all font-black text-sm shadow-xl shadow-purple-100 active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    إضافة مصروف جديد
                  </button>
                </div>

                <div className="flex-1">
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-white border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                          <th className="p-6">التاريخ</th>
                          <th className="p-6">نوع المصروف</th>
                          <th className="p-6">المبلغ</th>
                          <th className="p-6">ملاحظات</th>
                          <th className="p-6 text-center w-32">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {isAddingVehicleExpense && (
                          <tr className="bg-purple-50/20">
                            <td className="p-6">
                              <input
                                type="date"
                                value={newVehicleExpense.date}
                                onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, date: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold"
                              />
                            </td>
                            <td className="p-6">
                              <select
                                value={newVehicleExpense.type}
                                onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, type: e.target.value as any })}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold"
                              >
                                <option value="diesel">ديزل / وقود</option>
                                <option value="maintenance">صيانة / إصلاح</option>
                                <option value="insurance">تأمين</option>
                                <option value="license">ترخيص</option>
                                <option value="other">أخرى</option>
                              </select>
                            </td>
                            <td className="p-6">
                              <input
                                type="number"
                                placeholder="المبلغ"
                                value={newVehicleExpense.cost || ''}
                                onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, cost: parseFloat(e.target.value) || 0 })}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold"
                              />
                            </td>
                            <td className="p-6">
                              <input
                                placeholder="ملاحظات..."
                                value={newVehicleExpense.notes}
                                onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, notes: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold"
                              />
                            </td>
                            <td className="p-6">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={handleAddVehicleExpense} className="p-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors">
                                  <Save className="w-4 h-4" />
                                </button>
                                <button onClick={() => setIsAddingVehicleExpense(false)} className="p-2.5 bg-white text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                        {vehicleExpenses.length === 0 && !isAddingVehicleExpense ? (
                          <tr>
                            <td colSpan={5} className="p-20 text-center">
                              <div className="flex flex-col items-center gap-3 text-gray-300">
                                <Truck className="w-12 h-12 opacity-20" />
                                <p className="font-bold">لا يوجد مصاريف مسجلة للنقل</p>
                              </div>
                            </td>
                          </tr>
                        ) : vehicleExpenses.map((v) => (
                          <tr key={v.id} className="hover:bg-gray-50/50 transition-colors group">
                            <td className="p-6">
                              <span className="text-sm font-black text-gray-900">{formatDate(v.date)}</span>
                            </td>
                            <td className="p-6">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center",
                                  v.type === 'diesel' ? 'bg-amber-50 text-amber-600' :
                                  v.type === 'maintenance' ? 'bg-blue-50 text-blue-600' :
                                  v.type === 'insurance' ? 'bg-green-50 text-green-600' :
                                  v.type === 'license' ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-600'
                                )}>
                                  {v.type === 'diesel' ? <Fuel className="w-4 h-4" /> :
                                   v.type === 'maintenance' ? <Wrench className="w-4 h-4" /> :
                                   v.type === 'insurance' ? <ShieldCheck className="w-4 h-4" /> :
                                   v.type === 'license' ? <FileText className="w-4 h-4" /> : <SettingsIcon className="w-4 h-4" />
                                  }
                                </div>
                                <span className="text-sm font-bold text-gray-700">
                                  {v.type === 'diesel' ? 'ديزل / وقود' :
                                   v.type === 'maintenance' ? 'صيانة / إصلاح' :
                                   v.type === 'insurance' ? 'تأمين' :
                                   v.type === 'license' ? 'ترخيص' : 'أخرى'}
                                </span>
                              </div>
                            </td>
                            <td className="p-6">
                              <span className="text-sm font-black text-rose-600">{formatCurrency(v.cost)}</span>
                            </td>
                            <td className="p-6">
                              <span className="text-xs font-bold text-gray-500">{v.notes || '-'}</span>
                            </td>
                            <td className="p-6">
                              <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => startEditVehicleExpense(v)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDeleteVehicleExpense(v.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors">
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
                    {isAddingVehicleExpense && (
                      <div className="p-5 bg-purple-50/20 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="date"
                            value={newVehicleExpense.date}
                            onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, date: e.target.value })}
                            className="px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none font-bold text-xs"
                          />
                          <input
                            type="number"
                            placeholder="المبلغ"
                            value={newVehicleExpense.cost || ''}
                            onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, cost: parseFloat(e.target.value) || 0 })}
                            className="px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none font-bold text-sm"
                          />
                        </div>
                        <select
                          value={newVehicleExpense.type}
                          onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, type: e.target.value as any })}
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none font-bold text-sm"
                        >
                          <option value="diesel">ديزل / وقود</option>
                          <option value="maintenance">صيانة / إصلاح</option>
                          <option value="insurance">تأمين</option>
                          <option value="license">ترخيص</option>
                          <option value="other">أخرى</option>
                        </select>
                        <input
                          placeholder="ملاحظات..."
                          value={newVehicleExpense.notes}
                          onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, notes: e.target.value })}
                          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none font-bold"
                        />
                        <div className="flex gap-2">
                          <button onClick={handleAddVehicleExpense} className="flex-1 py-3 bg-purple-600 text-white rounded-2xl font-bold">حفظ المصروف</button>
                          <button onClick={() => setIsAddingVehicleExpense(false)} className="px-6 py-3 bg-gray-100 text-gray-500 rounded-2xl font-bold">إلغاء</button>
                        </div>
                      </div>
                    )}
                    {vehicleExpenses.length === 0 && !isAddingVehicleExpense ? (
                      <div className="p-10 text-center text-gray-300 font-bold italic">لا يوجد مصاريف مسجلة</div>
                    ) : vehicleExpenses.map((v) => (
                      <div key={v.id} className="p-5 flex flex-col gap-4 active:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase mb-1">{formatDate(v.date)}</span>
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-6 h-6 rounded-lg flex items-center justify-center",
                                v.type === 'diesel' ? 'bg-amber-50 text-amber-600' :
                                v.type === 'maintenance' ? 'bg-blue-50 text-blue-600' :
                                v.type === 'insurance' ? 'bg-green-50 text-green-600' :
                                v.type === 'license' ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-600'
                              )}>
                                {v.type === 'diesel' ? <Fuel className="w-3 h-3" /> :
                                 v.type === 'maintenance' ? <Wrench className="w-3 h-3" /> :
                                 v.type === 'insurance' ? <ShieldCheck className="w-3 h-3" /> :
                                 v.type === 'license' ? <FileText className="w-3 h-3" /> : <SettingsIcon className="w-3 h-3" />
                                }
                              </div>
                              <span className="font-black text-gray-900">
                                {v.type === 'diesel' ? 'ديزل / وقود' :
                                 v.type === 'maintenance' ? 'صيانة / إصلاح' :
                                 v.type === 'insurance' ? 'تأمين' :
                                 v.type === 'license' ? 'ترخيص' : 'أخرى'}
                              </span>
                            </div>
                          </div>
                          <span className="font-black text-rose-600 text-lg">{formatCurrency(v.cost)}</span>
                        </div>
                        {v.notes && <p className="text-xs text-gray-500 font-bold italic bg-gray-50 p-2 rounded-xl">{v.notes}</p>}
                        <div className="flex gap-2">
                           <button onClick={() => startEditVehicleExpense(v)} className="flex-1 flex items-center justify-center gap-2 py-3 text-blue-600 bg-blue-50 rounded-2xl font-bold"><Edit2 className="w-4 h-4" /> تعديل</button>
                           <button onClick={() => handleDeleteVehicleExpense(v.id)} className="p-3 text-red-600 bg-red-50 rounded-2xl"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}
          {activeTab === 'reports' && isAdminUser && (
            <section className="space-y-8 pb-20">
              {/* Reports Navigation */}
              <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-[2rem] border border-gray-100 shadow-sm sticky top-4 z-20">
                <button onClick={() => setActiveReportSubTab('summary')}
                  className={cn("px-6 py-3 rounded-2xl text-sm font-black transition-all flex items-center gap-2", 
                  activeReportSubTab === 'summary' ? "bg-rose-600 text-white shadow-lg shadow-rose-200" : "text-gray-500 hover:bg-gray-50")}>
                  <PieChart className="w-4 h-4" /> ملخص عام للموقع
                </button>
                <button onClick={() => setActiveReportSubTab('merchants')}
                  className={cn("px-6 py-3 rounded-2xl text-sm font-black transition-all flex items-center gap-2", 
                  activeReportSubTab === 'merchants' ? "bg-rose-600 text-white shadow-lg shadow-rose-200" : "text-gray-500 hover:bg-gray-50")}>
                  <Users className="w-4 h-4" /> تقارير التجار
                </button>
                <button onClick={() => setActiveReportSubTab('farmers')}
                  className={cn("px-6 py-3 rounded-2xl text-sm font-black transition-all flex items-center gap-2", 
                  activeReportSubTab === 'farmers' ? "bg-rose-600 text-white shadow-lg shadow-rose-200" : "text-gray-500 hover:bg-gray-50")}>
                  <Target className="w-4 h-4" /> تقارير المزارعين
                </button>
                <div className="mr-auto px-4">
                   <button className="p-3 text-blue-600 hover:bg-blue-50 rounded-2xl border border-blue-100 transition-all flex items-center gap-2 font-black text-xs" title="تصدير بصيغة PDF">
                     <FileDown className="w-4 h-4" /> تصدير التقرير الحالي
                   </button>
                </div>
              </div>

              {activeReportSubTab === 'summary' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <QuickStatCard label="إجمالي حجم المبيعات" value={formatCurrency(globalSummary.totalSales)} icon={DollarSign} color="text-emerald-600" bg="bg-emerald-50" />
                    <QuickStatCard label="إجمالي عمولة التجار" value={formatCurrency(globalSummary.totalCommission)} icon={Users} color="text-orange-600" bg="bg-orange-50" />
                    <QuickStatCard label="إجمالي صافي المزارعين" value={formatCurrency(globalSummary.totalNet)} icon={TrendingUp} color="text-blue-600" bg="bg-blue-50" />
                    <QuickStatCard label="السيولة المتبقية للموقع" value={formatCurrency(globalSummary.netProfit)} icon={Target} color="text-rose-600" bg="bg-rose-50" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-125 transition-transform duration-700" />
                      <div className="relative z-10">
                        <h4 className="text-gray-900 font-black text-lg mb-6 flex items-center gap-3">
                          <Truck className="text-purple-600 w-6 h-6" /> أداء قسم النقل في الفترة
                        </h4>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                             <span className="text-sm font-bold text-gray-500">دخل النقل (إيجار الطرود)</span>
                             <span className="font-black text-gray-900">{formatCurrency(globalSummary.transportRev)}</span>
                          </div>
                          <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                             <span className="text-sm font-bold text-gray-500">مصاريف المركبات (ديزل/صيانة)</span>
                             <span className="font-black text-rose-600">{formatCurrency(globalSummary.transportExp)}</span>
                          </div>
                          <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                             <span className="text-base font-black text-gray-900">صافي ربح اللوجستيات</span>
                             <span className="text-xl font-black text-purple-600 bg-purple-50 px-4 py-2 rounded-xl">{formatCurrency(globalSummary.transportRev - globalSummary.transportExp)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-900 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
                       <div className="absolute top-10 right-10 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl" />
                       <div className="relative z-10 flex flex-col h-full justify-between">
                          <div>
                            <h4 className="text-white font-black text-lg mb-2">إحصائيات الإنتاج</h4>
                            <p className="text-white/40 text-xs font-bold mb-8">إجمالي الكميات الموردة للموقع خلال الفترة المحددة</p>
                          </div>
                          <div className="flex items-center gap-6">
                             <div className="w-20 h-20 bg-white/10 rounded-[2rem] flex items-center justify-center">
                                <Package className="w-10 h-10 text-white" />
                             </div>
                             <div>
                                <p className="text-white/60 text-xs font-black uppercase tracking-widest mb-1">إجمالي الطرود</p>
                                <p className="text-4xl font-black text-white leading-none">{globalSummary.totalPackages} <span className="text-lg">طرد</span></p>
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {activeReportSubTab === 'merchants' && (
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                  <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/20">
                    <h3 className="text-xl font-black text-gray-900">تصنيف التجار بالأكثر مبيعاً</h3>
                    <span className="text-xs font-bold text-gray-400">إجمالي {merchantReport.length} تجار نشطين</span>
                  </div>
                  <div className="flex-1">
                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="bg-white border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                            <th className="p-6">التاجر</th>
                            <th className="p-6">عدد الشحنات</th>
                            <th className="p-6">إجمالي قيمة المبيعات</th>
                            <th className="p-6">إجمالي العمولة (كمسيون)</th>
                            <th className="p-6 text-center">أعلى نسبة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {merchantReport.map((m, i) => (
                            <tr key={i} className="hover:bg-gray-50/50 transition-colors group">
                              <td className="p-6">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 font-black">
                                    {m.name.charAt(0)}
                                  </div>
                                  <span className="font-black text-gray-900">{m.name}</span>
                                </div>
                              </td>
                              <td className="p-6 font-bold text-gray-500">{m.count}</td>
                              <td className="p-6 font-black text-emerald-600">{formatCurrency(m.sales)}</td>
                              <td className="p-6 font-black text-orange-600">{formatCurrency(m.commission)}</td>
                              <td className="p-6 text-center">
                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden max-w-[100px] mx-auto">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((m.sales / (globalSummary.totalSales || 1)) * 100, 100)}%` }} className="bg-orange-400 h-full" />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card Layout */}
                    <div className="sm:hidden divide-y divide-gray-100 bg-white">
                      {merchantReport.map((m, i) => (
                        <div key={i} className="p-6 flex flex-col gap-4 active:bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-600 font-black text-xl">
                                {m.name.charAt(0)}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-black text-gray-900 text-lg">{m.name}</span>
                                <span className="text-xs font-bold text-gray-400">{m.count} شحنة مباعة</span>
                              </div>
                            </div>
                            <div className="text-left flex flex-col items-end">
                               <span className="text-[10px] font-black text-gray-400 uppercase">الحصة من المبيعات</span>
                               <span className="text-sm font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg mt-1">
                                 {((m.sales / (globalSummary.totalSales || 1)) * 100).toFixed(1)}%
                               </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                             <div className="p-4 bg-gray-50 rounded-2xl">
                                <span className="text-[10px] font-black text-gray-400 block mb-1">إجمالي المبيعات</span>
                                <span className="font-black text-emerald-600 text-sm">{formatCurrency(m.sales)}</span>
                             </div>
                             <div className="p-4 bg-gray-50 rounded-2xl">
                                <span className="text-[10px] font-black text-gray-400 block mb-1">صافي الكمسيون</span>
                                <span className="font-black text-orange-600 text-sm">{formatCurrency(m.commission)}</span>
                             </div>
                          </div>
                          
                          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                             <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((m.sales / (globalSummary.totalSales || 1)) * 100, 100)}%` }} className="bg-orange-400 h-full shadow-[0_0_8px_rgba(251,146,60,0.5)]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeReportSubTab === 'farmers' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                   <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                      {farmerReport.map((f, i) => (
                        <div key={i} className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-2xl hover:border-blue-200 transition-all">
                           <div className="flex justify-between items-start mb-8">
                             <div className="flex items-center gap-4">
                               <div className="w-14 h-14 rounded-3xl bg-blue-600 flex items-center justify-center text-white text-xl font-black shadow-xl shadow-blue-100">
                                 {f.name.charAt(0)}
                               </div>
                               <div>
                                 <h4 className="text-xl font-black text-gray-900 group-hover:text-blue-600 transition-colors">{f.name}</h4>
                                 <p className="text-xs font-bold text-gray-400">إجمالي الإنتاج: {f.packages} طرد</p>
                               </div>
                             </div>
                             <div className="text-left">
                               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">صافي الحساب</p>
                               <p className="text-3xl font-black text-blue-600">{formatCurrency(f.net)}</p>
                             </div>
                           </div>
                           
                           <div className="grid grid-cols-2 gap-4 mb-8">
                             <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100/50">
                               <p className="text-[10px] font-black text-gray-400 uppercase mb-1">إجمالي المبيعات</p>
                               <p className="text-lg font-black text-gray-900">{formatCurrency(f.sales)}</p>
                             </div>
                             <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100/50">
                               <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">نسبة التغطية</p>
                               <p className="text-lg font-black text-emerald-700">{((f.net/f.sales)*100).toFixed(1)}%</p>
                             </div>
                           </div>

                           <div className="space-y-2">
                             <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2">توزيع المحاصيل</p>
                             <div className="flex flex-wrap gap-2">
                               {(Object.values(f.crops) as any[]).map((c, j) => (
                                 <div key={j} className="px-3 py-1.5 bg-gray-900 text-white rounded-xl text-xs font-black flex items-center gap-2">
                                   <span>{c.name}</span>
                                   <span className="w-5 h-5 bg-white/10 rounded-md flex items-center justify-center text-[10px]">{c.quantity}</span>
                                 </div>
                               ))}
                             </div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              )}
            </section>
          )}
          {activeTab === 'archive' && isAdminUser && (
            <section className="space-y-6">
              {/* Archive Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <QuickStatCard label="إجمالي الطرود" value={archiveStats.totalCount} icon={Package} color="text-gray-600" bg="bg-gray-100" />
                <QuickStatCard label="إجمالي المبيعات" value={formatCurrency(archiveStats.totalSales)} icon={DollarSign} color="text-green-600" bg="bg-green-50" />
                <QuickStatCard label="الصافي للمزارعين" value={formatCurrency(archiveStats.totalNet)} icon={TrendingUp} color="text-blue-600" bg="bg-blue-50" />
              </div>

              {/* Archive Filters */}
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4">
                <div className="flex items-center gap-2 text-gray-900 font-black mb-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <span>تصفية الأرشيف</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="بحث بالرقم أو الاسم..."
                      value={archiveSearch}
                      onChange={(e) => setArchiveSearch(e.target.value)}
                      className="w-full pr-11 pl-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-gray-200 outline-none text-sm font-bold shadow-inner transition-all"
                    />
                  </div>

                  <select
                    value={archiveFarmerFilter}
                    onChange={(e) => setArchiveFarmerFilter(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl outline-none text-sm focus:bg-white focus:border-gray-200 shadow-inner font-bold"
                  >
                    <option value="all">كل المزارعين</option>
                    {farmers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>

                  <select
                    value={archiveMerchantFilter}
                    onChange={(e) => setArchiveMerchantFilter(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl outline-none text-sm focus:bg-white focus:border-gray-200 shadow-inner font-bold"
                  >
                    <option value="all">كل التجار</option>
                    {entities.filter(e => normalizeEntityType(e.type as string) === 'merchant').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>

                  <select
                    value={archiveCropFilter}
                    onChange={(e) => setArchiveCropFilter(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl outline-none text-sm focus:bg-white focus:border-gray-200 shadow-inner font-bold"
                  >
                    <option value="all">كل المحاصيل</option>
                    {crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center gap-3 bg-gray-50/50 p-2 rounded-2xl border border-gray-100">
                    <div className="p-2 bg-white rounded-xl shadow-sm"><Calendar className="w-4 h-4 text-gray-400" /></div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">من تاريخ:</label>
                    <input
                      type="date"
                      value={archiveStartDate}
                      onChange={(e) => setArchiveStartDate(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-sm font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-3 bg-gray-50/50 p-2 rounded-2xl border border-gray-100">
                    <div className="p-2 bg-white rounded-xl shadow-sm"><Calendar className="w-4 h-4 text-gray-400" /></div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">إلى تاريخ:</label>
                    <input
                      type="date"
                      value={archiveEndDate}
                      onChange={(e) => setArchiveEndDate(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-sm font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Archive List */}
              <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                {/* Desktop View */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full min-w-[900px] text-right">
                    <thead>
                      <tr className="bg-gray-50/50 text-gray-500 text-[10px] font-black uppercase tracking-widest border-b border-gray-100">
                        <th className="px-8 py-4">الشحنة</th>
                        <th className="px-8 py-4">التاريخ</th>
                        <th className="px-8 py-4">المزارع</th>
                        <th className="px-8 py-4">المحصول / الصنف</th>
                        <th className="px-8 py-4">التاجر</th>
                        <th className="px-8 py-4 text-left">الصافي</th>
                        <th className="px-8 py-4 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredArchivedShipments.map((sh) => {
                        const farmer = farmers.find(f => f.id === sh.farmerId);
                        const crop = crops.find(c => c.id === sh.cropId);
                        const merchant = entities.find(m => m.id === sh.merchantId);
                        
                        return (
                          <tr key={sh.id} className="group hover:bg-gray-50/50 transition-all">
                            <td className="px-8 py-5">
                              <span className="font-black text-gray-900 group-hover:text-blue-600 transition-colors uppercase">{sh.shipmentNumber}</span>
                            </td>
                            <td className="px-8 py-5 text-sm font-bold text-gray-500">
                              {formatDate(sh.date)}
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[10px] font-black text-blue-600">
                                  {farmer?.name.substring(0, 1)}
                                </div>
                                <span className="text-sm font-bold text-gray-700">{farmer?.name}</span>
                              </div>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-900">{crop?.name} {sh.grade && <span className="mr-1 text-[9px] bg-gray-100 px-1.5 py-0.5 rounded-md font-black">({sh.grade})</span>}</span>
                                <span className="text-[10px] font-bold text-gray-400">{sh.packagesCount} طرد</span>
                              </div>
                            </td>
                            <td className="px-8 py-5 text-sm font-bold text-gray-600">
                              {merchant?.name || '—'}
                            </td>
                            <td className="px-8 py-5 text-left">
                              <span className="font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-xl">{formatCurrency(sh.farmerNetAmount || 0)}</span>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center justify-center gap-2">
                                {sh.receiptImageUrl && (
                                  <button onClick={() => openReceiptArchive(sh.receiptImageUrl!)} className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                                    <Receipt className="w-5 h-5" />
                                  </button>
                                )}
                                <button onClick={() => setSelectedArchivedShipment(sh)} className="p-2.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded-xl transition-all">
                                  <FileText className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="sm:hidden divide-y divide-gray-100">
                   {filteredArchivedShipments.map((sh) => {
                      const farmer = farmers.find(f => f.id === sh.farmerId);
                      const crop = crops.find(c => c.id === sh.cropId);
                      const merchant = entities.find(m => m.id === sh.merchantId);
                      return (
                        <div key={sh.id} className="p-5 space-y-4">
                           <div className="flex justify-between items-start">
                              <div>
                                 <div className="text-sm font-black text-gray-900 uppercase">{sh.shipmentNumber}</div>
                                 <div className="text-[10px] font-bold text-gray-400">{formatDate(sh.date)}</div>
                              </div>
                              <div className="text-left">
                                 <div className="text-[10px] font-black text-gray-400 uppercase">الصافي</div>
                                 <div className="font-black text-green-600">{formatCurrency(sh.farmerNetAmount || 0)}</div>
                              </div>
                           </div>
                           
                           <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="flex flex-col">
                                 <span className="text-[10px] font-black text-gray-400 uppercase mb-0.5">المزارع</span>
                                 <span className="font-bold text-gray-700 truncate">{farmer?.name}</span>
                              </div>
                              <div className="flex flex-col text-left">
                                 <span className="text-[10px] font-black text-gray-400 uppercase mb-0.5">التاجر</span>
                                 <span className="font-bold text-gray-700 truncate">{merchant?.name || '—'}</span>
                              </div>
                              <div className="flex flex-col">
                                 <span className="text-[10px] font-black text-gray-400 uppercase mb-0.5">المحصول</span>
                                 <span className="font-bold text-gray-700 truncate">{crop?.name} {sh.grade && `(${sh.grade})`}</span>
                              </div>
                              <div className="flex flex-col text-left">
                                 <span className="text-[10px] font-black text-gray-400 uppercase mb-0.5">الكمية</span>
                                 <span className="font-bold text-gray-700">{sh.packagesCount} طرد</span>
                              </div>
                           </div>

                           <div className="flex gap-2">
                              {sh.receiptImageUrl && (
                                <button onClick={() => openReceiptArchive(sh.receiptImageUrl!)} className="flex-1 py-2.5 bg-blue-50 text-blue-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                                  <Receipt className="w-4 h-4" /> الفاتورة
                                </button>
                              )}
                              <button onClick={() => setSelectedArchivedShipment(sh)} className="flex-1 py-2.5 bg-gray-50 text-gray-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                                <FileText className="w-4 h-4" /> التفاصيل
                              </button>
                           </div>
                        </div>
                      );
                   })}
                </div>

                {filteredArchivedShipments.length === 0 && (
                  <div className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-gray-400 max-w-xs mx-auto">
                      <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center">
                        <Archive className="w-10 h-10 opacity-20" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-gray-900">لا توجد بيانات</h3>
                        <p className="text-sm font-medium leading-relaxed italic mt-1">لم يتم العثور على أي شحنات مؤرشفة تتطابق مع فيلتر البحث.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </motion.div>
      </AnimatePresence>

      <FormModals 
        {...{
          isAddingPrice, cancelEditPrice, editingPriceId, newPrice, setNewPrice, handleAddPrice,
          isAddingFarm, cancelEditFarm, editingFarmId, newFarm, setNewFarm, handleAddFarm, farmers,
          isAddingFarmerAccount, isAdminUser, setIsAddingFarmerAccount, setEditingFarmerAccountId,
          editingFarmerAccountId, newFarmerAccount, setNewFarmerAccount, farmerAuthPassword, setFarmerAuthPassword,
          handleAddFarmerAccount, farmsForSelectedFarmer,
          isAddingVehicleExpense, setIsAddingVehicleExpense, editingVehicleExpenseId, setEditingVehicleExpenseId,
          newVehicleExpense, setNewVehicleExpense, handleAddVehicleExpense
        }}
      />

      <ArchiveModals 
        {...{
          previewReceipt, setPreviewReceipt, isReceiptLoading, setIsReceiptLoading,
          selectedArchivedShipment, setSelectedArchivedShipment,
          entities, crops, openReceiptArchive
        }}
      />
    </div>
  );
}

// Sub-components for better organization
function QuickStatCard({ label, value, icon: Icon, color, bg, sub }: any) {
  return (
    <div className="bg-white p-5 rounded-3xl border border-gray-100 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div className={cn("p-3 rounded-2xl", bg, color)}>
        <Icon className="w-5 h-5 text-current" />
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
        <div className="flex items-baseline gap-1.5">
          <p className="text-xl font-black text-gray-900">{value}</p>
          {sub && <span className="text-[10px] font-bold text-gray-400">{sub}</span>}
        </div>
      </div>
    </div>
  );
}

function FormModals({
  isAddingPrice, cancelEditPrice, editingPriceId, newPrice, setNewPrice, handleAddPrice,
  isAddingFarm, cancelEditFarm, editingFarmId, newFarm, setNewFarm, handleAddFarm, farmers,
  isAddingFarmerAccount, isAdminUser, setIsAddingFarmerAccount, setEditingFarmerAccountId,
  editingFarmerAccountId, newFarmerAccount, setNewFarmerAccount, farmerAuthPassword, setFarmerAuthPassword,
  handleAddFarmerAccount, farmsForSelectedFarmer,
  isAddingVehicleExpense, setIsAddingVehicleExpense, editingVehicleExpenseId, setEditingVehicleExpenseId,
  newVehicleExpense, setNewVehicleExpense, handleAddVehicleExpense
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

        {isAddingVehicleExpense && (
          <ModalContainer 
            isOpen={isAddingVehicleExpense} 
            onClose={() => { setIsAddingVehicleExpense(false); setEditingVehicleExpenseId(null); }} 
            title={editingVehicleExpenseId ? 'تعديل مصروف نقل' : 'إضافة مصروف نقل جديد'} 
            themeColor="bg-purple-600"
          >
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-black text-gray-500 mr-2">نوع المصروف</label>
                  <select
                    value={newVehicleExpense.type || 'diesel'}
                    onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, type: e.target.value as any })}
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-purple-400 font-bold text-sm"
                  >
                    <option value="diesel">ديزل / وقود</option>
                    <option value="maintenance">صيانة / إصلاح</option>
                    <option value="insurance">تأمين</option>
                    <option value="license">ترخيص</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>
                <ModalInput label="التاريخ" type="date" value={newVehicleExpense.date || ''} onChange={(val: string) => setNewVehicleExpense({ ...newVehicleExpense, date: val })} />
              </div>
              <ModalInput label="التكلفة (شيكل)" type="number" value={newVehicleExpense.cost || ''} onChange={(val: string) => setNewVehicleExpense({ ...newVehicleExpense, cost: parseFloat(val) || 0 })} placeholder="0.00" />
              <ModalInput label="ملاحظات" value={newVehicleExpense.notes || ''} onChange={(val: string) => setNewVehicleExpense({ ...newVehicleExpense, notes: val })} placeholder="اختياري..." />
              <ModalButton onClick={handleAddVehicleExpense} label={editingVehicleExpenseId ? 'تحديث المصروف' : 'حفظ المصروف'} color="bg-purple-600" />
            </div>
          </ModalContainer>
        )}
      </AnimatePresence>
    </>
  );
}

// Layout helper components
function ModalContainer({ isOpen, onClose, title, themeColor, children }: any) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }}
        className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/20"
      >
        <div className={cn("p-8 flex items-center justify-between text-white", themeColor)}>
          <h2 className="text-2xl font-black">{title}</h2>
          <button onClick={onClose} className="p-2.5 bg-white/20 hover:bg-white/30 rounded-2xl transition-all active:scale-90">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-8 max-h-[80vh] overflow-y-auto custom-scrollbar text-right" dir="rtl">{children}</div>
      </motion.div>
    </div>
  );
}

function ModalInput({ label, value, onChange, type = "text", placeholder }: any) {
  return (
    <div className="space-y-1.5 text-right" dir="rtl">
      <label className="text-xs font-black text-gray-500 mr-2">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-5 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-gray-300 focus:bg-white transition-all text-sm font-bold shadow-sm text-right"
      />
    </div>
  );
}

function ModalButton({ onClick, label, color }: any) {
  return (
    <div className="pt-4">
      <button onClick={onClick} className={cn("w-full py-5 text-white rounded-3xl font-black text-xl shadow-xl transition-all active:scale-95", color)}>
        {label}
      </button>
    </div>
  );
}

function ArchiveModals({
  previewReceipt, setPreviewReceipt, isReceiptLoading, setIsReceiptLoading,
  selectedArchivedShipment, setSelectedArchivedShipment,
  entities, crops, openReceiptArchive
}: any) {
  return (
    <>
      <AnimatePresence>
        {/* Receipt Preview Modal */}
        {previewReceipt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPreviewReceipt(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full">
              <div className="absolute -top-16 left-0 right-0 flex justify-between items-center text-white px-2">
                <button onClick={() => setPreviewReceipt(null)} className="flex items-center gap-2 p-3 bg-white/10 hover:bg-white/20 rounded-2xl font-black transition-all">
                  <X className="w-6 h-6" /> إغلاق
                </button>
                <a href={previewReceipt} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-2xl font-black transition-all text-sm">
                  فتح في نافذة جديدة <FileText className="w-5 h-5" />
                </a>
              </div>
              <div className="relative bg-white/5 rounded-[3rem] overflow-hidden border-4 border-white/20 shadow-2xl text-center min-h-[40vh] flex items-center justify-center">
                {isReceiptLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
                    <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
                <img src={previewReceipt} alt="Receipt" className="w-full h-auto max-h-[85vh] object-contain mx-auto" onLoad={() => {}} />
              </div>
            </motion.div>
          </div>
        )}

        {/* Detailed Shipment View Modal */}
        {selectedArchivedShipment && (
          <ModalContainer 
            isOpen={!!selectedArchivedShipment} 
            onClose={() => setSelectedArchivedShipment(null)} 
            title="تفاصيل الشحنة المؤرشفة" 
            themeColor="bg-gray-800"
          >
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">الرقم المرجعي</p>
                  <p className="font-black text-lg text-gray-900 uppercase">{selectedArchivedShipment.shipmentNumber}</p>
                </div>
                <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">التاريخ</p>
                  <p className="font-black text-lg text-gray-900">{formatDate(selectedArchivedShipment.date)}</p>
                </div>
              </div>

              <div className="space-y-4">
                <DetailRow label="المزارع" value={entities.find((e: any) => e.id === selectedArchivedShipment.farmerId)?.name} />
                <DetailRow label="التاجر" value={entities.find((e: any) => e.id === selectedArchivedShipment.merchantId)?.name || 'غير محدد'} />
                <DetailRow label="المحصول" value={`${crops.find((c: any) => c.id === selectedArchivedShipment.cropId)?.name} ${selectedArchivedShipment.grade ? `(صنف ${selectedArchivedShipment.grade})` : ''} (${selectedArchivedShipment.packagesCount} طرد)`} />
                <div className="h-px bg-gray-100 my-4" />
                <DetailRow label="إجمالي قيمة البيع" value={formatCurrency(selectedArchivedShipment.totalSaleAmount || 0)} valueClass="text-gray-900 font-black text-base" />
                <DetailRow label="عمولة التاجر المستقطعة" value={`-${formatCurrency(selectedArchivedShipment.merchantCommissionAmount || 0)}`} valueClass="text-rose-600 font-bold" />
                <DetailRow label="إيجار الطرود (الكراتين)" value={`-${formatCurrency(selectedArchivedShipment.boxRentalTotal || 0)}`} valueClass="text-amber-600 font-bold" />
                
                <div className="p-6 bg-green-50 rounded-[2rem] border-2 border-green-100 flex justify-between items-center mt-6">
                  <div>
                    <span className="text-[10px] font-black text-green-800/50 uppercase tracking-widest block mb-1">الصافي النهائي للمزارع</span>
                    <span className="text-2xl font-black text-green-700">{formatCurrency(selectedArchivedShipment.farmerNetAmount || 0)}</span>
                  </div>
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm shadow-green-100">
                    <DollarSign className="w-8 h-8 text-green-600" />
                  </div>
                </div>
              </div>

              {selectedArchivedShipment.notes && (
                <div className="p-5 bg-amber-50/50 rounded-3xl border border-amber-100">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2">ملاحظات الشحنة</p>
                  <p className="text-sm font-bold text-amber-800 leading-relaxed">{selectedArchivedShipment.notes}</p>
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button onClick={() => setSelectedArchivedShipment(null)} className="flex-1 py-4.5 bg-gray-100 text-gray-700 rounded-3xl font-black text-lg hover:bg-gray-200 transition-all active:scale-95"> إغلاق </button>
              </div>
            </div>
          </ModalContainer>
        )}
      </AnimatePresence>
    </>
  );
}

function DetailRow({ label, value, valueClass = "text-gray-700 font-bold" }: { label: string, value: any, valueClass?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0 border-dashed">
      <span className="text-sm font-black text-gray-400">{label}:</span>
      <span className={cn("text-sm", valueClass)}>{value || '—'}</span>
    </div>
  );
}
