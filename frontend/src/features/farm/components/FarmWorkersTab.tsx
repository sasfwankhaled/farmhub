import { useState } from 'react';
import { Plus, CheckSquare, Users, ArrowUpRight, Clock, DollarSign, Edit2, Trash2, X, Calendar, ClipboardCheck, Wallet } from 'lucide-react';
import { Entity, Attendance, WorkerPayment } from '../../../types';
import { cn, formatCurrency, formatDate } from '../../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

interface Props {
  isFarmerReadonly: boolean;
  workers: Entity[];
  attendanceList: Attendance[];
  workerPaymentsList: WorkerPayment[];
  bulkAttendance: any;
  setBulkAttendance: any;
  handleBulkAttendance: () => void;
  calculateHours: (start: string, end: string) => number;
  isSubmitting: boolean;
  onAddAttendance: () => void;
  onAddPayment: () => void;
  onEditAttendance: (record: Attendance) => void;
  onDeleteAttendance: (id: string) => void;
  selectedWorkerForDetails: Entity | null;
  setSelectedWorkerForDetails: (w: Entity | null) => void;
}

export const FarmWorkersTab = ({
  isFarmerReadonly,
  workers,
  attendanceList,
  workerPaymentsList,
  bulkAttendance,
  setBulkAttendance,
  handleBulkAttendance,
  calculateHours,
  isSubmitting,
  onAddAttendance,
  onAddPayment,
  onEditAttendance,
  onDeleteAttendance,
  selectedWorkerForDetails,
  setSelectedWorkerForDetails
}: Props) => {
  const [showAllAttendance, setShowAllAttendance] = useState(false);
  const displayedAttendance = showAllAttendance ? attendanceList : attendanceList.slice(0, 5);

  return (
    <div className="space-y-10">
      {/* Attendance Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-blue-600" />
              إدارة الدوام والعمليات
            </h2>
            <p className="text-sm text-gray-500 font-medium">تسجيل حضور وانصراف العمال بشكل فردي أو جماعي</p>
          </div>
          {!isFarmerReadonly && (
            <button
              onClick={onAddAttendance}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all font-black text-sm shadow-xl shadow-blue-100 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              تسجيل دوام فردي
            </button>
          )}
        </div>

        {/* Bulk Attendance Form Container */}
        {!isFarmerReadonly && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-8 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            
            <div className="flex items-center justify-between border-b border-gray-50 pb-4 relative">
              <h3 className="text-lg font-black text-gray-900">تسجيل دوام جماعي (سريع)</h3>
              <div className="flex items-center gap-2 text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-3 py-1 rounded-full">
                <Users className="w-3 h-3" /> {workers.length} عامل متاح
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 mr-1">تاريخ اليوم</label>
                <div className="relative">
                  <input
                    type="date"
                    value={bulkAttendance.date}
                    onChange={(e) => setBulkAttendance({ ...bulkAttendance, date: e.target.value })}
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-2xl outline-none font-bold text-gray-700 transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 mr-1">اليوم</label>
                <select
                  value={bulkAttendance.day}
                  onChange={(e) => setBulkAttendance({ ...bulkAttendance, day: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-2xl outline-none font-bold text-gray-700 transition-all appearance-none"
                >
                  <option value="">اختر اليوم...</option>
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 mr-1">وقت البدء</label>
                <input
                  type="time"
                  value={bulkAttendance.startTime}
                  onChange={(e) => setBulkAttendance({ ...bulkAttendance, startTime: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-2xl outline-none font-bold text-gray-700 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 mr-1">وقت الانتهاء</label>
                <input
                  type="time"
                  value={bulkAttendance.endTime}
                  onChange={(e) => setBulkAttendance({ ...bulkAttendance, endTime: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-2xl outline-none font-bold text-gray-700 transition-all"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <label className="text-sm font-black text-gray-700">تحديد طاقم العمل</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setBulkAttendance({ ...bulkAttendance, selectedWorkerIds: workers.map(w => w.id) })}
                    className="text-xs font-black text-green-600 hover:text-green-700 transition-colors uppercase tracking-widest"
                  >
                    تحديد الجميع
                  </button>
                  <button
                    onClick={() => setBulkAttendance({ ...bulkAttendance, selectedWorkerIds: [] })}
                    className="text-xs font-black text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-widest"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {workers.map(worker => {
                  const isSelected = bulkAttendance.selectedWorkerIds.includes(worker.id);
                  const hours = calculateHours(bulkAttendance.startTime, bulkAttendance.endTime);
                  const dailyCost = hours * (worker.hourlyRate || 0);
                  
                  return (
                    <div
                      key={worker.id}
                      onClick={() => {
                        setBulkAttendance((prev: any) => ({
                          ...prev,
                          selectedWorkerIds: isSelected 
                            ? prev.selectedWorkerIds.filter((id: string) => id !== worker.id)
                            : [...prev.selectedWorkerIds, worker.id]
                        }));
                      }}
                      className={cn(
                        "group p-5 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer",
                        isSelected 
                          ? "border-green-500 bg-green-50/50 shadow-lg shadow-green-100/20" 
                          : "border-gray-100 bg-white hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg transition-colors shadow-sm",
                            isSelected ? "bg-green-600 text-white" : "bg-gray-100 text-gray-400"
                          )}>
                            {worker.name.charAt(0)}
                          </div>
                          {isSelected && (
                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center border-2 border-white">
                              <CheckSquare className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-black text-gray-900 text-sm">{worker.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                            {worker.hourlyRate} ₪ / ساعة
                          </p>
                        </div>
                      </div>
                      
                      {isSelected && (
                        <div className="text-left bg-white px-3 py-1.5 rounded-xl border border-green-200">
                          <p className="text-[10px] font-black text-green-700 leading-none">{hours} س</p>
                          <p className="text-sm font-black text-green-600 mt-0.5">{dailyCost} ₪</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 p-6 bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
              <div className="absolute left-0 bottom-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="flex items-center gap-6">
                 <div className="text-right">
                    <p className="text-gray-400 text-sm font-bold mb-1">عدد العمال المحدد</p>
                    <p className="text-white text-2xl font-black">{bulkAttendance.selectedWorkerIds.length} <span className="text-xs">عامل</span></p>
                 </div>
                 <div className="w-px h-10 bg-white/10" />
                 <div className="text-right">
                    <p className="text-gray-400 text-sm font-bold mb-1">إجمالي التكلفة</p>
                    <p className="text-green-400 text-2xl font-black">{
                      bulkAttendance.selectedWorkerIds.reduce((sum: number, id: string) => {
                        const worker = workers.find(w => w.id === id);
                        return sum + (calculateHours(bulkAttendance.startTime, bulkAttendance.endTime) * (worker?.hourlyRate || 0));
                      }, 0)
                    } <span className="text-xs text-white/50 font-bold uppercase tracking-widest">₪</span></p>
                 </div>
              </div>
              
              <button
                onClick={handleBulkAttendance}
                disabled={isSubmitting || bulkAttendance.selectedWorkerIds.length === 0}
                className="w-full sm:w-auto px-8 py-4 bg-white text-gray-900 rounded-2xl font-black text-sm hover:bg-green-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-xl active:scale-95"
              >
                {isSubmitting ? 'جاري الحفظ...' : 'تأكيد وحفظ الدوام الجماعي'}
              </button>
            </div>
          </motion.div>
        )}
        
        {/* Attendance Table */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden mt-8">
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">التاريخ</th>
                  <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">العامل</th>
                  <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest text-center">الوقت المسجل</th>
                  <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest text-center">ساعات العمل</th>
                  <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">التكلفة</th>
                  {!isFarmerReadonly && <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest text-center w-28">الإجراءات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayedAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={isFarmerReadonly ? 5 : 6} className="p-16 text-center">
                       <div className="flex flex-col items-center gap-2">
                        <Clock className="w-12 h-12 text-gray-200" />
                        <p className="text-gray-400 font-black">لا توجد سجلات دوام متاحة</p>
                       </div>
                    </td>
                  </tr>
                ) : displayedAttendance.map((record, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    key={record.id} 
                    className="hover:bg-gray-50/50 transition-colors group"
                  >
                    <td className="p-5">
                      <span className="text-sm font-black text-gray-900">{formatDate(record.date)}</span>
                      <span className="block text-[10px] text-gray-400 font-bold">{record.day || ''}</span>
                    </td>
                    <td className="p-5 font-black text-gray-900 text-sm">
                       <div className="flex items-center gap-2">
                         <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-[10px] text-blue-600 font-black">
                           {record.workerName?.charAt(0)}
                         </div>
                         {record.workerName}
                       </div>
                    </td>
                    <td className="p-5 text-center text-[11px] font-bold text-gray-500 bg-gray-50/30">
                       {record.startTime} <span className="text-gray-300">←</span> {record.endTime}
                    </td>
                    <td className="p-5 text-center">
                       <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black">
                         {record.totalHours} ساعة
                       </span>
                    </td>
                    <td className="p-5 text-sm font-black text-gray-900">{formatCurrency(record.totalCost)}</td>
                    {!isFarmerReadonly && (
                      <td className="p-5 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onEditAttendance(record)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => onDeleteAttendance(record.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="sm:hidden divide-y divide-gray-100">
            {displayedAttendance.length === 0 ? (
              <div className="p-10 text-center text-gray-300 font-bold italic">لا توجد سجلات حالية</div>
            ) : displayedAttendance.map((record, idx) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={record.id} 
                className="p-5 flex flex-col gap-4 active:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-400 uppercase mb-1">{formatDate(record.date)}</span>
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-[10px] text-blue-600 font-black">
                         {record.workerName?.charAt(0)}
                       </div>
                       <span className="font-black text-gray-900">{record.workerName}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-tight">
                    {record.totalHours} ساعة
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pb-2">
                   <div className="flex flex-col">
                     <span className="text-[10px] font-black text-gray-400 uppercase">الوقت المسجل</span>
                     <span className="text-xs font-bold text-gray-700">
                        {record.startTime} ← {record.endTime}
                     </span>
                   </div>
                   <div className="flex flex-col text-left">
                     <span className="text-[10px] font-black text-gray-400 uppercase">إجمالي التكلفة</span>
                     <span className="text-sm font-black text-gray-900">{formatCurrency(record.totalCost)}</span>
                   </div>
                </div>

                {!isFarmerReadonly && (
                  <div className="flex gap-2 pt-2 border-t border-gray-50">
                     <button 
                       onClick={() => onEditAttendance(record)}
                       className="flex-1 flex items-center justify-center gap-2 py-3 text-blue-600 bg-blue-50 rounded-2xl font-bold"
                     >
                       <Edit2 className="w-4 h-4" /> تعديل
                     </button>
                     <button 
                       onClick={() => onDeleteAttendance(record.id)}
                       className="p-3 text-red-600 bg-red-50 rounded-2xl"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
          
          {attendanceList.length > 5 && (
            <div className="p-4 bg-gray-50/50 border-t border-gray-100 text-center">
              <button
                onClick={() => setShowAllAttendance(!showAllAttendance)}
                className="text-sm font-black text-blue-600 hover:text-blue-700 transition-colors py-2 px-4 rounded-xl bg-white shadow-sm border border-gray-100 active:scale-95"
              >
                {showAllAttendance ? 'عرض أقل' : `عرض المزيد (${attendanceList.length - 5}+)`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Financial Status Summary Section */}
      <div className="space-y-6 pt-4 border-t border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-purple-600" />
              أرصدة ودفعات العمال
            </h2>
            <p className="text-sm text-gray-500 font-medium">متابعة المستحقات المالية لكل عامل بدقة</p>
          </div>
          {!isFarmerReadonly && (
            <button
              onClick={onAddPayment}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-2xl hover:bg-purple-700 transition-all font-black text-sm shadow-xl shadow-purple-100 active:scale-95"
            >
              <DollarSign className="w-4 h-4" />
              تسجيل دفعة مالية
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {workers.map(worker => {
            const workerAttendance = attendanceList.filter(a => a.workerId === worker.id);
            const workerPaymentsForWorker = workerPaymentsList.filter(p => p.workerId === worker.id);
            
            const totalDue = workerAttendance.reduce((sum, a) => sum + a.totalCost, 0);
            const totalPaid = workerPaymentsForWorker.reduce((sum, p) => sum + p.amount, 0);
            const remaining = totalDue - totalPaid;

            if (totalDue === 0 && totalPaid === 0) return null;

            return (
              <motion.div 
                whileHover={{ y: -5 }}
                key={worker.id} 
                onClick={() => setSelectedWorkerForDetails(worker)}
                className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 relative group overflow-hidden cursor-pointer active:scale-[0.98] transition-all"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center shadow-inner group-hover:bg-purple-50 group-hover:text-purple-600 transition-all">
                    <Users className="w-7 h-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-gray-900 leading-none mb-1">{worker.name}</h3>
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                       <Clock className="w-3 h-3" /> {worker.hourlyRate} ₪ / ساعة
                    </div>
                  </div>
                  <div
                    className="p-3 text-blue-600 bg-blue-50 group-hover:bg-blue-100 rounded-2xl transition-all shadow-sm"
                    title="عرض كشف الحساب"
                  >
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-bold">إجمالي المستحقات</span>
                    <span className="font-black text-gray-900">{formatCurrency(totalDue)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 font-bold">إجمالي المدفوعات</span>
                    <span className="font-black text-emerald-600">-{formatCurrency(totalPaid)}</span>
                  </div>
                  <div className="pt-4 border-t border-gray-50 space-y-3">
                    <div className="flex justify-between text-[10px] font-black text-gray-400">
                      <span>نسبة التسديد</span>
                      <span>{(Math.min((totalPaid / (totalDue || 1)) * 100, 100)).toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className={cn("h-full transition-all rounded-full shadow-sm", (totalPaid/totalDue) >= 1 ? "bg-emerald-500" : "bg-purple-500")}
                        style={{ width: `${Math.min((totalPaid / (totalDue || 1)) * 100, 100)}%` }} 
                      />
                    </div>
                    
                    <div className={cn(
                      "flex justify-between items-center p-4 rounded-2xl shadow-sm border-2 transition-colors",
                      remaining > 0 ? "bg-rose-50 border-rose-100" : "bg-emerald-50 border-emerald-100"
                    )}>
                      <span className="text-xs font-black text-gray-700 uppercase tracking-widest leading-none">
                        {remaining > 0 ? 'الرصيد المتبقي ضده' : 'خالص الأجور'}
                      </span>
                      {remaining > 0 ? (
                        <span className="text-xl font-black text-rose-600 leading-none">
                          {formatCurrency(remaining)}
                        </span>
                      ) : (
                        <span className="text-lg font-black text-emerald-600 leading-none flex items-center gap-1">
                          0 ₪
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
