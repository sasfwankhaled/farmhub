import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  Archive, DollarSign, TrendingUp, Filter, Search, Calendar, FileText, Receipt, X, Package 
} from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import { resolveReceiptUrl } from '../../../services/storage';
import { cn, formatCurrency, formatDate } from '../../../lib/utils';
import { QuickStatCard } from './QuickStatCard';
import { ModalContainer } from './ModalContainer';
import { Shipment } from '../../../types';

const normalizeEntityType = (type?: string) => {
  const value = (type || '').toString().trim().toLowerCase();
  if (['farmer', 'مزارع'].includes(value)) return 'farmer';
  if (['merchant', 'تاجر'].includes(value)) return 'merchant';
  if (['worker', 'عامل'].includes(value)) return 'worker';
  return value;
};

export function ArchiveBrowser() {
  const { shipments, entities, crops } = useData();
  const farmers = entities.filter(e => normalizeEntityType(e.type as string) === 'farmer');

  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveFarmerFilter, setArchiveFarmerFilter] = useState('all');
  const [archiveMerchantFilter, setArchiveMerchantFilter] = useState('all');
  const [archiveCropFilter, setArchiveCropFilter] = useState('all');
  const [archiveStartDate, setArchiveStartDate] = useState('');
  const [archiveEndDate, setArchiveEndDate] = useState('');
  const [previewReceipt, setPreviewReceipt] = useState<string | null>(null);
  const [selectedArchivedShipment, setSelectedArchivedShipment] = useState<Shipment | null>(null);
  const [isReceiptLoading, setIsReceiptLoading] = useState(false);

  const archiveStats = useMemo(() => {
    const archived = shipments.filter(s => s.status === 'archived');
    return {
      totalCount: archived.length,
      totalSales: archived.reduce((sum, s) => sum + (s.totalSaleAmount || 0), 0),
      totalNet: archived.reduce((sum, s) => sum + (s.farmerNetAmount || 0), 0),
    };
  }, [shipments]);

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

  return (
    <section className="space-y-6 text-right" dir="rtl">
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
            {farmers.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>

          <select
            value={archiveMerchantFilter}
            onChange={(e) => setArchiveMerchantFilter(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl outline-none text-sm focus:bg-white focus:border-gray-200 shadow-inner font-bold"
          >
            <option value="all">كل التجار</option>
            {entities.filter((e: any) => normalizeEntityType(e.type as string) === 'merchant').map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <select
            value={archiveCropFilter}
            onChange={(e) => setArchiveCropFilter(e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl outline-none text-sm focus:bg-white focus:border-gray-200 shadow-inner font-bold"
          >
            <option value="all">كل المحاصيل</option>
            {crops.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
    </section>
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
