import { formatCurrency, cn } from '../../../lib/utils';
import { ComposedChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Printer, TrendingUp, Package, Wallet, PieChart, Activity } from 'lucide-react';

interface Props {
  selectedFarm: { name: string };
  farmProduction: number;
  farmSales: number;
  totalExpenses: number;
  netProfit: number;
  collectedSales: number;
  pendingSales: number;
  farmShipments: any[];
  topCropByProduction: any;
  topCropBySales: any;
  totalFarmQuantity: number;
  expenseBreakdown: any[];
  cropReport: any[];
  timelineData: any[];
}

export const FarmReportsTab = ({
  selectedFarm,
  farmProduction,
  farmSales,
  totalExpenses,
  netProfit,
  collectedSales,
  pendingSales,
  farmShipments,
  topCropByProduction,
  topCropBySales,
  totalFarmQuantity,
  expenseBreakdown,
  cropReport,
  timelineData
}: Props) => {
  const COLORS = ['#16a34a', '#2563eb', '#9333ea', '#f59e0b', '#ef4444'];

  return (
    <div className="bg-white w-full max-w-full p-6 sm:p-10 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-10 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-500 via-blue-500 to-purple-500" />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">التقرير التحليلي الشامل</h2>
          <p className="text-gray-500 font-bold mt-1">مزرعة: {selectedFarm.name} • {new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-900 text-white rounded-2xl hover:bg-black transition-all font-black text-sm shadow-xl active:scale-95"
        >
          <Printer className="w-4 h-4" />
          تصدير كـ PDF
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <ReportMetricCard label="إجمالي المبيعات" value={formatCurrency(farmSales)} icon={TrendingUp} color="text-green-600" bg="bg-green-50" border="border-green-100" />
        <ReportMetricCard label="إجمالي الإنتاج" value={farmProduction} subValue="طرد" icon={Package} color="text-blue-600" bg="bg-blue-50" border="border-blue-100" />
        <ReportMetricCard label="إجمالي المصاريف" value={formatCurrency(totalExpenses)} icon={Wallet} color="text-rose-600" bg="bg-rose-50" border="border-rose-100" />
        <ReportMetricCard label="صافي الربح" value={formatCurrency(netProfit)} icon={PieChart} color="text-purple-600" bg="bg-purple-50" border="border-purple-100" />
      </div>

      {/* --- Growth Indicator Chart --- */}
      <div className="p-8 rounded-[2rem] border border-gray-100 bg-white min-h-[400px] shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <span className="w-2 h-6 bg-indigo-500 rounded-full" />
            مؤشر النمو الزمني (آخر 30 يوم)
          </h3>
          <div className="px-3 py-1 bg-indigo-50 text-indigo-600 font-black text-xs rounded-lg flex items-center gap-1 shadow-inner">
            <Activity className="w-4 h-4" /> تطور الأداء
          </div>
        </div>
        
        {timelineData.length > 0 ? (
          <div className="w-full h-[350px]" style={{ display: 'block', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timelineData} margin={{ top: 20, right: 20, left: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                <XAxis 
                   dataKey="date" 
                   tick={{ fontSize: 11, fontWeight: 'bold', fill: '#6b7280' }} 
                   axisLine={false} 
                   tickLine={false} 
                   tickFormatter={(val) => {
                     const d = new Date(val);
                     return `${d.getDate()} / ${d.getMonth() + 1}`;
                   }}
                />
                
                {/* Left Axis for Production (Bar) */}
                <YAxis 
                   yAxisId="left" 
                   orientation="left" 
                   tick={{ fontSize: 11, fontWeight: 'bold', fill: '#3b82f6' }} 
                   axisLine={false} 
                   tickLine={false}
                   tickFormatter={(val) => `${val} طرد`}
                />
                
                {/* Right Axis for Sales (Area) */}
                <YAxis 
                   yAxisId="right" 
                   orientation="right" 
                   tick={{ fontSize: 11, fontWeight: 'bold', fill: '#16a34a' }} 
                   axisLine={false} 
                   tickLine={false}
                   tickFormatter={(val) => `₪${val}`}
                />
                
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  contentStyle={{ borderRadius: '1rem', border: '1px solid #f3f4f6', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold', padding: '12px 16px' }}
                  labelStyle={{ color: '#9ca3af', marginBottom: '8px', fontSize: '12px' }}
                  formatter={(value: number, name: string) => [
                    name === 'sales' ? formatCurrency(value) : `${value} طرد`, 
                    name === 'sales' ? 'إجمالي المبيعات' : 'حجم الإنتاج'
                  ]}
                  labelFormatter={(label) => {
                     const d = new Date(label as string);
                     return d.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                  }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                
                {/* The visualization */}
                <Bar yAxisId="left" dataKey="production" name="الإنتاج اليومي" fill="url(#colorProd)" radius={[4, 4, 0, 0]} barSize={24} />
                <Area yAxisId="right" type="monotone" dataKey="sales" name="المبيعات (₪)" stroke="#16a34a" strokeWidth={3} fill="url(#colorSales)" activeDot={{ r: 6, strokeWidth: 0, fill: '#16a34a' }} />
                
                {/* Cumulative Growth Line */}
                <Area yAxisId="left" type="stepAfter" dataKey="cumulativeProduction" name="تراكم الإنتاج" stroke="#f59e0b" strokeWidth={2} fillOpacity={0.05} fill="#f59e0b" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="w-full h-[300px] flex items-center justify-center p-8 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
            <p className="text-gray-400 font-bold flex items-center gap-2">
               <Activity className="w-5 h-5 text-gray-300" />
               ننتظر تسجيل شحنات ومبيعات في آخر 30 يوماً لرسم مؤشر النمو.
            </p>
          </div>
        )}
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="p-8 rounded-[2rem] border border-gray-100 bg-gray-50/30 min-h-[450px]">
          <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
            <span className="w-2 h-6 bg-green-500 rounded-full" />
            توزيع المبيعات والكميات حسب المحصول
          </h3>
          <div className="w-full h-[320px]" style={{ display: 'block', position: 'relative', minHeight: '320px' }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={cropReport} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" orientation="left" stroke="#16a34a" hide />
                <YAxis yAxisId="right" orientation="right" stroke="#2563eb" hide />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6', radius: 10 }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number, name: string) => [
                    name === 'sales' ? formatCurrency(value) : value, 
                    name === 'sales' ? 'المبيعات' : 'الكمية'
                  ]}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Bar yAxisId="left" dataKey="sales" name="المبيعات" fill="#16a34a" radius={[6, 6, 0, 0]} barSize={20} />
                <Bar yAxisId="right" dataKey="productionQuantity" name="الكمية" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-8 rounded-[2rem] border border-gray-100 bg-white shadow-sm ring-1 ring-black/5 hover:ring-green-500/20 transition-all group">
            <h3 className="font-black text-gray-900 mb-4 flex justify-between items-center text-sm uppercase tracking-widest">
              <span>هيكلية التدفق المالي</span>
              <Wallet className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors" />
            </h3>
            <div className="space-y-4">
              <FinanceRow label="المبالغ المحصلة" value={formatCurrency(collectedSales)} color="text-green-600" />
              <FinanceRow label="مبيعات بانتظار التحصيل" value={formatCurrency(pendingSales)} color="text-amber-600" />
              <div className="h-px bg-gray-100" />
              <FinanceRow label="إجمالي عدد الشحنات" value={farmShipments.length} color="text-gray-900" />
            </div>
          </div>
          
          <div className="p-8 rounded-[2rem] border border-gray-100 bg-white shadow-sm ring-1 ring-black/5 hover:ring-blue-500/20 transition-all group">
            <h3 className="font-black text-gray-900 mb-4 flex justify-between items-center text-sm uppercase tracking-widest">
              <span>أداء المحاصيل الرئيسي</span>
              <TrendingUp className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </h3>
            <div className="space-y-4">
              <FinanceRow label="الأعلى إنتاجاً" value={topCropByProduction ? `${topCropByProduction.name} (${topCropByProduction.productionQuantity} طرد)` : '-'} color="text-blue-600" />
              <FinanceRow label="الأعلى مبيعاً" value={topCropBySales ? `${topCropBySales.name} (${formatCurrency(topCropBySales.sales)})` : '-'} color="text-indigo-600" />
              <FinanceRow label="إجمالي الوحدات المنتجة" value={totalFarmQuantity.toFixed(0)} color="text-gray-900" />
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 rounded-[2rem] border border-gray-100 bg-gray-50/50">
        <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
          <span className="w-2 h-6 bg-rose-500 rounded-full" />
          تحليل مركز التكلفة والمصاريف التشغيلية
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {expenseBreakdown.map((item, idx) => (
            <div key={item.label} className={cn("p-5 rounded-2xl border bg-white shadow-sm hover:translate-y-[-2px] transition-transform", item.border || 'border-gray-100')}>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{item.label}</p>
              <p className={cn("text-lg font-black", item.color)}>{formatCurrency(item.value)}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-rose-600 rounded-[1.5rem] shadow-xl shadow-rose-200">
          <div>
            <span className="text-white/80 font-bold block text-sm mb-1">إجمالي التكاليف التشغيلية</span>
            <span className="text-white text-2xl font-black">المصاريف + أجور العمال</span>
          </div>
          <span className="text-white text-3xl font-black">{formatCurrency(totalExpenses)}</span>
        </div>
      </div>

      <div className="p-8 rounded-[2rem] border border-gray-100 bg-white">
        <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
          <span className="w-2 h-6 bg-indigo-500 rounded-full" />
          جدول مقارنة ربحية المحاصيل
        </h3>
        
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full min-w-[900px] text-right">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">المحصول</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">الوحدة</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">الشحنات</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">الإنتاج</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">المبيعات</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">المحصل</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">المعلق</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">متوسط السعر</th>
                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">% من الإنتاج</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cropReport.map((item) => {
                const shareValue = totalFarmQuantity > 0 ? (item.productionQuantity / totalFarmQuantity) * 100 : 0;
                return (
                  <tr key={item.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="p-4 font-black text-gray-900">{item.name}</td>
                    <td className="p-4 text-xs font-bold text-gray-500">{item.unit === 'kg' ? 'كيلو' : 'كرتونة'}</td>
                    <td className="p-4 font-bold text-gray-700">{item.shipmentsCount}</td>
                    <td className="p-4 font-black text-blue-600">{item.productionQuantity}</td>
                    <td className="p-4 font-black text-green-600">{formatCurrency(item.sales)}</td>
                    <td className="p-4 font-bold text-emerald-600">{formatCurrency(item.collected)}</td>
                    <td className="p-4 font-bold text-amber-600">{formatCurrency(item.pending)}</td>
                    <td className="p-4 font-bold text-purple-600">{formatCurrency(item.averagePricePerUnit)}</td>
                    <td className="p-4">
                       <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${shareValue}%` }} />
                        </div>
                        <span className="text-[10px] font-black text-gray-900 w-8">{shareValue.toFixed(0)}%</span>
                       </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Layout */}
        <div className="sm:hidden space-y-4">
          {cropReport.map((item) => {
            const shareValue = totalFarmQuantity > 0 ? (item.productionQuantity / totalFarmQuantity) * 100 : 0;
            return (
              <div key={item.id} className="p-5 rounded-2xl border border-gray-100 bg-gray-50/30 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black text-gray-900">{item.name}</h4>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {item.shipmentsCount} شحنات • {item.unit === 'kg' ? 'كيلو' : 'كرتونة'}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">متوسط السعر</p>
                    <p className="text-sm font-black text-purple-600">{formatCurrency(item.averagePricePerUnit)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100/50">
                     <span className="text-[10px] font-black text-gray-400 block mb-1 uppercase">الإنتاج</span>
                     <span className="font-black text-blue-600 text-sm">{item.productionQuantity} طرد</span>
                   </div>
                   <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100/50">
                     <span className="text-[10px] font-black text-gray-400 block mb-1 uppercase">المبيعات</span>
                     <span className="font-black text-green-600 text-sm">{formatCurrency(item.sales)}</span>
                   </div>
                   <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100/50">
                     <span className="text-[10px] font-black text-gray-400 block mb-1 uppercase">المحصل</span>
                     <span className="font-black text-emerald-600 text-sm">{formatCurrency(item.collected)}</span>
                   </div>
                   <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100/50">
                     <span className="text-[10px] font-black text-gray-400 block mb-1 uppercase">المعلق</span>
                     <span className="font-black text-amber-600 text-sm">{formatCurrency(item.pending)}</span>
                   </div>
                </div>

                <div className="space-y-1.5 pt-2">
                   <div className="flex justify-between items-center text-[10px] font-black text-gray-400">
                     <span>الحصة من إجمالي الإنتاج</span>
                     <span>{shareValue.toFixed(0)}%</span>
                   </div>
                   <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${shareValue}%` }} />
                   </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-10 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-[3rem] shadow-2xl shadow-purple-200 flex flex-col sm:flex-row items-center justify-between gap-8 text-white relative overflow-hidden">
        <div className="absolute right-0 bottom-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 translate-x-1/2" />
        <div className="space-y-2">
          <h3 className="text-2xl font-black">صافي الربح النهائي للمزرعة</h3>
          <p className="text-white/70 font-bold">(إجمالي المبيعات - المصاريف التشغيلية والأجور)</p>
        </div>
        <div className="text-right">
           <span className="text-5xl font-black block tracking-tighter">{formatCurrency(netProfit)}</span>
           <span className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest">
             <TrendingUp className="w-4 h-4" />
             أداء مالي مستقر
           </span>
        </div>
      </div>
    </div>
  );
};

function ReportMetricCard({ label, value, subValue, icon: Icon, color, bg, border }: any) {
  return (
    <div className={cn("p-6 rounded-[2rem] border transition-all hover:scale-[1.02] duration-300 shadow-sm", bg, border)}>
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-3 rounded-2xl bg-white shadow-sm", color)}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={cn("text-2xl font-black", color)}>{value}</span>
        {subValue && <span className="text-xs font-bold text-gray-400">{subValue}</span>}
      </div>
    </div>
  );
}

function FinanceRow({ label, value, color }: { label: string, value: any, color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 font-bold text-sm tracking-tight">{label}</span>
      <span className={cn("font-black tracking-tight", color)}>{value}</span>
    </div>
  );
}
