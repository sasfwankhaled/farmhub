import { Edit2, Trash2, Plus, Receipt } from 'lucide-react';
import { FarmExpense } from '../../../types';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { motion } from 'framer-motion';

interface Props {
  farmExpensesList: FarmExpense[];
  isFarmerReadonly: boolean;
  getFarmExpenseTypeLabel: (type: FarmExpense['type']) => string;
  onAddExpense: () => void;
  onEditExpense: (expense: FarmExpense) => void;
  onDeleteExpense: (id: string) => void;
}

export const FarmExpensesTab = ({
  farmExpensesList,
  isFarmerReadonly,
  getFarmExpenseTypeLabel,
  onAddExpense,
  onEditExpense,
  onDeleteExpense
}: Props) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-gray-900">سجل مصاريف التشغيل</h2>
          <p className="text-sm text-gray-500 font-medium">متابعة دقيقة لكل قرش يتم صرفه في المزرعة</p>
        </div>
        {!isFarmerReadonly && (
          <button
            onClick={onAddExpense}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-rose-600 text-white rounded-2xl hover:bg-rose-700 transition-all font-black text-sm shadow-xl shadow-rose-100 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            إضافة مصروف جديد
          </button>
        )}
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">التاريخ</th>
                <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">نوع المصروف</th>
                <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest text-center">الكمية</th>
                <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">التكلفة للوحدة</th>
                <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest">الإجمالي</th>
                {!isFarmerReadonly && <th className="p-5 font-black text-gray-400 text-[10px] uppercase tracking-widest text-center w-28">الإجراءات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {farmExpensesList.length === 0 ? (
                <tr>
                  <td colSpan={isFarmerReadonly ? 5 : 6} className="p-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                       <Receipt className="w-12 h-12 text-gray-200" />
                       <p className="text-gray-400 font-bold">لا توجد مصاريف مسجلة حتى الآن</p>
                    </div>
                  </td>
                </tr>
              ) : farmExpensesList.map((expense, idx) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={expense.id} 
                  className="hover:bg-gray-50/50 transition-colors group"
                >
                  <td className="p-5">
                    <span className="text-sm font-black text-gray-900">{formatDate(expense.date)}</span>
                    <span className="block text-[10px] text-gray-400 font-bold">{expense.day || ''}</span>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                         <Receipt className="w-4 h-4" />
                       </div>
                       <span className="text-sm font-black text-gray-900">{getFarmExpenseTypeLabel(expense.type)}</span>
                    </div>
                  </td>
                  <td className="p-5 text-center text-sm font-bold text-gray-700">{expense.quantity}</td>
                  <td className="p-5 text-sm font-bold text-gray-700">{formatCurrency(expense.cost)}</td>
                  <td className="p-5">
                    <span className="text-sm font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl">
                      {formatCurrency(expense.total)}
                    </span>
                  </td>
                  {!isFarmerReadonly && (
                    <td className="p-5">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEditExpense(expense)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteExpense(expense.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          title="حذف"
                        >
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
          {farmExpensesList.length === 0 ? (
            <div className="p-10 text-center text-gray-300 font-bold italic">لا توجد مصاريف مسجلة</div>
          ) : farmExpensesList.map((expense, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={expense.id} 
              className="p-5 flex flex-col gap-4 active:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-gray-400 uppercase mb-1">{formatDate(expense.date)}</span>
                  <div className="flex items-center gap-2">
                     <div className="w-6 h-6 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                       <Receipt className="w-3.5 h-3.5" />
                     </div>
                     <span className="font-black text-gray-900">{getFarmExpenseTypeLabel(expense.type)}</span>
                  </div>
                </div>
                <span className="text-lg font-black text-rose-600">{formatCurrency(expense.total)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-2">
                 <div className="flex flex-col">
                   <span className="text-[10px] font-black text-gray-400 uppercase">الكمية</span>
                   <span className="text-sm font-bold text-gray-700">{expense.quantity}</span>
                 </div>
                 <div className="flex flex-col text-left">
                   <span className="text-[10px] font-black text-gray-400 uppercase">سعر الوحدة</span>
                   <span className="text-sm font-bold text-gray-700">{formatCurrency(expense.cost)}</span>
                 </div>
              </div>

              {!isFarmerReadonly && (
                <div className="flex gap-2 pt-2 border-t border-gray-50">
                   <button 
                     onClick={() => onEditExpense(expense)}
                     className="flex-1 flex items-center justify-center gap-2 py-3 text-blue-600 bg-blue-50 rounded-2xl font-bold"
                   >
                     <Edit2 className="w-4 h-4" /> تعديل
                   </button>
                   <button 
                     onClick={() => onDeleteExpense(expense.id)}
                     className="p-3 text-red-600 bg-red-50 rounded-2xl"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
};
