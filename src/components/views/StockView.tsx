import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Download,
  History,
  PackageMinus,
  PackagePlus,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { usePos } from '../../context/PosContext';
import { ProductThumb } from '../common/ProductThumb';
import {
  VariantStockModalMode,
  VariantStockUpdateModal,
} from '../stock/StockModals';
import { Product, ProductVariant, WastageLog } from '../../types/pos';
import {
  daysUntil,
  exportToCsv,
  formatDateShort,
  formatDateTime,
  formatDecimal,
  formatINRCompact,
  formatStockQty,
  roundQty,
  TODAY_ISO,
} from '../../utils/formatters';

type StockTab = 'all' | 'low' | 'oos' | 'expiring' | 'movement' | 'wastage';
type StatusFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRING';

interface VariantTableRow {
  product: Product;
  variant: ProductVariant;
  categoryName: string;
  unitLabel: string;
  available: number;
  minStock: number;
  earliestExpiry: string | null;
  daysLeft: number;
  lastUpdated: string | null;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  isExpiring: boolean;
  isFirstOfProduct: boolean;
  isLastOfProduct: boolean;
  visibleVariantCount: number;
}

export const StockView: React.FC = () => {
  const {
    products,
    categories,
    batches,
    stockMovements,
    wastageLogs,
    getVariantStock,
    getVariantUnitLabel,
    getVariantMinStock,
    getVariantEarliestExpiry,
    getVariantLastUpdated,
    getProductStock,
    adjustBatchQuantity,
    logWastage,
    expiringSoonBatches,
    globalSearch,
    activeBranchId,
    activeBranch,
    hasPermission,
  } = usePos();

  const isBranchActive = activeBranch.status === 'Active';
  const canCreate = hasPermission('stock', 'create') && isBranchActive;
  const canEdit = hasPermission('stock', 'edit') && isBranchActive;

  const [tab, setTab] = useState<StockTab>('all');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Right-Side Drawer
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // Unified Variant Stock Update Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<VariantStockModalMode>('stock_in');
  const [modalProductId, setModalProductId] = useState<string | undefined>(undefined);
  const [modalVariantId, setModalVariantId] = useState<string | undefined>(undefined);

  // Log Wastage Modal
  const [wastageBatchId, setWastageBatchId] = useState<string | null>(null);
  const [wastageQty, setWastageQty] = useState('1');
  const [wastageReason, setWastageReason] = useState<WastageLog['reason']>('Expired');

  const branchBatches = useMemo(
    () => batches.filter((b) => (b.branchId ?? 'br-1') === activeBranchId),
    [batches, activeBranchId]
  );
  const branchMovements = useMemo(
    () => stockMovements.filter((m) => (m.branchId ?? 'br-1') === activeBranchId),
    [stockMovements, activeBranchId]
  );
  const branchWastage = useMemo(
    () => wastageLogs.filter((w) => (w.branchId ?? 'br-1') === activeBranchId),
    [wastageLogs, activeBranchId]
  );

  // Compute all variant records across all menu products (single source of truth)
  const allVariantRecords = useMemo(() => {
    return products.flatMap((product) => {
      const categoryName =
        categories.find((c) => c.id === product.categoryId)?.name ?? '—';
      return product.variants.map((variant) => {
        const available = getVariantStock(product.id, variant.id);
        const minStock = getVariantMinStock(product, variant);
        const unitLabel = getVariantUnitLabel(product, variant);
        const earliestExpiry = getVariantEarliestExpiry(product.id, variant.id);
        const daysLeft = earliestExpiry ? daysUntil(earliestExpiry, TODAY_ISO) : 999;
        const lastUpdated = getVariantLastUpdated(product.id, variant.id);
        const status: VariantTableRow['status'] =
          available <= 0
            ? 'OUT_OF_STOCK'
            : available <= minStock
            ? 'LOW_STOCK'
            : 'IN_STOCK';
        const isExpiring = Boolean(
          product.trackExpiry && available > 0 && earliestExpiry && daysLeft <= 1
        );
        return {
          product,
          variant,
          categoryName,
          unitLabel,
          available,
          minStock,
          earliestExpiry,
          daysLeft,
          lastUpdated,
          status,
          isExpiring,
        };
      });
    });
  }, [
    products,
    categories,
    getVariantStock,
    getVariantMinStock,
    getVariantUnitLabel,
    getVariantEarliestExpiry,
    getVariantLastUpdated,
  ]);

  // KPI Counters
  const kpi = useMemo(() => {
    const totalProducts = products.length;
    const totalVariants = allVariantRecords.length;
    const lowStockVariants = allVariantRecords.filter(
      (r) => r.status === 'LOW_STOCK' || r.status === 'OUT_OF_STOCK'
    ).length;
    const outOfStockVariants = allVariantRecords.filter(
      (r) => r.status === 'OUT_OF_STOCK'
    ).length;
    const wastageTotalValue = branchWastage.reduce((s, w) => s + w.estimatedValue, 0);
    return {
      totalProducts,
      totalVariants,
      lowStockVariants,
      outOfStockVariants,
      wastageTotalValue,
    };
  }, [products.length, allVariantRecords, branchWastage]);

  // Filtered Variant Rows grouped sequentially under each Parent Product
  const groupedVariantRows: VariantTableRow[] = useMemo(() => {
    const q = (search || globalSearch).trim().toLowerCase();

    const filtered = allVariantRecords.filter((rec) => {
      if (catFilter !== 'ALL' && rec.product.categoryId !== catFilter) return false;

      if (tab === 'low') {
        if (rec.status !== 'LOW_STOCK' && rec.status !== 'OUT_OF_STOCK') return false;
      } else if (tab === 'oos') {
        if (rec.status !== 'OUT_OF_STOCK') return false;
      } else if (tab === 'expiring') {
        if (!rec.isExpiring) return false;
      } else if (statusFilter !== 'ALL') {
        if (statusFilter === 'EXPIRING') {
          if (!rec.isExpiring) return false;
        } else if (rec.status !== statusFilter) {
          return false;
        }
      }

      if (q) {
        const hay = `${rec.product.name} ${rec.product.sku} ${rec.variant.label} ${rec.categoryName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    // Preserve product grouping order and mark first/last variant per product
    const countsByProduct = new Map<string, number>();
    filtered.forEach((r) => {
      countsByProduct.set(r.product.id, (countsByProduct.get(r.product.id) ?? 0) + 1);
    });

    const seenByProduct = new Map<string, number>();
    return filtered.map((r) => {
      const idx = seenByProduct.get(r.product.id) ?? 0;
      seenByProduct.set(r.product.id, idx + 1);
      const totalVisible = countsByProduct.get(r.product.id) ?? 1;
      return {
        ...r,
        isFirstOfProduct: idx === 0,
        isLastOfProduct: idx === totalVisible - 1,
        visibleVariantCount: totalVisible,
      };
    });
  }, [allVariantRecords, search, globalSearch, catFilter, tab, statusFilter]);

  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? null;
  const selectedProductBatches = branchBatches
    .filter((b) => b.productId === selectedProductId)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  const openStockModal = (
    mode: VariantStockModalMode,
    prodId?: string,
    variantId?: string
  ) => {
    setModalMode(mode);
    setModalProductId(prodId ?? selectedProductId ?? products[0]?.id);
    setModalVariantId(variantId);
    setModalOpen(true);
  };

  const handleExportStock = () => {
    if (tab === 'movement') {
      exportToCsv(
        'bakecore_counter_stock_movement.csv',
        [
          'Date',
          'Product',
          'Variant',
          'Reference / Batch',
          'Type',
          'Delta',
          'Prev Qty',
          'New Qty',
          'Reason',
          'Staff',
        ],
        branchMovements.map((m) => [
          formatDateTime(m.timestamp),
          m.productName,
          m.variantLabel ?? '-',
          m.referenceNumber ? `${m.referenceNumber} (${m.batchCode})` : m.batchCode,
          m.type,
          `${m.delta >= 0 ? `+${formatDecimal(m.delta, 3)}` : `-${formatDecimal(Math.abs(m.delta), 3)}`} ${m.unitLabel}`,
          formatStockQty(m.previousQty, m.unitLabel),
          formatStockQty(m.newQty, m.unitLabel),
          m.reason,
          m.performedBy,
        ])
      );
    } else {
      exportToCsv(
        'bakecore_variant_stock_report.csv',
        [
          'Product Code',
          'Product Name',
          'Category',
          'Variant / Size',
          'Unit',
          'Available Stock',
          'Minimum Stock',
          'Status',
          'Last Updated',
        ],
        groupedVariantRows.map((r) => [
          r.product.sku,
          r.product.name,
          r.categoryName,
          r.variant.label,
          r.unitLabel,
          roundQty(r.available),
          roundQty(r.minStock),
          r.status === 'OUT_OF_STOCK'
            ? 'Out of Stock'
            : r.status === 'LOW_STOCK'
            ? 'Low Stock'
            : 'In Stock',
          r.lastUpdated ? formatDateTime(r.lastUpdated) : '—',
        ])
      );
    }
  };

  return (
    <div className="w-full p-3.5 sm:p-4 space-y-4 min-h-[calc(100vh-61px)]">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => {
            setTab('all');
            setStatusFilter('ALL');
          }}
          className={`text-left bg-white rounded-xl border p-4 transition-colors duration-150 hover:border-[#181210] ${
            tab === 'all' && statusFilter === 'ALL' ? 'border-[#181210]' : 'border-[#E5E7EB]'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
            Menu SKUs &amp; Variants
          </p>
          <p className="text-[22px] font-bold text-[#181210] tabular-nums mt-1.5">
            {kpi.totalProducts} Items
          </p>
          <p className="text-[11.5px] text-[#6B7280] mt-1 tabular-nums">
            {kpi.totalVariants} tracked variants
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('low');
            setStatusFilter('ALL');
          }}
          className={`text-left bg-white rounded-xl border p-4 transition-colors duration-150 hover:border-[#FB923C] ${
            tab === 'low' ? 'border-[#C2410C]' : 'border-[#E5E7EB]'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
            Low Stock Variants
          </p>
          <p className="text-[22px] font-bold text-[#C2410C] tabular-nums mt-1.5">
            {kpi.lowStockVariants} Variants
          </p>
          <p className="text-[11.5px] text-[#6B7280] mt-1">At or below minimum level</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setTab('oos');
            setStatusFilter('ALL');
          }}
          className={`text-left bg-white rounded-xl border p-4 transition-colors duration-150 hover:border-[#EF4444] ${
            tab === 'oos' ? 'border-[#B91C1C]' : 'border-[#E5E7EB]'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
            Out of Stock
          </p>
          <p className="text-[22px] font-bold text-[#B91C1C] tabular-nums mt-1.5">
            {kpi.outOfStockVariants} Variants
          </p>
          <p className="text-[11.5px] text-[#6B7280] mt-1">Needs counter restock</p>
        </button>

        <button
          type="button"
          onClick={() => setTab('expiring')}
          className={`text-left bg-white rounded-xl border p-4 transition-colors duration-150 hover:border-[#F59E0B] ${
            tab === 'expiring' ? 'border-[#B45309]' : 'border-[#E5E7EB]'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
            Expiring Within 24h
          </p>
          <p className="text-[22px] font-bold text-[#B45309] tabular-nums mt-1.5">
            {expiringSoonBatches.length} Batches
          </p>
          <p className="text-[11.5px] text-[#6B7280] mt-1">FIFO freshness check</p>
        </button>

        <button
          type="button"
          onClick={() => setTab('wastage')}
          className={`text-left bg-white rounded-xl border p-4 transition-colors duration-150 hover:border-[#181210] col-span-2 lg:col-span-1 ${
            tab === 'wastage' ? 'border-[#181210]' : 'border-[#E5E7EB]'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
            Recorded Wastage
          </p>
          <p className="text-[22px] font-bold text-[#181210] tabular-nums mt-1.5">
            {formatINRCompact(kpi.wastageTotalValue)}
          </p>
          <p className="text-[11.5px] text-[#6B7280] mt-1 tabular-nums">
            {branchWastage.length} wastage events
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
                { id: 'all', label: `All Stock (${allVariantRecords.length})` },
                { id: 'low', label: `Low Stock (${kpi.lowStockVariants})` },
                { id: 'oos', label: `Out of Stock (${kpi.outOfStockVariants})` },
                { id: 'expiring', label: `Expiring Soon (${expiringSoonBatches.length})` },
                { id: 'movement', label: `Stock Movement (${branchMovements.length})` },
                { id: 'wastage', label: `Wastage & Damage (${branchWastage.length})` },
              ] as { id: StockTab; label: string }[]
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
            {canCreate && (
              <button
                type="button"
                onClick={() => openStockModal('stock_in')}
                className="px-3 py-1.5 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-[12px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                Stock In
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => openStockModal('stock_out')}
                className="px-3 py-1.5 rounded-lg bg-white border border-[#D1D5DB] hover:bg-[#FAF9F5] text-[#181210] text-[12px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <PackageMinus className="w-3.5 h-3.5 text-[#C2410C]" />
                Stock Out
              </button>
            )}
            <button
              type="button"
              onClick={handleExportStock}
              className="px-3 py-1.5 rounded-lg border border-[#D1D5DB] bg-white hover:bg-[#FAF9F5] text-[#181210] text-[12px] font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* ================================================================
            STOCK MOVEMENT TAB
            ================================================================ */}
        {tab === 'movement' ? (
          branchMovements.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-2">
              <p className="text-[14px] font-semibold text-[#181210]">
                No stock movements logged yet for {activeBranch.name}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[960px]">
                <thead>
                  <tr className="bg-[#FAF9F5] border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                    <th className="py-3 px-4">DATE &amp; TIME</th>
                    <th className="py-3 px-3">PRODUCT &amp; VARIANT</th>
                    <th className="py-3 px-3">BATCH / REF</th>
                    <th className="py-3 px-3">MOVEMENT TYPE</th>
                    <th className="py-3 px-3 text-right">CHANGE</th>
                    <th className="py-3 px-3 text-right">UPDATED STOCK</th>
                    <th className="py-3 px-4">REASON / STAFF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] text-[12.5px]">
                  {branchMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-[#FAF9F5]/80 transition-colors">
                      <td className="py-3 px-4 text-[#6B7280] tabular-nums whitespace-nowrap">
                        {formatDateTime(m.timestamp)}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-[#181210]">{m.productName}</p>
                        {m.variantLabel && (
                          <p className="text-[11px] text-[#6B7280] mt-0.5">
                            Variant: <span className="font-medium text-[#374151]">{m.variantLabel}</span>
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11.5px] text-[#374151] whitespace-nowrap">
                        <div>{m.batchCode}</div>
                        {m.referenceNumber && m.referenceNumber !== m.batchCode && (
                          <div className="text-[10.5px] text-[#6B7280]">
                            Ref: {m.referenceNumber}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11.5px] font-semibold ${
                            m.type === 'Stock In' || m.type === 'Batch Added'
                              ? 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]'
                              : m.type === 'Stock Out'
                              ? 'bg-[#FFEDD5] text-[#C2410C] border-[#FED7AA]'
                              : m.type === 'Wastage / Damage'
                              ? 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]'
                              : 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]'
                          }`}
                        >
                          {m.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold tabular-nums whitespace-nowrap">
                        <span className={m.delta >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'}>
                          {m.delta >= 0
                            ? `+${formatDecimal(m.delta, 3)}`
                            : `-${formatDecimal(Math.abs(m.delta), 3)}`}{' '}
                          {m.unitLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-[#181210] whitespace-nowrap">
                        <span className="text-[#6B7280]">
                          {formatDecimal(m.previousQty, 3)} &rarr;{' '}
                        </span>
                        <strong>{formatStockQty(m.newQty, m.unitLabel)}</strong>
                      </td>
                      <td className="py-3 px-4 text-[12px] text-[#6B7280]">
                        <p className="text-[#181210] font-medium">{m.reason}</p>
                        <p className="text-[11.5px] text-[#6B7280] mt-0.5">By {m.performedBy}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === 'wastage' ? (
          /* ================================================================
             WASTAGE & DAMAGE TAB
             ================================================================ */
          branchWastage.length === 0 ? (
            <div className="py-14 px-6 text-center space-y-2">
              <p className="text-[14px] font-semibold text-[#181210]">
                No wastage entries logged for {activeBranch.name}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[920px]">
                <thead>
                  <tr className="bg-[#FAF9F5] border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                    <th className="py-3 px-4">DATE &amp; TIME</th>
                    <th className="py-3 px-3">PRODUCT &amp; VARIANT</th>
                    <th className="py-3 px-3">BATCH CODE</th>
                    <th className="py-3 px-3">REASON</th>
                    <th className="py-3 px-3 text-right">QTY WASTED</th>
                    <th className="py-3 px-3 text-right">EST. LOSS</th>
                    <th className="py-3 px-4">LOGGED BY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] text-[13px]">
                  {branchWastage.map((w) => (
                    <tr key={w.id} className="hover:bg-[#FAF9F5]/80 transition-colors">
                      <td className="py-3 px-4 text-[12.5px] text-[#6B7280] tabular-nums whitespace-nowrap">
                        {formatDateTime(w.loggedAt)}
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-semibold text-[#181210]">{w.productName}</p>
                        {w.variantLabel && (
                          <p className="text-[11px] text-[#6B7280] mt-0.5">{w.variantLabel}</p>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-[12px] text-[#374151] whitespace-nowrap">
                        {w.batchCode}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-[#FECACA] text-[11.5px] font-semibold bg-[#FEE2E2] text-[#B91C1C]">
                          {w.reason}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-[#181210] tabular-nums whitespace-nowrap">
                        {formatStockQty(w.quantity, w.unitLabel)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-[#B91C1C] tabular-nums whitespace-nowrap">
                        {formatINRCompact(w.estimatedValue)}
                      </td>
                      <td className="py-3 px-4 text-[12.5px] text-[#374151] whitespace-nowrap">
                        {w.loggedBy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* ================================================================
             VARIANT-LEVEL STOCK TABLE (Parent Product + Child Variant Rows)
             ================================================================ */
          <div>
            {/* Filters Toolbar (Matching Inventory Management) */}
            <div className="p-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
                <div className="relative flex-1 min-w-[210px] max-w-xs">
                  <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search product, SKU, or variant..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-[#D1D5DB] text-[12.5px] focus:outline-none focus:border-[#FB923C]"
                  />
                </div>

                <select
                  value={catFilter}
                  onChange={(e) => setCatFilter(e.target.value)}
                  aria-label="Filter by menu category"
                  className="px-3 py-1.5 rounded-lg border border-[#D1D5DB] text-[12.5px] bg-white focus:outline-none focus:border-[#FB923C]"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {tab === 'all' && (
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    aria-label="Filter by stock status"
                    className="px-3 py-1.5 rounded-lg border border-[#D1D5DB] text-[12.5px] bg-white focus:outline-none focus:border-[#FB923C]"
                  >
                    <option value="ALL">All Stock Statuses</option>
                    <option value="IN_STOCK">In Stock</option>
                    <option value="LOW_STOCK">Low Stock</option>
                    <option value="OUT_OF_STOCK">Out of Stock</option>
                    <option value="EXPIRING">Expiring Soon</option>
                  </select>
                )}

                {(search || catFilter !== 'ALL' || statusFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setCatFilter('ALL');
                      setStatusFilter('ALL');
                    }}
                    className="px-2.5 py-1.5 text-[12px] font-semibold text-[#C2410C] hover:underline"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              <span className="text-[12px] font-medium text-[#6B7280] tabular-nums">
                Showing {groupedVariantRows.length} variant row
                {groupedVariantRows.length === 1 ? '' : 's'}
              </span>
            </div>

            {groupedVariantRows.length === 0 ? (
              <div className="py-14 px-6 text-center space-y-2">
                <p className="text-[14px] font-semibold text-[#181210]">
                  No product variants match the selected filters
                </p>
                <p className="text-[12.5px] text-[#6B7280]">
                  Adjust search or filter criteria, or add new products in Menu Management.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1060px]">
                  <thead>
                    <tr className="bg-[#FAF9F5] border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                      <th className="py-3 px-4">PRODUCT NAME</th>
                      <th className="py-3 px-3">PRODUCT CODE</th>
                      <th className="py-3 px-3">VARIANT / SIZE</th>
                      <th className="py-3 px-3">UNIT</th>
                      <th className="py-3 px-3 text-right">AVAILABLE STOCK</th>
                      <th className="py-3 px-3 text-right">MINIMUM STOCK</th>
                      <th className="py-3 px-3">STOCK STATUS</th>
                      <th className="py-3 px-3">LAST UPDATED</th>
                      <th className="py-3 px-4 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px]">
                    {groupedVariantRows.map((row) => {
                      const {
                        product: p,
                        variant: v,
                        categoryName,
                        unitLabel,
                        available,
                        minStock,
                        earliestExpiry,
                        daysLeft,
                        lastUpdated,
                        status,
                        isExpiring,
                        isFirstOfProduct,
                        isLastOfProduct,
                      } = row;
                      const isRowSelected = selectedProductId === p.id;

                      return (
                        <tr
                          key={`${p.id}-${v.id}`}
                          onClick={() => setSelectedProductId(p.id)}
                          className={`cursor-pointer transition-colors ${
                            isLastOfProduct
                              ? 'border-b border-[#E5E7EB]'
                              : 'border-b border-[#F3F4F6]'
                          } ${
                            isRowSelected
                              ? 'bg-[#FB923C]/8'
                              : 'hover:bg-[#FAF9F5]/80'
                          }`}
                        >
                          {/* PRODUCT NAME (Parent shown once on first variant row) */}
                          <td className="py-2.5 px-4">
                            {isFirstOfProduct ? (
                              <div className="flex items-center gap-3">
                                <ProductThumb
                                  src={p.imageUrl}
                                  alt={p.name}
                                  className="w-9 h-9 rounded-md shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="font-semibold text-[#181210] truncate">
                                    {p.name}
                                  </p>
                                  <p className="text-[11px] text-[#6B7280] mt-0.5 truncate">
                                    {categoryName}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="pl-12 flex items-center gap-1.5 text-[11.5px] text-[#9CA3AF]">
                                <span
                                  className="inline-block w-3 h-3 border-l border-b border-[#D1D5DB] rounded-bl-sm -mt-1.5 shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="truncate text-[#9CA3AF]">Variant</span>
                              </div>
                            )}
                          </td>

                          {/* PRODUCT CODE (Shown once on parent row) */}
                          <td className="py-2.5 px-3 font-mono text-[12px] text-[#374151] whitespace-nowrap">
                            {isFirstOfProduct ? p.sku : ''}
                          </td>

                          {/* VARIANT / SIZE */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="font-semibold text-[#181210]">{v.label}</span>
                            {v.isDefault && p.variants.length > 1 && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#FAF9F5] border border-[#E5E7EB] text-[10px] font-semibold text-[#64748B]">
                                Default
                              </span>
                            )}
                          </td>

                          {/* UNIT */}
                          <td className="py-2.5 px-3 text-[12.5px] text-[#6B7280] whitespace-nowrap">
                            {unitLabel}
                          </td>

                          {/* AVAILABLE STOCK */}
                          <td className="py-2.5 px-3 text-right font-bold tabular-nums whitespace-nowrap">
                            <span
                              className={
                                status === 'OUT_OF_STOCK'
                                  ? 'text-[#B91C1C]'
                                  : status === 'LOW_STOCK'
                                  ? 'text-[#C2410C]'
                                  : 'text-[#15803D]'
                              }
                            >
                              {roundQty(available)}
                            </span>
                          </td>

                          {/* MINIMUM STOCK */}
                          <td className="py-2.5 px-3 text-right text-[12.5px] tabular-nums text-[#6B7280] whitespace-nowrap">
                            {roundQty(minStock)}
                          </td>

                          {/* STOCK STATUS */}
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {status === 'OUT_OF_STOCK' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-[#FECACA] text-[11.5px] font-semibold bg-[#FEE2E2] text-[#B91C1C]">
                                  Out of Stock
                                </span>
                              ) : status === 'LOW_STOCK' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-[#FED7AA] text-[11.5px] font-semibold bg-[#FFEDD5] text-[#C2410C]">
                                  Low Stock
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-[#BBF7D0] text-[11.5px] font-semibold bg-[#DCFCE7] text-[#15803D]">
                                  In Stock
                                </span>
                              )}

                              {isExpiring && earliestExpiry && (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-md border border-[#FECACA] text-[11px] font-semibold bg-[#FEE2E2] text-[#B91C1C]"
                                  title={`Earliest expiry: ${formatDateShort(earliestExpiry)}`}
                                >
                                  {daysLeft <= 0 ? 'Exp. Today' : 'Exp. Soon'}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* LAST UPDATED */}
                          <td className="py-2.5 px-3 text-[12px] text-[#6B7280] tabular-nums whitespace-nowrap">
                            {lastUpdated ? formatDateTime(lastUpdated) : 'Not stocked yet'}
                          </td>

                          {/* ACTIONS (Independent per variant) */}
                          <td className="py-2.5 px-4 text-right whitespace-nowrap">
                            <div
                              className="inline-flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {canCreate && (
                                <button
                                  type="button"
                                  onClick={() => openStockModal('stock_in', p.id, v.id)}
                                  className="h-7 px-2 rounded-md border border-[#BBF7D0] bg-[#DCFCE7]/60 hover:bg-[#DCFCE7] text-[#15803D] text-[11.5px] font-semibold inline-flex items-center transition-colors"
                                  title={`Stock In for ${p.name} (${v.label})`}
                                >
                                  + In
                                </button>
                              )}
                              {canEdit && (
                                <>
                                  <button
                                    type="button"
                                    disabled={available <= 0}
                                    onClick={() => openStockModal('stock_out', p.id, v.id)}
                                    className="h-7 px-2 rounded-md border border-[#FED7AA] bg-[#FFEDD5]/60 hover:bg-[#FFEDD5] disabled:opacity-40 disabled:cursor-not-allowed text-[#C2410C] text-[11.5px] font-semibold inline-flex items-center transition-colors"
                                    title={`Stock Out for ${p.name} (${v.label})`}
                                  >
                                    − Out
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openStockModal('adjust', p.id, v.id)}
                                    className="h-7 px-2 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[#374151] hover:text-[#181210] text-[11.5px] font-semibold inline-flex items-center gap-1 transition-colors"
                                    title={`Edit stock for ${p.name} (${v.label})`}
                                  >
                                    <Pencil className="w-3 h-3" />
                                    Edit
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right-Side Variant Stock & Batch Detail Drawer */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-40 bg-black/40 flex justify-end"
          onClick={() => setSelectedProductId(null)}
        >
          <aside
            className="w-full max-w-lg bg-white h-full border-l border-[#E5E7EB] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <ProductThumb
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.name}
                  className="w-10 h-10 rounded-lg shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-[#181210] truncate">
                    {selectedProduct.name}
                  </h3>
                  <div className="text-[12px] text-[#6B7280] tabular-nums mt-0.5">
                    SKU: <span className="font-mono">{selectedProduct.sku}</span> · Combined:{' '}
                    <strong className="text-[#181210]">
                      {roundQty(getProductStock(selectedProduct.id))}
                    </strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProductId(null)}
                className="p-1.5 rounded-lg text-[#6B7280] hover:bg-white hover:text-[#181210] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Quick Actions Bar */}
              {(canCreate || canEdit) && (
                <div className="flex flex-wrap items-center gap-2">
                  {canCreate && (
                    <button
                      type="button"
                      onClick={() => openStockModal('stock_in', selectedProduct.id)}
                      className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-[12px] font-semibold transition-colors"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      Stock In
                    </button>
                  )}
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => openStockModal('stock_out', selectedProduct.id)}
                        className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#FED7AA] bg-[#FFF7ED] hover:bg-[#FFEDD5] text-[#C2410C] text-[12px] font-semibold transition-colors"
                      >
                        <PackageMinus className="w-3.5 h-3.5" />
                        Stock Out
                      </button>
                      <button
                        type="button"
                        onClick={() => openStockModal('adjust', selectedProduct.id)}
                        className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#D1D5DB] bg-white hover:bg-[#FAF9F5] text-[#181210] text-[12px] font-semibold transition-colors"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        Edit Counts
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Section 1: Variant Stock Breakdown */}
              <div className="space-y-2.5">
                <div className="text-[12px] font-bold uppercase tracking-wider text-[#6B7280]">
                  Variant Stock Levels
                </div>
                <div className="space-y-2">
                  {selectedProduct.variants.map((v) => {
                    const qty = getVariantStock(selectedProduct.id, v.id);
                    const min = getVariantMinStock(selectedProduct, v);
                    const unit = getVariantUnitLabel(selectedProduct, v);
                    const isOos = qty <= 0;
                    const isLow = qty > 0 && qty <= min;
                    return (
                      <div
                        key={v.id}
                        className="p-3 rounded-xl border border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[13px] text-[#181210]">
                              {v.label}
                            </span>
                            {isOos ? (
                              <span className="px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#B91C1C] text-[10.5px] font-semibold">
                                Out of Stock
                              </span>
                            ) : isLow ? (
                              <span className="px-1.5 py-0.5 rounded bg-[#FFEDD5] text-[#C2410C] text-[10.5px] font-semibold">
                                Low Stock
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#15803D] text-[10.5px] font-semibold">
                                In Stock
                              </span>
                            )}
                          </div>
                          <div className="text-[11.5px] text-[#6B7280] tabular-nums mt-0.5">
                            Available:{' '}
                            <strong className="text-[#181210]">
                              {formatStockQty(qty, unit)}
                            </strong>{' '}
                            · Min: {min} {unit}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {canCreate && (
                            <button
                              type="button"
                              onClick={() => openStockModal('stock_in', selectedProduct.id, v.id)}
                              className="px-2 py-1 rounded border border-[#BBF7D0] bg-white hover:bg-[#DCFCE7] text-[#15803D] text-[11px] font-semibold"
                            >
                              + In
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openStockModal('adjust', selectedProduct.id, v.id)}
                              className="px-2 py-1 rounded border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[#181210] text-[11px] font-semibold"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: FIFO Batch Lots */}
              <div className="pt-3 border-t border-[#E5E7EB] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-[#6B7280]">
                    Batch &amp; Expiry Lots (FIFO)
                  </span>
                </div>

                {selectedProductBatches.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-[#E5E7EB] text-center text-[12.5px] text-[#6B7280]">
                    No batches recorded for this item yet. Use Stock In to add opening batches.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedProductBatches.map((b) => {
                      const dLeft = daysUntil(b.expiryDate, TODAY_ISO);
                      const matchedVar = selectedProduct.variants.find(
                        (v) => v.id === b.variantId
                      );
                      return (
                        <div
                          key={b.id}
                          className="p-3.5 rounded-xl border border-[#E5E7EB] bg-[#FAF9F5] space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[12px] font-bold text-[#181210]">
                                {b.batchCode}
                              </span>
                              {(b.variantLabel || matchedVar?.label) && (
                                <span className="px-1.5 py-0.5 rounded bg-white border border-[#E5E7EB] text-[10.5px] font-semibold text-[#374151]">
                                  {b.variantLabel ?? matchedVar?.label}
                                </span>
                              )}
                            </div>
                            {selectedProduct.trackExpiry && (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${
                                  dLeft <= 1
                                    ? 'bg-[#FEE2E2] text-[#B91C1C] border-[#FECACA]'
                                    : 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]'
                                }`}
                              >
                                {dLeft <= 0
                                  ? 'Expires Today'
                                  : dLeft === 1
                                  ? '1 day left'
                                  : `${dLeft} days left`}
                              </span>
                            )}
                          </div>

                          <div className="text-[11.5px] text-[#6B7280] flex items-center justify-between tabular-nums">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" /> Prep: {formatDateShort(b.prepDate)}
                            </span>
                            <span>Exp: {formatDateShort(b.expiryDate)}</span>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E5E7EB]">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11.5px] text-[#6B7280]">Qty:</span>
                              <input
                                type="number"
                                disabled={!canEdit}
                                step="any"
                                min={0}
                                value={b.quantity}
                                onChange={(e) =>
                                  adjustBatchQuantity(
                                    b.id,
                                    roundQty(Math.max(0, Number(e.target.value) || 0)),
                                    'Manual batch counter adjustment'
                                  )
                                }
                                className="w-20 px-2 py-1 text-[12.5px] font-semibold bg-white border border-[#D1D5DB] rounded-lg tabular-nums disabled:opacity-60 focus:outline-none focus:border-[#FB923C]"
                              />
                              <span className="text-[11.5px] text-[#6B7280]">{b.unitLabel}</span>
                            </div>

                            {canEdit && b.quantity > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setWastageBatchId(b.id);
                                  setWastageQty('1');
                                  setWastageReason(dLeft <= 0 ? 'Expired' : 'Damaged in Display');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[#FECACA] bg-white hover:bg-[#FEE2E2] text-[11.5px] font-semibold text-[#B91C1C] transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                                Wastage
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 3: Recent Product Movement History */}
              <div className="pt-3 border-t border-[#E5E7EB] space-y-2.5">
                <div className="text-[12px] font-bold uppercase tracking-wider text-[#6B7280] flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[#FB923C]" />
                  Recent Stock Movement
                </div>
                {branchMovements.filter((m) => m.productId === selectedProduct.id).slice(0, 6)
                  .length === 0 ? (
                  <div className="text-[12px] text-[#6B7280]">No recent movements.</div>
                ) : (
                  <div className="space-y-2">
                    {branchMovements
                      .filter((m) => m.productId === selectedProduct.id)
                      .slice(0, 6)
                      .map((m) => (
                        <div
                          key={m.id}
                          className="p-2.5 rounded-lg border border-[#E5E7EB] bg-white text-[12px] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[#181210] truncate">
                              {m.type}
                              {m.variantLabel ? ` (${m.variantLabel})` : ''} · {m.reason}
                            </div>
                            <div className="text-[11px] text-[#6B7280] tabular-nums mt-0.5">
                              {formatDateTime(m.timestamp)}
                              {m.referenceNumber ? ` · Ref: ${m.referenceNumber}` : ''}
                            </div>
                          </div>
                          <span
                            className={`font-bold tabular-nums shrink-0 ${
                              m.delta >= 0 ? 'text-[#15803D]' : 'text-[#B91C1C]'
                            }`}
                          >
                            {m.delta >= 0
                              ? `+${formatDecimal(m.delta, 3)}`
                              : `-${formatDecimal(Math.abs(m.delta), 3)}`}{' '}
                            {m.unitLabel}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Unified Variant Stock In / Stock Out / Edit Modal */}
      <VariantStockUpdateModal
        open={modalOpen}
        initialMode={modalMode}
        preselectedProductId={modalProductId}
        focusedVariantId={modalVariantId}
        onClose={() => setModalOpen(false)}
      />

      {/* Log Wastage Modal */}
      {wastageBatchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FEE2E2] text-[#B91C1C] flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="text-[15px] font-bold text-[#181210]">Log Damaged / Expired Stock</h3>
              </div>
              <button
                type="button"
                onClick={() => setWastageBatchId(null)}
                className="p-1.5 rounded-lg text-[#6B7280] hover:bg-white hover:text-[#181210] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                logWastage({
                  batchId: wastageBatchId,
                  quantity: roundQty(Number(wastageQty) || 0),
                  reason: wastageReason,
                });
                setWastageBatchId(null);
              }}
              className="p-6 space-y-4 text-[13px]"
            >
              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  Quantity Wasted
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  required
                  value={wastageQty}
                  onChange={(e) => setWastageQty(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-[13px] tabular-nums focus:outline-none focus:border-[#FB923C]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  Reason
                </label>
                <select
                  value={wastageReason}
                  onChange={(e) => setWastageReason(e.target.value as WastageLog['reason'])}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg bg-white text-[13px] focus:outline-none focus:border-[#FB923C]"
                >
                  <option value="Expired">Expired</option>
                  <option value="Damaged in Display">Damaged in Display</option>
                  <option value="Quality Reject">Quality Reject</option>
                  <option value="Sample / Tasting">Sample / Tasting</option>
                </select>
              </div>
              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setWastageBatchId(null)}
                  className="px-4 py-2 text-[13px] font-semibold text-[#374151] border border-[#D1D5DB] rounded-lg hover:bg-[#FAF9F5] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-[13px] font-semibold bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-lg transition-colors"
                >
                  Confirm Wastage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
