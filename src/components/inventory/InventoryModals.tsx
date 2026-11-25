import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  FileText,
  Layers,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Plus,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  InventoryCategory,
  InventoryItem,
  InventoryItemStatus,
  InventoryUnit,
  PendingStockReceipt,
  Supplier,
} from '../../types/pos';
import { usePos } from '../../context/PosContext';
import {
  formatDecimal,
  formatINRCompact,
  formatStockQty,
  roundCurrency,
  roundQty,
  TODAY_ISO,
} from '../../utils/formatters';

export const INVENTORY_CATEGORIES: InventoryCategory[] = [
  'Dairy & Fats',
  'Chocolate & Nuts',
  'Flours & Sugars',
  'Packaging & Boxes',
  'Decorations & Toppings',
];

export const INVENTORY_UNITS: InventoryUnit[] = ['kg', 'litre', 'pcs', 'packs'];

export const STOCK_OUT_REASONS = [
  'Issued to Kitchen / Baking',
  'Issued to Packing Counter',
  'Internal Usage',
  'Wastage',
  'Damaged Items',
  'Expired Disposal',
  'Manual Adjustment',
];

export const ADJUSTMENT_REASONS = [
  'Physical audit reconciliation',
  'Spillage / Weighing variance',
  'Opening balance correction',
  'Damaged / Spoiled count correction',
  'Supplier short-supply adjustment',
];

// ============================================================================
// 1. Add / Edit Inventory Item Modal (with inline New Supplier creation)
// ============================================================================
interface ItemFormModalProps {
  open: boolean;
  editingItem: InventoryItem | null;
  onClose: () => void;
}

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  open,
  editingItem,
  onClose,
}) => {
  const { suppliers, addSupplier, addInventoryItem, updateInventoryItem, inventoryItems } =
    usePos();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<InventoryCategory>('Dairy & Fats');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState<InventoryUnit>('kg');
  const [status, setStatus] = useState<InventoryItemStatus>('Active');
  const [description, setDescription] = useState('');

  const [supplierId, setSupplierId] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');

  const [openingQty, setOpeningQty] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('5');
  const [storageLocation, setStorageLocation] = useState('');
  const [trackExpiry, setTrackExpiry] = useState(true);
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  // Inline quick supplier creation state
  const [showInlineSupplier, setShowInlineSupplier] = useState(false);
  const [newSupName, setNewSupName] = useState('');
  const [newSupContact, setNewSupContact] = useState('');
  const [newSupPhone, setNewSupPhone] = useState('');
  const [newSupEmail, setNewSupEmail] = useState('');
  const [inlineSupError, setInlineSupError] = useState('');

  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setShowInlineSupplier(false);
    setInlineSupError('');

    if (editingItem) {
      setName(editingItem.name);
      setCategory(editingItem.category);
      setSku(editingItem.sku);
      setUnit(editingItem.unit);
      setStatus(editingItem.status ?? 'Active');
      setDescription(editingItem.description ?? '');
      setSupplierId(editingItem.supplierId ?? '');
      setUnitCost(String(editingItem.unitCost));
      setSellingPrice(
        editingItem.sellingPrice !== undefined ? String(editingItem.sellingPrice) : ''
      );
      setOpeningQty(String(editingItem.quantity));
      setMinStockLevel(String(editingItem.minStockLevel));
      setStorageLocation(editingItem.storageLocation ?? '');
      setTrackExpiry(editingItem.trackExpiry);
      setBatchNumber(editingItem.batchNumber ?? '');
      setExpiryDate(editingItem.expiryDate ?? '');
    } else {
      setName('');
      setCategory('Dairy & Fats');
      setSku(`INV-${String(101 + inventoryItems.length)}`);
      setUnit('kg');
      setStatus('Active');
      setDescription('');
      setSupplierId(suppliers[0]?.id ?? '');
      setUnitCost('');
      setSellingPrice('');
      setOpeningQty('0');
      setMinStockLevel('5');
      setStorageLocation('');
      setTrackExpiry(true);
      setBatchNumber('');
      setExpiryDate('');
    }
  }, [open, editingItem, inventoryItems.length, suppliers]);

  if (!open) return null;

  const handleQuickAddSupplier = () => {
    if (!newSupName.trim() || !newSupPhone.trim()) {
      setInlineSupError('Supplier name and phone number are required.');
      return;
    }
    const created = addSupplier({
      name: newSupName.trim(),
      contactPerson: newSupContact.trim() || newSupName.trim(),
      phone: newSupPhone.trim(),
      email: newSupEmail.trim() || undefined,
    });
    setSupplierId(created.id);
    setNewSupName('');
    setNewSupContact('');
    setNewSupPhone('');
    setNewSupEmail('');
    setInlineSupError('');
    setShowInlineSupplier(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Item Name is required.');
      return;
    }
    if (!sku.trim()) {
      setError('Item Code / SKU is required.');
      return;
    }
    const duplicateSku = inventoryItems.find(
      (i) => i.sku.toLowerCase() === sku.trim().toLowerCase() && i.id !== editingItem?.id
    );
    if (duplicateSku) {
      setError(`SKU "${sku.trim()}" is already assigned to ${duplicateSku.name}.`);
      return;
    }
    const parsedCost = parseFloat(unitCost);
    if (isNaN(parsedCost) || parsedCost < 0) {
      setError('Enter a valid Purchase Price (0 or higher).');
      return;
    }
    const parsedSelling = sellingPrice.trim() ? parseFloat(sellingPrice) : undefined;
    if (parsedSelling !== undefined && (isNaN(parsedSelling) || parsedSelling < 0)) {
      setError('Enter a valid Selling Price or leave blank.');
      return;
    }
    const parsedQty = parseFloat(openingQty || '0');
    const parsedMin = parseFloat(minStockLevel || '0');
    if (isNaN(parsedQty) || parsedQty < 0 || isNaN(parsedMin) || parsedMin < 0) {
      setError('Stock quantities cannot be negative.');
      return;
    }

    const selectedSupplier = suppliers.find((s) => s.id === supplierId);

    if (editingItem) {
      updateInventoryItem({
        ...editingItem,
        name: name.trim(),
        category,
        sku: sku.trim().toUpperCase(),
        unit,
        status,
        description: description.trim() || undefined,
        supplierId: selectedSupplier?.id,
        supplierName: selectedSupplier?.name,
        unitCost: roundCurrency(parsedCost),
        sellingPrice: parsedSelling !== undefined ? roundCurrency(parsedSelling) : undefined,
        quantity: roundQty(parsedQty),
        minStockLevel: roundQty(parsedMin),
        storageLocation: storageLocation.trim() || undefined,
        trackExpiry,
        batchNumber: batchNumber.trim() || undefined,
        expiryDate: trackExpiry && expiryDate ? expiryDate : undefined,
      });
    } else {
      addInventoryItem({
        name: name.trim(),
        category,
        sku: sku.trim().toUpperCase(),
        unit,
        status,
        description: description.trim() || undefined,
        supplierId: selectedSupplier?.id,
        supplierName: selectedSupplier?.name,
        unitCost: roundCurrency(parsedCost),
        sellingPrice: parsedSelling !== undefined ? roundCurrency(parsedSelling) : undefined,
        quantity: roundQty(parsedQty),
        minStockLevel: roundQty(parsedMin),
        storageLocation: storageLocation.trim() || undefined,
        trackExpiry,
        batchNumber: batchNumber.trim() || undefined,
        expiryDate: trackExpiry && expiryDate ? expiryDate : undefined,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] w-full max-w-2xl max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#FAF9F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#181210] text-white flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#181210]">
                {editingItem ? 'Edit Inventory Item' : 'Add New Inventory Item'}
              </h3>
              <p className="text-[12px] text-[#6B7280]">
                {editingItem
                  ? `Updating specification for ${editingItem.sku}`
                  : 'Register store-room ingredients, packaging, or supplies'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-white hover:text-[#181210] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="px-3.5 py-2.5 rounded-lg bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-[12.5px] font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Basic Info */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
              <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#6B7280]">
                1. Basic Information
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-[#374151]">Status:</span>
                <div className="inline-flex rounded-lg border border-[#E5E7EB] p-0.5 bg-[#FAF9F5]">
                  {(['Active', 'Inactive'] as InventoryItemStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatus(st)}
                      className={`px-2.5 py-1 rounded-md text-[11.5px] font-semibold transition-colors ${
                        status === st
                          ? st === 'Active'
                            ? 'bg-[#181210] text-white'
                            : 'bg-[#6B7280] text-white'
                          : 'text-[#6B7280] hover:text-[#181210]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Almond Meal Flour (Blanched)"
                  className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] focus:outline-none focus:border-[#FB923C]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  Item Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as InventoryCategory)}
                  className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] bg-white focus:outline-none focus:border-[#FB923C]"
                >
                  {INVENTORY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                    Item Code / SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="INV-CH-109"
                    className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] font-mono tabular-nums uppercase focus:outline-none focus:border-[#FB923C]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                    Unit of Measure *
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as InventoryUnit)}
                    className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] bg-white focus:outline-none focus:border-[#FB923C]"
                  >
                    {INVENTORY_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  Item Description / Specification
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Grade, packaging weight, brand preference, or handling instructions..."
                  className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] focus:outline-none focus:border-[#FB923C] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Supplier & Pricing */}
          <div className="space-y-3.5">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#6B7280] border-b border-[#E5E7EB] pb-2">
              2. Supplier & Pricing
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[12px] font-semibold text-[#374151]">
                    Supplier Name
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowInlineSupplier((v) => !v)}
                    className="text-[11.5px] font-semibold text-[#C2410C] hover:text-[#9A3412] flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {showInlineSupplier ? 'Cancel Quick Add' : 'Add New Supplier'}
                  </button>
                </div>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] bg-white focus:outline-none focus:border-[#FB923C]"
                >
                  <option value="">-- Select Primary Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.contactPerson})
                    </option>
                  ))}
                </select>

                {showInlineSupplier && (
                  <div className="mt-2.5 p-3.5 rounded-xl border border-[#FED7AA] bg-[#FFFBEB] space-y-2.5">
                    <p className="text-[12px] font-bold text-[#9A3412]">
                      Quick Create Supplier
                    </p>
                    {inlineSupError && (
                      <p className="text-[11.5px] font-semibold text-[#B91C1C]">
                        {inlineSupError}
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={newSupName}
                        onChange={(e) => setNewSupName(e.target.value)}
                        placeholder="Supplier Name *"
                        className="px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] bg-white text-[12.5px] focus:outline-none focus:border-[#FB923C]"
                      />
                      <input
                        type="text"
                        value={newSupContact}
                        onChange={(e) => setNewSupContact(e.target.value)}
                        placeholder="Contact Person"
                        className="px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] bg-white text-[12.5px] focus:outline-none focus:border-[#FB923C]"
                      />
                      <input
                        type="text"
                        value={newSupPhone}
                        onChange={(e) => setNewSupPhone(e.target.value)}
                        placeholder="Phone Number *"
                        className="px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] bg-white text-[12.5px] focus:outline-none focus:border-[#FB923C]"
                      />
                      <input
                        type="email"
                        value={newSupEmail}
                        onChange={(e) => setNewSupEmail(e.target.value)}
                        placeholder="Email (optional)"
                        className="px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] bg-white text-[12.5px] focus:outline-none focus:border-[#FB923C]"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleQuickAddSupplier}
                        className="px-3 py-1.5 rounded-lg bg-[#181210] text-white text-[12px] font-semibold hover:bg-[#2E2623] transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Save & Select Supplier
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  Purchase Price (₹ per {unit}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] tabular-nums focus:outline-none focus:border-[#FB923C]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  Selling Price (₹ per {unit}, if applicable)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder="Optional (leave blank for raw ingredients)"
                  className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] tabular-nums focus:outline-none focus:border-[#FB923C]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Stock, Batch & Storage */}
          <div className="space-y-3.5">
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#6B7280] border-b border-[#E5E7EB] pb-2">
              3. Stock, Batch & Storage Location
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  {editingItem ? `Current Stock (${unit}) *` : `Opening Stock (${unit}) *`}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={openingQty}
                  onChange={(e) => setOpeningQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] tabular-nums focus:outline-none focus:border-[#FB923C]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  Minimum Stock Level ({unit}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={minStockLevel}
                  onChange={(e) => setMinStockLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] tabular-nums focus:outline-none focus:border-[#FB923C]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                  Storage Location
                </label>
                <input
                  type="text"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  placeholder="e.g., Walk-in Chiller #1"
                  className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] focus:outline-none focus:border-[#FB923C]"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E5E7EB] space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-[#181210]">
                    Track Batch & Expiry Date
                  </p>
                  <p className="text-[11.5px] text-[#6B7280]">
                    Enable expiry monitoring alerts for perishable ingredients
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={trackExpiry}
                  onClick={() => setTrackExpiry((v) => !v)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    trackExpiry ? 'bg-[#FB923C]' : 'bg-[#D1D5DB]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      trackExpiry ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                    Batch Number (if applicable)
                  </label>
                  <input
                    type="text"
                    value={batchNumber}
                    onChange={(e) => setBatchNumber(e.target.value)}
                    placeholder="e.g., CC-2611-B"
                    className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] bg-white text-[13px] font-mono focus:outline-none focus:border-[#FB923C]"
                  />
                </div>
                {trackExpiry && (
                  <div>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                      Batch Expiry Date
                    </label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] bg-white text-[13px] tabular-nums focus:outline-none focus:border-[#FB923C]"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#D1D5DB] text-[13px] font-semibold text-[#374151] hover:bg-[#FAF9F5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#FB923C] text-white text-[13px] font-semibold hover:bg-[#EA580C] transition-colors"
            >
              {editingItem ? 'Save Item Changes' : 'Create Inventory Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 2. Multi-Item Stock In Receipt Modal
// ============================================================================
interface StockInLineDraft {
  rowKey: string;
  itemId: string;
  quantity: string;
  unitCost: string;
  batchNumber: string;
  expiryDate: string;
}

interface BatchStockInModalProps {
  open: boolean;
  preselectedItemId?: string;
  preselectedSupplierId?: string;
  pendingReceipt?: PendingStockReceipt | null;
  onClose: () => void;
}

export const BatchStockInModal: React.FC<BatchStockInModalProps> = ({
  open,
  preselectedItemId,
  preselectedSupplierId,
  pendingReceipt,
  onClose,
}) => {
  const {
    inventoryItems,
    suppliers,
    addSupplier,
    recordBatchStockIn,
    savePendingReceipt,
  } = usePos();

  const [supplierId, setSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState(TODAY_ISO);
  const [storageLocation, setStorageLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [attachmentName, setAttachmentName] = useState<string | undefined>(undefined);
  const [attachmentDataUrl, setAttachmentDataUrl] = useState<string | undefined>(undefined);
  const [lines, setLines] = useState<StockInLineDraft[]>([]);
  const [error, setError] = useState('');

  // Quick supplier add
  const [showQuickSupplier, setShowQuickSupplier] = useState(false);
  const [qsName, setQsName] = useState('');
  const [qsContact, setQsContact] = useState('');
  const [qsPhone, setQsPhone] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setShowQuickSupplier(false);

    if (pendingReceipt) {
      setSupplierId(pendingReceipt.supplierId ?? '');
      setInvoiceNumber(pendingReceipt.referenceNumber);
      setReceivedDate(TODAY_ISO);
      setStorageLocation(pendingReceipt.storageLocation ?? '');
      setNotes(pendingReceipt.notes ?? '');
      setAttachmentName(pendingReceipt.attachmentName);
      setAttachmentDataUrl(pendingReceipt.attachmentDataUrl);
      setLines(
        pendingReceipt.lines.map((l, idx) => ({
          rowKey: `line-${Date.now()}-${idx}`,
          itemId: l.itemId,
          quantity: String(l.quantity),
          unitCost: String(l.unitCost),
          batchNumber: l.batchNumber ?? '',
          expiryDate: l.expiryDate ?? '',
        }))
      );
      return;
    }

    const targetItem =
      inventoryItems.find((i) => i.id === preselectedItemId) ?? inventoryItems[0];
    const resolvedSupId =
      preselectedSupplierId ?? targetItem?.supplierId ?? suppliers[0]?.id ?? '';

    setSupplierId(resolvedSupId);
    setInvoiceNumber('');
    setReceivedDate(TODAY_ISO);
    setStorageLocation(targetItem?.storageLocation ?? '');
    setNotes('');
    setAttachmentName(undefined);
    setAttachmentDataUrl(undefined);
    setLines(
      targetItem
        ? [
            {
              rowKey: `line-${Date.now()}`,
              itemId: targetItem.id,
              quantity: '',
              unitCost: String(targetItem.unitCost),
              batchNumber: '',
              expiryDate: targetItem.trackExpiry ? targetItem.expiryDate ?? '' : '',
            },
          ]
        : []
    );
  }, [open, preselectedItemId, preselectedSupplierId, pendingReceipt, inventoryItems, suppliers]);

  const totals = useMemo(() => {
    let totalLines = 0;
    let totalUnits = 0;
    let totalValue = 0;
    lines.forEach((l) => {
      const q = parseFloat(l.quantity);
      const c = parseFloat(l.unitCost);
      if (!isNaN(q) && q > 0) {
        totalLines += 1;
        totalUnits += q;
        if (!isNaN(c) && c >= 0) {
          totalValue += q * c;
        }
      }
    });
    return {
      totalLines,
      totalUnits: roundQty(totalUnits),
      totalValue: roundCurrency(totalValue),
    };
  }, [lines]);

  if (!open) return null;

  const handleSelectItemForLine = (rowKey: string, nextItemId: string) => {
    const item = inventoryItems.find((i) => i.id === nextItemId);
    setLines((prev) =>
      prev.map((l) =>
        l.rowKey === rowKey
          ? {
              ...l,
              itemId: nextItemId,
              unitCost: item ? String(item.unitCost) : l.unitCost,
              expiryDate: item?.trackExpiry ? item.expiryDate ?? '' : '',
            }
          : l
      )
    );
  };

  const handleAddLine = () => {
    const usedIds = new Set(lines.map((l) => l.itemId));
    const nextItem =
      inventoryItems.find((i) => !usedIds.has(i.id)) ?? inventoryItems[0];
    if (!nextItem) return;
    setLines((prev) => [
      ...prev,
      {
        rowKey: `line-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        itemId: nextItem.id,
        quantity: '',
        unitCost: String(nextItem.unitCost),
        batchNumber: '',
        expiryDate: nextItem.trackExpiry ? nextItem.expiryDate ?? '' : '',
      },
    ]);
  };

  const handleRemoveLine = (rowKey: string) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((l) => l.rowKey !== rowKey));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachmentDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQuickCreateSupplier = () => {
    if (!qsName.trim() || !qsPhone.trim()) {
      setError('Enter supplier name and phone number to quick-add.');
      return;
    }
    const created = addSupplier({
      name: qsName.trim(),
      contactPerson: qsContact.trim() || qsName.trim(),
      phone: qsPhone.trim(),
    });
    setSupplierId(created.id);
    setQsName('');
    setQsContact('');
    setQsPhone('');
    setShowQuickSupplier(false);
    setError('');
  };

  const validateAndBuildLines = () => {
    const selectedSup = suppliers.find((s) => s.id === supplierId);
    if (!selectedSup) {
      setError('Please select a Supplier for this stock receipt.');
      return null;
    }
    const parsedLines = lines
      .map((l) => {
        const item = inventoryItems.find((i) => i.id === l.itemId);
        const qty = parseFloat(l.quantity);
        const cost = parseFloat(l.unitCost || '0');
        return {
          item,
          itemId: l.itemId,
          quantity: roundQty(qty),
          unitCost: isNaN(cost) ? 0 : roundCurrency(cost),
          batchNumber: l.batchNumber.trim() || undefined,
          expiryDate: l.expiryDate || undefined,
        };
      })
      .filter((l) => l.item && !isNaN(l.quantity) && l.quantity > 0);

    if (parsedLines.length === 0) {
      setError('Enter a valid received quantity (> 0) for at least one item.');
      return null;
    }

    return { selectedSup, parsedLines };
  };

  const handleConfirmReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateAndBuildLines();
    if (!result) return;

    const ok = recordBatchStockIn({
      supplierId: result.selectedSup.id,
      supplierName: result.selectedSup.name,
      invoiceNumber,
      receivedDate,
      storageLocation,
      notes,
      attachmentName,
      attachmentDataUrl,
      pendingReceiptId: pendingReceipt?.id,
      lines: result.parsedLines.map((l) => ({
        itemId: l.itemId,
        quantity: l.quantity,
        unitCost: l.unitCost,
        batchNumber: l.batchNumber,
        expiryDate: l.expiryDate,
      })),
    });

    if (ok) onClose();
  };

  const handleSavePending = () => {
    const result = validateAndBuildLines();
    if (!result) return;

    savePendingReceipt({
      supplierId: result.selectedSup.id,
      supplierName: result.selectedSup.name,
      referenceNumber: invoiceNumber,
      expectedDate: receivedDate,
      storageLocation,
      notes,
      attachmentName,
      attachmentDataUrl,
      lines: result.parsedLines.map((l) => ({
        itemId: l.itemId,
        itemName: l.item!.name,
        unit: l.item!.unit,
        quantity: l.quantity,
        unitCost: l.unitCost,
        batchNumber: l.batchNumber,
        expiryDate: l.expiryDate,
      })),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] w-full max-w-5xl max-h-[92vh] flex flex-col shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#FAF9F5] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#DCFCE7] text-[#15803D] flex items-center justify-center shrink-0">
              <PackagePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#181210]">
                {pendingReceipt
                  ? `Receive Pending Movement (${pendingReceipt.referenceNumber})`
                  : 'Stock In — Multi-Item Supplier Receipt'}
              </h3>
              <p className="text-[12px] text-[#6B7280]">
                Log incoming supplier deliveries across multiple inventory items in a single invoice
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-white hover:text-[#181210] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="stock-in-form"
          onSubmit={handleConfirmReceipt}
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          {error && (
            <div className="px-4 py-2.5 rounded-lg bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-[12.5px] font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Supplier & Invoice Details */}
          <div className="rounded-xl border border-[#E5E7EB] bg-[#FAF9F5]/70 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5">
              <div>
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#181210]">
                  1. Supplier &amp; Invoice Details
                </h4>
                <p className="text-[11.5px] text-[#6B7280] mt-0.5">
                  Vendor billing reference, delivery date, storage destination, and invoice upload
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickSupplier((v) => !v)}
                className="px-2.5 py-1 rounded-md border border-[#FED7AA] bg-white text-[11.5px] font-semibold text-[#C2410C] hover:bg-[#FFF7ED] flex items-center gap-1 whitespace-nowrap transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {showQuickSupplier ? 'Cancel New Supplier' : 'New Supplier'}
              </button>
            </div>

            {showQuickSupplier && (
              <div className="p-3.5 rounded-lg bg-white border border-[#FED7AA] space-y-2.5">
                <p className="text-[11.5px] font-bold uppercase tracking-wider text-[#9A3412]">
                  Quick Add Supplier
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
                  <input
                    type="text"
                    value={qsName}
                    onChange={(e) => setQsName(e.target.value)}
                    placeholder="Supplier Business Name *"
                    className="w-full h-9 px-3 rounded-lg border border-[#D1D5DB] text-[12.5px] focus:outline-none focus:border-[#FB923C]"
                  />
                  <input
                    type="text"
                    value={qsContact}
                    onChange={(e) => setQsContact(e.target.value)}
                    placeholder="Contact Person"
                    className="w-full h-9 px-3 rounded-lg border border-[#D1D5DB] text-[12.5px] focus:outline-none focus:border-[#FB923C]"
                  />
                  <input
                    type="text"
                    value={qsPhone}
                    onChange={(e) => setQsPhone(e.target.value)}
                    placeholder="Phone Number *"
                    className="w-full h-9 px-3 rounded-lg border border-[#D1D5DB] text-[12.5px] tabular-nums focus:outline-none focus:border-[#FB923C]"
                  />
                  <button
                    type="button"
                    onClick={handleQuickCreateSupplier}
                    className="w-full h-9 px-3 rounded-lg bg-[#181210] text-white text-[12px] font-semibold hover:bg-[#2E2623] transition-colors"
                  >
                    Save &amp; Select Supplier
                  </button>
                </div>
              </div>
            )}

            {/* Row 1: Supplier, Invoice #, Date */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                  Supplier Name *
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] bg-white text-[13px] focus:outline-none focus:border-[#FB923C]"
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                  Supplier Invoice / Ref #
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g., INV-CC-4902"
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] bg-white text-[13px] font-mono focus:outline-none focus:border-[#FB923C]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                  Received Date *
                </label>
                <input
                  type="date"
                  required
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] bg-white text-[13px] tabular-nums focus:outline-none focus:border-[#FB923C]"
                />
              </div>
            </div>

            {/* Row 2: Storage Location, Invoice Attachment, Receiving Notes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                  Storage Location
                </label>
                <input
                  type="text"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  placeholder="e.g., Dry Store Rack R1"
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] bg-white text-[13px] focus:outline-none focus:border-[#FB923C]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                  Supplier Invoice Attachment
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 h-10 cursor-pointer px-3 rounded-lg border border-dashed border-[#D1D5DB] bg-white hover:border-[#FB923C] text-[12.5px] text-[#374151] font-medium flex items-center gap-2 truncate transition-colors">
                    <Upload className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                    <span className="truncate">
                      {attachmentName ? attachmentName : 'Upload Invoice / PDF'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  {attachmentName && (
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentName(undefined);
                        setAttachmentDataUrl(undefined);
                      }}
                      className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#B91C1C]"
                      title="Remove attachment"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                  Receiving Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Quality check passed, cold chain intact..."
                  className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] bg-white text-[13px] focus:outline-none focus:border-[#FB923C]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Received Items & Stock Entry */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#181210]">
                  2. Received Items &amp; Stock Entry ({lines.length})
                </h4>
                <p className="text-[11.5px] text-[#6B7280] mt-0.5">
                  Enter received quantities, unit purchase rates, batch numbers, and expiry dates
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddLine}
                className="px-3.5 py-2 rounded-lg border border-[#D1D5DB] bg-white hover:bg-[#FAF9F5] text-[12px] font-semibold text-[#181210] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Plus className="w-3.5 h-3.5 text-[#FB923C]" />
                Add Item Line
              </button>
            </div>

            <div className="border border-[#E5E7EB] rounded-xl overflow-x-auto bg-white">
              <table className="w-full text-left border-collapse min-w-[820px]">
                <thead>
                  <tr className="bg-[#FAF9F5] border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                    <th className="py-3 pl-4 pr-2.5 w-[28%]">Inventory Item</th>
                    <th className="py-3 px-2 w-[12%]">Qty Received</th>
                    <th className="py-3 px-2 w-[7%]">Unit</th>
                    <th className="py-3 px-2 w-[12%]">Unit Price (₹)</th>
                    <th className="py-3 px-2.5 w-[11%] text-right">Line Total</th>
                    <th className="py-3 px-2 w-[12%]">Batch #</th>
                    <th className="py-3 px-2 w-[14%]">Expiry Date</th>
                    <th className="py-3 pl-1 pr-3 w-[4%] text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6] text-[12.5px]">
                  {lines.map((line) => {
                    const selectedItem = inventoryItems.find((i) => i.id === line.itemId);
                    const qtyNum = parseFloat(line.quantity || '0');
                    const costNum = parseFloat(line.unitCost || '0');
                    const lineTotal =
                      !isNaN(qtyNum) && !isNaN(costNum) && qtyNum > 0
                        ? qtyNum * costNum
                        : 0;

                    return (
                      <tr key={line.rowKey} className="hover:bg-[#FAF9F5]/60">
                        <td className="py-2.5 pl-4 pr-2.5">
                          <select
                            value={line.itemId}
                            onChange={(e) =>
                              handleSelectItemForLine(line.rowKey, e.target.value)
                            }
                            className="w-full h-9 px-2.5 rounded-lg border border-[#D1D5DB] bg-white text-[12.5px] font-medium focus:outline-none focus:border-[#FB923C]"
                          >
                            {inventoryItems.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} ({item.sku})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            placeholder="0"
                            value={line.quantity}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.rowKey === line.rowKey
                                    ? { ...l, quantity: e.target.value }
                                    : l
                                )
                              )
                            }
                            className="w-full h-9 px-2.5 rounded-lg border border-[#D1D5DB] text-[12.5px] tabular-nums focus:outline-none focus:border-[#FB923C]"
                          />
                        </td>
                        <td className="py-2.5 px-2 text-[#4B5563] font-semibold">
                          {selectedItem?.unit ?? '-'}
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.unitCost}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.rowKey === line.rowKey
                                    ? { ...l, unitCost: e.target.value }
                                    : l
                                )
                              )
                            }
                            className="w-full h-9 px-2.5 rounded-lg border border-[#D1D5DB] text-[12.5px] tabular-nums focus:outline-none focus:border-[#FB923C]"
                          />
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-bold text-[#181210] tabular-nums whitespace-nowrap">
                          {formatINRCompact(lineTotal)}
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="text"
                            placeholder="Batch #"
                            value={line.batchNumber}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.rowKey === line.rowKey
                                    ? { ...l, batchNumber: e.target.value }
                                    : l
                                )
                              )
                            }
                            className="w-full h-9 px-2.5 rounded-lg border border-[#D1D5DB] text-[12px] font-mono focus:outline-none focus:border-[#FB923C]"
                          />
                        </td>
                        <td className="py-2.5 px-2">
                          <input
                            type="date"
                            disabled={!selectedItem?.trackExpiry}
                            value={line.expiryDate}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.rowKey === line.rowKey
                                    ? { ...l, expiryDate: e.target.value }
                                    : l
                                )
                              )
                            }
                            className="w-full h-9 px-2.5 rounded-lg border border-[#D1D5DB] text-[12px] tabular-nums disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] focus:outline-none focus:border-[#FB923C]"
                          />
                        </td>
                        <td className="py-2.5 pl-1 pr-3 text-center">
                          <button
                            type="button"
                            disabled={lines.length <= 1}
                            onClick={() => handleRemoveLine(line.rowKey)}
                            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#B91C1C] hover:bg-[#FEE2E2]/40 disabled:opacity-30 transition-colors"
                            title="Remove line"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </form>

        {/* Pinned Bottom Summary & Actions Footer */}
        <div className="px-6 py-4 border-t border-[#E5E7EB] bg-[#FAF9F5] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                Valid Items
              </p>
              <p className="text-[14px] font-bold text-[#181210] tabular-nums">
                {totals.totalLines} {totals.totalLines === 1 ? 'item' : 'items'}
              </p>
            </div>
            <div className="h-7 w-px bg-[#E5E7EB] hidden sm:block" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                Total Quantity
              </p>
              <p className="text-[14px] font-bold text-[#181210] tabular-nums">
                {formatDecimal(totals.totalUnits, 3)} units
              </p>
            </div>
            <div className="h-7 w-px bg-[#E5E7EB] hidden sm:block" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                Total Purchase Value
              </p>
              <p className="text-[16px] font-bold text-[#15803D] tabular-nums">
                {formatINRCompact(totals.totalValue)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#D1D5DB] bg-white text-[13px] font-semibold text-[#374151] hover:bg-[#F3F4F6] transition-colors"
            >
              Cancel
            </button>
            {!pendingReceipt && (
              <button
                type="button"
                onClick={handleSavePending}
                className="px-4 py-2 rounded-lg border border-[#181210] bg-white text-[#181210] text-[13px] font-semibold hover:bg-[#F3F4F6] transition-colors"
              >
                Save as Pending
              </button>
            )}
            <button
              type="submit"
              form="stock-in-form"
              className="px-5 py-2 rounded-lg bg-[#15803D] text-white text-[13px] font-semibold hover:bg-[#166534] transition-colors flex items-center gap-1.5"
            >
              <PackageCheck className="w-4 h-4" />
              Confirm &amp; Receive Stock
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. Dedicated Stock Out Modal
// ============================================================================
interface StockOutModalProps {
  open: boolean;
  preselectedItemId?: string;
  preselectedReason?: string;
  onClose: () => void;
}

export const StockOutModal: React.FC<StockOutModalProps> = ({
  open,
  preselectedItemId,
  preselectedReason,
  onClose,
}) => {
  const { inventoryItems, recordStockOut } = usePos();

  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState(STOCK_OUT_REASONS[0]);
  const [date, setDate] = useState(TODAY_ISO);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    const target =
      inventoryItems.find((i) => i.id === preselectedItemId) ??
      inventoryItems.find((i) => i.quantity > 0) ??
      inventoryItems[0];
    setItemId(target?.id ?? '');
    setQty('');
    setReason(preselectedReason || STOCK_OUT_REASONS[0]);
    setDate(TODAY_ISO);
    setNotes('');
  }, [open, preselectedItemId, preselectedReason, inventoryItems]);

  if (!open) return null;

  const selectedItem = inventoryItems.find((i) => i.id === itemId);
  const qtyNum = parseFloat(qty || '0');
  const remainingAfter = selectedItem
    ? roundQty(selectedItem.quantity - (isNaN(qtyNum) ? 0 : qtyNum))
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError('Enter a valid quantity greater than zero.');
      return;
    }
    if (qtyNum > selectedItem.quantity) {
      setError(
        `Cannot remove ${formatDecimal(qtyNum, 3)} ${selectedItem.unit}. Only ${formatDecimal(selectedItem.quantity, 3)} ${selectedItem.unit} available.`
      );
      return;
    }
    const ok = recordStockOut({
      itemId: selectedItem.id,
      quantity: roundQty(qtyNum),
      reason,
      date,
      notes,
    });
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] w-full max-w-lg shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#FAF9F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFEDD5] text-[#C2410C] flex items-center justify-center">
              <PackageMinus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#181210]">
                Stock Out — Issue or Remove Stock
              </h3>
              <p className="text-[12px] text-[#6B7280]">
                Record kitchen usage, counter issue, wastage, or expired disposal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-white hover:text-[#181210]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-3.5 py-2.5 rounded-lg bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-[12.5px] font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1">
              Inventory Item *
            </label>
            <select
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                setError('');
              }}
              className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] bg-white text-[13px] focus:outline-none focus:border-[#FB923C]"
            >
              {inventoryItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.sku})
                </option>
              ))}
            </select>
          </div>

          {selectedItem && (
            <div className="p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E5E7EB] flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                  Available Stock Quantity
                </p>
                <p className="text-[18px] font-bold text-[#181210] tabular-nums mt-0.5">
                  {formatStockQty(selectedItem.quantity, selectedItem.unit)}
                </p>
              </div>
              <div className="text-right text-[12px] text-[#6B7280]">
                <p>
                  Min Level:{' '}
                  <span className="font-semibold text-[#181210] tabular-nums">
                    {formatDecimal(selectedItem.minStockLevel, 3)} {selectedItem.unit}
                  </span>
                </p>
                {selectedItem.storageLocation && (
                  <p className="truncate max-w-[180px]">{selectedItem.storageLocation}</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                Quantity to Remove ({selectedItem?.unit ?? ''}) *
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                max={selectedItem?.quantity}
                required
                value={qty}
                onChange={(e) => {
                  setQty(e.target.value);
                  setError('');
                }}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] tabular-nums focus:outline-none focus:border-[#FB923C]"
              />
              {selectedItem && !isNaN(qtyNum) && qtyNum > 0 && qtyNum <= selectedItem.quantity && (
                <p
                  className={`text-[11.5px] mt-1 font-medium tabular-nums ${
                    remainingAfter <= selectedItem.minStockLevel
                      ? 'text-[#C2410C]'
                      : 'text-[#6B7280]'
                  }`}
                >
                  Remaining after issue: {formatDecimal(remainingAfter, 3)} {selectedItem.unit}
                  {remainingAfter <= 0
                    ? ' (Out of Stock)'
                    : remainingAfter <= selectedItem.minStockLevel
                    ? ' (Low Stock)'
                    : ''}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] tabular-nums focus:outline-none focus:border-[#FB923C]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1">
              Reason for Stock Out *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] bg-white text-[13px] focus:outline-none focus:border-[#FB923C]"
            >
              {STOCK_OUT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Kitchen shift, batch notes, or damage remarks..."
              className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] focus:outline-none focus:border-[#FB923C] resize-none"
            />
          </div>

          <div className="pt-2 border-t border-[#E5E7EB] flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#D1D5DB] text-[13px] font-semibold text-[#374151] hover:bg-[#FAF9F5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedItem || selectedItem.quantity <= 0}
              className="px-5 py-2 rounded-lg bg-[#EA580C] text-white text-[13px] font-semibold hover:bg-[#C2410C] disabled:opacity-40 transition-colors"
            >
              Confirm Stock Out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 4. Dedicated Stock Adjustment Modal
// ============================================================================
interface StockAdjustmentModalProps {
  open: boolean;
  preselectedItemId?: string;
  onClose: () => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  open,
  preselectedItemId,
  onClose,
}) => {
  const { inventoryItems, recordInventoryAdjustment } = usePos();

  const [itemId, setItemId] = useState('');
  const [adjustedQty, setAdjustedQty] = useState('');
  const [reason, setReason] = useState(ADJUSTMENT_REASONS[0]);
  const [date, setDate] = useState(TODAY_ISO);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    const target =
      inventoryItems.find((i) => i.id === preselectedItemId) ?? inventoryItems[0];
    setItemId(target?.id ?? '');
    setAdjustedQty(target ? String(target.quantity) : '0');
    setReason(ADJUSTMENT_REASONS[0]);
    setDate(TODAY_ISO);
    setNotes('');
  }, [open, preselectedItemId, inventoryItems]);

  if (!open) return null;

  const selectedItem = inventoryItems.find((i) => i.id === itemId);
  const newQtyNum = parseFloat(adjustedQty);
  const delta =
    selectedItem && !isNaN(newQtyNum)
      ? roundQty(newQtyNum - selectedItem.quantity)
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (isNaN(newQtyNum) || newQtyNum < 0) {
      setError('Adjusted stock quantity must be 0 or higher.');
      return;
    }
    if (delta === 0) {
      setError('Adjusted quantity matches current stock. Change the quantity to record an adjustment.');
      return;
    }
    const ok = recordInventoryAdjustment({
      itemId: selectedItem.id,
      newQuantity: roundQty(newQtyNum),
      reason,
      date,
      notes,
    });
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] w-full max-w-lg shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#FAF9F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#181210] text-white flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#181210]">
                Stock Adjustment — Audit Reconciliation
              </h3>
              <p className="text-[12px] text-[#6B7280]">
                Correct recorded stock levels against physical store-room counts
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-white hover:text-[#181210]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-3.5 py-2.5 rounded-lg bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-[12.5px] font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1">
              Inventory Item *
            </label>
            <select
              value={itemId}
              onChange={(e) => {
                const next = inventoryItems.find((i) => i.id === e.target.value);
                setItemId(e.target.value);
                setAdjustedQty(next ? String(next.quantity) : '0');
                setError('');
              }}
              className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] bg-white text-[13px] focus:outline-none focus:border-[#FB923C]"
            >
              {inventoryItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.sku})
                </option>
              ))}
            </select>
          </div>

          {selectedItem && (
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-[#FAF9F5] border border-[#E5E7EB]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                  Current Stock
                </p>
                <p className="text-[15px] font-bold text-[#181210] tabular-nums mt-0.5">
                  {formatStockQty(selectedItem.quantity, selectedItem.unit)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                  Adjusted Stock
                </p>
                <p className="text-[15px] font-bold text-[#181210] tabular-nums mt-0.5">
                  {!isNaN(newQtyNum) && newQtyNum >= 0
                    ? formatStockQty(newQtyNum, selectedItem.unit)
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                  Difference
                </p>
                <p
                  className={`text-[15px] font-bold tabular-nums mt-0.5 ${
                    delta > 0
                      ? 'text-[#15803D]'
                      : delta < 0
                      ? 'text-[#B91C1C]'
                      : 'text-[#6B7280]'
                  }`}
                >
                  {delta > 0
                    ? `+${formatDecimal(delta, 3)}`
                    : delta < 0
                    ? `-${formatDecimal(Math.abs(delta), 3)}`
                    : '0'}{' '}
                  {selectedItem.unit}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                Adjusted Stock ({selectedItem?.unit ?? ''}) *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={adjustedQty}
                onChange={(e) => {
                  setAdjustedQty(e.target.value);
                  setError('');
                }}
                className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] tabular-nums focus:outline-none focus:border-[#FB923C]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                Updated Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] tabular-nums focus:outline-none focus:border-[#FB923C]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1">
              Reason for Adjustment *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] bg-white text-[13px] focus:outline-none focus:border-[#FB923C]"
            >
              {ADJUSTMENT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Audit findings or manager sign-off note..."
              className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] focus:outline-none focus:border-[#FB923C] resize-none"
            />
          </div>

          <div className="pt-2 border-t border-[#E5E7EB] flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#D1D5DB] text-[13px] font-semibold text-[#374151] hover:bg-[#FAF9F5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#181210] text-white text-[13px] font-semibold hover:bg-[#2E2623] transition-colors"
            >
              Apply Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 5. Add / Edit Supplier Modal
// ============================================================================
interface SupplierFormModalProps {
  open: boolean;
  editingSupplier: Supplier | null;
  onClose: () => void;
}

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  open,
  editingSupplier,
  onClose,
}) => {
  const { addSupplier, updateSupplier } = usePos();

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editingSupplier) {
      setName(editingSupplier.name);
      setContactPerson(editingSupplier.contactPerson);
      setPhone(editingSupplier.phone);
      setEmail(editingSupplier.email ?? '');
      setAddress(editingSupplier.address ?? '');
      setNotes(editingSupplier.notes ?? '');
    } else {
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNotes('');
    }
  }, [open, editingSupplier]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Supplier Name is required.');
      return;
    }
    if (!contactPerson.trim()) {
      setError('Contact Person is required.');
      return;
    }
    if (!phone.trim()) {
      setError('Phone Number is required.');
      return;
    }

    if (editingSupplier) {
      updateSupplier({
        ...editingSupplier,
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } else {
      addSupplier({
        name: name.trim(),
        contactPerson: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] w-full max-w-lg shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#FAF9F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#181210] text-white flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-[#181210]">
                {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
              </h3>
              <p className="text-[12px] text-[#6B7280]">
                Maintain supplier directory, billing contacts, and delivery terms
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-white hover:text-[#181210]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-3.5 py-2.5 rounded-lg bg-[#FEE2E2] border border-[#FECACA] text-[#B91C1C] text-[12.5px] font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1">
              Supplier Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Golden Crest Packaging Pvt Ltd"
              className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] focus:outline-none focus:border-[#FB923C]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                Contact Person *
              </label>
              <input
                type="text"
                required
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Account manager / dispatcher"
                className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] focus:outline-none focus:border-[#FB923C]"
              />
            </div>

            <div>
              <label className="block text-[12px] font-semibold text-[#374151] mb-1">
                Phone Number *
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98XXX XXXXX"
                className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] tabular-nums focus:outline-none focus:border-[#FB923C]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="orders@supplier.com"
              className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] focus:outline-none focus:border-[#FB923C]"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1">
              Address
            </label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Warehouse / dispatch hub address"
              className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] focus:outline-none focus:border-[#FB923C] resize-none"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery schedule, payment credit terms, minimum order qty..."
              className="w-full px-3 py-2 rounded-lg border border-[#D1D5DB] text-[13px] focus:outline-none focus:border-[#FB923C] resize-none"
            />
          </div>

          <div className="pt-2 border-t border-[#E5E7EB] flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#D1D5DB] text-[13px] font-semibold text-[#374151] hover:bg-[#FAF9F5]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#FB923C] text-white text-[13px] font-semibold hover:bg-[#EA580C] transition-colors"
            >
              {editingSupplier ? 'Save Supplier Changes' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 6. Invoice Attachment Preview Modal (for Transaction History)
// ============================================================================
interface AttachmentPreviewModalProps {
  attachment: { name: string; dataUrl?: string; ref?: string } | null;
  onClose: () => void;
}

export const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({
  attachment,
  onClose,
}) => {
  if (!attachment) return null;
  const isImage =
    attachment.dataUrl?.startsWith('data:image/') ||
    /\.(png|jpe?g|webp|gif)$/i.test(attachment.name);

  return (
    <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] w-full max-w-xl shadow-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between bg-[#FAF9F5]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C2410C]" />
            <div>
              <h3 className="text-[14px] font-bold text-[#181210]">{attachment.name}</h3>
              {attachment.ref && (
                <p className="text-[11.5px] text-[#6B7280] font-mono">Ref: {attachment.ref}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-white hover:text-[#181210]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col items-center justify-center bg-[#FAF9F5]/40 min-h-[240px]">
          {attachment.dataUrl && isImage ? (
            <img
              src={attachment.dataUrl}
              alt={attachment.name}
              className="max-h-[420px] rounded-lg border border-[#E5E7EB] object-contain"
            />
          ) : (
            <div className="text-center space-y-3 py-6">
              <FileText className="w-10 h-10 text-[#9CA3AF] mx-auto" />
              <p className="text-[13px] font-semibold text-[#181210]">{attachment.name}</p>
              {attachment.dataUrl && (
                <a
                  href={attachment.dataUrl}
                  download={attachment.name}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#181210] text-white text-[12.5px] font-semibold hover:bg-[#2E2623]"
                >
                  Download Attachment
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
