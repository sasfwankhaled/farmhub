import { useState, useMemo, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  Truck, 
  Sprout, 
  TrendingUp, 
  Receipt, 
  Plus, 
  DollarSign,
  Filter,
  Calendar,
  User,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  X,
  Loader2,
  AlertCircle,
  Archive,
  Package,
  ChevronLeft,
  CheckCircle2,
  Clock,
  Sun,
  Moon
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { createDocument } from '../services/db';
import { VehicleExpense } from '../types';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useFarmAnalytics } from '../hooks/useFarmAnalytics';
import { StatCardPrimary } from '../components/shared/StatCardPrimary';
import { PipelineStage } from '../components/shared/PipelineStage';
import { ActionWidget } from '../components/shared/ActionWidget';
import { useData } from '../contexts/DataContext';

export default function Dashboard() {
  const {
    shipments, crops, vehicleExpenses, entities,
    attendance, farmExpenses, workerPayments, settings, globalPrices
  } = useData();

  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [merchantFilter, setMerchantFilter] = useState<string>('all');

  // Add Expense Modal State
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newExpense, setNewExpense] = useState<Partial<VehicleExpense>>({
    type: 'diesel',
    cost: 0,
    date: new Date().toISOString().split('T')[0],
    dueDate: '',
    day: '',
    notes: ''
  });

  const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

  const handleAddExpense = async (e: FormEvent) => {
    e.preventDefault();
    if (!newExpense.cost || newExpense.cost <= 0) return;

    setIsSubmitting(true);
    try {
      await createDocument('vehicle_expenses', {
        ...newExpense,
        createdAt: new Date().toISOString()
      });
      setIsAddingExpense(false);
      setNewExpense({
        type: 'diesel',
        cost: 0,
        date: new Date().toISOString().split('T')[0],
        dueDate: '',
        day: '',
        notes: ''
      });
    } catch (error) {
      toast.error('حدث خطأ أثناء إضافة المصروف');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredShipments = shipments.filter(s => {
    const sDate = new Date(s.date);
    const now = new Date();
    
    let matchesDate = true;
    if (dateFilter === 'today') {
      matchesDate = sDate.toDateString() === now.toDateString();
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      matchesDate = sDate >= weekAgo;
    } else if (dateFilter === 'month') {
      matchesDate = sDate.getMonth() === now.getMonth() && sDate.getFullYear() === now.getFullYear();
    }

    const matchesMerchant = merchantFilter === 'all' || s.merchantId === merchantFilter;
    
    return matchesDate && matchesMerchant;
  });

  const filteredExpenses = vehicleExpenses.filter(e => {
    const expDate = new Date(e.date);
    const now = new Date();
    
    if (dateFilter === 'today') return expDate.toDateString() === now.toDateString();
    if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return expDate >= weekAgo;
    }
    if (dateFilter === 'month') return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
    return true;
  });

  const asNumber = (val: any) => (typeof val === 'number' ? val : Number(val) || 0);

  // Use centralized analytics hook
  const analytics = useFarmAnalytics({
    shipments: filteredShipments,
    farmExpenses,
    attendance,
    workerPayments,
    globalPrices,
    settings
  });

  // Vehicle/Delivery Expenses (Specific to Dashboard)
  const dieselExpenses = filteredExpenses
    .filter(e => e.type === 'diesel')
    .reduce((sum, e) => sum + asNumber(e.cost), 0);
  
  const maintenanceExpenses = filteredExpenses
    .filter(e => e.type === 'maintenance')
    .reduce((sum, e) => sum + asNumber(e.cost), 0);

  const otherVehicleExpenses = filteredExpenses
    .filter(e => ['insurance', 'license', 'other'].includes(e.type))
    .reduce((sum, e) => sum + asNumber(e.cost), 0);

  const totalDeliveryExpenses = dieselExpenses + maintenanceExpenses + otherVehicleExpenses;
  const deliveryProfit = analytics.deliveryIncome - totalDeliveryExpenses;

  // Status Stats
  const loadedCount = filteredShipments.filter(s => s.status === 'loaded').length;
  const deliveredToMerchantCount = filteredShipments.filter(s => s.status === 'delivered_to_merchant').length;
  const collectedCount = filteredShipments.filter(s => s.status === 'collected').length;
  const farmerDeliveredCount = filteredShipments.filter(s => s.status === 'farmer_delivered').length;
  const archivedCount = filteredShipments.filter(s => s.status === 'archived').length;

  const recentShipments = [...shipments]
    .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const overdueShipments = shipments.filter(s => {
    if (['collected', 'farmer_delivered', 'archived'].includes(s.status)) return false;
    const days = Math.floor((Date.now() - new Date(s.createdAt).getTime()) / 86400000);
    return days > 7;
  });

  const merchants = entities.filter(e => e.type === 'merchant');
  const expenseTypeLabels: Record<string, string> = {
    diesel: 'سولار',
    maintenance: 'صيانة',
    insurance: 'تأمين',
    license: 'ترخيص السيارة',
    other: 'مصاريف أخرى'
  };

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'صباح الخير' : 'مساء الخير';
  const GreetingIcon = currentHour < 12 ? Sun : Moon;

  return (
    <div className="space-y-8 pb-12 text-right" dir="rtl">
      {/* Premium Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-green-500/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        
        <div className="relative z-10 flex items-center gap-5">
          <div className="p-4 bg-green-50 rounded-3xl text-green-600">
            <GreetingIcon className="w-8 h-8" />
          </div>
          <div>
            <p className="text-sm font-black text-green-600 tracking-widest mb-1">{greeting}</p>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">لوحة تحكم المزرعة</h1>
          </div>
        </div>
        
        <div className="relative z-10 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 sm:flex-none">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full sm:w-48 px-5 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-green-500 hover:bg-gray-100 outline-none font-bold text-sm appearance-none pr-12 transition-all cursor-pointer"
            >
              <option value="all">كل الأوقات</option>
              <option value="today">اليوم</option>
              <option value="week">آخر أسبوع</option>
              <option value="month">هذا الشهر</option>
            </select>
            <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>

          <div className="relative flex-1 sm:flex-none">
            <select
              value={merchantFilter}
              onChange={(e) => setMerchantFilter(e.target.value)}
              className="w-full sm:w-48 px-5 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-green-500 hover:bg-gray-100 outline-none font-bold text-sm appearance-none pr-12 transition-all cursor-pointer"
            >
              <option value="all">كل التجار</option>
              {merchants.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </header>

      {/* Overdue Alert */}
      <AnimatePresence>
        {overdueShipments.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-r from-red-500 to-rose-600 text-white p-6 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-red-500/20">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-2xl animate-pulse">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg">تنبيه تأخير تحصيل</h3>
                  <p className="text-white/80 text-sm font-medium">يوجد {overdueShipments.length} شحنة لم تُحوَّل للتحصيل منذ أكثر من أسبوع</p>
                </div>
              </div>
              <Link 
                to="/shipments" 
                className="px-6 py-3 bg-white text-rose-600 hover:bg-gray-50 rounded-xl font-black text-sm transition-all shadow-sm active:scale-95"
              >
                متابعة الطرود
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Stats (Premium Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCardPrimary 
          label="إجمالي الطرود" 
          value={analytics.totalProduction.toLocaleString()} 
          icon={Package} 
          gradient="from-blue-500 to-blue-700" 
          subValue="طرداً"
          delay={0.1}
        />
        <StatCardPrimary 
          label="صافي ربح المزرعة" 
          value={formatCurrency(analytics.farmerNetProfit)} 
          icon={TrendingUp} 
          gradient="from-emerald-500 to-green-600" 
          subValue="بعد المصاريف"
          delay={0.2}
        />
        <StatCardPrimary 
          label="مبالغ قيد التحصيل" 
          value={formatCurrency(analytics.pendingFarmerNet)} 
          icon={Receipt} 
          gradient="from-amber-400 to-amber-600" 
          subValue={`${deliveredToMerchantCount} شحنة`}
          delay={0.3}
        />
        <StatCardPrimary 
          label="صافي ربح التوصيل" 
          value={formatCurrency(deliveryProfit)} 
          icon={Wallet} 
          gradient="from-purple-500 to-fuchsia-600" 
          subValue={`دخل: ${formatCurrency(analytics.deliveryIncome)}`}
          delay={0.4}
        />
      </div>

      {/* Progressive Shipment Tracker */}
      <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-gray-100 rounded-xl">
            <Truck className="w-5 h-5 text-gray-700" />
          </div>
          <h2 className="text-xl font-black text-gray-900">مسار الشحنات</h2>
        </div>
        
        <div className="relative">
          {/* Connector Line (visible on md+) */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-1 bg-gray-100 -translate-y-1/2 z-0 rounded-full" />
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 relative z-10">
            <PipelineStage label="محملة" value={loadedCount} color="amber" icon={Package} isFirst />
            <PipelineStage label="عند التاجر" value={deliveredToMerchantCount} color="blue" icon={Truck} />
            <PipelineStage label="مُحصلة" value={collectedCount} color="green" icon={DollarSign} />
            <PipelineStage label="سُلمت" value={farmerDeliveredCount} color="purple" icon={User} />
            <PipelineStage label="مؤرشفة" value={archivedCount} color="gray" icon={Archive} isLast />
          </div>
        </div>
      </section>

      {/* Recent Activity & Actions layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gray-100 rounded-xl">
                <Clock className="w-5 h-5 text-gray-700" />
              </div>
              <h2 className="text-xl font-black text-gray-900">آخر التحركات</h2>
            </div>
            <Link to="/shipments" className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-sm font-black transition-colors">
              الكل
            </Link>
          </div>

          <div className="flex-1">
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[600px] text-right">
                <thead>
                  <tr className="border-b-2 border-gray-100 pb-4">
                    <th className="pb-4 font-black text-gray-400 text-xs uppercase tracking-widest px-2">الشحنة</th>
                    <th className="pb-4 font-black text-gray-400 text-xs uppercase tracking-widest px-2">المزارع والمحصول</th>
                    <th className="pb-4 font-black text-gray-400 text-xs uppercase tracking-widest px-2">الحالة</th>
                    <th className="pb-4 font-black text-gray-400 text-xs uppercase tracking-widest px-2">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentShipments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-50 rounded-2xl mb-4">
                          <Package className="w-8 h-8 text-gray-300" />
                        </div>
                        <p className="text-gray-500 font-bold">لا توجد شحنات مسجلة بعد</p>
                      </td>
                    </tr>
                  ) : recentShipments.map(s => {
                    const farmer = entities.find(e => e.id === s.farmerId);
                    const crop = crops.find(c => c.id === s.cropId);
                    return (
                      <tr key={s.id} className="group hover:bg-gray-50/50 transition-colors">
                        <td className="py-4 px-2">
                          <span className="font-black text-gray-900 bg-gray-50 px-2 py-1 rounded-md">{s.shipmentNumber}</span>
                        </td>
                        <td className="py-4 px-2">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900">{farmer?.name || 'مجهول'}</span>
                            <span className="text-xs font-bold text-gray-500">{s.packagesCount} {crop?.name || ''}</span>
                          </div>
                        </td>
                        <td className="py-4 px-2">
                          <span className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap inline-flex items-center gap-1.5",
                            s.status === 'archived' ? 'bg-gray-100 text-gray-600' :
                            s.status === 'farmer_delivered' ? 'bg-purple-100 text-purple-700' :
                            s.status === 'collected' ? 'bg-green-100 text-green-700' :
                            s.status === 'delivered_to_merchant' ? 'bg-blue-100 text-blue-700' :
                            'bg-amber-100 text-amber-700'
                          )}>
                            {s.status === 'collected' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {s.status === 'archived' ? 'مؤرشفة' :
                             s.status === 'farmer_delivered' ? 'تم التسليم' :
                             s.status === 'collected' ? 'تم التحصيل' :
                             s.status === 'delivered_to_merchant' ? 'عند التاجر' : 'محملة'}
                          </span>
                        </td>
                        <td className="py-4 px-2 text-sm font-bold text-gray-500">
                          {new Date(s.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden space-y-4">
              {recentShipments.length === 0 ? (
                <div className="py-12 text-center bg-gray-50 rounded-3xl">
                  <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-bold">لا توجد شحنات حالياً</p>
                </div>
              ) : recentShipments.map(s => {
                const farmer = entities.find(e => e.id === s.farmerId);
                const crop = crops.find(c => c.id === s.cropId);
                return (
                  <div key={s.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100/50 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-gray-900 text-sm bg-white px-2 py-1 rounded-lg border border-gray-100">{s.shipmentNumber}</span>
                      <span className="text-[10px] font-bold text-gray-400">{new Date(s.date).toLocaleDateString('ar-EG')}</span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="font-black text-gray-900">{farmer?.name || 'مجهول'}</p>
                        <p className="text-xs font-bold text-gray-500">{s.packagesCount} {crop?.name || 'صنف غير معروف'}</p>
                      </div>
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[10px] font-black inline-flex items-center gap-1",
                        s.status === 'archived' ? 'bg-gray-200 text-gray-600' :
                        s.status === 'farmer_delivered' ? 'bg-purple-100 text-purple-700' :
                        s.status === 'collected' ? 'bg-green-100 text-green-700' :
                        s.status === 'delivered_to_merchant' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      )}>
                        {s.status === 'archived' ? 'مؤرشفة' :
                         s.status === 'farmer_delivered' ? 'تم التسليم' :
                         s.status === 'collected' ? 'تم التحصيل' :
                         s.status === 'delivered_to_merchant' ? 'عند التاجر' : 'محملة'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Widgets */}
        <div className="space-y-4 flex flex-col h-full">
          <ActionWidget
            to="/shipments"
            icon={Plus}
            title="تسجيل طرد جديد"
            subtitle="إضافة شحنة من المزرعة"
            color="bg-green-600"
            hover="hover:bg-green-700"
          />
          <ActionWidget
            to="/shipment-collections"
            icon={DollarSign}
            title="تحصيل المبالغ"
            subtitle="متابعة حسابات التجار"
            color="bg-blue-600"
            hover="hover:bg-blue-700"
          />
          <button
            onClick={() => setIsAddingExpense(true)}
            className="w-full text-right bg-purple-600 hover:bg-purple-700 text-white p-6 rounded-[2rem] shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 active:translate-y-0 group flex items-center justify-between"
          >
            <div>
              <h3 className="font-black text-xl mb-1">مصروف سيارة</h3>
              <p className="text-purple-200 text-sm font-bold opacity-80 group-hover:opacity-100 transition-opacity">تسجيل نفقات النقل</p>
            </div>
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center rotate-3 group-hover:-rotate-3 transition-transform">
              <Receipt className="w-7 h-7" />
            </div>
          </button>
        </div>
      </div>

      {/* Unified Premium Modals */}
      <AnimatePresence>
        {isAddingExpense && (
          <div className="fixed inset-0 flex items-center justify-center z-[100] px-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAddingExpense(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden border border-white/20"
            >
              <div className="p-8 pb-6 border-b border-gray-50 flex items-center justify-between bg-purple-600 text-white">
                <h2 className="text-2xl font-black">مصروف سيارة جديد</h2>
                <button onClick={() => setIsAddingExpense(false)} className="p-2.5 bg-white/20 rounded-2xl hover:bg-white/30 transition-colors active:scale-90">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddExpense} className="p-8 space-y-5 flex flex-col max-h-[80vh] overflow-y-auto">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 mr-2">نوع المصروف</label>
                  <select
                    value={newExpense.type}
                    onChange={(e) => setNewExpense({ ...newExpense, type: e.target.value as any })}
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none font-bold text-sm shadow-sm"
                  >
                    {Object.entries(expenseTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-500 mr-2">المبلغ (شيكل) *</label>
                  <div className="relative">
                    <input
                      type="number" required min="0.1" step="0.1"
                      value={newExpense.cost || ''}
                      onChange={(e) => setNewExpense({ ...newExpense, cost: Number(e.target.value) })}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none font-black text-lg shadow-sm"
                      placeholder="0.00"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₪</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 mr-2">التاريخ</label>
                    <input type="date" required value={newExpense.date}
                      onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-bold text-sm shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 mr-2">اليوم</label>
                    <select value={newExpense.day} onChange={(e) => setNewExpense({ ...newExpense, day: e.target.value })}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none font-bold text-sm shadow-sm">
                      <option value="">اختياري</option>
                      {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                    </select>
                  </div>
                </div>
                
                <div className="pt-4">
                  <button type="submit" disabled={isSubmitting}
                    className="w-full py-5 bg-purple-600 text-white rounded-3xl font-black text-xl shadow-xl shadow-purple-200 hover:bg-purple-700 transition-all flex items-center justify-center gap-3 disabled:opacity-70 active:scale-95">
                    {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : 'حفظ وتسجيل بالمصاريف'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub Components ---

