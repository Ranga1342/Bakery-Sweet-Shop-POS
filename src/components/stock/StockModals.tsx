import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  PackageMinus,
  PackagePlus,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { usePos } from '../../context/PosContext';
import { ProductThumb } from '../common/ProductThumb';
import { formatStockQty, roundQty, TODAY_ISO } from '../../utils/formatters';

export type VariantStockModalMode = 'stock_in' | 'stock_out' | 'adjust';

export const PRODUCT_STOCK_IN_REASONS = [
  'Fresh counter batch restock',
  'Kitchen / Bakery replenishment',
  'Supplier / Bottle delivery',
  'Branch transfer received',
  'Opening stock entry',
];

export const PRODUCT_STOCK_OUT_REASONS = [
  'Issued to POS Display Counter',
  'Corporate / Event Order Dispatch',
  'VIP Tasting / Complimentary',
  'Damaged in Display',
  'Expired',
  'Quality Reject',
  'Sample / Tasting',
];

export const PRODUCT_ADJUSTMENT_REASONS = [
  'Physical audit reconciliation',
  'Display counter recount variance',
  'Weight trimming / portioning loss',
  'Opening balance correction',
  'Damaged / Spoiled count correction',
];

function computeExpiryDate(prepDate: string, shelfLifeDays: number): string {
  const base = new Date(`${prepDate || TODAY_ISO}T00:00:00`);
  if (isNaN(base.getTime())) return TODAY_ISO;
  base.setDate(base.getDate() + Math.max(1, shelfLifeDays || 3));
  return base.toISOString().slice(0, 10);
}

interface VariantStockUpdateModalProps {
  open: boolean;
  initialMode: VariantStockModalMode;
  preselectedProductId?: string;
  focusedVariantId?: string;
  onClose: () => void;
}

export const VariantStockUpdateModal: React.FC<VariantStockUpdateModalProps> = ({
  open,
  initialMode,
  preselectedProductId,
  focusedVariantId,
  onClose,
}) => {
  const {
    products,
    categories,
    activeBranch,
    getVariantStock,
    getVariantUnitLabel,
    getVariantMinStock,
    recordMultiVariantStockUpdate,
  } = usePos();

  const [mode, setMode] = useState<VariantStockModalMode>(initialMode);
  const [productId, setProductId] = useState<string>('');
  const [date, setDate] = useState<string>(TODAY_ISO);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [prepDate, setPrepDate] = useState<string>(TODAY_ISO);
  const [expiryDate, setExpiryDate] = useState<string>(TODAY_ISO);
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const [minStockInputs, setMinStockInputs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>('');

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === productId) ?? products[0] ?? null,
    [products, productId]
  );

  const reasonOptions =
    mode === 'stock_in'
      ? PRODUCT_STOCK_IN_REASONS
      : mode === 'stock_out'
      ? PRODUCT_STOCK_OUT_REASONS
      : PRODUCT_ADJUSTMENT_REASONS;

  // Initialize modal state on open
  useEffect(() => {
    if (!open) return;
    const targetProd =
      products.find((p) => p.id === preselectedProductId) ?? products[0];
    setMode(initialMode);
    setProductId(targetProd?.id ?? '');
    setDate(TODAY_ISO);
    setPrepDate(TODAY_ISO);
    setExpiryDate(computeExpiryDate(TODAY_ISO, targetProd?.shelfLifeDays ?? 3));
    setReferenceNumber(
      initialMode === 'stock_in'
        ? `IN-${Math.floor(100 + Math.random() * 899)}`
        : initialMode === 'stock_out'
        ? `OUT-${Math.floor(100 + Math.random() * 899)}`
        : `ADJ-${Math.floor(100 + Math.random() * 899)}`
    );
    setReason(
      initialMode === 'stock_in'
        ? PRODUCT_STOCK_IN_REASONS[0]
        : initialMode === 'stock_out'
        ? PRODUCT_STOCK_OUT_REASONS[0]
        : PRODUCT_ADJUSTMENT_REASONS[0]
    );
    setNotes('');
    setError('');
  }, [open, initialMode, preselectedProductId, products]);

  // Reset per-variant inputs whenever product or mode changes
  useEffect(() => {
    if (!open || !selectedProduct) return;
    setError('');
    setExpiryDate(computeExpiryDate(prepDate, selectedProduct.shelfLifeDays || 3));

    const nextQty: Record<string, string> = {};
    const nextMin: Record<string, string> = {};
    selectedProduct.variants.forEach((v) => {
      const cur = getVariantStock(selectedProduct.id, v.id);
      const min = getVariantMinStock(selectedProduct, v);
      nextMin[v.id] = String(min);
      if (mode === 'adjust') {
        nextQty[v.id] = String(cur);
      } else {
        nextQty[v.id] = '';
      }
    });
    setQtyInputs(nextQty);
    setMinStockInputs(nextMin);
  }, [open, selectedProduct?.id, mode]);

  // Keep default reason synced when switching mode tabs inside modal
  const handleSwitchMode = (nextMode: VariantStockModalMode) => {
    setMode(nextMode);
    setError('');
    if (nextMode === 'stock_in') {
      setReason(PRODUCT_STOCK_IN_REASONS[0]);
      setReferenceNumber(`IN-${Math.floor(100 + Math.random() * 899)}`);
    } else if (nextMode === 'stock_out') {
      setReason(PRODUCT_STOCK_OUT_REASONS[0]);
      setReferenceNumber(`OUT-${Math.floor(100 + Math.random() * 899)}`);
    } else {
      setReason(PRODUCT_ADJUSTMENT_REASONS[0]);
      setReferenceNumber(`ADJ-${Math.floor(100 + Math.random() * 899)}`);
    }
  };

  if (!open || !selectedProduct) return null;

  const categoryName =
    categories.find((c) => c.id === selectedProduct.categoryId)?.name ?? 'Menu Item';

  const variantRows = selectedProduct.variants.map((v) => {
    const current = getVariantStock(selectedProduct.id, v.id);
    const minAlert = getVariantMinStock(selectedProduct, v);
    const unit = getVariantUnitLabel(selectedProduct, v);
    const rawQty = qtyInputs[v.id] ?? '';
    const parsedQty = rawQty.trim() === '' ? NaN : Number(rawQty);

    const rawMin = minStockInputs[v.id] ?? String(minAlert);
    const parsedMin = rawMin.trim() === '' ? minAlert : Number(rawMin);

    let nextStock = current;
    let delta = 0;
    let rowError = '';

    if (mode === 'stock_in') {
      if (rawQty.trim() !== '') {
        if (!Number.isFinite(parsedQty) || parsedQty < 0) {
          rowError = 'Enter a positive quantity';
        } else if (parsedQty > 0) {
          delta = roundQty(parsedQty);
          nextStock = roundQty(current + delta);
        }
      }
    } else if (mode === 'stock_out') {
      if (rawQty.trim() !== '') {
        if (!Number.isFinite(parsedQty) || parsedQty < 0) {
          rowError = 'Enter a positive quantity';
        } else if (parsedQty > current) {
          rowError = `Max ${current} ${unit}`;
        } else if (parsedQty > 0) {
          delta = -roundQty(parsedQty);
          nextStock = Math.max(0, roundQty(current - parsedQty));
        }
      }
    } else {
      if (!Number.isFinite(parsedQty) || parsedQty < 0) {
        rowError = 'Stock cannot be negative';
      } else {
        nextStock = roundQty(parsedQty);
        delta = roundQty(nextStock - current);
      }
    }

    const minChanged =
      mode === 'adjust' &&
      Number.isFinite(parsedMin) &&
      parsedMin >= 0 &&
      roundQty(parsedMin) !== minAlert;

    return {
      variant: v,
      current,
      minAlert,
      unit,
      rawQty,
      parsedQty,
      rawMin,
      parsedMin,
      nextStock,
      delta,
      minChanged,
      rowError,
    };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const firstRowError = variantRows.find((r) => r.rowError);
    if (firstRowError) {
      setError(`${firstRowError.variant.label}: ${firstRowError.rowError}`);
      return;
    }

    const entries = variantRows
      .filter((r) => {
        if (mode === 'stock_in' || mode === 'stock_out') {
          return Number.isFinite(r.parsedQty) && r.parsedQty > 0;
        }
        return r.delta !== 0 || r.minChanged;
      })
      .map((r) => ({
        variantId: r.variant.id,
        quantity:
          mode === 'adjust' ? roundQty(r.nextStock) : roundQty(r.parsedQty),
        minStockAlert:
          mode === 'adjust' && Number.isFinite(r.parsedMin) && r.parsedMin >= 0
            ? roundQty(r.parsedMin)
            : undefined,
      }));

    if (entries.length === 0) {
      setError(
        mode === 'adjust'
          ? 'Update at least one variant stock quantity or minimum stock threshold.'
          : 'Enter a quantity greater than 0 for at least one variant.'
      );
      return;
    }

    const result = recordMultiVariantStockUpdate({
      mode,
      productId: selectedProduct.id,
      date,
      referenceNumber: referenceNumber.trim() || undefined,
      reason: reason || reasonOptions[0],
      notes: notes.trim() || undefined,
      prepDate: mode === 'stock_in' ? prepDate : undefined,
      expiryDate: mode === 'stock_in' ? expiryDate : undefined,
      entries,
    });

    if (!result.ok) {
      setError(result.error || 'Could not update variant stock.');
      return;
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                mode === 'stock_in'
                  ? 'bg-[#DCFCE7] text-[#15803D]'
                  : mode === 'stock_out'
                  ? 'bg-[#FFEDD5] text-[#C2410C]'
                  : 'bg-[#181210] text-white'
              }`}
            >
              {mode === 'stock_in' ? (
                <PackagePlus className="w-4.5 h-4.5" />
              ) : mode === 'stock_out' ? (
                <PackageMinus className="w-4.5 h-4.5" />
              ) : (
                <SlidersHorizontal className="w-4.5 h-4.5" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold text-[#181210] truncate">
                Variant Stock Update — {activeBranch.name}
              </h3>
              <p className="text-[12px] text-[#64748B] truncate">
                Update individual product variants independently without affecting sibling sizes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-white hover:text-[#181210] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-[13px]">
          {/* Operation Tabs + Product Selector */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
            <div className="md:col-span-6">
              <label className="block text-[11.5px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                Menu Product
              </label>
              <div className="flex items-center gap-2.5">
                <ProductThumb
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.name}
                  className="w-9 h-9 rounded-lg shrink-0"
                />
                <select
                  value={selectedProduct.id}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg bg-white text-[13px] font-semibold text-[#181210] focus:outline-none focus:border-[#FB923C]"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) · {p.variants.length} variant
                      {p.variants.length > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="md:col-span-6">
              <label className="block text-[11.5px] font-bold uppercase tracking-wide text-[#6B7280] mb-1.5">
                Stock Operation
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB]">
                {(
                  [
                    { id: 'stock_in', label: '+ Stock In', activeCls: 'bg-[#15803D] text-white' },
                    { id: 'stock_out', label: '− Stock Out', activeCls: 'bg-[#C2410C] text-white' },
                    { id: 'adjust', label: 'Edit Count', activeCls: 'bg-[#181210] text-white' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSwitchMode(opt.id)}
                    className={`py-1.5 px-2.5 rounded-md text-[12px] font-semibold transition-colors whitespace-nowrap ${
                      mode === opt.id
                        ? opt.activeCls
                        : 'text-[#64748B] hover:text-[#181210]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Product Meta Strip */}
          <div className="px-3.5 py-2 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <div className="flex items-center gap-2 text-[#374151]">
              <span className="font-semibold text-[#181210]">{selectedProduct.name}</span>
              <span className="text-[#9CA3AF]">•</span>
              <span>{categoryName}</span>
              <span className="text-[#9CA3AF]">•</span>
              <span className="font-mono text-[#6B7280]">{selectedProduct.sku}</span>
            </div>
            <span className="text-[#6B7280]">
              {selectedProduct.variants.length} independent stock variant
              {selectedProduct.variants.length > 1 ? 's' : ''}
            </span>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-[12.5px] font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Variants Stock Table */}
          <div className="rounded-xl border border-[#E5E7EB] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAF9F5] border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                    <th className="py-2.5 px-3.5">Variant / Size</th>
                    <th className="py-2.5 px-3">Unit</th>
                    <th className="py-2.5 px-3 text-right">Current Stock</th>
                    <th className="py-2.5 px-3 text-right">Min Stock</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 w-[150px]">
                      {mode === 'stock_in'
                        ? 'Add Qty (+)'
                        : mode === 'stock_out'
                        ? 'Remove Qty (−)'
                        : 'New Stock (=)'}
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Updated Preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] text-[12.5px]">
                  {variantRows.map((r) => {
                    const isFocused = focusedVariantId === r.variant.id;
                    const isOos = r.current <= 0;
                    const isLow = r.current > 0 && r.current <= r.minAlert;
                    return (
                      <tr
                        key={r.variant.id}
                        className={
                          isFocused
                            ? 'bg-[#FFF7ED]/70'
                            : 'hover:bg-[#FAF9F5]/60 transition-colors'
                        }
                      >
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[#181210]">
                              {r.variant.label}
                            </span>
                            {r.variant.isDefault && (
                              <span className="px-1.5 py-0.5 rounded bg-[#FAF9F5] border border-[#E5E7EB] text-[10px] font-semibold text-[#64748B]">
                                Default
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-[#64748B]">{r.unit}</td>
                        <td className="py-2.5 px-3 text-right font-bold tabular-nums text-[#181210]">
                          {formatStockQty(r.current, r.unit)}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums">
                          {mode === 'adjust' ? (
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={r.rawMin}
                              onChange={(e) =>
                                setMinStockInputs((prev) => ({
                                  ...prev,
                                  [r.variant.id]: e.target.value,
                                }))
                              }
                              aria-label={`Minimum stock for ${r.variant.label}`}
                              className="w-16 px-2 py-1 text-right text-[12px] font-semibold border border-[#D1D5DB] rounded-md bg-white tabular-nums focus:outline-none focus:border-[#FB923C]"
                            />
                          ) : (
                            <span className="text-[#6B7280]">
                              {r.minAlert} {r.unit}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {isOos ? (
                            <span className="inline-flex px-2 py-0.5 rounded border border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C] text-[11px] font-semibold">
                              Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex px-2 py-0.5 rounded border border-[#FED7AA] bg-[#FFEDD5] text-[#C2410C] text-[11px] font-semibold">
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded border border-[#BBF7D0] bg-[#DCFCE7] text-[#15803D] text-[11px] font-semibold">
                              In Stock
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="space-y-0.5">
                            <input
                              type="number"
                              min={0}
                              max={mode === 'stock_out' ? r.current : undefined}
                              step="any"
                              autoFocus={isFocused}
                              placeholder={mode === 'adjust' ? String(r.current) : '0'}
                              value={r.rawQty}
                              onChange={(e) =>
                                setQtyInputs((prev) => ({
                                  ...prev,
                                  [r.variant.id]: e.target.value,
                                }))
                              }
                              aria-label={`Quantity for ${r.variant.label}`}
                              className={`w-full px-2.5 py-1.5 text-[12.5px] font-semibold border rounded-md tabular-nums bg-white focus:outline-none ${
                                r.rowError
                                  ? 'border-[#DC2626]'
                                  : isFocused
                                  ? 'border-[#FB923C] ring-1 ring-[#FB923C]/40'
                                  : 'border-[#D1D5DB] focus:border-[#FB923C]'
                              }`}
                            />
                            {r.rowError && (
                              <p className="text-[10.5px] font-medium text-[#DC2626]">
                                {r.rowError}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 text-right tabular-nums whitespace-nowrap">
                          {r.delta !== 0 ? (
                            <span
                              className={`font-bold ${
                                r.delta > 0 ? 'text-[#15803D]' : 'text-[#C2410C]'
                              }`}
                            >
                              {r.delta > 0 ? `+${r.delta}` : r.delta} &rarr;{' '}
                              {formatStockQty(r.nextStock, r.unit)}
                            </span>
                          ) : (
                            <span className="text-[#9CA3AF]">No change</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Metadata Row: Date, Reference #, Reason, Expiry (for Stock In on perishables) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                Transaction Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-[13px] tabular-nums focus:outline-none focus:border-[#FB923C]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                Reference / Batch #
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Optional reference code"
                className="w-full px-3 py-2 font-mono border border-[#D1D5DB] rounded-lg text-[13px] focus:outline-none focus:border-[#FB923C]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg bg-white text-[13px] focus:outline-none focus:border-[#FB923C]"
              >
                {reasonOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {mode === 'stock_in' && selectedProduct.trackExpiry && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E5E7EB]">
              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  Prep / Mfg Date
                </label>
                <input
                  type="date"
                  value={prepDate}
                  onChange={(e) => {
                    const nextPrep = e.target.value;
                    setPrepDate(nextPrep);
                    setExpiryDate(
                      computeExpiryDate(nextPrep, selectedProduct.shelfLifeDays || 3)
                    );
                  }}
                  className="w-full px-3 py-1.5 border border-[#D1D5DB] rounded-lg bg-white text-[12.5px] tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  Expiry / Best Before
                </label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#D1D5DB] rounded-lg bg-white text-[12.5px] tabular-nums"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Chilled beverage restock / physical audit count"
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-[13px] focus:outline-none focus:border-[#FB923C]"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E7EB]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-semibold text-[#374151] border border-[#D1D5DB] rounded-lg hover:bg-[#FAF9F5] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-5 py-2 text-[13px] font-semibold text-white rounded-lg transition-colors ${
                mode === 'stock_in'
                  ? 'bg-[#15803D] hover:bg-[#166534]'
                  : mode === 'stock_out'
                  ? 'bg-[#C2410C] hover:bg-[#9A3412]'
                  : 'bg-[#FB923C] hover:bg-[#EA580C]'
              }`}
            >
              {mode === 'stock_in'
                ? 'Confirm Stock In'
                : mode === 'stock_out'
                ? 'Confirm Stock Out'
                : 'Save Stock Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
