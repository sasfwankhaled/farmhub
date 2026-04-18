import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, AlertCircle, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { subscribeToCollection } from '../../services/db';
import { FarmExpense, VehicleExpense, Shipment, Entity } from '../../types';

export const NotificationBell = () => {
  const [farmExpenses, setFarmExpenses] = useState<FarmExpense[]>([]);
  const [vehicleExpenses, setVehicleExpenses] = useState<VehicleExpense[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsubFarm = subscribeToCollection<FarmExpense>('farm_expenses', setFarmExpenses);
    const unsubVehicle = subscribeToCollection<VehicleExpense>('vehicle_expenses', setVehicleExpenses);
    const unsubShipments = subscribeToCollection<Shipment>('shipments', setShipments);
    const unsubEntities = subscribeToCollection<Entity>('entities', setEntities);
    return () => {
      unsubFarm();
      unsubVehicle();
      unsubShipments();
      unsubEntities();
    };
  }, []);

  const getNotifications = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(now.getDate() + 3);

    const items: { id: string; title: string; subtitle: string; amount?: number; type: 'farm' | 'vehicle' | 'shipment'; isCritical?: boolean }[] = [];

    // Expenses
    farmExpenses.forEach(e => {
      if (e.dueDate) {
        const dueDate = new Date(e.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate >= now && dueDate <= threeDaysFromNow) {
          items.push({
            id: e.id,
            title: `مصروف مزرعة: ${e.type === 'water' ? 'مياه' : e.type === 'workers' ? 'عمال' : e.type === 'supplies' ? 'مستلزمات' : 'صناديق'}`,
            subtitle: `يستحق في: ${e.dueDate}`,
            amount: e.total,
            type: 'farm'
          });
        }
      }
    });

    vehicleExpenses.forEach(e => {
      if (e.dueDate) {
        const dueDate = new Date(e.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate >= now && dueDate <= threeDaysFromNow) {
          items.push({
            id: e.id,
            title: `مصروف مركبة: ${e.type === 'diesel' ? 'ديزل' : 'صيانة'}`,
            subtitle: `يستحق في: ${e.dueDate}`,
            amount: e.cost,
            type: 'vehicle'
          });
        }
      }
    });

    // Delayed Shipments
    shipments.forEach(s => {
      if (s.status === 'delivered_to_merchant') {
        const shipmentDate = new Date(s.date);
        shipmentDate.setHours(0, 0, 0, 0);
        const diffTime = Math.abs(now.getTime() - shipmentDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 5) {
          const merchant = entities.find(e => e.id === s.merchantId);
          items.push({
            id: s.id,
            title: `تأخير تحصيل شحنة #${s.shipmentNumber}`,
            subtitle: `عند التاجر/المشاغل: ${merchant?.name || 'مجهول'} (${diffDays} أيام)`,
            type: 'shipment',
            isCritical: true
          });
        }
      }
    });

    return items;
  };

  const notifications = getNotifications();

  useEffect(() => {
    // Only toast on mount or if criticals increase
    const criticals = notifications.filter(n => n.isCritical);
    if (criticals.length > 0) {
      toast(`يوجد ${criticals.length} شحنة متأخرة التحصيل!`, {
        icon: '⚠️',
        duration: 5000,
        style: { border: '1px solid #ef4444', color: '#b91c1c' }
      });
    }
  }, [shipments.length]); // loosely depend on shipments length

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
      >
        <Bell className={cn("w-6 h-6", notifications.some(n => n.isCritical) && "text-rose-600 animate-pulse")} />
        {notifications.length > 0 && (
          <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-green-600" />
                  التنبيهات
                </h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm font-bold">
                    لا توجد تنبيهات حالياً
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {notifications.map(item => (
                      <div key={item.id} className={cn("p-4 transition-colors", item.isCritical ? "bg-rose-50 hover:bg-rose-100" : "hover:bg-gray-50")}>
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <p className={cn("font-black text-sm leading-tight", item.isCritical ? "text-rose-900" : "text-gray-900")}>
                            {item.title}
                          </p>
                          {item.amount !== undefined && (
                            <span className="text-xs font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-lg whitespace-nowrap">
                              {formatCurrency(item.amount)}
                            </span>
                          )}
                        </div>
                        <p className={cn("text-xs font-bold flex items-center gap-1.5", item.isCritical ? "text-rose-700" : "text-gray-500")}>
                          {item.isCritical ? <AlertCircle className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                          {item.subtitle}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
