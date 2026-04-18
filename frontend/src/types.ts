/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EntityType = 'farmer' | 'merchant' | 'worker';

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  commissionRate?: number; // For merchants only
  hourlyRate?: number; // For workers only
}

export interface Crop {
  id: string;
  name: string;
  unit: 'box' | 'kg' | 'box_and_kg';
}

export interface Farm {
  id: string;
  name: string;
  farmerIds: string[]; // Owners of the farm
}

export interface FarmerAccount {
  id: string;
  username?: string;
  email?: string;
  authUserId?: string;
  farmerId: string;
  farmId: string;
  isActive: boolean;
  createdAt: string;
}

export interface FarmExpense {
  id: string;
  farmerId: string;
  farmId?: string;
  cropId?: string;
  date: string;
  dueDate?: string;
  day?: string;
  type: 'water' | 'workers' | 'supplies' | 'boxes';
  quantity: number;
  cost: number;
  total: number;
}

export interface VehicleExpense {
  id: string;
  farmerId: string;
  farmId?: string;
  date: string;
  dueDate?: string;
  day?: string;
  type: 'diesel' | 'maintenance' | 'insurance' | 'license' | 'other';
  cost: number;
  notes: string;
}

export interface Settings {
  boxPrice: number;
  waterPrice: number;
  transportFeePerUnit: number;
}

export interface GlobalPrice {
  id: string;
  name: string;
  value: number;
}

export interface Attendance {
  id: string;
  farmerId: string;
  farmId?: string;
  workerId: string;
  workerName: string;
  date: string;
  day?: string;
  startTime: string; // e.g., "07:00"
  endTime: string; // e.g., "16:00"
  totalHours: number;
  hourlyRate: number;
  totalCost: number;
}

export interface WorkerPayment {
  id: string;
  farmerId: string;
  farmId?: string;
  workerId: string;
  date: string;
  dueDate?: string;
  day?: string;
  amount: number;
  notes?: string;
}

export type ShipmentStatus = 'loaded' | 'delivered_to_merchant' | 'collected' | 'farmer_delivered' | 'archived';

export interface SaleBatch {
  quantity: number;   // kg or boxes
  pricePerUnit: number;
  total: number;
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  farmerId: string;
  farmId?: string;
  cropId: string;
  merchantId?: string;
  packagesCount: number;
  weightKg?: number;
  date: string;
  day?: string;
  status: ShipmentStatus;
  grade?: 'A' | 'B' | 'MIXED';
  packagesCountA?: number;
  packagesCountB?: number;
  // Collection fields
  totalSaleAmount?: number;
  saleMethod?: 'kg' | 'box';
  uniformPrice?: boolean;
  pricePerUnit?: number;
  saleBatches?: SaleBatch[];
  receiptImageUrl?: string;
  merchantCommissionRate?: number;
  merchantCommissionAmount?: number;
  boxRentalPerUnit?: number;
  boxRentalTotal?: number;
  farmerNetAmount?: number;
  collectedAt?: string;
  // Farmer delivery fields
  farmerDeliveredAt?: string;
  merchantName?: string;
  cropName?: string;
  notes?: string;
  createdAt: string;
}
