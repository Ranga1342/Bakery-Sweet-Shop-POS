export type NavSection =
  | 'dashboard'
  | 'pos'
  | 'menus'
  | 'custom_orders'
  | 'stock'
  | 'inventory'
  | 'customers'
  | 'reports'
  | 'staff'
  | 'branches'
  | 'settings';

export type UnitType = 'piece' | 'weight' | 'volume' | 'box' | 'cake';

export type PreparationType = 'Made Fresh' | 'Pre-Cooked';

export const BULK_STOCK_VARIANT_ID = '__BULK__';

export type PaymentMethod = 'Cash' | 'UPI' | 'Card';

export type UserRole =
  | 'Owner'
  | 'Admin'
  | 'Manager'
  | 'Staff'
  | 'Inventory Staff';

export type EmploymentStatus = 'Active' | 'Inactive' | 'On Leave';

export type AccessAccountStatus = 'Active' | 'Invited' | 'Disabled';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve';

export interface ModulePermissionSet {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
}

export type RolePermissionsMap = Record<UserRole, Record<NavSection, ModulePermissionSet>>;

export type BranchStatus = 'Active' | 'Inactive';

export interface BranchOperationalSettings {
  taxRate: number;
  packagingFee: number;
  openingHours: string;
  receiptHeaderNote: string;
  receiptFooterNote: string;
}

export interface Branch {
  id: string;
  branchCode: string; // Unique readable Branch ID e.g. BR-PY-01
  name: string;
  phone: string;
  address: string;
  email?: string;
  managerId?: string;
  status: BranchStatus;
  notes?: string;
  createdAt: string;
  operationalSettings: BranchOperationalSettings;
}

export interface StaffUser {
  id: string;
  employeeCode: string; // Unique readable Employee ID e.g. EMP-101
  name: string;
  phone: string;
  role: UserRole;
  primaryBranchId: string;
  authorizedBranchIds: string[];
  joiningDate: string; // YYYY-MM-DD
  status: EmploymentStatus;
  address?: string;
  notes?: string;
  hasLoginAccess: boolean;
  accessStatus: AccessAccountStatus;
  mustResetPin?: boolean;
  lastCredentialUpdate?: string;
  pin: string; // Internal authentication PIN — never render in directory or detail screens
  branch?: string; // Legacy display compatibility
}

export interface BranchAssignmentLog {
  id: string;
  staffId: string;
  staffName: string;
  fromBranchId?: string;
  fromBranchName?: string;
  toBranchId: string;
  toBranchName: string;
  assignmentType: 'Primary' | 'Additional Access' | 'Revoked Access';
  changedBy: string;
  timestamp: string;
  notes?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

export interface ProductVariant {
  id: string;
  label: string;
  weightGrams?: number;
  price: number;
  skuSuffix: string;
  unitLabel?: string;
  minStockAlert?: number;
  isDefault?: boolean;
}

export type GstTreatment = 'Taxable' | 'Exempt' | 'Nil-Rated';

export type SupplyType = 'Intra-State' | 'Inter-State';

export type GstPaymentStatus = 'Pending' | 'Partially Paid' | 'Paid';

export interface GstPaymentRecord {
  id: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  branchId: string;
  branchName: string;
  outputGst: number;
  inputTaxCredit: number;
  adjustments: number;
  paidAmount: number;
  status: GstPaymentStatus;
  paymentDate?: string;
  referenceNumber?: string;
  notes?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  categoryId: string;
  subGroup: string;
  preparationType?: PreparationType;
  unitType: UnitType;
  baseUnitLabel: string;
  pricePerKg?: number;
  defaultWeightGrams?: number;
  allowCustomWeight?: boolean;
  isGroupStock?: boolean;
  bulkUnitLabel?: string;
  variants: ProductVariant[];
  taxRate: number;
  gstTreatment?: GstTreatment;
  imageUrl: string;
  isFavourite: boolean;
  isActive: boolean;
  isEggless?: boolean;
  minStockAlert: number;
  shelfLifeDays: number;
  batchExpiryDate?: string;
  trackExpiry: boolean;
}

export interface StockBatch {
  id: string;
  productId: string;
  variantId?: string;
  variantLabel?: string;
  batchCode: string;
  prepDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
  unitLabel: string;
  notes?: string;
  branchId?: string;
  branchName?: string;
  lastUpdated?: string;
}

export interface StockMovementLog {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantLabel?: string;
  batchCode: string;
  type:
    | 'Stock In'
    | 'Stock Out'
    | 'POS Sale'
    | 'Batch Added'
    | 'Manual Adjustment'
    | 'Wastage / Damage'
    | 'Bulk Split';
  delta: number;
  previousQty: number;
  newQty: number;
  unitLabel: string;
  reason: string;
  referenceNumber?: string;
  timestamp: string;
  performedBy: string;
  staffId?: string;
  branchId?: string;
  branchName?: string;
}

export interface WastageLog {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantLabel?: string;
  batchCode: string;
  quantity: number;
  unitLabel: string;
  estimatedValue: number;
  reason: 'Expired' | 'Damaged in Display' | 'Quality Reject' | 'Sample / Tasting';
  loggedAt: string;
  loggedBy: string;
  staffId?: string;
  branchId?: string;
  branchName?: string;
}

// Inventory Management (Store-Room Supplies, Raw Ingredients & Packaging)
export type InventoryCategory =
  | 'Dairy & Fats'
  | 'Chocolate & Nuts'
  | 'Flours & Sugars'
  | 'Packaging & Boxes'
  | 'Decorations & Toppings';

export type InventoryUnit = 'kg' | 'litre' | 'pcs' | 'packs';

export type InventoryItemStatus = 'Active' | 'Inactive';

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  sku: string;
  unit: InventoryUnit;
  quantity: number;
  minStockLevel: number;
  unitCost: number; // Purchase price ₹ per unit
  sellingPrice?: number; // Optional selling price ₹ per unit
  supplierId?: string;
  supplierName?: string;
  batchNumber?: string;
  storageLocation?: string;
  description?: string;
  status?: InventoryItemStatus;
  trackExpiry: boolean;
  expiryDate?: string; // YYYY-MM-DD
  lastUpdated: string;
  branchId?: string;
  branchName?: string;
}

export interface InventoryTransaction {
  id: string;
  itemId: string;
  itemName: string;
  type: 'Stock In' | 'Stock Out' | 'Adjustment';
  quantityDelta: number; // positive for Stock In, negative for Stock Out, +/- for Adjustment
  previousQty: number;
  updatedQty: number;
  unit: string;
  purchaseCost?: number;
  supplierId?: string;
  supplierName?: string;
  referenceNumber?: string;
  batchNumber?: string;
  storageLocation?: string;
  reason: string;
  notes?: string;
  attachmentName?: string;
  attachmentDataUrl?: string;
  expiryDate?: string;
  timestamp: string;
  performedBy: string;
  staffId?: string;
  branchId?: string;
  branchName?: string;
}

export interface PendingStockReceiptLine {
  itemId: string;
  itemName: string;
  unit: InventoryUnit;
  quantity: number;
  unitCost: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface PendingStockReceipt {
  id: string;
  referenceNumber: string;
  supplierId?: string;
  supplierName: string;
  expectedDate: string; // YYYY-MM-DD
  storageLocation?: string;
  notes?: string;
  attachmentName?: string;
  attachmentDataUrl?: string;
  lines: PendingStockReceiptLine[];
  createdAt: string;
  createdBy: string;
  branchId?: string;
  branchName?: string;
}

export interface CartItem {
  lineId: string;
  productId: string;
  productName: string;
  sku: string;
  imageUrl: string;
  unitType: UnitType;
  variantId: string;
  variantLabel: string;
  unitPrice: number;
  quantity: number;
  weightInGrams?: number;
  taxRate: number;
  gstTreatment?: GstTreatment;
  baseUnitDeduction: number;
  notes?: string;
}

export interface PaymentEntry {
  method: PaymentMethod;
  amount: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface CompletedOrder {
  id: string;
  billNumber: string;
  createdAt: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  items: CartItem[];
  subtotal: number;
  discountType: 'flat' | 'percent';
  discountValue: number;
  discountAmount: number;
  packagingCharge: number;
  taxAmount: number;
  grandTotal: number;
  payments: PaymentEntry[];
  cashierName: string;
  staffId?: string;
  branchId?: string;
  branchName?: string;
  supplyType?: SupplyType;
  status: 'Completed' | 'Refunded';
  customOrderId?: string;
}

export interface HeldOrder {
  id: string;
  ticketLabel: string;
  heldAt: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  items: CartItem[];
  discountType: 'flat' | 'percent';
  discountValue: number;
  packagingCharge: number;
  notes?: string;
  staffId?: string;
  branchId?: string;
  branchName?: string;
}

export type CustomOrderStatus =
  | 'Booked'
  | 'In Baking'
  | 'Ready for Pickup'
  | 'Handed Over'
  | 'Cancelled';

export interface CustomOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  productId?: string;
  itemTitle: string;
  weightOrSize: string;
  flavourOrDetails: string;
  isEggless: boolean;
  cakeInscription: string;
  designNotes: string;
  pickupDate: string;
  pickupTime: string;
  totalAmount: number;
  advancePaid: number;
  advanceMethod: PaymentMethod;
  balancePaid: number;
  status: CustomOrderStatus;
  staffId?: string;
  createdByName?: string;
  branchId?: string;
  branchName?: string;
}

export type BusinessCategory =
  | 'Bakery & Sweets'
  | 'Bakery & Cafe'
  | 'Mithai & Confectionery'
  | 'Patisserie & Cake Shop'
  | 'Restaurant & Dining'
  | 'Fast Food & QSR'
  | 'Cloud Kitchen'
  | 'Other';

export type ReceiptPaperSize = '2inch' | '3inch';

export type PrinterConnectionStatus = 'Connected' | 'Disconnected';

export interface StoreSettings {
  businessName: string;
  branchName: string;
  address: string;
  phone: string;
  mobileNumber?: string;
  businessLogoUrl?: string;
  defaultScreen?: NavSection;
  businessCategory?: BusinessCategory;
  gstin: string;
  fssaiNumber: string;
  defaultTaxRate: number;
  defaultPackagingFee: number;
  receiptHeaderNote: string;
  receiptFooterNote: string;
  showGstOnReceipt: boolean;
  showFssaiOnReceipt: boolean;
  showCustomerPhoneOnReceipt: boolean;
  receiptPaperSize?: ReceiptPaperSize;
  printerStatus?: PrinterConnectionStatus;
  printerName?: string;
  printerConnectionType?: string;
  printerDetails?: string;
  enableSplitPayment: boolean;
  acceptedPaymentMethods: PaymentMethod[];
  lowStockThresholdDefault: number;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  category:
    | 'low_stock'
    | 'out_of_stock'
    | 'expiry'
    | 'custom_order'
    | 'order_update'
    | 'inventory'
    | 'staff_branch';
  severity: 'info' | 'warning' | 'critical';
  targetNav: NavSection;
  createdAt: string;
  read: boolean;
}
