import React, { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Download,
  Pencil,
  Trash2,
  Power,
  X,
  ChevronLeft,
  ChevronRight,
  Upload,
  Sparkles,
} from 'lucide-react';
import { usePos } from '../../context/PosContext';
import { ProductThumb } from '../common/ProductThumb';
import { CategoryIcon } from '../../utils/categoryIcons';
import { GstTreatment, Product, ProductVariant, UnitType } from '../../types/pos';
import { PRODUCT_IMAGE_LIBRARY } from '../../data/seedData';
import {
  exportToCsv,
  formatINRCompact,
  formatStockQty,
  roundCurrency,
  roundPercent,
  roundQty,
  roundWeightGrams,
} from '../../utils/formatters';

const PAGE_SIZE = 8;

export const MenusView: React.FC = () => {
  const {
    categories,
    addCategory,
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProductActive,
    getProductStock,
    getVariantStock,
    getVariantUnitLabel,
    getVariantMinStock,
    getProductDefaultVariant,
    globalSearch,
    settings,
    pushToast,
    hasPermission,
  } = usePos();

  const canCreate = hasPermission('menus', 'create');
  const canEdit = hasPermission('menus', 'edit');
  const canDelete = hasPermission('menus', 'delete');

  const visibleCategories = useMemo(
    () => categories.filter((c) => !c.name.toLowerCase().includes('combo')),
    [categories]
  );

  const [selectedCatId, setSelectedCatId] = useState<string>(visibleCategories[0]?.id ?? 'all');
  const [selectedSubGroup, setSelectedSubGroup] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<'all' | UnitType>('all');
  const [page, setPage] = useState(1);

  // Modals
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Product Form State
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formCatId, setFormCatId] = useState(visibleCategories[0]?.id ?? '');
  const [formSubGroup, setFormSubGroup] = useState('');
  const [formUnitType, setFormUnitType] = useState<UnitType>('piece');
  const [formBaseUnit, setFormBaseUnit] = useState('pc');
  const [formPricePerKg, setFormPricePerKg] = useState('800');
  const [formDefaultWeightGrams, setFormDefaultWeightGrams] = useState('500');
  const [formAllowCustomWeight, setFormAllowCustomWeight] = useState(true);
  const [formTaxRate, setFormTaxRate] = useState(String(settings.defaultTaxRate));
  const [formGstTreatment, setFormGstTreatment] = useState<GstTreatment>('Taxable');
  const [formMinStock, setFormMinStock] = useState(String(settings.lowStockThresholdDefault));
  const [formTrackExpiry, setFormTrackExpiry] = useState(true);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formImageUrl, setFormImageUrl] = useState(PRODUCT_IMAGE_LIBRARY[0].url);
  const [photoSourceMode, setPhotoSourceMode] = useState<'upload' | 'ai' | 'preset'>('preset');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formVariants, setFormVariants] = useState<ProductVariant[]>([
    { id: 'v-new-1', label: 'Per Piece', price: 120, skuSuffix: '1PC' },
  ]);

  const activeCategoryObj = visibleCategories.find((c) => c.id === selectedCatId) ?? null;

  const subGroups = useMemo(() => {
    const relevant =
      selectedCatId === 'all'
        ? products
        : products.filter((p) => p.categoryId === selectedCatId);
    const map = new Map<string, number>();
    relevant.forEach((p) => {
      map.set(p.subGroup, (map.get(p.subGroup) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [products, selectedCatId]);

  const filteredProducts = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCatId !== 'all' && p.categoryId !== selectedCatId) return false;
      if (selectedSubGroup !== 'all' && p.subGroup !== selectedSubGroup) return false;
      if (unitFilter !== 'all' && p.unitType !== unitFilter) return false;
      if (q) {
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.subGroup.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, selectedCatId, selectedSubGroup, unitFilter, globalSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const pagedProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openAddProductInCategory = (targetCategoryId?: string) => {
    const resolvedCatId =
      targetCategoryId && targetCategoryId !== 'all'
        ? targetCategoryId
        : selectedCatId !== 'all'
        ? selectedCatId
        : visibleCategories[0]?.id ?? '';
    setEditingProduct(null);
    setFormName('');
    setFormSku(`BK-${Math.floor(100 + Math.random() * 899)}`);
    setFormCatId(resolvedCatId);
    setFormSubGroup(
      selectedSubGroup !== 'all' ? selectedSubGroup : 'Counter Specials'
    );
    setFormUnitType('piece');
    setFormBaseUnit('pc');
    setFormPricePerKg('900');
    setFormDefaultWeightGrams('500');
    setFormAllowCustomWeight(true);
    setFormTaxRate(String(settings.defaultTaxRate));
    setFormGstTreatment('Taxable');
    setFormMinStock(String(settings.lowStockThresholdDefault));
    setFormTrackExpiry(true);
    setFormIsActive(true);
    setFormImageUrl(PRODUCT_IMAGE_LIBRARY[0].url);
    setPhotoSourceMode('preset');
    setUploadedFileName(null);
    setFormVariants([
      {
        id: `v-${Date.now()}`,
        label: 'Per Piece',
        price: 150,
        skuSuffix: '1PC',
        unitLabel: 'pc',
        minStockAlert: settings.lowStockThresholdDefault,
        isDefault: true,
      },
    ]);
    setShowProductModal(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormSku(p.sku);
    setFormCatId(p.categoryId);
    setFormSubGroup(p.subGroup);
    setFormUnitType(p.unitType);
    setFormBaseUnit(p.baseUnitLabel);
    setFormPricePerKg(String(p.pricePerKg ?? 800));
    setFormDefaultWeightGrams(
      String(p.defaultWeightGrams ?? p.variants.find((v) => v.weightGrams)?.weightGrams ?? 500)
    );
    setFormAllowCustomWeight(p.unitType === 'weight' ? p.allowCustomWeight ?? true : false);
    setFormTaxRate(String(p.taxRate));
    setFormGstTreatment(
      p.gstTreatment ?? (p.taxRate === 0 ? 'Nil-Rated' : 'Taxable')
    );
    setFormMinStock(String(p.minStockAlert));
    setFormTrackExpiry(p.trackExpiry);
    setFormIsActive(p.isActive);
    setFormImageUrl(p.imageUrl);
    setPhotoSourceMode(p.imageUrl.startsWith('data:') ? 'upload' : 'preset');
    setUploadedFileName(p.imageUrl.startsWith('data:') ? 'Uploaded image' : null);
    setFormVariants(p.variants.map((v) => ({ ...v })));
    setShowProductModal(true);
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      pushToast('Please select a valid image file (PNG, JPG, or WEBP).', 'error');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      pushToast('Image file must be under 4 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormImageUrl(reader.result);
        setPhotoSourceMode('upload');
        setUploadedFileName(file.name);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUnitTypeChange = (ut: UnitType) => {
    setFormUnitType(ut);
    if (ut === 'weight') {
      setFormBaseUnit('kg');
      setFormAllowCustomWeight(true);
      if (!editingProduct) {
        const rate = roundCurrency(Math.max(0, Number(formPricePerKg) || 900));
        setFormVariants([
          {
            id: `v-${Date.now()}-1`,
            label: '250g',
            weightGrams: 250,
            price: roundCurrency((rate * 250) / 1000),
            skuSuffix: '250G',
            unitLabel: 'pcs',
            minStockAlert: Number(formMinStock) || settings.lowStockThresholdDefault,
          },
          {
            id: `v-${Date.now()}-2`,
            label: '500g',
            weightGrams: 500,
            price: roundCurrency((rate * 500) / 1000),
            skuSuffix: '500G',
            unitLabel: 'pcs',
            minStockAlert: Number(formMinStock) || settings.lowStockThresholdDefault,
            isDefault: true,
          },
          {
            id: `v-${Date.now()}-3`,
            label: '1 kg',
            weightGrams: 1000,
            price: rate,
            skuSuffix: '1KG',
            unitLabel: 'pcs',
            minStockAlert: Number(formMinStock) || settings.lowStockThresholdDefault,
          },
        ]);
      }
    } else if (ut === 'box') {
      setFormBaseUnit('box');
      setFormAllowCustomWeight(false);
      if (!editingProduct) {
        setFormVariants([
          {
            id: `v-${Date.now()}`,
            label: '500g Gift Box',
            price: 650,
            skuSuffix: 'BOX',
            unitLabel: 'box',
            minStockAlert: Number(formMinStock) || settings.lowStockThresholdDefault,
            isDefault: true,
          },
        ]);
      }
    } else {
      setFormBaseUnit('pc');
      setFormAllowCustomWeight(false);
      if (!editingProduct) {
        setFormVariants([
          {
            id: `v-${Date.now()}`,
            label: 'Per Piece',
            price: 120,
            skuSuffix: '1PC',
            unitLabel: 'pc',
            minStockAlert: Number(formMinStock) || settings.lowStockThresholdDefault,
            isDefault: true,
          },
        ]);
      }
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSku.trim() || formVariants.length === 0) return;

    const fallbackMin = roundQty(Math.max(0, Number(formMinStock) || 0));
    const hasExplicitDefault = formVariants.some((v) => v.isDefault);
    const normalizedVariants: ProductVariant[] = formVariants.map((v, idx) => ({
      ...v,
      price: roundCurrency(Math.max(0, v.price)),
      weightGrams:
        v.weightGrams !== undefined && Number.isFinite(v.weightGrams)
          ? roundWeightGrams(v.weightGrams)
          : undefined,
      unitLabel:
        v.unitLabel?.trim() || (formUnitType === 'weight' ? 'pcs' : formBaseUnit),
      minStockAlert:
        v.minStockAlert !== undefined && Number.isFinite(v.minStockAlert)
          ? roundQty(Math.max(0, v.minStockAlert))
          : fallbackMin,
      isDefault: hasExplicitDefault ? Boolean(v.isDefault) : idx === 0,
    }));

    const defaultVar = normalizedVariants.find((v) => v.isDefault) ?? normalizedVariants[0];

    const payload: Omit<Product, 'id'> = {
      name: formName.trim(),
      sku: formSku.trim().toUpperCase(),
      categoryId: formCatId,
      subGroup: formSubGroup.trim() || 'Bakery Specials',
      unitType: formUnitType,
      baseUnitLabel: formBaseUnit,
      pricePerKg:
        formUnitType === 'weight'
          ? roundCurrency(Math.max(0, Number(formPricePerKg) || 800))
          : undefined,
      defaultWeightGrams:
        formUnitType === 'weight'
          ? Math.max(
              0.1,
              roundWeightGrams(
                defaultVar?.weightGrams ?? (Number(formDefaultWeightGrams) || 500)
              )
            )
          : undefined,
      allowCustomWeight: formUnitType === 'weight' ? formAllowCustomWeight : undefined,
      variants: normalizedVariants,
      taxRate:
        formGstTreatment === 'Taxable'
          ? roundPercent(Math.max(0, Number(formTaxRate) || 0))
          : 0,
      gstTreatment:
        formGstTreatment !== 'Taxable'
          ? formGstTreatment
          : (Number(formTaxRate) || 0) === 0
          ? 'Nil-Rated'
          : 'Taxable',
      imageUrl: formImageUrl,
      isFavourite: editingProduct?.isFavourite ?? false,
      isActive: formIsActive,
      minStockAlert: roundQty(Math.max(0, Number(formMinStock) || 0)),
      shelfLifeDays: editingProduct?.shelfLifeDays ?? 3,
      batchExpiryDate: editingProduct?.batchExpiryDate,
      trackExpiry: formTrackExpiry,
    };

    if (editingProduct) {
      updateProduct({ ...payload, id: editingProduct.id });
    } else {
      addProduct(payload);
    }
    setShowProductModal(false);
  };

  const handleExport = () => {
    exportToCsv(
      'bakecore_menus_catalog.csv',
      ['SKU', 'Product Name', 'Category', 'Sub-Group', 'Unit Type', 'Base Price', 'Stock', 'Status'],
      filteredProducts.map((p) => {
        const cat = categories.find((c) => c.id === p.categoryId)?.name ?? '';
        const stock = getProductStock(p.id);
        return [
          p.sku,
          p.name,
          cat,
          p.subGroup,
          p.unitType,
          roundCurrency(p.variants[0]?.price ?? 0).toFixed(2),
          formatStockQty(stock, p.baseUnitLabel),
          p.isActive ? 'Available' : 'Inactive',
        ];
      })
    );
  };

  return (
    <div className="p-5 space-y-5 bg-[#E0E2E7] min-h-[calc(100vh-61px)]">
      {/* Top Product Category Groups Strip (Requirement C) */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#181210]">Menu Categories</h2>
            <p className="text-[12px] text-[#64748B]">
              Select a category group below to view and manage its menu items
            </p>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => setShowCatModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-[#FAF9F5] hover:bg-white text-[12px] font-semibold text-[#181210] whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#FB923C]" />
              New Category
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <button
            type="button"
            onClick={() => {
              setSelectedCatId('all');
              setSelectedSubGroup('all');
              setPage(1);
            }}
            className={`p-3 rounded-lg border text-left transition-colors flex flex-col justify-between gap-2 ${
              selectedCatId === 'all'
                ? 'bg-[#FB923C] border-[#FB923C] text-white'
                : 'bg-[#FAF9F5] border-[#E5E7EB] hover:border-[#FB923C]/60 text-[#181210]'
            }`}
          >
            <div className="flex items-center justify-between">
              <CategoryIcon
                category="all"
                className={`w-4 h-4 ${selectedCatId === 'all' ? 'text-white' : 'text-[#FB923C]'}`}
              />
              <span
                className={`text-[11px] font-semibold tabular-nums ${
                  selectedCatId === 'all' ? 'text-white/90' : 'text-[#64748B]'
                }`}
              >
                {products.length}
              </span>
            </div>
            <div className="text-[12px] font-semibold leading-tight truncate">All Categories</div>
          </button>

          {visibleCategories.map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id).length;
            const active = selectedCatId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedCatId(cat.id);
                  setSelectedSubGroup('all');
                  setPage(1);
                }}
                className={`p-3 rounded-lg border text-left transition-colors flex flex-col justify-between gap-2 ${
                  active
                    ? 'bg-[#FB923C] border-[#FB923C] text-white'
                    : 'bg-[#FAF9F5] border-[#E5E7EB] hover:border-[#FB923C]/60 text-[#181210]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <CategoryIcon
                    category={cat.name}
                    className={`w-4 h-4 ${active ? 'text-white' : 'text-[#FB923C]'}`}
                  />
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${
                      active ? 'text-white/90' : 'text-[#64748B]'
                    }`}
                  >
                    {count}
                  </span>
                </div>
                <div className="text-[12px] font-semibold leading-tight truncate">{cat.name}</div>
              </button>
            );
          })}
        </div>

        {/* Sub-Groups inside selected category */}
        {subGroups.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#E5E7EB] flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-semibold text-[#64748B] shrink-0">Sub-Groups:</span>
            <button
              type="button"
              onClick={() => {
                setSelectedSubGroup('all');
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap ${
                selectedSubGroup === 'all'
                  ? 'bg-[#181210] text-white'
                  : 'bg-[#FAF9F5] border border-[#E5E7EB] text-[#181210] hover:bg-white'
              }`}
            >
              All ({subGroups.reduce((s, g) => s + g.count, 0)})
            </button>
            {subGroups.map((sg) => (
              <button
                key={sg.name}
                type="button"
                onClick={() => {
                  setSelectedSubGroup(sg.name);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap ${
                  selectedSubGroup === sg.name
                    ? 'bg-[#181210] text-white'
                    : 'bg-[#FAF9F5] border border-[#E5E7EB] text-[#181210] hover:bg-white'
                }`}
              >
                {sg.name} ({sg.count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category Products Table Card (Add Product lives here inside the table section) */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CategoryIcon
              category={activeCategoryObj?.name ?? 'all'}
              className="w-4.5 h-4.5 text-[#FB923C]"
            />
            <h2 className="text-[15px] font-semibold text-[#181210]">
              {activeCategoryObj ? activeCategoryObj.name : 'All Menu Products'}
            </h2>
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-[#FAF9F5] border border-[#E5E7EB] text-[#64748B] tabular-nums">
              {filteredProducts.length} items
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={unitFilter}
              onChange={(e) => {
                setUnitFilter(e.target.value as 'all' | UnitType);
                setPage(1);
              }}
              className="px-3 py-1.5 text-[12px] font-medium border border-[#E5E7EB] rounded-md bg-white text-[#181210] focus:outline-none focus:border-[#FB923C]"
              aria-label="Filter by unit type"
            >
              <option value="all">All Unit Types</option>
              <option value="weight">Sold by Weight (kg/g)</option>
              <option value="piece">Sold by Piece</option>
              <option value="box">Gift Boxes / Packs</option>
            </select>

            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium border border-[#E5E7EB] rounded-md text-[#181210] hover:bg-[#FAF9F5] whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>

            {canCreate && (
              <button
                type="button"
                onClick={() => openAddProductInCategory(selectedCatId)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-[12px] font-semibold rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                {activeCategoryObj ? `Add to ${activeCategoryObj.name}` : 'Add Product'}
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                <th className="py-2.5 px-4">Product &amp; SKU</th>
                <th className="py-2.5 px-3">Category / Sub-Group</th>
                <th className="py-2.5 px-3">Unit &amp; Variants</th>
                <th className="py-2.5 px-3 text-right">Starting Price</th>
                <th className="py-2.5 px-3 text-right">Counter Stock</th>
                <th className="py-2.5 px-3">Availability</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]/70 text-[13px]">
              {pagedProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-[#64748B]">
                    No products in this category yet. Click &ldquo;Add Product&rdquo; above to add one.
                  </td>
                </tr>
              ) : (
                pagedProducts.map((p) => {
                  const cat = categories.find((c) => c.id === p.categoryId)?.name ?? '—';
                  const defaultVar = getProductDefaultVariant(p);
                  const variantStocks = p.variants.map((v) => ({
                    variant: v,
                    qty: getVariantStock(p.id, v.id),
                    minStock: getVariantMinStock(p, v),
                    unit: getVariantUnitLabel(p, v),
                  }));
                  const totalVarQty = variantStocks.reduce((sum, vs) => sum + vs.qty, 0);
                  const allOut = variantStocks.every((vs) => vs.qty <= 0);
                  const anyLow = variantStocks.some((vs) => vs.qty <= vs.minStock);
                  return (
                    <tr key={p.id} className="hover:bg-[#FAF9F5]/70 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-3">
                          <ProductThumb
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-10 h-10 rounded-md"
                          />
                          <div>
                            <div className="font-semibold text-[#181210]">{p.name}</div>
                            <div className="text-[11px] font-mono text-[#64748B]">{p.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-[#181210] font-medium">{cat}</div>
                        <div className="text-[11px] text-[#64748B]">{p.subGroup}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-[12px] font-medium text-[#181210] capitalize">
                          By {p.unitType} ({p.baseUnitLabel})
                          {p.unitType === 'weight' && (
                            <span className="normal-case text-[11px] font-normal text-[#64748B] ml-1.5">
                              · {p.allowCustomWeight !== false ? 'Custom weight ON' : 'Presets only'}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#64748B]">
                          {p.variants.map((v) => `${v.label}: ${formatINRCompact(v.price)}`).join(' · ')}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-[#181210] tabular-nums">
                        {formatINRCompact(defaultVar?.price ?? p.variants[0]?.price ?? 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        <div className={`font-semibold ${anyLow ? 'text-[#C2410C]' : 'text-[#181210]'}`}>
                          {variantStocks.length === 1
                            ? formatStockQty(variantStocks[0].qty, variantStocks[0].unit)
                            : `${roundQty(totalVarQty)} total`}
                        </div>
                        {variantStocks.length > 1 && (
                          <div className="text-[10.5px] text-[#64748B] truncate max-w-[200px] ml-auto">
                            {variantStocks
                              .map((vs) => `${vs.variant.label}: ${roundQty(vs.qty)}`)
                              .join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {!p.isActive ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E5E7EB] text-[#64748B]">
                            Inactive
                          </span>
                        ) : allOut ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FEE2E2] text-[#B91C1C]">
                            Out of Stock
                          </span>
                        ) : anyLow ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#FFEDD5] text-[#C2410C]">
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#DCFCE7] text-[#15803D]">
                            Available
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditProduct(p)}
                                className="p-1.5 rounded text-[#64748B] hover:text-[#181210] hover:bg-[#FAF9F5]"
                                title="Edit product"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleProductActive(p.id)}
                                className={`p-1.5 rounded hover:bg-[#FAF9F5] ${
                                  p.isActive ? 'text-[#15803D]' : 'text-[#64748B]'
                                }`}
                                title={p.isActive ? 'Mark inactive' : 'Mark active'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(p.id)}
                              className="p-1.5 rounded text-[#B91C1C] hover:bg-[#FEE2E2]"
                              title="Delete product"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!canEdit && !canDelete && (
                            <span className="text-[11px] text-[#94A3B8]">View only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3 border-t border-[#E5E7EB] flex items-center justify-between text-[12px] text-[#64748B]">
          <span className="tabular-nums">
            Page {page} of {totalPages} · {filteredProducts.length} total items
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded border border-[#E5E7EB] disabled:opacity-40 hover:bg-[#FAF9F5]"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                className={`px-2.5 py-1 rounded text-[12px] font-semibold tabular-nums ${
                  n === page
                    ? 'bg-[#FB923C] text-white'
                    : 'border border-[#E5E7EB] text-[#181210] hover:bg-[#FAF9F5]'
                }`}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded border border-[#E5E7EB] disabled:opacity-40 hover:bg-[#FAF9F5]"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#181210]">New Menu Category</h3>
              <button type="button" onClick={() => setShowCatModal(false)} className="text-[#64748B]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCatName.trim()) return;
                addCategory(newCatName, newCatDesc);
                setNewCatName('');
                setNewCatDesc('');
                setShowCatModal(false);
              }}
              className="p-5 space-y-3.5"
            >
              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Bengali Sweets or Cheesecakes"
                  className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Short description for counter staff"
                  className="w-full px-3 py-2 text-[13px] border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  className="px-3.5 py-2 text-[12px] font-medium border border-[#E5E7EB] rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-[12px] font-semibold bg-[#FB923C] text-white rounded-md hover:bg-[#F97316]"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-[#181210]">
                {editingProduct ? `Edit Product — ${editingProduct.name}` : 'Add New Menu Product'}
              </h3>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="text-[#64748B] hover:text-[#181210]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 overflow-y-auto space-y-4 text-[13px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Motichoor Laddoo"
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    SKU / Barcode *
                  </label>
                  <input
                    type="text"
                    required
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full px-3 py-2 font-mono border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Category
                  </label>
                  <select
                    value={formCatId}
                    onChange={(e) => setFormCatId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md bg-white focus:outline-none focus:border-[#FB923C]"
                  >
                    {visibleCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Sub-Group
                  </label>
                  <input
                    type="text"
                    value={formSubGroup}
                    onChange={(e) => setFormSubGroup(e.target.value)}
                    placeholder="e.g. Festive Mithai, Fresh Pastries"
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                  />
                </div>
              </div>

              <div
                className={`grid grid-cols-2 ${
                  formUnitType === 'weight' ? 'sm:grid-cols-5' : 'sm:grid-cols-3'
                } gap-3`}
              >
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Sold By
                  </label>
                  <select
                    value={formUnitType}
                    onChange={(e) => handleUnitTypeChange(e.target.value as UnitType)}
                    className="w-full px-2.5 py-2 border border-[#E5E7EB] rounded-md bg-white"
                  >
                    <option value="piece">Piece (pc)</option>
                    <option value="weight">Weight (kg/g)</option>
                    <option value="box">Gift Box (box)</option>
                  </select>
                </div>
                {formUnitType === 'weight' && (
                  <>
                    <div>
                      <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                        Rate / kg (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={formPricePerKg}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setFormPricePerKg(raw);
                          const parsed = Number(raw);
                          if (Number.isFinite(parsed) && parsed >= 0) {
                            setFormVariants((prev) =>
                              prev.map((v) =>
                                v.weightGrams && v.weightGrams > 0
                                  ? { ...v, price: roundCurrency((parsed * v.weightGrams) / 1000) }
                                  : v
                              )
                            );
                          }
                        }}
                        className="w-full px-2.5 py-2 border border-[#E5E7EB] rounded-md tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                        Default Weight (g)
                      </label>
                      <input
                        type="number"
                        min={0.1}
                        step="any"
                        value={formDefaultWeightGrams}
                        onChange={(e) => setFormDefaultWeightGrams(e.target.value)}
                        placeholder="500"
                        className="w-full px-2.5 py-2 border border-[#E5E7EB] rounded-md tabular-nums"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    GST Tax (%)
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={formGstTreatment}
                      onChange={(e) => {
                        const val = e.target.value as GstTreatment;
                        setFormGstTreatment(val);
                        if (val !== 'Taxable') {
                          setFormTaxRate('0');
                        } else if (Number(formTaxRate) === 0) {
                          setFormTaxRate(String(settings.defaultTaxRate || 5));
                        }
                      }}
                      className="w-[105px] px-2 py-2 border border-[#E5E7EB] rounded-md bg-white text-[12px]"
                      aria-label="GST treatment"
                    >
                      <option value="Taxable">Taxable</option>
                      <option value="Exempt">Exempt</option>
                      <option value="Nil-Rated">Nil-Rated</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={28}
                      step="0.01"
                      disabled={formGstTreatment !== 'Taxable'}
                      value={formTaxRate}
                      onChange={(e) => setFormTaxRate(e.target.value)}
                      className="w-full min-w-[60px] px-2.5 py-2 border border-[#E5E7EB] rounded-md tabular-nums disabled:bg-[#F3F4F6] disabled:text-[#64748B]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Min Stock Alert
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(e.target.value)}
                    className="w-full px-2.5 py-2 border border-[#E5E7EB] rounded-md tabular-nums"
                  />
                </div>
              </div>

              {formUnitType === 'weight' && (
                <div className="px-3.5 py-3 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-[#181210]">
                      Allow Custom Weight
                    </div>
                    <div className="text-[11px] text-[#64748B] mt-0.5">
                      {formAllowCustomWeight
                        ? 'ON — Cashiers can bill using manually entered g/kg weights in addition to predefined options.'
                        : 'OFF — Cashiers can select only from the predefined weight options on POS Billing.'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[11px] font-bold uppercase tabular-nums ${
                        formAllowCustomWeight ? 'text-[#C2410C]' : 'text-[#64748B]'
                      }`}
                    >
                      {formAllowCustomWeight ? 'ON' : 'OFF'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formAllowCustomWeight}
                      aria-label="Allow Custom Weight"
                      onClick={() => setFormAllowCustomWeight((prev) => !prev)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#FB923C]/40 ${
                        formAllowCustomWeight ? 'bg-[#FB923C]' : 'bg-[#D1D5DB]'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                          formAllowCustomWeight ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#181210]">
                    Sizes, Weights &amp; Box Variants
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFormVariants((prev) => [
                        ...prev,
                        {
                          id: `v-${Date.now()}`,
                          label: formUnitType === 'weight' ? '500g' : 'Pack of 2',
                          weightGrams: formUnitType === 'weight' ? 500 : undefined,
                          price: 250,
                          skuSuffix: `V${prev.length + 1}`,
                          unitLabel: formUnitType === 'weight' ? 'pcs' : formBaseUnit,
                          minStockAlert: Number(formMinStock) || settings.lowStockThresholdDefault,
                        },
                      ])
                    }
                    className="text-[12px] font-semibold text-[#FB923C] hover:text-[#F97316]"
                  >
                    + Add Variant
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#64748B] px-0.5">
                  <span className={formUnitType === 'weight' ? 'col-span-3' : 'col-span-4'}>Variant</span>
                  {formUnitType === 'weight' && <span className="col-span-2">Grams</span>}
                  <span className="col-span-2">Price (₹)</span>
                  <span className="col-span-2">Unit</span>
                  <span className="col-span-1 text-center">Min</span>
                  <span className="col-span-1 text-center">Def</span>
                  <span className="col-span-1" />
                </div>

                {formVariants.map((v, idx) => (
                  <div key={v.id} className="grid grid-cols-12 gap-1.5 items-center">
                    <input
                      type="text"
                      value={v.label}
                      onChange={(e) =>
                        setFormVariants((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, label: e.target.value } : item
                          )
                        )
                      }
                      placeholder="Label (e.g. 500g)"
                      className={`${
                        formUnitType === 'weight' ? 'col-span-3' : 'col-span-4'
                      } px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded`}
                      required
                    />
                    {formUnitType === 'weight' && (
                      <input
                        type="number"
                        min={0.1}
                        step="any"
                        value={v.weightGrams ?? ''}
                        onChange={(e) =>
                          setFormVariants((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, weightGrams: Number(e.target.value) } : item
                            )
                          )
                        }
                        placeholder="Grams"
                        className="col-span-2 px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded tabular-nums"
                      />
                    )}
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={v.price}
                      onChange={(e) =>
                        setFormVariants((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, price: Number(e.target.value) } : item
                          )
                        )
                      }
                      placeholder="Price ₹"
                      className="col-span-2 px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded tabular-nums"
                      required
                    />
                    <input
                      type="text"
                      value={v.unitLabel ?? (formUnitType === 'weight' ? 'pcs' : formBaseUnit)}
                      onChange={(e) =>
                        setFormVariants((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, unitLabel: e.target.value } : item
                          )
                        )
                      }
                      placeholder="Unit"
                      className="col-span-2 px-2 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded"
                    />
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={v.minStockAlert ?? Number(formMinStock) ?? 0}
                      onChange={(e) =>
                        setFormVariants((prev) =>
                          prev.map((item, i) =>
                            i === idx
                              ? { ...item, minStockAlert: Math.max(0, Number(e.target.value) || 0) }
                              : item
                          )
                        )
                      }
                      title="Minimum stock threshold for this variant"
                      className="col-span-1 px-1.5 py-1.5 text-[12px] text-center bg-white border border-[#E5E7EB] rounded tabular-nums"
                    />
                    <div className="col-span-1 flex justify-center">
                      <input
                        type="radio"
                        name="defaultVariantRadio"
                        checked={Boolean(v.isDefault) || (!formVariants.some((x) => x.isDefault) && idx === 0)}
                        onChange={() =>
                          setFormVariants((prev) =>
                            prev.map((item, i) => ({ ...item, isDefault: i === idx }))
                          )
                        }
                        title="Set as default POS variant"
                        className="accent-[#FB923C] cursor-pointer"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={formVariants.length <= 1}
                      onClick={() =>
                        setFormVariants((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="col-span-1 p-1.5 text-[#B91C1C] disabled:opacity-30 flex justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="text-[12px] font-semibold text-[#181210]">
                  Product Display Photo
                </div>

                {/* Primary Photo Preview & Two Creation Actions */}
                <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center gap-3.5">
                  <ProductThumb
                    src={formImageUrl}
                    alt={formName || 'Product photo preview'}
                    className="w-16 h-16 rounded-lg shrink-0"
                  />

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold border transition-colors whitespace-nowrap ${
                          photoSourceMode === 'upload'
                            ? 'bg-[#181210] text-white border-[#181210]'
                            : 'bg-white text-[#181210] border-[#E5E7EB] hover:border-[#FB923C]'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload from Computer
                      </button>

                      <button
                        type="button"
                        onClick={() => setPhotoSourceMode('ai')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold border transition-colors whitespace-nowrap ${
                          photoSourceMode === 'ai'
                            ? 'bg-[#FB923C] text-white border-[#FB923C]'
                            : 'bg-white text-[#181210] border-[#FB923C]/50 hover:bg-[#FFF7ED]'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Generate with AI
                      </button>
                    </div>

                    <div className="text-[11px] text-[#64748B]">
                      {photoSourceMode === 'upload' && uploadedFileName
                        ? `Uploaded file: ${uploadedFileName}`
                        : photoSourceMode === 'ai'
                        ? 'AI image generation option selected. Or upload a local photo from your computer.'
                        : 'Upload a photo from your computer or select Generate with AI.'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#E5E7EB]">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-[12px] font-semibold text-[#181210]">
                      Track Batch Expiry Dates
                    </div>
                    <div className="text-[11px] text-[#64748B]">
                      {formTrackExpiry ? 'Freshness alerts enabled' : 'Expiry tracking disabled'}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formTrackExpiry}
                    aria-label="Track Batch Expiry Dates"
                    onClick={() => setFormTrackExpiry((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#FB923C]/40 ${
                      formTrackExpiry ? 'bg-[#FB923C]' : 'bg-[#D1D5DB]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                        formTrackExpiry ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[12px] font-semibold text-[#181210]">
                      Active on POS Counter
                    </div>
                    <div className="text-[11px] text-[#64748B]">
                      {formIsActive ? 'Visible for ordering on POS' : 'Hidden from POS screen'}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formIsActive}
                    aria-label="Active on POS Counter"
                    onClick={() => setFormIsActive((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#FB923C]/40 ${
                      formIsActive ? 'bg-[#FB923C]' : 'bg-[#D1D5DB]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                        formIsActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 text-[12px] font-medium border border-[#E5E7EB] rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-[12px] font-semibold bg-[#FB923C] hover:bg-[#F97316] text-white rounded-md"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-sm p-5">
            <h3 className="text-[15px] font-semibold text-[#181210]">Delete Product?</h3>
            <p className="text-[13px] text-[#64748B] mt-1.5">
              This will remove the product and its active batch rows from Menus. Past sales reports
              remain intact.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="px-3.5 py-2 text-[12px] font-medium border border-[#E5E7EB] rounded-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteProduct(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="px-4 py-2 text-[12px] font-semibold bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-md"
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
