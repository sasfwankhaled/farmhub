import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Users, DollarSign, CheckCircle2, Package, Archive,
  TrendingDown, TrendingUp, ChevronDown, ChevronUp, Eye, X
} from 'lucide-react';
import { getCollection, updateDocument } from '../services/db';
import { Shipment, Entity, Crop } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { supabase } from '../supabase';
import { resolveReceiptUrl } from '../services/storage';

interface FarmerGroup {
  farmer: Entity;
  shipments: Shipment[];
  totalCollected: number;
  totalCommission: number;
  totalRental: number;
  totalNet: number;
}

export default function FarmerDeliveryPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFarmers, setExpandedFarmers] = useState<Set<string>>(new Set());
  const [deliveringFarmerId, setDeliveringFarmerId] = useState<string | null>(null);
  const [confirmNote, setConfirmNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);

  const loadData = async () => {
    try {
      const [s, e, c] = await Promise.all([
        getCollection<Shipment>('shipments'),
        getCollection<Entity>('entities'),
        getCollection<Crop>('crops'),
      ]);
      setShipments((s || []).filter(sh => sh.status === 'collected'));
      setEntities(e || []);
      setCrops(c || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const farmers = entities.filter(e => e.type === 'farmer');
  const merchants = entities.filter(e => e.type === 'merchant');

  // Group collected shipments by farmer
  const farmerGroups: FarmerGroup[] = farmers
    .map(farmer => {
      const farmerShipments = shipments.filter(s => s.farmerId === farmer.id);
      if (farmerShipments.length === 0) return null;
      const totalCollected = farmerShipments.reduce((sum, s) => sum + (s.totalSaleAmount || 0), 0);
      const totalCommission = farmerShipments.reduce((sum, s) => sum + (s.merchantCommissionAmount || 0), 0);
      const totalRental = farmerShipments.reduce((sum, s) => sum + (s.boxRentalTotal || 0), 0);
      const totalNet = farmerShipments.reduce((sum, s) => sum + (s.farmerNetAmount || (s.totalSaleAmount || 0) - (s.merchantCommissionAmount || 0) - (s.boxRentalTotal || 0)), 0);
      return { farmer, shipments: farmerShipments, totalCollected, totalCommission, totalRental, totalNet };
    })
    .filter((g): g is FarmerGroup => g !== null)
    .sort((a, b) => b.totalNet - a.totalNet);

  const toggleFarmer = (farmerId: string) => {
    setExpandedFarmers(prev => {
      const next = new Set(prev);
      next.has(farmerId) ? next.delete(farmerId) : next.add(farmerId);
      return next;
    });
  };

  const handleDeliverToFarmer = async (farmerId: string, farmerShipments: Shipment[]) => {
    setIsSubmitting(true);
    try {
      await Promise.all(
        farmerShipments.map(sh =>
          updateDocument('shipments', sh.id, {
            status: 'archived',
            farmerDeliveredAt: new Date().toISOString(),
            ...(confirmNote ? { notes: (sh.notes ? sh.notes + ' | ' : '') + confirmNote } : {}),
            archivedAt: new Date().toISOString(),
          })
        )
      );
      toast.success(`✅ تم تسليم ${farmerShipments.length} شحنة للمزارع — تم نقلها للأرشيف بنجاح`);
      setDeliveringFarmerId(null);
      setConfirmNote('');
      await loadData();
    } catch {
      toast.error('حدث خطأ أثناء التسليم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReceiptPreview = async (url?: string) => {
    if (!url) return;
    setIsImageLoading(true);
    try {
      const resolved = await resolveReceiptUrl(url);
      if (resolved) setPreviewReceipt(resolved);
    } finally {
      setIsImageLoading(false);
    }
  };

  // Summary stats
  const totalFarmers = farmerGroups.length;
  const grandNet = farmerGroups.reduce((sum, g) => sum + g.totalNet, 0);
  const grandCollected = farmerGroups.reduce((sum, g) => sum + g.totalCollected, 0);

  return (
    <div className="space-y-6 pb-24" dir="rtl">
      {/* Header */}
      <header className="flex items-center gap-4">
        <div className="bg-green-100 p-3 rounded-2xl">
          <Users className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900">تسليم المزارعين</h1>
          <p className="text-gray-500 mt-0.5">الشحنات المحصَّلة بانتظار التسليم لأصحابها</p>
        </div>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'عدد المزارعين', value: totalFarmers.toString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'إجمالي المحصَّل', value: formatCurrency(grandCollected), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
          { label: 'الصافي للمزارعين', value: formatCurrency(grandNet), icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
        ].map(s => (
          <div key={s.label} className={cn('p-5 rounded-3xl border flex items-center gap-4 shadow-sm', s.bg, s.border)}>
            <div className={cn('p-3 rounded-2xl bg-white/60 shadow-sm', s.color)}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500">{s.label}</p>
              <p className={cn('text-xl font-black', s.color)}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Farmer cards */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-gray-100">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-bold">جاري التحميل...</p>
        </div>
      ) : farmerGroups.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-16 text-center">
          <Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-lg font-bold text-gray-700">لا توجد شحنات بانتظار التسليم</p>
          <p className="text-sm text-gray-400 mt-1">جميع الشحنات تم تسليمها للمزارعين</p>
        </div>
      ) : (
        <div className="space-y-4">
          {farmerGroups.map(group => {
            const isExpanded = expandedFarmers.has(group.farmer.id);
            return (
              <motion.div key={group.farmer.id} layout className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Farmer Header */}
                <div
                  className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleFarmer(group.farmer.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center font-black text-green-700 text-xl shrink-0">
                      {group.farmer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-lg font-black text-gray-900">{group.farmer.name}</p>
                      <p className="text-sm text-gray-500">{group.shipments.length} شحنة • {group.shipments.reduce((sum, s) => sum + s.packagesCount, 0)} طرد</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Financial summary */}
                    <div className="text-left hidden sm:block">
                      <div className="text-xs text-gray-400">المحصَّل</div>
                      <div className="font-bold text-gray-700">{formatCurrency(group.totalCollected)}</div>
                    </div>
                    {group.totalCommission > 0 && (
                      <div className="text-left hidden sm:block">
                        <div className="text-xs text-gray-400">العمولة</div>
                        <div className="font-bold text-red-600">-{formatCurrency(group.totalCommission)}</div>
                      </div>
                    )}
                    {group.totalRental > 0 && (
                      <div className="text-left hidden sm:block">
                        <div className="text-xs text-gray-400">الإيجار</div>
                        <div className="font-bold text-purple-600">-{formatCurrency(group.totalRental)}</div>
                      </div>
                    )}
                    <div className="bg-green-50 border border-green-200 px-4 py-2 rounded-2xl text-left">
                      <div className="text-xs text-green-600 font-bold">الصافي</div>
                      <div className="font-black text-green-700 text-lg">{formatCurrency(group.totalNet)}</div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />}
                  </div>
                </div>

                {/* Expanded Shipment Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-gray-100">
                        {/* Desktop Table View */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full min-w-[700px] text-right">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="p-4 text-xs font-bold text-gray-500">الشحنة</th>
                                <th className="p-4 text-xs font-bold text-gray-500">المحصول</th>
                                <th className="p-4 text-xs font-bold text-gray-500">التاجر</th>
                                <th className="p-4 text-xs font-bold text-gray-500">الطرود</th>
                                <th className="p-4 text-xs font-bold text-gray-500">طريقة البيع</th>
                                <th className="p-4 text-xs font-bold text-gray-500">التحصيل</th>
                                <th className="p-4 text-xs font-bold text-gray-500">العمولة</th>
                                <th className="p-4 text-xs font-bold text-gray-500">الإيجار</th>
                                <th className="p-4 text-xs font-bold text-gray-500">الصافي</th>
                                <th className="p-4 text-xs font-bold text-gray-500">الفاتورة</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {group.shipments.map(sh => {
                                const crop = crops.find(c => c.id === sh.cropId);
                                const merchant = merchants.find(m => m.id === sh.merchantId);
                                const net = sh.farmerNetAmount ?? (sh.totalSaleAmount || 0) - (sh.merchantCommissionAmount || 0) - (sh.boxRentalTotal || 0);
                                return (
                                  <tr key={sh.id} className="hover:bg-gray-50/50">
                                    <td className="p-4"><div className="font-bold text-gray-900 text-sm">{sh.shipmentNumber}</div><div className="text-xs text-gray-400">{formatDate(sh.date)}</div></td>
                                    <td className="p-4 text-sm text-gray-700">{crop?.name || '—'}</td>
                                    <td className="p-4 text-sm text-gray-700">{merchant?.name || '—'}</td>
                                    <td className="p-4 text-sm font-bold text-gray-900">{sh.packagesCount} طرد</td>
                                    <td className="p-4">
                                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-bold',
                                        sh.saleMethod === 'kg' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700')}>
                                        {sh.saleMethod === 'kg' ? 'بالكيلو' : sh.saleMethod === 'box' ? 'بالكرتونة' : '—'}
                                      </span>
                                      {!sh.uniformPrice && <span className="mr-1 text-xs text-gray-400">أسعار متعددة</span>}
                                    </td>
                                    <td className="p-4 text-sm font-bold text-gray-900">{formatCurrency(sh.totalSaleAmount || 0)}</td>
                                    <td className="p-4 text-sm font-bold text-red-600">{sh.merchantCommissionAmount ? `-${formatCurrency(sh.merchantCommissionAmount)}` : '—'}</td>
                                    <td className="p-4 text-sm font-bold text-purple-600">{sh.boxRentalTotal ? `-${formatCurrency(sh.boxRentalTotal)}` : '—'}</td>
                                    <td className="p-4 text-sm font-black text-green-700">{formatCurrency(net)}</td>
                                    <td className="p-4">
                                      {sh.receiptImageUrl ? (
                                        <button onClick={() => openReceiptPreview(sh.receiptImageUrl)}
                                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                          <Eye className="w-4 h-4" />
                                        </button>
                                      ) : <span className="text-gray-300 text-xs">—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                              <tr>
                                <td colSpan={5} className="p-4 font-black text-gray-700">الإجمالي</td>
                                <td className="p-4 font-black text-gray-900">{formatCurrency(group.totalCollected)}</td>
                                <td className="p-4 font-black text-red-600">{group.totalCommission > 0 ? `-${formatCurrency(group.totalCommission)}` : '—'}</td>
                                <td className="p-4 font-black text-purple-600">{group.totalRental > 0 ? `-${formatCurrency(group.totalRental)}` : '—'}</td>
                                <td className="p-4 font-black text-green-700 text-lg">{formatCurrency(group.totalNet)}</td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* Mobile Card Layout */}
                        <div className="sm:hidden divide-y divide-gray-100">
                           {group.shipments.map(sh => {
                              const crop = crops.find(c => c.id === sh.cropId);
                              const merchant = merchants.find(m => m.id === sh.merchantId);
                              const net = sh.farmerNetAmount ?? (sh.totalSaleAmount || 0) - (sh.merchantCommissionAmount || 0) - (sh.boxRentalTotal || 0);
                              return (
                                <div key={sh.id} className="p-5 space-y-4">
                                   <div className="flex justify-between items-start">
                                      <div>
                                         <div className="text-sm font-black text-gray-900">#{sh.shipmentNumber}</div>
                                         <div className="text-[10px] font-bold text-gray-400">{formatDate(sh.date)}</div>
                                      </div>
                                      <div className="text-left">
                                         <div className="text-[10px] font-black text-gray-400 uppercase">الصافي للمزارع</div>
                                         <div className="text-lg font-black text-green-600">{formatCurrency(net)}</div>
                                      </div>
                                   </div>

                                   <div className="grid grid-cols-2 gap-3 text-sm">
                                      <div className="flex flex-col">
                                         <span className="text-[10px] font-black text-gray-400 uppercase">المحصول</span>
                                         <span className="font-bold text-gray-700">{crop?.name || '—'}</span>
                                      </div>
                                      <div className="flex flex-col text-left">
                                         <span className="text-[10px] font-black text-gray-400 uppercase">التاجر</span>
                                         <span className="font-bold text-gray-700">{merchant?.name || '—'}</span>
                                      </div>
                                      <div className="flex flex-col">
                                         <span className="text-[10px] font-black text-gray-400 uppercase">الكمية</span>
                                         <span className="font-bold text-gray-700">{sh.packagesCount} طرد</span>
                                      </div>
                                      <div className="flex flex-col text-left">
                                         <span className="text-[10px] font-black text-gray-400 uppercase">طريقة البيع</span>
                                         <span className={cn('font-bold', sh.saleMethod === 'kg' ? 'text-blue-600' : 'text-amber-600')}>
                                            {sh.saleMethod === 'kg' ? 'بالكيلو' : 'بالكرتونة'}
                                         </span>
                                      </div>
                                   </div>

                                   <div className="p-4 bg-gray-50 rounded-2xl flex flex-col gap-2">
                                      <div className="flex justify-between items-center text-xs">
                                         <span className="text-gray-500">إجمالي التحصيل:</span>
                                         <span className="font-black text-gray-900">{formatCurrency(sh.totalSaleAmount || 0)}</span>
                                      </div>
                                      {sh.merchantCommissionAmount && (
                                        <div className="flex justify-between items-center text-xs">
                                           <span className="text-gray-500">خصم العمولة:</span>
                                           <span className="font-bold text-red-600">-{formatCurrency(sh.merchantCommissionAmount)}</span>
                                        </div>
                                      )}
                                      {sh.boxRentalTotal && (
                                        <div className="flex justify-between items-center text-xs">
                                           <span className="text-gray-500">خصم الإيجار:</span>
                                           <span className="font-bold text-purple-600">-{formatCurrency(sh.boxRentalTotal)}</span>
                                        </div>
                                      )}
                                   </div>

                                   {sh.receiptImageUrl && (
                                      <button 
                                        onClick={() => openReceiptPreview(sh.receiptImageUrl)}
                                        className="w-full py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                                      >
                                         <Eye className="w-4 h-4" /> عرض الفاتورة والوصل
                                      </button>
                                   )}
                                </div>
                              );
                           })}
                           {/* Mobile Total Card */}
                           <div className="p-5 bg-green-50 border-t-2 border-green-100 space-y-3">
                              <div className="flex justify-between items-center text-sm font-black text-gray-700">
                                 <span>إجمالي الصافي للمزارع:</span>
                                 <span className="text-xl text-green-700">{formatCurrency(group.totalNet)}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                 <span>مجموع المحصل</span>
                                 <span>{formatCurrency(group.totalCollected)}</span>
                              </div>
                           </div>
                        </div>

                        {/* Deliver Button */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50/50">
                          {deliveringFarmerId === group.farmer.id ? (
                            <div className="flex gap-3 items-center">
                              <input value={confirmNote} onChange={e => setConfirmNote(e.target.value)}
                                placeholder="ملاحظة اختيارية للتسليم..."
                                className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-400" />
                              <button onClick={() => handleDeliverToFarmer(group.farmer.id, group.shipments)} disabled={isSubmitting}
                                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50 shadow-md shadow-green-200">
                                <CheckCircle2 className="w-4 h-4" />
                                {isSubmitting ? 'جاري...' : 'تأكيد التسليم'}
                              </button>
                              <button onClick={() => setDeliveringFarmerId(null)}
                                className="px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold hover:bg-gray-50">إلغاء</button>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                              <div className="text-sm text-gray-500">
                                سيتم أرشفة {group.shipments.length} شحنة بعد التسليم
                              </div>
                              <button onClick={() => setDeliveringFarmerId(group.farmer.id)}
                                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200">
                                <CheckCircle2 className="w-4 h-4" />
                                تم التسليم لـ{group.farmer.name} — {formatCurrency(group.totalNet)}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

          {/* Receipt Preview Modal */}
      <AnimatePresence>
        {previewReceipt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPreviewReceipt(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-3xl w-full">
              <div className="absolute -top-12 left-0 right-0 flex justify-between items-center text-white px-2">
                <button onClick={() => setPreviewReceipt(null)} className="flex items-center gap-2 font-bold hover:text-gray-300">
                  <X className="w-5 h-5" /> إغلاق
                </button>
                <a href={previewReceipt} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 font-bold hover:text-gray-300 text-sm">
                  فتح في نافذة جديدة <Eye className="w-4 h-4" />
                </a>
              </div>
              <div className="relative bg-white/10 rounded-3xl overflow-hidden border-4 border-white/20 shadow-2xl">
                {isImageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                <img 
                  src={previewReceipt} 
                  alt="الفاتورة" 
                  className="w-full h-auto max-h-[85vh] object-contain"
                  onLoad={() => setIsImageLoading(false)}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
