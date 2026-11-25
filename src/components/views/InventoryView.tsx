import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Building2,
  CalendarClock,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileText,
  Mail,
  MapPin,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { usePos } from '../../context/PosContext';
import {
  InventoryItem,
  PendingStockReceipt,
  Supplier,
} from '../../types/pos';
import {
  daysUntil,
  exportToCsv,
  formatDateShort,
  formatDateTime,
  formatDecimal,
  formatINRCompact,
  formatStockQty,
  roundCurrency,
  roundQty,
  TODAY_ISO,
} from '../../utils/formatters';
import {
  AttachmentPreviewModal,
  BatchStockInModal,
  INVENTORY_CATEGORIES,
  ItemFormModal,
  StockOutModal,
  SupplierFormModal,
} from '../inventory/InventoryModals';

type InventoryTab = 'items' | 'expiry' | 'suppliers' | 'pending' | 'history';
type ItemStatusFilter =
  | 'ALL'
  | 'AVAILABLE'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK'
  | 'EXPIRING'
  | 'INACTIVE';
type SortField = 'name' | 'quantity' | 'expiryDate' | 'status';

function getItemHealth(item: InventoryItem): {
  key: 'INACTIVE' | 'OUT_OF_STOCK' | 'EXPIRED' | 'EXPIRING_SOON' | 'LOW_STOCK' | 'AVAILABLE';
  label: string;
  rank: number;
  badgeClass: string;
} {
  if (item.status === 'Inactive') {
    return {
      key: 'INACTIVE',
      label: 'Inactive',
      rank: 5,
      badgeClass: 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]',
    };
  }
  if (item.quantity <= 0) {
    return {
      key: 'OUT_OF_STOCK',
      label: 'Out of Stock',
      rank: 0,
      badgeClass: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]',
    };
  }
  const expDays =
    item.trackExpiry && item.expiryDate ? daysUntil(item.expiryDate, TODAY_ISO) : 999;
  if (expDays < 0) {
    return {
      key: 'EXPIRED',
      label: 'Expired',
      rank: 1,
      badgeClass: 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]',
    };
  }
  if (item.quantity <= item.minStockLevel) {
    return {
      key: 'LOW_STOCK',
      label: 'Low Stock',
      rank: 2,
      badgeClass: 'bg-[#FFEDD5] text-[#C2410C] border-[#FED7AA]',
    };
  }
  if (expDays <= 3) {
    return {
      key: 'EXPIRING_SOON',
      label: expDays === 0 ? 'Expires Today' : `Expires in ${expDays}d`,
      rank: 3,
      badgeClass: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]',
    };
  }
  return {
    key: 'AVAILABLE',
    label: 'Available',
    rank: 4,
    badgeClass: 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]',
  };
}

export const InventoryView: React.FC = () => {
  const {
    inventoryItems,
    inventoryTxns,
    suppliers,
    pendingReceipts,
    confirmPendingReceipt,
    cancelPendingReceipt,
    globalSearch,
    activeBranchId,
    activeBranch,
    hasPermission,
  } = usePos();

  const isBranchActive = activeBranch.status === 'Active';
  const canCreate = hasPermission('inventory', 'create') && isBranchActive;
  const canEdit = hasPermission('inventory', 'edit') && isBranchActive;

  const branchItems = useMemo(
    () => inventoryItems.filter((i) => (i.branchId ?? 'br-1') === activeBranchId),
    [inventoryItems, activeBranchId]
  );
  const branchTxns = useMemo(
    () => inventoryTxns.filter((t) => (t.branchId ?? 'br-1') === activeBranchId),
    [inventoryTxns, activeBranchId]
  );
  const branchPending = useMemo(
    () => pendingReceipts.filter((r) => (r.branchId ?? 'br-1') === activeBranchId),
    [pendingReceipts, activeBranchId]
  );

  const [tab, setTab] = useState<InventoryTab>('items');

  // Items Tab State
  const [itemSearch, setItemSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<ItemStatusFilter>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Expiry Tab State
  const [expiryFilter, setExpiryFilter] = useState<
    'ALL' | 'EXPIRED' | 'URGENT_3D' | 'SOON_14D' | 'HEALTHY'
  >('ALL');

  // Suppliers Tab State
  const [supplierSearch, setSupplierSearch] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);

  // History Tab State
  const [txnSearch, setTxnSearch] = useState('');
  const [txnTypeFilter, setTxnTypeFilter] = useState<'ALL' | 'Stock In' | 'Stock Out' | 'Adjustment'>('ALL');
  const [txnItemFilter, setTxnItemFilter] = useState<string>('ALL');
  const [txnSupplierFilter, setTxnSupplierFilter] = useState<string>('ALL');
  const [txnFromDate, setTxnFromDate] = useState<string>('');
  const [txnToDate, setTxnToDate] = useState<string>('');

  // Pending Receipt Confirmation State
  const [confirmingPendingId, setConfirmingPendingId] = useState<string | null>(null);

  // Modal States
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  const [stockInOpen, setStockInOpen] = useState(false);
  const [stockInItemId, setStockInItemId] = useState<string | undefined>(undefined);
  const [stockInSupplierId, setStockInSupplierId] = useState<string | undefined>(undefined);
  const [stockInPending, setStockInPending] = useState<PendingStockReceipt | null>(null);

  const [stockOutOpen, setStockOutOpen] = useState(false);
  const [stockOutItemId, setStockOutItemId] = useState<string | undefined>(undefined);
  const [stockOutReason, setStockOutReason] = useState<string | undefined>(undefined);

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [attachmentPreview, setAttachmentPreview] = useState<{
    name: string;
    dataUrl?: string;
    ref?: string;
  } | null>(null);

  // Overview KPI Metrics
  const overview = useMemo(() => {
    const totalItems = branchItems.length;
    const activeItems = branchItems.filter((i) => i.status !== 'Inactive').length;
    const availableItems = branchItems.filter(
      (i) => i.status !== 'Inactive' && i.quantity > i.minStockLevel
    ).length;
    const stockValuation = branchItems.reduce(
      (s, i) => s + i.quantity * i.unitCost,
      0
    );
    const outOfStock = branchItems.filter(
      (i) => i.status !== 'Inactive' && i.quantity <= 0
    ).length;
    const lowStock = branchItems.filter(
      (i) => i.status !== 'Inactive' && i.quantity > 0 && i.quantity <= i.minStockLevel
    ).length;
    const expiringOrExpired = branchItems.filter(
      (i) =>
        i.status !== 'Inactive' &&
        i.trackExpiry &&
        i.expiryDate &&
        i.quantity > 0 &&
        daysUntil(i.expiryDate, TODAY_ISO) <= 7
    ).length;
    const pendingCount = branchPending.length;

    return {
      totalItems,
      activeItems,
      availableItems,
      stockValuation,
      outOfStock,
      lowStock,
      expiringOrExpired,
      pendingCount,
    };
  }, [branchItems, branchPending]);

  // Filtered & Sorted Inventory Items
  const filteredItems = useMemo(() => {
    const q = (itemSearch || globalSearch).trim().toLowerCase();
    const list = branchItems.filter((item) => {
      if (catFilter !== 'ALL' && item.category !== catFilter) return false;
      if (supplierFilter !== 'ALL' && item.supplierId !== supplierFilter) return false;

      if (statusFilter === 'AVAILABLE') {
        if (item.status === 'Inactive' || item.quantity <= item.minStockLevel) return false;
      } else if (statusFilter === 'LOW_STOCK') {
        if (
          item.status === 'Inactive' ||
          item.quantity <= 0 ||
          item.quantity > item.minStockLevel
        )
          return false;
      } else if (statusFilter === 'OUT_OF_STOCK') {
        if (item.status === 'Inactive' || item.quantity > 0) return false;
      } else if (statusFilter === 'EXPIRING') {
        if (
          !item.trackExpiry ||
          !item.expiryDate ||
          item.quantity <= 0 ||
          daysUntil(item.expiryDate, TODAY_ISO) > 7
        ) {
          return false;
        }
      } else if (statusFilter === 'INACTIVE') {
        if (item.status !== 'Inactive') return false;
      }

      if (q) {
        const hay = [
          item.name,
          item.sku,
          item.category,
          item.supplierName ?? '',
          item.storageLocation ?? '',
          item.batchNumber ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const mult = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortField === 'name') {
        return a.name.localeCompare(b.name) * mult;
      }
      if (sortField === 'quantity') {
        return (a.quantity - b.quantity) * mult;
      }
      if (sortField === 'expiryDate') {
        const ea = a.trackExpiry && a.expiryDate ? a.expiryDate : '9999-12-31';
        const eb = b.trackExpiry && b.expiryDate ? b.expiryDate : '9999-12-31';
        return ea.localeCompare(eb) * mult;
      }
      return (getItemHealth(a).rank - getItemHealth(b).rank) * mult;
    });
  }, [
    branchItems,
    itemSearch,
    globalSearch,
    catFilter,
    supplierFilter,
    statusFilter,
    sortField,
    sortDir,
  ]);

  // Expiry Items
  const expiryItems = useMemo(() => {
    const tracked = branchItems
      .filter((i) => i.trackExpiry && i.expiryDate && i.status !== 'Inactive')
      .map((i) => {
        const dLeft = daysUntil(i.expiryDate!, TODAY_ISO);
        return {
          ...i,
          dLeft,
          valueAtRisk: roundCurrency(i.quantity * i.unitCost),
        };
      })
      .sort((a, b) => a.dLeft - b.dLeft);

    return tracked.filter((item) => {
      if (expiryFilter === 'EXPIRED') return item.dLeft < 0;
      if (expiryFilter === 'URGENT_3D') return item.dLeft >= 0 && item.dLeft <= 3;
      if (expiryFilter === 'SOON_14D') return item.dLeft >= 0 && item.dLeft <= 14;
      if (expiryFilter === 'HEALTHY') return item.dLeft > 14;
      return true;
    });
  }, [branchItems, expiryFilter]);

  // Supplier Metrics & Filtering
  const supplierRows = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    return suppliers
      .map((sup) => {
        const linkedItems = branchItems.filter(
          (i) => i.supplierId === sup.id || i.supplierName === sup.name
        );
        const supTxns = branchTxns.filter(
          (t) =>
            t.type === 'Stock In' &&
            (t.supplierId === sup.id || t.supplierName === sup.name)
        );
        const totalSpend = supTxns.reduce((s, t) => s + (t.purchaseCost ?? 0), 0);
        const lastDelivery = supTxns[0]?.timestamp;
        const pendingForSup = branchPending.filter(
          (r) => r.supplierId === sup.id || r.supplierName === sup.name
        ).length;
        return {
          supplier: sup,
          linkedItemsCount: linkedItems.length,
          totalSpend,
          lastDelivery,
          deliveriesCount: supTxns.length,
          pendingForSup,
        };
      })
      .filter((row) => {
        if (!q) return true;
        const s = row.supplier;
        return (
          s.name.toLowerCase().includes(q) ||
          s.contactPerson.toLowerCase().includes(q) ||
          s.phone.toLowerCase().includes(q) ||
          (s.email ?? '').toLowerCase().includes(q)
        );
      });
  }, [suppliers, branchItems, branchTxns, branchPending, supplierSearch]);

  const activeSupplierDetail = useMemo(() => {
    if (!selectedSupplierId) return null;
    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supplier) return null;
    const items = branchItems.filter(
      (i) => i.supplierId === supplier.id || i.supplierName === supplier.name
    );
    const txns = branchTxns.filter(
      (t) => t.supplierId === supplier.id || t.supplierName === supplier.name
    );
    const pending = branchPending.filter(
      (r) => r.supplierId === supplier.id || r.supplierName === supplier.name
    );
    const totalSpend = txns
      .filter((t) => t.type === 'Stock In')
      .reduce((s, t) => s + (t.purchaseCost ?? 0), 0);
    return { supplier, items, txns, pending, totalSpend };
  }, [selectedSupplierId, suppliers, branchItems, branchTxns, branchPending]);

  // Filtered Transaction History
  const filteredTxns = useMemo(() => {
    const q = txnSearch.trim().toLowerCase();
    return branchTxns.filter((tx) => {
      if (txnTypeFilter !== 'ALL' && tx.type !== txnTypeFilter) return false;
      if (txnItemFilter !== 'ALL' && tx.itemId !== txnItemFilter) return false;
      if (
        txnSupplierFilter !== 'ALL' &&
        tx.supplierId !== txnSupplierFilter &&
        tx.supplierName !== suppliers.find((s) => s.id === txnSupplierFilter)?.name
      ) {
        return false;
      }
      const txDate = tx.timestamp.slice(0, 10);
      if (txnFromDate && txDate < txnFromDate) return false;
      if (txnToDate && txDate > txnToDate) return false;

      if (q) {
        const hay = [
          tx.itemName,
          tx.supplierName ?? '',
          tx.referenceNumber ?? '',
          tx.reason,
          tx.notes ?? '',
          tx.performedBy,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    branchTxns,
    txnSearch,
    txnTypeFilter,
    txnItemFilter,
    txnSupplierFilter,
    txnFromDate,
    txnToDate,
    suppliers,
  ]);

  // Action Launchers
  const openAddItem = () => {
    setEditingItem(null);
    setItemModalOpen(true);
  };

  const openEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setItemModalOpen(true);
  };

  const openStockIn = (opts?: {
    itemId?: string;
    supplierId?: string;
    pending?: PendingStockReceipt;
  }) => {
    setStockInItemId(opts?.itemId);
    setStockInSupplierId(opts?.supplierId);
    setStockInPending(opts?.pending ?? null);
    setStockInOpen(true);
  };

  const openStockOut = (itemId?: string, reason?: string) => {
    setStockOutItemId(itemId);
    setStockOutReason(reason);
    setStockOutOpen(true);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleExportItemsCsv = () => {
    exportToCsv(
      'bakecore_inventory_items.csv',
      [
        'Item Code (SKU)',
        'Item Name',
        'Category',
        'Supplier',
        'Available Stock',
        'Unit',
        'Minimum Level',
        'Purchase Price',
        'Selling Price',
        'Batch #',
        'Expiry Date',
        'Storage Location',
        'Status',
      ],
      filteredItems.map((i) => [
        i.sku,
        i.name,
        i.category,
        i.supplierName ?? '-',
        roundQty(i.quantity),
        i.unit,
        roundQty(i.minStockLevel),
        roundCurrency(i.unitCost).toFixed(2),
        i.sellingPrice !== undefined ? roundCurrency(i.sellingPrice).toFixed(2) : '-',
        i.batchNumber ?? '-',
        i.trackExpiry && i.expiryDate ? i.expiryDate : 'Non-perishable',
        i.storageLocation ?? '-',
        getItemHealth(i).label,
      ])
    );
  };

  const handleExportHistoryCsv = () => {
    exportToCsv(
      'bakecore_inventory_history.csv',
      [
        'Date',
        'Item Name',
        'Transaction Type',
        'Delta',
        'Prev Qty',
        'Updated Qty',
        'Unit',
        'Purchase Value',
        'Supplier',
        'Reference #',
        'Reason',
        'Notes',
        'Updated By',
      ],
      filteredTxns.map((t) => [
        formatDateTime(t.timestamp),
        t.itemName,
        t.type,
        roundQty(t.quantityDelta),
        roundQty(t.previousQty),
        roundQty(t.updatedQty),
        t.unit,
        t.purchaseCost !== undefined ? roundCurrency(t.purchaseCost).toFixed(2) : '-',
        t.supplierName ?? '-',
        t.referenceNumber ?? '-',
        t.reason,
        t.notes ?? '-',
        t.performedBy,
      ])
    );
  };

  return (
    <div className="w-full p-3.5 sm:p-4 space-y-4 min-h-[calc(100vh-65px)]">
      {/* Inventory Overview Grid (6 Operational Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => {
            setTab('items');
            setStatusFilter('ALL');
          }}
          className="text-left bg-white rounded-xl border border-[#E5E7EB] p-3 sm:p-4 transition-colors duration-150 hover:border-[#181210]"
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
            Total Inventory Items
          </p>
          <p className="text-[18px] sm:text-[22px] font-bold text-[#181210] tabular-nums mt-1.5">
            {overview.totalItems}
          </p>
          <p className="text-[11.5px] text-[#6B7280] mt-1 tabular-nums">
            {overview.activeItems} active SKUs
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('items');
            setStatusFilter('AVAILABLE');
          }}
          className={`text-left bg-white rounded-xl border p-3 sm:p-4 transition-colors hover:border-[#9CA3AF] ${
            tab === 'items' && statusFilter === 'AVAILABLE'
              ? 'border-[#15803D]'
              : 'border-[#E5E7EB]'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
            Available Stock
          </p>
          <p className="text-[18px] sm:text-[22px] font-bold text-[#15803D] tabular-nums mt-1.5">
            {formatINRCompact(overview.stockValuation)}
          </p>
          <p className="text-[11.5px] text-[#6B7280] mt-1 tabular-nums">
            {overview.availableItems} healthy items
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('items');
            setStatusFilter('LOW_STOCK');
          }}
          className={`text-left bg-white rounded-xl border p-3 sm:p-4 transition-colors hover:border-[#FB923C] ${
            tab === 'items' && statusFilter === 'LOW_STOCK'
              ? 'border-[#C2410C]'
              : 'border-[#E5E7EB]'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
            Low-Stock Items
          </p>
          <p className="text-[18px] sm:text-[22px] font-bold text-[#C2410C] tabular-nums mt-1.5">
            {overview.lowStock}
          </p>
          <p className="text-[11.5px] text-[#6B7280] mt-1">
            At or below minimum
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('items');
            setStatusFilter('OUT_OF_STOCK');
          }}
          className={`text-left bg-white rounded-xl border p-3 sm:p-4 transition-colors hover:border-[#EF4444] ${
            tab === 'items' && statusFilter === 'OUT_OF_STOCK'
              ? 'border-[#B91C1C]'
              : 'border-[#E5E7EB]'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
            Out-of-Stock Items
          </p>
          <p className="text-[18px] sm:text-[22px] font-bold text-[#B91C1C] tabular-nums mt-1.5">
            {overview.outOfStock}
          </p>
          <p className="text-[11.5px] text-[#6B7280] mt-1">
            Immediate restock needed
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('expiry');
            setExpiryFilter('ALL');
          }}
          className={`text-left bg-white rounded-xl border p-3 sm:p-4 transition-colors hover:border-[#F59E0B] ${
            tab === 'expiry' ? 'border-[#B45309]' : 'border-[#E5E7EB]'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
            Expiring / Near-Expiry
          </p>
          <p className="text-[18px] sm:text-[22px] font-bold text-[#B45309] tabular-nums mt-1.5">
            {overview.expiringOrExpired}
          </p>
          <p className="text-[11.5px] text-[#6B7280] mt-1">
            Expired or within 7 days
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTab('pending')}
          className={`text-left bg-white rounded-xl border p-3 sm:p-4 transition-colors hover:border-[#181210] ${
            tab === 'pending' ? 'border-[#181210]' : 'border-[#E5E7EB]'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
            Pending Movements
          </p>
          <p className="text-[18px] sm:text-[22px] font-bold text-[#181210] tabular-nums mt-1.5">
            {overview.pendingCount}
          </p>
          <p className="text-[11.5px] text-[#6B7280] mt-1">
            Awaiting supplier receipt
          </p>
        </button>
      </div>

      {/* Main Workspace Card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        {/* Table Header: Sub-Navigation Tabs (Left) & Action Buttons (Right) */}
        <div className="px-4 sm:px-5 pt-2 border-b border-[#E5E7EB] flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 bg-[#FAF9F5]/60">
          <div className="flex items-center gap-1 overflow-x-auto min-w-0">
            {(
              [
                { id: 'items', label: `Inventory Items (${branchItems.length})` },
                { id: 'expiry', label: `Expiry Management (${overview.expiringOrExpired})` },
                { id: 'suppliers', label: `Suppliers (${suppliers.length})` },
                { id: 'pending', label: `Pending Movements (${branchPending.length})` },
                { id: 'history', label: `Transaction History (${branchTxns.length})` },
              ] as { id: InventoryTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-2.5 text-[12.5px] font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  tab === t.id
                    ? 'border-[#FB923C] text-[#181210]'
                    : 'border-transparent text-[#6B7280] hover:text-[#181210]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 pb-2 shrink-0">
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => openStockIn()}
                  className="px-3 py-1.5 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-[12px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors"
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                  Stock In
                </button>
                <button
                  type="button"
                  onClick={() => openStockOut()}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#D1D5DB] hover:bg-[#FAF9F5] text-[#181210] text-[12px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors"
                >
                  <PackageMinus className="w-3.5 h-3.5 text-[#C2410C]" />
                  Stock Out
                </button>
              </>
            )}
            {canCreate && (
              <button
                type="button"
                onClick={openAddItem}
                className="px-3.5 py-1.5 rounded-lg bg-[#FB923C] hover:bg-[#EA580C] text-white text-[12px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            )}
          </div>
        </div>

        {/* ================================================================
            TAB 1: INVENTORY ITEMS TABLE
            ================================================================ */}
        {tab === 'items' && (
          <div>
            {/* Filters & Export Toolbar */}
            <div className="p-3.5 sm:p-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0 w-full sm:w-auto">
                <div className="relative w-full sm:flex-1 sm:min-w-[210px] sm:max-w-xs">
                  <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Search item, SKU, supplier, location..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#D1D5DB] text-[12.5px] focus:outline-none focus:border-[#FB923C]"
                  />
                </div>

                <select
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-lg border border-[#D1D5DB] text-[12.5px] bg-white focus:outline-none focus:border-[#FB923C]"
                >
                  <option value="ALL">All Categories</option>
                  {INVENTORY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ItemStatusFilter)}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-lg border border-[#D1D5DB] text-[12.5px] bg-white focus:outline-none focus:border-[#FB923C]"
                >
                  <option value="ALL">All Stock Statuses</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="LOW_STOCK">Low Stock</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                  <option value="EXPIRING">Expiring / Expired</option>
                  <option value="INACTIVE">Inactive</option>
                </select>

                <select
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-lg border border-[#D1D5DB] text-[12.5px] bg-white focus:outline-none focus:border-[#FB923C]"
                >
                  <option value="ALL">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                {(itemSearch ||
                  catFilter !== 'ALL' ||
                  statusFilter !== 'ALL' ||
                  supplierFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setItemSearch('');
                      setCatFilter('ALL');
                      setStatusFilter('ALL');
                      setSupplierFilter('ALL');
                    }}
                    className="px-2.5 py-1.5 text-[12px] font-semibold text-[#C2410C] hover:underline"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleExportItemsCsv}
                className="px-3 py-1.5 rounded-lg border border-[#D1D5DB] bg-white hover:bg-[#FAF9F5] text-[12.5px] font-semibold text-[#181210] flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>

            {filteredItems.length === 0 ? (
              <div className="py-14 px-6 text-center space-y-3">
                <p className="text-[14px] font-semibold text-[#181210]">
                  No inventory items match the selected filters
                </p>
                <p className="text-[12.5px] text-[#6B7280]">
                  Adjust your search or status filter, or register a new inventory item.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setItemSearch('');
                      setCatFilter('ALL');
                      setStatusFilter('ALL');
                      setSupplierFilter('ALL');
                    }}
                    className="px-3.5 py-1.5 rounded-lg border border-[#D1D5DB] text-[12.5px] font-semibold text-[#374151] hover:bg-[#FAF9F5]"
                  >
                    Reset Filters
                  </button>
                  {canCreate && (
                    <button
                      type="button"
                      onClick={openAddItem}
                      className="px-3.5 py-1.5 rounded-lg bg-[#FB923C] text-white text-[12.5px] font-semibold hover:bg-[#EA580C]"
                    >
                      Add New Item
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div>
                {/* Mobile Inventory Items Cards */}
                <div className="md:hidden divide-y divide-[#E5E7EB]">
                  {filteredItems.map((item) => {
                    const health = getItemHealth(item);
                    const expDays =
                      item.trackExpiry && item.expiryDate
                        ? daysUntil(item.expiryDate, TODAY_ISO)
                        : null;
                    return (
                      <div key={item.id} className="p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#181210]">{item.name}</p>
                            <p className="text-[11.5px] text-[#6B7280] mt-0.5">
                              <span className="font-mono">{item.sku}</span> · {item.category}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${health.badgeClass}`}
                          >
                            {health.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] tabular-nums">
                          <div>
                            <span className="font-bold text-[#181210]">
                              {formatStockQty(item.quantity, item.unit)}
                            </span>
                            <span className="text-[#6B7280]">
                              {' '}
                              ({formatINRCompact(item.unitCost)} / {item.unit})
                            </span>
                          </div>
                          <span className="text-[#6B7280]">
                            Min: {formatDecimal(item.minStockLevel, 3)} {item.unit}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[#6B7280]">
                          <div className="min-w-0">
                            <span>{item.storageLocation || 'Main Store'}</span>
                            {item.supplierName ? (
                              <>
                                {' · '}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const matched = suppliers.find(
                                      (s) =>
                                        s.id === item.supplierId ||
                                        s.name === item.supplierName
                                    );
                                    if (matched) {
                                      setTab('suppliers');
                                      setSelectedSupplierId(matched.id);
                                    }
                                  }}
                                  className="text-[#C2410C] font-medium hover:underline"
                                >
                                  {item.supplierName}
                                </button>
                              </>
                            ) : null}
                          </div>
                          <span className="tabular-nums">
                            {item.trackExpiry && item.expiryDate
                              ? `Exp ${formatDateShort(item.expiryDate)}${
                                  expDays !== null && expDays <= 7
                                    ? ` (${
                                        expDays < 0
                                          ? `${Math.abs(expDays)}d overdue`
                                          : expDays === 0
                                          ? 'Today'
                                          : `${expDays}d left`
                                      })`
                                    : ''
                                }`
                              : 'Non-perishable'}
                          </span>
                        </div>

                        {canEdit && (
                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => openStockIn({ itemId: item.id })}
                              className="h-7 px-2.5 rounded-md border border-[#BBF7D0] bg-[#DCFCE7]/50 hover:bg-[#DCFCE7] text-[#15803D] text-[11.5px] font-semibold inline-flex items-center transition-colors"
                            >
                              + In
                            </button>
                            <button
                              type="button"
                              disabled={item.quantity <= 0}
                              onClick={() => openStockOut(item.id)}
                              className="h-7 px-2.5 rounded-md border border-[#FED7AA] bg-[#FFEDD5]/50 hover:bg-[#FFEDD5] text-[#C2410C] text-[11.5px] font-semibold disabled:opacity-40 inline-flex items-center transition-colors"
                            >
                              - Out
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditItem(item)}
                              className="h-7 w-7 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[#4B5563] hover:text-[#181210] inline-flex items-center justify-center transition-colors"
                              aria-label={`Edit ${item.name}`}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1040px]">
                  <thead>
                    <tr className="bg-[#FAF9F5] border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                      <th className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => toggleSort('name')}
                          className="inline-flex items-center gap-1 uppercase hover:text-[#181210]"
                        >
                          ITEM NAME
                          <ArrowDownUp className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-3">ITEM CODE</th>
                      <th className="py-3 px-3">CATEGORY</th>
                      <th className="py-3 px-3">SUPPLIER</th>
                      <th className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleSort('quantity')}
                          className="inline-flex items-center gap-1 uppercase hover:text-[#181210]"
                        >
                          AVAILABLE STOCK
                          <ArrowDownUp className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-3 text-right">MIN LEVEL</th>
                      <th className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => toggleSort('expiryDate')}
                          className="inline-flex items-center gap-1 uppercase hover:text-[#181210]"
                        >
                          EXPIRY DATE
                          <ArrowDownUp className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-3">
                        <button
                          type="button"
                          onClick={() => toggleSort('status')}
                          className="inline-flex items-center gap-1 uppercase hover:text-[#181210]"
                        >
                          STOCK STATUS
                          <ArrowDownUp className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-3 px-4 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6] text-[13px]">
                    {filteredItems.map((item) => {
                      const health = getItemHealth(item);
                      const expDays =
                        item.trackExpiry && item.expiryDate
                          ? daysUntil(item.expiryDate, TODAY_ISO)
                          : null;

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-[#FAF9F5]/80 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <p className="font-semibold text-[#181210]">{item.name}</p>
                            <p className="text-[11.5px] text-[#6B7280] mt-0.5">
                              {item.storageLocation || 'Main Store'}
                              {item.batchNumber ? ` · Batch ${item.batchNumber}` : ''}
                            </p>
                          </td>
                          <td className="py-3 px-3 font-mono text-[12px] text-[#374151] tabular-nums whitespace-nowrap">
                            {item.sku}
                          </td>
                          <td className="py-3 px-3 text-[12.5px] text-[#374151]">
                            {item.category}
                          </td>
                          <td className="py-3 px-3 text-[12.5px] text-[#374151]">
                            {item.supplierName ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const matched = suppliers.find(
                                    (s) =>
                                      s.id === item.supplierId ||
                                      s.name === item.supplierName
                                  );
                                  if (matched) {
                                    setTab('suppliers');
                                    setSelectedSupplierId(matched.id);
                                  }
                                }}
                                className="hover:text-[#C2410C] hover:underline text-left font-medium"
                              >
                                {item.supplierName}
                              </button>
                            ) : (
                              <span className="text-[#9CA3AF]">Unassigned</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                            <p className="font-bold text-[#181210]">
                              {formatStockQty(item.quantity, item.unit)}
                            </p>
                            <p className="text-[11px] text-[#6B7280]">
                              {formatINRCompact(item.unitCost)} / {item.unit}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-right text-[12.5px] text-[#6B7280] tabular-nums whitespace-nowrap">
                            {formatDecimal(item.minStockLevel, 3)} {item.unit}
                          </td>
                          <td className="py-3 px-3 text-[12.5px] tabular-nums whitespace-nowrap">
                            {item.trackExpiry && item.expiryDate ? (
                              <div>
                                <span
                                  className={
                                    expDays !== null && expDays < 0
                                      ? 'font-semibold text-[#B91C1C]'
                                      : expDays !== null && expDays <= 3
                                      ? 'font-semibold text-[#B45309]'
                                      : 'text-[#374151]'
                                  }
                                >
                                  {formatDateShort(item.expiryDate)}
                                </span>
                                {expDays !== null && expDays <= 7 && (
                                  <p className="text-[11px] text-[#6B7280]">
                                    {expDays < 0
                                      ? `${Math.abs(expDays)}d overdue`
                                      : expDays === 0
                                      ? 'Today'
                                      : `${expDays}d left`}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#9CA3AF]">Non-perishable</span>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11.5px] font-semibold ${health.badgeClass}`}
                            >
                              {health.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {canEdit ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openStockIn({ itemId: item.id })}
                                  className="h-7 px-2.5 rounded-md border border-[#BBF7D0] bg-[#DCFCE7]/50 hover:bg-[#DCFCE7] text-[#15803D] text-[11.5px] font-semibold inline-flex items-center transition-colors"
                                  title="Stock In"
                                >
                                  + In
                                </button>
                                <button
                                  type="button"
                                  disabled={item.quantity <= 0}
                                  onClick={() => openStockOut(item.id)}
                                  className="h-7 px-2.5 rounded-md border border-[#FED7AA] bg-[#FFEDD5]/50 hover:bg-[#FFEDD5] text-[#C2410C] text-[11.5px] font-semibold disabled:opacity-40 inline-flex items-center transition-colors"
                                  title="Stock Out"
                                >
                                  - Out
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditItem(item)}
                                  className="h-7 w-7 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[#4B5563] hover:text-[#181210] inline-flex items-center justify-center transition-colors"
                                  title="Edit Item"
                                  aria-label={`Edit ${item.name}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#94A3B8]">Read-only</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================
            TAB 2: EXPIRY MANAGEMENT
            ================================================================ */}
        {tab === 'expiry' && (
          <div>
            <div className="p-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: 'ALL', label: 'All Tracked Items' },
                    { id: 'EXPIRED', label: 'Expired' },
                    { id: 'URGENT_3D', label: 'Expiring <= 3 Days' },
                    { id: 'SOON_14D', label: 'Within 14 Days' },
                    { id: 'HEALTHY', label: 'Healthy (> 14 Days)' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setExpiryFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
                      expiryFilter === f.id
                        ? 'bg-[#181210] text-white border-[#181210]'
                        : 'bg-white text-[#374151] border-[#D1D5DB] hover:bg-[#FAF9F5]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="text-[12px] text-[#6B7280] tabular-nums">
                Showing {expiryItems.length} expiry-tracked items
              </p>
            </div>

            {expiryItems.length === 0 ? (
              <div className="py-14 px-6 text-center space-y-2">
                <CalendarClock className="w-8 h-8 text-[#9CA3AF] mx-auto" />
                <p className="text-[14px] font-semibold text-[#181210]">
                  No items match this expiry window
                </p>
                <p className="text-[12.5px] text-[#6B7280]">
                  Switch filters to inspect all perishable ingredients.
                </p>
              </div>
            ) : (
              <div>
                {/* Mobile Expiry Cards */}
                <div className="md:hidden divide-y divide-[#E5E7EB]">
                  {expiryItems.map((item) => {
                    const isExpired = item.dLeft < 0;
                    const isUrgent = item.dLeft >= 0 && item.dLeft <= 3;
                    return (
                      <div key={item.id} className="p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#181210]">{item.name}</p>
                            <p className="text-[11.5px] text-[#6B7280] mt-0.5">
                              <span className="font-mono">{item.sku}</span>
                              {item.batchNumber ? ` · Batch ${item.batchNumber}` : ''}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${
                              isExpired
                                ? 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]'
                                : isUrgent
                                ? 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]'
                                : 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]'
                            }`}
                          >
                            {isExpired
                              ? `Expired (${Math.abs(item.dLeft)}d ago)`
                              : item.dLeft === 0
                              ? 'Expires Today'
                              : `${item.dLeft} days left`}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] tabular-nums">
                          <span className="font-semibold text-[#181210]">
                            {formatStockQty(item.quantity, item.unit)}
                          </span>
                          <span className="text-[#6B7280]">
                            Risk: <strong className="text-[#181210]">{formatINRCompact(item.valueAtRisk)}</strong>
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[#6B7280]">
                          <span>{item.storageLocation || 'Main Store'}</span>
                          <span className="tabular-nums">Exp: {formatDateShort(item.expiryDate!)}</span>
                        </div>
                        {canEdit && (
                          <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1">
                            {item.quantity > 0 && (
                              <button
                                type="button"
                                onClick={() => openStockOut(item.id, 'Expired Disposal')}
                                className="px-2.5 py-1 rounded-md border border-[#FECACA] bg-[#FEE2E2]/60 hover:bg-[#FEE2E2] text-[#B91C1C] text-[11.5px] font-semibold"
                              >
                                Dispose / Stock Out
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openStockIn({ itemId: item.id })}
                              className="px-2.5 py-1 rounded-md border border-[#BBF7D0] bg-[#DCFCE7]/50 hover:bg-[#DCFCE7] text-[#15803D] text-[11.5px] font-semibold"
                            >
                              + Fresh Batch
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[920px]">
                    <thead>
                      <tr className="bg-[#FAF9F5] border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                        <th className="py-3 px-4">ITEM NAME &amp; SKU</th>
                        <th className="py-3 px-3">BATCH #</th>
                        <th className="py-3 px-3">STORAGE LOCATION</th>
                        <th className="py-3 px-3 text-right">AVAILABLE QTY</th>
                        <th className="py-3 px-3 text-right">VALUE AT RISK</th>
                        <th className="py-3 px-3">EXPIRY DATE</th>
                        <th className="py-3 px-3">STATUS</th>
                        <th className="py-3 px-4 text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6] text-[13px]">
                      {expiryItems.map((item) => {
                        const isExpired = item.dLeft < 0;
                        const isUrgent = item.dLeft >= 0 && item.dLeft <= 3;
                        return (
                          <tr key={item.id} className="hover:bg-[#FAF9F5]/80">
                            <td className="py-3 px-4">
                              <p className="font-semibold text-[#181210]">{item.name}</p>
                              <p className="text-[11.5px] text-[#6B7280] font-mono">{item.sku}</p>
                            </td>
                            <td className="py-3 px-3 font-mono text-[12px] text-[#374151]">
                              {item.batchNumber || '-'}
                            </td>
                            <td className="py-3 px-3 text-[12.5px] text-[#374151]">
                              {item.storageLocation || 'Main Store'}
                            </td>
                            <td className="py-3 px-3 text-right font-semibold text-[#181210] tabular-nums">
                              {formatStockQty(item.quantity, item.unit)}
                            </td>
                            <td className="py-3 px-3 text-right font-semibold text-[#181210] tabular-nums">
                              {formatINRCompact(item.valueAtRisk)}
                            </td>
                            <td className="py-3 px-3 text-[12.5px] tabular-nums">
                              {formatDateShort(item.expiryDate!)}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11.5px] font-semibold ${
                                  isExpired
                                    ? 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]'
                                    : isUrgent
                                    ? 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]'
                                    : 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]'
                                }`}
                              >
                                {isExpired
                                  ? `Expired (${Math.abs(item.dLeft)}d ago)`
                                  : item.dLeft === 0
                                  ? 'Expires Today'
                                  : `${item.dLeft} days left`}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              {canEdit ? (
                                <div className="inline-flex items-center gap-1.5">
                                  {item.quantity > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openStockOut(item.id, 'Expired Disposal')
                                      }
                                      className="px-2.5 py-1 rounded-md border border-[#FECACA] bg-[#FEE2E2]/60 hover:bg-[#FEE2E2] text-[#B91C1C] text-[11.5px] font-semibold"
                                    >
                                      Dispose / Stock Out
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openStockIn({ itemId: item.id })}
                                    className="px-2.5 py-1 rounded-md border border-[#BBF7D0] bg-[#DCFCE7]/50 hover:bg-[#DCFCE7] text-[#15803D] text-[11.5px] font-semibold"
                                  >
                                    + Fresh Batch
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-[#94A3B8]">Read-only</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================
            TAB 3: SUPPLIERS DIRECTORY & PURCHASE HISTORY
            ================================================================ */}
        {tab === 'suppliers' && (
          <div>
            <div className="p-3.5 sm:p-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-full sm:flex-1 sm:min-w-[240px] sm:max-w-sm">
                <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={supplierSearch}
                  onChange={(e) => setSupplierSearch(e.target.value)}
                  placeholder="Search supplier, contact person, phone, email..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#D1D5DB] text-[12.5px] focus:outline-none focus:border-[#FB923C]"
                />
              </div>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingSupplier(null);
                    setSupplierModalOpen(true);
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-[#181210] hover:bg-[#2E2623] text-white text-[12.5px] font-semibold flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5 text-[#FB923C]" />
                  Add Supplier
                </button>
              )}
            </div>

            {supplierRows.length === 0 ? (
              <div className="py-14 px-6 text-center space-y-3">
                <Building2 className="w-8 h-8 text-[#9CA3AF] mx-auto" />
                <p className="text-[14px] font-semibold text-[#181210]">
                  No suppliers found
                </p>
                <p className="text-[12.5px] text-[#6B7280]">
                  Add your ingredient and packaging vendors to track receiving history.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingSupplier(null);
                    setSupplierModalOpen(true);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-[#FB923C] text-white text-[12.5px] font-semibold hover:bg-[#EA580C]"
                >
                  Add First Supplier
                </button>
              </div>
            ) : (
              <div>
                {/* Mobile Supplier Cards */}
                <div className="md:hidden divide-y divide-[#E5E7EB]">
                  {supplierRows.map(
                    ({
                      supplier,
                      linkedItemsCount,
                      deliveriesCount,
                      totalSpend,
                      lastDelivery,
                      pendingForSup,
                    }) => (
                      <div
                        key={supplier.id}
                        onClick={() => setSelectedSupplierId(supplier.id)}
                        className="p-3.5 space-y-2.5 hover:bg-[#FAF9F5] cursor-pointer transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-semibold text-[#181210]">
                              {supplier.name}
                            </p>
                            <p className="text-[11.5px] text-[#6B7280] mt-0.5">
                              {supplier.contactPerson} · <span className="tabular-nums">{supplier.phone}</span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[13px] font-bold text-[#181210] tabular-nums">
                              {formatINRCompact(totalSpend)}
                            </p>
                            {pendingForSup > 0 && (
                              <span className="text-[10.5px] font-semibold text-[#C2410C]">
                                {pendingForSup} pending
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[#6B7280] tabular-nums">
                          <span>{linkedItemsCount} items · {deliveriesCount} deliveries</span>
                          <span>
                            {lastDelivery ? `Last: ${formatDateShort(lastDelivery)}` : 'No deliveries'}
                          </span>
                        </div>
                        <div
                          className="flex flex-wrap items-center justify-end gap-1.5 pt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedSupplierId(supplier.id)}
                            className="px-2.5 py-1 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[11.5px] font-semibold text-[#181210]"
                          >
                            History
                          </button>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => openStockIn({ supplierId: supplier.id })}
                                className="px-2.5 py-1 rounded-md border border-[#BBF7D0] bg-[#DCFCE7]/50 hover:bg-[#DCFCE7] text-[#15803D] text-[11.5px] font-semibold"
                              >
                                + Stock In
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSupplier(supplier);
                                  setSupplierModalOpen(true);
                                }}
                                className="p-1.5 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[#4B5563]"
                                title="Edit Supplier"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[960px]">
                  <thead>
                    <tr className="bg-[#FAF9F5] border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                      <th className="py-3 px-4">SUPPLIER NAME</th>
                      <th className="py-3 px-3">CONTACT PERSON</th>
                      <th className="py-3 px-3">PHONE &amp; EMAIL</th>
                      <th className="py-3 px-3 text-right">LINKED ITEMS</th>
                      <th className="py-3 px-3 text-right">DELIVERIES</th>
                      <th className="py-3 px-3 text-right">TOTAL SPEND</th>
                      <th className="py-3 px-3">LAST DELIVERY</th>
                      <th className="py-3 px-4 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6] text-[13px]">
                    {supplierRows.map(
                      ({
                        supplier,
                        linkedItemsCount,
                        deliveriesCount,
                        totalSpend,
                        lastDelivery,
                        pendingForSup,
                      }) => (
                        <tr
                          key={supplier.id}
                          onClick={() => setSelectedSupplierId(supplier.id)}
                          className="hover:bg-[#FAF9F5] cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4">
                            <p className="font-semibold text-[#181210]">
                              {supplier.name}
                            </p>
                            {supplier.address && (
                              <p className="text-[11.5px] text-[#6B7280] truncate max-w-[260px]">
                                {supplier.address}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-3 text-[12.5px] font-medium text-[#374151]">
                            {supplier.contactPerson}
                          </td>
                          <td className="py-3 px-3 text-[12.5px] text-[#374151]">
                            <p className="tabular-nums">{supplier.phone}</p>
                            {supplier.email && (
                              <p className="text-[11.5px] text-[#6B7280]">
                                {supplier.email}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-[#181210] tabular-nums">
                            {linkedItemsCount}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums">
                            <span className="font-semibold text-[#181210]">
                              {deliveriesCount}
                            </span>
                            {pendingForSup > 0 && (
                              <p className="text-[11px] font-semibold text-[#C2410C]">
                                {pendingForSup} pending
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-[#181210] tabular-nums">
                            {formatINRCompact(totalSpend)}
                          </td>
                          <td className="py-3 px-3 text-[12px] text-[#6B7280] tabular-nums">
                            {lastDelivery ? formatDateShort(lastDelivery) : 'No deliveries yet'}
                          </td>
                          <td
                            className="py-3 px-4 text-right whitespace-nowrap"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedSupplierId(supplier.id)}
                                className="px-2.5 py-1 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[11.5px] font-semibold text-[#181210]"
                              >
                                History
                              </button>
                              {canEdit && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openStockIn({ supplierId: supplier.id })}
                                    className="px-2.5 py-1 rounded-md border border-[#BBF7D0] bg-[#DCFCE7]/50 hover:bg-[#DCFCE7] text-[#15803D] text-[11.5px] font-semibold"
                                  >
                                    + Stock In
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSupplier(supplier);
                                      setSupplierModalOpen(true);
                                    }}
                                    className="p-1.5 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[#4B5563]"
                                    title="Edit Supplier"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================
            TAB 4: PENDING STOCK MOVEMENTS
            ================================================================ */}
        {tab === 'pending' && (
          <div className="p-3.5 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-bold text-[#181210]">
                  Pending Stock Receipts & Expected Deliveries
                </h2>
                <p className="text-[12px] text-[#6B7280]">
                  Verify incoming shipments against purchase orders before adding to live store-room stock.
                </p>
              </div>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => openStockIn()}
                  className="px-3.5 py-1.5 rounded-lg bg-[#181210] text-white text-[12.5px] font-semibold hover:bg-[#2E2623] flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-[#FB923C]" />
                  Create Receipt / PO
                </button>
              )}
            </div>

            {branchPending.length === 0 ? (
              <div className="py-12 px-6 text-center border border-dashed border-[#E5E7EB] rounded-xl space-y-2.5">
                <CheckCircle2 className="w-8 h-8 text-[#15803D] mx-auto" />
                <p className="text-[14px] font-semibold text-[#181210]">
                  All pending stock movements received
                </p>
                <p className="text-[12.5px] text-[#6B7280]">
                  Use Stock In and select "Save as Pending" when scheduling upcoming supplier deliveries.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {branchPending.map((receipt) => {
                  const totalEst = receipt.lines.reduce(
                    (s, l) => s + l.quantity * l.unitCost,
                    0
                  );
                  const isConfirming = confirmingPendingId === receipt.id;

                  return (
                    <div
                      key={receipt.id}
                      className="border border-[#E5E7EB] rounded-xl p-3.5 sm:p-4 bg-[#FAF9F5]/40 space-y-3"
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[13px] font-bold text-[#181210]">
                              {receipt.referenceNumber}
                            </span>
                            <span className="text-[#D1D5DB]">·</span>
                            <span className="text-[13.5px] font-bold text-[#181210]">
                              {receipt.supplierName}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FEF3C7] border border-[#FDE68A] text-[#B45309] text-[11px] font-semibold">
                              Pending Delivery
                            </span>
                          </div>
                          <p className="text-[12px] text-[#6B7280] tabular-nums">
                            Expected {formatDateShort(receipt.expectedDate)} ·{' '}
                            {receipt.storageLocation || 'Main Store'} · Created by{' '}
                            {receipt.createdBy}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-left sm:text-right mr-2">
                            <p className="text-[11px] uppercase font-bold text-[#6B7280]">
                              Estimated Value
                            </p>
                            <p className="text-[15px] font-bold text-[#181210] tabular-nums">
                              {formatINRCompact(totalEst)}
                            </p>
                          </div>

                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => openStockIn({ pending: receipt })}
                                className="px-3 py-1.5 rounded-lg border border-[#D1D5DB] bg-white hover:bg-[#FAF9F5] text-[12px] font-semibold text-[#181210]"
                              >
                                Verify & Edit
                              </button>

                              {isConfirming ? (
                                <div className="inline-flex items-center gap-1.5 bg-[#DCFCE7] border border-[#BBF7D0] rounded-lg px-2 py-1">
                                  <span className="text-[11.5px] font-semibold text-[#15803D]">
                                    Confirm receipt?
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      confirmPendingReceipt(receipt.id);
                                      setConfirmingPendingId(null);
                                    }}
                                    className="px-2 py-0.5 rounded bg-[#15803D] text-white text-[11px] font-semibold"
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmingPendingId(null)}
                                    className="px-1.5 py-0.5 text-[11px] font-semibold text-[#374151]"
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmingPendingId(receipt.id)}
                                  className="px-3 py-1.5 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-[12px] font-semibold flex items-center gap-1"
                                >
                                  <PackageCheck className="w-3.5 h-3.5" />
                                  Receive All
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => cancelPendingReceipt(receipt.id)}
                                className="p-1.5 rounded-lg border border-[#E5E7EB] bg-white text-[#9CA3AF] hover:text-[#B91C1C]"
                                title="Cancel Pending Movement"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="border border-[#E5E7EB] rounded-lg bg-white overflow-hidden">
                        {/* Mobile Pending Line Cards */}
                        <div className="md:hidden divide-y divide-[#F3F4F6] text-[12px]">
                          {receipt.lines.map((line, i) => (
                            <div key={`${receipt.id}-${line.itemId}-${i}`} className="p-3 space-y-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-semibold text-[#181210]">{line.itemName}</span>
                                <span className="font-bold text-[#181210] tabular-nums shrink-0">
                                  {formatINRCompact(line.quantity * line.unitCost)}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[#6B7280] tabular-nums">
                                <span>
                                  {formatStockQty(line.quantity, line.unit)} @ {formatINRCompact(line.unitCost)}
                                </span>
                                <span>
                                  {line.batchNumber ? `Batch ${line.batchNumber}` : ''}
                                  {line.expiryDate ? ` · Exp ${formatDateShort(line.expiryDate)}` : ''}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-left border-collapse text-[12px] min-w-[600px]">
                            <thead>
                              <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[#6B7280] text-[11px] font-bold uppercase">
                                <th className="py-2 px-3">ITEM</th>
                                <th className="py-2 px-3 text-right">EXPECTED QTY</th>
                                <th className="py-2 px-3 text-right">UNIT COST</th>
                                <th className="py-2 px-3 text-right">LINE VALUE</th>
                                <th className="py-2 px-3">BATCH / EXPIRY</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F3F4F6]">
                              {receipt.lines.map((line, i) => (
                                <tr key={`${receipt.id}-${line.itemId}-${i}`}>
                                  <td className="py-2 px-3 font-medium text-[#181210]">
                                    {line.itemName}
                                  </td>
                                  <td className="py-2 px-3 text-right font-semibold tabular-nums">
                                    {formatStockQty(line.quantity, line.unit)}
                                  </td>
                                  <td className="py-2 px-3 text-right text-[#6B7280] tabular-nums">
                                    {formatINRCompact(line.unitCost)}
                                  </td>
                                  <td className="py-2 px-3 text-right font-semibold tabular-nums">
                                    {formatINRCompact(line.quantity * line.unitCost)}
                                  </td>
                                  <td className="py-2 px-3 text-[#6B7280] tabular-nums">
                                    {line.batchNumber ? `Batch ${line.batchNumber}` : '-'}
                                    {line.expiryDate ? ` · Exp ${formatDateShort(line.expiryDate)}` : ''}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {receipt.notes && (
                        <p className="text-[12px] text-[#4B5563]">
                          <span className="font-semibold">Notes:</span> {receipt.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================================================================
            TAB 5: INVENTORY TRANSACTION HISTORY
            ================================================================ */}
        {tab === 'history' && (
          <div>
            <div className="p-3.5 sm:p-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0 w-full sm:w-auto">
                <div className="relative w-full sm:min-w-[200px] sm:flex-1 sm:max-w-xs">
                  <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={txnSearch}
                    onChange={(e) => setTxnSearch(e.target.value)}
                    placeholder="Search item, supplier, ref #, reason..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#D1D5DB] text-[12.5px] focus:outline-none focus:border-[#FB923C]"
                  />
                </div>

                <select
                  value={txnTypeFilter}
                  onChange={(e) =>
                    setTxnTypeFilter(
                      e.target.value as 'ALL' | 'Stock In' | 'Stock Out' | 'Adjustment'
                    )
                  }
                  className="w-full sm:w-auto px-3 py-1.5 rounded-lg border border-[#D1D5DB] text-[12.5px] bg-white focus:outline-none focus:border-[#FB923C]"
                >
                  <option value="ALL">All Types</option>
                  <option value="Stock In">Stock In</option>
                  <option value="Stock Out">Stock Out</option>
                  <option value="Adjustment">Adjustment</option>
                </select>

                <select
                  value={txnItemFilter}
                  onChange={(e) => setTxnItemFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-lg border border-[#D1D5DB] text-[12.5px] bg-white sm:max-w-[180px] focus:outline-none focus:border-[#FB923C]"
                >
                  <option value="ALL">All Items</option>
                  {branchItems.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>

                <select
                  value={txnSupplierFilter}
                  onChange={(e) => setTxnSupplierFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-lg border border-[#D1D5DB] text-[12.5px] bg-white sm:max-w-[180px] focus:outline-none focus:border-[#FB923C]"
                >
                  <option value="ALL">All Suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                  <input
                    type="date"
                    value={txnFromDate}
                    onChange={(e) => setTxnFromDate(e.target.value)}
                    aria-label="From Date"
                    className="flex-1 sm:flex-initial min-w-[125px] px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] text-[12px] tabular-nums focus:outline-none focus:border-[#FB923C]"
                  />
                  <span className="text-[11.5px] text-[#6B7280]">to</span>
                  <input
                    type="date"
                    value={txnToDate}
                    onChange={(e) => setTxnToDate(e.target.value)}
                    aria-label="To Date"
                    className="flex-1 sm:flex-initial min-w-[125px] px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] text-[12px] tabular-nums focus:outline-none focus:border-[#FB923C]"
                  />
                </div>

                {(txnSearch ||
                  txnTypeFilter !== 'ALL' ||
                  txnItemFilter !== 'ALL' ||
                  txnSupplierFilter !== 'ALL' ||
                  txnFromDate ||
                  txnToDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setTxnSearch('');
                      setTxnTypeFilter('ALL');
                      setTxnItemFilter('ALL');
                      setTxnSupplierFilter('ALL');
                      setTxnFromDate('');
                      setTxnToDate('');
                    }}
                    className="px-2.5 py-1.5 text-[12px] font-semibold text-[#C2410C] hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleExportHistoryCsv}
                className="px-3 py-1.5 rounded-lg border border-[#D1D5DB] bg-white hover:bg-[#FAF9F5] text-[12.5px] font-semibold text-[#181210] flex items-center gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>

            {filteredTxns.length === 0 ? (
              <div className="py-14 px-6 text-center space-y-2">
                <p className="text-[14px] font-semibold text-[#181210]">
                  No inventory transactions match these filters
                </p>
                <p className="text-[12.5px] text-[#6B7280]">
                  Clear date or type filters to inspect full store-room movement audit logs.
                </p>
              </div>
            ) : (
              <div>
                {/* Mobile Transaction History Cards */}
                <div className="md:hidden divide-y divide-[#E5E7EB]">
                  {filteredTxns.map((tx) => {
                    const isPositive = tx.quantityDelta > 0;
                    const typeBadge =
                      tx.type === 'Stock In'
                        ? 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]'
                        : tx.type === 'Stock Out'
                        ? 'bg-[#FFEDD5] text-[#C2410C] border-[#FED7AA]'
                        : 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]';
                    return (
                      <div key={tx.id} className="p-3.5 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#181210]">
                              {tx.itemName}
                            </p>
                            <p className="text-[11px] text-[#6B7280] tabular-nums mt-0.5">
                              {formatDateTime(tx.timestamp)}
                              {tx.batchNumber ? ` · Batch ${tx.batchNumber}` : ''}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${typeBadge}`}
                          >
                            {tx.type}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] tabular-nums">
                          <span className={`font-bold ${isPositive ? 'text-[#15803D]' : 'text-[#B91C1C]'}`}>
                            {isPositive
                              ? `+${formatDecimal(tx.quantityDelta, 3)}`
                              : `-${formatDecimal(Math.abs(tx.quantityDelta), 3)}`}{' '}
                            {tx.unit}
                          </span>
                          <span className="text-[#6B7280]">
                            {formatDecimal(tx.previousQty, 3)} → {formatDecimal(tx.updatedQty, 3)} {tx.unit}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[#6B7280]">
                          <span>
                            {tx.supplierName ? `${tx.supplierName} · ` : ''}
                            {tx.reason}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {tx.purchaseCost !== undefined && tx.purchaseCost > 0 && (
                              <span className="font-semibold text-[#15803D] tabular-nums">
                                {formatINRCompact(tx.purchaseCost)}
                              </span>
                            )}
                            {tx.attachmentName && (
                              <button
                                type="button"
                                onClick={() =>
                                  setAttachmentPreview({
                                    name: tx.attachmentName!,
                                    dataUrl: tx.attachmentDataUrl,
                                    ref: tx.referenceNumber,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#D1D5DB] bg-white hover:border-[#FB923C] text-[11px] text-[#181210]"
                                title={`View ${tx.attachmentName}`}
                              >
                                <Eye className="w-3 h-3 text-[#FB923C]" />
                                <FileText className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-[#6B7280]">
                          {tx.referenceNumber ? `Ref ${tx.referenceNumber} · ` : ''}By {tx.performedBy}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1040px]">
                    <thead>
                      <tr className="bg-[#FAF9F5] border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                        <th className="py-3 px-4">DATE &amp; TIME</th>
                        <th className="py-3 px-3">ITEM NAME</th>
                        <th className="py-3 px-3">TYPE</th>
                        <th className="py-3 px-3 text-right">QUANTITY</th>
                        <th className="py-3 px-3">SUPPLIER</th>
                        <th className="py-3 px-3">REFERENCE #</th>
                        <th className="py-3 px-3">REASON &amp; NOTES</th>
                        <th className="py-3 px-4">UPDATED BY</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6] text-[12.5px]">
                      {filteredTxns.map((tx) => {
                        const isPositive = tx.quantityDelta > 0;
                        const typeBadge =
                          tx.type === 'Stock In'
                            ? 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]'
                            : tx.type === 'Stock Out'
                            ? 'bg-[#FFEDD5] text-[#C2410C] border-[#FED7AA]'
                            : 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]';

                        return (
                          <tr key={tx.id} className="hover:bg-[#FAF9F5]/80">
                            <td className="py-3 px-4 text-[#6B7280] tabular-nums whitespace-nowrap">
                              {formatDateTime(tx.timestamp)}
                            </td>
                            <td className="py-3 px-3">
                              <p className="font-semibold text-[#181210]">{tx.itemName}</p>
                              {tx.batchNumber && (
                                <p className="text-[11px] text-[#6B7280] font-mono">
                                  Batch {tx.batchNumber}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${typeBadge}`}
                              >
                                {tx.type}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                              <p
                                className={`font-bold ${
                                  isPositive ? 'text-[#15803D]' : 'text-[#B91C1C]'
                                }`}
                              >
                                {isPositive
                                  ? `+${formatDecimal(tx.quantityDelta, 3)}`
                                  : `-${formatDecimal(Math.abs(tx.quantityDelta), 3)}`}{' '}
                                {tx.unit}
                              </p>
                              <p className="text-[11px] text-[#6B7280]">
                                {formatDecimal(tx.previousQty, 3)} → {formatDecimal(tx.updatedQty, 3)}{' '}
                                {tx.unit}
                              </p>
                            </td>
                            <td className="py-3 px-3 text-[#374151]">
                              <p>{tx.supplierName || '-'}</p>
                              {tx.purchaseCost !== undefined && tx.purchaseCost > 0 && (
                                <p className="text-[11px] font-semibold text-[#15803D] tabular-nums">
                                  {formatINRCompact(tx.purchaseCost)}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[12px] text-[#374151]">
                                  {tx.referenceNumber || '-'}
                                </span>
                                {tx.attachmentName && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAttachmentPreview({
                                        name: tx.attachmentName!,
                                        dataUrl: tx.attachmentDataUrl,
                                        ref: tx.referenceNumber,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#D1D5DB] bg-white hover:border-[#FB923C] text-[11px] text-[#181210]"
                                    title={`View ${tx.attachmentName}`}
                                  >
                                    <Eye className="w-3 h-3 text-[#FB923C]" />
                                    <FileText className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 max-w-[260px]">
                              <p className="text-[#181210] font-medium">{tx.reason}</p>
                              {tx.notes && (
                                <p className="text-[11.5px] text-[#6B7280] mt-0.5">
                                  {tx.notes}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-4 text-[#374151] whitespace-nowrap">
                              {tx.performedBy}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ====================================================================
          SUPPLIER DETAIL SIDE DRAWER
          ==================================================================== */}
      {activeSupplierDetail && (
        <div
          className="fixed inset-0 z-40 bg-black/40 flex justify-end"
          onClick={() => setSelectedSupplierId(null)}
        >
          <div
            className="w-full max-w-xl bg-white h-full border-l border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 sm:px-6 py-4 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#C2410C]">
                  Supplier Profile & Ledger
                </p>
                <h2 className="text-[17px] font-bold text-[#181210] mt-0.5 truncate">
                  {activeSupplierDetail.supplier.name}
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setEditingSupplier(activeSupplierDetail.supplier);
                    setSupplierModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#D1D5DB] bg-white hover:bg-[#FAF9F5] text-[12px] font-semibold text-[#181210]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSupplierId(null)}
                  className="p-1.5 rounded-lg text-[#6B7280] hover:bg-white hover:text-[#181210]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
              {/* Contact Summary */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-[#FAF9F5] border border-[#E5E7EB] space-y-2.5 text-[12.5px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#181210]">
                    <User className="w-3.5 h-3.5 text-[#6B7280]" />
                    {activeSupplierDetail.supplier.contactPerson}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#181210] tabular-nums">
                    <Phone className="w-3.5 h-3.5 text-[#6B7280]" />
                    {activeSupplierDetail.supplier.phone}
                  </span>
                </div>
                {activeSupplierDetail.supplier.email && (
                  <p className="inline-flex items-center gap-1.5 text-[#374151] break-all">
                    <Mail className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                    {activeSupplierDetail.supplier.email}
                  </p>
                )}
                {activeSupplierDetail.supplier.address && (
                  <p className="flex items-start gap-1.5 text-[#4B5563]">
                    <MapPin className="w-3.5 h-3.5 text-[#6B7280] shrink-0 mt-0.5" />
                    <span>{activeSupplierDetail.supplier.address}</span>
                  </p>
                )}
                {activeSupplierDetail.supplier.notes && (
                  <p className="text-[12px] text-[#4B5563] pt-2 border-t border-[#E5E7EB]">
                    <span className="font-semibold text-[#181210]">Terms & Notes: </span>
                    {activeSupplierDetail.supplier.notes}
                  </p>
                )}
              </div>

              {/* Spend & Action Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border border-[#E5E7EB]">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                    Recorded Purchase Spend
                  </p>
                  <p className="text-[20px] font-bold text-[#181210] tabular-nums mt-0.5">
                    {formatINRCompact(activeSupplierDetail.totalSpend)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    openStockIn({ supplierId: activeSupplierDetail.supplier.id })
                  }
                  className="px-3.5 py-2 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-[12.5px] font-semibold flex items-center gap-1.5"
                >
                  <PackagePlus className="w-4 h-4" />
                  New Stock In
                </button>
              </div>

              {/* Associated Inventory Items */}
              <div className="space-y-2.5">
                <h3 className="text-[13px] font-bold text-[#181210]">
                  Supplied Inventory Items ({activeSupplierDetail.items.length})
                </h3>
                {activeSupplierDetail.items.length === 0 ? (
                  <p className="text-[12.5px] text-[#6B7280] py-3">
                    No inventory items are currently linked to this supplier.
                  </p>
                ) : (
                  <div className="border border-[#E5E7EB] rounded-xl divide-y divide-[#F3F4F6]">
                    {activeSupplierDetail.items.map((item) => {
                      const health = getItemHealth(item);
                      return (
                        <div
                          key={item.id}
                          className="p-3 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#181210]">
                              {item.name}
                            </p>
                            <p className="text-[11.5px] text-[#6B7280] tabular-nums">
                              {item.sku} · {formatINRCompact(item.unitCost)}/{item.unit}
                            </p>
                          </div>
                          <div className="text-right flex items-center gap-2.5 shrink-0">
                            <div>
                              <p className="text-[12.5px] font-bold text-[#181210] tabular-nums">
                                {formatStockQty(item.quantity, item.unit)}
                              </p>
                              <span
                                className={`inline-flex px-1.5 py-0.5 rounded border text-[10.5px] font-semibold ${health.badgeClass}`}
                              >
                                {health.label}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Receiving History */}
              <div className="space-y-2.5">
                <h3 className="text-[13px] font-bold text-[#181210]">
                  Stock Receiving History ({activeSupplierDetail.txns.length})
                </h3>
                {activeSupplierDetail.txns.length === 0 ? (
                  <p className="text-[12.5px] text-[#6B7280] py-3">
                    No deliveries recorded for this supplier yet.
                  </p>
                ) : (
                  <div className="border border-[#E5E7EB] rounded-xl divide-y divide-[#F3F4F6]">
                    {activeSupplierDetail.txns.map((tx) => (
                      <div key={tx.id} className="p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12.5px] font-semibold text-[#181210]">
                            {tx.itemName}
                          </span>
                          <span className="text-[12.5px] font-bold text-[#15803D] tabular-nums">
                            +{formatDecimal(tx.quantityDelta, 3)} {tx.unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11.5px] text-[#6B7280] tabular-nums">
                          <span>
                            {formatDateTime(tx.timestamp)}
                            {tx.referenceNumber ? ` · Ref ${tx.referenceNumber}` : ''}
                          </span>
                          {tx.purchaseCost !== undefined && (
                            <span className="font-semibold text-[#181210]">
                              {formatINRCompact(tx.purchaseCost)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          WORKFLOW MODALS
          ==================================================================== */}
      <ItemFormModal
        open={itemModalOpen}
        editingItem={editingItem}
        onClose={() => setItemModalOpen(false)}
      />

      <BatchStockInModal
        open={stockInOpen}
        preselectedItemId={stockInItemId}
        preselectedSupplierId={stockInSupplierId}
        pendingReceipt={stockInPending}
        onClose={() => {
          setStockInOpen(false);
          setStockInPending(null);
        }}
      />

      <StockOutModal
        open={stockOutOpen}
        preselectedItemId={stockOutItemId}
        preselectedReason={stockOutReason}
        onClose={() => setStockOutOpen(false)}
      />

      <SupplierFormModal
        open={supplierModalOpen}
        editingSupplier={editingSupplier}
        onClose={() => setSupplierModalOpen(false)}
      />

      <AttachmentPreviewModal
        attachment={attachmentPreview}
        onClose={() => setAttachmentPreview(null)}
      />
    </div>
  );
};
