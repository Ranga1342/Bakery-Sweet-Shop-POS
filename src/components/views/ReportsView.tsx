import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Calendar,
  Eye,
  RotateCcw,
  Search,
  Receipt,
  Package,
  Layers,
  CreditCard,
  AlertTriangle,
  Cake,
  Boxes,
  X,
  Building2,
  Users,
  Percent,
  ChevronDown,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { usePos } from '../../context/PosContext';
import {
  daysUntil,
  formatDateShort,
  formatDateTime,
  formatDecimal,
  formatINR,
  formatINRCompact,
  formatStockQty,
  roundCurrency,
  roundQty,
  TODAY_ISO,
} from '../../utils/formatters';
import { PaymentMethod } from '../../types/pos';
import {
  ExportMetadata,
  exportReportCsv,
  exportReportExcel,
  ExportSheet,
} from '../../utils/reportExport';
import {
  buildTaxGstExportSheets,
  computeTaxGstReport,
  TaxGstReportSection,
} from './TaxGstReportSection';

type ReportType =
  | 'orders'
  | 'product_sales'
  | 'category_sales'
  | 'payments'
  | 'branch_comparison'
  | 'staff_performance'
  | 'expiry_wastage'
  | 'custom_orders'
  | 'inventory_ledger'
  | 'tax_gst';

const REPORT_TYPES: {
  id: ReportType;
  label: string;
  desc: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  {
    id: 'orders',
    label: 'Orders & Daily Sales',
    desc: 'Counter bills, GST & receipt archive',
    icon: Receipt,
  },
  {
    id: 'product_sales',
    label: 'Product-wise Sales',
    desc: 'Revenue, units & share per item',
    icon: Package,
  },
  {
    id: 'category_sales',
    label: 'Category-wise Sales',
    desc: 'Cakes, mithai, breads & boxes mix',
    icon: Layers,
  },
  {
    id: 'payments',
    label: 'Payment Breakdown',
    desc: 'Cash, UPI & Card collections',
    icon: CreditCard,
  },
  {
    id: 'branch_comparison',
    label: 'Branch-wise Performance',
    desc: 'Outlet revenue, orders, avg bill & wastage',
    icon: Building2,
  },
  {
    id: 'staff_performance',
    label: 'Staff Sales Performance',
    desc: 'Counter bills, sales & bookings per staff',
    icon: Users,
  },
  {
    id: 'expiry_wastage',
    label: 'Expiry & Wastage',
    desc: 'Damaged, expired & at-risk batches',
    icon: AlertTriangle,
  },
  {
    id: 'custom_orders',
    label: 'Custom Cake Orders',
    desc: 'Advances collected & pending dues',
    icon: Cake,
  },
  {
    id: 'inventory_ledger',
    label: 'Inventory & Valuation',
    desc: 'Store-room value & stock movements',
    icon: Boxes,
  },
  {
    id: 'tax_gst',
    label: 'Tax & GST',
    desc: 'GST collected, rate slabs, ITC & tax summary',
    icon: Percent,
  },
];

type DatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'this_month'
  | '7d'
  | '30d'
  | 'all'
  | 'custom';

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const dt = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  dt.setDate(dt.getDate() + deltaDays);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const YESTERDAY_ISO = shiftIsoDate(TODAY_ISO, -1);

export const ReportsView: React.FC = () => {
  const {
    settings,
    orders,
    products,
    categories,
    batches,
    wastageLogs,
    customOrders,
    inventoryItems,
    inventoryTxns,
    gstPaymentRecords,
    addGstPaymentRecord,
    updateGstPaymentRecord,
    globalSearch,
    setActiveReceipt,
    refundOrder,
    branches,
    authorizedBranches,
    activeBranchId,
    activeBranch,
    canViewAllBranches,
    staffUsers,
    hasPermission,
    pushToast,
  } = usePos();

  const canApproveRefund =
    hasPermission('reports', 'approve') || hasPermission('pos', 'approve');
  const canManageTaxRecords =
    hasPermission('reports', 'edit') || hasPermission('reports', 'approve');

  const [reportType, setReportType] = useState<ReportType>('orders');
  const [branchFilter, setBranchFilter] = useState<'ACTIVE' | 'ALL' | string>('ACTIVE');
  const [dateRange, setDateRange] = useState<DatePreset>('7d');
  const [fromDate, setFromDate] = useState<string>('2026-11-14');
  const [toDate, setToDate] = useState<string>(TODAY_ISO);
  const [localSearch, setLocalSearch] = useState<string>('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | PaymentMethod>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Completed' | 'Refunded'>('ALL');
  const [customStatusFilter, setCustomStatusFilter] = useState<string>('ALL');
  const [invTxnFilter, setInvTxnFilter] = useState<
    'ALL' | 'Stock In' | 'Stock Out' | 'Adjustment'
  >('ALL');

  // Tax & GST specific filters
  const [gstCategoryFilter, setGstCategoryFilter] = useState<string>('ALL');
  const [gstProductFilter, setGstProductFilter] = useState<string>('ALL');
  const [gstRateFilter, setGstRateFilter] = useState<string>('ALL');

  // Export Menu dropdown state
  const [showExportMenu, setShowExportMenu] = useState<boolean>(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(event.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const query = (localSearch || globalSearch).trim().toLowerCase();

  const resolvedBranchId = useMemo(() => {
    if (branchFilter === 'ACTIVE') return activeBranchId;
    if (branchFilter === 'ALL') {
      return canViewAllBranches ? null : activeBranchId;
    }
    if (
      !canViewAllBranches &&
      !authorizedBranches.some((b) => b.id === branchFilter)
    ) {
      return activeBranchId;
    }
    return branchFilter;
  }, [branchFilter, activeBranchId, canViewAllBranches, authorizedBranches]);

  const resolvedBranchScopeLabel = useMemo(() => {
    if (reportType === 'branch_comparison') {
      return canViewAllBranches ? 'All Branches' : authorizedBranches.map((b) => b.name).join(', ');
    }
    if (!resolvedBranchId) return 'All Branches';
    return branches.find((b) => b.id === resolvedBranchId)?.name ?? activeBranch.name;
  }, [reportType, resolvedBranchId, branches, activeBranch.name, canViewAllBranches, authorizedBranches]);

  const matchesBranch = (branchId?: string): boolean => {
    if (!resolvedBranchId) return true;
    return (branchId ?? 'br-1') === resolvedBranchId;
  };

  // Resolve real wall-clock today alongside demo TODAY_ISO so live counter sales also match presets cleanly
  const realTodayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const realYesterdayIso = useMemo(() => shiftIsoDate(realTodayIso, -1), [realTodayIso]);

  const matchesDateRange = (isoDateOrDateTime: string): boolean => {
    const datePart = isoDateOrDateTime.slice(0, 10);
    if (dateRange === 'today') {
      return datePart === TODAY_ISO || datePart === realTodayIso;
    }
    if (dateRange === 'yesterday') {
      return datePart === YESTERDAY_ISO || datePart === realYesterdayIso;
    }
    if (dateRange === 'this_week') {
      const diffDemo = daysUntil(TODAY_ISO, datePart);
      const diffReal = daysUntil(realTodayIso, datePart);
      return (diffDemo >= 0 && diffDemo <= 6) || (diffReal >= 0 && diffReal <= 6);
    }
    if (dateRange === 'this_month') {
      return (
        datePart.slice(0, 7) === TODAY_ISO.slice(0, 7) ||
        datePart.slice(0, 7) === realTodayIso.slice(0, 7)
      );
    }
    if (dateRange === '7d') {
      const diffDemo = daysUntil(TODAY_ISO, datePart);
      const diffReal = daysUntil(realTodayIso, datePart);
      return (diffDemo >= 0 && diffDemo <= 7) || (diffReal >= 0 && diffReal <= 7);
    }
    if (dateRange === '30d') {
      const diffDemo = daysUntil(TODAY_ISO, datePart);
      const diffReal = daysUntil(realTodayIso, datePart);
      return (diffDemo >= 0 && diffDemo <= 30) || (diffReal >= 0 && diffReal <= 30);
    }
    if (dateRange === 'custom') {
      if (fromDate && datePart < fromDate) return false;
      if (toDate && datePart > toDate) return false;
      return true;
    }
    return true;
  };

  const overlapsDateRange = (periodStart: string, periodEnd: string): boolean => {
    if (dateRange === 'all') return true;
    if (dateRange === 'today') {
      return (
        (periodStart <= TODAY_ISO && periodEnd >= TODAY_ISO) ||
        (periodStart <= realTodayIso && periodEnd >= realTodayIso)
      );
    }
    if (dateRange === 'yesterday') {
      return (
        (periodStart <= YESTERDAY_ISO && periodEnd >= YESTERDAY_ISO) ||
        (periodStart <= realYesterdayIso && periodEnd >= realYesterdayIso)
      );
    }
    if (dateRange === 'this_week' || dateRange === '7d') {
      const start = shiftIsoDate(TODAY_ISO, -7);
      return periodStart <= TODAY_ISO && periodEnd >= start;
    }
    if (dateRange === 'this_month') {
      const monthStart = `${TODAY_ISO.slice(0, 7)}-01`;
      const monthEnd = `${TODAY_ISO.slice(0, 7)}-31`;
      return periodStart <= monthEnd && periodEnd >= monthStart;
    }
    if (dateRange === '30d') {
      const start = shiftIsoDate(TODAY_ISO, -30);
      return periodStart <= TODAY_ISO && periodEnd >= start;
    }
    if (dateRange === 'custom') {
      if (fromDate && periodEnd < fromDate) return false;
      if (toDate && periodStart > toDate) return false;
      return true;
    }
    return true;
  };

  const reportingPeriodLabel = useMemo(() => {
    if (dateRange === 'today') return `Today (${formatDateShort(TODAY_ISO)})`;
    if (dateRange === 'yesterday') return `Yesterday (${formatDateShort(YESTERDAY_ISO)})`;
    if (dateRange === 'this_week') {
      return `This Week (${formatDateShort(shiftIsoDate(TODAY_ISO, -6))} – ${formatDateShort(TODAY_ISO)})`;
    }
    if (dateRange === 'this_month') return `This Month (Nov 2026)`;
    if (dateRange === '7d') {
      return `Last 7 Days (${formatDateShort(shiftIsoDate(TODAY_ISO, -7))} – ${formatDateShort(TODAY_ISO)})`;
    }
    if (dateRange === '30d') {
      return `Last 30 Days (${formatDateShort(shiftIsoDate(TODAY_ISO, -30))} – ${formatDateShort(TODAY_ISO)})`;
    }
    if (dateRange === 'custom') {
      return `${fromDate ? formatDateShort(fromDate) : 'Start'} – ${toDate ? formatDateShort(toDate) : 'Present'}`;
    }
    return 'All Time';
  }, [dateRange, fromDate, toDate]);

  // Orders filtered by branch, date & search (base for sales/category/payment reports)
  const dateFilteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!matchesBranch(o.branchId)) return false;
      if (!matchesDateRange(o.createdAt)) return false;
      if (paymentFilter !== 'ALL' && !o.payments.some((p) => p.method === paymentFilter)) {
        return false;
      }
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (query) {
        return (
          o.billNumber.toLowerCase().includes(query) ||
          o.customerName.toLowerCase().includes(query) ||
          (o.customerPhone ?? '').toLowerCase().includes(query) ||
          o.cashierName.toLowerCase().includes(query) ||
          o.items.some((i) => i.productName.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [orders, resolvedBranchId, dateRange, fromDate, toDate, paymentFilter, statusFilter, query]);

  const completedOrders = useMemo(
    () => dateFilteredOrders.filter((o) => o.status === 'Completed'),
    [dateFilteredOrders]
  );

  // Orders scoped strictly by branch & date for Tax & GST (excludes Refunded, tracks refunded separately)
  const taxScopedCompletedOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === 'Completed' &&
          matchesBranch(o.branchId) &&
          matchesDateRange(o.createdAt)
      ),
    [orders, resolvedBranchId, dateRange, fromDate, toDate]
  );

  const taxScopedRefundedOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === 'Refunded' &&
          matchesBranch(o.branchId) &&
          matchesDateRange(o.createdAt)
      ),
    [orders, resolvedBranchId, dateRange, fromDate, toDate]
  );

  const grossSales = roundCurrency(completedOrders.reduce((s, o) => s + o.grandTotal, 0));
  const totalTax = roundCurrency(completedOrders.reduce((s, o) => s + o.taxAmount, 0));
  const totalSubtotal = roundCurrency(completedOrders.reduce((s, o) => s + o.subtotal, 0));
  const totalDiscount = roundCurrency(completedOrders.reduce((s, o) => s + o.discountAmount, 0));
  const avgBill = completedOrders.length > 0 ? roundCurrency(grossSales / completedOrders.length) : 0;

  // Product-wise Aggregation
  const productSales = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        sku: string;
        categoryName: string;
        taxRate: number;
        qty: number;
        revenue: number;
        tax: number;
      }
    >();
    completedOrders.forEach((o) => {
      o.items.forEach((i) => {
        const prod = products.find((p) => p.id === i.productId);
        const catName =
          categories.find((c) => c.id === prod?.categoryId)?.name ?? 'Custom / Other';
        if (
          query &&
          !i.productName.toLowerCase().includes(query) &&
          !i.sku.toLowerCase().includes(query) &&
          !catName.toLowerCase().includes(query)
        ) {
          return;
        }
        const prev = map.get(i.productId) ?? {
          name: i.productName,
          sku: i.sku,
          categoryName: catName,
          taxRate: i.taxRate,
          qty: 0,
          revenue: 0,
          tax: 0,
        };
        const lineSub = i.unitPrice * i.quantity;
        prev.qty = roundQty(prev.qty + i.quantity);
        prev.revenue = roundCurrency(prev.revenue + lineSub);
        prev.tax = roundCurrency(prev.tax + (lineSub * i.taxRate) / 100);
        map.set(i.productId, prev);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [completedOrders, products, categories, query]);

  const totalProductUnits = roundQty(productSales.reduce((s, r) => s + r.qty, 0));
  const totalProductRevenue = roundCurrency(productSales.reduce((s, r) => s + r.revenue, 0));
  const totalProductEstTax = roundCurrency(productSales.reduce((s, r) => s + r.tax, 0));

  // Category-wise Aggregation
  const categorySales = useMemo(() => {
    const map = new Map<string, { name: string; units: number; revenue: number; itemCount: number }>();
    completedOrders.forEach((o) => {
      o.items.forEach((i) => {
        const prod = products.find((p) => p.id === i.productId);
        const catName =
          categories.find((c) => c.id === prod?.categoryId)?.name ?? 'Custom / Other';
        if (query && !catName.toLowerCase().includes(query)) return;
        const prev = map.get(catName) ?? { name: catName, units: 0, revenue: 0, itemCount: 0 };
        prev.units = roundQty(prev.units + i.quantity);
        prev.revenue = roundCurrency(prev.revenue + i.unitPrice * i.quantity);
        prev.itemCount += 1;
        map.set(catName, prev);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [completedOrders, products, categories, query]);

  const totalCategoryRevenue = roundCurrency(categorySales.reduce((s, r) => s + r.revenue, 0));
  const totalCategoryUnits = roundQty(categorySales.reduce((s, r) => s + r.units, 0));

  // Payment Breakdown
  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, { method: string; txCount: number; total: number }>();
    completedOrders.forEach((o) => {
      o.payments.forEach((p) => {
        if (paymentFilter !== 'ALL' && p.method !== paymentFilter) return;
        const prev = map.get(p.method) ?? { method: p.method, txCount: 0, total: 0 };
        prev.txCount += 1;
        prev.total = roundCurrency(prev.total + p.amount);
        map.set(p.method, prev);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [completedOrders, paymentFilter]);

  const totalCollectedPayments = roundCurrency(paymentBreakdown.reduce((s, r) => s + r.total, 0));
  const totalPaymentTxns = paymentBreakdown.reduce((s, r) => s + r.txCount, 0);

  // Expiry & Wastage
  const filteredWastage = useMemo(() => {
    return wastageLogs.filter((w) => {
      if (!matchesBranch(w.branchId)) return false;
      if (!matchesDateRange(w.loggedAt)) return false;
      if (
        query &&
        !w.productName.toLowerCase().includes(query) &&
        !w.batchCode.toLowerCase().includes(query) &&
        !w.reason.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [wastageLogs, resolvedBranchId, dateRange, fromDate, toDate, query]);

  const atRiskBatches = useMemo(() => {
    return batches.filter((b) => {
      if (!matchesBranch(b.branchId)) return false;
      if (b.quantity <= 0 || daysUntil(b.expiryDate, TODAY_ISO) > 2) return false;
      if (query) {
        const p = products.find((pr) => pr.id === b.productId);
        if (
          !(p?.name ?? '').toLowerCase().includes(query) &&
          !b.batchCode.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [batches, products, resolvedBranchId, query]);

  const totalWastageLoss = roundCurrency(filteredWastage.reduce((s, w) => s + w.estimatedValue, 0));

  // Custom Orders
  const filteredCustomOrders = useMemo(() => {
    return customOrders.filter((co) => {
      if (!matchesBranch(co.branchId)) return false;
      if (!matchesDateRange(co.pickupDate) && !matchesDateRange(co.createdAt)) return false;
      if (customStatusFilter !== 'ALL' && co.status !== customStatusFilter) return false;
      if (query) {
        return (
          co.orderNumber.toLowerCase().includes(query) ||
          co.customerName.toLowerCase().includes(query) ||
          co.customerPhone.toLowerCase().includes(query) ||
          co.itemTitle.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [customOrders, resolvedBranchId, dateRange, fromDate, toDate, customStatusFilter, query]);

  const customTotalValue = roundCurrency(
    filteredCustomOrders
      .filter((c) => c.status !== 'Cancelled')
      .reduce((s, c) => s + c.totalAmount, 0)
  );
  const customPaidTotal = roundCurrency(
    filteredCustomOrders
      .filter((c) => c.status !== 'Cancelled')
      .reduce((s, c) => s + c.advancePaid + c.balancePaid, 0)
  );
  const customPendingBalance = roundCurrency(Math.max(0, customTotalValue - customPaidTotal));

  // Inventory Valuation & Movements
  const branchInventoryItems = useMemo(
    () => inventoryItems.filter((i) => matchesBranch(i.branchId)),
    [inventoryItems, resolvedBranchId]
  );

  const filteredInvTxns = useMemo(() => {
    return inventoryTxns.filter((t) => {
      if (!matchesBranch(t.branchId)) return false;
      if (!matchesDateRange(t.timestamp)) return false;
      if (invTxnFilter !== 'ALL' && t.type !== invTxnFilter) return false;
      if (
        query &&
        !t.itemName.toLowerCase().includes(query) &&
        !t.reason.toLowerCase().includes(query) &&
        !(t.supplierName ?? '').toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [inventoryTxns, resolvedBranchId, dateRange, fromDate, toDate, invTxnFilter, query]);

  const totalInventoryValuation = useMemo(
    () => roundCurrency(branchInventoryItems.reduce((s, i) => s + i.quantity * i.unitCost, 0)),
    [branchInventoryItems]
  );
  const lowInventoryCount = useMemo(
    () => branchInventoryItems.filter((i) => i.quantity <= i.minStockLevel).length,
    [branchInventoryItems]
  );
  const stockInSpendPeriod = useMemo(
    () =>
      roundCurrency(
        filteredInvTxns
          .filter((t) => t.type === 'Stock In')
          .reduce((s, t) => s + (t.purchaseCost ?? 0), 0)
      ),
    [filteredInvTxns]
  );

  // Branch-wise Performance Aggregation
  const branchComparisonRows = useMemo(() => {
    const scopeList = canViewAllBranches ? branches : authorizedBranches;
    return scopeList
      .filter((br) => {
        if (!query) return true;
        return (
          br.name.toLowerCase().includes(query) ||
          br.branchCode.toLowerCase().includes(query) ||
          br.address.toLowerCase().includes(query)
        );
      })
      .map((br) => {
        const brOrders = orders.filter(
          (o) =>
            (o.branchId ?? 'br-1') === br.id &&
            o.status === 'Completed' &&
            matchesDateRange(o.createdAt)
        );
        const revenue = roundCurrency(brOrders.reduce((s, o) => s + o.grandTotal, 0));
        const tax = roundCurrency(brOrders.reduce((s, o) => s + o.taxAmount, 0));
        const avgBill = brOrders.length > 0 ? roundCurrency(revenue / brOrders.length) : 0;
        const customCount = customOrders.filter(
          (co) =>
            (co.branchId ?? 'br-1') === br.id &&
            co.status !== 'Cancelled' &&
            (matchesDateRange(co.createdAt) || matchesDateRange(co.pickupDate))
        ).length;
        const wastage = roundCurrency(
          wastageLogs
            .filter((w) => (w.branchId ?? 'br-1') === br.id && matchesDateRange(w.loggedAt))
            .reduce((s, w) => s + w.estimatedValue, 0)
        );
        const staffCount = staffUsers.filter(
          (s) =>
            s.status === 'Active' &&
            (s.primaryBranchId === br.id || s.authorizedBranchIds.includes(br.id))
        ).length;
        return {
          branch: br,
          ordersCount: brOrders.length,
          revenue,
          avgBill,
          tax,
          customCount,
          wastage,
          staffCount,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [
    branches,
    authorizedBranches,
    canViewAllBranches,
    orders,
    customOrders,
    wastageLogs,
    staffUsers,
    dateRange,
    fromDate,
    toDate,
    query,
  ]);

  const totalBranchCompRevenue = roundCurrency(branchComparisonRows.reduce((s, r) => s + r.revenue, 0));
  const totalBranchCompOrders = branchComparisonRows.reduce((s, r) => s + r.ordersCount, 0);
  const totalBranchCompTax = roundCurrency(branchComparisonRows.reduce((s, r) => s + r.tax, 0));
  const totalBranchCompWastage = roundCurrency(branchComparisonRows.reduce((s, r) => s + r.wastage, 0));

  // Staff Sales Performance Aggregation
  const staffPerformanceRows = useMemo(() => {
    return staffUsers
      .filter((s) => {
        if (
          resolvedBranchId &&
          s.primaryBranchId !== resolvedBranchId &&
          !s.authorizedBranchIds.includes(resolvedBranchId)
        ) {
          return false;
        }
        if (query) {
          return (
            s.name.toLowerCase().includes(query) ||
            s.employeeCode.toLowerCase().includes(query) ||
            s.role.toLowerCase().includes(query)
          );
        }
        return true;
      })
      .map((s) => {
        const sOrders = orders.filter(
          (o) =>
            o.status === 'Completed' &&
            matchesBranch(o.branchId) &&
            matchesDateRange(o.createdAt) &&
            (o.staffId === s.id || (!o.staffId && o.cashierName === s.name))
        );
        const revenue = roundCurrency(sOrders.reduce((sum, o) => sum + o.grandTotal, 0));
        const avgBill = sOrders.length > 0 ? roundCurrency(revenue / sOrders.length) : 0;
        const customBookings = customOrders.filter(
          (co) =>
            matchesBranch(co.branchId) &&
            (matchesDateRange(co.createdAt) || matchesDateRange(co.pickupDate)) &&
            co.createdByName === s.name
        ).length;
        const primaryBranchName =
          branches.find((b) => b.id === s.primaryBranchId)?.name ?? '—';
        return {
          staff: s,
          primaryBranchName,
          billsCount: sOrders.length,
          revenue,
          avgBill,
          customBookings,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [staffUsers, orders, customOrders, branches, resolvedBranchId, dateRange, fromDate, toDate, query]);

  const totalStaffRevenue = roundCurrency(staffPerformanceRows.reduce((s, r) => s + r.revenue, 0));
  const totalStaffBills = staffPerformanceRows.reduce((s, r) => s + r.billsCount, 0);

  // Tax & GST Computed Report Data
  const taxGstData = useMemo(
    () =>
      computeTaxGstReport({
        completedOrders: taxScopedCompletedOrders,
        refundedOrders: taxScopedRefundedOrders,
        products,
        categories,
        gstPaymentRecords,
        resolvedBranchId,
        categoryFilter: gstCategoryFilter,
        productFilter: gstProductFilter,
        rateFilter: gstRateFilter,
        searchQuery: query,
        overlapsDateRange,
      }),
    [
      taxScopedCompletedOrders,
      taxScopedRefundedOrders,
      products,
      categories,
      gstPaymentRecords,
      resolvedBranchId,
      gstCategoryFilter,
      gstProductFilter,
      gstRateFilter,
      query,
      dateRange,
      fromDate,
      toDate,
    ]
  );

  // Available GST slabs in catalog/orders for filter dropdown
  const availableGstRates = useMemo(() => {
    const rateSet = new Set<number>([0, 5, 12, 18, 28]);
    products.forEach((p) => rateSet.add(p.taxRate));
    taxScopedCompletedOrders.forEach((o) => o.items.forEach((i) => rateSet.add(i.taxRate)));
    return Array.from(rateSet)
      .filter((r) => r > 0)
      .sort((a, b) => a - b);
  }, [products, taxScopedCompletedOrders]);

  const buildStandardReportSheets = (): { baseName: string; sheet: ExportSheet } => {
    if (reportType === 'orders') {
      return {
        baseName: 'rb_orders_sales_report',
        sheet: {
          name: 'Orders & Daily Sales',
          title: 'Orders & Daily Sales Report',
          headers: [
            'Bill #',
            'Date & Time',
            'Branch',
            'Customer',
            'Phone',
            'Items',
            'Subtotal',
            'Discount',
            'Packaging',
            'GST Tax',
            'Grand Total',
            'Payment Split',
            'Staff',
            'Status',
          ],
          rows: dateFilteredOrders.map((o) => [
            o.billNumber,
            formatDateTime(o.createdAt),
            o.branchName ?? 'Kirumambakkam Branch',
            o.customerName,
            o.customerPhone ?? '',
            o.items.map((i) => `${formatDecimal(i.quantity, 3)}x ${i.productName}`).join('; '),
            Number(o.subtotal.toFixed(2)),
            Number(o.discountAmount.toFixed(2)),
            Number(o.packagingCharge.toFixed(2)),
            Number(o.taxAmount.toFixed(2)),
            Number(o.grandTotal.toFixed(2)),
            o.payments.map((p) => `${p.method}:${roundCurrency(p.amount).toFixed(2)}`).join(' | '),
            o.cashierName,
            o.status,
          ]),
          totalsRow: [
            'TOTAL (Completed)',
            '',
            '',
            `${completedOrders.length} Completed Bills`,
            '',
            '',
            Number(totalSubtotal.toFixed(2)),
            Number(totalDiscount.toFixed(2)),
            Number(completedOrders.reduce((s, o) => s + o.packagingCharge, 0).toFixed(2)),
            Number(totalTax.toFixed(2)),
            Number(grossSales.toFixed(2)),
            '',
            '',
            '',
          ],
        },
      };
    }

    if (reportType === 'product_sales') {
      return {
        baseName: 'rb_product_sales_report',
        sheet: {
          name: 'Product-wise Sales',
          title: 'Product-wise Sales Report',
          headers: [
            'SKU',
            'Product',
            'Category',
            'GST Rate %',
            'Units Sold',
            'Sales Revenue',
            'Est. GST',
            'Revenue Share %',
          ],
          rows: productSales.map((r) => [
            r.sku,
            r.name,
            r.categoryName,
            r.taxRate,
            roundQty(r.qty),
            Number(r.revenue.toFixed(2)),
            Number(r.tax.toFixed(2)),
            totalProductRevenue > 0
              ? `${((r.revenue / totalProductRevenue) * 100).toFixed(1)}%`
              : '0%',
          ]),
          totalsRow: [
            'TOTAL',
            `${productSales.length} Products`,
            '',
            '',
            roundQty(totalProductUnits),
            Number(totalProductRevenue.toFixed(2)),
            Number(totalProductEstTax.toFixed(2)),
            '100%',
          ],
        },
      };
    }

    if (reportType === 'category_sales') {
      return {
        baseName: 'rb_category_sales_report',
        sheet: {
          name: 'Category-wise Sales',
          title: 'Category-wise Sales Report',
          headers: ['Category', 'Line Items', 'Units Sold', 'Revenue', 'Share %'],
          rows: categorySales.map((r) => [
            r.name,
            r.itemCount,
            roundQty(r.units),
            Number(r.revenue.toFixed(2)),
            totalCategoryRevenue > 0
              ? `${((r.revenue / totalCategoryRevenue) * 100).toFixed(1)}%`
              : '0%',
          ]),
          totalsRow: [
            'TOTAL',
            categorySales.reduce((s, r) => s + r.itemCount, 0),
            roundQty(totalCategoryUnits),
            Number(totalCategoryRevenue.toFixed(2)),
            '100%',
          ],
        },
      };
    }

    if (reportType === 'payments') {
      return {
        baseName: 'rb_payment_breakdown_report',
        sheet: {
          name: 'Payment Breakdown',
          title: 'Payment Method Breakdown Report',
          headers: ['Payment Method', 'Transactions', 'Collected Amount', 'Share %'],
          rows: paymentBreakdown.map((r) => [
            r.method,
            r.txCount,
            Number(r.total.toFixed(2)),
            totalCollectedPayments > 0
              ? `${((r.total / totalCollectedPayments) * 100).toFixed(1)}%`
              : '0%',
          ]),
          totalsRow: [
            'TOTAL',
            totalPaymentTxns,
            Number(totalCollectedPayments.toFixed(2)),
            '100%',
          ],
        },
      };
    }

    if (reportType === 'expiry_wastage') {
      return {
        baseName: 'rb_wastage_expiry_report',
        sheet: {
          name: 'Expiry & Wastage',
          title: 'Expiry & Wastage Report',
          headers: ['Type', 'Date', 'Product', 'Batch', 'Status / Reason', 'Quantity', 'Est. Loss / Expiry'],
          rows: [
            ...filteredWastage.map((w) => [
              'Wastage',
              formatDateTime(w.loggedAt),
              w.productName,
              w.batchCode,
              w.reason,
              formatStockQty(w.quantity, w.unitLabel),
              Number(w.estimatedValue.toFixed(2)),
            ]),
            ...atRiskBatches.map((b) => {
              const p = products.find((pr) => pr.id === b.productId);
              return [
                'At-Risk Batch',
                b.prepDate,
                p?.name ?? b.productId,
                b.batchCode,
                daysUntil(b.expiryDate, TODAY_ISO) < 0 ? 'Expired' : 'Approaching Expiry',
                formatStockQty(b.quantity, b.unitLabel),
                `Exp ${b.expiryDate}`,
              ];
            }),
          ],
          totalsRow: [
            'TOTAL WASTAGE LOSS',
            '',
            '',
            '',
            `${filteredWastage.length} Wastage · ${atRiskBatches.length} At-Risk`,
            '',
            Number(totalWastageLoss.toFixed(2)),
          ],
        },
      };
    }

    if (reportType === 'custom_orders') {
      return {
        baseName: 'rb_custom_orders_report',
        sheet: {
          name: 'Custom Cake Orders',
          title: 'Custom Cake Orders Report',
          headers: ['Order #', 'Customer', 'Phone', 'Item', 'Pickup Date', 'Total', 'Paid', 'Balance', 'Status'],
          rows: filteredCustomOrders.map((co) => {
            const paid = roundCurrency(co.advancePaid + co.balancePaid);
            const balance =
              co.status === 'Cancelled'
                ? 0
                : roundCurrency(Math.max(0, co.totalAmount - paid));
            return [
              co.orderNumber,
              co.customerName,
              co.customerPhone,
              co.itemTitle,
              co.pickupDate,
              Number(roundCurrency(co.totalAmount).toFixed(2)),
              Number(paid.toFixed(2)),
              Number(balance.toFixed(2)),
              co.status,
            ];
          }),
          totalsRow: [
            'TOTAL (Active)',
            `${filteredCustomOrders.filter((c) => c.status !== 'Cancelled').length} Orders`,
            '',
            '',
            '',
            Number(customTotalValue.toFixed(2)),
            Number(customPaidTotal.toFixed(2)),
            Number(customPendingBalance.toFixed(2)),
            '',
          ],
        },
      };
    }

    if (reportType === 'branch_comparison') {
      return {
        baseName: 'rb_branch_comparison_report',
        sheet: {
          name: 'Branch Performance',
          title: 'Branch-wise Performance Report',
          headers: [
            'Branch Code',
            'Branch Name',
            'Status',
            'Active Staff',
            'Completed Bills',
            'Avg Bill',
            'GST Collected',
            'Custom Orders',
            'Wastage Loss',
            'Gross Revenue',
          ],
          rows: branchComparisonRows.map((r) => [
            r.branch.branchCode,
            r.branch.name,
            r.branch.status,
            r.staffCount,
            r.ordersCount,
            Number(r.avgBill.toFixed(2)),
            Number(r.tax.toFixed(2)),
            r.customCount,
            Number(r.wastage.toFixed(2)),
            Number(r.revenue.toFixed(2)),
          ]),
          totalsRow: [
            'TOTAL',
            `${branchComparisonRows.length} Branches`,
            '',
            branchComparisonRows.reduce((s, r) => s + r.staffCount, 0),
            totalBranchCompOrders,
            totalBranchCompOrders > 0
              ? Number((totalBranchCompRevenue / totalBranchCompOrders).toFixed(2))
              : 0,
            Number(totalBranchCompTax.toFixed(2)),
            branchComparisonRows.reduce((s, r) => s + r.customCount, 0),
            Number(totalBranchCompWastage.toFixed(2)),
            Number(totalBranchCompRevenue.toFixed(2)),
          ],
        },
      };
    }

    if (reportType === 'staff_performance') {
      return {
        baseName: 'rb_staff_performance_report',
        sheet: {
          name: 'Staff Performance',
          title: 'Staff Sales Performance Report',
          headers: [
            'Employee ID',
            'Staff Name',
            'Role',
            'Primary Branch',
            'Status',
            'Bills Settled',
            'Avg Bill',
            'Custom Bookings',
            'Sales Revenue',
            'Share %',
          ],
          rows: staffPerformanceRows.map((r) => [
            r.staff.employeeCode,
            r.staff.name,
            r.staff.role,
            r.primaryBranchName,
            r.staff.status,
            r.billsCount,
            Number(r.avgBill.toFixed(2)),
            r.customBookings,
            Number(r.revenue.toFixed(2)),
            totalStaffRevenue > 0
              ? `${((r.revenue / totalStaffRevenue) * 100).toFixed(1)}%`
              : '0%',
          ]),
          totalsRow: [
            'TOTAL',
            `${staffPerformanceRows.length} Staff`,
            '',
            '',
            '',
            totalStaffBills,
            totalStaffBills > 0
              ? Number((totalStaffRevenue / totalStaffBills).toFixed(2))
              : 0,
            staffPerformanceRows.reduce((s, r) => s + r.customBookings, 0),
            Number(totalStaffRevenue.toFixed(2)),
            '100%',
          ],
        },
      };
    }

    return {
      baseName: 'rb_inventory_ledger_report',
      sheet: {
        name: 'Inventory & Valuation',
        title: 'Inventory Valuation & Movements Ledger',
        headers: [
          'Date & Time',
          'Item',
          'Type',
          'Delta',
          'Previous Qty',
          'Updated Qty',
          'Unit',
          'Supplier / Reason',
          'Purchase Cost',
          'Staff',
        ],
        rows: filteredInvTxns.map((t) => [
          formatDateTime(t.timestamp),
          t.itemName,
          t.type,
          roundQty(t.quantityDelta),
          roundQty(t.previousQty),
          roundQty(t.updatedQty),
          t.unit,
          t.supplierName ? `${t.supplierName} — ${t.reason}` : t.reason,
          Number((t.purchaseCost ?? 0).toFixed(2)),
          t.performedBy,
        ]),
        totalsRow: [
          'TOTAL PURCHASE SPEND',
          `${filteredInvTxns.length} Movements`,
          '',
          '',
          '',
          '',
          '',
          `Current Stock Valuation: ${formatINR(totalInventoryValuation)}`,
          Number(stockInSpendPeriod.toFixed(2)),
          '',
        ],
      },
    };
  };

  const activeMeta = REPORT_TYPES.find((r) => r.id === reportType);

  const exportMetadata: ExportMetadata = {
    businessName: settings.businessName || 'RB Sweets & Bakery',
    reportTitle: activeMeta?.label ?? 'POS Report',
    reportingPeriod: reportingPeriodLabel,
    branchScope: resolvedBranchScopeLabel,
    exportDate: new Date().toLocaleString('en-IN'),
  };

  const handleStandardExport = (format: 'excel' | 'csv') => {
    const { baseName, sheet } = buildStandardReportSheets();
    if (format === 'excel') {
      exportReportExcel(`${baseName}.xls`, exportMetadata, [sheet]);
      pushToast(`Exported ${activeMeta?.label} as Excel (.xls).`);
    } else {
      exportReportCsv(`${baseName}.csv`, exportMetadata, [sheet]);
      pushToast(`Exported ${activeMeta?.label} as CSV.`);
    }
    setShowExportMenu(false);
  };

  const handleTaxGstExport = (
    format: 'excel' | 'csv',
    scope: 'all' | 'overview' | 'product_wise' | 'rate_wise' | 'collection_summary' | 'payment_records'
  ) => {
    const branchPaymentRows = gstPaymentRecords.filter(
      (rec) => !resolvedBranchId || rec.branchId === resolvedBranchId
    );
    const sheets = buildTaxGstExportSheets(taxGstData, branchPaymentRows, scope);
    const scopeNames: Record<typeof scope, string> = {
      all: 'rb_tax_gst_full_report',
      overview: 'rb_tax_gst_summary',
      product_wise: 'rb_tax_gst_product_wise',
      rate_wise: 'rb_tax_gst_rate_breakdown',
      collection_summary: 'rb_tax_gst_collection_summary',
      payment_records: 'rb_tax_gst_payment_records',
    };
    const scopeTitles: Record<typeof scope, string> = {
      all: 'Tax & GST Full Report',
      overview: 'Tax & GST Overview Summary',
      product_wise: 'Product-wise GST Report',
      rate_wise: 'GST Rate-wise Breakdown',
      collection_summary: 'Tax Collection Summary',
      payment_records: 'Tax Payment Records',
    };

    const meta: ExportMetadata = {
      ...exportMetadata,
      reportTitle: scopeTitles[scope],
    };

    if (format === 'excel') {
      exportReportExcel(`${scopeNames[scope]}.xls`, meta, sheets);
      pushToast(`Exported ${scopeTitles[scope]} as Excel (.xls).`);
    } else {
      exportReportCsv(`${scopeNames[scope]}.csv`, meta, sheets);
      pushToast(`Exported ${scopeTitles[scope]} as CSV.`);
    }
    setShowExportMenu(false);
  };

  // Dynamic Summary KPIs matched to active reportType (for the 9 existing reports)
  const kpiCards = useMemo(() => {
    if (reportType === 'product_sales') {
      return [
        { label: 'Top-Line Item Revenue', value: formatINR(totalProductRevenue), accent: false },
        { label: 'Total Units Sold', value: `${formatDecimal(totalProductUnits, 3)} Units`, accent: false },
        {
          label: 'Best Performer',
          value: productSales[0] ? productSales[0].name : 'No sales in range',
          accent: true,
        },
      ];
    }
    if (reportType === 'category_sales') {
      return [
        { label: 'Category Revenue Total', value: formatINR(totalCategoryRevenue), accent: false },
        { label: 'Active Categories Sold', value: `${categorySales.length} Categories`, accent: false },
        {
          label: 'Leading Category',
          value: categorySales[0] ? categorySales[0].name : 'No sales in range',
          accent: true,
        },
      ];
    }
    if (reportType === 'payments') {
      return [
        { label: 'Total Collected', value: formatINR(totalCollectedPayments), accent: false },
        { label: 'Payment Entries', value: `${totalPaymentTxns} Transactions`, accent: false },
        {
          label: 'Primary Tender',
          value: paymentBreakdown[0]
            ? `${paymentBreakdown[0].method} (${formatINRCompact(paymentBreakdown[0].total)})`
            : 'None',
          accent: true,
        },
      ];
    }
    if (reportType === 'expiry_wastage') {
      return [
        { label: 'Logged Wastage Value', value: formatINR(totalWastageLoss), accent: true },
        { label: 'Wastage Entries', value: `${filteredWastage.length} Logs`, accent: false },
        { label: 'Counter Batches At Risk', value: `${atRiskBatches.length} Batches`, accent: false },
      ];
    }
    if (reportType === 'custom_orders') {
      return [
        { label: 'Custom Order Bookings', value: formatINR(customTotalValue), accent: false },
        { label: 'Advance & Paid Total', value: formatINR(customPaidTotal), accent: false },
        { label: 'Pending Balance Due', value: formatINR(customPendingBalance), accent: true },
      ];
    }
    if (reportType === 'branch_comparison') {
      return [
        { label: 'Consolidated Sales', value: formatINR(totalBranchCompRevenue), accent: false },
        { label: 'Total Completed Bills', value: `${totalBranchCompOrders} Orders`, accent: false },
        {
          label: 'Top Performing Branch',
          value: branchComparisonRows[0]
            ? `${branchComparisonRows[0].branch.name} (${formatINRCompact(branchComparisonRows[0].revenue)})`
            : 'No data',
          accent: true,
        },
      ];
    }
    if (reportType === 'staff_performance') {
      return [
        { label: 'Staff Attributed Sales', value: formatINR(totalStaffRevenue), accent: false },
        { label: 'Bills Settled', value: `${totalStaffBills} Bills`, accent: false },
        {
          label: 'Top Counter Performer',
          value: staffPerformanceRows[0]
            ? `${staffPerformanceRows[0].staff.name} (${formatINRCompact(staffPerformanceRows[0].revenue)})`
            : 'No sales in range',
          accent: true,
        },
      ];
    }
    if (reportType === 'inventory_ledger') {
      return [
        { label: 'Store-Room Stock Value', value: formatINR(totalInventoryValuation), accent: false },
        { label: 'Purchase Spend (Period)', value: formatINR(stockInSpendPeriod), accent: false },
        { label: 'Low / Reorder Items', value: `${lowInventoryCount} Items`, accent: true },
      ];
    }
    return [
      { label: 'Period Gross Sales', value: formatINR(grossSales), accent: false },
      {
        label: 'Completed Bills (Avg)',
        value: `${completedOrders.length} · ${formatINRCompact(avgBill)}`,
        accent: false,
      },
      { label: 'GST Collected', value: formatINR(totalTax), accent: true },
    ];
  }, [
    reportType,
    grossSales,
    completedOrders.length,
    avgBill,
    totalTax,
    totalProductRevenue,
    totalProductUnits,
    productSales,
    totalCategoryRevenue,
    categorySales,
    totalCollectedPayments,
    totalPaymentTxns,
    paymentBreakdown,
    totalWastageLoss,
    filteredWastage.length,
    atRiskBatches.length,
    customTotalValue,
    customPaidTotal,
    customPendingBalance,
    totalInventoryValuation,
    stockInSpendPeriod,
    lowInventoryCount,
    totalBranchCompRevenue,
    totalBranchCompOrders,
    branchComparisonRows,
    totalStaffRevenue,
    totalStaffBills,
    staffPerformanceRows,
  ]);

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-61px)] bg-[#E0E2E7]">
      {/* Left Report Types Navigation */}
      <aside className="w-full lg:w-[250px] bg-white border-b lg:border-b-0 lg:border-r border-[#E5E7EB] p-4 space-y-1.5 shrink-0">
        <div className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
          Report Categories
        </div>
        {REPORT_TYPES.map((rt) => {
          const active = reportType === rt.id;
          const Icon = rt.icon;
          return (
            <button
              key={rt.id}
              type="button"
              onClick={() => {
                setReportType(rt.id);
                setShowExportMenu(false);
              }}
              className={`w-full px-3 py-2.5 rounded-md text-left transition-colors flex items-start gap-2.5 ${
                active ? 'bg-[#FB923C] text-white' : 'text-[#181210] hover:bg-[#FAF9F5]'
              }`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${active ? 'text-white' : 'text-[#64748B]'}`} />
              <div className="min-w-0">
                <div className={`text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}>
                  {rt.label}
                </div>
                <div className={`text-[11px] mt-0.5 leading-snug ${active ? 'text-white/85' : 'text-[#64748B]'}`}>
                  {rt.desc}
                </div>
              </div>
            </button>
          );
        })}
      </aside>

      {/* Main Report Area */}
      <main className="flex-1 p-5 space-y-4 min-w-0">
        {/* Header & Export Dropdown */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-[#181210]">{activeMeta?.label}</h2>
            <p className="text-[12px] text-[#64748B]">
              {activeMeta?.desc} · {reportingPeriodLabel} · {resolvedBranchScopeLabel}
            </p>
          </div>

          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setShowExportMenu((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-white border border-[#E5E7EB] hover:bg-[#FAF9F5] text-[12px] font-semibold text-[#181210] whitespace-nowrap"
              aria-expanded={showExportMenu}
              aria-haspopup="menu"
            >
              <Download className="w-3.5 h-3.5 text-[#FB923C]" />
              Export Report
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
            </button>

            {showExportMenu && (
              <div
                role="menu"
                className="absolute right-0 mt-1.5 w-72 bg-white rounded-lg border border-[#E5E7EB] shadow-xl z-30 py-1.5 text-[12px]"
              >
                {reportType !== 'tax_gst' ? (
                  <>
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                      Download {activeMeta?.label}
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleStandardExport('excel')}
                      className="w-full px-3 py-2 text-left hover:bg-[#FAF9F5] flex items-center gap-2.5 text-[#181210]"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-[#15803D]" />
                      <div>
                        <div className="font-semibold">Export as Excel (.xls)</div>
                        <div className="text-[11px] text-[#64748B]">
                          Formatted sheet with totals &amp; metadata
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleStandardExport('csv')}
                      className="w-full px-3 py-2 text-left hover:bg-[#FAF9F5] flex items-center gap-2.5 text-[#181210]"
                    >
                      <FileText className="w-4 h-4 text-[#FB923C]" />
                      <div>
                        <div className="font-semibold">Export as CSV (.csv)</div>
                        <div className="text-[11px] text-[#64748B]">
                          UTF-8 spreadsheet with report header
                        </div>
                      </div>
                    </button>
                  </>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                      Excel Workbooks (.xls)
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTaxGstExport('excel', 'all')}
                      className="w-full px-3 py-2 text-left hover:bg-[#FAF9F5] flex items-center gap-2 text-[#181210]"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-[#15803D] shrink-0" />
                      <div>
                        <div className="font-semibold">Full Tax &amp; GST Workbook</div>
                        <div className="text-[11px] text-[#64748B]">All 5 worksheets combined</div>
                      </div>
                    </button>
                    {(
                      [
                        ['overview', 'Tax & GST Summary'],
                        ['product_wise', 'Product-wise GST Details'],
                        ['rate_wise', 'GST Rate-wise Breakdown'],
                        ['collection_summary', 'Tax Collection Summary'],
                        ['payment_records', 'Tax Payment Records'],
                      ] as const
                    ).map(([scopeKey, label]) => (
                      <button
                        key={`xls-${scopeKey}`}
                        type="button"
                        onClick={() => handleTaxGstExport('excel', scopeKey)}
                        className="w-full px-3 py-1.5 text-left hover:bg-[#FAF9F5] flex items-center gap-2 text-[#181210]"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#15803D] shrink-0" />
                        <span>{label} (.xls)</span>
                      </button>
                    ))}

                    <div className="my-1 border-t border-[#E5E7EB]" />
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                      CSV Exports (.csv)
                    </div>
                    {(
                      [
                        ['all', 'Full Tax & GST Report'],
                        ['overview', 'Tax & GST Summary'],
                        ['product_wise', 'Product-wise GST Details'],
                        ['rate_wise', 'GST Rate-wise Breakdown'],
                        ['collection_summary', 'Tax Collection Summary'],
                        ['payment_records', 'Tax Payment Records'],
                      ] as const
                    ).map(([scopeKey, label]) => (
                      <button
                        key={`csv-${scopeKey}`}
                        type="button"
                        onClick={() => handleTaxGstExport('csv', scopeKey)}
                        className="w-full px-3 py-1.5 text-left hover:bg-[#FAF9F5] flex items-center gap-2 text-[#181210]"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#FB923C] shrink-0" />
                        <span>{label} (.csv)</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-3 flex flex-wrap items-center gap-2.5">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder={
                reportType === 'tax_gst'
                  ? 'Search products, SKUs, categories, bills...'
                  : 'Search bills, items, customers, batches...'
              }
              className="w-full pl-8 pr-7 py-1.5 text-[12px] bg-[#FAF9F5] border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#FB923C]/40"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#181210]"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Branch Scope Selector */}
          {reportType !== 'branch_comparison' && (
            <div className="inline-flex items-center gap-1.5 bg-[#FAF9F5] border border-[#E5E7EB] rounded-md px-2.5 py-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#FB923C]" />
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="text-[12px] font-semibold text-[#181210] bg-transparent focus:outline-none"
                aria-label="Filter report by branch"
              >
                <option value="ACTIVE">Active ({activeBranch.name})</option>
                {canViewAllBranches && <option value="ALL">All Branches</option>}
                {(canViewAllBranches ? branches : authorizedBranches).map((br) => (
                  <option key={br.id} value={br.id}>
                    {br.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Preset */}
          <div className="inline-flex items-center gap-1.5 bg-[#FAF9F5] border border-[#E5E7EB] rounded-md px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#64748B]" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DatePreset)}
              className="text-[12px] font-semibold text-[#181210] bg-transparent focus:outline-none"
              aria-label="Report date range"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Custom Date Inputs */}
          {dateRange === 'custom' && (
            <div className="flex items-center gap-1.5 text-[12px]">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2 py-1 bg-[#FAF9F5] border border-[#E5E7EB] rounded-md text-[12px] tabular-nums"
                aria-label="From date"
              />
              <span className="text-[#64748B]">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2 py-1 bg-[#FAF9F5] border border-[#E5E7EB] rounded-md text-[12px] tabular-nums"
                aria-label="To date"
              />
            </div>
          )}

          {/* Contextual Report Filters */}
          {(reportType === 'orders' || reportType === 'payments') && (
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as 'ALL' | PaymentMethod)}
              className="px-2.5 py-1.5 bg-[#FAF9F5] border border-[#E5E7EB] rounded-md text-[12px] font-medium text-[#181210]"
              aria-label="Filter by payment method"
            >
              <option value="ALL">All Payments</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
            </select>
          )}

          {reportType === 'orders' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'Completed' | 'Refunded')}
              className="px-2.5 py-1.5 bg-[#FAF9F5] border border-[#E5E7EB] rounded-md text-[12px] font-medium text-[#181210]"
              aria-label="Filter by order status"
            >
              <option value="ALL">All Status</option>
              <option value="Completed">Completed</option>
              <option value="Refunded">Refunded</option>
            </select>
          )}

          {reportType === 'custom_orders' && (
            <select
              value={customStatusFilter}
              onChange={(e) => setCustomStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#FAF9F5] border border-[#E5E7EB] rounded-md text-[12px] font-medium text-[#181210]"
              aria-label="Filter custom order status"
            >
              <option value="ALL">All Order Stages</option>
              <option value="Booked">Booked</option>
              <option value="In Baking">In Baking</option>
              <option value="Ready for Pickup">Ready for Pickup</option>
              <option value="Handed Over">Handed Over</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          )}

          {reportType === 'inventory_ledger' && (
            <select
              value={invTxnFilter}
              onChange={(e) =>
                setInvTxnFilter(e.target.value as 'ALL' | 'Stock In' | 'Stock Out' | 'Adjustment')
              }
              className="px-2.5 py-1.5 bg-[#FAF9F5] border border-[#E5E7EB] rounded-md text-[12px] font-medium text-[#181210]"
              aria-label="Filter inventory transaction type"
            >
              <option value="ALL">All Movements</option>
              <option value="Stock In">Stock In</option>
              <option value="Stock Out">Stock Out</option>
              <option value="Adjustment">Adjustment</option>
            </select>
          )}

          {reportType === 'tax_gst' && (
            <>
              <select
                value={gstCategoryFilter}
                onChange={(e) => {
                  setGstCategoryFilter(e.target.value);
                  setGstProductFilter('ALL');
                }}
                className="px-2.5 py-1.5 bg-[#FAF9F5] border border-[#E5E7EB] rounded-md text-[12px] font-medium text-[#181210]"
                aria-label="Filter GST report by product category"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={gstProductFilter}
                onChange={(e) => setGstProductFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#FAF9F5] border border-[#E5E7EB] rounded-md text-[12px] font-medium text-[#181210] max-w-[190px]"
                aria-label="Filter GST report by product"
              >
                <option value="ALL">All Products</option>
                {products
                  .filter((p) => gstCategoryFilter === 'ALL' || p.categoryId === gstCategoryFilter)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>

              <select
                value={gstRateFilter}
                onChange={(e) => setGstRateFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-[#FAF9F5] border border-[#E5E7EB] rounded-md text-[12px] font-medium text-[#181210]"
                aria-label="Filter by GST rate"
              >
                <option value="ALL">All GST Rates</option>
                <option value="0-ALL">0% (Exempt &amp; Nil-Rated)</option>
                <option value="0-Exempt">0% (Exempt)</option>
                <option value="0-Nil-Rated">0% (Nil-Rated)</option>
                {availableGstRates.map((rate) => (
                  <option key={rate} value={String(rate)}>
                    {rate}% GST
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Tax & GST Dedicated Report View */}
        {reportType === 'tax_gst' ? (
          <TaxGstReportSection
            data={taxGstData}
            allBranchPaymentRecords={gstPaymentRecords}
            branches={branches}
            activeBranchId={activeBranchId}
            resolvedBranchId={resolvedBranchId}
            canManageTaxRecords={canManageTaxRecords}
            onAddRecord={addGstPaymentRecord}
            onUpdateRecord={updateGstPaymentRecord}
          />
        ) : (
          <>
            {/* Summary KPI Cards (Tailored per Report) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {kpiCards.map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-lg border border-[#E5E7EB] p-4">
                  <div className="text-[12px] text-[#64748B]">{kpi.label}</div>
                  <div
                    className={`text-[20px] font-bold mt-1 tabular-nums truncate ${
                      kpi.accent ? 'text-[#FB923C]' : 'text-[#181210]'
                    }`}
                    title={kpi.value}
                  >
                    {kpi.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Dynamic Report Table */}
            <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
              {reportType === 'orders' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase text-[#64748B]">
                        <th className="py-2.5 px-4">Bill ID</th>
                        <th className="py-2.5 px-3">Date &amp; Time</th>
                        <th className="py-2.5 px-3">Customer / Items</th>
                        <th className="py-2.5 px-3">Payment</th>
                        <th className="py-2.5 px-3 text-right">Subtotal</th>
                        <th className="py-2.5 px-3 text-right">GST</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]/70 text-[13px]">
                      {dateFilteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-[13px] text-[#64748B]">
                            No orders match the selected date range or filters.
                          </td>
                        </tr>
                      ) : (
                        dateFilteredOrders.map((o) => (
                          <tr key={o.id} className="hover:bg-[#FAF9F5]/70">
                            <td className="py-2.5 px-4">
                              <div className="font-mono font-semibold text-[#181210]">
                                {o.billNumber}
                              </div>
                              <div className="text-[11px] text-[#64748B]">
                                {o.branchName ?? 'Kirumambakkam Branch'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-[12px] text-[#64748B] tabular-nums whitespace-nowrap">
                              {formatDateTime(o.createdAt)}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-[#181210]">{o.customerName}</div>
                              <div className="text-[11px] text-[#64748B] truncate max-w-[260px]">
                                {o.items.map((i) => `${formatDecimal(i.quantity, 3)}x ${i.productName}`).join(', ')}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-[12px]">
                              {o.payments.map((p) => p.method).join(' + ')}
                            </td>
                            <td className="py-2.5 px-3 text-right text-[12px] text-[#64748B] tabular-nums">
                              {formatINR(o.subtotal)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-[12px] text-[#64748B] tabular-nums">
                              {formatINR(o.taxAmount)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                              {formatINR(o.grandTotal)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  o.status === 'Completed'
                                    ? 'bg-[#DCFCE7] text-[#15803D]'
                                    : 'bg-[#FEE2E2] text-[#B91C1C]'
                                }`}
                              >
                                {o.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setActiveReceipt(o)}
                                  className="p-1.5 rounded text-[#64748B] hover:text-[#181210] hover:bg-[#FAF9F5]"
                                  title="View receipt"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                {canApproveRefund && o.status === 'Completed' && (
                                  <button
                                    type="button"
                                    onClick={() => refundOrder(o.id)}
                                    className="p-1.5 rounded text-[#B91C1C] hover:bg-[#FEE2E2]"
                                    title="Mark refunded"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {completedOrders.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-[#E5E7EB] bg-[#FAF9F5] text-[12px] font-bold text-[#181210]">
                          <td className="py-2.5 px-4" colSpan={4}>
                            Completed Bills Total ({completedOrders.length} bills)
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {formatINR(totalSubtotal)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-[#FB923C]">
                            {formatINR(totalTax)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {formatINR(grossSales)}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {reportType === 'product_sales' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase text-[#64748B]">
                        <th className="py-2.5 px-4">SKU</th>
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-right">Units Sold</th>
                        <th className="py-2.5 px-3 text-right">Gross Item Revenue</th>
                        <th className="py-2.5 px-3 text-right">Est. GST</th>
                        <th className="py-2.5 px-4 text-right">Revenue Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]/70 text-[13px]">
                      {productSales.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-[#64748B]">
                            No product sales found for the selected period.
                          </td>
                        </tr>
                      ) : (
                        productSales.map((row) => {
                          const share =
                            totalProductRevenue > 0 ? (row.revenue / totalProductRevenue) * 100 : 0;
                          return (
                            <tr key={row.sku} className="hover:bg-[#FAF9F5]/70">
                              <td className="py-2.5 px-4 font-mono text-[12px] text-[#64748B]">
                                {row.sku}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-[#181210]">{row.name}</td>
                              <td className="py-2.5 px-3 text-[12px] text-[#64748B]">
                                {row.categoryName} · {row.taxRate}% GST
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums">
                                {formatDecimal(row.qty, 3)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                                {formatINR(row.revenue)}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums text-[#64748B]">
                                {formatINR(row.tax)}
                              </td>
                              <td className="py-2.5 px-4 text-right tabular-nums text-[12px] font-semibold text-[#FB923C]">
                                {share.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {productSales.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-[#E5E7EB] bg-[#FAF9F5] text-[12px] font-bold text-[#181210]">
                          <td className="py-2.5 px-4" colSpan={3}>
                            Total ({productSales.length} products)
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {formatDecimal(totalProductUnits, 3)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {formatINR(totalProductRevenue)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {formatINR(totalProductEstTax)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-[#FB923C]">
                            100.0%
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {reportType === 'category_sales' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase text-[#64748B]">
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-3 text-right">Order Lines</th>
                        <th className="py-2.5 px-3 text-right">Units Sold</th>
                        <th className="py-2.5 px-3 text-right">Category Revenue</th>
                        <th className="py-2.5 px-4 text-right">Mix Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]/70 text-[13px]">
                      {categorySales.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-[#64748B]">
                            No category sales recorded in this period.
                          </td>
                        </tr>
                      ) : (
                        categorySales.map((row) => {
                          const share =
                            totalCategoryRevenue > 0 ? (row.revenue / totalCategoryRevenue) * 100 : 0;
                          return (
                            <tr key={row.name} className="hover:bg-[#FAF9F5]/70">
                              <td className="py-3 px-4 font-semibold text-[#181210]">{row.name}</td>
                              <td className="py-3 px-3 text-right tabular-nums text-[#64748B]">
                                {row.itemCount}
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums">
                                {formatDecimal(row.units, 3)}
                              </td>
                              <td className="py-3 px-3 text-right font-bold tabular-nums">
                                {formatINR(row.revenue)}
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-[12px] font-semibold text-[#FB923C]">
                                {share.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {categorySales.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-[#E5E7EB] bg-[#FAF9F5] text-[12px] font-bold text-[#181210]">
                          <td className="py-2.5 px-4">
                            Total ({categorySales.length} categories)
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {categorySales.reduce((s, r) => s + r.itemCount, 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {formatDecimal(totalCategoryUnits, 3)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {formatINR(totalCategoryRevenue)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-[#FB923C]">
                            100.0%
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {reportType === 'payments' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase text-[#64748B]">
                        <th className="py-2.5 px-4">Payment Method</th>
                        <th className="py-2.5 px-3 text-right">Transactions</th>
                        <th className="py-2.5 px-3 text-right">Total Collected</th>
                        <th className="py-2.5 px-4 text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]/70 text-[13px]">
                      {paymentBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-[#64748B]">
                            No payment collections recorded in this date range.
                          </td>
                        </tr>
                      ) : (
                        paymentBreakdown.map((row) => {
                          const share =
                            totalCollectedPayments > 0 ? (row.total / totalCollectedPayments) * 100 : 0;
                          return (
                            <tr key={row.method} className="hover:bg-[#FAF9F5]/70">
                              <td className="py-3 px-4 font-semibold text-[#181210]">{row.method}</td>
                              <td className="py-3 px-3 text-right tabular-nums">{row.txCount}</td>
                              <td className="py-3 px-3 text-right font-bold tabular-nums">
                                {formatINR(row.total)}
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-[12px] font-semibold text-[#FB923C]">
                                {share.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {paymentBreakdown.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-[#E5E7EB] bg-[#FAF9F5] text-[12px] font-bold text-[#181210]">
                          <td className="py-2.5 px-4">Total Collected</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {totalPaymentTxns}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {formatINR(totalCollectedPayments)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums text-[#FB923C]">
                            100.0%
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {reportType === 'expiry_wastage' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase text-[#64748B]">
                        <th className="py-2.5 px-4">Product</th>
                        <th className="py-2.5 px-3">Batch Code</th>
                        <th className="py-2.5 px-3">Event / Status</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-4 text-right">Date / Loss</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]/70 text-[13px]">
                      {filteredWastage.length === 0 && atRiskBatches.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-[#64748B]">
                            No wastage entries or at-risk counter batches found.
                          </td>
                        </tr>
                      ) : (
                        <>
                          {filteredWastage.map((w) => (
                            <tr key={w.id} className="hover:bg-[#FAF9F5]/70">
                              <td className="py-2.5 px-4 font-semibold text-[#181210]">
                                {w.productName}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[12px]">{w.batchCode}</td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FEE2E2] text-[#B91C1C]">
                                  Wastage: {w.reason}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums">
                                {formatStockQty(w.quantity, w.unitLabel)}
                              </td>
                              <td className="py-2.5 px-4 text-right font-semibold text-[#B91C1C] tabular-nums">
                                {formatINRCompact(w.estimatedValue)}
                              </td>
                            </tr>
                          ))}
                          {atRiskBatches.map((b) => {
                            const p = products.find((pr) => pr.id === b.productId);
                            const days = daysUntil(b.expiryDate, TODAY_ISO);
                            return (
                              <tr key={b.id} className="hover:bg-[#FAF9F5]/70">
                                <td className="py-2.5 px-4 font-semibold text-[#181210]">
                                  {p?.name ?? b.productId}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[12px]">{b.batchCode}</td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                      days < 0
                                        ? 'bg-[#FEE2E2] text-[#B91C1C]'
                                        : 'bg-[#FFEDD5] text-[#C2410C]'
                                    }`}
                                  >
                                    {days < 0 ? 'Expired Batch' : 'Approaching Expiry'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums">
                                  {formatStockQty(b.quantity, b.unitLabel)}
                                </td>
                                <td className="py-2.5 px-4 text-right tabular-nums text-[#64748B]">
                                  Exp {formatDateShort(b.expiryDate)}
                                </td>
                              </tr>
                            );
                          })}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {reportType === 'custom_orders' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase text-[#64748B]">
                        <th className="py-2.5 px-4">Order #</th>
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Item &amp; Pickup</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3 text-right">Paid</th>
                        <th className="py-2.5 px-3 text-right">Balance</th>
                        <th className="py-2.5 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]/70 text-[13px]">
                      {filteredCustomOrders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-[#64748B]">
                            No custom orders match the selected filters.
                          </td>
                        </tr>
                      ) : (
                        filteredCustomOrders.map((co) => {
                          const paid = roundCurrency(co.advancePaid + co.balancePaid);
                          const bal =
                            co.status === 'Cancelled'
                              ? 0
                              : roundCurrency(Math.max(0, co.totalAmount - paid));
                          return (
                            <tr key={co.id} className="hover:bg-[#FAF9F5]/70">
                              <td className="py-2.5 px-4 font-mono font-semibold">{co.orderNumber}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-medium">{co.customerName}</div>
                                <div className="text-[11px] text-[#64748B] tabular-nums">
                                  {co.customerPhone}
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div>{co.itemTitle}</div>
                                <div className="text-[11px] text-[#64748B]">
                                  {formatDateShort(co.pickupDate)} {co.pickupTime}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums">
                                {formatINRCompact(co.totalAmount)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-[#15803D] tabular-nums">
                                {formatINRCompact(paid)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-[#C2410C] tabular-nums">
                                {formatINRCompact(bal)}
                              </td>
                              <td className="py-2.5 px-4 text-[12px] font-semibold">{co.status}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {filteredCustomOrders.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-[#E5E7EB] bg-[#FAF9F5] text-[12px] font-bold text-[#181210]">
                          <td className="py-2.5 px-4" colSpan={3}>
                            Active Bookings Total ({filteredCustomOrders.filter((c) => c.status !== 'Cancelled').length} orders)
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {formatINR(customTotalValue)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-[#15803D]">
                            {formatINR(customPaidTotal)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-[#C2410C]">
                            {formatINR(customPendingBalance)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {reportType === 'inventory_ledger' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase text-[#64748B]">
                        <th className="py-2.5 px-4">Date &amp; Time</th>
                        <th className="py-2.5 px-3">Inventory Item</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Change</th>
                        <th className="py-2.5 px-3 text-right">Updated Qty</th>
                        <th className="py-2.5 px-3">Supplier / Reason</th>
                        <th className="py-2.5 px-4 text-right">Cost / Staff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]/70 text-[13px]">
                      {filteredInvTxns.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-[#64748B]">
                            No store-room inventory transactions found for the selected filters.
                          </td>
                        </tr>
                      ) : (
                        filteredInvTxns.map((t) => (
                          <tr key={t.id} className="hover:bg-[#FAF9F5]/70">
                            <td className="py-2.5 px-4 text-[12px] text-[#64748B] tabular-nums whitespace-nowrap">
                              {formatDateTime(t.timestamp)}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-[#181210]">{t.itemName}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  t.type === 'Stock In'
                                    ? 'bg-[#DCFCE7] text-[#15803D]'
                                    : t.type === 'Stock Out'
                                    ? 'bg-[#FEE2E2] text-[#B91C1C]'
                                    : 'bg-[#FFEDD5] text-[#C2410C]'
                                }`}
                              >
                                {t.type}
                              </span>
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-bold tabular-nums ${
                                t.quantityDelta >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                              }`}
                            >
                              {t.quantityDelta >= 0
                                ? `+${formatDecimal(t.quantityDelta, 3)}`
                                : `-${formatDecimal(Math.abs(t.quantityDelta), 3)}`}{' '}
                              {t.unit}
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-[#64748B]">
                              {formatDecimal(t.previousQty, 3)} →{' '}
                              <strong className="text-[#181210]">
                                {formatDecimal(t.updatedQty, 3)}
                              </strong>{' '}
                              {t.unit}
                            </td>
                            <td className="py-2.5 px-3 text-[12px] text-[#64748B]">
                              {t.supplierName ? (
                                <span className="font-medium text-[#181210]">{t.supplierName} · </span>
                              ) : null}
                              {t.reason}
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums text-[12px]">
                              {t.purchaseCost ? (
                                <div className="font-semibold text-[#181210]">
                                  {formatINRCompact(t.purchaseCost)}
                                </div>
                              ) : null}
                              <div className="text-[11px] text-[#64748B]">{t.performedBy}</div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {reportType === 'branch_comparison' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase text-[#64748B]">
                        <th className="py-2.5 px-4">Branch</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Active Staff</th>
                        <th className="py-2.5 px-3 text-right">Completed Bills</th>
                        <th className="py-2.5 px-3 text-right">Avg Bill</th>
                        <th className="py-2.5 px-3 text-right">GST Collected</th>
                        <th className="py-2.5 px-3 text-right">Custom Orders</th>
                        <th className="py-2.5 px-3 text-right">Wastage Loss</th>
                        <th className="py-2.5 px-4 text-right">Gross Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]/70 text-[13px]">
                      {branchComparisonRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-10 text-center text-[#64748B]">
                            No branches match the current filter.
                          </td>
                        </tr>
                      ) : (
                        branchComparisonRows.map((row) => (
                          <tr key={row.branch.id} className="hover:bg-[#FAF9F5]/70">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-[#181210]">{row.branch.name}</div>
                              <div className="text-[11px] font-mono text-[#64748B]">
                                {row.branch.branchCode}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  row.branch.status === 'Active'
                                    ? 'bg-[#DCFCE7] text-[#15803D]'
                                    : 'bg-[#F3F4F6] text-[#4B5563]'
                                }`}
                              >
                                {row.branch.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-[#64748B]">
                              {row.staffCount}
                            </td>
                            <td className="py-3 px-3 text-right font-semibold tabular-nums">
                              {row.ordersCount}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-[#64748B]">
                              {formatINR(row.avgBill)}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-[#FB923C] font-semibold">
                              {formatINR(row.tax)}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums">{row.customCount}</td>
                            <td className="py-3 px-3 text-right tabular-nums text-[#B91C1C]">
                              {formatINRCompact(row.wastage)}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-[#181210] tabular-nums">
                              {formatINR(row.revenue)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {branchComparisonRows.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-[#E5E7EB] bg-[#FAF9F5] text-[12px] font-bold text-[#181210]">
                          <td className="py-2.5 px-4" colSpan={3}>
                            Consolidated ({branchComparisonRows.length} branches)
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {totalBranchCompOrders}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {formatINR(
                              totalBranchCompOrders > 0
                                ? totalBranchCompRevenue / totalBranchCompOrders
                                : 0
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-[#FB923C]">
                            {formatINR(totalBranchCompTax)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {branchComparisonRows.reduce((s, r) => s + r.customCount, 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-[#B91C1C]">
                            {formatINRCompact(totalBranchCompWastage)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {formatINR(totalBranchCompRevenue)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {reportType === 'staff_performance' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase text-[#64748B]">
                        <th className="py-2.5 px-4">Staff Member</th>
                        <th className="py-2.5 px-3">Role &amp; Branch</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Bills Settled</th>
                        <th className="py-2.5 px-3 text-right">Avg Bill</th>
                        <th className="py-2.5 px-3 text-right">Custom Bookings</th>
                        <th className="py-2.5 px-4 text-right">Sales Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]/70 text-[13px]">
                      {staffPerformanceRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-[#64748B]">
                            No staff performance records found for this filter.
                          </td>
                        </tr>
                      ) : (
                        staffPerformanceRows.map((row) => (
                          <tr key={row.staff.id} className="hover:bg-[#FAF9F5]/70">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-[#181210]">{row.staff.name}</div>
                              <div className="text-[11px] font-mono text-[#64748B]">
                                {row.staff.employeeCode}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="text-[12px] font-medium text-[#181210]">
                                {row.staff.role}
                              </div>
                              <div className="text-[11px] text-[#64748B]">{row.primaryBranchName}</div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  row.staff.status === 'Active'
                                    ? 'bg-[#DCFCE7] text-[#15803D]'
                                    : row.staff.status === 'On Leave'
                                    ? 'bg-[#FFEDD5] text-[#C2410C]'
                                    : 'bg-[#F3F4F6] text-[#4B5563]'
                                }`}
                              >
                                {row.staff.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-semibold tabular-nums">
                              {row.billsCount}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-[#64748B]">
                              {formatINR(row.avgBill)}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums">
                              {row.customBookings}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-[#181210] tabular-nums">
                              {formatINR(row.revenue)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {staffPerformanceRows.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-[#E5E7EB] bg-[#FAF9F5] text-[12px] font-bold text-[#181210]">
                          <td className="py-2.5 px-4" colSpan={3}>
                            Total ({staffPerformanceRows.length} staff)
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {totalStaffBills}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {formatINR(totalStaffBills > 0 ? totalStaffRevenue / totalStaffBills : 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">
                            {staffPerformanceRows.reduce((s, r) => s + r.customBookings, 0)}
                          </td>
                          <td className="py-2.5 px-4 text-right tabular-nums">
                            {formatINR(totalStaffRevenue)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};
