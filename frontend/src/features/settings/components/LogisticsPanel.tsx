import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  Package, DollarSign, Fuel, TrendingUp, Plus, Save, X, Truck, Wrench, ShieldCheck, FileText, Settings as SettingsIcon, Edit2, Trash2 
} from 'lucide-react';
import { useData } from '../../../contexts/DataContext';
import { createDocument, updateDocument, deleteDocument } from '../../../services/db';
import { supabase } from '../../../supabase';
import { cn, formatCurrency, formatDate } from '../../../lib/utils';
import { QuickStatCard } from './QuickStatCard';
import { VehicleExpense } from '../../../types';

export function LogisticsPanel() {
  const { shipments, vehicleExpenses, farmerAccounts } = useData();

  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [isAddingVehicleExpense, setIsAddingVehicleExpense] = useState(false);
  const [editingVehicleExpenseId, setEditingVehicleExpenseId] = useState<string | null>(null);
  const [newVehicleExpense, setNewVehicleExpense] = useState<Partial<VehicleExpense>>({ 
    type: 'diesel', 
    cost: 0, 
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserEmail((data.user?.email || '').toLowerCase());
    });
  }, []);

  const transportStats = useMemo(() => {
    const validTransports = shipments.filter(s => ['collected', 'farmer_delivered', 'archived'].includes(s.status));
    const totalPackages = validTransports.reduce((sum, s) => sum + (s.packagesCount || 0), 0);
    const totalRevenue = validTransports.reduce((sum, s) => sum + (s.boxRentalTotal || 0), 0);
    const totalExpenses = vehicleExpenses.reduce((sum, v) => sum + (v.cost || 0), 0);
    return {
      totalPackages,
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses
    };
  }, [shipments, vehicleExpenses]);

  const handleAddVehicleExpense = async () => {
    if (!newVehicleExpense.cost || newVehicleExpense.cost <= 0) {
      toast.error('يرجى إدخال تكلفة صحيحة');
      return;
    }

    const currentAccount = farmerAccounts.find(a => a.email?.toLowerCase() === currentUserEmail);
    const farmerIdToUse = newVehicleExpense.farmerId || currentAccount?.farmerId || null;

    const expenseData = {
      ...newVehicleExpense,
      farmerId: farmerIdToUse
    };

    try {
      if (editingVehicleExpenseId) {
        await updateDocument('vehicle_expenses', editingVehicleExpenseId, expenseData);
        toast.success('تم تحديث المصروف بنجاح');
      } else {
        await createDocument('vehicle_expenses', expenseData);
        toast.success('تمت إضافة المصروف بنجاح');
      }
      setNewVehicleExpense({ type: 'diesel', cost: 0, date: new Date().toISOString().split('T')[0], notes: '' });
      setIsAddingVehicleExpense(false);
      setEditingVehicleExpenseId(null);
    } catch (error: any) {
      if (error?.message?.includes('violates not-null constraint')) {
        toast.error('خطأ: يجب تشغيل كود SQL المذكور لجعل خانة المزارع اختيارية.');
      } else {
        toast.error('فشل حفظ المصروف. تحقق من الصلاحيات.');
      }
    }
  };

  const startEditVehicleExpense = (v: VehicleExpense) => {
    setNewVehicleExpense(v);
    setEditingVehicleExpenseId(v.id);
    setIsAddingVehicleExpense(true);
  };

  const handleDeleteVehicleExpense = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
      await deleteDocument('vehicle_expenses', id);
      toast.success('تم الحذف بنجاح');
    }
  };

  return (
    <section className="space-y-8 text-right" dir="rtl">
      {/* Transport Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <QuickStatCard label="إجمالي الطرود" value={transportStats.totalPackages} icon={Package} color="text-blue-600" bg="bg-blue-50" />
        <QuickStatCard label="دخل النقل التراكمي" value={formatCurrency(transportStats.totalRevenue)} icon={DollarSign} color="text-green-600" bg="bg-green-50" />
        <QuickStatCard label="مصاريف المركبات" value={formatCurrency(transportStats.totalExpenses)} icon={Fuel} color="text-rose-600" bg="bg-rose-50" />
        <QuickStatCard label="صافي ربح النقل" value={formatCurrency(transportStats.netProfit)} icon={TrendingUp} color="text-amber-600" bg="bg-amber-50" />
      </div>

      {/* Vehicle Expenses Management */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50/30 gap-4">
          <div>
            <h3 className="text-xl font-black text-gray-900">سجل مصاريف وصيانة المركبات</h3>
            <p className="text-sm text-gray-500 font-bold">إدارة ديزل وصيانة وتأمين شاحنات النقل</p>
          </div>
          <button 
            onClick={() => {
              setEditingVehicleExpenseId(null);
              setNewVehicleExpense({ type: 'diesel', cost: 0, date: new Date().toISOString().split('T')[0], notes: '' });
              setIsAddingVehicleExpense(true);
            }}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-2xl hover:bg-purple-700 transition-all font-black text-sm shadow-xl shadow-purple-100 active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            إضافة مصروف جديد
          </button>
        </div>

        <div className="flex-1">
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-100 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <th className="p-6">التاريخ</th>
                  <th className="p-6">نوع المصروف</th>
                  <th className="p-6">المبلغ</th>
                  <th className="p-6">ملاحظات</th>
                  <th className="p-6 text-center w-32">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isAddingVehicleExpense && (
                  <tr className="bg-purple-50/20">
                    <td className="p-6">
                      <input
                        type="date"
                        value={newVehicleExpense.date}
                        onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, date: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold"
                      />
                    </td>
                    <td className="p-6">
                      <select
                        value={newVehicleExpense.type}
                        onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, type: e.target.value as any })}
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold"
                      >
                        <option value="diesel">ديزل / وقود</option>
                        <option value="maintenance">صيانة / إصلاح</option>
                        <option value="insurance">تأمين</option>
                        <option value="license">ترخيص</option>
                        <option value="other">أخرى</option>
                      </select>
                    </td>
                    <td className="p-6">
                      <input
                        type="number"
                        placeholder="المبلغ"
                        value={newVehicleExpense.cost || ''}
                        onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, cost: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold"
                      />
                    </td>
                    <td className="p-6">
                      <input
                        placeholder="ملاحظات..."
                        value={newVehicleExpense.notes}
                        onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, notes: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold"
                      />
                    </td>
                    <td className="p-6">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={handleAddVehicleExpense} className="p-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors">
                          <Save className="w-4 h-4" />
                        </button>
                        <button onClick={() => setIsAddingVehicleExpense(false)} className="p-2.5 bg-white text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {vehicleExpenses.length === 0 && !isAddingVehicleExpense ? (
                  <tr>
                    <td colSpan={5} className="p-20 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-300">
                        <Truck className="w-12 h-12 opacity-20" />
                        <p className="font-bold">لا يوجد مصاريف مسجلة للنقل</p>
                      </div>
                    </td>
                  </tr>
                ) : vehicleExpenses.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="p-6">
                      <span className="text-sm font-black text-gray-900">{formatDate(v.date)}</span>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          v.type === 'diesel' ? 'bg-amber-50 text-amber-600' :
                          v.type === 'maintenance' ? 'bg-blue-50 text-blue-600' :
                          v.type === 'insurance' ? 'bg-green-50 text-green-600' :
                          v.type === 'license' ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-600'
                        )}>
                          {v.type === 'diesel' ? <Fuel className="w-4 h-4" /> :
                           v.type === 'maintenance' ? <Wrench className="w-4 h-4" /> :
                           v.type === 'insurance' ? <ShieldCheck className="w-4 h-4" /> :
                           v.type === 'license' ? <FileText className="w-4 h-4" /> : <SettingsIcon className="w-4 h-4" />
                          }
                        </div>
                        <span className="text-sm font-bold text-gray-700">
                          {v.type === 'diesel' ? 'ديزل / وقود' :
                           v.type === 'maintenance' ? 'صيانة / إصلاح' :
                           v.type === 'insurance' ? 'تأمين' :
                           v.type === 'license' ? 'ترخيص' : 'أخرى'}
                        </span>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="text-sm font-black text-rose-600">{formatCurrency(v.cost)}</span>
                    </td>
                    <td className="p-6">
                      <span className="text-xs font-bold text-gray-500">{v.notes || '-'}</span>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEditVehicleExpense(v)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteVehicleExpense(v.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout */}
          <div className="sm:hidden divide-y divide-gray-100 bg-white">
            {isAddingVehicleExpense && (
              <div className="p-5 bg-purple-50/20 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={newVehicleExpense.date}
                    onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, date: e.target.value })}
                    className="px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none font-bold text-xs"
                  />
                  <input
                    type="number"
                    placeholder="المبلغ"
                    value={newVehicleExpense.cost || ''}
                    onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, cost: parseFloat(e.target.value) || 0 })}
                    className="px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none font-bold text-sm"
                  />
                </div>
                <select
                  value={newVehicleExpense.type}
                  onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, type: e.target.value as any })}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none font-bold text-sm"
                >
                  <option value="diesel">ديزل / وقود</option>
                  <option value="maintenance">صيانة / إصلاح</option>
                  <option value="insurance">تأمين</option>
                  <option value="license">ترخيص</option>
                  <option value="other">أخرى</option>
                </select>
                <input
                  placeholder="ملاحظات..."
                  value={newVehicleExpense.notes}
                  onChange={(e) => setNewVehicleExpense({ ...newVehicleExpense, notes: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none font-bold"
                />
                <div className="flex gap-2">
                  <button onClick={handleAddVehicleExpense} className="flex-1 py-3 bg-purple-600 text-white rounded-2xl font-bold">حفظ المصروف</button>
                  <button onClick={() => setIsAddingVehicleExpense(false)} className="px-6 py-3 bg-gray-100 text-gray-500 rounded-2xl font-bold">إلغاء</button>
                </div>
              </div>
            )}
            {vehicleExpenses.length === 0 && !isAddingVehicleExpense ? (
              <div className="p-10 text-center text-gray-300 font-bold italic">لا يوجد مصاريف مسجلة</div>
            ) : vehicleExpenses.map((v) => (
              <div key={v.id} className="p-5 flex flex-col gap-4 active:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-gray-400 uppercase mb-1">{formatDate(v.date)}</span>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center",
                        v.type === 'diesel' ? 'bg-amber-50 text-amber-600' :
                        v.type === 'maintenance' ? 'bg-blue-50 text-blue-600' :
                        v.type === 'insurance' ? 'bg-green-50 text-green-600' :
                        v.type === 'license' ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-600'
                      )}>
                        {v.type === 'diesel' ? <Fuel className="w-3 h-3" /> :
                         v.type === 'maintenance' ? <Wrench className="w-3 h-3" /> :
                         v.type === 'insurance' ? <ShieldCheck className="w-3 h-3" /> :
                         v.type === 'license' ? <FileText className="w-3 h-3" /> : <SettingsIcon className="w-3 h-3" />
                        }
                      </div>
                      <span className="font-black text-gray-900">
                        {v.type === 'diesel' ? 'ديزل / وقود' :
                         v.type === 'maintenance' ? 'صيانة / إصلاح' :
                         v.type === 'insurance' ? 'تأمين' :
                         v.type === 'license' ? 'ترخيص' : 'أخرى'}
                      </span>
                    </div>
                  </div>
                  <span className="font-black text-rose-600 text-lg">{formatCurrency(v.cost)}</span>
                </div>
                {v.notes && <p className="text-xs text-gray-500 font-bold italic bg-gray-50 p-2 rounded-xl">{v.notes}</p>}
                <div className="flex gap-2">
                   <button onClick={() => startEditVehicleExpense(v)} className="flex-1 flex items-center justify-center gap-2 py-3 text-blue-600 bg-blue-50 rounded-2xl font-bold"><Edit2 className="w-4 h-4" /> تعديل</button>
                   <button onClick={() => handleDeleteVehicleExpense(v.id)} className="p-3 text-red-600 bg-red-50 rounded-2xl"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
