import { Share2, Package, Eye, ExternalLink, Calendar, User, DollarSign, Calculator, Info, X, Clock, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shipment, Crop, Entity } from '../../../types';
import { cn, formatCurrency, formatDate } from '../../../lib/utils';
import { supabase } from '../../../supabase';

interface Props {
  shipmentStatusFilter: Shipment['status'] | 'all';
  setShipmentStatusFilter: (status: Shipment['status'] | 'all') => void;
  handleShareWhatsApp: () => void;
  filteredFarmShipments: Shipment[];
  crops: Crop[];
  entities: Entity[];
}

export const FarmSummaryTab = ({
  shipmentStatusFilter,
  setShipmentStatusFilter,
  handleShareWhatsApp,
  filteredFarmShipments,
  crops,
  entities
}: Props) => {
  const [selectedShipmentForModal, setSelectedShipmentForModal] = useState<Shipment | null>(null);
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-900">سجل إنتاج المزرعة</h2>
          <p className="text-sm text-gray-500 font-medium">الشحنات الصادرة من هذه المزرعة وحالاتها</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={shipmentStatusFilter}
              onChange={(e) => setShipmentStatusFilter(e.target.value as Shipment['status'] | 'all')}
              className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm font-black outline-none appearance-none focus:ring-2 focus:ring-green-500 min-w-[160px]"
            >
              <option value="all">كل الحالات</option>
              <option value="loaded">تم التحميل</option>
              <option value="delivered_to_merchant">عند التاجر</option>
              <option value="collected">تم التحصيل</option>
              <option value="farmer_delivered">تم التسليم للمزارع</option>
              <option value="archived">مُؤرشف</option>
            </select>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <Package className="w-4 h-4" />
            </div>
          </div>
          
          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-all font-black text-sm shadow-lg shadow-green-100 active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            مشاركة التقرير
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">التاريخ</th>
                <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">الصنف</th>
                <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">رقم الشحنة</th>
                <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">المحصول</th>
                <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">التاجر</th>
                <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">الكمية</th>
                <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">المبيعات</th>
                <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest text-center">الحالة</th>
                <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest text-center">المستندات</th>
                <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredFarmShipments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                       <Package className="w-12 h-12 text-gray-200" />
                       <p className="text-gray-400 font-bold">لا توجد شحنات مسجلة لهذه الحالة</p>
                    </div>
                  </td>
                </tr>
              ) : filteredFarmShipments.map(shipment => {
                const crop = crops.find(c => c.id === shipment.cropId);
                const cropName = crop?.name || shipment.cropName || '-';
                const merchant = entities.find(e => e.id === shipment.merchantId && e.type === 'merchant');
                const merchantName = merchant?.name || shipment.merchantName || '-';
                return (
                  <tr key={shipment.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="p-5">
                      <span className="text-sm font-black text-gray-900">{formatDate(shipment.date)}</span>
                      <span className="block text-[10px] text-gray-400 font-bold">{shipment.day || ''}</span>
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col gap-1">
                        <span className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-black inline-block w-fit",
                          shipment.grade === 'A' ? "bg-amber-50 text-amber-700 border border-amber-100" :
                          shipment.grade === 'B' ? "bg-slate-50 text-slate-700 border border-slate-100" :
                          "bg-purple-50 text-purple-700 border border-purple-100"
                        )}>
                          {shipment.grade === 'MIXED' ? 'مزدوج' : `صنف ${shipment.grade || '-'}`}
                        </span>
                        {shipment.grade === 'MIXED' && (
                          <span className="text-[9px] font-bold text-gray-400">
                             (A: {shipment.packagesCountA} | B: {shipment.packagesCountB})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                          <Package className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-black text-blue-900">{shipment.shipmentNumber}</span>
                      </div>
                    </td>
                    <td className="p-5 text-sm font-bold text-gray-900">{cropName}</td>
                    <td className="p-5 text-sm text-gray-600 font-medium">{merchantName}</td>
                    <td className="p-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-gray-900">
                          {shipment.packagesCount} {crop?.unit === 'kg' ? 'طرد' : 'كرتونة'}
                        </span>
                        {shipment.weightKg && (
                          <span className="text-[10px] text-gray-400 font-bold">{shipment.weightKg} كجم</span>
                        )}
                      </div>
                    </td>
                    <td className="p-5 text-sm font-black text-green-600">{formatCurrency(shipment.totalSaleAmount || 0)}</td>
                    <td className="p-5">
                      <div className="flex justify-center">
                        <span className={cn(
                          "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight",
                          shipment.status === 'archived' ? 'bg-gray-100 text-gray-600' :
                          shipment.status === 'farmer_delivered' ? 'bg-purple-100 text-purple-700' :
                          shipment.status === 'collected' ? 'bg-green-100 text-green-700' :
                          shipment.status === 'delivered_to_merchant' ? 'bg-blue-100 text-blue-700' :
                          'bg-amber-100 text-amber-700'
                        )}>
                          {shipment.status === 'archived' ? 'مؤرشف' :
                           shipment.status === 'farmer_delivered' ? 'تم التسليم' :
                           shipment.status === 'collected' ? 'محصل' :
                           shipment.status === 'delivered_to_merchant' ? 'عند التاجر' : 'محمل'}
                        </span>
                      </div>
                    </td>
                    <td className="p-5">
                      <div className="flex items-center justify-center gap-2">
                        {shipment.receiptImageUrl ? (
                          <button 
                            onClick={() => {
                              const { data } = supabase.storage.from('receipts').getPublicUrl(shipment.receiptImageUrl!);
                              window.open(data.publicUrl, '_blank');
                            }}
                            className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                            title="عرض الفاتورة"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="w-8 h-8 flex items-center justify-center text-gray-200">
                            <Eye className="w-4 h-4 opacity-20" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-5 text-left">
                      <button 
                        onClick={() => setSelectedShipmentForModal(shipment)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all inline-block"
                        title="عرض كامل التفاصيل"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Layout */}
        <div className="sm:hidden p-4 space-y-6 bg-gray-50/50">
          {filteredFarmShipments.length === 0 ? (
            <div className="p-10 text-center text-gray-300 font-bold italic bg-white rounded-3xl border border-gray-100">لا توجد سجلات حالية</div>
          ) : filteredFarmShipments.map(shipment => {
            const crop = crops.find(c => c.id === shipment.cropId);
            const cropName = crop?.name || shipment.cropName || '-';
            const merchant = entities.find(e => e.id === shipment.merchantId && e.type === 'merchant');
            const merchantName = merchant?.name || shipment.merchantName || '-';
            return (
              <div key={shipment.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 flex flex-col gap-5 active:scale-[0.98] transition-all overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                
                <div className="flex justify-between items-start relative">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase">{formatDate(shipment.date)}</span>
                      <span className="w-1 h-1 bg-gray-300 rounded-full" />
                      <span className="text-[10px] font-black text-blue-600 uppercase">{shipment.day || ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-xs font-black text-blue-900 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-100 shadow-sm">
                         #{shipment.shipmentNumber}
                       </span>
                       <span className="text-base font-black text-gray-900">{cropName}</span>
                    </div>
                  </div>
                  <span className={cn(
                    "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tight shadow-sm border",
                    shipment.status === 'archived' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                    shipment.status === 'farmer_delivered' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                    shipment.status === 'collected' ? 'bg-green-50 text-green-700 border-green-100' :
                    shipment.status === 'delivered_to_merchant' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                    'bg-amber-50 text-amber-700 border-amber-100'
                  )}>
                    {shipment.status === 'archived' ? 'مؤرشف' :
                     shipment.status === 'farmer_delivered' ? 'تم التسليم' :
                     shipment.status === 'collected' ? 'محصل' :
                     shipment.status === 'delivered_to_merchant' ? 'عند التاجر' : 'محمل'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                   <div className="flex flex-col">
                     <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">المحصول</span>
                     <span className="text-sm font-black text-gray-700 truncate">{cropName}</span>
                   </div>
                   <div className="flex flex-col text-left">
                     <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">تصنيف الشحنة</span>
                     <div className="flex flex-col gap-0.5 items-end">
                        <span className={cn(
                          "text-[10px] font-black",
                          shipment.grade === 'A' ? "text-amber-600" : shipment.grade === 'B' ? "text-slate-600" : "text-purple-600"
                        )}>
                          {shipment.grade === 'MIXED' ? 'مزدوج (A/B)' : `قطفة ${shipment.grade || '-'}`}
                        </span>
                        {shipment.grade === 'MIXED' && (
                          <span className="text-[9px] font-bold text-gray-400">
                             ({shipment.packagesCountA}A + {shipment.packagesCountB}B)
                          </span>
                        )}
                     </div>
                   </div>
                </div>

                <div className="flex items-center justify-between">
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">إجمالي المبيعات</span>
                      <span className="text-xl font-black text-green-600">{formatCurrency(shipment.totalSaleAmount || 0)}</span>
                   </div>
                   <div className="flex flex-col text-left">
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">الكمية المسلمة</span>
                      <span className="text-sm font-black text-gray-900">
                        {shipment.packagesCount} {crop?.unit === 'kg' ? 'طرد' : 'كرتونة'}
                      </span>
                   </div>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
                   <button 
                     onClick={() => setSelectedShipmentForModal(shipment)}
                     className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-100 active:scale-[0.98] transition-all"
                   >
                     <ExternalLink className="w-4 h-4" /> تفاصيل إضافية
                   </button>
                   {shipment.receiptImageUrl && (
                    <button 
                      onClick={() => {
                        const { data } = supabase.storage.from('receipts').getPublicUrl(shipment.receiptImageUrl!);
                        window.open(data.publicUrl, '_blank');
                      }}
                      className="p-3.5 bg-green-50 text-green-600 rounded-2xl border border-green-100 hover:bg-green-100 transition-colors"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                   )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Shipment Detail Modal */}
      <AnimatePresence>
        {selectedShipmentForModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedShipmentForModal(null)} 
              className="absolute inset-0 bg-black/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white relative">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                       <Package className="w-6 h-6" />
                    </div>
                    <div>
                       <h3 className="text-xl font-black text-gray-900">
                          تفاصيل الشحنة #{selectedShipmentForModal.shipmentNumber} 
                          <span className="mr-2 text-sm text-gray-400">({crops.find(c => c.id === selectedShipmentForModal.cropId)?.name || selectedShipmentForModal.cropName || '-'})</span>
                       </h3>
                       <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase">
                          <span>{formatDate(selectedShipmentForModal.date)}</span>
                          <span className="w-1 h-1 bg-gray-300 rounded-full" />
                          <span className="text-blue-600">{selectedShipmentForModal.day}</span>
                       </div>
                    </div>
                 </div>
                 <button onClick={() => setSelectedShipmentForModal(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <X className="w-6 h-6 text-gray-400" />
                 </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto space-y-6">
                 {/* Main Status & Quick Info */}
                 <div className="flex justify-between items-center bg-gray-50 p-4 rounded-3xl border border-gray-100">
                    <div className="flex flex-col">
                       <span className="text-[10px] font-black text-gray-400 uppercase mb-1">الحالة الحالية</span>
                       <span className={cn(
                          "px-3 py-1 rounded-xl text-xs font-black uppercase tracking-tight",
                          selectedShipmentForModal.status === 'collected' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                       )}>
                          {selectedShipmentForModal.status === 'collected' ? 'تم التحصيل' : 'برسم التحصيل'}
                       </span>
                    </div>
                    <div className="flex flex-col text-left">
                       <span className="text-[10px] font-black text-gray-400 uppercase mb-1">التاجر</span>
                       <span className="text-sm font-black text-gray-900">
                          {entities.find(e => e.id === selectedShipmentForModal.merchantId)?.name || selectedShipmentForModal.merchantName || '-'}
                       </span>
                    </div>
                 </div>

                 {/* Quantities & Grading */}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-3xl border border-gray-100 bg-white shadow-sm">
                       <div className="flex items-center gap-2 mb-2">
                          <Calculator className="w-4 h-4 text-blue-600" />
                          <span className="text-[10px] font-black text-gray-400 uppercase">الكمية والوزن</span>
                       </div>
                       <p className="text-lg font-black text-gray-900">
                          {selectedShipmentForModal.packagesCount} طرد
                          {selectedShipmentForModal.weightKg && <span className="text-xs text-gray-400 mr-2">({selectedShipmentForModal.weightKg} كجم)</span>}
                       </p>
                    </div>
                    <div className="p-4 rounded-3xl border border-gray-100 bg-white shadow-sm">
                       <div className="flex items-center gap-2 mb-2">
                          <Info className="w-4 h-4 text-amber-600" />
                          <span className="text-[10px] font-black text-gray-400 uppercase">التصنيف (الفرز)</span>
                       </div>
                       <p className="text-lg font-black text-gray-900">
                          {selectedShipmentForModal.grade === 'MIXED' ? 'مزدوج A/B' : `صنف ${selectedShipmentForModal.grade || '-'}`}
                       </p>
                       {selectedShipmentForModal.grade === 'MIXED' && (
                         <div className="flex gap-4 mt-1">
                            <span className="text-[10px] font-bold text-gray-500">A: {selectedShipmentForModal.packagesCountA}</span>
                            <span className="text-[10px] font-bold text-gray-500">B: {selectedShipmentForModal.packagesCountB}</span>
                         </div>
                       )}
                    </div>
                 </div>

                 {/* Financial Details (Only if collected) */}
                 {selectedShipmentForModal.status === 'collected' && (
                   <div className="space-y-4">
                      <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                         <DollarSign className="w-4 h-4 text-green-600" />
                         التفاصيل المالية لعملية البيع
                      </h4>
                      <div className="bg-green-50/50 rounded-3xl border border-green-100 p-5 space-y-3">
                         <div className="flex justify-between items-center text-sm font-medium">
                            <span className="text-gray-500">إجمالي المبيعات (Gross)</span>
                            <span className="font-black text-gray-900">{formatCurrency(selectedShipmentForModal.totalSaleAmount || 0)}</span>
                         </div>
                         <div className="flex justify-between items-center text-sm font-medium">
                            <span className="text-gray-500 font-bold text-blue-600">(-) عمولة التاجر (الكمسيون)</span>
                            <span className="font-black text-blue-600">{formatCurrency(selectedShipmentForModal.merchantCommissionAmount || 0)}</span>
                         </div>
                         <div className="flex justify-between items-center text-sm font-medium">
                            <span className="text-gray-500 font-bold text-rose-600">(-) أجر النقل والتحميل</span>
                            <span className="font-black text-rose-600">{formatCurrency(selectedShipmentForModal.boxRentalTotal || 0)}</span>
                         </div>
                         <div className="h-px bg-green-200/50 my-3" />
                         <div className="flex justify-between items-center">
                            <span className="text-base font-black text-green-800">صافي المبلغ للمزارع (Net)</span>
                            <span className="text-xl font-black text-green-600 bg-white px-4 py-2 rounded-2xl shadow-sm ring-1 ring-green-100">
                               {formatCurrency(selectedShipmentForModal.farmerNetAmount || 0)}
                            </span>
                         </div>
                      </div>
                   </div>
                 )}

                 {/* Notes & Attachments */}
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                       <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <FileText className="w-3 h-3" /> ملاحظات
                       </h4>
                       <div className="bg-gray-50 p-4 rounded-2xl min-h-[80px] text-sm text-gray-600 font-medium">
                          {selectedShipmentForModal.notes || 'لا توجد ملاحظات إضافية'}
                       </div>
                    </div>
                    <div className="space-y-3">
                       <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <FileText className="w-3 h-3" /> المستندات المرفقة
                       </h4>
                       {selectedShipmentForModal.receiptImageUrl ? (
                         <div className="relative group rounded-2xl overflow-hidden border border-gray-100 shadow-sm aspect-video bg-gray-100">
                            <img 
                              src={supabase.storage.from('receipts').getPublicUrl(selectedShipmentForModal.receiptImageUrl).data.publicUrl} 
                              alt="Receipt" 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <button 
                                 onClick={() => window.open(supabase.storage.from('receipts').getPublicUrl(selectedShipmentForModal.receiptImageUrl!).data.publicUrl, '_blank')}
                                 className="px-4 py-2 bg-white rounded-xl text-black font-black text-sm flex items-center gap-2"
                               >
                                  <ExternalLink className="w-4 h-4" /> عرض كامل
                               </button>
                            </div>
                         </div>
                       ) : (
                         <div className="bg-gray-50 p-4 rounded-2xl min-h-[80px] flex items-center justify-center text-xs text-gray-400 font-bold border border-dashed border-gray-200">
                            لا توجد فاتورة مرفقة
                         </div>
                       )}
                    </div>
                 </div>
              </div>

              {/* Footer */}
              <div className="p-6 bg-gray-50 flex gap-4">
                 <button 
                   onClick={() => setSelectedShipmentForModal(null)}
                   className="flex-1 py-4 bg-white border border-gray-200 text-gray-500 rounded-2xl font-black text-lg hover:bg-white active:scale-95 transition-all shadow-sm"
                 >
                    إغلاق
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
