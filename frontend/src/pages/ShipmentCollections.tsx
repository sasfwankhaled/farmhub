import React, { useState, useEffect, useRef, useMemo, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Package, DollarSign, X, Plus, Trash2, CheckCircle2,
  Truck, Camera, Image, Calculator, ChevronDown, Users, Calendar,
  TrendingUp, Wallet, Star, Search, SlidersHorizontal
} from 'lucide-react';
import { getCollection, subscribeToCollection, updateDocument, getDocument } from '../services/db';
import { Shipment, SaleBatch, Entity, Crop, Settings, GlobalPrice } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { supabase } from '../supabase';
import { buildReceiptPath } from '../services/storage';

export default function ShipmentCollectionsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collectingShipments, setCollectingShipments] = useState<Shipment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [globalPrices, setGlobalPrices] = useState<GlobalPrice[]>([]);
  const receiptRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [merchantFilter, setMerchantFilter] = useState('all');
  const [farmerFilter, setFarmerFilter] = useState('all');
  const [cropFilter, setCropFilter] = useState('all');

  // Unified Form state
  const [merchantCommissionRate, setMerchantCommissionRate] = useState('');
  const [boxRentalPerUnit, setBoxRentalPerUnit] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [notes, setNotes] = useState('');

  // Single Collection specific state
  const [saleMethod, setSaleMethod] = useState<'kg' | 'box'>('box');
  const [uniformPrice, setUniformPrice] = useState(true);
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [saleBatches, setSaleBatches] = useState<SaleBatch[]>([{ quantity: 0, pricePerUnit: 0, total: 0 }]);
  const [totalOverride, setTotalOverride] = useState('');

  // Bulk Collection specific state
  const [bulkSaleValues, setBulkSaleValues] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load initial data
    Promise.all([
      getCollection<Entity>('entities'),
      getCollection<Crop>('crops'),
      getCollection<GlobalPrice>('global_prices'),
      getDocument<Settings>('settings', 'global'),
    ]).then(([e, c, p, st]) => {
      if (e) setEntities(e);
      if (c) setCrops(c);
      if (p) setGlobalPrices(p);
      if (st) setSettings(st);
      setLoading(false);
    }).catch(() => setLoading(false));

    // Real-time subscriptions
    const u1 = subscribeToCollection<Shipment>('shipments', (data) => {
      setShipments(
        data
          .filter(sh => sh.status === 'delivered_to_merchant')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    });
    const u2 = subscribeToCollection<Entity>('entities', setEntities);
    const u3 = subscribeToCollection<Crop>('crops', setCrops);

    return () => { u1(); u2(); u3(); };
  }, []);

  const farmers = entities.filter(e => e.type === 'farmer');
  const merchants = entities.filter(e => e.type === 'merchant');

  // Filtered & searched shipments
  const filteredShipments = useMemo(() => {
    return shipments.filter(sh => {
      const farmer = farmers.find(f => f.id === sh.farmerId);
      const merchant = merchants.find(m => m.id === sh.merchantId);
      const crop = crops.find(c => c.id === sh.cropId);
      const q = searchQuery.toLowerCase().trim();

      const matchSearch = !q ||
        sh.shipmentNumber?.toLowerCase().includes(q) ||
        farmer?.name.toLowerCase().includes(q) ||
        merchant?.name.toLowerCase().includes(q) ||
        crop?.name.toLowerCase().includes(q);

      const matchMerchant = merchantFilter === 'all' || sh.merchantId === merchantFilter;
      const matchFarmer = farmerFilter === 'all' || sh.farmerId === farmerFilter;
      const matchCrop = cropFilter === 'all' || sh.cropId === cropFilter;

      return matchSearch && matchMerchant && matchFarmer && matchCrop;
    });
  }, [shipments, searchQuery, merchantFilter, farmerFilter, cropFilter, farmers, merchants, crops]);

  const toggleSelection = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === filteredShipments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredShipments.map(s => s.id)));
    }
  };

  const openCollectModal = (shipmentsToCollect: Shipment[]) => {
    setCollectingShipments(shipmentsToCollect);
    
    let defaultTransportPrice = settings?.transportFeePerUnit?.toString() || '';
    if (!defaultTransportPrice) {
      const transportItem = globalPrices.find(p => p.name.includes('نقل') || p.name.toLowerCase().includes('transport'));
      if (transportItem) defaultTransportPrice = transportItem.value.toString();
    }
    
    const merchantId = shipmentsToCollect[0]?.merchantId;
    const merchant = merchants.find(m => m.id === merchantId);
    setMerchantCommissionRate(merchant?.commissionRate?.toString() || '');

    setReceiptFile(null);
    setReceiptPreview('');
    setNotes('');

    if (shipmentsToCollect.length === 1) {
      const shipment = shipmentsToCollect[0];
      setSaleMethod('box');
      setUniformPrice(true);
      setPricePerUnit('');
      setSaleBatches([{ quantity: shipment.packagesCount, pricePerUnit: 0, total: 0 }]);
      setTotalOverride('');
      const initialTransportPrice = (shipment.boxRentalPerUnit !== undefined && shipment.boxRentalPerUnit !== null)
        ? shipment.boxRentalPerUnit.toString()
        : defaultTransportPrice;
      setBoxRentalPerUnit(initialTransportPrice);
    } else {
      // Bulk initialization
      setBoxRentalPerUnit(defaultTransportPrice);
      const initialBulkValues: Record<string, string> = {};
      shipmentsToCollect.forEach(sh => initialBulkValues[sh.id] = '');
      setBulkSaleValues(initialBulkValues);
    }
  };

  // Shared math for Single mode
  const computedTotal = () => {
    if (collectingShipments.length !== 1) return 0;
    const sh = collectingShipments[0];
    if (uniformPrice) {
      const qty = saleMethod === 'kg' ? (sh.weightKg || 0) : sh.packagesCount || 0;
      return parseFloat(pricePerUnit || '0') * qty;
    }
    return saleBatches.reduce((sum, b) => sum + b.total, 0);
  };

  const singleFinalTotal = parseFloat(totalOverride || '0') || computedTotal();
  const singleCommissionAmount = singleFinalTotal * (parseFloat(merchantCommissionRate || '0') / 100);
  const singleRentalTotal = (collectingShipments[0]?.packagesCount || 0) * parseFloat(boxRentalPerUnit || '0');
  const singleFarmerNet = singleFinalTotal - singleCommissionAmount - singleRentalTotal;

  // Shared math for Bulk mode
  const bulkTotalSale = useMemo(() => {
    return collectingShipments.reduce((sum, sh) => sum + parseFloat(bulkSaleValues[sh.id] || '0'), 0);
  }, [bulkSaleValues, collectingShipments]);

  const bulkTotalCommission = bulkTotalSale * (parseFloat(merchantCommissionRate || '0') / 100);
  const bulkTotalRental = collectingShipments.reduce((sum, sh) => sum + sh.packagesCount, 0) * parseFloat(boxRentalPerUnit || '0');
  const bulkTotalFarmerNet = bulkTotalSale - bulkTotalCommission - bulkTotalRental;


  const updateBatch = (idx: number, field: keyof SaleBatch, value: number) => {
    setSaleBatches(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      updated[idx].total = updated[idx].quantity * updated[idx].pricePerUnit;
      return updated;
    });
  };

  const handleReceiptChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  };

  const handleCollect = async () => {
    if (collectingShipments.length === 0) return;
    
    // Validation
    if (collectingShipments.length === 1) {
      if (singleFinalTotal <= 0) return toast.error('يرجى إدخال المبلغ المحصَّل');
      if (!uniformPrice && saleBatches.some(b => b.quantity <= 0 || b.pricePerUnit <= 0)) {
        return toast.error('يرجى تعبئة جميع دفعات البيع');
      }
    } else {
      const anyEmpty = collectingShipments.some(sh => !bulkSaleValues[sh.id] || parseFloat(bulkSaleValues[sh.id]) <= 0);
      if(anyEmpty) {
        return toast.error('يرجى إدخال مبلغ التحصيل لكل شحنة');
      }
    }

    setIsSubmitting(true);
    try {
      let receiptUrl: string | undefined;
      if (receiptFile) {
        // Use the first shipment id as the unique folder
        const path = buildReceiptPath('shipment_receipts', collectingShipments[0].id, receiptFile.name);
        const { error: upErr } = await supabase.storage.from('receipts').upload(path, receiptFile, { upsert: true });
        if (upErr) throw new Error('فشل رفع الفاتورة: ' + upErr.message);
        receiptUrl = path;
      }

      await Promise.all(collectingShipments.map(sh => {
         const isSingle = collectingShipments.length === 1;
         
         const saleValue = isSingle ? singleFinalTotal : parseFloat(bulkSaleValues[sh.id] || '0');
         const commRate = parseFloat(merchantCommissionRate || '0');
         const commAmount = saleValue * (commRate / 100);
         
         const rentalRate = parseFloat(boxRentalPerUnit || '0');
         const rentalTotal = sh.packagesCount * rentalRate;
         const net = saleValue - commAmount - rentalTotal;

         return updateDocument('shipments', sh.id, {
            status: 'collected',
            totalSaleAmount: saleValue,
            saleMethod: isSingle ? saleMethod : 'box', // Default box for bulk for now
            uniformPrice: isSingle ? uniformPrice : true,
            pricePerUnit: isSingle ? (uniformPrice ? parseFloat(pricePerUnit || '0') : undefined) : saleValue,
            saleBatches: isSingle && !uniformPrice ? saleBatches : undefined,
            merchantCommissionRate: commRate,
            merchantCommissionAmount: commAmount,
            boxRentalPerUnit: rentalRate,
            boxRentalTotal: rentalTotal,
            farmerNetAmount: net,
            collectedAt: new Date().toISOString(),
            receiptImageUrl: receiptUrl,
            merchantName: merchants.find(m => m.id === sh.merchantId)?.name,
            cropName: crops.find(c => c.id === sh.cropId)?.name,
            notes,
         });
      }));

      toast.success('تم التحصيل بنجاح وإرسال الشحنات لصفحة تسليم المزارعين!');
      setCollectingShipments([]);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ بشبكة الاتصال');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPendingPackages = shipments.reduce((sum, s) => sum + s.packagesCount, 0);
  const hasActiveFilters = searchQuery || merchantFilter !== 'all' || farmerFilter !== 'all' || cropFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setMerchantFilter('all');
    setFarmerFilter('all');
    setCropFilter('all');
  };

  return (
    <div className="space-y-6 pb-24" dir="rtl">
      {/* Premium Header */}
      <header className="relative bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center shadow-inner">
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">تحصيلات الطرود</h1>
              <p className="text-gray-500 font-medium">الشحنات المسلّمة للتاجر وبانتظار إدخال المبالغ</p>
            </div>
          </div>
        </div>
      </header>

      {/* Analytics Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-[2rem] shadow-lg shadow-blue-200 flex items-center gap-5 text-white transform hover:scale-[1.02] transition-transform">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-inner">
            <Package className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-blue-100 text-[10px] font-black uppercase tracking-widest mb-1.5">شحنات معلقة للتحصيل</p>
            <p className="text-3xl font-black leading-none">{shipments.length}</p>
          </div>
        </div>
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-[2rem] shadow-lg shadow-indigo-200 flex items-center gap-5 text-white transform hover:scale-[1.02] transition-transform">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-inner">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-indigo-100 text-[10px] font-black uppercase tracking-widest mb-1.5">إجمالي الطرود بانتظار السيولة</p>
            <p className="text-3xl font-black leading-none">{totalPendingPackages} <span className="text-lg opacity-80">طرد</span></p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-black text-gray-700">تصفية النتائج</span>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mr-auto flex items-center gap-1.5 text-xs font-black text-rose-500 bg-rose-50 hover:bg-rose-100 transition-colors px-3 py-1.5 rounded-xl"
            >
              <X className="w-3 h-3" />
              مسح الفلاتر
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-1">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="بحث برقم الشحنة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-10 py-3 bg-gray-50 border-2 border-transparent focus:border-blue-400 rounded-2xl outline-none text-sm font-bold transition-all"
            />
          </div>

          <div className="relative">
            <Wallet className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 pointer-events-none" />
            <select
              value={merchantFilter}
              onChange={(e) => setMerchantFilter(e.target.value)}
              className={cn(
                "w-full pl-4 pr-10 py-3 bg-gray-50 border-2 rounded-2xl outline-none text-sm font-bold appearance-none transition-all",
                merchantFilter !== 'all' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-transparent'
              )}
            >
              <option value="all">كل التجار</option>
              {merchants.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <div className="relative">
            <Users className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 pointer-events-none" />
            <select
              value={farmerFilter}
              onChange={(e) => setFarmerFilter(e.target.value)}
              className={cn(
                "w-full pl-4 pr-10 py-3 bg-gray-50 border-2 rounded-2xl outline-none text-sm font-bold appearance-none transition-all",
                farmerFilter !== 'all' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-transparent'
              )}
            >
              <option value="all">كل المزارعين</option>
              {farmers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>

          <div className="relative">
            <Package className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 pointer-events-none" />
            <select
              value={cropFilter}
              onChange={(e) => setCropFilter(e.target.value)}
              className={cn(
                "w-full pl-4 pr-10 py-3 bg-gray-50 border-2 rounded-2xl outline-none text-sm font-bold appearance-none transition-all",
                cropFilter !== 'all' ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-transparent'
              )}
            >
              <option value="all">كل الأصناف</option>
              {crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center mt-2">
           {hasActiveFilters && (
            <p className="text-xs font-bold text-gray-400">
              يُعرض <span className="text-blue-600 font-black">{filteredShipments.length}</span> من أصل <span className="font-black">{shipments.length}</span> شحنة
            </p>
          )}
          {filteredShipments.length > 0 && (
            <button onClick={selectAll} className="text-sm font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors shrink-0 mr-auto">
              {selectedIds.size === filteredShipments.length ? 'إلغاء تحديد الكل' : 'تحديد جميع النتائج'}
            </button>
          )}
        </div>
      </div>

      {/* Floating Action Bar */}
      <AnimatePresence>
         {selectedIds.size > 0 && (
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
               className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-lg bg-gray-900 border border-gray-700 text-white p-4 rounded-3xl shadow-2xl z-50 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="bg-indigo-500/20 text-indigo-300 w-10 h-10 rounded-full flex items-center justify-center font-black">
                     {selectedIds.size}
                  </div>
                  <span className="font-bold text-sm">شحنات بانتظار التحصيل</span>
               </div>
               <button onClick={() => openCollectModal(filteredShipments.filter(sh => selectedIds.has(sh.id)))}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-2xl font-black shadow-lg shadow-indigo-500/30 transition-all active:scale-95 text-sm">
                  متابعة التحصيل
               </button>
            </motion.div>
         )}
      </AnimatePresence>

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-gray-100">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-bold">جاري التحميل...</p>
        </div>
      ) : filteredShipments.length === 0 ? (
        <div className="bg-white rounded-[3rem] border-2 border-dashed border-gray-200 p-16 text-center shadow-sm">
          <CheckCircle2 className="w-16 h-16 text-green-300 mx-auto mb-4" />
          <p className="text-xl font-black text-gray-700">
            {hasActiveFilters ? 'لا توجد نتائج مطابقة للفلاتر المحددة' : 'لا توجد شحنات بانتظار التحصيل'}
          </p>
          <p className="text-sm text-gray-400 mt-2 font-medium">
            {hasActiveFilters ? 'جرب تغيير الفلاتر أو مسحها.' : 'جميع الشحنات تم تحصيلها بنجاح وأرصدتك مسوّاة.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredShipments.map((sh, idx) => {
            const farmer = farmers.find(f => f.id === sh.farmerId);
            const crop = crops.find(c => c.id === sh.cropId);
            const merchant = merchants.find(m => m.id === sh.merchantId);
            const isSelected = selectedIds.has(sh.id);

            return (
              <motion.div
                key={sh.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => toggleSelection(sh.id)}
                className={cn("group bg-white rounded-[2rem] border-2 shadow-sm p-6 sm:p-8 hover:shadow-xl transition-all cursor-pointer",
                   isSelected ? "border-indigo-400 bg-indigo-50/10" : "border-gray-100 hover:border-indigo-200"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pointer-events-none">
                  <div className="flex items-start gap-4 sm:gap-5 w-full">
                    {/* Select Indicator */}
                    <div className={cn("w-6 h-6 rounded-md flex items-center justify-center border-2 mt-1 shrink-0 transition-all",
                       isSelected ? "bg-indigo-500 border-indigo-500 text-white" : "border-gray-300 group-hover:border-indigo-300"
                    )}>
                       {isSelected && <CheckCircle2 className="w-4 h-4" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-black text-gray-900 text-xl tracking-tight">#{sh.shipmentNumber}</span>
                        {sh.grade && sh.grade !== 'MIXED' && (
                          <span className={cn(
                            "px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1 shadow-sm border",
                            sh.grade === 'A' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-600 border-slate-200"
                          )}>
                            <Star className={cn("w-3.5 h-3.5", sh.grade === 'A' ? "text-amber-500 fill-amber-500" : "text-slate-400")} />
                            صنف {sh.grade}
                          </span>
                        )}
                        {sh.grade === 'MIXED' && (
                          <span className="px-3 py-1 rounded-xl text-xs font-black flex items-center gap-1 shadow-sm border bg-purple-50 text-purple-700 border-purple-200">
                            مزدوج (A:{sh.packagesCountA} | B:{sh.packagesCountB})
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-sm font-bold text-gray-500">
                        <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-gray-400" />{farmer?.name || '—'}</span>
                        <span className="flex items-center gap-1.5"><Package className="w-4 h-4 text-gray-400" />{crop?.name || '—'}</span>
                        <span className="flex items-center gap-1.5 text-gray-900"><div className="w-1.5 h-1.5 rounded-full bg-blue-600" />{sh.packagesCount} طرد</span>
                        {sh.weightKg && <span className="flex items-center gap-1.5 text-gray-900"><div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />{sh.weightKg} كجم</span>}
                        {merchant && <span className="flex items-center gap-1.5"><Wallet className="w-4 h-4 text-emerald-500" />{merchant.name}</span>}
                        <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-gray-400" />{formatDate(sh.date)}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); openCollectModal([sh]); }}
                    className="pointer-events-auto flex items-center justify-center gap-2 px-8 py-4 w-full sm:w-auto bg-green-600 text-white rounded-[1.5rem] font-black hover:bg-green-700 hover:-translate-y-1 transition-all shadow-xl shadow-green-200 shrink-0"
                  >
                    <DollarSign className="w-5 h-5" />
                    تحصيل منفرد
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Premium Collection Invoice Modal (Shared Single/Bulk) */}
      <AnimatePresence>
        {collectingShipments.length > 0 && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setCollectingShipments([])}
              className="absolute inset-0 bg-black/60 backdrop-blur-md" />

            <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-4xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

              {/* Modal Header */}
              <div className="p-8 border-b border-gray-100 flex items-center justify-between shrink-0 sticky top-0 bg-white/95 backdrop-blur-xl z-20 shadow-sm border-b-2">
                <div className="flex items-center gap-4">
                   <div className={cn("w-16 h-16 rounded-[1.5rem] flex items-center justify-center shadow-inner", collectingShipments.length > 1 ? "bg-indigo-50 text-indigo-600" : "bg-blue-50 text-blue-600")}>
                     {collectingShipments.length > 1 ? <Package className="w-8 h-8" /> : <Wallet className="w-8 h-8" />}
                   </div>
                   <div>
                     <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                        {collectingShipments.length > 1 ? 'تحصيل مجمع' : 'إيصال تحصيل جديد'}
                     </h2>
                     <div className="flex items-center gap-2 mt-1">
                        {collectingShipments.length > 1 ? (
                           <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-black">{collectingShipments.length} شحنات محددة</span>
                        ) : (
                           <>
                             <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-[10px] font-black uppercase tracking-widest">شحنة #{collectingShipments[0].shipmentNumber}</span>
                             <span className="font-bold text-xs text-gray-500">{collectingShipments[0].packagesCount} طرد متاح للبيع</span>
                           </>
                        )}
                     </div>
                   </div>
                </div>
                <button onClick={() => setCollectingShipments([])} className="p-3 bg-gray-50 hover:bg-gray-100 text-gray-400 rounded-2xl transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar bg-gray-50/30">

                {/* --- Single Mode UI --- */}
                {collectingShipments.length === 1 && (
                   <div className="space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-gray-200 pb-8">
                       {/* Sale Method */}
                       <div>
                         <label className="text-sm font-black text-gray-700 mb-3 block">كيف قمت ببيع المحصول؟</label>
                         <div className="flex gap-3">
                           {[{ id: 'box', label: '📦 بالكرتونة' },
                             { id: 'kg', label: '⚖️ بالكيلو' }
                           ].map(opt => (
                             <button key={opt.id} onClick={() => setSaleMethod(opt.id as any)}
                               className={cn('flex-1 py-4 px-2 rounded-2xl border-2 transition-all font-black text-sm bg-white',
                                 saleMethod === opt.id ? 'border-blue-500 text-blue-700 shadow-md scale-[1.02]' : 'border-gray-100 hover:border-gray-200 text-gray-600 hover:bg-gray-50')}>
                               {opt.label}
                             </button>
                           ))}
                         </div>
                       </div>
     
                       {/* Price Structure */}
                       <div>
                         <label className="text-sm font-black text-gray-700 mb-3 block">نظام التسعير الخاص بك</label>
                         <div className="flex gap-3">
                           {[{ id: true, label: 'سعر موحد' },
                             { id: false, label: 'أسعار متعددة' }
                           ].map(opt => (
                             <button key={String(opt.id)} onClick={() => setUniformPrice(opt.id)}
                               className={cn('flex-1 py-4 px-2 rounded-2xl border-2 transition-all font-black text-sm bg-white',
                                 uniformPrice === opt.id ? 'border-purple-500 text-purple-700 shadow-md scale-[1.02]' : 'border-gray-100 hover:border-gray-200 text-gray-600 hover:bg-gray-50')}>
                               {opt.label}
                             </button>
                           ))}
                         </div>
                       </div>
                     </div>
     
                     {/* Pricing Base Details */}
                     <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                       {uniformPrice ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                           <div>
                             <label className="text-sm font-black text-gray-700 mb-2 block">
                               السعر لكل <span className="text-blue-600">{saleMethod === 'kg' ? 'كيلوغرام' : 'كرتونة'}</span> (₪)
                             </label>
                             <div className="relative">
                               <input type="number" min="0" step="0.01" value={pricePerUnit}
                                 onChange={e => setPricePerUnit(e.target.value)}
                                 placeholder="0.00"
                                 className="w-full pl-6 pr-14 py-4 bg-gray-50 border-2 border-transparent focus:border-green-500/50 focus:bg-white shadow-inner rounded-[1.5rem] outline-none text-xl font-black text-gray-900 transition-all" />
                               <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-black">₪</span>
                             </div>
                           </div>
                           <div>
                             <label className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2 block">الإجمالي المحسوب من السعر</label>
                             <div className="px-6 py-4 bg-green-50 border border-green-200 rounded-[1.5rem] text-2xl font-black text-green-700 flex items-center">
                               {formatCurrency(computedTotal())}
                             </div>
                           </div>
                         </div>
                       ) : (
                         <div className="space-y-4">
                           <div className="flex items-center justify-between border-b pb-4">
                             <label className="text-sm font-black text-gray-700">سجل دفعات البيع الجزئية</label>
                             <button onClick={() => setSaleBatches(prev => [...prev, { quantity: 0, pricePerUnit: 0, total: 0 }])}
                               className="flex items-center gap-1 text-sm font-black text-blue-600 hover:text-blue-700 px-4 py-2 bg-blue-50 hover:bg-blue-100 transition-colors rounded-xl shadow-sm">
                               <Plus className="w-4 h-4" /> إضافة دفعة آخرى
                             </button>
                           </div>
                           <div className="space-y-3">
                             {saleBatches.map((batch, i) => (
                               <div key={i} className="flex flex-col sm:flex-row gap-3 items-center bg-gray-50/50 p-2 sm:p-3 rounded-2xl border border-gray-100 shadow-sm transition-all focus-within:bg-white focus-within:border-blue-200">
                                 <input type="number" min="0" placeholder={`الكمية (${saleMethod === 'kg' ? 'كجم' : 'كرتونة'})`}
                                   value={batch.quantity || ''}
                                   onChange={e => updateBatch(i, 'quantity', parseFloat(e.target.value) || 0)}
                                   className="w-full sm:w-1/3 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all shadow-inner" />
                                 <input type="number" min="0" step="0.01" placeholder="السعر لكل وحدة"
                                   value={batch.pricePerUnit || ''}
                                   onChange={e => updateBatch(i, 'pricePerUnit', parseFloat(e.target.value) || 0)}
                                   className="w-full sm:w-1/3 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all shadow-inner" />
                                 <div className="w-full sm:w-1/3 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-black text-indigo-700 text-center flex-1 shrink-0">
                                   {formatCurrency(batch.total)}
                                 </div>
                                 {saleBatches.length > 1 && (
                                   <button onClick={() => setSaleBatches(p => p.filter((_, j) => j !== i))}
                                     className="w-full sm:w-auto p-3 text-rose-500 bg-white border border-gray-200 hover:border-rose-200 hover:bg-rose-50 rounded-xl transition-colors flex justify-center items-center">
                                     <Trash2 className="w-5 h-5" />
                                   </button>
                                 )}
                               </div>
                             ))}
                           </div>
                           <div className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-500 text-white rounded-2xl shadow-lg mt-4">
                             <span className="font-bold text-sm">مجموع المبالغ المقدرة لكافة الدفعات</span>
                             <span className="font-black text-2xl">{formatCurrency(computedTotal())}</span>
                           </div>
                         </div>
                       )}
                     </div>

                     <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden">
                       <div className="absolute left-0 top-0 w-32 h-32 bg-amber-50 rounded-br-full -z-10" />
                       <label className="text-sm font-black text-gray-700 mb-2 block">
                         إجمالي المبلغ المالي المحصل الفعلي (للتسوية وتجاوز المحسوب)
                       </label>
                       <input type="number" min="0" step="0.01" value={totalOverride}
                         onChange={e => setTotalOverride(e.target.value)}
                         placeholder={`المحسوب للتحصيل: ${formatCurrency(computedTotal())}`}
                         className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 shadow-inner rounded-[1.5rem] outline-none text-lg font-black transition-all" />
                       <p className="text-[10px] text-gray-400 font-bold mt-2 pr-2">اتركه فارغاً لاعتماد المبلغ المحسوب من السعر والكمية.</p>
                     </div>
                   </div>
                )}

                {/* --- Bulk Mode UI --- */}
                {collectingShipments.length > 1 && (
                   <div className="space-y-4">
                     <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-start gap-3">
                        <TrendingUp className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-indigo-900 leading-relaxed">
                           قم بإدخال قيمة التحصيل الفعلي (صافي البيع قبل أي خصومات) لكل شحنة على حدة لتخصيص الأرباح بدقة للمزارعين، وسيتم اقتطاع النسب والإيجار تلقائياً في الفاتورة المجمعة.
                        </p>
                     </div>
                     <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                        <div className="hidden sm:grid grid-cols-12 gap-4 p-4 border-b border-gray-100 bg-gray-50/50 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">
                           <div className="col-span-2">الشحنة</div>
                           <div className="col-span-2">المزارع</div>
                           <div className="col-span-2">المحصول</div>
                           <div className="col-span-2">الكمية</div>
                           <div className="col-span-4">المبلغ الكلي المحصل (₪)</div>
                        </div>
                        <div className="divide-y divide-gray-50">
                           {collectingShipments.map(sh => (
                              <div key={sh.id} className="grid grid-cols-1 sm:grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 transition-colors">
                                 <div className="sm:col-span-2 flex justify-between sm:block">
                                    <span className="sm:hidden text-xs font-bold text-gray-400">الشحنة</span>
                                    <span className="font-black text-sm bg-gray-100 px-2 py-1 rounded-lg">#{sh.shipmentNumber}</span>
                                 </div>
                                 <div className="sm:col-span-2 flex justify-between sm:block">
                                    <span className="sm:hidden text-xs font-bold text-gray-400">المزارع</span>
                                    <span className="text-sm font-bold text-gray-700">{farmers.find(f => f.id === sh.farmerId)?.name}</span>
                                 </div>
                                 <div className="sm:col-span-2 flex justify-between sm:block">
                                    <span className="sm:hidden text-xs font-bold text-gray-400">المحصول</span>
                                    <span className="text-sm font-bold text-gray-700">{crops.find(c => c.id === sh.cropId)?.name} {sh.grade && sh.grade !== 'MIXED' && `(${sh.grade})`}</span>
                                 </div>
                                 <div className="sm:col-span-2 flex justify-between sm:block">
                                    <span className="sm:hidden text-xs font-bold text-gray-400">الكمية</span>
                                    <span className="text-sm font-black text-gray-900 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">{sh.packagesCount} طرد</span>
                                 </div>
                                 <div className="sm:col-span-4">
                                    <div className="relative">
                                      <input type="number" min="0" step="0.01" 
                                         value={bulkSaleValues[sh.id] || ''}
                                         onChange={e => setBulkSaleValues(p => ({...p, [sh.id]: e.target.value}))}
                                         placeholder="المبلغ (₪) للشحنة"
                                         className="w-full pl-6 pr-4 py-3 bg-white border border-gray-200 focus:border-green-500 shadow-inner rounded-xl outline-none text-base font-black transition-all" />
                                       <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 font-black pointer-events-none">₪</span>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                   </div>
                )}


                <div className="border-t-2 border-dashed border-gray-200 my-8 relative">
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-50/100 px-4 text-xs font-black text-gray-400 uppercase tracking-widest tracking-widest backdrop-blur-md">
                     خصومات ورسوم الفاتورة
                   </div>
                </div>

                {/* Deductions & Overrides (Shared) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                      <label className="text-sm font-black text-gray-700 mb-2 flex items-center justify-between">
                         نسبة عمولة التاجر (%)
                         <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md">تطبق على كل شحنة</span>
                      </label>
                      <input type="number" min="0" max="100" step="0.1" value={merchantCommissionRate}
                        onChange={e => setMerchantCommissionRate(e.target.value)}
                        placeholder="النسبة %"
                        className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-orange-400 shadow-inner rounded-xl outline-none text-base font-bold transition-all" />
                    </div>
                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                      <label className="text-sm font-black text-gray-700 mb-2 flex items-center justify-between">
                         إيجار الطرد (₪ لكل طرد)
                         <span className="text-[10px] font-bold text-purple-500 bg-purple-50 px-2 py-0.5 rounded-md">حسب عدد الطرود</span>
                      </label>
                      <input type="number" min="0" step="0.1" value={boxRentalPerUnit}
                        onChange={e => setBoxRentalPerUnit(e.target.value)}
                        placeholder="0.0"
                        className="w-full px-5 py-3 bg-gray-50 border-2 border-transparent focus:border-purple-400 shadow-inner rounded-xl outline-none text-base font-bold transition-all" />
                    </div>
                  </div>

                  {/* Shared Summary Box */}
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2.5rem] p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden border border-gray-700">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                    
                    <div className="space-y-5 relative z-10 text-right">
                      <h3 className="text-white/60 text-xs font-black uppercase tracking-widest flex items-center gap-2">
                        <Calculator className="w-4 h-4 opacity-70" />
                        {collectingShipments.length > 1 ? 'ملخص الحساب المجمع للفاتورة' : 'كشف الحساب التفصيلي للعملية'}
                      </h3>
                      
                      <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl">
                         <span className="text-gray-300 font-bold text-sm">إجمالي البيع الأساسي:</span>
                         <span className="font-black text-white text-xl">{formatCurrency(collectingShipments.length > 1 ? bulkTotalSale : singleFinalTotal)}</span>
                      </div>
                      
                      <div className="space-y-3 px-2">
                        {(collectingShipments.length > 1 ? bulkTotalCommission : singleCommissionAmount) > 0 && (
                           <div className="flex justify-between text-sm items-center">
                              <span className="text-gray-400 font-bold">- خصم عمولة التاجر:</span>
                              <span className="font-black text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg">
                                {formatCurrency(collectingShipments.length > 1 ? bulkTotalCommission : singleCommissionAmount)}
                              </span>
                           </div>
                        )}
                        {(collectingShipments.length > 1 ? bulkTotalRental : singleRentalTotal) > 0 && (
                           <div className="flex justify-between text-sm items-center">
                              <span className="text-gray-400 font-bold">- خصم إيجار الطرود المرتجعة:</span>
                              <span className="font-black text-purple-400 bg-purple-500/10 px-2 py-1 rounded-lg">
                                {formatCurrency(collectingShipments.length > 1 ? bulkTotalRental : singleRentalTotal)}
                              </span>
                           </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-8 pt-6 border-t border-white/10 relative z-10 flex flex-col items-center justify-center bg-black/20 p-6 rounded-3xl backdrop-blur-md">
                      <p className="text-white/50 text-xs uppercase font-black tracking-widest mb-2 flex items-center gap-2">
                        الرصيد الصافي المستحق للمزارع
                      </p>
                      <div className={cn('text-5xl tracking-tight font-black', 
                          (collectingShipments.length > 1 ? bulkTotalFarmerNet : singleFarmerNet) >= 0 ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]' : 'text-rose-500')}>
                        {formatCurrency(collectingShipments.length > 1 ? bulkTotalFarmerNet : singleFarmerNet)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 my-6" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Receipt Upload with Camera Capture */}
                  <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                    <label className="text-sm font-black text-gray-700 mb-3 flex items-center gap-2">
                       <Camera className="w-5 h-5 text-blue-500" /> إثبات وصل التحصيل المجمع (اختياري)
                    </label>
                    <p className="text-[10px] font-bold text-gray-400 mb-4 px-1">صورة واحدة تكفي لتوثيق التحصيل لجميع الشحنات المحددة.</p>
                    {receiptPreview ? (
                      <div className="relative group rounded-[1.5rem] overflow-hidden border border-gray-200 shadow-inner">
                        <img src={receiptPreview} alt="الفاتورة" className="w-full h-40 object-cover bg-gray-50 group-hover:scale-105 transition-transform" />
                        <button onClick={() => { setReceiptFile(null); setReceiptPreview(''); }}
                          className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                          <div className="bg-rose-500 p-3 rounded-full hover:bg-rose-600 transition-colors shadow-lg">
                             <X className="w-6 h-6" />
                          </div>
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => receiptRef.current?.click()}
                        className="w-full h-40 border-2 border-dashed border-gray-300 rounded-[1.5rem] hover:border-blue-400 hover:bg-blue-50 transition-all font-bold text-gray-400 hover:text-blue-600 flex flex-col justify-center items-center gap-3">
                        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 group-hover:border-blue-200 transition-all">
                           <Camera className="w-8 h-8 opacity-70" />
                        </div>
                        <span className="text-xs">اضغط للتصوير أو تصفح الصور</span>
                      </button>
                    )}
                    {/* KEY FEATURE: capture="environment" added for direct camera access on mobile */}
                    <input ref={receiptRef} type="file" accept="image/*" capture="environment" onChange={handleReceiptChange} className="hidden" />
                  </div>

                  {/* Notes */}
                  <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                    <label className="text-sm font-black text-gray-700 mb-3 flex items-center gap-2">
                        ملاحظات الفاتورة (اختياري)
                    </label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="ملاحظات تطبق على جميع الشحنات في هذا الوصل..."
                      className="w-full h-40 px-5 py-4 bg-gray-50 border-2 border-transparent rounded-[1.5rem] focus:border-green-500 outline-none resize-none text-sm font-bold transition-all shadow-inner" />
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-8 border-t border-gray-100 bg-white flex gap-4 shrink-0 shadow-[0_-10px_30px_#00000005] z-20">
                <button onClick={handleCollect} disabled={isSubmitting}
                  className="flex-1 bg-green-600 text-white py-5 rounded-[1.5rem] font-black hover:bg-green-700 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-y-0 shadow-xl shadow-green-200/50 text-xl flex items-center justify-center gap-3">
                  {isSubmitting ? 'جاري التوثيق والترحيل...' : `✅ تأكيد تحصيل ${collectingShipments.length > 1 ? 'مجمع' : 'الشحنة'}`}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
