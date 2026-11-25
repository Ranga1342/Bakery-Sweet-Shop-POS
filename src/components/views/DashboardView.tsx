import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  IndianRupee,
  ShoppingBag,
  ClipboardList,
  AlertTriangle,
  Play,
  Trash2,
  RefreshCw,
  ArrowRight,
  Clock,
  Cake,
  Building2,
  Calendar,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { usePos } from '../../context/PosContext';
import { ProductThumb } from '../common/ProductThumb';
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

type DashboardDatePreset = 'today' | 'yesterday' | '7d' | '30d' | 'all' | 'custom';

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const dt = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  dt.setDate(dt.getDate() + deltaDays);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDayMonth(isoDate: string): string {
  const dt = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return isoDate;
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

const YESTERDAY_ISO = shiftIsoDate(TODAY_ISO, -1);

export const DashboardView: React.FC = () => {
  const {
    orders,
    heldOrders,
    products,
    categories,
    customOrders,
    batches,
    resumeHeldOrder,
    deleteHeldOrder,
    setActiveNav,
    setActiveReceipt,
    getProductStock,
    activeBranchId,
    activeBranch,
    branches,
    canViewAllBranches,
    hasPermission,
  } = usePos();

  const [branchScope, setBranchScope] = useState<'ACTIVE' | 'ALL' | string>('ACTIVE');
  const [datePreset, setDatePreset] = useState<DashboardDatePreset>('today');
  const [fromDate, setFromDate] = useState<string>(TODAY_ISO);
  const [toDate, setToDate] = useState<string>(TODAY_ISO);
  const [draftFromDate, setDraftFromDate] = useState<string>(TODAY_ISO);
  const [draftToDate, setDraftToDate] = useState<string>(TODAY_ISO);
  const [showCalendarPopover, setShowCalendarPopover] = useState<boolean>(false);

  const calendarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendarPopover(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowCalendarPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const realTodayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const realYesterdayIso = useMemo(() => shiftIsoDate(realTodayIso, -1), [realTodayIso]);

  const resolvedBranchId =
    branchScope === 'ACTIVE'
      ? activeBranchId
      : branchScope === 'ALL' && canViewAllBranches
      ? null
      : canViewAllBranches
      ? branchScope
      : activeBranchId;

  const branchOrders = useMemo(
    () =>
      orders.filter((o) =>
        resolvedBranchId ? (o.branchId ?? 'br-1') === resolvedBranchId : true
      ),
    [orders, resolvedBranchId]
  );

  const branchHeldOrders = heldOrders.filter((h) =>
    resolvedBranchId ? (h.branchId ?? 'br-1') === resolvedBranchId : true
  );
  const branchCustomOrders = customOrders.filter((c) =>
    resolvedBranchId ? (c.branchId ?? 'br-1') === resolvedBranchId : true
  );

  const matchesDateSelection = (isoDateTime: string): boolean => {
    const datePart = isoDateTime.slice(0, 10);
    if (datePreset === 'today') {
      return datePart === TODAY_ISO || datePart === realTodayIso;
    }
    if (datePreset === 'yesterday') {
      return datePart === YESTERDAY_ISO || datePart === realYesterdayIso;
    }
    if (datePreset === '7d') {
      const diffDemo = daysUntil(TODAY_ISO, datePart);
      const diffReal = daysUntil(realTodayIso, datePart);
      return (diffDemo >= 0 && diffDemo <= 6) || (diffReal >= 0 && diffReal <= 6);
    }
    if (datePreset === '30d') {
      const diffDemo = daysUntil(TODAY_ISO, datePart);
      const diffReal = daysUntil(realTodayIso, datePart);
      return (diffDemo >= 0 && diffDemo <= 29) || (diffReal >= 0 && diffReal <= 29);
    }
    if (datePreset === 'custom') {
      if (fromDate && toDate) {
        const start = fromDate <= toDate ? fromDate : toDate;
        const end = fromDate <= toDate ? toDate : fromDate;
        return datePart >= start && datePart <= end;
      }
      if (fromDate) return datePart === fromDate;
      if (toDate) return datePart === toDate;
      return true;
    }
    return true;
  };

  const activeDateTriggerLabel = useMemo(() => {
    if (datePreset === 'today') return `Today · ${formatDayMonth(TODAY_ISO)}`;
    if (datePreset === 'yesterday') return `Yesterday · ${formatDayMonth(YESTERDAY_ISO)}`;
    if (datePreset === '7d') return 'Last 7 Days';
    if (datePreset === '30d') return 'Last 30 Days';
    if (datePreset === 'all') return 'All Time';
    if (fromDate && toDate) {
      if (fromDate === toDate) return formatDateShort(fromDate);
      const start = fromDate <= toDate ? fromDate : toDate;
      const end = fromDate <= toDate ? toDate : fromDate;
      return `${formatDayMonth(start)} – ${formatDayMonth(end)}`;
    }
    if (fromDate) return formatDateShort(fromDate);
    if (toDate) return formatDateShort(toDate);
    return 'Custom Date';
  }, [datePreset, fromDate, toDate]);

  const handleSelectPreset = (preset: Exclude<DashboardDatePreset, 'custom'>) => {
    setDatePreset(preset);
    if (preset === 'today') {
      setFromDate(TODAY_ISO);
      setToDate(TODAY_ISO);
      setDraftFromDate(TODAY_ISO);
      setDraftToDate(TODAY_ISO);
    } else if (preset === 'yesterday') {
      setFromDate(YESTERDAY_ISO);
      setToDate(YESTERDAY_ISO);
      setDraftFromDate(YESTERDAY_ISO);
      setDraftToDate(YESTERDAY_ISO);
    } else if (preset === '7d') {
      const start = shiftIsoDate(TODAY_ISO, -6);
      setFromDate(start);
      setToDate(TODAY_ISO);
      setDraftFromDate(start);
      setDraftToDate(TODAY_ISO);
    } else if (preset === '30d') {
      const start = shiftIsoDate(TODAY_ISO, -29);
      setFromDate(start);
      setToDate(TODAY_ISO);
      setDraftFromDate(start);
      setDraftToDate(TODAY_ISO);
    }
    setShowCalendarPopover(false);
  };

  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedFrom = draftFromDate || draftToDate;
    const resolvedTo = draftToDate || draftFromDate;
    if (!resolvedFrom && !resolvedTo) {
      handleSelectPreset('all');
      return;
    }
    setFromDate(resolvedFrom);
    setToDate(resolvedTo);
    setDatePreset('custom');
    setShowCalendarPopover(false);
  };

  const periodCompletedOrders = branchOrders.filter(
    (o) => o.status === 'Completed' && matchesDateSelection(o.createdAt)
  );
  const periodSales = roundCurrency(
    periodCompletedOrders.reduce((s, o) => s + o.grandTotal, 0)
  );
  const avgOrderValue =
    periodCompletedOrders.length > 0 ? roundCurrency(periodSales / periodCompletedOrders.length) : 0;

  const salesKpiTitle =
    datePreset === 'today'
      ? "Today's Sales"
      : datePreset === 'yesterday'
      ? "Yesterday's Sales"
      : `Sales (${activeDateTriggerLabel})`;

  const ordersKpiTitle =
    datePreset === 'today'
      ? "Today's Counter Bills"
      : datePreset === 'yesterday'
      ? "Yesterday's Counter Bills"
      : `Counter Bills (${activeDateTriggerLabel})`;

  const activeCustomOrders = branchCustomOrders.filter(
    (c) => c.status !== 'Handed Over' && c.status !== 'Cancelled'
  );
  const dueTodayCustom = activeCustomOrders.filter((c) => c.pickupDate === TODAY_ISO);

  const scopedLowStockProducts = products.filter((p) => {
    if (!p.isActive) return false;
    if (resolvedBranchId) {
      return getProductStock(p.id, resolvedBranchId) <= p.minStockAlert;
    }
    return branches.some(
      (b) => b.status === 'Active' && getProductStock(p.id, b.id) <= p.minStockAlert
    );
  });

  const scopedExpiringBatches = batches
    .filter((b) => {
      if (resolvedBranchId && (b.branchId ?? 'br-1') !== resolvedBranchId) return false;
      const p = products.find((pr) => pr.id === b.productId);
      if (!p || !p.trackExpiry || b.quantity <= 0) return false;
      return daysUntil(b.expiryDate, TODAY_ISO) <= 1;
    })
    .map((b) => ({
      ...b,
      productName: products.find((p) => p.id === b.productId)?.name ?? 'Item',
      daysLeft: daysUntil(b.expiryDate, TODAY_ISO),
    }));

  const alertProductIds = new Set([
    ...scopedLowStockProducts.map((p) => p.id),
    ...scopedExpiringBatches.map((b) => b.productId),
  ]);

  // Compute Top Selling Products scoped to branch + selected date / date range
  const productSalesMap = new Map<
    string,
    {
      productId: string;
      name: string;
      categoryName: string;
      unitLabel: string;
      imageUrl: string;
      units: number;
      revenue: number;
    }
  >();

  periodCompletedOrders.forEach((order) => {
    order.items.forEach((item) => {
      const prev = productSalesMap.get(item.productId);
      const prod = products.find((p) => p.id === item.productId);
      const catName =
        categories.find((c) => c.id === prod?.categoryId)?.name ?? 'Bakery Item';
      const lineRev = roundCurrency(item.unitPrice * item.quantity);
      if (prev) {
        prev.units = roundQty(prev.units + item.quantity);
        prev.revenue = roundCurrency(prev.revenue + lineRev);
      } else {
        productSalesMap.set(item.productId, {
          productId: item.productId,
          name: item.productName,
          categoryName: catName,
          unitLabel: prod?.baseUnitLabel ?? 'unit',
          imageUrl: item.imageUrl || prod?.imageUrl || '',
          units: roundQty(item.quantity),
          revenue: lineRev,
        });
      }
    });
  });

  const allSortedProducts = Array.from(productSalesMap.values()).sort(
    (a, b) => b.revenue - a.revenue
  );
  const topSelling = allSortedProducts.slice(0, 6);
  const maxTopRev = Math.max(1, topSelling[0]?.revenue ?? 1);

  return (
    <div className="w-full p-3.5 sm:p-5 space-y-4 sm:space-y-5">
      {/* Multi-Branch Scope Bar */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] px-3.5 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2 text-[12px] flex-wrap min-w-0">
          <Building2 className="w-4 h-4 text-[#FB923C] shrink-0" />
          <span className="font-semibold text-[#181210]">
            {resolvedBranchId === null
              ? 'Consolidated View — All Branches'
              : `${branches.find((b) => b.id === resolvedBranchId)?.name ?? activeBranch.name}`}
          </span>
          <span className="text-[#64748B] hidden sm:inline">
            · {resolvedBranchId === null ? `${branches.length} branches` : activeBranch.branchCode}
          </span>
          <span className="text-[#64748B] tabular-nums">· {activeDateTriggerLabel}</span>
        </div>

        {canViewAllBranches && (
          <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setBranchScope('ACTIVE')}
              className={`px-2.5 py-1 rounded text-[11.5px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                branchScope === 'ACTIVE'
                  ? 'bg-[#181210] text-white'
                  : 'bg-[#FAF9F5] border border-[#E5E7EB] text-[#181210] hover:bg-white'
              }`}
            >
              Active Branch ({activeBranch.branchCode})
            </button>
            <button
              type="button"
              onClick={() => setBranchScope('ALL')}
              className={`px-2.5 py-1 rounded text-[11.5px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                branchScope === 'ALL'
                  ? 'bg-[#FB923C] text-white'
                  : 'bg-[#FAF9F5] border border-[#E5E7EB] text-[#181210] hover:bg-white'
              }`}
            >
              All Branches (Consolidated)
            </button>
            <select
              value={branchScope}
              onChange={(e) => setBranchScope(e.target.value)}
              aria-label="Filter dashboard by branch"
              className="w-full sm:w-auto px-2.5 py-1 rounded border border-[#E5E7EB] bg-white text-[11.5px] font-medium text-[#181210] focus:outline-none focus:border-[#FB923C]"
            >
              <option value="ACTIVE">Current ({activeBranch.name})</option>
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-[#64748B] truncate">{salesKpiTitle}</div>
            <div className="text-[22px] font-bold text-[#181210] mt-1 tabular-nums">
              {formatINR(periodSales)}
            </div>
            <div className="text-[11px] text-[#64748B] mt-1 tabular-nums">
              Avg Bill {formatINRCompact(avgOrderValue)}
            </div>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#FB923C]/12 text-[#FB923C] flex items-center justify-center shrink-0">
            <IndianRupee className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-[#64748B] truncate">{ordersKpiTitle}</div>
            <div className="text-[22px] font-bold text-[#181210] mt-1 tabular-nums">
              {periodCompletedOrders.length} Orders
            </div>
            <div className="text-[11px] text-[#64748B] mt-1 tabular-nums">
              {branchHeldOrders.length} bills currently on hold
            </div>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#FAF9F5] border border-[#E5E7EB] text-[#181210] flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4.5 h-4.5" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => hasPermission('custom_orders', 'view') && setActiveNav('custom_orders')}
          className="bg-white rounded-lg border border-[#E5E7EB] hover:border-[#FB923C] p-4 flex items-start justify-between gap-3 text-left transition-colors"
        >
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-[#64748B]">Pending Custom Orders</div>
            <div className="text-[22px] font-bold text-[#181210] mt-1 tabular-nums">
              {activeCustomOrders.length} Active
            </div>
            <div className="text-[11px] text-[#C2410C] font-medium mt-1 tabular-nums">
              {dueTodayCustom.length} due for pickup today
            </div>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center shrink-0">
            <ClipboardList className="w-4.5 h-4.5" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => hasPermission('stock', 'view') && setActiveNav('stock')}
          className="bg-white rounded-lg border border-[#E5E7EB] hover:border-[#FB923C] p-4 flex items-start justify-between gap-3 text-left transition-colors"
        >
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-[#64748B]">Stock &amp; Expiry Watch</div>
            <div className="text-[22px] font-bold text-[#181210] mt-1 tabular-nums">
              {alertProductIds.size} Items
            </div>
            <div className="text-[11px] text-[#64748B] mt-1 tabular-nums">
              {scopedExpiringBatches.length} batches expiring &le; 24h
            </div>
          </div>
          <div className="w-9 h-9 rounded-md bg-[#FEE2E2] text-[#B91C1C] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
        </button>
      </div>

      {/* Middle Split Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
        {/* Top Selling Products */}
        <div className="lg:col-span-7 bg-white rounded-lg border border-[#E5E7EB] p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-[15px] font-semibold text-[#181210]">Top Selling Products</h2>
                <p className="text-[12px] text-[#64748B]">
                  Best performing cakes, mithai &amp; bakery counter items
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Compact Calendar / Date-Range Selector */}
                <div className="relative" ref={calendarRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftFromDate(fromDate);
                      setDraftToDate(toDate);
                      setShowCalendarPopover((prev) => !prev);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[#E5E7EB] bg-[#FAF9F5] hover:bg-white hover:border-[#FB923C] text-[12px] font-medium text-[#181210] transition-colors whitespace-nowrap shrink-0"
                    aria-expanded={showCalendarPopover}
                    aria-haspopup="dialog"
                    aria-label="Filter dashboard by date or date range"
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#FB923C] shrink-0" />
                    <span className="tabular-nums">{activeDateTriggerLabel}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                  </button>

                  {showCalendarPopover && (
                    <div
                      role="dialog"
                      aria-label="Select date or date range"
                      className="absolute left-0 sm:left-auto sm:right-0 mt-1.5 w-[min(300px,calc(100vw-2.5rem))] rounded-lg border border-[#E5E7EB] bg-white shadow-lg p-3.5 z-30"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B] mb-2">
                        Quick Ranges
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 mb-3">
                        {(
                          [
                            { id: 'today', label: 'Today' },
                            { id: 'yesterday', label: 'Yesterday' },
                            { id: '7d', label: 'Last 7 Days' },
                            { id: '30d', label: 'Last 30 Days' },
                            { id: 'all', label: 'All Time' },
                          ] as const
                        ).map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handleSelectPreset(preset.id)}
                            className={`px-2.5 py-1.5 rounded text-[11.5px] font-medium text-left transition-colors whitespace-nowrap ${
                              datePreset === preset.id
                                ? 'bg-[#181210] text-white'
                                : 'bg-[#FAF9F5] border border-[#E5E7EB] text-[#181210] hover:border-[#FB923C]'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <form onSubmit={handleApplyCustomRange} className="pt-3 border-t border-[#E5E7EB]">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                            Single Date or Range
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSelectPreset('today')}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#64748B] hover:text-[#181210]"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reset
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="block text-[10.5px] text-[#64748B] mb-1">From</span>
                            <input
                              type="date"
                              value={draftFromDate}
                              onChange={(e) => setDraftFromDate(e.target.value)}
                              className="w-full px-2 py-1.5 rounded border border-[#E5E7EB] bg-[#FAF9F5] text-[11.5px] text-[#181210] focus:outline-none focus:border-[#FB923C]"
                            />
                          </label>
                          <label className="block">
                            <span className="block text-[10.5px] text-[#64748B] mb-1">To</span>
                            <input
                              type="date"
                              value={draftToDate}
                              onChange={(e) => setDraftToDate(e.target.value)}
                              className="w-full px-2 py-1.5 rounded border border-[#E5E7EB] bg-[#FAF9F5] text-[11.5px] text-[#181210] focus:outline-none focus:border-[#FB923C]"
                            />
                          </label>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => {
                              const single = draftFromDate || TODAY_ISO;
                              setDraftFromDate(single);
                              setDraftToDate(single);
                              setFromDate(single);
                              setToDate(single);
                              setDatePreset('custom');
                              setShowCalendarPopover(false);
                            }}
                            className="px-2.5 py-1.5 rounded border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[11.5px] font-medium text-[#181210] whitespace-nowrap"
                          >
                            Single Day Only
                          </button>
                          <button
                            type="submit"
                            className="px-3 py-1.5 rounded bg-[#FB923C] hover:bg-[#F97316] text-white text-[11.5px] font-semibold transition-colors whitespace-nowrap"
                          >
                            Apply Range
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>

                {hasPermission('reports', 'view') && (
                  <button
                    type="button"
                    onClick={() => setActiveNav('reports')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[12px] font-semibold text-[#FB923C] hover:text-[#F97316] hover:bg-[#FFEDD5]/50 transition-colors whitespace-nowrap shrink-0"
                  >
                    View Sales Report
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                )}
              </div>
            </div>

            {topSelling.length === 0 ? (
              <div className="py-14 px-4 text-center rounded-lg border border-dashed border-[#E5E7EB] bg-[#FAF9F5]">
                <p className="text-[13px] font-medium text-[#181210]">
                  No completed counter sales found for {activeDateTriggerLabel}.
                </p>
                <p className="text-[12px] text-[#64748B] mt-1">
                  Try expanding the date range or switching branches to inspect product sales.
                </p>
                <button
                  type="button"
                  onClick={() => handleSelectPreset('7d')}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-[#E5E7EB] hover:border-[#FB923C] text-[12px] font-semibold text-[#181210] transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#FB923C]" />
                  Show Last 7 Days
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {topSelling.map((item, idx) => {
                  const pct = Math.max(6, Math.round((item.revenue / maxTopRev) * 100));
                  return (
                    <div
                      key={item.productId}
                      className="rounded-lg border border-[#E5E7EB] bg-[#FAF9F5] hover:border-[#FB923C]/70 transition-colors overflow-hidden flex flex-col"
                    >
                      <div className="relative h-24 w-full bg-white border-b border-[#E5E7EB] overflow-hidden shrink-0">
                        <ProductThumb
                          src={item.imageUrl}
                          alt={item.name}
                          borderless
                          className="w-full h-full"
                        />
                        <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-[#181210]/85 text-white text-[10px] font-bold tabular-nums">
                          #{idx + 1}
                        </span>
                      </div>

                      <div className="p-3 flex-1 flex flex-col justify-between gap-2.5">
                        <div>
                          <div className="text-[13px] font-semibold text-[#181210] leading-snug line-clamp-2 min-h-[36px]">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-[#64748B] truncate mt-0.5">
                            {item.categoryName}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[11.5px] font-medium text-[#64748B] tabular-nums">
                              {formatDecimal(item.units, 3)} sold
                            </span>
                            <span className="text-[13.5px] font-bold text-[#181210] tabular-nums shrink-0">
                              {formatINRCompact(item.revenue)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-white border border-[#E5E7EB] rounded-full overflow-hidden mt-1.5">
                            <div
                              className="h-full bg-[#FB923C] rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 mt-4 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <span className="text-[#64748B] tabular-nums">
              {allSortedProducts.length > 0
                ? `Showing top ${topSelling.length} of ${allSortedProducts.length} items sold`
                : 'No items sold in selected range'}
            </span>
            <span className="font-semibold text-[#181210] tabular-nums">
              Period Sales {formatINRCompact(periodSales)}
            </span>
          </div>
        </div>

        {/* Freshness Alerts & Today's Custom Pickups */}
        <div className="lg:col-span-5 bg-white rounded-lg border border-[#E5E7EB] p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-[15px] font-semibold text-[#181210]">
                  Freshness &amp; Pickup Alerts
                </h2>
                <p className="text-[12px] text-[#64748B]">
                  Batches nearing expiry, low stock &amp; today&apos;s cake handovers
                </p>
              </div>
              {hasPermission('stock', 'view') && (
                <button
                  type="button"
                  onClick={() => setActiveNav('stock')}
                  className="text-[12px] font-semibold text-[#FB923C] hover:text-[#F97316] whitespace-nowrap shrink-0"
                >
                  Manage Stock
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {scopedExpiringBatches.slice(0, 2).map((b) => (
                <div
                  key={b.id}
                  className="p-3 rounded-md bg-[#FFEDD5]/60 border border-[#FB923C]/30 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[#181210] truncate">
                      {b.productName}
                    </div>
                    <div className="text-[11px] text-[#C2410C] font-medium">
                      Batch {b.batchCode} · {b.daysLeft <= 0 ? 'Expired / Today' : 'Expires tomorrow'} ·{' '}
                      {formatStockQty(b.quantity, b.unitLabel)}
                    </div>
                  </div>
                  {hasPermission('stock', 'view') && (
                    <button
                      type="button"
                      onClick={() => setActiveNav('stock')}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-[#FB923C]/40 text-[#C2410C] rounded hover:bg-[#FAF9F5] shrink-0"
                    >
                      Inspect
                    </button>
                  )}
                </div>
              ))}

              {scopedLowStockProducts.slice(0, 2).map((p) => (
                <div
                  key={p.id}
                  className="p-3 rounded-md bg-[#FAF9F5] border border-[#E5E7EB] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[#181210] truncate">{p.name}</div>
                    <div className="text-[11px] text-[#64748B]">
                      Low stock:{' '}
                      {formatStockQty(
                        getProductStock(p.id, resolvedBranchId ?? activeBranchId),
                        p.baseUnitLabel
                      )}{' '}
                      left (min {formatDecimal(p.minStockAlert, 3)} {p.baseUnitLabel})
                    </div>
                  </div>
                  {hasPermission('stock', 'view') && (
                    <button
                      type="button"
                      onClick={() => setActiveNav('stock')}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-[#E5E7EB] text-[#181210] rounded hover:bg-[#FAF9F5] shrink-0"
                    >
                      Restock
                    </button>
                  )}
                </div>
              ))}

              {dueTodayCustom.slice(0, 2).map((co) => (
                <div
                  key={co.id}
                  className="p-3 rounded-md bg-[#FAF9F5] border border-[#E5E7EB] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Cake className="w-4 h-4 text-[#FB923C] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[#181210] truncate">
                        {co.orderNumber} · {co.customerName}
                      </div>
                      <div className="text-[11px] text-[#64748B] truncate">
                        {co.itemTitle} · Pickup {co.pickupTime} · {co.status}
                      </div>
                    </div>
                  </div>
                  {hasPermission('custom_orders', 'view') && (
                    <button
                      type="button"
                      onClick={() => setActiveNav('custom_orders')}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-[#FB923C] text-white rounded hover:bg-[#F97316] shrink-0"
                    >
                      Open
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <span className="text-[#64748B]">Recent Bill: {branchOrders[0]?.billNumber ?? '—'}</span>
            {branchOrders[0] && (
              <button
                type="button"
                onClick={() => setActiveReceipt(branchOrders[0])}
                className="font-semibold text-[#181210] hover:text-[#FB923C]"
              >
                View Last Receipt
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Orders on Hold */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[15px] font-semibold text-[#181210]">Orders on Hold</h2>
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-[#FFEDD5] text-[#C2410C] tabular-nums">
              {branchHeldOrders.length} Pending
            </span>
          </div>
          {hasPermission('pos', 'view') && (
            <button
              type="button"
              onClick={() => setActiveNav('pos')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium border border-[#E5E7EB] rounded-md text-[#181210] hover:bg-[#FAF9F5] transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Open POS Counter
            </button>
          )}
        </div>

        {branchHeldOrders.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-[#E5E7EB] rounded-lg bg-[#FAF9F5]">
            <p className="text-[13px] text-[#64748B]">No bills are currently on hold.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branchHeldOrders.map((held) => {
              const total = roundCurrency(
                held.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
              );
              const itemCount = roundQty(held.items.reduce((s, i) => s + i.quantity, 0));
              return (
                <div
                  key={held.id}
                  className="rounded-lg border border-[#E5E7EB] bg-[#FAF9F5] p-4 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-bold text-[#181210]">{held.ticketLabel}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#64748B] tabular-nums">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(held.heldAt)}
                      </span>
                    </div>
                    <div className="text-[13px] font-medium text-[#181210] mt-1.5">
                      {held.customerName}
                      {held.customerPhone && (
                        <span className="text-[#64748B] font-normal"> · {held.customerPhone}</span>
                      )}
                    </div>
                    <div className="text-[12px] text-[#64748B] mt-1 line-clamp-2">
                      {held.items
                        .map((i) => `${formatDecimal(i.quantity, 3)}x ${i.productName} (${i.variantLabel})`)
                        .join(', ')}
                    </div>
                    {held.notes && (
                      <div className="text-[11px] text-[#C2410C] mt-1.5">Note: {held.notes}</div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] text-[#64748B] tabular-nums">
                        {formatDecimal(itemCount, 3)} items
                      </div>
                      <div className="text-[15px] font-bold text-[#181210] tabular-nums">
                        {formatINRCompact(total)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => deleteHeldOrder(held.id)}
                        className="p-2 rounded-md border border-[#E5E7EB] bg-white text-[#B91C1C] hover:bg-[#FEE2E2] transition-colors"
                        title="Discard held bill"
                        aria-label="Discard held bill"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => resumeHeldOrder(held.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[12px] font-semibold transition-colors whitespace-nowrap"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Resume Bill
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
