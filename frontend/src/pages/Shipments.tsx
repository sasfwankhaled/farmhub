import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Package, Plus, Truck, CheckCircle2, DollarSign,
  Search, Calendar, Edit2, Trash2, X,
  ArrowLeft, Users
} from 'lucide-react';
import { subscribeToCollection, createDocument, updateDocument, deleteDocument, getCollection, getDocument } from '../services/db';
import { Shipment, ShipmentStatus, Entity, Crop, Farm, Settings, GlobalPrice } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';

const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; color: string; bg: string; icon: any; next?: ShipmentStatus; nextLabel?: string }> = {
  loaded:    { label: 'تم التحميل',          color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',    icon: Package,      next: 'delivered_to_merchant', nextLabel: 'تسليم للتاجر' },
  delivered_to_merchant: { label: 'تم التسليم للتاجر',  color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',      icon: Truck,        next: 'collected', nextLabel: 'تحصيل المبلغ' },
  collected: { label: 'تم التحصيل',          color: 'text-green-700',  bg: 'bg-green-50 border-green-200',    icon: CheckCircle2, next: 'farmer_delivered', nextLabel: 'تسليم للمزارع' },
  farmer_delivered: { label: 'تم التسليم للمزارع', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: Users, next: 'archived', nextLabel: 'نقل للأرشيف' },
  archived: { label: 'مؤرشف', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: CheckCircle2 },
};

export default function ShipmentsPage() {
  const navigate = useNavigate();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [globalPrices, setGlobalPrices] = useState<GlobalPrice[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | 'all'>('all');
  const [farmerFilter, setFarmerFilter] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [gradeSelection, setGradeSelection] = useState<'A' | 'B' | 'MIXED'>('A');
  const [mixedCountA, setMixedCountA] = useState<number | ''>('');
  const [mixedCountB, setMixedCountB] = useState<number | ''>('');

  const [form, setForm] = useState<Partial<Shipment>>({
    date: new Date().toISOString().split('T')[0],
    day: '',
    packagesCount: 0,
    status: 'loaded',
    boxRentalPerUnit: 0,
  });

  const sortByDate = (data: Shipment[]) =>
    [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  useEffect(() => {
    // Load initial data directly (more reliable than realtime-only)
    Promise.all([
      getCollection<Shipment>('shipments'),
      getCollection<Entity>('entities'),
      getCollection<Crop>('crops'),
      getCollection<Farm>('farms'),
      getDocument<Settings>('settings', 'global'),
      getCollection<GlobalPrice>('global_prices'),
    ]).then(([s, e, c, f, st, p]) => {
      if (s) setShipments(sortByDate(s));
      if (e) setEntities(e);
      if (c) setCrops(c);
      if (f) setFarms(f);
      if (st) setSettings(st);
      if (p) setGlobalPrices(p);
      setLoading(false);
    }).catch(() => setLoading(false));

    // Then subscribe for real-time updates
    const u1 = subscribeToCollection<Shipment>('shipments', (data) => setShipments(sortByDate(data)));
    const u2 = subscribeToCollection<Entity>('entities', setEntities);
    const u3 = subscribeToCollection<Crop>('crops', setCrops);
    const u4 = subscribeToCollection<Farm>('farms', setFarms);
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const farmers = entities.filter(e => e.type === 'farmer');
  const merchants = entities.filter(e => e.type === 'merchant');

  const filtered = shipments.filter(s => {
    const farmer = farmers.find(f => f.id === s.farmerId);
    const crop = crops.find(c => c.id === s.cropId);
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      s.shipmentNumber?.toLowerCase().includes(q) ||
      farmer?.name.toLowerCase().includes(q) ||
      crop?.name.toLowerCase().includes(q);
    
    // Strict movement: Show only 'loaded' by default. 
    // If a specific status is filtered, show that.
    const matchStatus = statusFilter === 'all' 
      ? s.status === 'loaded' 
      : s.status === statusFilter;

    const matchFarmer = farmerFilter === 'all' || s.farmerId === farmerFilter;
    return matchSearch && matchStatus && matchFarmer;
  });

  // Stats
  const totalLoaded          = shipments.filter(s => s.status === 'loaded').reduce((sum, s) => sum + s.packagesCount, 0);
  const totalDelivered       = shipments.filter(s => s.status === 'delivered_to_merchant').reduce((sum, s) => sum + s.packagesCount, 0);
  const totalCollectedAmount = shipments.filter(s => s.status === 'collected' || s.status === 'farmer_delivered' || s.status === 'archived').reduce((sum, s) => sum + (s.totalSaleAmount || 0), 0);

  const openModal = (shipment?: Shipment) => {
    if (shipment) {
      setForm(shipment);
      setEditingId(shipment.id);
      setGradeSelection(shipment.grade || 'A');
      if (shipment.grade === 'MIXED') {
        setMixedCountA(shipment.packagesCountA || '');
        setMixedCountB(shipment.packagesCountB || '');
      } else {
        setMixedCountA('');
        setMixedCountB('');
      }
    } else {
      let defaultFee = settings?.transportFeePerUnit || 0;
      if (!defaultFee && globalPrices.length > 0) {
        const transportItem = globalPrices.find(p => p.name.includes('نقل') || p.name.toLowerCase().includes('transport'));
        if (transportItem) defaultFee = transportItem.value;
      }

      setForm({
        date: new Date().toISOString().split('T')[0],
        day: '',
        packagesCount: 0,
        status: 'loaded',
        boxRentalPerUnit: defaultFee
      });
      setEditingId(null);
      setGradeSelection('A');
      setMixedCountA('');
      setMixedCountB('');
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.farmerId) return toast.error('يرجى اختيار المزارع');
    if (!form.cropId) return toast.error('يرجى اختيار نوع المحصول');
    
    if (gradeSelection === 'MIXED') {
      if (!mixedCountA || !mixedCountB || Number(mixedCountA) <= 0 || Number(mixedCountB) <= 0) {
        return toast.error('يرجى إدخال أعداد صحيحة لصنف A وصنف B');
      }
    } else {
      if (!form.packagesCount || form.packagesCount <= 0) return toast.error('يرجى إدخال عدد الطرود');
    }

    setIsSubmitting(true);
    try {
      const baseNumber = editingId ? form.shipmentNumber : `SHP-${Date.now().toString().slice(-6)}`;
      const createdAt = editingId ? form.createdAt : new Date().toISOString();

      // Sanitize payload to prevent UUID 400 Bad Request errors on empty strings
      const sanitizedForm = { ...form };
      if (sanitizedForm.merchantId === '') sanitizedForm.merchantId = null;
      if (sanitizedForm.weightKg === '') sanitizedForm.weightKg = null;

      // Find names for denormalization (to bypass RLS for farmers)
      const selectedCropName = crops.find(c => c.id === sanitizedForm.cropId)?.name;
      const selectedMerchantName = entities.find(e => e.id === sanitizedForm.merchantId && e.type === 'merchant')?.name;

      // Find associated farmId for the selected farmer
      const associatedFarm = farms.find(f => f.farmerIds.includes(sanitizedForm.farmerId || ''));
      const farmId = associatedFarm?.id;

      if (editingId) {
        await updateDocument('shipments', editingId, {
          ...sanitizedForm,
          farmId,
          cropName: selectedCropName,
          merchantName: selectedMerchantName,
          grade: gradeSelection,
          ...(gradeSelection === 'MIXED' ? {
            packagesCountA: Number(mixedCountA),
            packagesCountB: Number(mixedCountB),
            packagesCount: Number(mixedCountA) + Number(mixedCountB)
          } : {
            packagesCountA: null,
            packagesCountB: null,
            packagesCount: sanitizedForm.packagesCount
          })
        });
        toast.success('تم التحديث بنجاح');
      } else {
        if (gradeSelection === 'MIXED') {
          const totalPackages = Number(mixedCountA) + Number(mixedCountB);

          await createDocument('shipments', {
            ...sanitizedForm,
            shipmentNumber: baseNumber,
            createdAt,
            farmId,
            cropName: selectedCropName,
            merchantName: selectedMerchantName,
            grade: 'MIXED',
            packagesCountA: Number(mixedCountA),
            packagesCountB: Number(mixedCountB),
            packagesCount: totalPackages
          });

          toast.success('تم إضافة الشحنة المدمجة بنجاح');
        } else {
          await createDocument('shipments', {
            ...sanitizedForm,
            shipmentNumber: baseNumber,
            createdAt,
            farmId,
            cropName: selectedCropName,
            merchantName: selectedMerchantName,
            grade: gradeSelection,
            boxRentalPerUnit: form.boxRentalPerUnit || 0
          });
          toast.success('تمت إضافة الشحنة بنجاح');
        }
      }
      setIsModalOpen(false);
    } catch { toast.error('حدث خطأ أثناء الحفظ'); }
    finally { setIsSubmitting(false); }
  };

  const handleAdvanceStatus = async (shipment: Shipment) => {
    const cfg = STATUS_CONFIG[shipment.status];
    if (!cfg.next) return;
    
    // Use specialized pages for complex transitions
    if (cfg.next === 'collected') {
      navigate('/shipment-collections');
      return;
    }
    if (cfg.next === 'farmer_delivered') {
      navigate('/farmer-delivery');
      return;
    }

    if (cfg.next === 'archived') {
      if (!confirm('هل أنت متأكد من نقل هذه الشحنة للأرشيف؟')) return;
    }

    await updateDocument('shipments', shipment.id, { 
      status: cfg.next,
      ...(cfg.next === 'archived' ? { archivedAt: new Date().toISOString() } : {})
    });
    toast.success(`تم تحديث الحالة إلى: ${STATUS_CONFIG[cfg.next].label}`);
  };

  const handleCollect = async () => {
    if (!collectingId) return;
    const amount = parseFloat(collectAmount);
    if (!amount || amount <= 0) return toast.error('يرجى إدخال مبلغ صحيح');
    setIsSubmitting(true);
    try {
      await updateDocument('shipments', collectingId, { status: 'collected', totalSaleAmount: amount });
      toast.success('تم التحصيل ونقل الشحنة إلى التحصيلات ✅');
      setCollectingId(null);
    } catch { toast.error('حدث خطأ'); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الشحنة؟')) return;
    await deleteDocument('shipments', id);
    toast.success('تم الحذف');
  };

  return (
    <div className="space-y-6 pb-24" dir="rtl">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
            <div className="bg-green-100 p-2 rounded-2xl">
              <Package className="w-6 h-6 text-green-600" />
            </div>
            الطرود المرسلة
          </h1>
          <p className="text-gray-500 mt-1 mr-12">تتبع حالة الطرود من التحميل حتى التحصيل</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-5 py-3 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-all font-bold shadow-lg shadow-green-200 hover:shadow-green-300 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          إضافة شحنة جديدة
        </button>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'طرود قيد التحميل', value: `${totalLoaded} طرد`, icon: Package, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'طرود تم تسليمها للتاجر', value: `${totalDelivered} طرد`, icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'إجمالي المحصّل', value: formatCurrency(totalCollectedAmount), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
        ].map((stat) => (
          <div key={stat.label} className={cn('p-6 rounded-3xl border shadow-sm flex items-center gap-4', stat.bg, stat.border)}>
            <div className={cn('p-3 rounded-2xl bg-white/60 shadow-sm', stat.color)}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 mb-1">{stat.label}</p>
              <p className={cn('text-2xl font-black', stat.color)}>{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="بحث بالرقم / اسم المزارع / المحصول..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none text-sm font-bold"
        >
          <option value="all">كل الحالات</option>
          <option value="loaded">تم التحميل</option>
          <option value="delivered">تم التسليم للتاجر</option>
          <option value="collected">تم التحصيل</option>
          <option value="farmer_delivered">تم التسليم للمزارع</option>
          <option value="archived">مؤرشف</option>
        </select>
        <select
          value={farmerFilter}
          onChange={(e) => setFarmerFilter(e.target.value)}
          className="px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none text-sm font-bold"
        >
          <option value="all">كل المزارعين</option>
          {farmers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {/* Shipments List */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-16 text-center">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-bold">جاري تحميل الشحنات...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-300 p-16 text-center flex flex-col items-center gap-4">
          <div className="bg-green-50 p-5 rounded-full">
            <Package className="w-12 h-12 text-green-300" />
          </div>
          <div>
            <p className="text-lg font-bold text-gray-700">لا توجد شحنات</p>
            <p className="text-sm text-gray-400 mt-1">اضغط على "إضافة شحنة جديدة" للبدء</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((shipment) => {
            const farmer = farmers.find(f => f.id === shipment.farmerId);
            const crop = crops.find(c => c.id === shipment.cropId);
            const merchant = merchants.find(m => m.id === shipment.merchantId);
            const cfg = STATUS_CONFIG[shipment.status];
            const StatusIcon = cfg.icon;

            return (
              <motion.div
                key={shipment.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Info */}
                  <div className="flex items-start gap-4">
                    <div className={cn('p-3 rounded-2xl border shrink-0', cfg.bg)}>
                      <StatusIcon className={cn('w-5 h-5', cfg.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1 sm:mb-2">
                        <span className="font-black text-gray-900 text-lg uppercase tracking-tight">{shipment.shipmentNumber}</span>
                        <span className={cn('px-3 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-widest', cfg.bg, cfg.color)}>
                          {cfg.label}
                        </span>
                      </div>
                      
                      {/* Mobile Detail Grid */}
                      <div className="sm:hidden grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
                         <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase">المزارع</span>
                            <span className="text-sm font-bold text-gray-700 truncate">{farmer?.name || '—'}</span>
                         </div>
                         <div className="flex flex-col text-left">
                            <span className="text-[10px] font-black text-gray-400 uppercase">الكمية</span>
                            <span className="text-sm font-black text-gray-900">{shipment.packagesCount} طرد</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase">المحصول</span>
                            <span className="text-sm font-bold text-gray-700 truncate">
                               {crop?.name || '—'} 
                               {shipment.grade && shipment.grade !== 'MIXED' && <span className="mr-1 text-[9px] font-black text-blue-600">({shipment.grade})</span>}
                            </span>
                         </div>
                         <div className="flex flex-col text-left">
                            <span className="text-[10px] font-black text-gray-400 uppercase">التاريخ</span>
                            <span className="text-sm font-bold text-gray-700">{formatDate(shipment.date)}</span>
                         </div>
                      </div>

                      {/* Desktop Detail Inline */}
                      <div className="hidden sm:flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{farmer?.name || '—'}</span>
                        <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" />{crop?.name || '—'} 
                          {shipment.grade && shipment.grade !== 'MIXED' && <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-md font-black">صنف {shipment.grade}</span>}
                          {shipment.grade === 'MIXED' && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md font-black">مزدوج (A:{shipment.packagesCountA} | B:{shipment.packagesCountB})</span>}
                        </span>
                        <span className="flex items-center gap-1 font-bold text-gray-700">{shipment.packagesCount} طرد</span>
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatDate(shipment.date)} {shipment.day && `(${shipment.day})`}</span>
                        {merchant && <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5" />{merchant.name}</span>}
                        {shipment.totalSaleAmount && (
                          <span className="flex items-center gap-1 font-black text-green-600">
                            <DollarSign className="w-3.5 h-3.5" />{formatCurrency(shipment.totalSaleAmount)}
                          </span>
                        )}
                      </div>
                      
                      {/* Mobile Extra Info (Grade Mixed, Merchant, Amount) */}
                      <div className="sm:hidden mt-3 pt-3 border-t border-gray-50 flex flex-col gap-2">
                         {shipment.grade === 'MIXED' && (
                           <div className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-1 rounded-lg self-start">
                             مزدوج: A:{shipment.packagesCountA} | B:{shipment.packagesCountB}
                           </div>
                         )}
                         {merchant && (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                               <Truck className="w-3.5 h-3.5 text-gray-400" />
                               <span>التاجر: <span className="text-gray-900">{merchant.name}</span></span>
                            </div>
                         )}
                         {shipment.totalSaleAmount && (
                            <div className="flex items-center gap-1.5 text-xs font-black text-green-600">
                               <DollarSign className="w-3.5 h-3.5" />
                               <span>المبلغ المحصل: {formatCurrency(shipment.totalSaleAmount)}</span>
                            </div>
                         )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                    {cfg.next && (
                      <button
                        onClick={() => handleAdvanceStatus(shipment)}
                        className={cn(
                          'flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-black transition-all border shadow-sm',
                          shipment.status === 'loaded'
                            ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-blue-100'
                            : 'bg-green-600 text-white border-green-600 hover:bg-green-700 shadow-green-100'
                        )}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        {cfg.nextLabel}
                      </button>
                    )}
                    <button
                      onClick={() => openModal(shipment)}
                      className="p-3 rounded-2xl text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-100"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(shipment.id)}
                      className="p-3 rounded-2xl text-red-600 bg-red-50 hover:bg-red-100 transition-colors border border-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-black text-gray-900">
                  {editingId ? 'تعديل الشحنة' : 'إضافة شحنة جديدة'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Farmer */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">اسم المزارع *</label>
                  <select
                    value={form.farmerId || ''}
                    onChange={(e) => setForm({ ...form, farmerId: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="">اختر المزارع...</option>
                    {farmers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>

                {/* Crop */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">نوع المحصول *</label>
                  <select
                    value={form.cropId || ''}
                    onChange={(e) => setForm({ ...form, cropId: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="">اختر المحصول...</option>
                    {crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {/* Grade Selection */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">تصنيف الصنف *</label>
                  <div className="flex gap-3">
                    {[
                      { id: 'A', label: 'صنف A' },
                      { id: 'B', label: 'صنف B' },
                      { id: 'MIXED', label: 'مزدوج (A و B)' }
                    ].map((g) => {
                      return (
                        <button
                          key={g.id}
                          onClick={() => setGradeSelection(g.id as any)}
                          type="button"
                          className={cn(
                            "flex-1 py-3 rounded-2xl font-black text-sm transition-all border-2",
                            gradeSelection === g.id 
                              ? "bg-green-50 border-green-500 text-green-700 shadow-sm" 
                              : "bg-gray-50 border-gray-100 text-gray-400 hover:bg-gray-100"
                          )}
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Merchant */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">التاجر (اختياري)</label>
                  <select
                    value={form.merchantId || ''}
                    onChange={(e) => setForm({ ...form, merchantId: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="">بدون تاجر محدد</option>
                    {merchants.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>

                {/* Packages count + weight */}
                {gradeSelection === 'MIXED' ? (
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700">عدد طرود A *</label>
                      <input
                        type="number"
                        min="1"
                        value={mixedCountA}
                        onChange={(e) => setMixedCountA(parseInt(e.target.value) || '')}
                        className="w-full px-4 py-3 bg-gray-50 border border-amber-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none"
                        placeholder="طرود صنف A"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700">عدد طرود B *</label>
                      <input
                        type="number"
                        min="1"
                        value={mixedCountB}
                        onChange={(e) => setMixedCountB(parseInt(e.target.value) || '')}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-gray-500 outline-none"
                        placeholder="طرود صنف B"
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5 mt-2">
                       <label className="text-sm font-bold text-gray-700">الإجمالي: {(Number(mixedCountA)||0) + (Number(mixedCountB)||0)} طرد. الوزن الإجمالي المستهدف للجميع الكلي (كجم)</label>
                       <input
                         type="number"
                         min="0"
                         step="0.1"
                         value={form.weightKg || ''}
                         onChange={(e) => setForm({ ...form, weightKg: parseFloat(e.target.value) || undefined })}
                         className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none"
                         placeholder="الوزن الإجمالي للشحنتين معاً (اختياري، يوزع تلقائياً)"
                       />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700">عدد الطرود *</label>
                      <input
                        type="number"
                        min="1"
                        value={form.packagesCount || ''}
                        onChange={(e) => setForm({ ...form, packagesCount: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-gray-700">الوزن (كجم)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={form.weightKg || ''}
                        onChange={(e) => setForm({ ...form, weightKg: parseFloat(e.target.value) || undefined })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none"
                        placeholder="اختياري"
                      />
                    </div>
                  </div>
                )}

                {/* Transport Fee Override */}
                <div className="space-y-1.5 p-4 bg-purple-50 rounded-2xl border border-purple-100">
                  <label className="text-sm font-bold text-purple-900">سعر النقل لهذه الشحنة (₪ لكل طرد)</label>
                  <div className="relative">
                    <Truck className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 pointer-events-none" />
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.boxRentalPerUnit || ''}
                      onChange={(e) => setForm({ ...form, boxRentalPerUnit: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-4 pr-10 py-3 bg-white border border-purple-200 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none text-purple-900 font-black"
                      placeholder="0.0"
                    />
                  </div>
                  <p className="text-[10px] font-bold text-purple-400 pr-1">السعر الافتراضي يتم جلبه من الإعدادات، يمكنك تعديله هنا.</p>
                </div>

                {/* Date + Day */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700">التاريخ *</label>
                    <input
                      type="date"
                      value={form.date || ''}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700">اليوم</label>
                    <select
                      value={form.day || ''}
                      onChange={(e) => setForm({ ...form, day: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none"
                    >
                      <option value="">اختر اليوم</option>
                      {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">ملاحظات</label>
                  <textarea
                    value={form.notes || ''}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500 outline-none resize-none"
                    placeholder="أي ملاحظات إضافية..."
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-gray-100 flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 text-white py-3 rounded-2xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50 shadow-lg shadow-green-200"
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ الشحنة'}
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Collect Amount Modal */}
      <AnimatePresence>
        {collectingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCollectingId(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm"
            >
              <div className="text-center mb-6">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-black text-gray-900">تحصيل المبلغ</h3>
                <p className="text-gray-500 text-sm mt-1">أدخل المبلغ المحصَّل من التاجر</p>
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={collectAmount}
                onChange={(e) => setCollectAmount(e.target.value)}
                className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-center text-2xl font-black"
                placeholder="0.00 ₪"
                autoFocus
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCollect}
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 text-white py-3 rounded-2xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50 shadow-lg shadow-green-200"
                >
                  {isSubmitting ? 'جاري...' : 'تأكيد التحصيل ✅'}
                </button>
                <button
                  onClick={() => setCollectingId(null)}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
