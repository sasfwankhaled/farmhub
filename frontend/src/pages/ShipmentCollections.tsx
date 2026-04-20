import { useState, useEffect, useRef, useMemo, type ChangeEvent } from 'react';
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
  const [collectingShipment, setCollectingShipment] = useState<Shipment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [globalPrices, setGlobalPrices] = useState<GlobalPrice[]>([]);
  const receiptRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [merchantFilter, setMerchantFilter] = useState('all');
  const [farmerFilter, setFarmerFilter] = useState('all');
  const [cropFilter, setCropFilter] = useState('all');

  // Collection form state
  const [saleMethod, setSaleMethod] = useState<'kg' | 'box'>('box');
  const [uniformPrice, setUniformPrice] = useState(true);
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [saleBatches, setSaleBatches] = useState<SaleBatch[]>([{ quantity: 0, pricePerUnit: 0, total: 0 }]);
  const [totalOverride, setTotalOverride] = useState('');
  const [merchantCommissionRate, setMerchantCommissionRate] = useState('');
  const [boxRentalPerUnit, setBoxRentalPerUnit] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [notes, setNotes] = useState('');

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

  const openCollectModal = (shipment: Shipment) => {
    setCollectingShipment(shipment);
    setSaleMethod('box');
    setUniformPrice(true);
    setPricePerUnit('');
    setSaleBatches([{ quantity: shipment.packagesCount, pricePerUnit: 0, total: 0 }]);
    setTotalOverride('');
    const merchant = merchants.find(m => m.id === shipment.merchantId);
    setMerchantCommissionRate(merchant?.commissionRate?.toString() || '');
    
    let defaultTransportPrice = settings?.transportFeePerUnit?.toString() || '';
    if (!defaultTransportPrice) {
      const transportItem = globalPrices.find(p => p.name.includes('نقل') || p.name.toLowerCase().includes('transport'));
      if (transportItem) defaultTransportPrice = transportItem.value.toString();
    }
    const initialTransportPrice = (shipment.boxRentalPerUnit !== undefined && shipment.boxRentalPerUnit !== null)
      ? shipment.boxRentalPerUnit.toString()
      : defaultTransportPrice;
    setBoxRentalPerUnit(initialTransportPrice);
    setReceiptFile(null);
    setReceiptPreview('');
    setNotes('');
  };

  const computedTotal = () => {
    if (uniformPrice) {
      const qty = saleMethod === 'kg'
        ? (collectingShipment?.weightKg || 0)
        : collectingShipment?.packagesCount || 0;
      return parseFloat(pricePerUnit || '0') * qty;
    }
    return saleBatches.reduce((sum, b) => sum + b.total, 0);
  };

  const finalTotal = parseFloat(totalOverride || '0') || computedTotal();
  const commissionAmount = finalTotal * (parseFloat(merchantCommissionRate || '0') / 100);
  const rentalTotal = (collectingShipment?.packagesCount || 0) * parseFloat(boxRentalPerUnit || '0');
  const farmerNet = finalTotal - commissionAmount - rentalTotal;

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
    if (!collectingShipment) return;
    if (finalTotal <= 0) return toast.error('يرجى إدخال المبلغ المحصَّل');
    if (!uniformPrice && saleBatches.some(b => b.quantity <= 0 || b.pricePerUnit <= 0)) {
      return toast.error('يرجى تعبئة جميع دفعات البيع');
    }

    setIsSubmitting(true);
    try {
      let receiptUrl: string | undefined;
      if (receiptFile) {
        const path = buildReceiptPath('shipment_receipts', collectingShipment.id, receiptFile.name);
        const { error: upErr } = await supabase.storage.from('receipts').upload(path, receiptFile, { upsert: true });
        if (upErr) throw new Error('فشل رفع الفاتورة: ' + upErr.message);
        receiptUrl = path;
      }

      await updateDocument('shipments', collectingShipment.id, {
        status: 'collected',
        totalSaleAmount: finalTotal,
        saleMethod,
        uniformPrice,
        pricePerUnit: uniformPrice ? parseFloat(pricePerUnit || '0') : undefined,
        saleBatches: uniformPrice ? undefined : saleBatches,
        merchantCommissionRate: parseFloat(merchantCommissionRate || '0'),
        merchantCommissionAmount: commissionAmount,
        boxRentalPerUnit: parseFloat(boxRentalPerUnit || '0'),
        boxRentalTotal: rentalTotal,
        farmerNetAmount: farmerNet,
        collectedAt: new Date().toISOString(),
        receiptImageUrl: receiptUrl,
        merchantName: merchants.find(m => m.id === collectingShipment.merchantId)?.name,
        cropName: crops.find(c => c.id === collectingShipment.cropId)?.name,
        notes,
      });

      toast.success('تم التحصيل بنجاح وإرسال الشحنة لصفحة تسليم المزارعين!');
      setCollectingShipment(null);
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

          {/* Merchant Filter */}
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

          {/* Farmer Filter */}
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

          {/* Crop Filter */}
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

        {/* Results count */}
        {hasActiveFilters && (
          <p className="text-xs font-bold text-gray-400">
            يُعرض <span className="text-blue-600 font-black">{filteredShipments.length}</span> من أصل <span className="font-black">{shipments.length}</span> شحنة
          </p>
        )}
      </div>

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
          {hasActiveFilters && (
            <button onClick={clearFilters} className="mt-4 text-sm font-black text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors px-4 py-2 rounded-xl">
              مسح الفلاتر
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredShipments.map((sh, idx) => {
            const farmer = farmers.find(f => f.id === sh.farmerId);
            const crop = crops.find(c => c.id === sh.cropId);
            const merchant = merchants.find(m => m.id === sh.merchantId);
            return (
              <motion.div
                key={sh.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 sm:p-8 hover:shadow-xl hover:border-blue-200 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="flex items-start gap-5">
                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 shrink-0 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-inner">
                      <Truck className="w-6 h-6" />
                    </div>
                    <div>
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
                        <span className="px-3 py-1 rounded-xl text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
                          بانتظار التحصيل
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 text-sm font-bold text-gray-500">
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
                    onClick={() => openCollectModal(sh)}
                    className="flex items-center justify-center gap-2 px-8 py-4 w-full sm:w-auto bg-green-600 text-white rounded-[1.5rem] font-black hover:bg-green-700 hover:-translate-y-1 transition-all shadow-xl shadow-green-200 shrink-0"
                  >
                    <DollarSign className="w-5 h-5" />
                    تحصيل المبالغ
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Premium Collection Invoice Modal */}
      <AnimatePresence>
        {collectingShipment && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setCollectingShipment(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md" />

            <motion.div initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="relative w-full max-w-3xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

              {/* Modal Header */}
              <div className="p-8 border-b border-gray-100 flex items-center justify-between shrink-0 sticky top-0 bg-white/80 backdrop-blur-xl z-20">
                <div className="flex items-center gap-4">
                   <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-inner">
                     <Wallet className="w-8 h-8" />
                   </div>
                   <div>
                     <h2 className="text-3xl font-black text-gray-900 tracking-tight">إيصال تحصيل جديد</h2>
                     <div className="flex items-center gap-2 mt-1">
                       <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-[10px] font-black uppercase tracking-widest">شحنة #{collectingShipment.shipmentNumber}</span>
                       <span className="font-bold text-xs text-gray-500">{collectingShipment.packagesCount} طرد متاح للبيع</span>
                     </div>
                   </div>
                </div>
                <button onClick={() => setCollectingShipment(null)} className="p-3 bg-gray-50 hover:bg-gray-100 text-gray-400 rounded-2xl transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-8 overflow-y-auto space-y-8 custom-scrollbar">

                {/* Grid Inputs row 1 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-gray-100 pb-8">
                  {/* Sale Method */}
                  <div>
                    <label className="text-sm font-black text-gray-700 mb-3 block">كيف قمت ببيع المحصول؟</label>
                    <div className="flex gap-3">
                      {[{ id: 'box', label: '📦 بالكرتونة' },
                        { id: 'kg', label: '⚖️ بالكيلو' }
                      ].map(opt => (
                        <button key={opt.id} onClick={() => setSaleMethod(opt.id as any)}
                          className={cn('flex-1 py-4 px-2 rounded-2xl border-2 transition-all font-black text-sm',
                            saleMethod === opt.id ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-gray-100 hover:border-gray-200 text-gray-600')}>
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
                          className={cn('flex-1 py-4 px-2 rounded-2xl border-2 transition-all font-black text-sm',
                            uniformPrice === opt.id ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-sm' : 'border-gray-100 hover:border-gray-200 text-gray-600')}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pricing Interface */}
                <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100">
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
                            className="w-full pl-6 pr-14 py-4 bg-white border-2 border-transparent focus:border-green-500 shadow-sm rounded-[1.5rem] outline-none text-xl font-black text-gray-900 transition-all" />
                          <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 font-black">₪</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">الإجمالي المحسوب من السعر</label>
                        <div className="px-6 py-4 bg-green-50 border border-green-100 rounded-[1.5rem] shadow-inner text-2xl font-black text-green-700">
                          {formatCurrency(computedTotal())}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-black text-gray-700">سجل دفعات البيع الجزئية</label>
                        <button onClick={() => setSaleBatches(prev => [...prev, { quantity: 0, pricePerUnit: 0, total: 0 }])}
                          className="flex items-center gap-1 text-sm font-black text-blue-600 hover:text-blue-700 px-4 py-2 bg-blue-50 hover:bg-blue-100 transition-colors rounded-xl shadow-sm">
                          <Plus className="w-4 h-4" /> إضافة دفعة آخرى
                        </button>
                      </div>
                      <div className="space-y-2">
                        {saleBatches.map((batch, i) => (
                          <div key={i} className="flex flex-col sm:flex-row gap-3 items-center bg-white p-3 rounded-2xl border border-gray-100 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-500/20">
                            <input type="number" min="0" placeholder={`كمية البيع (${saleMethod === 'kg' ? 'كجم' : 'كرتونة'})`}
                              value={batch.quantity || ''}
                              onChange={e => updateBatch(i, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full sm:w-1/3 px-4 py-3 bg-gray-50 border-transparent rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-300 border-2 transition-all" />
                            <input type="number" min="0" step="0.01" placeholder="السعر"
                              value={batch.pricePerUnit || ''}
                              onChange={e => updateBatch(i, 'pricePerUnit', parseFloat(e.target.value) || 0)}
                              className="w-full sm:w-1/3 px-4 py-3 bg-gray-50 border-transparent rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-300 border-2 transition-all" />
                            <div className="w-full sm:w-1/3 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-black text-indigo-700 text-center flex-1">
                              المبلغ: {formatCurrency(batch.total)}
                            </div>
                            {saleBatches.length > 1 && (
                              <button onClick={() => setSaleBatches(p => p.filter((_, j) => j !== i))}
                                className="p-3 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center px-6 py-4 bg-green-600 text-white rounded-2xl shadow-lg mt-4">
                        <span className="font-bold text-sm">مجموع المبالغ المقدرة</span>
                        <span className="font-black text-2xl">{formatCurrency(computedTotal())}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100 my-6" />

                {/* Deductions & Overrides */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="text-sm font-black text-gray-700 mb-2 block">
                        إجمالي المبلغ المالي المحصل (إذا كان يختلف عن المحسوب)
                      </label>
                      <input type="number" min="0" step="0.01" value={totalOverride}
                        onChange={e => setTotalOverride(e.target.value)}
                        placeholder={`المحسوب للتحصيل: ${formatCurrency(computedTotal())}`}
                        className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-blue-500 shadow-sm rounded-[1.5rem] outline-none text-base font-bold transition-all" />
                    </div>
                    <div>
                      <label className="text-sm font-black text-gray-700 mb-2 block">نسبة عمولة التاجر (%)</label>
                      <input type="number" min="0" max="100" step="0.1" value={merchantCommissionRate}
                        onChange={e => setMerchantCommissionRate(e.target.value)}
                        placeholder="النسبة %"
                        className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-orange-400 shadow-sm rounded-[1.5rem] outline-none text-base font-bold transition-all" />
                      {merchantCommissionRate && <p className="text-xs text-orange-600 mt-2 font-black tracking-widest uppercase ml-2 bg-orange-50 inline-block px-2 py-1 rounded-lg">يخصم: {formatCurrency(commissionAmount)}</p>}
                    </div>
                    <div>
                      <label className="text-sm font-black text-gray-700 mb-2 block">إيجار الطرد (₪ لكل طرد)</label>
                      <input type="number" min="0" step="0.1" value={boxRentalPerUnit}
                        onChange={e => setBoxRentalPerUnit(e.target.value)}
                        placeholder="0.0"
                        className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-purple-400 shadow-sm rounded-[1.5rem] outline-none text-base font-bold transition-all" />
                      {boxRentalPerUnit && <p className="text-xs text-purple-600 mt-2 font-black tracking-widest uppercase ml-2 bg-purple-50 inline-block px-2 py-1 rounded-lg">يخصم: {formatCurrency(rentalTotal)}</p>}
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="bg-gray-900 rounded-[2.5rem] p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                    <div className="space-y-4 relative z-10 text-right">
                      <h3 className="text-white/60 text-xs font-black uppercase tracking-widest mb-4">كشف الحساب التفصيلي للعملية</h3>
                      <div className="flex justify-between text-sm items-center">
                         <span className="text-gray-400 font-bold">إجمالي ناتج التحصيل الأساسي:</span>
                         <span className="font-black text-white text-lg">{formatCurrency(finalTotal)}</span>
                      </div>
                      {commissionAmount > 0 && <div className="flex justify-between text-sm items-center"><span className="text-gray-400 font-bold">خصم عمولة التاجر:</span><span className="font-black text-rose-400">- {formatCurrency(commissionAmount)}</span></div>}
                      {rentalTotal > 0 && <div className="flex justify-between text-sm items-center"><span className="text-gray-400 font-bold">خصم إيجار الطرود المرتجعة:</span><span className="font-black text-purple-400">- {formatCurrency(rentalTotal)}</span></div>}
                    </div>
                    <div className="mt-8 pt-6 border-t border-white/10 relative z-10">
                      <p className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-1">الرصيد الصافي المستحق للمزارع</p>
                      <div className={cn('text-4xl font-black', farmerNet >= 0 ? 'text-emerald-400' : 'text-rose-500')}>
                        {formatCurrency(farmerNet)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 my-6" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Receipt Upload */}
                  <div>
                    <label className="text-sm font-black text-gray-700 mb-2 flex items-center gap-2">
                       <Camera className="w-4 h-4 text-gray-400" /> إثبات وصل التحصيل (اختياري)
                    </label>
                    {receiptPreview ? (
                      <div className="relative group rounded-[1.5rem] overflow-hidden border border-gray-200">
                        <img src={receiptPreview} alt="الفاتورة" className="w-full h-32 object-cover bg-gray-50 group-hover:scale-105 transition-transform" />
                        <button onClick={() => { setReceiptFile(null); setReceiptPreview(''); }}
                          className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-8 h-8 p-1 bg-rose-500 rounded-full" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => receiptRef.current?.click()}
                        className="w-full h-32 border-2 border-dashed border-gray-300 rounded-[1.5rem] hover:border-blue-400 hover:bg-blue-50 transition-all font-bold text-gray-400 hover:text-blue-600 flex flex-col justify-center items-center gap-2">
                        <Image className="w-8 h-8 opacity-50" />
                        <span className="text-xs">اضغط لتصفح الفواتير</span>
                      </button>
                    )}
                    <input ref={receiptRef} type="file" accept="image/*" onChange={handleReceiptChange} className="hidden" />
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-sm font-black text-gray-700 mb-2 block">ملاحظات التحصيل (اختياري)</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="للتذكير أو التوضيح بالمحاسبة..."
                      className="w-full h-32 px-5 py-4 bg-gray-50 border-2 border-transparent rounded-[1.5rem] focus:border-green-500 outline-none resize-none text-sm font-bold transition-all shadow-sm" />
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-8 border-t border-gray-100 bg-gray-50/50 flex gap-4 shrink-0">
                <button onClick={handleCollect} disabled={isSubmitting}
                  className="flex-1 bg-green-600 text-white py-4 rounded-[1.5rem] font-black hover:bg-green-700 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-y-0 shadow-xl shadow-green-200 text-lg flex items-center justify-center gap-2">
                  {isSubmitting ? 'جاري توثيق الدفعة...' : '✅ تأكيد وترحيل الحساب'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
