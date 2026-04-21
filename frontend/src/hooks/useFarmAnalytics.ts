import { useMemo } from 'react';
import { Shipment, FarmExpense, Attendance, WorkerPayment, GlobalPrice, Settings } from '../types';

interface AnalyticsParams {
  shipments: Shipment[];
  farmExpenses: FarmExpense[];
  attendance: Attendance[];
  workerPayments: WorkerPayment[];
  globalPrices?: GlobalPrice[];
  settings?: Settings | null;
}

export const useFarmAnalytics = ({
  shipments,
  farmExpenses,
  attendance,
  workerPayments,
  globalPrices = [],
  settings = null
}: AnalyticsParams) => {
  return useMemo(() => {
    const asNumber = (value: any) => (typeof value === 'number' ? value : Number(value) || 0);

    // 1. Production & Sales
    const totalProduction = shipments.reduce((sum, s) => sum + (s.packagesCount || 0), 0);
    const totalSales = shipments.reduce((sum, s) => sum + asNumber(s.totalSaleAmount), 0);
    const totalFarmerNet = shipments.reduce((sum, s) => sum + asNumber(s.farmerNetAmount), 0);

    const collectedSales = shipments
      .filter((s) => ['collected', 'farmer_delivered', 'archived'].includes(s.status))
      .reduce((sum, s) => sum + asNumber(s.totalSaleAmount), 0);

    const collectedFarmerNet = shipments
      .filter((s) => ['collected', 'farmer_delivered', 'archived'].includes(s.status))
      .reduce((sum, s) => sum + asNumber(s.farmerNetAmount), 0);

    // 2. Expenses
    const waterExpenses = farmExpenses.filter((e) => e.type === 'water').reduce((sum, e) => sum + asNumber(e.total), 0);
    const boxesExpenses = farmExpenses.filter((e) => e.type === 'boxes').reduce((sum, e) => sum + asNumber(e.total), 0);
    const suppliesExpenses = farmExpenses.filter((e) => e.type === 'supplies').reduce((sum, e) => sum + asNumber(e.total), 0);
    const laborCosts = attendance.reduce((sum, a) => sum + asNumber(a.totalCost), 0);
    const workerPaymentsTotal = workerPayments.reduce((sum, p) => sum + asNumber(p.amount), 0);

    const totalOperatingExpenses = waterExpenses + boxesExpenses + suppliesExpenses + laborCosts;

    // 3. Profitability
    const netProfit = totalSales - totalOperatingExpenses;
    const farmerNetProfit = totalFarmerNet - totalOperatingExpenses;

    // 4. Delivery Analytics (Logistics)
    const allDeliveredPackages = shipments
      .filter((s) => s.status !== 'loaded')
      .reduce((sum, s) => sum + (s.packagesCount || 0), 0);

    const deliveryIncome = shipments
      .filter((s) => s.status !== 'loaded')
      .reduce((sum, s) => {
        const rentalTotal = asNumber(s.boxRentalTotal);
        if (rentalTotal > 0) return sum + rentalTotal;
        
        const rentalPerUnit = asNumber(s.boxRentalPerUnit);
        const pkgCount = asNumber(s.packagesCount);
        
        if (rentalPerUnit > 0) {
          return sum + (pkgCount * rentalPerUnit);
        }
        
        // Fallback to settings or global prices if available
        const fallbackPrice = asNumber(settings?.transportFeePerUnit);
        return sum + (pkgCount * fallbackPrice);
      }, 0);

    return {
      totalProduction,
      totalSales,
      totalFarmerNet,
      collectedSales,
      collectedFarmerNet,
      pendingSales: totalSales - collectedSales,
      pendingFarmerNet: totalFarmerNet - collectedFarmerNet,
      waterExpenses,
      boxesExpenses,
      suppliesExpenses,
      laborCosts,
      workerPaymentsTotal,
      totalOperatingExpenses,
      netProfit,
      farmerNetProfit,
      deliveryIncome
    };
  }, [shipments, farmExpenses, attendance, workerPayments, globalPrices, settings]);
};
