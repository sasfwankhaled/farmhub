import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, Users, TrendingUp, Target, Truck, Package, Filter, Search, Calendar, FileDown, PieChart 
} from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import { cn, formatCurrency } from '../../../lib/utils';
import { QuickStatCard } from '@/src/features/settings/components/QuickStatCard';

const normalizeEntityType = (type?: string) => {
  const value = (type || '').toString().trim().toLowerCase();
  if (['farmer', 'مزارع'].includes(value)) return 'farmer';
  if (['merchant', 'تاجر'].includes(value)) return 'merchant';
  if (['worker', 'عامل'].includes(value)) return 'worker';
  return value;
};

export function FinancialReports() {
  const { shipments, entities, crops, vehicleExpenses, farms } = useData();
  const farmers = entities.filter(e => normalizeEntityType(e.type as string) === 'farmer');

  const [activeReportSubTab, setActiveReportSubTab] = useState<'merchants' | 'farmers' | 'summary'>('summary');
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveFarmerFilter, setArchiveFarmerFilter] = useState('all');
  const [archiveMerchantFilter, setArchiveMerchantFilter] = useState('all');
  const [archiveCropFilter, setArchiveCropFilter] = useState('all');
  const [archiveStartDate, setArchiveStartDate] = useState('');
  const [archiveEndDate, setArchiveEndDate] = useState('');

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
      netProfit: totalSales - totalNet - totalCommission
    };
  }, [filteredReportShipments, vehicleExpenses, archiveStartDate, archiveEndDate]);

  return (
    <section className="space-y-8 pb-20 text-right" dir="rtl">
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

      {/* Report Filters */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-lg shadow-gray-200/50 border border-gray-100 space-y-5 animate-in fade-in duration-500 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 text-gray-900 font-black mb-4">
            <Filter className="w-5 h-5 text-blue-600" />
            <span>فلاتر ومحددات التقرير الشامل</span>
            <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-1 rounded-md ml-auto">ينعكس فوراً على جميع الأرقام بالأسفل</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="بحث برقم الشحنة..."
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                className="w-full pr-11 pl-4 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:border-blue-300 outline-none text-sm font-bold shadow-inner transition-all"
              />
            </div>

            <select
              value={archiveFarmerFilter}
              onChange={(e) => setArchiveFarmerFilter(e.target.value)}
              className="w-full px-4 py-3.5 bg-gray-50 border border-transparent rounded-2xl outline-none text-sm focus:bg-white focus:border-blue-300 shadow-inner font-bold"
            >
              <option value="all">كل المزارعين (الفلتر الشامل)</option>
              {farmers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>

            <select
              value={archiveMerchantFilter}
              onChange={(e) => setArchiveMerchantFilter(e.target.value)}
              className="w-full px-4 py-3.5 bg-gray-50 border border-transparent rounded-2xl outline-none text-sm focus:bg-white focus:border-blue-300 shadow-inner font-bold"
            >
              <option value="all">كل التجار (الفلتر الشامل)</option>
              {entities.filter(e => normalizeEntityType(e.type as string) === 'merchant').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>

            <select
              value={archiveCropFilter}
              onChange={(e) => setArchiveCropFilter(e.target.value)}
              className="w-full px-4 py-3.5 bg-gray-50 border border-transparent rounded-2xl outline-none text-sm focus:bg-white focus:border-blue-300 shadow-inner font-bold"
            >
              <option value="all">كل المحاصيل (الفلتر الشامل)</option>
              {crops.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 mt-4">
            <div className="flex items-center gap-3 bg-gray-50/80 p-2.5 rounded-2xl border border-gray-100 focus-within:border-blue-400 focus-within:bg-white transition-all shadow-inner">
              <div className="p-2.5 bg-white rounded-[1rem] shadow-sm"><Calendar className="w-5 h-5 text-blue-500" /></div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest whitespace-nowrap w-20">من تاريخ</label>
              <input
                type="date"
                value={archiveStartDate}
                onChange={(e) => setArchiveStartDate(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-lg font-black text-gray-800"
              />
            </div>
            <div className="flex items-center gap-3 bg-gray-50/80 p-2.5 rounded-2xl border border-gray-100 focus-within:border-blue-400 focus-within:bg-white transition-all shadow-inner">
              <div className="p-2.5 bg-white rounded-[1rem] shadow-sm"><Calendar className="w-5 h-5 text-blue-500" /></div>
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest whitespace-nowrap w-20">إلى تاريخ</label>
              <input
                type="date"
                value={archiveEndDate}
                onChange={(e) => setArchiveEndDate(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-lg font-black text-gray-800"
              />
            </div>
          </div>
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
                       <p className="text-lg font-black text-emerald-700">{((f.net/(f.sales||1))*100).toFixed(1)}%</p>
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
  );
}
