import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AccessAccountStatus,
  AppNotification,
  Branch,
  BranchAssignmentLog,
  BranchOperationalSettings,
  BranchStatus,
  BULK_STOCK_VARIANT_ID,
  CartItem,
  Category,
  CompletedOrder,
  CustomOrder,
  CustomOrderStatus,
  Customer,
  EmploymentStatus,
  GstPaymentRecord,
  HeldOrder,
  InventoryItem,
  InventoryTransaction,
  ModulePermissionSet,
  NavSection,
  PaymentEntry,
  PaymentMethod,
  PendingStockReceipt,
  PendingStockReceiptLine,
  PermissionAction,
  PreparationType,
  Product,
  ProductVariant,
  RolePermissionsMap,
  StaffUser,
  StockBatch,
  StockMovementLog,
  StoreSettings,
  Supplier,
  UserRole,
  WastageLog,
} from '../types/pos';
import {
  INITIAL_BRANCHES,
  INITIAL_BRANCH_ASSIGNMENTS,
  INITIAL_CATEGORIES,
  INITIAL_CUSTOMERS,
  INITIAL_CUSTOM_ORDERS,
  INITIAL_GST_PAYMENT_RECORDS,
  INITIAL_HELD_ORDERS,
  INITIAL_INVENTORY_ITEMS,
  INITIAL_INVENTORY_TXNS,
  INITIAL_ORDERS,
  INITIAL_PENDING_RECEIPTS,
  INITIAL_PRODUCTS,
  INITIAL_ROLE_PERMISSIONS,
  INITIAL_SETTINGS,
  INITIAL_STAFF,
  INITIAL_STOCK_BATCHES,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_SUPPLIERS,
  INITIAL_WASTAGE,
} from '../data/seedData';
import {
  computeOrderFinancials,
  daysUntil,
  formatStockQty,
  getBulkConversionFactor,
  roundCurrency,
  roundQty,
  TODAY_ISO,
} from '../utils/formatters';

interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'error';
  message: string;
}

interface PosContextValue {
  // Navigation & Auth
  activeNav: NavSection;
  setActiveNav: (nav: NavSection) => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  currentUser: StaffUser | null;
  staffUsers: StaffUser[];
  loginUser: (staffId: string, pin: string) => { ok: boolean; error?: string };
  logoutUser: () => void;
  switchUser: (staffId: string) => void;

  // RBAC Permissions
  rolePermissions: RolePermissionsMap;
  hasPermission: (module: NavSection, action?: PermissionAction) => boolean;
  updateRolePermission: (
    role: UserRole,
    module: NavSection,
    action: PermissionAction,
    allowed: boolean
  ) => void;

  // Branch Context & Management
  branches: Branch[];
  activeBranchId: string;
  activeBranch: Branch;
  authorizedBranches: Branch[];
  canViewAllBranches: boolean;
  setActiveBranchId: (branchId: string) => void;
  addBranch: (input: {
    branchCode: string;
    name: string;
    phone: string;
    address: string;
    email?: string;
    managerId?: string;
    status: BranchStatus;
    notes?: string;
    operationalSettings?: Partial<BranchOperationalSettings>;
  }) => { ok: boolean; error?: string; branch?: Branch };
  updateBranch: (branch: Branch) => { ok: boolean; error?: string };
  changeBranchStatus: (branchId: string, status: BranchStatus) => void;
  assignBranchManager: (branchId: string, managerId?: string) => void;
  updateBranchOperationalSettings: (
    branchId: string,
    operationalSettings: BranchOperationalSettings
  ) => void;

  // Staff Management & Assignments
  branchAssignments: BranchAssignmentLog[];
  addStaffMember: (input: {
    employeeCode: string;
    name: string;
    phone: string;
    role: UserRole;
    primaryBranchId: string;
    authorizedBranchIds: string[];
    joiningDate: string;
    status: EmploymentStatus;
    address?: string;
    notes?: string;
    hasLoginAccess: boolean;
    initialPin?: string;
  }) => { ok: boolean; error?: string; staff?: StaffUser };
  updateStaffMember: (input: {
    id: string;
    employeeCode: string;
    name: string;
    phone: string;
    role: UserRole;
    primaryBranchId: string;
    authorizedBranchIds: string[];
    joiningDate: string;
    status: EmploymentStatus;
    address?: string;
    notes?: string;
  }) => { ok: boolean; error?: string };
  changeStaffStatus: (staffId: string, status: EmploymentStatus) => boolean;
  assignStaffBranch: (params: {
    staffId: string;
    primaryBranchId: string;
    authorizedBranchIds: string[];
    notes?: string;
  }) => boolean;
  toggleStaffLoginAccess: (staffId: string, enabled: boolean) => boolean;
  resetStaffCredentials: (params: {
    staffId: string;
    newPin: string;
    accessStatus?: AccessAccountStatus;
    mustResetPin?: boolean;
  }) => { ok: boolean; error?: string };

  // Domain Data
  settings: StoreSettings;
  updateSettings: (next: StoreSettings) => void;
  categories: Category[];
  addCategory: (name: string, description: string) => void;
  deleteCategory: (categoryId: string) => { ok: boolean; error?: string };
  products: Product[];
  addProduct: (
    product: Omit<Product, 'id'>,
    stockSetup?: { bulkStockQty?: number; variantStockQtys?: Record<string, number> }
  ) => void;
  updateProduct: (
    product: Product,
    stockSetup?: { bulkStockQty?: number; variantStockQtys?: Record<string, number> }
  ) => void;
  deleteProduct: (id: string) => void;
  toggleProductActive: (id: string) => void;
  toggleProductFavourite: (id: string) => void;

  // Counter Stock & Batches (Variant-Level + Group Bulk Pool)
  batches: StockBatch[];
  stockMovements: StockMovementLog[];
  wastageLogs: WastageLog[];
  getPreparationType: (product: Product) => PreparationType;
  getGroupBulkStock: (productId: string, branchIdOverride?: string) => number;
  getProductDefaultVariant: (product: Product) => ProductVariant | undefined;
  getVariantUnitLabel: (product: Product, variant?: ProductVariant) => string;
  getVariantMinStock: (product: Product, variant?: ProductVariant) => number;
  getVariantStock: (productId: string, variantId: string, branchIdOverride?: string) => number;
  getVariantEarliestExpiry: (
    productId: string,
    variantId: string,
    branchIdOverride?: string
  ) => string | null;
  getVariantLastUpdated: (
    productId: string,
    variantId: string,
    branchIdOverride?: string
  ) => string | null;
  getProductStock: (productId: string, branchIdOverride?: string) => number;
  getProductEarliestExpiry: (productId: string, branchIdOverride?: string) => string | null;
  splitGroupStock: (params: {
    productId: string;
    date?: string;
    referenceNumber?: string;
    notes?: string;
    allocations: {
      variantId: string;
      quantity: number;
      bulkPerUnit?: number;
    }[];
  }) => { ok: boolean; error?: string };
  addStockBatch: (batch: Omit<StockBatch, 'id'>) => void;
  adjustBatchQuantity: (batchId: string, newQty: number, reason?: string) => void;
  updateVariantMinStock: (productId: string, variantId: string, minStock: number) => void;
  logWastage: (params: {
    batchId: string;
    quantity: number;
    reason: WastageLog['reason'];
  }) => void;
  recordMultiStockIn: (params: {
    referenceNumber?: string;
    receivedDate: string;
    notes?: string;
    lines: {
      productId: string;
      variantId?: string;
      batchCode: string;
      quantity: number;
      prepDate: string;
      expiryDate: string;
    }[];
  }) => boolean;
  recordMultiVariantStockUpdate: (params: {
    mode: 'stock_in' | 'stock_out' | 'adjust';
    productId: string;
    date: string;
    referenceNumber?: string;
    reason: string;
    notes?: string;
    prepDate?: string;
    expiryDate?: string;
    entries: {
      variantId: string;
      quantity: number;
      minStockAlert?: number;
    }[];
  }) => { ok: boolean; error?: string };
  recordProductStockOut: (params: {
    productId: string;
    variantId?: string;
    batchId?: string;
    quantity: number;
    reason: string;
    referenceNumber?: string;
    date?: string;
    notes?: string;
  }) => boolean;
  recordProductStockAdjustment: (params: {
    productId: string;
    variantId?: string;
    batchId?: string;
    newQuantity: number;
    reason: string;
    date?: string;
    notes?: string;
  }) => boolean;
  lowStockProducts: Product[];
  expiringSoonBatches: (StockBatch & { productName: string; daysLeft: number })[];

  // Inventory Management (Store-Room, Supplies & Suppliers)
  inventoryItems: InventoryItem[];
  inventoryTxns: InventoryTransaction[];
  suppliers: Supplier[];
  pendingReceipts: PendingStockReceipt[];
  addSupplier: (supplier: Omit<Supplier, 'id' | 'createdAt'>) => Supplier;
  updateSupplier: (supplier: Supplier) => void;
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => InventoryItem;
  updateInventoryItem: (item: InventoryItem) => void;
  recordStockIn: (params: {
    itemId: string;
    quantity: number;
    purchaseCost?: number;
    supplierId?: string;
    supplierName?: string;
    referenceNumber?: string;
    batchNumber?: string;
    storageLocation?: string;
    expiryDate?: string;
    reason?: string;
    notes?: string;
  }) => void;
  recordBatchStockIn: (params: {
    supplierId?: string;
    supplierName: string;
    invoiceNumber?: string;
    receivedDate: string;
    storageLocation?: string;
    notes?: string;
    attachmentName?: string;
    attachmentDataUrl?: string;
    pendingReceiptId?: string;
    lines: {
      itemId: string;
      quantity: number;
      unitCost: number;
      batchNumber?: string;
      expiryDate?: string;
    }[];
  }) => boolean;
  savePendingReceipt: (params: {
    supplierId?: string;
    supplierName: string;
    referenceNumber?: string;
    expectedDate: string;
    storageLocation?: string;
    notes?: string;
    attachmentName?: string;
    attachmentDataUrl?: string;
    lines: PendingStockReceiptLine[];
  }) => PendingStockReceipt;
  confirmPendingReceipt: (receiptId: string) => boolean;
  cancelPendingReceipt: (receiptId: string) => void;
  recordStockOut: (params: {
    itemId: string;
    quantity: number;
    reason: string;
    referenceNumber?: string;
    date?: string;
    notes?: string;
  }) => boolean;
  recordInventoryAdjustment: (params: {
    itemId: string;
    newQuantity: number;
    reason: string;
    date?: string;
    notes?: string;
  }) => boolean;

  // Cart & POS Billing
  cart: CartItem[];
  cartCustomerName: string;
  setCartCustomerName: (name: string) => void;
  cartCustomerPhone: string;
  setCartCustomerPhone: (phone: string) => void;
  cartCustomerId?: string;
  selectCartCustomer: (customer: Customer | null) => void;
  discountType: 'flat' | 'percent';
  setDiscountType: (t: 'flat' | 'percent') => void;
  discountValue: number;
  setDiscountValue: (v: number) => void;
  packagingCharge: number;
  setPackagingCharge: (v: number) => void;
  addToCart: (item: Omit<CartItem, 'lineId'>) => void;
  updateCartQty: (lineId: string, delta: number) => void;
  removeCartItem: (lineId: string) => void;
  clearCart: () => void;
  cartTotals: {
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    grandTotal: number;
  };

  // Orders & Held Bills
  orders: CompletedOrder[];
  heldOrders: HeldOrder[];
  completeSale: (params: { payments: PaymentEntry[] }) => CompletedOrder | null;
  holdCurrentOrder: (notes?: string) => void;
  resumeHeldOrder: (heldId: string) => void;
  deleteHeldOrder: (heldId: string) => void;
  refundOrder: (orderId: string) => void;

  // Custom Orders
  customOrders: CustomOrder[];
  createCustomOrder: (order: Omit<CustomOrder, 'id' | 'orderNumber' | 'createdAt'>) => CustomOrder;
  updateCustomOrderStatus: (id: string, status: CustomOrderStatus) => void;
  collectCustomOrderBalance: (id: string, method: PaymentMethod) => CompletedOrder | null;

  // Customers
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Customer;
  updateCustomer: (customer: Customer) => void;

  // Tax & GST Payment / ITC Records
  gstPaymentRecords: GstPaymentRecord[];
  addGstPaymentRecord: (
    record: Omit<GstPaymentRecord, 'id' | 'updatedAt' | 'updatedBy'>
  ) => GstPaymentRecord | null;
  updateGstPaymentRecord: (record: GstPaymentRecord) => boolean;

  // Notifications
  notifications: AppNotification[];
  unreadCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Receipt Modal & Toasts
  activeReceipt: CompletedOrder | null;
  setActiveReceipt: (order: CompletedOrder | null) => void;
  toasts: ToastMessage[];
  pushToast: (message: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
  resetDemoData: () => void;
}

const STORAGE_KEY = 'bakecore_pos_state_v4';

interface PersistedState {
  settings: StoreSettings;
  branches: Branch[];
  activeBranchId: string;
  staffUsers: StaffUser[];
  rolePermissions: RolePermissionsMap;
  branchAssignments: BranchAssignmentLog[];
  categories: Category[];
  products: Product[];
  batches: StockBatch[];
  stockMovements: StockMovementLog[];
  wastageLogs: WastageLog[];
  inventoryItems: InventoryItem[];
  inventoryTxns: InventoryTransaction[];
  suppliers: Supplier[];
  pendingReceipts: PendingStockReceipt[];
  customers: Customer[];
  orders: CompletedOrder[];
  heldOrders: HeldOrder[];
  customOrders: CustomOrder[];
  gstPaymentRecords: GstPaymentRecord[];
  eventNotifications: AppNotification[];
  readAlertIds: string[];
}

function normalizeRole(rawRole: string): UserRole {
  if (rawRole === 'Store Manager') return 'Owner';
  if (
    rawRole === 'Counter Cashier' ||
    rawRole === 'Cashier' ||
    rawRole === 'Sales' ||
    rawRole === 'Sales Staff'
  ) {
    return 'Staff';
  }
  const valid: UserRole[] = ['Owner', 'Admin', 'Manager', 'Staff', 'Inventory Staff'];
  return valid.includes(rawRole as UserRole) ? (rawRole as UserRole) : 'Staff';
}

function migrateStaffList(rawStaff?: Partial<StaffUser>[]): StaffUser[] {
  if (!rawStaff || rawStaff.length === 0) return INITIAL_STAFF;
  const seenIds = new Set<string>();
  const seenCodes = new Set<string>();
  const migrated: StaffUser[] = [];

  rawStaff.forEach((s, idx) => {
    const id = s.id || `staff-mig-${idx}`;
    const employeeCode = s.employeeCode || `EMP-${101 + idx}`;
    const codeKey = employeeCode.trim().toUpperCase();
    if (seenIds.has(id) || seenCodes.has(codeKey)) return;
    seenIds.add(id);
    seenCodes.add(codeKey);

    const role = normalizeRole(String(s.role ?? 'Staff'));
    const primaryBranchId = s.primaryBranchId || 'br-1';
    const authorizedBranchIds =
      s.authorizedBranchIds && s.authorizedBranchIds.length > 0
        ? Array.from(new Set([primaryBranchId, ...s.authorizedBranchIds]))
        : [primaryBranchId];
    migrated.push({
      id,
      employeeCode,
      name: s.name || 'Staff Member',
      phone: s.phone || '+91 98000 00000',
      role,
      primaryBranchId,
      authorizedBranchIds,
      joiningDate: s.joiningDate || '2025-01-01',
      status: s.status || 'Active',
      address: s.address,
      notes: s.notes,
      hasLoginAccess: s.hasLoginAccess ?? (s.status || 'Active') === 'Active',
      accessStatus: s.accessStatus ?? ((s.status || 'Active') === 'Active' ? 'Active' : 'Disabled'),
      mustResetPin: s.mustResetPin ?? false,
      lastCredentialUpdate: s.lastCredentialUpdate,
      pin: s.pin || '1234',
      branch: s.branch,
    });
  });

  return migrated.length > 0 ? migrated : INITIAL_STAFF;
}

function mergeRolePermissions(
  parsed?: Partial<RolePermissionsMap> & Record<string, Record<NavSection, ModulePermissionSet> | undefined>
): RolePermissionsMap {
  const result = { ...INITIAL_ROLE_PERMISSIONS };
  if (!parsed) return result;
  (Object.keys(INITIAL_ROLE_PERMISSIONS) as UserRole[]).forEach((role) => {
    if (parsed[role]) {
      result[role] = {
        ...INITIAL_ROLE_PERMISSIONS[role],
        ...parsed[role],
      };
    }
  });

  // Migrate legacy Cashier and Sales Staff permissions into unified Staff role if Staff was not yet persisted
  const legacyCashier = parsed['Cashier'];
  const legacySales = parsed['Sales Staff'];
  if (!parsed['Staff'] && (legacyCashier || legacySales)) {
    const mergedStaff = { ...INITIAL_ROLE_PERMISSIONS.Staff };
    (Object.keys(mergedStaff) as NavSection[]).forEach((mod) => {
      const base = INITIAL_ROLE_PERMISSIONS.Staff[mod];
      const c = legacyCashier?.[mod];
      const s = legacySales?.[mod];
      mergedStaff[mod] = {
        view: Boolean(base.view || c?.view || s?.view),
        create: Boolean(base.create || c?.create || s?.create),
        edit: Boolean(base.edit || c?.edit || s?.edit),
        delete: Boolean(base.delete || c?.delete || s?.delete),
        approve: Boolean(base.approve || c?.approve || s?.approve),
      };
    });
    result.Staff = mergedStaff;
  }

  return result;
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed.products && parsed.categories && parsed.settings) {
        const branches = parsed.branches && parsed.branches.length > 0 ? parsed.branches : INITIAL_BRANCHES;
        const staffUsers = migrateStaffList(parsed.staffUsers);
        return {
          settings: {
            ...INITIAL_SETTINGS,
            ...parsed.settings,
          },
          branches,
          activeBranchId:
            parsed.activeBranchId && branches.some((b) => b.id === parsed.activeBranchId)
              ? parsed.activeBranchId
              : branches[0].id,
          staffUsers,
          rolePermissions: mergeRolePermissions(parsed.rolePermissions),
          branchAssignments: parsed.branchAssignments ?? INITIAL_BRANCH_ASSIGNMENTS,
          categories: parsed.categories,
          products: (() => {
            const existingIds = new Set(parsed.products.map((p) => p.id));
            const migrated: Product[] = parsed.products.map((p) => {
              const seedMatch = INITIAL_PRODUCTS.find((sp) => sp.id === p.id);
              const nextWeightGrams =
                p.unitType === 'weight' && !p.defaultWeightGrams
                  ? seedMatch?.defaultWeightGrams ??
                    p.variants.find((v) => v.weightGrams)?.weightGrams ??
                    500
                  : p.defaultWeightGrams;
              const nextVariants: ProductVariant[] = p.variants.map((v, vIdx) => {
                const seedVar = seedMatch?.variants.find((sv) => sv.id === v.id);
                return {
                  ...v,
                  unitLabel:
                    v.unitLabel ??
                    seedVar?.unitLabel ??
                    (p.unitType === 'weight' ? 'pcs' : p.baseUnitLabel),
                  minStockAlert: v.minStockAlert ?? seedVar?.minStockAlert,
                  isDefault:
                    v.isDefault ??
                    seedVar?.isDefault ??
                    (p.variants.some((x) => x.isDefault)
                      ? false
                      : p.unitType === 'weight' && nextWeightGrams
                      ? v.weightGrams === nextWeightGrams
                      : vIdx === 0),
                };
              });
              return {
                ...p,
                preparationType: p.preparationType ?? seedMatch?.preparationType ?? 'Pre-Cooked',
                isGroupStock: p.isGroupStock ?? seedMatch?.isGroupStock ?? false,
                bulkUnitLabel: p.bulkUnitLabel ?? seedMatch?.bulkUnitLabel,
                defaultWeightGrams: nextWeightGrams,
                allowCustomWeight:
                  p.unitType === 'weight'
                    ? p.allowCustomWeight ?? seedMatch?.allowCustomWeight ?? true
                    : p.allowCustomWeight,
                variants: nextVariants,
              };
            });
            // Include Coca-Cola seed product if upgrading pre-beverage storage
            const cocaColaSeed = INITIAL_PRODUCTS.find((sp) => sp.id === 'prod-11');
            if (cocaColaSeed && !existingIds.has('prod-11') && parsed.products.some((p) => p.id === 'prod-10')) {
              migrated.push(cocaColaSeed);
            }
            // Include Special Madras Mixture seed product if upgrading pre-group-stock storage
            const mixtureSeed = INITIAL_PRODUCTS.find((sp) => sp.id === 'prod-12');
            if (mixtureSeed && !existingIds.has('prod-12') && parsed.products.some((p) => p.id === 'prod-10')) {
              migrated.push(mixtureSeed);
            }
            return migrated;
          })(),
          batches: (() => {
            const rawBatches = parsed.batches ?? INITIAL_STOCK_BATCHES;
            const hasAnyVariantTag = rawBatches.some((b) => Boolean(b.variantId));
            if (!hasAnyVariantTag) {
              return INITIAL_STOCK_BATCHES.map((b) => ({
                ...b,
                branchId: b.branchId ?? 'br-1',
                branchName: b.branchName ?? 'Kirumambakkam Branch',
              }));
            }
            const nextBatches: StockBatch[] = rawBatches.map((b) => {
              if (b.variantId === BULK_STOCK_VARIANT_ID) {
                return {
                  ...b,
                  branchId: b.branchId ?? 'br-1',
                  branchName: b.branchName ?? 'Kirumambakkam Branch',
                };
              }
              const prod = parsed.products!.find((p) => p.id === b.productId);
              const defVar =
                prod?.variants.find((v) => v.isDefault) ?? prod?.variants[0];
              return {
                ...b,
                variantId: b.variantId ?? defVar?.id,
                variantLabel: b.variantLabel ?? defVar?.label,
                branchId: b.branchId ?? 'br-1',
                branchName: b.branchName ?? 'Kirumambakkam Branch',
              };
            });
            // Seed Coca-Cola batches if upgrading pre-beverage storage
            if (!rawBatches.some((b) => b.productId === 'prod-11')) {
              INITIAL_STOCK_BATCHES.filter((b) => b.productId === 'prod-11').forEach((b) => {
                nextBatches.push({
                  ...b,
                  branchId: b.branchId ?? 'br-1',
                  branchName: b.branchName ?? 'Kirumambakkam Branch',
                });
              });
            }
            // Seed Special Madras Mixture bulk batches if upgrading pre-group-stock storage
            if (!rawBatches.some((b) => b.productId === 'prod-12')) {
              INITIAL_STOCK_BATCHES.filter((b) => b.productId === 'prod-12').forEach((b) => {
                nextBatches.push({
                  ...b,
                  branchId: b.branchId ?? 'br-1',
                  branchName: b.branchName ?? 'Kirumambakkam Branch',
                });
              });
            }
            return nextBatches;
          })(),
          stockMovements: (parsed.stockMovements ?? INITIAL_STOCK_MOVEMENTS).map((m) => ({
            ...m,
            branchId: m.branchId ?? 'br-1',
            branchName: m.branchName ?? 'Kirumambakkam Branch',
          })),
          wastageLogs: (parsed.wastageLogs ?? INITIAL_WASTAGE).map((w) => ({
            ...w,
            branchId: w.branchId ?? 'br-1',
            branchName: w.branchName ?? 'Kirumambakkam Branch',
          })),
          inventoryItems: (parsed.inventoryItems ?? INITIAL_INVENTORY_ITEMS).map((i) => ({
            ...i,
            branchId: i.branchId ?? 'br-1',
            branchName: i.branchName ?? 'Kirumambakkam Branch',
          })),
          inventoryTxns: (parsed.inventoryTxns ?? INITIAL_INVENTORY_TXNS).map((t) => ({
            ...t,
            branchId: t.branchId ?? 'br-1',
            branchName: t.branchName ?? 'Kirumambakkam Branch',
          })),
          suppliers: parsed.suppliers ?? INITIAL_SUPPLIERS,
          pendingReceipts: (parsed.pendingReceipts ?? INITIAL_PENDING_RECEIPTS).map((p) => ({
            ...p,
            branchId: p.branchId ?? 'br-1',
            branchName: p.branchName ?? 'Kirumambakkam Branch',
          })),
          customers: (parsed.customers ?? INITIAL_CUSTOMERS).map((c) => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            avatarUrl: c.avatarUrl,
            notes: c.notes,
            createdAt: c.createdAt,
          })),
          orders: (() => {
            const existingOrders = (parsed.orders ?? INITIAL_ORDERS).map((o) => ({
              ...o,
              branchId: o.branchId ?? 'br-1',
              branchName: o.branchName ?? 'Kirumambakkam Branch',
            }));
            const existingIds = new Set(existingOrders.map((o) => o.id));
            if (existingIds.has('ord-101') && !existingIds.has('ord-107')) {
              return [
                ...existingOrders,
                ...INITIAL_ORDERS.filter((seedOrder) => !existingIds.has(seedOrder.id)),
              ];
            }
            return existingOrders;
          })(),
          heldOrders: (parsed.heldOrders ?? INITIAL_HELD_ORDERS).map((h) => ({
            ...h,
            branchId: h.branchId ?? 'br-1',
            branchName: h.branchName ?? 'Kirumambakkam Branch',
          })),
          customOrders: (parsed.customOrders ?? INITIAL_CUSTOM_ORDERS).map((co) => ({
            ...co,
            branchId: co.branchId ?? 'br-1',
            branchName: co.branchName ?? 'Kirumambakkam Branch',
          })),
          gstPaymentRecords: parsed.gstPaymentRecords ?? INITIAL_GST_PAYMENT_RECORDS,
          eventNotifications: parsed.eventNotifications ?? [],
          readAlertIds: parsed.readAlertIds ?? [],
        };
      }
    }
  } catch {
    // Fallback to initial seed
  }
  return {
    settings: INITIAL_SETTINGS,
    branches: INITIAL_BRANCHES,
    activeBranchId: INITIAL_BRANCHES[0].id,
    staffUsers: INITIAL_STAFF,
    rolePermissions: INITIAL_ROLE_PERMISSIONS,
    branchAssignments: INITIAL_BRANCH_ASSIGNMENTS,
    categories: INITIAL_CATEGORIES,
    products: INITIAL_PRODUCTS,
    batches: INITIAL_STOCK_BATCHES,
    stockMovements: INITIAL_STOCK_MOVEMENTS,
    wastageLogs: INITIAL_WASTAGE,
    inventoryItems: INITIAL_INVENTORY_ITEMS,
    inventoryTxns: INITIAL_INVENTORY_TXNS,
    suppliers: INITIAL_SUPPLIERS,
    pendingReceipts: INITIAL_PENDING_RECEIPTS,
    customers: INITIAL_CUSTOMERS,
    orders: INITIAL_ORDERS,
    heldOrders: INITIAL_HELD_ORDERS,
    customOrders: INITIAL_CUSTOM_ORDERS,
    gstPaymentRecords: INITIAL_GST_PAYMENT_RECORDS,
    eventNotifications: [],
    readAlertIds: [],
  };
}

const PosContext = createContext<PosContextValue | undefined>(undefined);

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = useMemo(() => loadInitialState(), []);

  const [activeNav, setActiveNavState] = useState<NavSection>(() => {
    const initialUser =
      initial.staffUsers.find((s) => s.status === 'Active' && s.hasLoginAccess) ??
      initial.staffUsers[0];
    const preferred = initial.settings.defaultScreen ?? 'dashboard';
    if (initialUser && initial.rolePermissions[initialUser.role]?.[preferred]?.view) {
      return preferred;
    }
    return 'dashboard';
  });
  const [globalSearch, setGlobalSearch] = useState('');
  const [branches, setBranches] = useState<Branch[]>(initial.branches);
  const [activeBranchId, setActiveBranchIdState] = useState<string>(initial.activeBranchId);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>(initial.staffUsers);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsMap>(
    initial.rolePermissions
  );
  const [branchAssignments, setBranchAssignments] = useState<BranchAssignmentLog[]>(
    initial.branchAssignments
  );
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(
    initial.staffUsers.find((s) => s.status === 'Active' && s.hasLoginAccess) ?? initial.staffUsers[0]
  );

  const [settings, setSettings] = useState<StoreSettings>(initial.settings);
  const [categories, setCategories] = useState<Category[]>(initial.categories);
  const [products, setProducts] = useState<Product[]>(initial.products);
  const [batches, setBatches] = useState<StockBatch[]>(initial.batches);
  const [stockMovements, setStockMovements] = useState<StockMovementLog[]>(initial.stockMovements);
  const [wastageLogs, setWastageLogs] = useState<WastageLog[]>(initial.wastageLogs);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(initial.inventoryItems);
  const [inventoryTxns, setInventoryTxns] = useState<InventoryTransaction[]>(initial.inventoryTxns);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initial.suppliers);
  const [pendingReceipts, setPendingReceipts] = useState<PendingStockReceipt[]>(
    initial.pendingReceipts
  );
  const [customers, setCustomers] = useState<Customer[]>(initial.customers);
  const [orders, setOrders] = useState<CompletedOrder[]>(initial.orders);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>(initial.heldOrders);
  const [customOrders, setCustomOrders] = useState<CustomOrder[]>(initial.customOrders);
  const [gstPaymentRecords, setGstPaymentRecords] = useState<GstPaymentRecord[]>(
    initial.gstPaymentRecords
  );

  const [eventNotifications, setEventNotifications] = useState<AppNotification[]>(
    initial.eventNotifications
  );
  const [readAlertIds, setReadAlertIds] = useState<string[]>(initial.readAlertIds);

  // Active POS Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartCustomerName, setCartCustomerName] = useState('');
  const [cartCustomerPhone, setCartCustomerPhone] = useState('');
  const [cartCustomerId, setCartCustomerId] = useState<string | undefined>(undefined);
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [packagingCharge, setPackagingCharge] = useState<number>(0);

  const [activeReceipt, setActiveReceipt] = useState<CompletedOrder | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    try {
      const payload: PersistedState = {
        settings,
        branches,
        activeBranchId,
        staffUsers,
        rolePermissions,
        branchAssignments,
        categories,
        products,
        batches,
        stockMovements,
        wastageLogs,
        inventoryItems,
        inventoryTxns,
        suppliers,
        pendingReceipts,
        customers,
        orders,
        heldOrders,
        customOrders,
        gstPaymentRecords,
        eventNotifications,
        readAlertIds,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    settings,
    branches,
    activeBranchId,
    staffUsers,
    rolePermissions,
    branchAssignments,
    categories,
    products,
    batches,
    stockMovements,
    wastageLogs,
    inventoryItems,
    inventoryTxns,
    suppliers,
    pendingReceipts,
    customers,
    orders,
    heldOrders,
    customOrders,
    gstPaymentRecords,
    eventNotifications,
    readAlertIds,
  ]);

  const pushToast = (message: string, type: ToastMessage['type'] = 'success') => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const pushEventNotification = (
    notif: Omit<AppNotification, 'id' | 'createdAt' | 'read'>
  ) => {
    const entry: AppNotification = {
      ...notif,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setEventNotifications((prev) => [entry, ...prev].slice(0, 30));
  };

  // RBAC Helpers
  const canRolePerform = (
    role: UserRole | undefined,
    module: NavSection,
    action: PermissionAction = 'view'
  ): boolean => {
    if (!role) return false;
    const modPerms = rolePermissions[role]?.[module];
    if (!modPerms) return false;
    if (action !== 'view' && !modPerms.view) return false;
    return Boolean(modPerms[action]);
  };

  const hasPermission = (module: NavSection, action: PermissionAction = 'view'): boolean => {
    return canRolePerform(currentUser?.role, module, action);
  };

  const setActiveNav = (nav: NavSection) => {
    if (currentUser && !canRolePerform(currentUser.role, nav, 'view')) {
      pushToast(`Your role (${currentUser.role}) does not have access to this module.`, 'warning');
      return;
    }
    setActiveNavState(nav);
  };

  const updateRolePermission = (
    role: UserRole,
    module: NavSection,
    action: PermissionAction,
    allowed: boolean
  ) => {
    if (!hasPermission('staff', 'edit')) {
      pushToast('You do not have permission to modify role permissions.', 'error');
      return;
    }
    if (
      role === 'Owner' &&
      (module === 'staff' || module === 'settings' || module === 'branches') &&
      (action === 'view' || action === 'edit') &&
      !allowed
    ) {
      pushToast('Owner core administration access cannot be disabled.', 'warning');
      return;
    }

    setRolePermissions((prev) => {
      const currentMod = prev[role][module];
      const nextMod = { ...currentMod, [action]: allowed };
      if (action === 'view' && !allowed) {
        nextMod.create = false;
        nextMod.edit = false;
        nextMod.delete = false;
        nextMod.approve = false;
      } else if (action !== 'view' && allowed) {
        nextMod.view = true;
      }
      return {
        ...prev,
        [role]: {
          ...prev[role],
          [module]: nextMod,
        },
      };
    });
    pushToast(`Updated ${role} permissions.`);
  };

  // Branch Access Helpers
  const canViewAllBranches = useMemo(
    () => currentUser?.role === 'Owner' || currentUser?.role === 'Admin',
    [currentUser]
  );

  const authorizedBranches = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Owner' || currentUser.role === 'Admin') {
      return branches;
    }
    return branches.filter((b) => currentUser.authorizedBranchIds.includes(b.id));
  }, [branches, currentUser]);

  const activeBranch = useMemo(() => {
    return (
      branches.find((b) => b.id === activeBranchId) ??
      authorizedBranches[0] ??
      branches[0]
    );
  }, [branches, activeBranchId, authorizedBranches]);

  const setActiveBranchId = (branchId: string) => {
    const target = branches.find((b) => b.id === branchId);
    if (!target) return;
    if (
      !canViewAllBranches &&
      currentUser &&
      !currentUser.authorizedBranchIds.includes(branchId)
    ) {
      pushToast(`You are not authorized to switch to ${target.name}.`, 'error');
      return;
    }
    if (cart.length > 0 && branchId !== activeBranchId) {
      clearCart();
    }
    setActiveBranchIdState(branchId);
    pushToast(`Active branch switched to ${target.name}.`);
  };

  // Auth & Staff Switcher
  const loginUser = (staffId: string, pin: string): { ok: boolean; error?: string } => {
    const found = staffUsers.find((s) => s.id === staffId);
    if (!found) {
      const msg = 'Selected employee account was not found.';
      pushToast(msg, 'error');
      return { ok: false, error: msg };
    }
    if (found.status !== 'Active') {
      const msg = `Sign-in blocked: ${found.name} is currently marked as ${found.status}.`;
      pushToast(msg, 'error');
      return { ok: false, error: msg };
    }
    if (!found.hasLoginAccess || found.accessStatus === 'Disabled') {
      const msg = `Terminal login access is disabled for ${found.name}. Contact Admin/Owner.`;
      pushToast(msg, 'error');
      return { ok: false, error: msg };
    }
    if (found.pin !== pin) {
      const msg = 'Incorrect terminal PIN. Please try again.';
      pushToast(msg, 'error');
      return { ok: false, error: msg };
    }

    setCurrentUser(found);
    const defaultBranchId =
      branches.find((b) => b.id === found.primaryBranchId)?.id ??
      branches.find((b) => found.authorizedBranchIds.includes(b.id))?.id ??
      branches[0]?.id;
    if (defaultBranchId) setActiveBranchIdState(defaultBranchId);

    const navOrder: NavSection[] = [
      'dashboard',
      'pos',
      'menus',
      'custom_orders',
      'stock',
      'inventory',
      'customers',
      'reports',
      'staff',
      'branches',
      'settings',
    ];
    const preferredScreen = settings.defaultScreen ?? 'dashboard';
    if (canRolePerform(found.role, preferredScreen, 'view')) {
      setActiveNavState(preferredScreen);
    } else {
      const firstAllowed =
        navOrder.find((n) => canRolePerform(found.role, n, 'view')) ?? 'dashboard';
      setActiveNavState(firstAllowed);
    }

    if (found.mustResetPin) {
      setStaffUsers((prev) =>
        prev.map((s) =>
          s.id === found.id ? { ...s, mustResetPin: false, accessStatus: 'Active' } : s
        )
      );
    }
    pushToast(`Signed in as ${found.name} (${found.role})`);
    return { ok: true };
  };

  const logoutUser = () => {
    clearCart();
    setCurrentUser(null);
  };

  const switchUser = (staffId: string) => {
    const found = staffUsers.find((s) => s.id === staffId);
    if (!found) return;
    if (found.status !== 'Active' || !found.hasLoginAccess || found.accessStatus === 'Disabled') {
      pushToast(
        `Cannot switch to ${found.name}: account is ${found.status} or login is disabled.`,
        'error'
      );
      return;
    }
    setCurrentUser(found);

    const isOwnerOrAdmin = found.role === 'Owner' || found.role === 'Admin';
    if (!isOwnerOrAdmin && !found.authorizedBranchIds.includes(activeBranchId)) {
      const nextBranch = found.primaryBranchId || found.authorizedBranchIds[0];
      if (nextBranch) setActiveBranchIdState(nextBranch);
    }

    if (!canRolePerform(found.role, activeNav, 'view')) {
      const fallbackOrder: NavSection[] = [
        'dashboard',
        'pos',
        'stock',
        'inventory',
        'custom_orders',
        'customers',
        'menus',
        'reports',
      ];
      const nextNav =
        fallbackOrder.find((n) => canRolePerform(found.role, n, 'view')) ?? 'dashboard';
      setActiveNavState(nextNav);
    }
    pushToast(`Active operator switched to ${found.name} (${found.role})`);
  };

  // Branch CRUD & Workflows
  const addBranch: PosContextValue['addBranch'] = (input) => {
    if (!hasPermission('branches', 'create')) {
      const err = 'Permission denied: cannot create branches.';
      pushToast(err, 'error');
      return { ok: false, error: err };
    }
    const code = input.branchCode.trim().toUpperCase();
    if (!code) return { ok: false, error: 'Branch ID / Code is required.' };
    if (branches.some((b) => b.branchCode.toUpperCase() === code)) {
      return { ok: false, error: `Branch ID "${code}" already exists.` };
    }
    const created: Branch = {
      id: `br-${Date.now()}`,
      branchCode: code,
      name: input.name.trim(),
      phone: input.phone.trim(),
      address: input.address.trim(),
      email: input.email?.trim() || undefined,
      managerId: input.managerId || undefined,
      status: input.status,
      notes: input.notes?.trim() || undefined,
      createdAt: TODAY_ISO,
      operationalSettings: {
        taxRate: input.operationalSettings?.taxRate ?? settings.defaultTaxRate,
        packagingFee: input.operationalSettings?.packagingFee ?? settings.defaultPackagingFee,
        openingHours: input.operationalSettings?.openingHours?.trim() || '08:00 AM – 10:00 PM',
        receiptHeaderNote:
          input.operationalSettings?.receiptHeaderNote?.trim() || settings.receiptHeaderNote,
        receiptFooterNote:
          input.operationalSettings?.receiptFooterNote?.trim() || settings.receiptFooterNote,
      },
    };
    setBranches((prev) => [...prev, created]);

    // Ensure Owners, Admins, and assigned Manager have access
    setStaffUsers((prev) =>
      prev.map((s) => {
        if (s.role === 'Owner' || s.role === 'Admin' || s.id === created.managerId) {
          return {
            ...s,
            authorizedBranchIds: Array.from(new Set([...s.authorizedBranchIds, created.id])),
          };
        }
        return s;
      })
    );

    if (created.managerId) {
      const mgr = staffUsers.find((s) => s.id === created.managerId);
      if (mgr) {
        setBranchAssignments((prev) => [
          {
            id: `bal-${Date.now()}`,
            staffId: mgr.id,
            staffName: mgr.name,
            toBranchId: created.id,
            toBranchName: created.name,
            assignmentType: 'Additional Access',
            changedBy: currentUser?.name ?? 'Admin',
            timestamp: new Date().toISOString(),
            notes: `Assigned as Branch Manager for new branch ${created.name}`,
          },
          ...prev,
        ]);
      }
    }

    pushEventNotification({
      title: `Branch Added: ${created.name}`,
      message: `${created.branchCode} created (${created.status}).`,
      category: 'staff_branch',
      severity: 'info',
      targetNav: 'branches',
    });
    pushToast(`Branch "${created.name}" (${created.branchCode}) created.`);
    return { ok: true, branch: created };
  };

  const updateBranch: PosContextValue['updateBranch'] = (updated) => {
    if (!hasPermission('branches', 'edit')) {
      const err = 'Permission denied: cannot edit branch details.';
      pushToast(err, 'error');
      return { ok: false, error: err };
    }
    const code = updated.branchCode.trim().toUpperCase();
    if (branches.some((b) => b.id !== updated.id && b.branchCode.toUpperCase() === code)) {
      return { ok: false, error: `Branch ID "${code}" is already used by another branch.` };
    }
    const normalized: Branch = {
      ...updated,
      branchCode: code,
      name: updated.name.trim(),
      phone: updated.phone.trim(),
      address: updated.address.trim(),
      email: updated.email?.trim() || undefined,
      notes: updated.notes?.trim() || undefined,
    };
    setBranches((prev) => prev.map((b) => (b.id === normalized.id ? normalized : b)));
    if (normalized.managerId) {
      setStaffUsers((prev) =>
        prev.map((s) =>
          s.id === normalized.managerId && !s.authorizedBranchIds.includes(normalized.id)
            ? { ...s, authorizedBranchIds: [...s.authorizedBranchIds, normalized.id] }
            : s
        )
      );
    }
    pushToast(`Updated branch "${normalized.name}".`);
    return { ok: true };
  };

  const changeBranchStatus = (branchId: string, status: BranchStatus) => {
    if (!hasPermission('branches', 'edit')) {
      pushToast('Permission denied: cannot change branch status.', 'error');
      return;
    }
    const activeCount = branches.filter((b) => b.status === 'Active').length;
    const target = branches.find((b) => b.id === branchId);
    if (!target) return;
    if (target.status === 'Active' && status === 'Inactive' && activeCount <= 1) {
      pushToast('At least one branch must remain Active in the organization.', 'warning');
      return;
    }
    setBranches((prev) => prev.map((b) => (b.id === branchId ? { ...b, status } : b)));
    pushEventNotification({
      title: `Branch ${status}: ${target.name}`,
      message: `${target.name} (${target.branchCode}) marked ${status}.`,
      category: 'staff_branch',
      severity: status === 'Inactive' ? 'warning' : 'info',
      targetNav: 'branches',
    });
    pushToast(
      `${target.name} is now ${status}.`,
      status === 'Inactive' ? 'warning' : 'success'
    );
  };

  const assignBranchManager = (branchId: string, managerId?: string) => {
    if (!hasPermission('branches', 'edit')) {
      pushToast('Permission denied: cannot change branch manager.', 'error');
      return;
    }
    const branch = branches.find((b) => b.id === branchId);
    if (!branch) return;
    setBranches((prev) =>
      prev.map((b) => (b.id === branchId ? { ...b, managerId: managerId || undefined } : b))
    );
    if (managerId) {
      const mgr = staffUsers.find((s) => s.id === managerId);
      if (mgr && !mgr.authorizedBranchIds.includes(branchId)) {
        setStaffUsers((prev) =>
          prev.map((s) =>
            s.id === managerId
              ? { ...s, authorizedBranchIds: [...s.authorizedBranchIds, branchId] }
              : s
          )
        );
        setBranchAssignments((prev) => [
          {
            id: `bal-${Date.now()}`,
            staffId: mgr.id,
            staffName: mgr.name,
            toBranchId: branch.id,
            toBranchName: branch.name,
            assignmentType: 'Additional Access',
            changedBy: currentUser?.name ?? 'Admin',
            timestamp: new Date().toISOString(),
            notes: `Appointed as manager of ${branch.name}`,
          },
          ...prev,
        ]);
      }
      pushToast(`Assigned ${mgr?.name ?? 'manager'} to ${branch.name}.`);
    } else {
      pushToast(`Cleared branch manager assignment for ${branch.name}.`, 'warning');
    }
  };

  const updateBranchOperationalSettings = (
    branchId: string,
    operationalSettings: BranchOperationalSettings
  ) => {
    if (!hasPermission('branches', 'edit') && !hasPermission('settings', 'edit')) {
      pushToast('Permission denied: cannot modify branch operational settings.', 'error');
      return;
    }
    setBranches((prev) =>
      prev.map((b) => (b.id === branchId ? { ...b, operationalSettings } : b))
    );
    pushToast('Branch operational settings updated.');
  };

  // Staff CRUD & Workflows
  const addStaffMember: PosContextValue['addStaffMember'] = (input) => {
    if (!hasPermission('staff', 'create')) {
      const err = 'Permission denied: cannot add staff members.';
      pushToast(err, 'error');
      return { ok: false, error: err };
    }
    const code = input.employeeCode.trim().toUpperCase();
    if (!code) return { ok: false, error: 'Employee ID is required.' };
    if (staffUsers.some((s) => s.employeeCode.toUpperCase() === code)) {
      return { ok: false, error: `Employee ID "${code}" already exists.` };
    }

    const primaryBranch = branches.find((b) => b.id === input.primaryBranchId) ?? branches[0];
    const authIds = Array.from(new Set([primaryBranch.id, ...input.authorizedBranchIds]));
    const isActiveStatus = input.status === 'Active';
    const loginEnabled = isActiveStatus && input.hasLoginAccess;

    const created: StaffUser = {
      id: `staff-${Date.now()}`,
      employeeCode: code,
      name: input.name.trim(),
      phone: input.phone.trim(),
      role: input.role,
      primaryBranchId: primaryBranch.id,
      authorizedBranchIds: authIds,
      joiningDate: input.joiningDate || TODAY_ISO,
      status: input.status,
      address: input.address?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      hasLoginAccess: loginEnabled,
      accessStatus: loginEnabled ? 'Active' : 'Disabled',
      mustResetPin: loginEnabled ? false : undefined,
      lastCredentialUpdate: loginEnabled ? new Date().toISOString() : undefined,
      pin: input.initialPin && /^\d{4,6}$/.test(input.initialPin) ? input.initialPin : '1234',
      branch: primaryBranch.name,
    };

    setStaffUsers((prev) => [created, ...prev]);
    setBranchAssignments((prev) => [
      {
        id: `bal-${Date.now()}`,
        staffId: created.id,
        staffName: created.name,
        toBranchId: primaryBranch.id,
        toBranchName: primaryBranch.name,
        assignmentType: 'Primary',
        changedBy: currentUser?.name ?? 'Admin',
        timestamp: new Date().toISOString(),
        notes: `Onboarded as ${created.role}`,
      },
      ...prev,
    ]);
    pushEventNotification({
      title: `New Staff Added: ${created.name}`,
      message: `${created.employeeCode} · ${created.role} at ${primaryBranch.name}`,
      category: 'staff_branch',
      severity: 'info',
      targetNav: 'staff',
    });
    pushToast(`Added ${created.name} (${created.employeeCode}).`);
    return { ok: true, staff: created };
  };

  const updateStaffMember: PosContextValue['updateStaffMember'] = (input) => {
    if (!hasPermission('staff', 'edit')) {
      const err = 'Permission denied: cannot edit staff records.';
      pushToast(err, 'error');
      return { ok: false, error: err };
    }
    const existing = staffUsers.find((s) => s.id === input.id);
    if (!existing) return { ok: false, error: 'Employee record not found.' };

    const code = input.employeeCode.trim().toUpperCase();
    if (!code) return { ok: false, error: 'Employee ID is required.' };
    if (staffUsers.some((s) => s.id !== input.id && s.employeeCode.toUpperCase() === code)) {
      return { ok: false, error: `Employee ID "${code}" is already assigned to another staff member.` };
    }

    const primaryBranch = branches.find((b) => b.id === input.primaryBranchId) ?? branches[0];
    const authIds = Array.from(new Set([primaryBranch.id, ...input.authorizedBranchIds]));
    const loginEnabled = input.status === 'Active' ? existing.hasLoginAccess : false;

    const updated: StaffUser = {
      ...existing,
      employeeCode: code,
      name: input.name.trim(),
      phone: input.phone.trim(),
      role: input.role,
      primaryBranchId: primaryBranch.id,
      authorizedBranchIds: authIds,
      joiningDate: input.joiningDate,
      status: input.status,
      address: input.address?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      hasLoginAccess: loginEnabled,
      accessStatus: loginEnabled ? existing.accessStatus === 'Invited' ? 'Invited' : 'Active' : 'Disabled',
      branch: primaryBranch.name,
    };

    setStaffUsers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    if (currentUser?.id === updated.id) {
      setCurrentUser(updated);
    }

    if (existing.primaryBranchId !== primaryBranch.id) {
      const oldBr = branches.find((b) => b.id === existing.primaryBranchId);
      setBranchAssignments((prev) => [
        {
          id: `bal-${Date.now()}`,
          staffId: updated.id,
          staffName: updated.name,
          fromBranchId: oldBr?.id,
          fromBranchName: oldBr?.name,
          toBranchId: primaryBranch.id,
          toBranchName: primaryBranch.name,
          assignmentType: 'Primary',
          changedBy: currentUser?.name ?? 'Admin',
          timestamp: new Date().toISOString(),
          notes: 'Primary branch updated via Employee profile',
        },
        ...prev,
      ]);
    }

    pushToast(`Updated employee profile for ${updated.name}.`);
    return { ok: true };
  };

  const changeStaffStatus = (staffId: string, status: EmploymentStatus): boolean => {
    if (!hasPermission('staff', 'edit')) {
      pushToast('Permission denied: cannot update employment status.', 'error');
      return false;
    }
    const target = staffUsers.find((s) => s.id === staffId);
    if (!target) return false;
    if (currentUser?.id === staffId && status !== 'Active') {
      pushToast('You cannot deactivate or place your own active session on leave.', 'error');
      return false;
    }
    const activeOwners = staffUsers.filter((s) => s.role === 'Owner' && s.status === 'Active');
    if (target.role === 'Owner' && status !== 'Active' && activeOwners.length <= 1) {
      pushToast('At least one Active Owner account is required.', 'warning');
      return false;
    }

    const disableAccess = status !== 'Active';
    setStaffUsers((prev) =>
      prev.map((s) =>
        s.id === staffId
          ? {
              ...s,
              status,
              hasLoginAccess: disableAccess ? false : s.hasLoginAccess,
              accessStatus: disableAccess ? 'Disabled' : s.hasLoginAccess ? 'Active' : 'Disabled',
            }
          : s
      )
    );
    pushEventNotification({
      title: `Staff Status Updated: ${target.name}`,
      message: `${target.name} (${target.employeeCode}) marked ${status}. Historical records preserved.`,
      category: 'staff_branch',
      severity: status === 'Active' ? 'info' : 'warning',
      targetNav: 'staff',
    });
    pushToast(
      `${target.name} marked as ${status}.${disableAccess ? ' Terminal login paused.' : ''}`,
      status === 'Active' ? 'success' : 'warning'
    );
    return true;
  };

  const assignStaffBranch: PosContextValue['assignStaffBranch'] = ({
    staffId,
    primaryBranchId,
    authorizedBranchIds,
    notes,
  }) => {
    if (!hasPermission('staff', 'edit') && !hasPermission('branches', 'edit')) {
      pushToast('Permission denied: cannot assign staff branches.', 'error');
      return false;
    }
    const staff = staffUsers.find((s) => s.id === staffId);
    const nextPrimary = branches.find((b) => b.id === primaryBranchId);
    if (!staff || !nextPrimary) return false;

    const nextAuthIds = Array.from(new Set([primaryBranchId, ...authorizedBranchIds]));
    const added = nextAuthIds.filter((id) => !staff.authorizedBranchIds.includes(id));
    const removed = staff.authorizedBranchIds.filter((id) => !nextAuthIds.includes(id));
    const newLogs: BranchAssignmentLog[] = [];
    const now = new Date().toISOString();

    if (staff.primaryBranchId !== primaryBranchId) {
      const oldBr = branches.find((b) => b.id === staff.primaryBranchId);
      newLogs.push({
        id: `bal-${Date.now()}-p`,
        staffId: staff.id,
        staffName: staff.name,
        fromBranchId: oldBr?.id,
        fromBranchName: oldBr?.name,
        toBranchId: nextPrimary.id,
        toBranchName: nextPrimary.name,
        assignmentType: 'Primary',
        changedBy: currentUser?.name ?? 'Admin',
        timestamp: now,
        notes: notes?.trim() || 'Primary branch transfer',
      });
    }

    added
      .filter((id) => id !== primaryBranchId)
      .forEach((id, idx) => {
        const br = branches.find((b) => b.id === id);
        if (br) {
          newLogs.push({
            id: `bal-${Date.now()}-a-${idx}`,
            staffId: staff.id,
            staffName: staff.name,
            toBranchId: br.id,
            toBranchName: br.name,
            assignmentType: 'Additional Access',
            changedBy: currentUser?.name ?? 'Admin',
            timestamp: now,
            notes: notes?.trim() || 'Multi-branch access granted',
          });
        }
      });

    removed.forEach((id, idx) => {
      const br = branches.find((b) => b.id === id);
      if (br) {
        newLogs.push({
          id: `bal-${Date.now()}-r-${idx}`,
          staffId: staff.id,
          staffName: staff.name,
          toBranchId: br.id,
          toBranchName: br.name,
          assignmentType: 'Revoked Access',
          changedBy: currentUser?.name ?? 'Admin',
          timestamp: now,
          notes: notes?.trim() || 'Branch authorization removed',
        });
      }
    });

    setStaffUsers((prev) =>
      prev.map((s) =>
        s.id === staffId
          ? {
              ...s,
              primaryBranchId,
              authorizedBranchIds: nextAuthIds,
              branch: nextPrimary.name,
            }
          : s
      )
    );
    if (currentUser?.id === staffId) {
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              primaryBranchId,
              authorizedBranchIds: nextAuthIds,
              branch: nextPrimary.name,
            }
          : prev
      );
    }

    if (newLogs.length > 0) {
      setBranchAssignments((prev) => [...newLogs, ...prev]);
    }
    pushToast(`Updated branch assignment for ${staff.name}.`);
    return true;
  };

  const toggleStaffLoginAccess = (staffId: string, enabled: boolean): boolean => {
    if (!hasPermission('staff', 'edit')) {
      pushToast('Permission denied: cannot modify login access.', 'error');
      return false;
    }
    const target = staffUsers.find((s) => s.id === staffId);
    if (!target) return false;
    if (enabled && target.status !== 'Active') {
      pushToast(
        `Cannot enable login while ${target.name} is ${target.status}. Set status to Active first.`,
        'error'
      );
      return false;
    }
    if (!enabled && currentUser?.id === staffId) {
      pushToast('You cannot disable login access for your currently signed-in account.', 'error');
      return false;
    }

    setStaffUsers((prev) =>
      prev.map((s) =>
        s.id === staffId
          ? {
              ...s,
              hasLoginAccess: enabled,
              accessStatus: enabled ? 'Active' : 'Disabled',
            }
          : s
      )
    );
    pushToast(
      `Terminal login ${enabled ? 'enabled' : 'disabled'} for ${target.name}.`,
      enabled ? 'success' : 'warning'
    );
    return true;
  };

  const resetStaffCredentials: PosContextValue['resetStaffCredentials'] = ({
    staffId,
    newPin,
    accessStatus = 'Active',
    mustResetPin = false,
  }) => {
    if (!hasPermission('staff', 'edit')) {
      return { ok: false, error: 'Permission denied: cannot reset credentials.' };
    }
    if (!/^\d{4,6}$/.test(newPin.trim())) {
      return { ok: false, error: 'Terminal PIN must be 4 to 6 numeric digits.' };
    }
    const target = staffUsers.find((s) => s.id === staffId);
    if (!target) return { ok: false, error: 'Employee not found.' };

    const canEnable = target.status === 'Active' && accessStatus !== 'Disabled';
    setStaffUsers((prev) =>
      prev.map((s) =>
        s.id === staffId
          ? {
              ...s,
              pin: newPin.trim(),
              hasLoginAccess: canEnable,
              accessStatus: canEnable ? accessStatus : 'Disabled',
              mustResetPin,
              lastCredentialUpdate: new Date().toISOString(),
            }
          : s
      )
    );
    pushToast(`Updated terminal access credentials for ${target.name}.`);
    return { ok: true };
  };

  const updateSettings = (next: StoreSettings) => {
    if (!hasPermission('settings', 'edit')) {
      pushToast('Permission denied: only authorized roles can modify store settings.', 'error');
      return;
    }
    setSettings(next);
    pushToast('Settings saved and applied across POS.');
  };

  const addCategory = (name: string, description: string) => {
    if (!hasPermission('menus', 'create')) {
      pushToast('Permission denied: cannot add categories.', 'error');
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) return;
    const next: Category = {
      id: `cat-${Date.now()}`,
      name: trimmed,
      description: description.trim() || 'Bakery & sweets category',
    };
    setCategories((prev) => [...prev, next]);
    pushToast(`Category "${trimmed}" added.`);
  };

  const deleteCategory = (categoryId: string): { ok: boolean; error?: string } => {
    if (!hasPermission('menus', 'delete')) {
      const error = 'Permission denied: cannot delete categories.';
      pushToast(error, 'error');
      return { ok: false, error };
    }
    const target = categories.find((c) => c.id === categoryId);
    if (!target) {
      return { ok: false, error: 'Category not found.' };
    }
    const assignedCount = products.filter((p) => p.categoryId === categoryId).length;
    if (assignedCount > 0) {
      const error = `Cannot delete "${target.name}" because ${assignedCount} product${
        assignedCount === 1 ? ' is' : 's are'
      } assigned to it. Reassign or remove those products first.`;
      pushToast(error, 'warning');
      return { ok: false, error };
    }
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    pushToast(`Category "${target.name}" deleted.`);
    return { ok: true };
  };

  const getPreparationType = (product: Product): PreparationType =>
    product.preparationType ?? 'Pre-Cooked';

  const getProductDefaultVariant = (product: Product): ProductVariant | undefined => {
    return (
      product.variants.find((v) => v.isDefault) ??
      (product.unitType === 'weight' && product.defaultWeightGrams
        ? product.variants.find((v) => v.weightGrams === product.defaultWeightGrams)
        : undefined) ??
      product.variants[0]
    );
  };

  const getVariantUnitLabel = (product: Product, variant?: ProductVariant): string => {
    if (variant?.unitLabel?.trim()) return variant.unitLabel.trim();
    return product.unitType === 'weight' ? 'Kg' : product.baseUnitLabel;
  };

  const getVariantMinStock = (product: Product, variant?: ProductVariant): number => {
    return roundQty(variant?.minStockAlert ?? product.minStockAlert ?? 0);
  };

  const getVariantStock = (
    productId: string,
    variantId: string,
    branchIdOverride?: string
  ): number => {
    const targetBranch = branchIdOverride ?? activeBranchId;
    return roundQty(
      batches
        .filter(
          (b) =>
            b.productId === productId &&
            b.variantId === variantId &&
            b.quantity > 0 &&
            (b.branchId ?? 'br-1') === targetBranch
        )
        .reduce((sum, b) => sum + b.quantity, 0)
    );
  };

  const getGroupBulkStock = (productId: string, branchIdOverride?: string): number => {
    return getVariantStock(productId, BULK_STOCK_VARIANT_ID, branchIdOverride);
  };

  const getVariantEarliestExpiry = (
    productId: string,
    variantId: string,
    branchIdOverride?: string
  ): string | null => {
    const targetBranch = branchIdOverride ?? activeBranchId;
    const valid = batches
      .filter(
        (b) =>
          b.productId === productId &&
          b.variantId === variantId &&
          b.quantity > 0 &&
          (b.branchId ?? 'br-1') === targetBranch
      )
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    return valid[0]?.expiryDate ?? null;
  };

  const getVariantLastUpdated = (
    productId: string,
    variantId: string,
    branchIdOverride?: string
  ): string | null => {
    const targetBranch = branchIdOverride ?? activeBranchId;
    const latestMovement = stockMovements
      .filter(
        (m) =>
          m.productId === productId &&
          m.variantId === variantId &&
          (m.branchId ?? 'br-1') === targetBranch
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

    const latestBatch = batches
      .filter(
        (b) =>
          b.productId === productId &&
          b.variantId === variantId &&
          (b.branchId ?? 'br-1') === targetBranch
      )
      .map((b) => b.lastUpdated ?? `${b.prepDate}T08:00:00`)
      .sort((a, b) => b.localeCompare(a))[0];

    if (latestMovement && latestBatch) {
      return latestMovement.timestamp >= latestBatch ? latestMovement.timestamp : latestBatch;
    }
    return latestMovement?.timestamp ?? latestBatch ?? null;
  };

  const addProduct: PosContextValue['addProduct'] = (product, stockSetup) => {
    if (!hasPermission('menus', 'create')) {
      pushToast('Permission denied: cannot add products.', 'error');
      return;
    }
    const today = TODAY_ISO;
    const prepType: PreparationType = product.preparationType ?? 'Pre-Cooked';
    let expiryIso = product.batchExpiryDate?.trim();
    if (!expiryIso) {
      const expDate = new Date(`${today}T00:00:00`);
      expDate.setDate(expDate.getDate() + Math.max(1, product.shelfLifeDays || 3));
      expiryIso = expDate.toISOString().slice(0, 10);
    }
    const computedShelfLife = Math.max(1, daysUntil(expiryIso, today));
    const normalizedVariants = product.variants.map((v, idx) => ({
      ...v,
      unitLabel:
        v.unitLabel?.trim() ||
        (product.unitType === 'weight' ? 'Kg' : product.baseUnitLabel),
      minStockAlert: v.minStockAlert ?? product.minStockAlert,
      isDefault:
        v.isDefault ??
        (product.variants.some((x) => x.isDefault)
          ? false
          : product.unitType === 'weight' && product.defaultWeightGrams
          ? v.weightGrams === product.defaultWeightGrams
          : idx === 0),
    }));
    const created: Product = {
      ...product,
      preparationType: prepType,
      isGroupStock: prepType === 'Pre-Cooked' ? Boolean(product.isGroupStock) : false,
      bulkUnitLabel:
        prepType === 'Pre-Cooked' && product.isGroupStock
          ? product.bulkUnitLabel?.trim() || product.baseUnitLabel || 'kg'
          : undefined,
      trackExpiry: prepType === 'Pre-Cooked' ? product.trackExpiry : false,
      variants: normalizedVariants,
      shelfLifeDays: product.shelfLifeDays || computedShelfLife,
      batchExpiryDate: expiryIso,
      id: `prod-${Date.now()}`,
    };
    setProducts((prev) => [created, ...prev]);

    if (prepType === 'Pre-Cooked' && stockSetup) {
      const nowIso = new Date().toISOString();
      const newBatches: StockBatch[] = [];
      const newLogs: StockMovementLog[] = [];

      if (created.isGroupStock && stockSetup.bulkStockQty && stockSetup.bulkStockQty > 0) {
        const qty = roundQty(stockSetup.bulkStockQty);
        const bulkUnit = created.bulkUnitLabel || 'kg';
        const batchCode = `B-${today.slice(8, 10)}${today.slice(5, 7)}-${created.sku.slice(-3)}-BLK`;
        newBatches.push({
          id: `bat-${Date.now()}-bulk`,
          productId: created.id,
          variantId: BULK_STOCK_VARIANT_ID,
          variantLabel: 'Bulk Pool',
          batchCode,
          prepDate: today,
          expiryDate: expiryIso,
          quantity: qty,
          unitLabel: bulkUnit,
          notes: 'Opening bulk stock entry',
          branchId: activeBranchId,
          branchName: activeBranch?.name,
          lastUpdated: nowIso,
        });
        newLogs.push({
          id: `sm-${Date.now()}-bulk`,
          productId: created.id,
          productName: created.name,
          variantId: BULK_STOCK_VARIANT_ID,
          variantLabel: 'Bulk Pool',
          batchCode,
          type: 'Stock In',
          delta: qty,
          previousQty: 0,
          newQty: qty,
          unitLabel: bulkUnit,
          reason: 'Opening bulk stock entry',
          timestamp: nowIso,
          performedBy: currentUser?.name ?? 'Staff',
          staffId: currentUser?.id,
          branchId: activeBranchId,
          branchName: activeBranch?.name,
        });
      }

      if (!created.isGroupStock && stockSetup.variantStockQtys) {
        normalizedVariants.forEach((v, idx) => {
          const qty = roundQty(stockSetup.variantStockQtys?.[v.id] ?? 0);
          if (qty <= 0) return;
          const unitLabel = getVariantUnitLabel(created, v);
          const batchCode = `B-${today.slice(8, 10)}${today.slice(5, 7)}-${created.sku.slice(-3)}-${v.skuSuffix}`;
          newBatches.push({
            id: `bat-${Date.now()}-${idx}`,
            productId: created.id,
            variantId: v.id,
            variantLabel: v.label,
            batchCode,
            prepDate: today,
            expiryDate: expiryIso!,
            quantity: qty,
            unitLabel,
            notes: 'Opening stock entry',
            branchId: activeBranchId,
            branchName: activeBranch?.name,
            lastUpdated: nowIso,
          });
          newLogs.push({
            id: `sm-${Date.now()}-${idx}`,
            productId: created.id,
            productName: created.name,
            variantId: v.id,
            variantLabel: v.label,
            batchCode,
            type: 'Stock In',
            delta: qty,
            previousQty: 0,
            newQty: qty,
            unitLabel,
            reason: 'Opening stock entry',
            timestamp: nowIso,
            performedBy: currentUser?.name ?? 'Staff',
            staffId: currentUser?.id,
            branchId: activeBranchId,
            branchName: activeBranch?.name,
          });
        });
      }

      if (newBatches.length > 0) {
        setBatches((prev) => [...newBatches, ...prev]);
        setStockMovements((prev) => [...newLogs, ...prev]);
      }
    }

    pushToast(
      prepType === 'Made Fresh'
        ? `Product "${created.name}" added to Menus & POS Billing (Made Fresh).`
        : `Product "${created.name}" added to Menus, Stock Management & POS.`
    );
  };

  const updateProduct: PosContextValue['updateProduct'] = (product, stockSetup) => {
    if (!hasPermission('menus', 'edit')) {
      pushToast('Permission denied: cannot edit products.', 'error');
      return;
    }
    const prepType: PreparationType = product.preparationType ?? 'Pre-Cooked';
    const normalizedVariants = product.variants.map((v, idx) => ({
      ...v,
      unitLabel:
        v.unitLabel?.trim() ||
        (product.unitType === 'weight' ? 'Kg' : product.baseUnitLabel),
      minStockAlert: v.minStockAlert ?? product.minStockAlert,
      isDefault:
        v.isDefault ??
        (product.variants.some((x) => x.isDefault) ? false : idx === 0),
    }));
    const normalizedProduct: Product = {
      ...product,
      preparationType: prepType,
      isGroupStock: prepType === 'Pre-Cooked' ? Boolean(product.isGroupStock) : false,
      bulkUnitLabel:
        prepType === 'Pre-Cooked' && product.isGroupStock
          ? product.bulkUnitLabel?.trim() || product.baseUnitLabel || 'kg'
          : undefined,
      trackExpiry: prepType === 'Pre-Cooked' ? product.trackExpiry : false,
      variants: normalizedVariants,
    };
    const validVariantIds = new Set(normalizedVariants.map((v) => v.id));

    setProducts((prev) => prev.map((p) => (p.id === product.id ? normalizedProduct : p)));

    const nowIso = new Date().toISOString();
    const today = TODAY_ISO;
    const defaultExp = (() => {
      const d = new Date(`${today}T00:00:00`);
      d.setDate(d.getDate() + Math.max(1, normalizedProduct.shelfLifeDays || 3));
      return d.toISOString().slice(0, 10);
    })();

    setBatches((prev) => {
      let next = prev
        .filter(
          (b) =>
            b.productId !== product.id ||
            !b.variantId ||
            validVariantIds.has(b.variantId) ||
            (normalizedProduct.isGroupStock && b.variantId === BULK_STOCK_VARIANT_ID)
        )
        .map((b) => {
          if (b.productId !== product.id) return b;
          if (b.variantId === BULK_STOCK_VARIANT_ID) {
            return {
              ...b,
              variantLabel: 'Bulk Pool',
              unitLabel: normalizedProduct.bulkUnitLabel || b.unitLabel,
            };
          }
          const matched = normalizedVariants.find((v) => v.id === b.variantId);
          return matched
            ? {
                ...b,
                variantLabel: matched.label,
                unitLabel: getVariantUnitLabel(normalizedProduct, matched),
              }
            : b;
        });

      // Apply optional stock updates when Pre-Cooked stock quantities were explicitly edited in Menu Management
      if (prepType === 'Pre-Cooked' && stockSetup) {
        const addedMovements: StockMovementLog[] = [];
        const applyTargetQty = (
          variantId: string,
          variantLabel: string,
          unitLabel: string,
          targetQty: number,
          skuSuffix: string
        ) => {
          const safeTarget = Math.max(0, roundQty(targetQty));
          const varBatches = next
            .filter(
              (b) =>
                b.productId === normalizedProduct.id &&
                b.variantId === variantId &&
                (b.branchId ?? 'br-1') === activeBranchId
            )
            .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
          const currentQty = roundQty(varBatches.reduce((s, b) => s + b.quantity, 0));
          const delta = roundQty(safeTarget - currentQty);
          if (delta === 0) return;

          let batchCode = varBatches[0]?.batchCode ?? `B-${normalizedProduct.sku.slice(-3)}-${skuSuffix}`;
          if (delta > 0) {
            if (varBatches.length > 0) {
              varBatches[0].quantity = roundQty(varBatches[0].quantity + delta);
              varBatches[0].lastUpdated = nowIso;
            } else {
              next.unshift({
                id: `bat-${Date.now()}-${skuSuffix}`,
                productId: normalizedProduct.id,
                variantId,
                variantLabel,
                batchCode,
                prepDate: today,
                expiryDate: defaultExp,
                quantity: safeTarget,
                unitLabel,
                notes: 'Updated from Menu Management',
                branchId: activeBranchId,
                branchName: activeBranch?.name,
                lastUpdated: nowIso,
              });
            }
          } else {
            let rem = Math.abs(delta);
            for (const b of varBatches) {
              if (rem <= 0) break;
              const take = Math.min(b.quantity, rem);
              b.quantity = Math.max(0, roundQty(b.quantity - take));
              b.lastUpdated = nowIso;
              rem = roundQty(rem - take);
              batchCode = b.batchCode;
            }
          }

          addedMovements.push({
            id: `sm-${Date.now()}-${skuSuffix}`,
            productId: normalizedProduct.id,
            productName: normalizedProduct.name,
            variantId,
            variantLabel,
            batchCode,
            type: currentQty === 0 && delta > 0 ? 'Stock In' : 'Manual Adjustment',
            delta,
            previousQty: currentQty,
            newQty: safeTarget,
            unitLabel,
            reason: 'Updated via Menu Management',
            timestamp: nowIso,
            performedBy: currentUser?.name ?? 'Staff',
            staffId: currentUser?.id,
            branchId: activeBranchId,
            branchName: activeBranch?.name,
          });
        };

        if (normalizedProduct.isGroupStock && stockSetup.bulkStockQty !== undefined) {
          applyTargetQty(
            BULK_STOCK_VARIANT_ID,
            'Bulk Pool',
            normalizedProduct.bulkUnitLabel || 'kg',
            stockSetup.bulkStockQty,
            'BLK'
          );
        } else if (!normalizedProduct.isGroupStock && stockSetup.variantStockQtys) {
          normalizedVariants.forEach((v) => {
            const val = stockSetup.variantStockQtys?.[v.id];
            if (val !== undefined && Number.isFinite(val)) {
              applyTargetQty(
                v.id,
                v.label,
                getVariantUnitLabel(normalizedProduct, v),
                val,
                v.skuSuffix
              );
            }
          });
        }

        if (addedMovements.length > 0) {
          setStockMovements((prevLogs) => [...addedMovements, ...prevLogs]);
        }
      }

      return next;
    });
    pushToast(`Updated "${product.name}".`);
  };

  const deleteProduct = (id: string) => {
    if (!hasPermission('menus', 'delete')) {
      pushToast('Permission denied: cannot delete menu products.', 'error');
      return;
    }
    const target = products.find((p) => p.id === id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setBatches((prev) => prev.filter((b) => b.productId !== id));
    if (target) pushToast(`Removed "${target.name}" from Menus.`, 'warning');
  };

  const toggleProductActive = (id: string) => {
    if (!hasPermission('menus', 'edit')) {
      pushToast('Permission denied: cannot toggle menu availability.', 'error');
      return;
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: !p.isActive } : p))
    );
  };

  const toggleProductFavourite = (id: string) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isFavourite: !p.isFavourite } : p))
    );
  };

  const getProductStock = (productId: string, branchIdOverride?: string): number => {
    const targetBranch = branchIdOverride ?? activeBranchId;
    return roundQty(
      batches
        .filter(
          (b) =>
            b.productId === productId &&
            b.quantity > 0 &&
            (b.branchId ?? 'br-1') === targetBranch
        )
        .reduce((sum, b) => sum + b.quantity, 0)
    );
  };

  const getProductEarliestExpiry = (
    productId: string,
    branchIdOverride?: string
  ): string | null => {
    const targetBranch = branchIdOverride ?? activeBranchId;
    const valid = batches
      .filter(
        (b) =>
          b.productId === productId &&
          b.quantity > 0 &&
          (b.branchId ?? 'br-1') === targetBranch
      )
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    return valid[0]?.expiryDate ?? null;
  };

  const updateVariantMinStock = (productId: string, variantId: string, minStock: number) => {
    if (!hasPermission('stock', 'edit') && !hasPermission('menus', 'edit')) {
      pushToast('Permission denied: cannot update minimum stock threshold.', 'error');
      return;
    }
    const safeMin = Math.max(0, roundQty(minStock));
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
              ...p,
              variants: p.variants.map((v) =>
                v.id === variantId ? { ...v, minStockAlert: safeMin } : v
              ),
            }
          : p
      )
    );
  };

  const addStockBatch = (batch: Omit<StockBatch, 'id'>) => {
    if (!hasPermission('stock', 'create')) {
      pushToast('Permission denied: cannot add counter stock batches.', 'error');
      return;
    }
    if (activeBranch?.status === 'Inactive') {
      pushToast(`${activeBranch.name} is Inactive. Activate branch to record stock batches.`, 'error');
      return;
    }
    const targetBranchId = batch.branchId ?? activeBranchId;
    const targetBranchName =
      batch.branchName ?? branches.find((b) => b.id === targetBranchId)?.name ?? activeBranch?.name;

    const prod = products.find((p) => p.id === batch.productId);
    const resolvedVariant =
      prod?.variants.find((v) => v.id === batch.variantId) ??
      (prod ? getProductDefaultVariant(prod) : undefined);
    const unitLabel =
      batch.unitLabel || (prod ? getVariantUnitLabel(prod, resolvedVariant) : 'pcs');
    const nowIso = new Date().toISOString();

    const created: StockBatch = {
      ...batch,
      variantId: resolvedVariant?.id ?? batch.variantId,
      variantLabel: resolvedVariant?.label ?? batch.variantLabel,
      unitLabel,
      quantity: roundQty(batch.quantity),
      id: `bat-${Date.now()}`,
      branchId: targetBranchId,
      branchName: targetBranchName,
      lastUpdated: nowIso,
    };
    const prevTotal = created.variantId
      ? roundQty(getVariantStock(batch.productId, created.variantId, targetBranchId))
      : roundQty(getProductStock(batch.productId, targetBranchId));

    setBatches((prev) => [created, ...prev]);
    setStockMovements((prev) => [
      {
        id: `sm-${Date.now()}`,
        productId: batch.productId,
        productName: prod?.name ?? 'Bakery Item',
        variantId: created.variantId,
        variantLabel: created.variantLabel,
        batchCode: created.batchCode,
        type: 'Stock In',
        delta: created.quantity,
        previousQty: prevTotal,
        newQty: roundQty(prevTotal + created.quantity),
        unitLabel,
        reason: created.notes || 'Fresh counter batch added',
        timestamp: nowIso,
        performedBy: currentUser?.name ?? 'Staff',
        staffId: currentUser?.id,
        branchId: targetBranchId,
        branchName: targetBranchName,
      },
      ...prev,
    ]);
    pushToast(
      `Stock In: +${created.quantity} ${unitLabel} for ${prod?.name ?? 'item'}${
        created.variantLabel ? ` (${created.variantLabel})` : ''
      }.`
    );
  };

  const adjustBatchQuantity = (
    batchId: string,
    newQty: number,
    reason: string = 'Manual counter stock reconciliation'
  ) => {
    if (!hasPermission('stock', 'edit')) {
      pushToast('Permission denied: cannot adjust counter batches.', 'error');
      return;
    }
    const target = batches.find((b) => b.id === batchId);
    if (!target) return;
    const targetBranchId = target.branchId ?? activeBranchId;
    const safeQty = Math.max(0, roundQty(newQty));
    const delta = roundQty(safeQty - target.quantity);
    if (delta === 0) return;

    const prod = products.find((p) => p.id === target.productId);
    const prevTotal = target.variantId
      ? roundQty(getVariantStock(target.productId, target.variantId, targetBranchId))
      : roundQty(getProductStock(target.productId, targetBranchId));
    const nextTotal = Math.max(0, roundQty(prevTotal + delta));
    const nowIso = new Date().toISOString();

    setBatches((prev) =>
      prev.map((b) =>
        b.id === batchId ? { ...b, quantity: safeQty, lastUpdated: nowIso } : b
      )
    );
    setStockMovements((prev) => [
      {
        id: `sm-${Date.now()}`,
        productId: target.productId,
        productName: prod?.name ?? 'Bakery Item',
        variantId: target.variantId,
        variantLabel: target.variantLabel,
        batchCode: target.batchCode,
        type: 'Manual Adjustment',
        delta,
        previousQty: prevTotal,
        newQty: nextTotal,
        unitLabel: target.unitLabel,
        reason,
        timestamp: nowIso,
        performedBy: currentUser?.name ?? 'Staff',
        staffId: currentUser?.id,
        branchId: targetBranchId,
        branchName: target.branchName ?? activeBranch?.name,
      },
      ...prev,
    ]);
    pushToast('Batch stock quantity adjusted.');
  };

  const logWastage = ({
    batchId,
    quantity,
    reason,
  }: {
    batchId: string;
    quantity: number;
    reason: WastageLog['reason'];
  }) => {
    if (!hasPermission('stock', 'edit')) {
      pushToast('Permission denied: cannot log wastage.', 'error');
      return;
    }
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) return;
    const targetBranchId = batch.branchId ?? activeBranchId;
    const prod = products.find((p) => p.id === batch.productId);
    const matchedVar = prod?.variants.find((v) => v.id === batch.variantId);
    const deduct = roundQty(Math.min(batch.quantity, Math.max(0, quantity)));
    if (deduct <= 0) return;

    const unitRate = matchedVar?.price ?? prod?.pricePerKg ?? prod?.variants[0]?.price ?? 100;
    const estimatedValue = roundCurrency(deduct * unitRate);
    const prevTotal = batch.variantId
      ? roundQty(getVariantStock(batch.productId, batch.variantId, targetBranchId))
      : roundQty(getProductStock(batch.productId, targetBranchId));
    const nextTotal = Math.max(0, roundQty(prevTotal - deduct));
    const nowIso = new Date().toISOString();

    setBatches((prev) =>
      prev.map((b) =>
        b.id === batchId
          ? {
              ...b,
              quantity: Math.max(0, roundQty(b.quantity - deduct)),
              lastUpdated: nowIso,
            }
          : b
      )
    );

    const logEntry: WastageLog = {
      id: `wst-${Date.now()}`,
      productId: batch.productId,
      productName: prod?.name ?? 'Bakery Item',
      variantId: batch.variantId,
      variantLabel: batch.variantLabel ?? matchedVar?.label,
      batchCode: batch.batchCode,
      quantity: deduct,
      unitLabel: batch.unitLabel,
      estimatedValue,
      reason,
      loggedAt: nowIso,
      loggedBy: currentUser?.name ?? 'Staff',
      staffId: currentUser?.id,
      branchId: targetBranchId,
      branchName: batch.branchName ?? activeBranch?.name,
    };
    setWastageLogs((prev) => [logEntry, ...prev]);

    setStockMovements((prev) => [
      {
        id: `sm-${Date.now()}`,
        productId: batch.productId,
        productName: prod?.name ?? 'Bakery Item',
        variantId: batch.variantId,
        variantLabel: batch.variantLabel ?? matchedVar?.label,
        batchCode: batch.batchCode,
        type: 'Wastage / Damage',
        delta: -deduct,
        previousQty: prevTotal,
        newQty: nextTotal,
        unitLabel: batch.unitLabel,
        reason,
        timestamp: nowIso,
        performedBy: currentUser?.name ?? 'Staff',
        staffId: currentUser?.id,
        branchId: targetBranchId,
        branchName: batch.branchName ?? activeBranch?.name,
      },
      ...prev,
    ]);

    pushEventNotification({
      title: 'Counter Wastage Logged',
      message: `${deduct} ${batch.unitLabel} of ${prod?.name ?? 'item'}${
        batch.variantLabel ? ` (${batch.variantLabel})` : ''
      } marked as ${reason}.`,
      category: 'expiry',
      severity: 'warning',
      targetNav: 'stock',
    });

    pushToast(`Logged ${deduct} ${batch.unitLabel} wastage (${reason}).`, 'warning');
  };

  const recordMultiStockIn: PosContextValue['recordMultiStockIn'] = ({
    referenceNumber,
    receivedDate,
    notes,
    lines,
  }) => {
    if (!hasPermission('stock', 'create')) {
      pushToast('Permission denied: cannot add counter stock.', 'error');
      return false;
    }
    if (activeBranch?.status === 'Inactive') {
      pushToast(`${activeBranch.name} is Inactive. Activate branch to record stock.`, 'error');
      return false;
    }
    if (lines.length === 0) return false;

    const nowTs = receivedDate
      ? `${receivedDate}T${new Date().toTimeString().slice(0, 8)}`
      : new Date().toISOString();
    const createdBatches: StockBatch[] = [];
    const movements: StockMovementLog[] = [];
    const runningTotals = new Map<string, number>();

    lines.forEach((ln, idx) => {
      const prod = products.find((p) => p.id === ln.productId);
      const qty = roundQty(ln.quantity);
      if (!prod || qty <= 0) return;
      const variant =
        prod.variants.find((v) => v.id === ln.variantId) ?? getProductDefaultVariant(prod);
      const unitLabel = getVariantUnitLabel(prod, variant);
      const key = `${prod.id}::${variant?.id ?? 'default'}`;
      const basePrev = roundQty(
        runningTotals.get(key) ??
          (variant
            ? getVariantStock(prod.id, variant.id, activeBranchId)
            : getProductStock(prod.id, activeBranchId))
      );
      const nextTotal = roundQty(basePrev + qty);
      runningTotals.set(key, nextTotal);

      createdBatches.push({
        id: `bat-${Date.now()}-${idx}`,
        productId: prod.id,
        variantId: variant?.id,
        variantLabel: variant?.label,
        batchCode: ln.batchCode,
        prepDate: ln.prepDate || receivedDate || TODAY_ISO,
        expiryDate: ln.expiryDate,
        quantity: qty,
        unitLabel,
        notes: [referenceNumber, notes].filter(Boolean).join(' · ') || undefined,
        branchId: activeBranchId,
        branchName: activeBranch?.name,
        lastUpdated: nowTs,
      });

      movements.push({
        id: `sm-${Date.now()}-${idx}`,
        productId: prod.id,
        productName: prod.name,
        variantId: variant?.id,
        variantLabel: variant?.label,
        batchCode: ln.batchCode,
        type: 'Stock In',
        delta: qty,
        previousQty: basePrev,
        newQty: nextTotal,
        unitLabel,
        reason: referenceNumber ? `Stock In (${referenceNumber})` : 'Counter Stock In',
        referenceNumber: referenceNumber?.trim() || undefined,
        timestamp: nowTs,
        performedBy: currentUser?.name ?? 'Staff',
        staffId: currentUser?.id,
        branchId: activeBranchId,
        branchName: activeBranch?.name,
      });
    });

    if (createdBatches.length === 0) return false;
    setBatches((prev) => [...createdBatches, ...prev]);
    setStockMovements((prev) => [...movements, ...prev]);
    pushToast(`Recorded ${createdBatches.length} variant stock batch(es) at ${activeBranch?.name}.`);
    return true;
  };

  const recordMultiVariantStockUpdate: PosContextValue['recordMultiVariantStockUpdate'] = ({
    mode,
    productId,
    date,
    referenceNumber,
    reason,
    notes,
    prepDate,
    expiryDate,
    entries,
  }) => {
    if (mode === 'stock_in' && !hasPermission('stock', 'create')) {
      const err = 'Permission denied: cannot record stock in.';
      pushToast(err, 'error');
      return { ok: false, error: err };
    }
    if (mode !== 'stock_in' && !hasPermission('stock', 'edit')) {
      const err = 'Permission denied: cannot update or issue stock.';
      pushToast(err, 'error');
      return { ok: false, error: err };
    }
    if (activeBranch?.status === 'Inactive') {
      const err = `${activeBranch.name} is Inactive. Activate branch to modify stock.`;
      pushToast(err, 'error');
      return { ok: false, error: err };
    }

    const prod = products.find((p) => p.id === productId);
    if (!prod) {
      return { ok: false, error: 'Selected menu product was not found.' };
    }
    if (entries.length === 0) {
      return { ok: false, error: 'Enter a stock quantity for at least one variant.' };
    }

    const ts = date
      ? `${date}T${new Date().toTimeString().slice(0, 8)}`
      : new Date().toISOString();
    const resolvedPrep = prepDate || date || TODAY_ISO;
    const defaultExp = (() => {
      const d = new Date(`${resolvedPrep}T00:00:00`);
      if (isNaN(d.getTime())) return TODAY_ISO;
      d.setDate(d.getDate() + Math.max(1, prod.shelfLifeDays || 3));
      return d.toISOString().slice(0, 10);
    })();
    const resolvedExp = expiryDate || defaultExp;

    const resolveTargetVariant = (variantId: string): ProductVariant | undefined => {
      if (variantId === BULK_STOCK_VARIANT_ID && prod.isGroupStock) {
        return {
          id: BULK_STOCK_VARIANT_ID,
          label: 'Bulk Pool',
          price: prod.pricePerKg ?? prod.variants[0]?.price ?? 0,
          skuSuffix: 'BULK',
          unitLabel: prod.bulkUnitLabel || prod.baseUnitLabel || 'kg',
          minStockAlert: prod.minStockAlert,
        };
      }
      return prod.variants.find((v) => v.id === variantId);
    };

    // Pre-validate all entries cleanly before mutating state
    for (const entry of entries) {
      const variant = resolveTargetVariant(entry.variantId);
      if (!variant) {
        return { ok: false, error: 'Invalid product variant selected.' };
      }
      const val = roundQty(entry.quantity);
      if (!Number.isFinite(val) || val < 0) {
        return { ok: false, error: `Invalid quantity for ${variant.label}. Negative numbers are not allowed.` };
      }
      if ((mode === 'stock_in' || mode === 'stock_out') && val <= 0) {
        return { ok: false, error: `Quantity for ${variant.label} must be greater than 0.` };
      }
      if (mode === 'stock_out') {
        const avail = getVariantStock(prod.id, variant.id, activeBranchId);
        if (val > avail) {
          return {
            ok: false,
            error: `Insufficient stock for ${variant.label} (${avail} ${getVariantUnitLabel(prod, variant)} available).`,
          };
        }
      }
    }

    const updatedBatches = batches.map((b) => ({ ...b }));
    const newLogs: StockMovementLog[] = [];
    const minStockUpdates = new Map<string, number>();

    entries.forEach((entry, idx) => {
      const variant = resolveTargetVariant(entry.variantId)!;
      const unitLabel = getVariantUnitLabel(prod, variant);
      const prevStock = getVariantStock(prod.id, variant.id, activeBranchId);

      if (
        entry.minStockAlert !== undefined &&
        Number.isFinite(entry.minStockAlert) &&
        entry.minStockAlert >= 0
      ) {
        minStockUpdates.set(variant.id, roundQty(entry.minStockAlert));
      }

      if (mode === 'stock_in') {
        const addQty = roundQty(entry.quantity);
        const batchCode =
          referenceNumber?.trim() ||
          `B-${resolvedPrep.slice(8, 10)}${resolvedPrep.slice(5, 7)}-${prod.sku.slice(-3)}-${variant.skuSuffix}`;
        updatedBatches.unshift({
          id: `bat-${Date.now()}-${idx}`,
          productId: prod.id,
          variantId: variant.id,
          variantLabel: variant.label,
          batchCode,
          prepDate: resolvedPrep,
          expiryDate: resolvedExp,
          quantity: addQty,
          unitLabel,
          notes: [reason, notes].filter(Boolean).join(' · ') || undefined,
          branchId: activeBranchId,
          branchName: activeBranch?.name,
          lastUpdated: ts,
        });
        newLogs.push({
          id: `sm-${Date.now()}-${idx}`,
          productId: prod.id,
          productName: prod.name,
          variantId: variant.id,
          variantLabel: variant.label,
          batchCode,
          type: 'Stock In',
          delta: addQty,
          previousQty: prevStock,
          newQty: roundQty(prevStock + addQty),
          unitLabel,
          reason: [reason, notes].filter(Boolean).join(' · ') || 'Stock In',
          referenceNumber: referenceNumber?.trim() || undefined,
          timestamp: ts,
          performedBy: currentUser?.name ?? 'Staff',
          staffId: currentUser?.id,
          branchId: activeBranchId,
          branchName: activeBranch?.name,
        });
      } else if (mode === 'stock_out') {
        const outQty = roundQty(entry.quantity);
        let rem = outQty;
        let lastBatchCode = referenceNumber?.trim() || `OUT-${variant.skuSuffix}`;
        const candidates = updatedBatches
          .filter(
            (b) =>
              b.productId === prod.id &&
              b.variantId === variant.id &&
              b.quantity > 0 &&
              (b.branchId ?? 'br-1') === activeBranchId
          )
          .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

        for (const b of candidates) {
          if (rem <= 0) break;
          const take = Math.min(b.quantity, rem);
          b.quantity = Math.max(0, roundQty(b.quantity - take));
          b.lastUpdated = ts;
          rem = roundQty(rem - take);
          lastBatchCode = b.batchCode;
        }
        const nextStock = Math.max(0, roundQty(prevStock - outQty));
        newLogs.push({
          id: `sm-${Date.now()}-${idx}`,
          productId: prod.id,
          productName: prod.name,
          variantId: variant.id,
          variantLabel: variant.label,
          batchCode: lastBatchCode,
          type: 'Stock Out',
          delta: -outQty,
          previousQty: prevStock,
          newQty: nextStock,
          unitLabel,
          reason: [reason, notes].filter(Boolean).join(' · ') || 'Stock Out',
          referenceNumber: referenceNumber?.trim() || undefined,
          timestamp: ts,
          performedBy: currentUser?.name ?? 'Staff',
          staffId: currentUser?.id,
          branchId: activeBranchId,
          branchName: activeBranch?.name,
        });
      } else {
        // adjust mode
        const targetQty = Math.max(0, roundQty(entry.quantity));
        const delta = roundQty(targetQty - prevStock);
        if (delta === 0) return;

        const varBatches = updatedBatches
          .filter(
            (b) =>
              b.productId === prod.id &&
              b.variantId === variant.id &&
              (b.branchId ?? 'br-1') === activeBranchId
          )
          .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

        let batchCode = varBatches[0]?.batchCode ?? `B-ADJ-${variant.skuSuffix}`;
        if (delta > 0) {
          if (varBatches.length > 0) {
            varBatches[0].quantity = roundQty(varBatches[0].quantity + delta);
            varBatches[0].lastUpdated = ts;
          } else {
            updatedBatches.unshift({
              id: `bat-${Date.now()}-${idx}`,
              productId: prod.id,
              variantId: variant.id,
              variantLabel: variant.label,
              batchCode,
              prepDate: resolvedPrep,
              expiryDate: resolvedExp,
              quantity: targetQty,
              unitLabel,
              notes: reason,
              branchId: activeBranchId,
              branchName: activeBranch?.name,
              lastUpdated: ts,
            });
          }
        } else {
          let rem = Math.abs(delta);
          for (const b of varBatches) {
            if (rem <= 0) break;
            const take = Math.min(b.quantity, rem);
            b.quantity = Math.max(0, roundQty(b.quantity - take));
            b.lastUpdated = ts;
            rem = roundQty(rem - take);
            batchCode = b.batchCode;
          }
        }
        newLogs.push({
          id: `sm-${Date.now()}-${idx}`,
          productId: prod.id,
          productName: prod.name,
          variantId: variant.id,
          variantLabel: variant.label,
          batchCode,
          type: 'Manual Adjustment',
          delta,
          previousQty: prevStock,
          newQty: targetQty,
          unitLabel,
          reason: [reason, notes].filter(Boolean).join(' · ') || 'Manual stock adjustment',
          referenceNumber: referenceNumber?.trim() || undefined,
          timestamp: ts,
          performedBy: currentUser?.name ?? 'Staff',
          staffId: currentUser?.id,
          branchId: activeBranchId,
          branchName: activeBranch?.name,
        });
      }
    });

    if (minStockUpdates.size > 0) {
      setProducts((prev) =>
        prev.map((p) =>
          p.id === prod.id
            ? {
                ...p,
                minStockAlert: minStockUpdates.has(BULK_STOCK_VARIANT_ID)
                  ? minStockUpdates.get(BULK_STOCK_VARIANT_ID)!
                  : p.minStockAlert,
                variants: p.variants.map((v) =>
                  minStockUpdates.has(v.id)
                    ? { ...v, minStockAlert: minStockUpdates.get(v.id) }
                    : v
                ),
              }
            : p
        )
      );
    }

    if (newLogs.length > 0) {
      setBatches(updatedBatches);
      setStockMovements((prev) => [...newLogs, ...prev]);
    }

    const changedCount = newLogs.length;
    if (changedCount === 0 && minStockUpdates.size === 0) {
      return { ok: false, error: 'No stock changes detected.' };
    }

    const actionWord =
      mode === 'stock_in' ? 'Stock In' : mode === 'stock_out' ? 'Stock Out' : 'Updated stock';
    pushToast(
      `${actionWord} saved for ${prod.name}${
        changedCount > 0 ? ` (${changedCount} variant${changedCount > 1 ? 's' : ''})` : ''
      }.`,
      mode === 'stock_out' ? 'warning' : 'success'
    );
    return { ok: true };
  };

  const recordProductStockOut: PosContextValue['recordProductStockOut'] = ({
    productId,
    variantId,
    batchId,
    quantity,
    reason,
    referenceNumber,
    date,
    notes,
  }) => {
    if (!hasPermission('stock', 'edit')) {
      pushToast('Permission denied: cannot issue counter stock out.', 'error');
      return false;
    }
    if (activeBranch?.status === 'Inactive') {
      pushToast(`${activeBranch.name} is Inactive. Activate branch to modify stock.`, 'error');
      return false;
    }
    const prod = products.find((p) => p.id === productId);
    const reqQty = roundQty(quantity);
    if (!prod || reqQty <= 0) return false;

    const resolvedVariant =
      (variantId ? prod.variants.find((v) => v.id === variantId) : undefined) ??
      getProductDefaultVariant(prod);
    const activeVariantId = resolvedVariant?.id;
    const unitLabel = getVariantUnitLabel(prod, resolvedVariant);

    const prevTotal = activeVariantId
      ? roundQty(getVariantStock(productId, activeVariantId, activeBranchId))
      : roundQty(getProductStock(productId, activeBranchId));
    if (reqQty > prevTotal) {
      pushToast(
        `Insufficient counter stock (${formatStockQty(prevTotal, unitLabel)} available).`,
        'error'
      );
      return false;
    }

    let remaining = reqQty;
    let lastBatchCode = 'COUNTER';
    const ts = date ? `${date}T${new Date().toTimeString().slice(0, 8)}` : new Date().toISOString();
    const updatedBatches = batches.map((b) => ({ ...b }));
    const candidates = updatedBatches
      .filter((b) =>
        batchId
          ? b.id === batchId
          : b.productId === productId &&
            (!activeVariantId || b.variantId === activeVariantId) &&
            b.quantity > 0 &&
            (b.branchId ?? 'br-1') === activeBranchId
      )
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    for (const b of candidates) {
      if (remaining <= 0) break;
      const take = Math.min(b.quantity, remaining);
      b.quantity = Math.max(0, roundQty(b.quantity - take));
      b.lastUpdated = ts;
      remaining = roundQty(remaining - take);
      lastBatchCode = b.batchCode;
    }

    const taken = roundQty(reqQty - remaining);
    if (taken <= 0) return false;

    const nextTotal = Math.max(0, roundQty(prevTotal - taken));
    setBatches(updatedBatches);
    setStockMovements((prev) => [
      {
        id: `sm-${Date.now()}`,
        productId,
        productName: prod.name,
        variantId: activeVariantId,
        variantLabel: resolvedVariant?.label,
        batchCode: lastBatchCode,
        type: 'Stock Out',
        delta: -taken,
        previousQty: prevTotal,
        newQty: nextTotal,
        unitLabel,
        reason: [reason, notes].filter(Boolean).join(' · '),
        referenceNumber: referenceNumber?.trim() || undefined,
        timestamp: ts,
        performedBy: currentUser?.name ?? 'Staff',
        staffId: currentUser?.id,
        branchId: activeBranchId,
        branchName: activeBranch?.name,
      },
      ...prev,
    ]);
    pushToast(
      `Stock Out: -${taken} ${unitLabel} of ${prod.name}${
        resolvedVariant ? ` (${resolvedVariant.label})` : ''
      }.`,
      'warning'
    );
    return true;
  };

  const recordProductStockAdjustment: PosContextValue['recordProductStockAdjustment'] = ({
    productId,
    variantId,
    batchId,
    newQuantity,
    reason,
    date,
    notes,
  }) => {
    if (!hasPermission('stock', 'edit')) {
      pushToast('Permission denied: cannot adjust counter stock.', 'error');
      return false;
    }
    if (activeBranch?.status === 'Inactive') {
      pushToast(`${activeBranch.name} is Inactive. Activate branch to adjust stock.`, 'error');
      return false;
    }
    const prod = products.find((p) => p.id === productId);
    if (!prod || newQuantity < 0) return false;

    const ts = date ? `${date}T${new Date().toTimeString().slice(0, 8)}` : new Date().toISOString();
    const safeNew = Math.max(0, roundQty(newQuantity));
    const resolvedVariant =
      (variantId ? prod.variants.find((v) => v.id === variantId) : undefined) ??
      getProductDefaultVariant(prod);
    const activeVariantId = resolvedVariant?.id;
    const unitLabel = getVariantUnitLabel(prod, resolvedVariant);

    if (batchId) {
      const target = batches.find((b) => b.id === batchId);
      if (!target) return false;
      const targetVar = prod.variants.find((v) => v.id === target.variantId) ?? resolvedVariant;
      const prevTotal = target.variantId
        ? roundQty(getVariantStock(productId, target.variantId, activeBranchId))
        : roundQty(getProductStock(productId, activeBranchId));
      const delta = roundQty(safeNew - target.quantity);
      if (delta === 0) return false;
      const nextTotal = Math.max(0, roundQty(prevTotal + delta));

      setBatches((prev) =>
        prev.map((b) => (b.id === batchId ? { ...b, quantity: safeNew, lastUpdated: ts } : b))
      );
      setStockMovements((prev) => [
        {
          id: `sm-${Date.now()}`,
          productId,
          productName: prod.name,
          variantId: targetVar?.id,
          variantLabel: targetVar?.label,
          batchCode: target.batchCode,
          type: 'Manual Adjustment',
          delta,
          previousQty: prevTotal,
          newQty: nextTotal,
          unitLabel: target.unitLabel,
          reason: [reason, notes].filter(Boolean).join(' · '),
          timestamp: ts,
          performedBy: currentUser?.name ?? 'Staff',
          staffId: currentUser?.id,
          branchId: activeBranchId,
          branchName: activeBranch?.name,
        },
        ...prev,
      ]);
      pushToast(`Adjusted ${prod.name} batch ${target.batchCode} to ${safeNew} ${target.unitLabel}.`);
      return true;
    }

    const prevTotal = activeVariantId
      ? roundQty(getVariantStock(productId, activeVariantId, activeBranchId))
      : roundQty(getProductStock(productId, activeBranchId));
    const delta = roundQty(safeNew - prevTotal);
    if (delta === 0) return false;

    const updatedBatches = batches.map((b) => ({ ...b }));
    const branchBatches = updatedBatches
      .filter(
        (b) =>
          b.productId === productId &&
          (!activeVariantId || b.variantId === activeVariantId) &&
          (b.branchId ?? 'br-1') === activeBranchId
      )
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    if (delta > 0) {
      if (branchBatches.length > 0) {
        branchBatches[0].quantity = roundQty(branchBatches[0].quantity + delta);
        branchBatches[0].lastUpdated = ts;
      } else {
        updatedBatches.unshift({
          id: `bat-${Date.now()}`,
          productId,
          variantId: activeVariantId,
          variantLabel: resolvedVariant?.label,
          batchCode: `B-ADJ-${prod.sku.slice(-3)}-${resolvedVariant?.skuSuffix ?? 'VAR'}`,
          prepDate: TODAY_ISO,
          expiryDate: prod.batchExpiryDate || TODAY_ISO,
          quantity: safeNew,
          unitLabel,
          notes: reason,
          branchId: activeBranchId,
          branchName: activeBranch?.name,
          lastUpdated: ts,
        });
      }
    } else {
      let rem = Math.abs(delta);
      for (const b of branchBatches) {
        if (rem <= 0) break;
        const take = Math.min(b.quantity, rem);
        b.quantity = Math.max(0, roundQty(b.quantity - take));
        b.lastUpdated = ts;
        rem = roundQty(rem - take);
      }
    }

    setBatches(updatedBatches);
    setStockMovements((prev) => [
      {
        id: `sm-${Date.now()}`,
        productId,
        productName: prod.name,
        variantId: activeVariantId,
        variantLabel: resolvedVariant?.label,
        batchCode: branchBatches[0]?.batchCode ?? 'COUNTER',
        type: 'Manual Adjustment',
        delta,
        previousQty: prevTotal,
        newQty: safeNew,
        unitLabel,
        reason: [reason, notes].filter(Boolean).join(' · '),
        timestamp: ts,
        performedBy: currentUser?.name ?? 'Staff',
        staffId: currentUser?.id,
        branchId: activeBranchId,
        branchName: activeBranch?.name,
      },
      ...prev,
    ]);
    pushToast(
      `Adjusted ${prod.name}${resolvedVariant ? ` (${resolvedVariant.label})` : ''} stock to ${safeNew} ${unitLabel}.`
    );
    return true;
  };

  const splitGroupStock: PosContextValue['splitGroupStock'] = ({
    productId,
    date,
    referenceNumber,
    notes,
    allocations,
  }) => {
    if (!hasPermission('stock', 'edit') && !hasPermission('stock', 'create')) {
      const err = 'Permission denied: cannot split group stock.';
      pushToast(err, 'error');
      return { ok: false, error: err };
    }
    if (activeBranch?.status === 'Inactive') {
      const err = `${activeBranch.name} is Inactive. Activate branch to split stock.`;
      pushToast(err, 'error');
      return { ok: false, error: err };
    }
    const prod = products.find((p) => p.id === productId);
    if (!prod || !prod.isGroupStock || getPreparationType(prod) === 'Made Fresh') {
      return { ok: false, error: 'Selected product is not configured for Pre-Cooked Group Stock.' };
    }

    const bulkUnit = prod.bulkUnitLabel || prod.baseUnitLabel || 'kg';
    const availableBulk = getGroupBulkStock(prod.id, activeBranchId);

    const validAllocations = allocations
      .map((a) => {
        const variant = prod.variants.find((v) => v.id === a.variantId);
        if (!variant) return null;
        const qty = roundQty(a.quantity);
        const factor =
          a.bulkPerUnit !== undefined && Number.isFinite(a.bulkPerUnit) && a.bulkPerUnit > 0
            ? roundQty(a.bulkPerUnit)
            : getBulkConversionFactor(prod, variant);
        const bulkNeeded = roundQty(qty * factor);
        return { variant, qty, factor, bulkNeeded };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && x.qty > 0);

    if (validAllocations.length === 0) {
      return { ok: false, error: 'Enter at least one allocation quantity greater than 0.' };
    }

    const totalBulkDeduction = roundQty(
      validAllocations.reduce((s, a) => s + a.bulkNeeded, 0)
    );
    if (totalBulkDeduction <= 0) {
      return { ok: false, error: 'Total bulk deduction must be greater than 0.' };
    }
    if (totalBulkDeduction > availableBulk + 1e-6) {
      return {
        ok: false,
        error: `Cannot split ${formatStockQty(totalBulkDeduction, bulkUnit)} — only ${formatStockQty(availableBulk, bulkUnit)} available in Bulk Pool.`,
      };
    }

    const ts = date ? `${date}T${new Date().toTimeString().slice(0, 8)}` : new Date().toISOString();
    const resolvedPrep = date || TODAY_ISO;
    const defaultExp = (() => {
      const d = new Date(`${resolvedPrep}T00:00:00`);
      if (isNaN(d.getTime())) return TODAY_ISO;
      d.setDate(d.getDate() + Math.max(1, prod.shelfLifeDays || 3));
      return d.toISOString().slice(0, 10);
    })();

    const updatedBatches = batches.map((b) => ({ ...b }));
    const bulkBatches = updatedBatches
      .filter(
        (b) =>
          b.productId === prod.id &&
          b.variantId === BULK_STOCK_VARIANT_ID &&
          b.quantity > 0 &&
          (b.branchId ?? 'br-1') === activeBranchId
      )
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    const sourcePrepDate = bulkBatches[0]?.prepDate ?? resolvedPrep;
    const sourceExpiryDate = bulkBatches[0]?.expiryDate ?? defaultExp;
    let sourceBatchCode = bulkBatches[0]?.batchCode ?? `BLK-${prod.sku.slice(-3)}`;

    let rem = totalBulkDeduction;
    for (const b of bulkBatches) {
      if (rem <= 0) break;
      const take = Math.min(b.quantity, rem);
      b.quantity = Math.max(0, roundQty(b.quantity - take));
      b.lastUpdated = ts;
      rem = roundQty(rem - take);
      sourceBatchCode = b.batchCode;
    }

    const refCode =
      referenceNumber?.trim() || `SPL-${Math.floor(100 + Math.random() * 899)}`;
    const newLogs: StockMovementLog[] = [];
    const remainingBulk = Math.max(0, roundQty(availableBulk - totalBulkDeduction));

    newLogs.push({
      id: `sm-${Date.now()}-bulk-out`,
      productId: prod.id,
      productName: prod.name,
      variantId: BULK_STOCK_VARIANT_ID,
      variantLabel: 'Bulk Pool',
      batchCode: sourceBatchCode,
      type: 'Bulk Split',
      delta: -totalBulkDeduction,
      previousQty: availableBulk,
      newQty: remainingBulk,
      unitLabel: bulkUnit,
      reason: [
        `Split into ${validAllocations.map((a) => `${a.qty} × ${a.variant.label}`).join(', ')}`,
        notes,
      ]
        .filter(Boolean)
        .join(' · '),
      referenceNumber: refCode,
      timestamp: ts,
      performedBy: currentUser?.name ?? 'Staff',
      staffId: currentUser?.id,
      branchId: activeBranchId,
      branchName: activeBranch?.name,
    });

    validAllocations.forEach((alloc, idx) => {
      const unitLabel = getVariantUnitLabel(prod, alloc.variant);
      const prevVarQty = getVariantStock(prod.id, alloc.variant.id, activeBranchId);
      const nextVarQty = roundQty(prevVarQty + alloc.qty);
      const batchCode = `${sourceBatchCode}-${alloc.variant.skuSuffix}`;

      updatedBatches.unshift({
        id: `bat-${Date.now()}-spl-${idx}`,
        productId: prod.id,
        variantId: alloc.variant.id,
        variantLabel: alloc.variant.label,
        batchCode,
        prepDate: sourcePrepDate,
        expiryDate: sourceExpiryDate,
        quantity: alloc.qty,
        unitLabel,
        notes: `Allocated ${alloc.bulkNeeded} ${bulkUnit} from Bulk Pool (${refCode})`,
        branchId: activeBranchId,
        branchName: activeBranch?.name,
        lastUpdated: ts,
      });

      newLogs.push({
        id: `sm-${Date.now()}-spl-${idx}`,
        productId: prod.id,
        productName: prod.name,
        variantId: alloc.variant.id,
        variantLabel: alloc.variant.label,
        batchCode,
        type: 'Bulk Split',
        delta: alloc.qty,
        previousQty: prevVarQty,
        newQty: nextVarQty,
        unitLabel,
        reason: [
          `Split from Bulk Pool (-${formatStockQty(alloc.bulkNeeded, bulkUnit)})`,
          notes,
        ]
          .filter(Boolean)
          .join(' · '),
        referenceNumber: refCode,
        timestamp: ts,
        performedBy: currentUser?.name ?? 'Staff',
        staffId: currentUser?.id,
        branchId: activeBranchId,
        branchName: activeBranch?.name,
      });
    });

    setBatches(updatedBatches);
    setStockMovements((prev) => [...newLogs, ...prev]);
    pushToast(
      `Split ${formatStockQty(totalBulkDeduction, bulkUnit)} of ${prod.name} (${formatStockQty(remainingBulk, bulkUnit)} bulk left).`
    );
    return { ok: true };
  };

  const lowStockProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.isActive) return false;
      if (getPreparationType(p) === 'Made Fresh') return false;
      if (p.isGroupStock) {
        const bulkQty = getGroupBulkStock(p.id, activeBranchId);
        const hasAnyVariantBuffer = p.variants.some(
          (v) => getVariantStock(p.id, v.id, activeBranchId) > getVariantMinStock(p, v)
        );
        return bulkQty <= (p.minStockAlert || 0) && !hasAnyVariantBuffer;
      }
      return p.variants.some((v) => {
        const vQty = batches
          .filter(
            (b) =>
              b.productId === p.id &&
              b.variantId === v.id &&
              b.quantity > 0 &&
              (b.branchId ?? 'br-1') === activeBranchId
          )
          .reduce((s, b) => s + b.quantity, 0);
        return vQty <= getVariantMinStock(p, v);
      });
    });
  }, [products, batches, activeBranchId]);

  const expiringSoonBatches = useMemo(() => {
    return batches
      .filter((b) => b.quantity > 0 && (b.branchId ?? 'br-1') === activeBranchId)
      .map((b) => {
        const prod = products.find((p) => p.id === b.productId);
        const daysLeft = daysUntil(b.expiryDate, TODAY_ISO);
        return {
          ...b,
          productName: prod?.name ?? 'Unknown Item',
          trackExpiry: Boolean(
            prod && getPreparationType(prod) === 'Pre-Cooked' && prod.trackExpiry
          ),
          daysLeft,
        };
      })
      .filter((b) => b.trackExpiry && b.daysLeft <= 1)
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [batches, products, activeBranchId]);

  // Inventory Management Actions (Store-Room, Supplies & Suppliers)
  const addSupplier = (supplier: Omit<Supplier, 'id' | 'createdAt'>): Supplier => {
    const created: Supplier = {
      ...supplier,
      id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      createdAt: TODAY_ISO,
    };
    setSuppliers((prev) => [created, ...prev]);
    pushToast(`Supplier "${created.name}" added.`);
    return created;
  };

  const updateSupplier = (supplier: Supplier) => {
    setSuppliers((prev) => prev.map((s) => (s.id === supplier.id ? supplier : s)));
    setInventoryItems((prev) =>
      prev.map((item) =>
        item.supplierId === supplier.id ? { ...item, supplierName: supplier.name } : item
      )
    );
    pushToast(`Updated supplier "${supplier.name}".`);
  };

  const addInventoryItem = (item: Omit<InventoryItem, 'id' | 'lastUpdated'>): InventoryItem => {
    const now = new Date().toISOString();
    const targetBranchId = item.branchId ?? activeBranchId;
    const targetBranchName =
      item.branchName ?? branches.find((b) => b.id === targetBranchId)?.name ?? activeBranch?.name;

    const created: InventoryItem = {
      ...item,
      quantity: roundQty(item.quantity),
      unitCost: roundCurrency(item.unitCost),
      sellingPrice: item.sellingPrice !== undefined ? roundCurrency(item.sellingPrice) : undefined,
      status: item.status ?? 'Active',
      id: `inv-${Date.now()}`,
      lastUpdated: now,
      branchId: targetBranchId,
      branchName: targetBranchName,
    };
    setInventoryItems((prev) => [created, ...prev]);
    if (created.quantity > 0) {
      setInventoryTxns((prev) => [
        {
          id: `itx-${Date.now()}`,
          itemId: created.id,
          itemName: created.name,
          type: 'Stock In',
          quantityDelta: created.quantity,
          previousQty: 0,
          updatedQty: created.quantity,
          unit: created.unit,
          purchaseCost: roundCurrency(created.quantity * created.unitCost),
          supplierId: created.supplierId,
          supplierName: created.supplierName,
          batchNumber: created.batchNumber,
          storageLocation: created.storageLocation,
          reason: 'Opening inventory item balance',
          expiryDate: created.expiryDate,
          timestamp: now,
          performedBy: currentUser?.name ?? 'Staff',
          staffId: currentUser?.id,
          branchId: targetBranchId,
          branchName: targetBranchName,
        },
        ...prev,
      ]);
    }
    pushToast(`Inventory item "${created.name}" added.`);
    return created;
  };

  const updateInventoryItem = (updated: InventoryItem) => {
    const existing = inventoryItems.find((item) => item.id === updated.id);
    const now = new Date().toISOString();
    const roundedQty = roundQty(updated.quantity);
    const normalizedUpdated = {
      ...updated,
      quantity: roundedQty,
      unitCost: roundCurrency(updated.unitCost),
      sellingPrice: updated.sellingPrice !== undefined ? roundCurrency(updated.sellingPrice) : undefined,
      lastUpdated: now,
    };

    setInventoryItems((prev) =>
      prev.map((item) => (item.id === updated.id ? normalizedUpdated : item))
    );

    if (existing && Math.abs(roundedQty - existing.quantity) > 0.0001) {
      const delta = roundQty(roundedQty - existing.quantity);
      setInventoryTxns((prev) => [
        {
          id: `itx-${Date.now()}`,
          itemId: normalizedUpdated.id,
          itemName: normalizedUpdated.name,
          type: 'Adjustment',
          quantityDelta: delta,
          previousQty: existing.quantity,
          updatedQty: roundedQty,
          unit: normalizedUpdated.unit,
          storageLocation: normalizedUpdated.storageLocation,
          reason: 'Updated via Edit Inventory Item',
          timestamp: now,
          performedBy: currentUser?.name ?? 'Staff',
          staffId: currentUser?.id,
          branchId: normalizedUpdated.branchId ?? activeBranchId,
          branchName: normalizedUpdated.branchName ?? activeBranch?.name,
        },
        ...prev,
      ]);
    }

    pushToast(`Updated "${updated.name}".`);
  };

  const recordStockIn = ({
    itemId,
    quantity,
    purchaseCost,
    supplierId,
    supplierName,
    referenceNumber,
    batchNumber,
    storageLocation,
    expiryDate,
    reason,
    notes,
  }: {
    itemId: string;
    quantity: number;
    purchaseCost?: number;
    supplierId?: string;
    supplierName?: string;
    referenceNumber?: string;
    batchNumber?: string;
    storageLocation?: string;
    expiryDate?: string;
    reason?: string;
    notes?: string;
  }) => {
    if (!hasPermission('inventory', 'create')) {
      pushToast('Permission denied: cannot record inventory stock in.', 'error');
      return;
    }
    if (activeBranch?.status === 'Inactive') {
      pushToast(`${activeBranch.name} is Inactive. Activate branch before receiving stock.`, 'error');
      return;
    }
    const item = inventoryItems.find((i) => i.id === itemId);
    const addQty = roundQty(quantity);
    if (!item || addQty <= 0) return;
    const prevQty = roundQty(item.quantity);
    const updatedQty = roundQty(prevQty + addQty);
    const now = new Date().toISOString();

    setInventoryItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              quantity: updatedQty,
              supplierId: supplierId || i.supplierId,
              supplierName: supplierName?.trim() || i.supplierName,
              batchNumber: batchNumber?.trim() || i.batchNumber,
              storageLocation: storageLocation?.trim() || i.storageLocation,
              expiryDate: expiryDate || i.expiryDate,
              lastUpdated: now,
            }
          : i
      )
    );

    setInventoryTxns((prev) => [
      {
        id: `itx-${Date.now()}`,
        itemId,
        itemName: item.name,
        type: 'Stock In',
        quantityDelta: addQty,
        previousQty: prevQty,
        updatedQty,
        unit: item.unit,
        purchaseCost: purchaseCost !== undefined ? roundCurrency(purchaseCost) : undefined,
        supplierId: supplierId || item.supplierId,
        supplierName: supplierName?.trim() || item.supplierName || undefined,
        referenceNumber: referenceNumber?.trim() || undefined,
        batchNumber: batchNumber?.trim() || undefined,
        storageLocation: storageLocation?.trim() || item.storageLocation,
        reason: reason?.trim() || 'Supplier delivery received',
        notes: notes?.trim() || undefined,
        expiryDate: expiryDate || undefined,
        timestamp: now,
        performedBy: currentUser?.name ?? 'Staff',
        staffId: currentUser?.id,
        branchId: item.branchId ?? activeBranchId,
        branchName: item.branchName ?? activeBranch?.name,
      },
      ...prev,
    ]);

    pushEventNotification({
      title: 'Inventory Stock Received',
      message: `+${formatStockQty(quantity, item.unit)} ${item.name}${
        supplierName ? ` from ${supplierName}` : ''
      }.`,
      category: 'inventory',
      severity: 'info',
      targetNav: 'inventory',
    });

    pushToast(`Stock In: +${quantity} ${item.unit} of ${item.name}.`);
  };

  const recordBatchStockIn = ({
    supplierId,
    supplierName,
    invoiceNumber,
    receivedDate,
    storageLocation,
    notes,
    attachmentName,
    attachmentDataUrl,
    pendingReceiptId,
    lines,
  }: {
    supplierId?: string;
    supplierName: string;
    invoiceNumber?: string;
    receivedDate: string;
    storageLocation?: string;
    notes?: string;
    attachmentName?: string;
    attachmentDataUrl?: string;
    pendingReceiptId?: string;
    lines: {
      itemId: string;
      quantity: number;
      unitCost: number;
      batchNumber?: string;
      expiryDate?: string;
    }[];
  }): boolean => {
    if (!hasPermission('inventory', 'create')) {
      pushToast('Permission denied: cannot record stock receipts.', 'error');
      return false;
    }
    if (activeBranch?.status === 'Inactive') {
      pushToast(`${activeBranch.name} is Inactive. Activate branch before receiving stock.`, 'error');
      return false;
    }
    const validLines = lines.filter((l) => l.itemId && l.quantity > 0 && l.unitCost >= 0);
    if (validLines.length === 0) {
      pushToast('Add at least one valid item line to confirm stock receipt.', 'error');
      return false;
    }

    const nowTime = new Date().toTimeString().slice(0, 8);
    const timestamp = receivedDate ? `${receivedDate}T${nowTime}` : new Date().toISOString();
    const newTxns: InventoryTransaction[] = [];

    const runningQtyMap = new Map<string, number>();
    inventoryItems.forEach((i) => runningQtyMap.set(i.id, i.quantity));

    const itemUpdates = new Map<
      string,
      {
        quantity: number;
        unitCost?: number;
        supplierId?: string;
        supplierName?: string;
        batchNumber?: string;
        storageLocation?: string;
        expiryDate?: string;
      }
    >();

    validLines.forEach((line, idx) => {
      const item = inventoryItems.find((i) => i.id === line.itemId);
      if (!item) return;
      const addQty = roundQty(line.quantity);
      const unitCost = roundCurrency(line.unitCost);
      const prevQty = roundQty(runningQtyMap.get(item.id) ?? item.quantity);
      const updatedQty = roundQty(prevQty + addQty);
      runningQtyMap.set(item.id, updatedQty);

      const lineCost = roundCurrency(addQty * unitCost);
      itemUpdates.set(item.id, {
        quantity: updatedQty,
        unitCost: unitCost > 0 ? unitCost : item.unitCost,
        supplierId: supplierId || item.supplierId,
        supplierName: supplierName.trim() || item.supplierName,
        batchNumber: line.batchNumber?.trim() || item.batchNumber,
        storageLocation: storageLocation?.trim() || item.storageLocation,
        expiryDate: line.expiryDate || item.expiryDate,
      });

      newTxns.push({
        id: `itx-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        itemId: item.id,
        itemName: item.name,
        type: 'Stock In',
        quantityDelta: addQty,
        previousQty: prevQty,
        updatedQty,
        unit: item.unit,
        purchaseCost: lineCost,
        supplierId: supplierId || item.supplierId,
        supplierName: supplierName.trim() || item.supplierName,
        referenceNumber: invoiceNumber?.trim() || undefined,
        batchNumber: line.batchNumber?.trim() || undefined,
        storageLocation: storageLocation?.trim() || item.storageLocation,
        reason: invoiceNumber?.trim()
          ? `Supplier delivery (${invoiceNumber.trim()})`
          : 'Supplier delivery received',
        notes: notes?.trim() || undefined,
        attachmentName,
        attachmentDataUrl,
        expiryDate: line.expiryDate || undefined,
        timestamp,
        performedBy: currentUser?.name ?? 'Staff',
        staffId: currentUser?.id,
        branchId: item.branchId ?? activeBranchId,
        branchName: item.branchName ?? activeBranch?.name,
      });
    });

    if (newTxns.length === 0) return false;

    setInventoryItems((prev) =>
      prev.map((item) => {
        const upd = itemUpdates.get(item.id);
        if (!upd) return item;
        return {
          ...item,
          quantity: upd.quantity,
          unitCost: upd.unitCost ?? item.unitCost,
          supplierId: upd.supplierId,
          supplierName: upd.supplierName,
          batchNumber: upd.batchNumber,
          storageLocation: upd.storageLocation,
          expiryDate: upd.expiryDate,
          lastUpdated: timestamp,
        };
      })
    );

    setInventoryTxns((prev) => [...newTxns.reverse(), ...prev]);

    if (pendingReceiptId) {
      setPendingReceipts((prev) => prev.filter((r) => r.id !== pendingReceiptId));
    }

    const totalValue = newTxns.reduce((s, t) => s + (t.purchaseCost ?? 0), 0);
    pushEventNotification({
      title: `Stock In Receipt${invoiceNumber ? ` · ${invoiceNumber}` : ''}`,
      message: `Received ${newTxns.length} item${newTxns.length > 1 ? 's' : ''} (₹${totalValue.toFixed(
        0
      )}) from ${supplierName}.`,
      category: 'inventory',
      severity: 'info',
      targetNav: 'inventory',
    });

    pushToast(
      `Received ${newTxns.length} item${newTxns.length > 1 ? 's' : ''} from ${supplierName}.`
    );
    return true;
  };

  const savePendingReceipt = ({
    supplierId,
    supplierName,
    referenceNumber,
    expectedDate,
    storageLocation,
    notes,
    attachmentName,
    attachmentDataUrl,
    lines,
  }: {
    supplierId?: string;
    supplierName: string;
    referenceNumber?: string;
    expectedDate: string;
    storageLocation?: string;
    notes?: string;
    attachmentName?: string;
    attachmentDataUrl?: string;
    lines: PendingStockReceiptLine[];
  }): PendingStockReceipt => {
    const nextRef =
      referenceNumber?.trim() || `PO-BC-${116 + pendingReceipts.length}`;
    const created: PendingStockReceipt = {
      id: `prec-${Date.now()}`,
      referenceNumber: nextRef,
      supplierId,
      supplierName: supplierName.trim(),
      expectedDate: expectedDate || TODAY_ISO,
      storageLocation: storageLocation?.trim() || undefined,
      notes: notes?.trim() || undefined,
      attachmentName,
      attachmentDataUrl,
      lines,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.name ?? 'Staff',
      branchId: activeBranchId,
      branchName: activeBranch?.name,
    };
    setPendingReceipts((prev) => [created, ...prev]);
    pushToast(`Saved pending stock movement ${created.referenceNumber}.`);
    return created;
  };

  const confirmPendingReceipt = (receiptId: string): boolean => {
    const receipt = pendingReceipts.find((r) => r.id === receiptId);
    if (!receipt) return false;
    return recordBatchStockIn({
      supplierId: receipt.supplierId,
      supplierName: receipt.supplierName,
      invoiceNumber: receipt.referenceNumber,
      receivedDate: TODAY_ISO,
      storageLocation: receipt.storageLocation,
      notes: receipt.notes,
      attachmentName: receipt.attachmentName,
      attachmentDataUrl: receipt.attachmentDataUrl,
      pendingReceiptId: receipt.id,
      lines: receipt.lines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        unitCost: l.unitCost,
        batchNumber: l.batchNumber,
        expiryDate: l.expiryDate,
      })),
    });
  };

  const cancelPendingReceipt = (receiptId: string) => {
    const target = pendingReceipts.find((r) => r.id === receiptId);
    setPendingReceipts((prev) => prev.filter((r) => r.id !== receiptId));
    if (target) {
      pushToast(`Cancelled pending receipt ${target.referenceNumber}.`, 'warning');
    }
  };

  const recordStockOut = ({
    itemId,
    quantity,
    reason,
    referenceNumber,
    date,
    notes,
  }: {
    itemId: string;
    quantity: number;
    reason: string;
    referenceNumber?: string;
    date?: string;
    notes?: string;
  }): boolean => {
    if (!hasPermission('inventory', 'edit')) {
      pushToast('Permission denied: cannot issue stock out.', 'error');
      return false;
    }
    if (activeBranch?.status === 'Inactive') {
      pushToast(`${activeBranch.name} is Inactive. Activate branch to issue stock.`, 'error');
      return false;
    }
    const item = inventoryItems.find((i) => i.id === itemId);
    const outQty = roundQty(quantity);
    if (!item || outQty <= 0) {
      pushToast('Enter a valid stock-out quantity greater than zero.', 'error');
      return false;
    }
    if (outQty > roundQty(item.quantity)) {
      pushToast(`Cannot issue more than available stock (${formatStockQty(item.quantity, item.unit)}).`, 'error');
      return false;
    }
    const prevQty = roundQty(item.quantity);
    const updatedQty = Math.max(0, roundQty(prevQty - outQty));
    const nowTime = new Date().toTimeString().slice(0, 8);
    const timestamp = date ? `${date}T${nowTime}` : new Date().toISOString();

    setInventoryItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity: updatedQty, lastUpdated: timestamp } : i))
    );

    setInventoryTxns((prev) => [
      {
        id: `itx-${Date.now()}`,
        itemId,
        itemName: item.name,
        type: 'Stock Out',
        quantityDelta: -outQty,
        previousQty: prevQty,
        updatedQty,
        unit: item.unit,
        referenceNumber: referenceNumber?.trim() || undefined,
        storageLocation: item.storageLocation,
        reason: reason.trim() || 'Issued for kitchen / counter use',
        notes: notes?.trim() || undefined,
        timestamp,
        performedBy: currentUser?.name ?? 'Staff',
        staffId: currentUser?.id,
        branchId: item.branchId ?? activeBranchId,
        branchName: item.branchName ?? activeBranch?.name,
      },
      ...prev,
    ]);

    if (updatedQty <= 0) {
      pushEventNotification({
        title: 'Inventory Out of Stock',
        message: `${item.name} is now out of stock (0 ${item.unit}).`,
        category: 'out_of_stock',
        severity: 'critical',
        targetNav: 'inventory',
      });
    } else if (updatedQty <= item.minStockLevel) {
      pushEventNotification({
        title: 'Inventory Low Stock',
        message: `${item.name} dropped to ${formatStockQty(updatedQty, item.unit)}.`,
        category: 'low_stock',
        severity: 'warning',
        targetNav: 'inventory',
      });
    }

    pushToast(`Stock Out: -${outQty} ${item.unit} of ${item.name}.`, 'warning');
    return true;
  };

  const recordInventoryAdjustment = ({
    itemId,
    newQuantity,
    reason,
    date,
    notes,
  }: {
    itemId: string;
    newQuantity: number;
    reason: string;
    date?: string;
    notes?: string;
  }): boolean => {
    if (!hasPermission('inventory', 'edit')) {
      pushToast('Permission denied: cannot adjust store-room stock.', 'error');
      return false;
    }
    const item = inventoryItems.find((i) => i.id === itemId);
    if (!item || newQuantity < 0) return false;
    const safeNew = Math.max(0, roundQty(newQuantity));
    const prevQty = roundQty(item.quantity);
    const delta = roundQty(safeNew - prevQty);
    if (delta === 0) {
      pushToast('Adjusted quantity matches current stock. No change recorded.', 'warning');
      return false;
    }
    const nowTime = new Date().toTimeString().slice(0, 8);
    const timestamp = date ? `${date}T${nowTime}` : new Date().toISOString();

    setInventoryItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantity: safeNew, lastUpdated: timestamp } : i))
    );

    setInventoryTxns((prev) => [
      {
        id: `itx-${Date.now()}`,
        itemId,
        itemName: item.name,
        type: 'Adjustment',
        quantityDelta: delta,
        previousQty: prevQty,
        updatedQty: safeNew,
        unit: item.unit,
        storageLocation: item.storageLocation,
        reason: reason.trim() || 'Physical audit adjustment',
        notes: notes?.trim() || undefined,
        timestamp,
        performedBy: currentUser?.name ?? 'Staff',
        staffId: currentUser?.id,
        branchId: item.branchId ?? activeBranchId,
        branchName: item.branchName ?? activeBranch?.name,
      },
      ...prev,
    ]);

    pushToast(`Adjusted ${item.name} to ${safeNew} ${item.unit}.`);
    return true;
  };

  // Cart & POS helpers
  const selectCartCustomer = (customer: Customer | null) => {
    if (!customer) {
      setCartCustomerId(undefined);
      return;
    }
    setCartCustomerId(customer.id);
    setCartCustomerName(customer.name);
    setCartCustomerPhone(customer.phone);
  };

  const addToCart = (item: Omit<CartItem, 'lineId'>) => {
    const normalizedItem: Omit<CartItem, 'lineId'> = {
      ...item,
      unitPrice: roundCurrency(item.unitPrice),
      quantity: roundQty(item.quantity),
      baseUnitDeduction: roundQty(item.baseUnitDeduction),
    };
    setCart((prev) => {
      const existing = prev.find(
        (c) =>
          c.productId === normalizedItem.productId &&
          c.variantId === normalizedItem.variantId &&
          c.unitPrice === normalizedItem.unitPrice &&
          (c.notes || '') === (normalizedItem.notes || '')
      );
      if (existing) {
        return prev.map((c) =>
          c.lineId === existing.lineId
            ? { ...c, quantity: roundQty(c.quantity + normalizedItem.quantity) }
            : c
        );
      }
      return [
        ...prev,
        {
          ...normalizedItem,
          lineId: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        },
      ];
    });
  };

  const updateCartQty = (lineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.lineId === lineId ? { ...c, quantity: roundQty(c.quantity + delta) } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const removeCartItem = (lineId: string) => {
    setCart((prev) => prev.filter((c) => c.lineId !== lineId));
  };

  const clearCart = () => {
    setCart([]);
    setCartCustomerName('');
    setCartCustomerPhone('');
    setCartCustomerId(undefined);
    setDiscountType('flat');
    setDiscountValue(0);
    setPackagingCharge(0);
  };

  const activeBranchTaxRate = activeBranch?.operationalSettings.taxRate ?? settings.defaultTaxRate;
  const hasBranchTaxOverride =
    Boolean(activeBranch) &&
    activeBranch.operationalSettings.taxRate !== settings.defaultTaxRate;

  const cartTotals = useMemo(() => {
    return computeOrderFinancials({
      items: cart,
      discountType,
      discountValue,
      packagingCharge,
      activeBranchTaxRate,
      hasBranchTaxOverride,
    });
  }, [cart, discountType, discountValue, packagingCharge, activeBranchTaxRate, hasBranchTaxOverride]);

  // Variant-level & Group-Bulk FIFO Batch Deduction & Movement Logging (branch-scoped)
  const deductStockFIFO = (items: CartItem[], billNumber: string) => {
    const newLogs: StockMovementLog[] = [];
    const updatedBatches = batches.map((b) => ({ ...b }));
    const nowIso = new Date().toISOString();

    for (const item of items) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) continue;
      if (getPreparationType(prod) === 'Made Fresh') continue;

      const exactVariant = prod.variants.find((v) => v.id === item.variantId);
      const fallbackVariant = exactVariant ?? getProductDefaultVariant(prod);
      const targetVariantId = exactVariant?.id ?? fallbackVariant?.id;

      // Group Stock product: deduct from pre-split variant packs first (if matched), then from Bulk Pool
      if (prod.isGroupStock) {
        let remainingQty = roundQty(item.quantity);
        if (remainingQty <= 0) continue;

        if (exactVariant) {
          const prevVarStock = roundQty(
            updatedBatches
              .filter(
                (b) =>
                  b.productId === item.productId &&
                  b.variantId === exactVariant.id &&
                  b.quantity > 0 &&
                  (b.branchId ?? 'br-1') === activeBranchId
              )
              .reduce((s, b) => s + b.quantity, 0)
          );
          if (prevVarStock > 0) {
            const varBatches = updatedBatches
              .filter(
                (b) =>
                  b.productId === item.productId &&
                  b.variantId === exactVariant.id &&
                  b.quantity > 0 &&
                  (b.branchId ?? 'br-1') === activeBranchId
              )
              .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
            let takenFromVar = 0;
            let lastVarBatch = varBatches[0]?.batchCode ?? 'COUNTER';
            for (const batch of varBatches) {
              if (remainingQty <= 0) break;
              const taken = Math.min(batch.quantity, remainingQty);
              batch.quantity = Math.max(0, roundQty(batch.quantity - taken));
              batch.lastUpdated = nowIso;
              remainingQty = roundQty(remainingQty - taken);
              takenFromVar = roundQty(takenFromVar + taken);
              lastVarBatch = batch.batchCode;
            }
            if (takenFromVar > 0) {
              newLogs.push({
                id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                productId: item.productId,
                productName: item.productName,
                variantId: exactVariant.id,
                variantLabel: exactVariant.label,
                batchCode: lastVarBatch,
                type: 'POS Sale',
                delta: -takenFromVar,
                previousQty: prevVarStock,
                newQty: Math.max(0, roundQty(prevVarStock - takenFromVar)),
                unitLabel: getVariantUnitLabel(prod, exactVariant),
                reason: `Counter Bill ${billNumber}`,
                referenceNumber: billNumber,
                timestamp: nowIso,
                performedBy: currentUser?.name ?? 'Staff',
                staffId: currentUser?.id,
                branchId: activeBranchId,
                branchName: activeBranch?.name,
              });
            }
          }
        }

        if (remainingQty > 0) {
          const bulkUnit = prod.bulkUnitLabel || prod.baseUnitLabel || 'kg';
          const bulkPerOrderUnit = exactVariant
            ? getBulkConversionFactor(prod, exactVariant)
            : bulkUnit.toLowerCase() === 'g'
            ? roundQty(item.weightInGrams ?? fallbackVariant?.weightGrams ?? 500)
            : roundQty((item.weightInGrams ?? fallbackVariant?.weightGrams ?? 500) / 1000);
          let bulkToDeduct = roundQty(remainingQty * bulkPerOrderUnit);
          if (bulkToDeduct > 0) {
            const prevBulk = roundQty(
              updatedBatches
                .filter(
                  (b) =>
                    b.productId === item.productId &&
                    b.variantId === BULK_STOCK_VARIANT_ID &&
                    b.quantity > 0 &&
                    (b.branchId ?? 'br-1') === activeBranchId
                )
                .reduce((s, b) => s + b.quantity, 0)
            );
            const bulkBatches = updatedBatches
              .filter(
                (b) =>
                  b.productId === item.productId &&
                  b.variantId === BULK_STOCK_VARIANT_ID &&
                  b.quantity > 0 &&
                  (b.branchId ?? 'br-1') === activeBranchId
              )
              .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
            let bulkTaken = 0;
            let lastBulkCode = bulkBatches[0]?.batchCode ?? 'BULK';
            for (const batch of bulkBatches) {
              if (bulkToDeduct <= 0) break;
              const taken = Math.min(batch.quantity, bulkToDeduct);
              batch.quantity = Math.max(0, roundQty(batch.quantity - taken));
              batch.lastUpdated = nowIso;
              bulkToDeduct = roundQty(bulkToDeduct - taken);
              bulkTaken = roundQty(bulkTaken + taken);
              lastBulkCode = batch.batchCode;
            }
            if (bulkTaken > 0) {
              newLogs.push({
                id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                productId: item.productId,
                productName: item.productName,
                variantId: BULK_STOCK_VARIANT_ID,
                variantLabel: 'Bulk Pool',
                batchCode: lastBulkCode,
                type: 'POS Sale',
                delta: -bulkTaken,
                previousQty: prevBulk,
                newQty: Math.max(0, roundQty(prevBulk - bulkTaken)),
                unitLabel: bulkUnit,
                reason: `Counter Bill ${billNumber} (${item.variantLabel} × ${remainingQty})`,
                referenceNumber: billNumber,
                timestamp: nowIso,
                performedBy: currentUser?.name ?? 'Staff',
                staffId: currentUser?.id,
                branchId: activeBranchId,
                branchName: activeBranch?.name,
              });
            }
          }
        }
        continue;
      }

      let toDeduct = exactVariant
        ? roundQty(item.quantity)
        : roundQty(
            ((item.weightInGrams ?? fallbackVariant?.weightGrams ?? 500) /
              Math.max(1, fallbackVariant?.weightGrams ?? 500)) *
              item.quantity
          );

      if (toDeduct <= 0) continue;

      const prevVariantStock = roundQty(
        updatedBatches
          .filter(
            (b) =>
              b.productId === item.productId &&
              (!targetVariantId || b.variantId === targetVariantId) &&
              b.quantity > 0 &&
              (b.branchId ?? 'br-1') === activeBranchId
          )
          .reduce((s, b) => s + b.quantity, 0)
      );

      const variantBatches = updatedBatches
        .filter(
          (b) =>
            b.productId === item.productId &&
            (!targetVariantId || b.variantId === targetVariantId) &&
            b.quantity > 0 &&
            (b.branchId ?? 'br-1') === activeBranchId
        )
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

      let totalTaken = 0;
      let lastBatchCode = variantBatches[0]?.batchCode ?? 'COUNTER';

      for (const batch of variantBatches) {
        if (toDeduct <= 0) break;
        const taken = Math.min(batch.quantity, toDeduct);
        batch.quantity = Math.max(0, roundQty(batch.quantity - taken));
        batch.lastUpdated = nowIso;
        toDeduct = roundQty(toDeduct - taken);
        totalTaken = roundQty(totalTaken + taken);
        lastBatchCode = batch.batchCode;
      }

      if (totalTaken > 0) {
        const nextStock = Math.max(0, roundQty(prevVariantStock - totalTaken));
        const unitLabel = getVariantUnitLabel(prod, exactVariant ?? fallbackVariant);
        newLogs.push({
          id: `sm-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          productId: item.productId,
          productName: item.productName,
          variantId: targetVariantId,
          variantLabel: exactVariant?.label ?? item.variantLabel,
          batchCode: lastBatchCode,
          type: 'POS Sale',
          delta: -totalTaken,
          previousQty: prevVariantStock,
          newQty: nextStock,
          unitLabel,
          reason: `Counter Bill ${billNumber}`,
          referenceNumber: billNumber,
          timestamp: nowIso,
          performedBy: currentUser?.name ?? 'Staff',
          staffId: currentUser?.id,
          branchId: activeBranchId,
          branchName: activeBranch?.name,
        });
      }
    }

    setBatches(updatedBatches);
    if (newLogs.length > 0) {
      setStockMovements((prev) => [...newLogs, ...prev]);
    }
  };

  const completeSale = ({
    payments,
  }: {
    payments: PaymentEntry[];
  }): CompletedOrder | null => {
    if (!hasPermission('pos', 'create')) {
      pushToast('Permission denied: your role cannot complete POS bills.', 'error');
      return null;
    }
    if (activeBranch?.status === 'Inactive') {
      pushToast(
        `${activeBranch.name} is currently Inactive. Switch to an Active branch or activate this branch to bill.`,
        'error'
      );
      return null;
    }
    if (cart.length === 0) {
      pushToast('Add at least one bakery or sweets item to bill.', 'warning');
      return null;
    }

    const normalizedPayments = payments.map((p) => ({
      ...p,
      amount: roundCurrency(p.amount),
    }));
    const totalPaid = roundCurrency(normalizedPayments.reduce((s, p) => s + p.amount, 0));
    if (Math.abs(totalPaid - cartTotals.grandTotal) > 0.05) {
      pushToast('Payment split total must match the Grand Total.', 'error');
      return null;
    }

    let resolvedCustomerId = cartCustomerId;
    const trimmedName = cartCustomerName.trim() || 'Walk-in Customer';
    const trimmedPhone = cartCustomerPhone.trim();
    if (!resolvedCustomerId && trimmedPhone) {
      const existing = customers.find(
        (c) => c.phone.replace(/\s+/g, '') === trimmedPhone.replace(/\s+/g, '')
      );
      if (existing) {
        resolvedCustomerId = existing.id;
      } else {
        const newCust: Customer = {
          id: `cust-${Date.now()}`,
          name: trimmedName,
          phone: trimmedPhone,
          createdAt: TODAY_ISO,
        };
        setCustomers((prev) => [newCust, ...prev]);
        resolvedCustomerId = newCust.id;
      }
    }

    const nextNumber = 1051 + orders.length;
    const billNumber = `BC-${nextNumber}`;

    const completed: CompletedOrder = {
      id: `ord-${Date.now()}`,
      billNumber,
      createdAt: new Date().toISOString(),
      customerId: resolvedCustomerId,
      customerName: trimmedName,
      customerPhone: trimmedPhone || undefined,
      items: [...cart],
      subtotal: cartTotals.subtotal,
      discountType,
      discountValue,
      discountAmount: cartTotals.discountAmount,
      packagingCharge: roundCurrency(packagingCharge),
      taxAmount: cartTotals.taxAmount,
      grandTotal: cartTotals.grandTotal,
      payments: normalizedPayments,
      cashierName: currentUser?.name ?? 'Staff',
      staffId: currentUser?.id,
      branchId: activeBranchId,
      branchName: activeBranch?.name,
      status: 'Completed',
    };

    deductStockFIFO(cart, billNumber);
    setOrders((prev) => [completed, ...prev]);
    clearCart();
    setActiveReceipt(completed);
    pushEventNotification({
      title: `Bill ${billNumber} Settled`,
      message: `${trimmedName} · ₹${completed.grandTotal.toFixed(2)} via ${normalizedPayments
        .map((p) => p.method)
        .join(' + ')}`,
      category: 'order_update',
      severity: 'info',
      targetNav: 'reports',
    });
    pushToast(`Bill ${billNumber} completed (${normalizedPayments.map((p) => p.method).join(' + ')}).`);
    return completed;
  };

  const holdCurrentOrder = (notes?: string) => {
    if (!hasPermission('pos', 'create')) {
      pushToast('Permission denied: cannot hold bills.', 'error');
      return;
    }
    if (activeBranch?.status === 'Inactive') {
      pushToast(`${activeBranch.name} is Inactive. Activate branch to hold bills.`, 'error');
      return;
    }
    if (cart.length === 0) {
      pushToast('Current bill is empty.', 'warning');
      return;
    }
    const count = heldOrders.length + 1;
    const held: HeldOrder = {
      id: `hold-${Date.now()}`,
      ticketLabel: `Counter Hold #${String(count).padStart(2, '0')}`,
      heldAt: new Date().toISOString(),
      customerId: cartCustomerId,
      customerName: cartCustomerName.trim() || 'Walk-in Customer',
      customerPhone: cartCustomerPhone.trim() || undefined,
      items: [...cart],
      discountType,
      discountValue,
      packagingCharge,
      notes,
      staffId: currentUser?.id,
      branchId: activeBranchId,
      branchName: activeBranch?.name,
    };
    setHeldOrders((prev) => [held, ...prev]);
    clearCart();
    pushToast(`${held.ticketLabel} placed on hold.`);
  };

  const resumeHeldOrder = (heldId: string) => {
    const found = heldOrders.find((h) => h.id === heldId);
    if (!found) return;
    if (cart.length > 0) {
      const autoHold: HeldOrder = {
        id: `hold-${Date.now()}`,
        ticketLabel: `Auto-Hold #${heldOrders.length + 1}`,
        heldAt: new Date().toISOString(),
        customerId: cartCustomerId,
        customerName: cartCustomerName.trim() || 'Walk-in Customer',
        customerPhone: cartCustomerPhone.trim() || undefined,
        items: [...cart],
        discountType,
        discountValue,
        packagingCharge,
        staffId: currentUser?.id,
        branchId: activeBranchId,
        branchName: activeBranch?.name,
      };
      setHeldOrders((prev) => [autoHold, ...prev.filter((h) => h.id !== heldId)]);
    } else {
      setHeldOrders((prev) => prev.filter((h) => h.id !== heldId));
    }

    setCart(found.items);
    setCartCustomerId(found.customerId);
    setCartCustomerName(found.customerName === 'Walk-in Customer' ? '' : found.customerName);
    setCartCustomerPhone(found.customerPhone || '');
    setDiscountType(found.discountType);
    setDiscountValue(found.discountValue);
    setPackagingCharge(found.packagingCharge);
    setActiveNav('pos');
    pushToast(`Resumed ${found.ticketLabel} in POS Billing.`);
  };

  const deleteHeldOrder = (heldId: string) => {
    setHeldOrders((prev) => prev.filter((h) => h.id !== heldId));
    pushToast('Held order removed.', 'warning');
  };

  const refundOrder = (orderId: string) => {
    if (!hasPermission('reports', 'approve') && !hasPermission('pos', 'approve')) {
      pushToast('Permission denied: Manager/Admin approval required to refund bills.', 'error');
      return;
    }
    const target = orders.find((o) => o.id === orderId);
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'Refunded' } : o))
    );
    if (target) {
      pushEventNotification({
        title: `Bill ${target.billNumber} Refunded`,
        message: `Refunded ₹${target.grandTotal.toFixed(2)} for ${target.customerName}.`,
        category: 'order_update',
        severity: 'warning',
        targetNav: 'reports',
      });
    }
    pushToast('Order marked as Refunded.', 'warning');
  };

  // Custom Orders
  const createCustomOrder = (
    order: Omit<CustomOrder, 'id' | 'orderNumber' | 'createdAt'>
  ): CustomOrder => {
    let customerId = order.customerId;
    if (!customerId && order.customerPhone.trim()) {
      const existing = customers.find(
        (c) => c.phone.replace(/\s+/g, '') === order.customerPhone.replace(/\s+/g, '')
      );
      if (existing) {
        customerId = existing.id;
      } else {
        const newCust: Customer = {
          id: `cust-${Date.now()}`,
          name: order.customerName.trim(),
          phone: order.customerPhone.trim(),
          createdAt: TODAY_ISO,
        };
        setCustomers((prev) => [newCust, ...prev]);
        customerId = newCust.id;
      }
    }

    const nextNum = 2044 + customOrders.length;
    const created: CustomOrder = {
      ...order,
      customerId,
      id: `co-${Date.now()}`,
      orderNumber: `CO-${nextNum}`,
      createdAt: new Date().toISOString(),
      staffId: order.staffId ?? currentUser?.id,
      createdByName: order.createdByName ?? currentUser?.name,
      branchId: order.branchId ?? activeBranchId,
      branchName: order.branchName ?? activeBranch?.name,
    };
    setCustomOrders((prev) => [created, ...prev]);
    pushEventNotification({
      title: `New Custom Order ${created.orderNumber}`,
      message: `${created.itemTitle} for ${created.customerName} · Pickup ${created.pickupDate}`,
      category: 'custom_order',
      severity: 'info',
      targetNav: 'custom_orders',
    });
    pushToast(`Custom Order ${created.orderNumber} booked.`);
    return created;
  };

  const updateCustomOrderStatus = (id: string, status: CustomOrderStatus) => {
    const target = customOrders.find((c) => c.id === id);
    setCustomOrders((prev) => prev.map((co) => (co.id === id ? { ...co, status } : co)));
    if (target) {
      pushEventNotification({
        title: `Custom Order ${target.orderNumber} · ${status}`,
        message: `${target.itemTitle} (${target.customerName}) moved to ${status}.`,
        category: 'custom_order',
        severity: status === 'Cancelled' ? 'warning' : 'info',
        targetNav: 'custom_orders',
      });
    }
    pushToast(`Custom order status updated to "${status}".`);
  };

  const collectCustomOrderBalance = (
    id: string,
    method: PaymentMethod
  ): CompletedOrder | null => {
    const co = customOrders.find((c) => c.id === id);
    if (!co) return null;
    const remaining = Math.max(0, roundCurrency(co.totalAmount - co.advancePaid - co.balancePaid));
    if (remaining <= 0) {
      updateCustomOrderStatus(id, 'Handed Over');
      return null;
    }

    setCustomOrders((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, balancePaid: roundCurrency(c.balancePaid + remaining), status: 'Handed Over' }
          : c
      )
    );

    const nextNumber = 1051 + orders.length;
    const billNumber = `BC-${nextNumber}`;
    const settledOrder: CompletedOrder = {
      id: `ord-${Date.now()}`,
      billNumber,
      createdAt: new Date().toISOString(),
      customerId: co.customerId,
      customerName: co.customerName,
      customerPhone: co.customerPhone,
      items: [
        {
          lineId: `co-line-${co.id}`,
          productId: co.productId || 'custom-cake',
          productName: `${co.itemTitle} (${co.orderNumber})`,
          sku: co.orderNumber,
          imageUrl: '',
          unitType: 'piece',
          variantId: 'custom',
          variantLabel: `${co.weightOrSize} · Balance Due (Adv: ₹${co.advancePaid})`,
          unitPrice: remaining,
          quantity: 1,
          taxRate: 0,
          baseUnitDeduction: 0,
          notes: co.cakeInscription,
        },
      ],
      subtotal: remaining,
      discountType: 'flat',
      discountValue: 0,
      discountAmount: 0,
      packagingCharge: 0,
      taxAmount: 0,
      grandTotal: remaining,
      payments: [{ method, amount: remaining }],
      cashierName: currentUser?.name ?? 'Staff',
      staffId: currentUser?.id,
      branchId: co.branchId ?? activeBranchId,
      branchName: co.branchName ?? activeBranch?.name,
      status: 'Completed',
      customOrderId: co.id,
    };

    setOrders((prev) => [settledOrder, ...prev]);
    setActiveReceipt(settledOrder);
    pushEventNotification({
      title: `Custom Order ${co.orderNumber} Handed Over`,
      message: `Collected ₹${remaining} balance from ${co.customerName} via ${method}.`,
      category: 'custom_order',
      severity: 'info',
      targetNav: 'custom_orders',
    });
    pushToast(`Collected ₹${remaining} balance & handed over ${co.orderNumber}.`);
    return settledOrder;
  };

  // Customers (strictly Name & Phone, no Email)
  const addCustomer = (customer: Omit<Customer, 'id' | 'createdAt'>): Customer => {
    const created: Customer = {
      id: `cust-${Date.now()}`,
      name: customer.name,
      phone: customer.phone,
      avatarUrl: customer.avatarUrl,
      notes: customer.notes,
      createdAt: TODAY_ISO,
    };
    setCustomers((prev) => [created, ...prev]);
    pushToast(`Customer "${created.name}" saved.`);
    return created;
  };

  const updateCustomer = (customer: Customer) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customer.id
          ? {
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
              avatarUrl: customer.avatarUrl,
              notes: customer.notes,
              createdAt: customer.createdAt,
            }
          : c
      )
    );
    pushToast(`Updated customer "${customer.name}".`);
  };

  const addGstPaymentRecord = (
    record: Omit<GstPaymentRecord, 'id' | 'updatedAt' | 'updatedBy'>
  ): GstPaymentRecord | null => {
    if (!hasPermission('reports', 'edit') && !hasPermission('reports', 'approve')) {
      pushToast('Permission denied: cannot record GST ITC or payment details.', 'error');
      return null;
    }
    const created: GstPaymentRecord = {
      ...record,
      id: `gst-pay-${Date.now()}`,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name ?? 'Accounts User',
    };
    setGstPaymentRecords((prev) => [created, ...prev]);
    pushToast(`Saved GST record for ${created.periodLabel} (${created.branchName}).`);
    return created;
  };

  const updateGstPaymentRecord = (record: GstPaymentRecord): boolean => {
    if (!hasPermission('reports', 'edit') && !hasPermission('reports', 'approve')) {
      pushToast('Permission denied: cannot update GST ITC or payment details.', 'error');
      return false;
    }
    setGstPaymentRecords((prev) =>
      prev.map((r) =>
        r.id === record.id
          ? {
              ...record,
              updatedAt: new Date().toISOString(),
              updatedBy: currentUser?.name ?? 'Accounts User',
            }
          : r
      )
    );
    pushToast(`Updated GST record for ${record.periodLabel}.`);
    return true;
  };

  // Live Operational Notifications derived from real state + event notifications
  const notifications = useMemo<AppNotification[]>(() => {
    const derived: AppNotification[] = [];

    // 1. Out-of-stock & Low-stock counter finished products per variant (active branch)
    products.forEach((p) => {
      if (!p.isActive) return;
      if (getPreparationType(p) === 'Made Fresh') return;
      if (p.isGroupStock) {
        const bulkQty = batches
          .filter(
            (b) =>
              b.productId === p.id &&
              b.variantId === BULK_STOCK_VARIANT_ID &&
              b.quantity > 0 &&
              (b.branchId ?? 'br-1') === activeBranchId
          )
          .reduce((s, b) => s + b.quantity, 0);
        const bulkUnit = p.bulkUnitLabel || p.baseUnitLabel || 'kg';
        const minAlert = p.minStockAlert || 0;
        if (bulkQty <= 0) {
          const hasAllocated = p.variants.some((v) =>
            batches.some(
              (b) =>
                b.productId === p.id &&
                b.variantId === v.id &&
                b.quantity > 0 &&
                (b.branchId ?? 'br-1') === activeBranchId
            )
          );
          if (!hasAllocated) {
            const id = `alert-oos-${activeBranchId}-${p.id}-bulk`;
            derived.push({
              id,
              title: `Out of Stock: ${p.name} (Bulk Pool)`,
              message: `0 ${bulkUnit} remaining (${activeBranch?.name ?? ''}). Record Stock In.`,
              category: 'out_of_stock',
              severity: 'critical',
              targetNav: 'stock',
              createdAt: `${TODAY_ISO}T08:00:00`,
              read: readAlertIds.includes(id),
            });
          }
        } else if (minAlert > 0 && bulkQty <= minAlert) {
          const id = `alert-low-${activeBranchId}-${p.id}-bulk`;
          derived.push({
            id,
            title: `Low Bulk Stock: ${p.name}`,
            message: `Only ${formatStockQty(bulkQty, bulkUnit)} left in Bulk Pool.`,
            category: 'low_stock',
            severity: 'warning',
            targetNav: 'stock',
            createdAt: `${TODAY_ISO}T08:05:00`,
            read: readAlertIds.includes(id),
          });
        }
        return;
      }
      p.variants.forEach((v) => {
        const qty = batches
          .filter(
            (b) =>
              b.productId === p.id &&
              b.variantId === v.id &&
              b.quantity > 0 &&
              (b.branchId ?? 'br-1') === activeBranchId
          )
          .reduce((s, b) => s + b.quantity, 0);
        const minAlert = getVariantMinStock(p, v);
        const unitLabel = getVariantUnitLabel(p, v);
        if (qty <= 0) {
          const id = `alert-oos-${activeBranchId}-${p.id}-${v.id}`;
          derived.push({
            id,
            title: `Out of Stock: ${p.name} (${v.label})`,
            message: `0 ${unitLabel} remaining (${activeBranch?.name ?? ''}). Record Stock In.`,
            category: 'out_of_stock',
            severity: 'critical',
            targetNav: 'stock',
            createdAt: `${TODAY_ISO}T08:00:00`,
            read: readAlertIds.includes(id),
          });
        } else if (qty <= minAlert) {
          const id = `alert-low-${activeBranchId}-${p.id}-${v.id}`;
          derived.push({
            id,
            title: `Low Stock: ${p.name} (${v.label})`,
            message: `Only ${formatStockQty(qty, unitLabel)} left (min: ${minAlert} ${unitLabel}).`,
            category: 'low_stock',
            severity: 'warning',
            targetNav: 'stock',
            createdAt: `${TODAY_ISO}T08:05:00`,
            read: readAlertIds.includes(id),
          });
        }
      });
    });

    // 2. Expiring counter batches
    expiringSoonBatches.forEach((b) => {
      const id = `alert-exp-${b.id}`;
      derived.push({
        id,
        title: b.daysLeft <= 0 ? `Counter Batch Expired: ${b.productName}` : `Expiring Tomorrow: ${b.productName}`,
        message: `Batch ${b.batchCode} (${formatStockQty(b.quantity, b.unitLabel)}) expires ${b.expiryDate}.`,
        category: 'expiry',
        severity: b.daysLeft <= 0 ? 'critical' : 'warning',
        targetNav: 'stock',
        createdAt: `${TODAY_ISO}T08:10:00`,
        read: readAlertIds.includes(id),
      });
    });

    // 3. Store-room Inventory Management Alerts (active branch)
    inventoryItems
      .filter((item) => (item.branchId ?? 'br-1') === activeBranchId)
      .forEach((item) => {
        if (item.status === 'Inactive') return;
        if (item.quantity <= 0) {
          const id = `alert-inv-oos-${item.id}`;
          derived.push({
            id,
            title: `Inventory Out of Stock: ${item.name}`,
            message: `0 ${item.unit} available in store-room (${item.category}). Record Stock In.`,
            category: 'out_of_stock',
            severity: 'critical',
            targetNav: 'inventory',
            createdAt: item.lastUpdated,
            read: readAlertIds.includes(id),
          });
        } else if (item.quantity <= item.minStockLevel) {
          const id = `alert-inv-low-${item.id}`;
          derived.push({
            id,
            title: `Inventory Low Stock: ${item.name}`,
            message: `${formatStockQty(item.quantity, item.unit)} left (min ${item.minStockLevel} ${item.unit}).`,
            category: 'low_stock',
            severity: 'warning',
            targetNav: 'inventory',
            createdAt: item.lastUpdated,
            read: readAlertIds.includes(id),
          });
        }

        if (item.trackExpiry && item.expiryDate && item.quantity > 0) {
          const dLeft = daysUntil(item.expiryDate, TODAY_ISO);
          if (dLeft <= 3) {
            const id = `alert-inv-exp-${item.id}`;
            derived.push({
              id,
              title:
                dLeft < 0
                  ? `Inventory Item Expired: ${item.name}`
                  : `Inventory Expiring Soon: ${item.name}`,
              message: `${formatStockQty(item.quantity, item.unit)} · Expiry ${item.expiryDate}.`,
              category: 'expiry',
              severity: dLeft < 0 ? 'critical' : 'warning',
              targetNav: 'inventory',
              createdAt: item.lastUpdated,
              read: readAlertIds.includes(id),
            });
          }
        }
      });

    // 4. Pending Custom Orders due today (active branch)
    customOrders
      .filter(
        (co) =>
          (co.branchId ?? 'br-1') === activeBranchId &&
          co.pickupDate === TODAY_ISO &&
          co.status !== 'Handed Over' &&
          co.status !== 'Cancelled'
      )
      .forEach((co) => {
        const id = `alert-co-${co.id}-${co.status}`;
        derived.push({
          id,
          title: `Custom Pickup Today: ${co.orderNumber} (${co.status})`,
          message: `${co.itemTitle} for ${co.customerName} at ${co.pickupTime}.`,
          category: 'custom_order',
          severity: co.status === 'Ready for Pickup' ? 'info' : 'warning',
          targetNav: 'custom_orders',
          createdAt: co.createdAt,
          read: readAlertIds.includes(id),
        });
      });

    return [...eventNotifications, ...derived];
  }, [
    products,
    batches,
    expiringSoonBatches,
    inventoryItems,
    customOrders,
    eventNotifications,
    readAlertIds,
    activeBranchId,
    activeBranch,
  ]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const markNotificationRead = (id: string) => {
    if (id.startsWith('evt-')) {
      setEventNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } else {
      setReadAlertIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }
  };

  const markAllNotificationsRead = () => {
    setEventNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    const alertIds = notifications.filter((n) => !n.id.startsWith('evt-')).map((n) => n.id);
    setReadAlertIds((prev) => Array.from(new Set([...prev, ...alertIds])));
  };

  const resetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSettings(INITIAL_SETTINGS);
    setBranches(INITIAL_BRANCHES);
    setActiveBranchIdState(INITIAL_BRANCHES[0].id);
    setStaffUsers(INITIAL_STAFF);
    setRolePermissions(INITIAL_ROLE_PERMISSIONS);
    setBranchAssignments(INITIAL_BRANCH_ASSIGNMENTS);
    setCurrentUser(INITIAL_STAFF[0]);
    setCategories(INITIAL_CATEGORIES);
    setProducts(INITIAL_PRODUCTS);
    setBatches(INITIAL_STOCK_BATCHES);
    setStockMovements(INITIAL_STOCK_MOVEMENTS);
    setWastageLogs(INITIAL_WASTAGE);
    setInventoryItems(INITIAL_INVENTORY_ITEMS);
    setInventoryTxns(INITIAL_INVENTORY_TXNS);
    setSuppliers(INITIAL_SUPPLIERS);
    setPendingReceipts(INITIAL_PENDING_RECEIPTS);
    setCustomers(INITIAL_CUSTOMERS);
    setOrders(INITIAL_ORDERS);
    setHeldOrders(INITIAL_HELD_ORDERS);
    setCustomOrders(INITIAL_CUSTOM_ORDERS);
    setGstPaymentRecords(INITIAL_GST_PAYMENT_RECORDS);
    setEventNotifications([]);
    setReadAlertIds([]);
    clearCart();
    pushToast('Demo bakery data restored to defaults.');
  };

  return (
    <PosContext.Provider
      value={{
        activeNav,
        setActiveNav,
        globalSearch,
        setGlobalSearch,
        currentUser,
        staffUsers,
        loginUser,
        logoutUser,
        switchUser,
        rolePermissions,
        hasPermission,
        updateRolePermission,
        branches,
        activeBranchId,
        activeBranch,
        authorizedBranches,
        canViewAllBranches,
        setActiveBranchId,
        addBranch,
        updateBranch,
        changeBranchStatus,
        assignBranchManager,
        updateBranchOperationalSettings,
        branchAssignments,
        addStaffMember,
        updateStaffMember,
        changeStaffStatus,
        assignStaffBranch,
        toggleStaffLoginAccess,
        resetStaffCredentials,
        settings,
        updateSettings,
        categories,
        addCategory,
        deleteCategory,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        toggleProductActive,
        toggleProductFavourite,
        batches,
        stockMovements,
        wastageLogs,
        getPreparationType,
        getGroupBulkStock,
        getProductDefaultVariant,
        getVariantUnitLabel,
        getVariantMinStock,
        getVariantStock,
        getVariantEarliestExpiry,
        getVariantLastUpdated,
        getProductStock,
        getProductEarliestExpiry,
        splitGroupStock,
        addStockBatch,
        adjustBatchQuantity,
        updateVariantMinStock,
        logWastage,
        recordMultiStockIn,
        recordMultiVariantStockUpdate,
        recordProductStockOut,
        recordProductStockAdjustment,
        lowStockProducts,
        expiringSoonBatches,
        inventoryItems,
        inventoryTxns,
        suppliers,
        pendingReceipts,
        addSupplier,
        updateSupplier,
        addInventoryItem,
        updateInventoryItem,
        recordStockIn,
        recordBatchStockIn,
        savePendingReceipt,
        confirmPendingReceipt,
        cancelPendingReceipt,
        recordStockOut,
        recordInventoryAdjustment,
        cart,
        cartCustomerName,
        setCartCustomerName,
        cartCustomerPhone,
        setCartCustomerPhone,
        cartCustomerId,
        selectCartCustomer,
        discountType,
        setDiscountType,
        discountValue,
        setDiscountValue,
        packagingCharge,
        setPackagingCharge,
        addToCart,
        updateCartQty,
        removeCartItem,
        clearCart,
        cartTotals,
        orders,
        heldOrders,
        completeSale,
        holdCurrentOrder,
        resumeHeldOrder,
        deleteHeldOrder,
        refundOrder,
        customOrders,
        createCustomOrder,
        updateCustomOrderStatus,
        collectCustomOrderBalance,
        customers,
        addCustomer,
        updateCustomer,
        gstPaymentRecords,
        addGstPaymentRecord,
        updateGstPaymentRecord,
        notifications,
        unreadCount,
        markNotificationRead,
        markAllNotificationsRead,
        activeReceipt,
        setActiveReceipt,
        toasts,
        pushToast,
        dismissToast,
        resetDemoData,
      }}
    >
      {children}
    </PosContext.Provider>
  );
};

export function usePos(): PosContextValue {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error('usePos must be used within PosProvider');
  return ctx;
}
