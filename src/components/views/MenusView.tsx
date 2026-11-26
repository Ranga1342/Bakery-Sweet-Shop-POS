import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Download,
  Pencil,
  Trash2,
  Power,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Upload,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { usePos } from '../../context/PosContext';
import { ProductThumb } from '../common/ProductThumb';
import { CategoryIcon } from '../../utils/categoryIcons';
import { Category, PreparationType, Product, ProductVariant, UnitType } from '../../types/pos';
import { PRODUCT_IMAGE_LIBRARY } from '../../data/seedData';
import {
  exportToCsv,
  formatINRCompact,
  formatStockQty,
  roundCurrency,
  roundQty,
  roundWeightGrams,
} from '../../utils/formatters';

const PAGE_SIZE = 8;

const getSoldByDisplayLabel = (ut: UnitType): string => {
  switch (ut) {
    case 'piece':
      return 'Piece';
    case 'weight':
      return 'Weight';
    case 'volume':
      return 'Volume';
    case 'box':
      return 'Pack / Box';
    case 'cake':
      return 'Cake';
  }
};

const getBaseUnitForSoldBy = (ut: UnitType): string => {
  switch (ut) {
    case 'piece':
      return 'pc';
    case 'weight':
      return 'kg';
    case 'volume':
      return 'L';
    case 'box':
      return 'box';
    case 'cake':
      return 'cake';
  }
};

const getDefaultVariantUnit = (ut: UnitType): string => {
  switch (ut) {
    case 'piece':
      return 'Pic';
    case 'weight':
      return 'Gram';
    case 'volume':
      return 'ML';
    case 'box':
      return 'Box';
    case 'cake':
      return 'KG';
  }
};

const getAllowedVariantUnits = (ut: UnitType): string[] => {
  switch (ut) {
    case 'piece':
      return ['Pic', 'Slice', 'Cup', 'Plate'];
    case 'weight':
      return ['KG', 'Gram'];
    case 'volume':
      return ['Liter', 'ML'];
    case 'box':
      return ['Box', 'Pack', 'Dozen'];
    case 'cake':
      return ['KG', 'Half KG', 'Pound', 'Tier', 'Slice', 'Cake'];
  }
};

const normalizeVariantUnitForType = (ut: UnitType, current?: string): string => {
  const allowed = getAllowedVariantUnits(ut);
  const trimmed = (current ?? '').trim().toLowerCase();
  if (ut === 'piece') {
    if (trimmed === 'pc' || trimmed === 'pcs' || trimmed === 'pic') return 'Pic';
  }
  if (ut === 'weight') {
    if (trimmed === 'kg' || trimmed === 'kgs') return 'KG';
    if (trimmed === 'g' || trimmed === 'gm' || trimmed === 'gms' || trimmed === 'gram' || trimmed === 'grams') {
      return 'Gram';
    }
  }
  if (ut === 'volume') {
    if (trimmed === 'l' || trimmed === 'liter' || trimmed === 'litre' || trimmed === 'liters' || trimmed === 'litres') {
      return 'Liter';
    }
    if (trimmed === 'ml' || trimmed === 'milliliter' || trimmed === 'millilitre') return 'ML';
  }
  if (ut === 'box') {
    if (trimmed === 'pack' || trimmed === 'packs') return 'Pack';
    if (trimmed === 'dozen' || trimmed === 'dz') return 'Dozen';
    if (trimmed === 'box' || trimmed === 'boxes' || trimmed === 'tin' || trimmed === 'jar') return 'Box';
  }
  if (ut === 'cake') {
    if (trimmed === 'kg' || trimmed === 'kgs') return 'KG';
    if (trimmed === 'half kg' || trimmed === '500g') return 'Half KG';
    if (trimmed === 'pc' || trimmed === 'pcs' || trimmed === 'slice') return 'Slice';
  }
  const match = allowed.find((u) => u.toLowerCase() === trimmed);
  return match ?? getDefaultVariantUnit(ut);
};

const computeWeightGramsFromRow = (qtyText: string, unitLabel?: string): number => {
  const normalizedUnit = normalizeVariantUnitForType('weight', unitLabel);
  const parsed = Number(qtyText);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return normalizedUnit === 'KG' ? roundWeightGrams(parsed * 1000) : roundWeightGrams(parsed);
};

const computeWeightPriceFromGrams = (ratePerKg: number, grams: number): number => {
  if (!Number.isFinite(ratePerKg) || ratePerKg < 0 || !Number.isFinite(grams) || grams <= 0) {
    return 0;
  }
  return roundCurrency((ratePerKg * grams) / 1000);
};

const formatWeightVariantDisplayLabel = (qtyText: string, unitLabel?: string): string => {
  const normalizedUnit = normalizeVariantUnitForType('weight', unitLabel);
  const parsed = Number(qtyText);
  if (!Number.isFinite(parsed) || parsed <= 0) return qtyText.trim() || '500 g';
  return normalizedUnit === 'KG' ? `${roundQty(parsed)} KG` : `${roundWeightGrams(parsed)} g`;
};

const parseWeightRowFromVariant = (
  v: ProductVariant,
  fallbackGrams = 500
): { qtyText: string; unitLabel: 'KG' | 'Gram'; weightGrams: number } => {
  let grams = v.weightGrams && v.weightGrams > 0 ? v.weightGrams : 0;
  if (!grams) {
    const raw = v.label.trim().toLowerCase();
    const kgMatch = raw.match(/(\d+(?:\.\d+)?)\s*k(?:g|ilo)/);
    if (kgMatch) {
      grams = roundWeightGrams(parseFloat(kgMatch[1]) * 1000);
    } else {
      const gMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gms|gram|grams)?\b/);
      if (gMatch) {
        const val = parseFloat(gMatch[1]);
        grams = v.unitLabel?.toLowerCase().includes('kg')
          ? roundWeightGrams(val * 1000)
          : roundWeightGrams(val);
      }
    }
  }
  if (!grams || grams <= 0) grams = fallbackGrams;
  const labelLower = v.label.trim().toLowerCase();
  const unitLower = (v.unitLabel ?? '').trim().toLowerCase();
  const isKg =
    (unitLower === 'kg' && grams >= 1000) ||
    labelLower.includes('kg') ||
    (grams >= 1000 && grams % 1000 === 0);
  if (isKg) {
    return {
      qtyText: String(roundQty(grams / 1000)),
      unitLabel: 'KG',
      weightGrams: roundWeightGrams(grams),
    };
  }
  return {
    qtyText: String(roundWeightGrams(grams)),
    unitLabel: 'Gram',
    weightGrams: roundWeightGrams(grams),
  };
};

export const MenusView: React.FC = () => {
  const {
    categories,
    addCategory,
    deleteCategory,
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProductActive,
    getPreparationType,
    getGroupBulkStock,
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
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Subgroup combobox state (persisted across products in session)
  const [customSubgroups, setCustomSubgroups] = useState<string[]>([]);
  const [showSubGroupDropdown, setShowSubGroupDropdown] = useState(false);
  const subGroupContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        subGroupContainerRef.current &&
        !subGroupContainerRef.current.contains(event.target as Node)
      ) {
        setShowSubGroupDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Product Form State
  const [formName, setFormName] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formCatId, setFormCatId] = useState(visibleCategories[0]?.id ?? '');
  const [formSubGroup, setFormSubGroup] = useState('');
  const [formPrepType, setFormPrepType] = useState<PreparationType>('Pre-Cooked');
  const [formUnitType, setFormUnitType] = useState<UnitType>('piece');
  const [formBaseUnit, setFormBaseUnit] = useState('pc');
  const [formPricePerKg, setFormPricePerKg] = useState('800');
  const [formAllowCustomWeight, setFormAllowCustomWeight] = useState(true);
  const [formIsGroupStock, setFormIsGroupStock] = useState(false);
  const [formBulkUnit, setFormBulkUnit] = useState('kg');
  const [formBulkStockQty, setFormBulkStockQty] = useState('');
  const [formTrackExpiry, setFormTrackExpiry] = useState(true);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formImageUrl, setFormImageUrl] = useState(PRODUCT_IMAGE_LIBRARY[0].url);
  const [photoSourceMode, setPhotoSourceMode] = useState<'upload' | 'ai' | 'preset'>('preset');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formVariants, setFormVariants] = useState<ProductVariant[]>([
    { id: 'v-new-1', label: 'Regular', price: 120, skuSuffix: '1PC', unitLabel: 'Pic', isDefault: true },
  ]);

  const allAvailableSubgroups = useMemo(() => {
    const seen = new Map<string, string>();
    const addCandidate = (raw?: string) => {
      const trimmed = (raw ?? '').trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, trimmed);
      }
    };
    // Prioritize subgroups in the selected form category, then others, then newly created ones
    products.filter((p) => p.categoryId === formCatId).forEach((p) => addCandidate(p.subGroup));
    products.filter((p) => p.categoryId !== formCatId).forEach((p) => addCandidate(p.subGroup));
    customSubgroups.forEach(addCandidate);
    return Array.from(seen.values());
  }, [products, formCatId, customSubgroups]);

  const matchingSubgroups = useMemo(() => {
    const query = formSubGroup.trim().toLowerCase();
    if (!query) return allAvailableSubgroups;
    return allAvailableSubgroups.filter((sg) => sg.toLowerCase().includes(query));
  }, [allAvailableSubgroups, formSubGroup]);

  const exactSubGroupMatch = useMemo(() => {
    const query = formSubGroup.trim().toLowerCase();
    if (!query) return undefined;
    return allAvailableSubgroups.find((sg) => sg.toLowerCase() === query);
  }, [allAvailableSubgroups, formSubGroup]);

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
    const initialVarId = `v-${Date.now()}`;
    setEditingProduct(null);
    setFormName('');
    setFormSku(`BK-${Math.floor(100 + Math.random() * 899)}`);
    setFormCatId(resolvedCatId);
    setFormSubGroup(
      selectedSubGroup !== 'all' ? selectedSubGroup : 'Counter Specials'
    );
    setFormPrepType('Pre-Cooked');
    setFormUnitType('piece');
    setFormBaseUnit('pc');
    setFormPricePerKg('900');
    setFormAllowCustomWeight(true);
    setFormIsGroupStock(false);
    setFormBulkUnit('kg');
    setFormBulkStockQty('');
    setFormTrackExpiry(true);
    setFormIsActive(true);
    setFormImageUrl(PRODUCT_IMAGE_LIBRARY[0].url);
    setPhotoSourceMode('preset');
    setUploadedFileName(null);
    setFormVariants([
      {
        id: initialVarId,
        label: 'Regular',
        price: 150,
        skuSuffix: '1PC',
        unitLabel: getDefaultVariantUnit('piece'),
        isDefault: true,
      },
    ]);
    setShowSubGroupDropdown(false);
    setShowProductModal(true);
  };

  const openEditProduct = (p: Product) => {
    const prepType = getPreparationType(p);
    setEditingProduct(p);
    setFormName(p.name);
    setFormSku(p.sku);
    setFormCatId(p.categoryId);
    setFormSubGroup(p.subGroup);
    setFormPrepType(prepType);
    setFormUnitType(p.unitType);
    setFormBaseUnit(p.baseUnitLabel || getBaseUnitForSoldBy(p.unitType));
    setFormPricePerKg(String(p.pricePerKg ?? 800));
    setFormAllowCustomWeight(p.unitType === 'weight' ? p.allowCustomWeight ?? true : false);
    setFormIsGroupStock(p.unitType === 'weight' && Boolean(p.isGroupStock));
    setFormBulkUnit(p.bulkUnitLabel || (p.unitType === 'weight' ? 'kg' : p.baseUnitLabel || 'pc'));
    setFormBulkStockQty(
      p.unitType === 'weight' && p.isGroupStock ? String(getGroupBulkStock(p.id)) : ''
    );
    setFormTrackExpiry(p.trackExpiry);
    setFormIsActive(p.isActive);
    setFormImageUrl(p.imageUrl);
    setPhotoSourceMode(p.imageUrl.startsWith('data:') ? 'upload' : 'preset');
    setUploadedFileName(p.imageUrl.startsWith('data:') ? 'Uploaded image' : null);

    const mappedVariants = p.variants.map((v) => {
      if (p.unitType === 'weight') {
        const parsed = parseWeightRowFromVariant(v, p.defaultWeightGrams || 500);
        return {
          ...v,
          label: parsed.qtyText,
          weightGrams: parsed.weightGrams,
          unitLabel: parsed.unitLabel,
        };
      }
      return {
        ...v,
        unitLabel: normalizeVariantUnitForType(p.unitType, v.unitLabel),
        weightGrams: undefined,
      };
    });

    const hasDefault = mappedVariants.some((v) => v.isDefault);
    setFormVariants(
      hasDefault
        ? mappedVariants
        : mappedVariants.map((v, idx) => ({ ...v, isDefault: idx === 0 }))
    );
    setShowSubGroupDropdown(false);
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
    setFormBaseUnit(getBaseUnitForSoldBy(ut));

    if (ut === 'weight') {
      setFormAllowCustomWeight(true);
      if (formIsGroupStock) setFormBulkUnit('kg');
      const rate = roundCurrency(Math.max(0, Number(formPricePerKg) || 400));
      if (!editingProduct || editingProduct.unitType !== 'weight') {
        const ts = Date.now();
        setFormVariants([
          {
            id: `v-${ts}-1`,
            label: '250',
            weightGrams: 250,
            price: computeWeightPriceFromGrams(rate, 250),
            skuSuffix: '250G',
            unitLabel: 'Gram',
          },
          {
            id: `v-${ts}-2`,
            label: '500',
            weightGrams: 500,
            price: computeWeightPriceFromGrams(rate, 500),
            skuSuffix: '500G',
            unitLabel: 'Gram',
            isDefault: true,
          },
          {
            id: `v-${ts}-3`,
            label: '1',
            weightGrams: 1000,
            price: computeWeightPriceFromGrams(rate, 1000),
            skuSuffix: '1KG',
            unitLabel: 'KG',
          },
        ]);
      } else {
        setFormVariants(
          editingProduct.variants.map((v, idx) => {
            const parsed = parseWeightRowFromVariant(v, editingProduct.defaultWeightGrams || 500);
            return {
              ...v,
              label: parsed.qtyText,
              weightGrams: parsed.weightGrams,
              unitLabel: parsed.unitLabel,
              isDefault: editingProduct.variants.some((x) => x.isDefault)
                ? Boolean(v.isDefault)
                : idx === 0,
            };
          })
        );
      }
      return;
    }

    setFormAllowCustomWeight(false);
    setFormIsGroupStock(false);

    if (editingProduct && editingProduct.unitType === ut) {
      setFormVariants(
        editingProduct.variants.map((v, idx) => ({
          ...v,
          unitLabel: normalizeVariantUnitForType(ut, v.unitLabel),
          weightGrams: undefined,
          isDefault: editingProduct.variants.some((x) => x.isDefault)
            ? Boolean(v.isDefault)
            : idx === 0,
        }))
      );
      return;
    }

    const ts = Date.now();
    if (ut === 'volume') {
      setFormVariants([
        {
          id: `v-${ts}-1`,
          label: '250 ML',
          price: 40,
          skuSuffix: '250ML',
          unitLabel: 'ML',
          isDefault: true,
        },
        {
          id: `v-${ts}-2`,
          label: '1 Liter',
          price: 120,
          skuSuffix: '1L',
          unitLabel: 'Liter',
        },
      ]);
    } else if (ut === 'box') {
      setFormVariants([
        {
          id: `v-${ts}-1`,
          label: '500g Gift Box',
          price: 650,
          skuSuffix: 'BOX',
          unitLabel: 'Box',
          isDefault: true,
        },
      ]);
    } else if (ut === 'cake') {
      setFormVariants([
        {
          id: `v-${ts}-1`,
          label: '500g Classic Cake',
          price: 450,
          skuSuffix: '500G',
          unitLabel: 'Half KG',
        },
        {
          id: `v-${ts}-2`,
          label: '1 Kg Celebration Cake',
          price: 850,
          skuSuffix: '1KG',
          unitLabel: 'KG',
          isDefault: true,
        },
      ]);
    } else {
      // Piece
      setFormVariants([
        {
          id: `v-${ts}-1`,
          label: 'Regular',
          price: 120,
          skuSuffix: '1PC',
          unitLabel: 'Pic',
          isDefault: true,
        },
      ]);
    }
  };

  const handleSelectOrCreateSubgroup = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = allAvailableSubgroups.find(
      (sg) => sg.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      setFormSubGroup(existing);
    } else {
      setCustomSubgroups((prev) => {
        if (prev.some((s) => s.toLowerCase() === trimmed.toLowerCase())) return prev;
        return [...prev, trimmed];
      });
      setFormSubGroup(trimmed);
    }
    setShowSubGroupDropdown(false);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSku.trim() || formVariants.length === 0) return;

    const rawSubGroup = formSubGroup.trim() || 'Bakery Specials';
    const canonicalSubGroup =
      allAvailableSubgroups.find((sg) => sg.toLowerCase() === rawSubGroup.toLowerCase()) ??
      rawSubGroup;
    if (!allAvailableSubgroups.some((sg) => sg.toLowerCase() === canonicalSubGroup.toLowerCase())) {
      setCustomSubgroups((prev) =>
        prev.some((s) => s.toLowerCase() === canonicalSubGroup.toLowerCase())
          ? prev
          : [...prev, canonicalSubGroup]
      );
    }

    const fallbackMin = editingProduct?.minStockAlert ?? 0;
    const hasExplicitDefault = formVariants.some((v) => v.isDefault);
    const normalizedVariants: ProductVariant[] = formVariants.map((v, idx) => {
      const normalizedUnit = normalizeVariantUnitForType(formUnitType, v.unitLabel);
      if (formUnitType === 'weight') {
        const computedGrams =
          computeWeightGramsFromRow(v.label, normalizedUnit) || v.weightGrams || 500;
        const formattedLabel = formatWeightVariantDisplayLabel(v.label, normalizedUnit);
        return {
          ...v,
          label: formattedLabel,
          price: roundCurrency(Math.max(0, Number.isFinite(v.price) ? v.price : 0)),
          weightGrams: roundWeightGrams(computedGrams),
          unitLabel: normalizedUnit,
          skuSuffix:
            v.skuSuffix?.trim() ||
            (normalizedUnit === 'KG'
              ? `${Math.round(computedGrams / 1000)}KG`
              : `${Math.round(computedGrams)}G`),
          minStockAlert: v.minStockAlert ?? fallbackMin,
          isDefault: hasExplicitDefault ? Boolean(v.isDefault) : idx === 0,
        };
      }
      return {
        ...v,
        label: v.label.trim(),
        price: roundCurrency(Math.max(0, Number.isFinite(v.price) ? v.price : 0)),
        weightGrams: undefined,
        unitLabel: normalizedUnit,
        minStockAlert: v.minStockAlert ?? fallbackMin,
        isDefault: hasExplicitDefault ? Boolean(v.isDefault) : idx === 0,
      };
    });

    const defaultVar = normalizedVariants.find((v) => v.isDefault) ?? normalizedVariants[0];
    const isPreCooked = formPrepType === 'Pre-Cooked';
    const allowGroupStock = isPreCooked && formUnitType === 'weight' && formIsGroupStock;

    const payload: Omit<Product, 'id'> = {
      name: formName.trim(),
      sku: formSku.trim().toUpperCase(),
      categoryId: formCatId,
      subGroup: canonicalSubGroup,
      preparationType: formPrepType,
      unitType: formUnitType,
      baseUnitLabel: formBaseUnit || getBaseUnitForSoldBy(formUnitType),
      pricePerKg:
        formUnitType === 'weight'
          ? roundCurrency(Math.max(0, Number(formPricePerKg) || 400))
          : undefined,
      defaultWeightGrams:
        formUnitType === 'weight'
          ? Math.max(0.1, roundWeightGrams(defaultVar?.weightGrams || 500))
          : undefined,
      allowCustomWeight: formUnitType === 'weight' ? formAllowCustomWeight : undefined,
      isGroupStock: allowGroupStock,
      bulkUnitLabel: allowGroupStock ? formBulkUnit || 'kg' : undefined,
      variants: normalizedVariants,
      taxRate: editingProduct?.taxRate ?? settings.defaultTaxRate,
      gstTreatment: editingProduct?.gstTreatment ?? 'Taxable',
      imageUrl: formImageUrl,
      isFavourite: editingProduct?.isFavourite ?? false,
      isActive: formIsActive,
      minStockAlert: fallbackMin,
      shelfLifeDays: editingProduct?.shelfLifeDays ?? 3,
      batchExpiryDate: editingProduct?.batchExpiryDate,
      trackExpiry: isPreCooked ? formTrackExpiry : false,
    };

    const stockSetup =
      isPreCooked && allowGroupStock
        ? {
            bulkStockQty:
              formBulkStockQty.trim() !== '' && Number.isFinite(Number(formBulkStockQty))
                ? Math.max(0, roundQty(Number(formBulkStockQty)))
                : undefined,
          }
        : undefined;

    if (editingProduct) {
      updateProduct({ ...payload, id: editingProduct.id }, stockSetup);
    } else {
      addProduct(payload, stockSetup);
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
    <div className="p-3.5 sm:p-5 space-y-4 sm:space-y-5 bg-[#E0E2E7] min-h-[calc(100vh-65px)]">
      {/* Top Product Category Groups Strip (Requirement C) */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
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
            const selectCategory = () => {
              setSelectedCatId(cat.id);
              setSelectedSubGroup('all');
              setPage(1);
            };
            return (
              <div
                key={cat.id}
                role="button"
                tabIndex={0}
                onClick={selectCategory}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectCategory();
                  }
                }}
                className={`p-3 rounded-lg border text-left transition-colors flex flex-col justify-between gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FB923C]/50 ${
                  active
                    ? 'bg-[#FB923C] border-[#FB923C] text-white'
                    : 'bg-[#FAF9F5] border-[#E5E7EB] hover:border-[#FB923C]/60 text-[#181210]'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <CategoryIcon
                    category={cat.name}
                    className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-[#FB923C]'}`}
                  />
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[11px] font-semibold tabular-nums ${
                        active ? 'text-white/90' : 'text-[#64748B]'
                      }`}
                    >
                      {count}
                    </span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCategoryToDelete(cat);
                        }}
                        aria-label={`Delete ${cat.name} category`}
                        title={`Delete ${cat.name}`}
                        className={`p-1 rounded transition-colors ${
                          active
                            ? 'text-white/85 hover:text-white hover:bg-white/20'
                            : 'text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2]'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-[12px] font-semibold leading-tight truncate">{cat.name}</div>
              </div>
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
        <div className="px-3.5 sm:px-5 py-3.5 sm:py-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <CategoryIcon
              category={activeCategoryObj?.name ?? 'all'}
              className="w-4.5 h-4.5 text-[#FB923C] shrink-0"
            />
            <h2 className="text-[15px] font-semibold text-[#181210] truncate">
              {activeCategoryObj ? activeCategoryObj.name : 'All Menu Products'}
            </h2>
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-[#FAF9F5] border border-[#E5E7EB] text-[#64748B] tabular-nums shrink-0">
              {filteredProducts.length} items
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <select
              value={unitFilter}
              onChange={(e) => {
                setUnitFilter(e.target.value as 'all' | UnitType);
                setPage(1);
              }}
              className="w-full sm:w-auto px-3 py-1.5 text-[12px] font-medium border border-[#E5E7EB] rounded-md bg-white text-[#181210] focus:outline-none focus:border-[#FB923C]"
              aria-label="Filter by unit type"
            >
              <option value="all">All Selling Types</option>
              <option value="piece">Sold by Piece</option>
              <option value="weight">Sold by Weight</option>
              <option value="volume">Sold by Volume</option>
              <option value="box">Pack / Box</option>
              <option value="cake">Cake</option>
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

        {/* Mobile Product Cards */}
        <div className="md:hidden divide-y divide-[#E5E7EB]">
          {pagedProducts.length === 0 ? (
            <div className="py-10 px-4 text-center text-[13px] text-[#64748B]">
              No products in this category yet. Click &ldquo;Add Product&rdquo; above to add one.
            </div>
          ) : (
            pagedProducts.map((p) => {
              const cat = categories.find((c) => c.id === p.categoryId)?.name ?? '—';
              const prepType = getPreparationType(p);
              const isMadeFresh = prepType === 'Made Fresh';
              const bulkQty = p.isGroupStock ? getGroupBulkStock(p.id) : 0;
              const bulkUnit = p.bulkUnitLabel || p.baseUnitLabel || 'kg';
              const defaultVar = getProductDefaultVariant(p);
              const variantStocks = p.variants.map((v) => ({
                variant: v,
                qty: getVariantStock(p.id, v.id),
                minStock: getVariantMinStock(p, v),
                unit: getVariantUnitLabel(p, v),
              }));
              const totalVarQty = variantStocks.reduce((sum, vs) => sum + vs.qty, 0);
              const allOut = !isMadeFresh && (p.isGroupStock ? bulkQty <= 0 && totalVarQty <= 0 : variantStocks.every((vs) => vs.qty <= 0));
              const anyLow = !isMadeFresh && (p.isGroupStock ? bulkQty > 0 && p.minStockAlert > 0 && bulkQty <= p.minStockAlert : variantStocks.some((vs) => vs.qty <= vs.minStock));

              return (
                <div key={p.id} className="p-3.5 space-y-2.5 text-[13px]">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <ProductThumb
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-11 h-11 rounded-md shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-[#181210] truncate">{p.name}</div>
                        <div className="text-[11px] font-mono text-[#64748B] truncate">
                          {p.sku} · {cat} ({p.subGroup})
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="text-[10.5px] font-semibold text-[#64748B]">
                            {prepType}
                          </span>
                          {p.isGroupStock && (
                            <span className="text-[10.5px] font-semibold text-[#C2410C]">
                              · Group Stock ({bulkUnit})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {!p.isActive ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E5E7EB] text-[#64748B]">
                          Inactive
                        </span>
                      ) : isMadeFresh ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#DCFCE7] text-[#15803D]">
                          Made Fresh
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
                    </div>
                  </div>

                  <div className="text-[11.5px] text-[#64748B] bg-[#FAF9F5] border border-[#E5E7EB] rounded-md px-2.5 py-2 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#181210]">
                        By {getSoldByDisplayLabel(p.unitType)} ({p.baseUnitLabel})
                        {p.unitType === 'weight' &&
                          ` · ${p.allowCustomWeight !== false ? 'Custom ON' : 'Presets only'}`}
                      </span>
                      <span className="font-bold text-[#181210] tabular-nums">
                        {formatINRCompact(defaultVar?.price ?? p.variants[0]?.price ?? 0)}
                      </span>
                    </div>
                    <div className="truncate">
                      {p.variants.map((v) => `${v.label}: ${formatINRCompact(v.price)}`).join(' · ')}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="text-[12px] tabular-nums">
                      <span className="text-[#64748B] mr-1">Counter:</span>
                      {isMadeFresh ? (
                        <span className="font-semibold text-[#15803D]">On demand</span>
                      ) : p.isGroupStock ? (
                        <span className="font-semibold text-[#181210]">
                          {formatStockQty(bulkQty, bulkUnit)} bulk
                        </span>
                      ) : (
                        <span className={`font-semibold ${anyLow ? 'text-[#C2410C]' : 'text-[#181210]'}`}>
                          {variantStocks.length === 1
                            ? formatStockQty(variantStocks[0].qty, variantStocks[0].unit)
                            : `${roundQty(totalVarQty)} total`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditProduct(p)}
                            className="p-2 rounded border border-[#E5E7EB] text-[#181210] hover:bg-[#FAF9F5]"
                            title="Edit product"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleProductActive(p.id)}
                            className={`p-2 rounded border border-[#E5E7EB] hover:bg-[#FAF9F5] ${
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
                          className="p-2 rounded border border-[#E5E7EB] text-[#B91C1C] hover:bg-[#FEE2E2]"
                          title="Delete product"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[820px] text-left border-collapse">
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
                  const prepType = getPreparationType(p);
                  const isMadeFresh = prepType === 'Made Fresh';
                  const bulkQty = p.isGroupStock ? getGroupBulkStock(p.id) : 0;
                  const bulkUnit = p.bulkUnitLabel || p.baseUnitLabel || 'kg';
                  const defaultVar = getProductDefaultVariant(p);
                  const variantStocks = p.variants.map((v) => ({
                    variant: v,
                    qty: getVariantStock(p.id, v.id),
                    minStock: getVariantMinStock(p, v),
                    unit: getVariantUnitLabel(p, v),
                  }));
                  const totalVarQty = variantStocks.reduce((sum, vs) => sum + vs.qty, 0);
                  const allOut = !isMadeFresh && (p.isGroupStock ? bulkQty <= 0 && totalVarQty <= 0 : variantStocks.every((vs) => vs.qty <= 0));
                  const anyLow = !isMadeFresh && (p.isGroupStock ? bulkQty > 0 && p.minStockAlert > 0 && bulkQty <= p.minStockAlert : variantStocks.some((vs) => vs.qty <= vs.minStock));
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
                        <div className="text-[11px] text-[#64748B]">
                          {p.subGroup} · <span className="font-medium">{prepType}</span>
                          {p.isGroupStock ? ` · Group (${bulkUnit})` : ''}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-[12px] font-medium text-[#181210]">
                          By {getSoldByDisplayLabel(p.unitType)} ({p.baseUnitLabel})
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
                        {isMadeFresh ? (
                          <div className="text-[12px] font-semibold text-[#15803D]">Made Fresh</div>
                        ) : p.isGroupStock ? (
                          <>
                            <div className="font-semibold text-[#181210]">
                              {formatStockQty(bulkQty, bulkUnit)} bulk
                            </div>
                            {totalVarQty > 0 && (
                              <div className="text-[10.5px] text-[#64748B] truncate max-w-[200px] ml-auto">
                                {variantStocks
                                  .filter((vs) => vs.qty > 0)
                                  .map((vs) => `${vs.variant.label}: ${roundQty(vs.qty)}`)
                                  .join(' · ')}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {!p.isActive ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#E5E7EB] text-[#64748B]">
                            Inactive
                          </span>
                        ) : isMadeFresh ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-[#DCFCE7] text-[#15803D]">
                            Available
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
        <div className="px-3.5 sm:px-5 py-3 border-t border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-[12px] text-[#64748B]">
          <span className="tabular-nums">
            Page {page} of {totalPages} · {filteredProducts.length} total items
          </span>
          <div className="flex items-center gap-1 flex-wrap">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between">
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
              className="p-4 sm:p-5 space-y-3.5"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-4 sm:px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-[#181210] truncate">
                {editingProduct ? `Edit Product — ${editingProduct.name}` : 'Add New Menu Product'}
              </h3>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="text-[#64748B] hover:text-[#181210] shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-[13px]">
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
                <div ref={subGroupContainerRef} className="relative">
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Sub-Group
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formSubGroup}
                      onFocus={() => setShowSubGroupDropdown(true)}
                      onChange={(e) => {
                        setFormSubGroup(e.target.value);
                        setShowSubGroupDropdown(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setShowSubGroupDropdown(false);
                        } else if (e.key === 'Enter' && showSubGroupDropdown && formSubGroup.trim()) {
                          e.preventDefault();
                          handleSelectOrCreateSubgroup(formSubGroup);
                        }
                      }}
                      placeholder="Select or type to create subgroup..."
                      role="combobox"
                      aria-expanded={showSubGroupDropdown}
                      aria-haspopup="listbox"
                      className="w-full pl-3 pr-8 py-2 border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label="Toggle subgroup options"
                      onClick={() => setShowSubGroupDropdown((prev) => !prev)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[#64748B] hover:text-[#181210]"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  {showSubGroupDropdown && (
                    <div
                      role="listbox"
                      className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-[#E5E7EB] rounded-md shadow-lg py-1"
                    >
                      {matchingSubgroups.map((sg) => {
                        const isSelected = sg.toLowerCase() === formSubGroup.trim().toLowerCase();
                        return (
                          <button
                            key={sg}
                            type="button"
                            onClick={() => handleSelectOrCreateSubgroup(sg)}
                            className={`w-full text-left px-3 py-1.5 text-[12.5px] flex items-center justify-between hover:bg-[#FAF9F5] ${
                              isSelected ? 'bg-[#FFF7ED] text-[#C2410C] font-semibold' : 'text-[#181210]'
                            }`}
                          >
                            <span className="truncate">{sg}</span>
                            {isSelected && (
                              <span className="text-[10.5px] font-semibold text-[#C2410C]">
                                Selected
                              </span>
                            )}
                          </button>
                        );
                      })}

                      {formSubGroup.trim() && !exactSubGroupMatch && (
                        <button
                          type="button"
                          onClick={() => handleSelectOrCreateSubgroup(formSubGroup)}
                          className="w-full text-left px-3 py-1.5 text-[12.5px] font-semibold text-[#C2410C] bg-[#FFF7ED]/70 hover:bg-[#FFF7ED] border-t border-[#E5E7EB]/80 flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">Create &ldquo;{formSubGroup.trim()}&rdquo;</span>
                        </button>
                      )}

                      {matchingSubgroups.length === 0 && !formSubGroup.trim() && (
                        <div className="px-3 py-2 text-[12px] text-[#64748B]">
                          Type a subgroup name to create one.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div
                className={`grid grid-cols-1 sm:grid-cols-2 ${
                  formUnitType === 'weight' ? 'md:grid-cols-3' : 'md:grid-cols-2'
                } gap-3`}
              >
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Preparation Type
                  </label>
                  <select
                    value={formPrepType}
                    onChange={(e) => {
                      const next = e.target.value as PreparationType;
                      setFormPrepType(next);
                      if (next === 'Made Fresh') {
                        setFormIsGroupStock(false);
                      }
                    }}
                    aria-label="Preparation Type"
                    className="w-full h-9 px-2.5 border border-[#E5E7EB] rounded-md bg-white text-[13px] focus:outline-none focus:border-[#FB923C]"
                  >
                    <option value="Made Fresh">Made Fresh</option>
                    <option value="Pre-Cooked">Pre-Cooked</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Sold By
                  </label>
                  <select
                    value={formUnitType}
                    onChange={(e) => handleUnitTypeChange(e.target.value as UnitType)}
                    aria-label="Sold By"
                    className="w-full h-9 px-2.5 border border-[#E5E7EB] rounded-md bg-white text-[13px] focus:outline-none focus:border-[#FB923C]"
                  >
                    <option value="piece">Piece</option>
                    <option value="weight">Weight</option>
                    <option value="volume">Volume</option>
                    <option value="box">Pack / Box</option>
                    <option value="cake">Cake</option>
                  </select>
                </div>
                {formUnitType === 'weight' && (
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
                            prev.map((v) => {
                              const grams =
                                computeWeightGramsFromRow(v.label, v.unitLabel) ||
                                v.weightGrams ||
                                0;
                              return grams > 0
                                ? {
                                    ...v,
                                    weightGrams: grams,
                                    price: computeWeightPriceFromGrams(parsed, grams),
                                  }
                                : v;
                            })
                          );
                        }
                      }}
                      className="w-full h-9 px-2.5 border border-[#E5E7EB] rounded-md text-[13px] tabular-nums focus:outline-none focus:border-[#FB923C]"
                    />
                  </div>
                )}
              </div>

              {formUnitType === 'weight' && (
                <div className="px-3.5 py-3 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 sm:gap-4">
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
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[12px] font-semibold text-[#181210]">
                      Size &amp; Unit &amp; Pricing
                    </span>
                    {formUnitType === 'weight' && (
                      <span className="ml-2 text-[11px] text-[#64748B]">
                        Price auto-calculates from Rate / kg
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newId = `v-${Date.now()}`;
                      setFormVariants((prev) => {
                        const nextIdx = prev.length + 1;
                        if (formUnitType === 'weight') {
                          const rate = Number(formPricePerKg) || 0;
                          return [
                            ...prev,
                            {
                              id: newId,
                              label: '250',
                              weightGrams: 250,
                              price: computeWeightPriceFromGrams(rate, 250),
                              skuSuffix: `V${nextIdx}`,
                              unitLabel: 'Gram',
                            },
                          ];
                        }
                        const presetByType: Record<
                          Exclude<UnitType, 'weight'>,
                          { label: string; price: number; unitLabel: string }
                        > = {
                          piece: { label: 'Large', price: 150, unitLabel: 'Pic' },
                          volume: { label: '500 ML', price: 80, unitLabel: 'ML' },
                          box: { label: '1 Kg Gift Box', price: 950, unitLabel: 'Box' },
                          cake: { label: '2 Kg Celebration Cake', price: 1600, unitLabel: 'KG' },
                        };
                        const preset = presetByType[formUnitType];
                        return [
                          ...prev,
                          {
                            id: newId,
                            label: preset.label,
                            price: preset.price,
                            skuSuffix: `V${nextIdx}`,
                            unitLabel: preset.unitLabel,
                          },
                        ];
                      });
                    }}
                    className="text-[12px] font-semibold text-[#FB923C] hover:text-[#F97316] whitespace-nowrap"
                  >
                    + Add Variant
                  </button>
                </div>

                {(() => {
                  const isWeight = formUnitType === 'weight';
                  const allowedUnits = getAllowedVariantUnits(formUnitType);
                  const gridColsClass = 'md:grid-cols-[minmax(0,2fr)_110px_115px_64px_44px]';
                  const variantPlaceholder =
                    formUnitType === 'weight'
                      ? 'e.g. 250'
                      : formUnitType === 'volume'
                      ? 'e.g. 250 ML'
                      : formUnitType === 'box'
                      ? 'e.g. Box of 6'
                      : formUnitType === 'cake'
                      ? 'e.g. 1 Kg Truffle Cake'
                      : 'e.g. Regular';

                  return (
                    <div className="space-y-2">
                      {/* Desktop Column Headers */}
                      <div
                        className={`hidden md:grid ${gridColsClass} gap-2.5 items-center text-[10.5px] font-semibold uppercase tracking-wide text-[#64748B] px-0.5`}
                      >
                        <span>Variant</span>
                        <span>Price (₹)</span>
                        <span>Unit</span>
                        <span className="text-center">Default</span>
                        <span className="text-center">Action</span>
                      </div>

                      {formVariants.map((v, idx) => {
                        const isRowDefault =
                          Boolean(v.isDefault) ||
                          (!formVariants.some((x) => x.isDefault) && idx === 0);
                        const normalizedUnit = normalizeVariantUnitForType(
                          formUnitType,
                          v.unitLabel
                        );

                        return (
                          <div
                            key={v.id}
                            className={`grid grid-cols-2 ${gridColsClass} gap-2.5 items-center p-2.5 md:p-0 bg-white md:bg-transparent rounded-md md:rounded-none border border-[#E5E7EB] md:border-0`}
                          >
                            {/* Variant */}
                            <div className="col-span-2 md:col-span-1 min-w-0">
                              <span className="block md:hidden text-[10px] font-semibold uppercase text-[#64748B] mb-1">
                                {isWeight ? 'Variant (Weight Qty)' : 'Variant'}
                              </span>
                              <input
                                type={isWeight ? 'number' : 'text'}
                                min={isWeight ? 0.01 : undefined}
                                step={isWeight ? 'any' : undefined}
                                value={v.label}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  setFormVariants((prev) =>
                                    prev.map((item, i) => {
                                      if (i !== idx) return item;
                                      if (!isWeight) {
                                        return { ...item, label: raw };
                                      }
                                      const grams = computeWeightGramsFromRow(
                                        raw,
                                        item.unitLabel
                                      );
                                      const rate = Number(formPricePerKg) || 0;
                                      return {
                                        ...item,
                                        label: raw,
                                        weightGrams: grams > 0 ? grams : undefined,
                                        price:
                                          grams > 0
                                            ? computeWeightPriceFromGrams(rate, grams)
                                            : 0,
                                      };
                                    })
                                  );
                                }}
                                placeholder={variantPlaceholder}
                                aria-label={isWeight ? 'Variant weight quantity' : 'Variant name'}
                                className="w-full h-9 px-2.5 text-[12.5px] bg-white border border-[#E5E7EB] rounded-md tabular-nums focus:outline-none focus:border-[#FB923C]"
                                required
                              />
                            </div>

                            {/* Price (₹) */}
                            <div className="min-w-0">
                              <span className="block md:hidden text-[10px] font-semibold uppercase text-[#64748B] mb-1">
                                Price (₹)
                              </span>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={Number.isFinite(v.price) ? v.price : ''}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  const parsed = raw === '' ? 0 : Number(raw);
                                  setFormVariants((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, price: parsed } : item
                                    )
                                  );
                                }}
                                placeholder="0"
                                aria-label="Variant price"
                                className="w-full h-9 px-2.5 text-[12.5px] bg-white border border-[#E5E7EB] rounded-md tabular-nums focus:outline-none focus:border-[#FB923C]"
                                required
                              />
                            </div>

                            {/* Unit Dropdown */}
                            <div className="min-w-0">
                              <span className="block md:hidden text-[10px] font-semibold uppercase text-[#64748B] mb-1">
                                Unit
                              </span>
                              <select
                                value={normalizedUnit}
                                onChange={(e) => {
                                  const nextUnit = e.target.value;
                                  setFormVariants((prev) =>
                                    prev.map((item, i) => {
                                      if (i !== idx) return item;
                                      if (!isWeight) {
                                        return { ...item, unitLabel: nextUnit };
                                      }
                                      const grams = computeWeightGramsFromRow(
                                        item.label,
                                        nextUnit
                                      );
                                      const rate = Number(formPricePerKg) || 0;
                                      return {
                                        ...item,
                                        unitLabel: nextUnit,
                                        weightGrams: grams > 0 ? grams : item.weightGrams,
                                        price:
                                          grams > 0
                                            ? computeWeightPriceFromGrams(rate, grams)
                                            : item.price,
                                      };
                                    })
                                  );
                                }}
                                aria-label="Variant unit"
                                className="w-full h-9 px-2 text-[12.5px] bg-white border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                              >
                                {allowedUnits.map((unitOpt) => (
                                  <option key={unitOpt} value={unitOpt}>
                                    {unitOpt}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Default Selection */}
                            <div className="flex items-center md:justify-center h-9">
                              <label className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[#64748B] md:gap-0 cursor-pointer">
                                <input
                                  type="radio"
                                  name="defaultVariantRadio"
                                  checked={isRowDefault}
                                  onChange={() =>
                                    setFormVariants((prev) =>
                                      prev.map((item, i) => ({
                                        ...item,
                                        isDefault: i === idx,
                                      }))
                                    )
                                  }
                                  title="Set as default POS variant"
                                  className="w-4 h-4 accent-[#FB923C] cursor-pointer"
                                />
                                <span className="md:hidden">Default option</span>
                              </label>
                            </div>

                            {/* Action (Remove Variant) */}
                            <div className="flex items-center justify-end md:justify-center h-9">
                              <button
                                type="button"
                                disabled={formVariants.length <= 1}
                                onClick={() =>
                                  setFormVariants((prev) => {
                                    const filtered = prev.filter((_, i) => i !== idx);
                                    if (!filtered.some((x) => x.isDefault) && filtered.length > 0) {
                                      return filtered.map((x, fIdx) => ({
                                        ...x,
                                        isDefault: fIdx === 0,
                                      }));
                                    }
                                    return filtered;
                                  })
                                }
                                className="w-8 h-8 rounded-md text-[#B91C1C] hover:bg-[#FEE2E2] disabled:opacity-30 disabled:hover:bg-transparent inline-flex items-center justify-center transition-colors"
                                aria-label="Remove variant"
                                title="Remove variant"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {formPrepType === 'Pre-Cooked' ? (
                <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] space-y-3">
                  {formUnitType === 'weight' && (
                    <>
                      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-semibold text-[#181210]">
                            Group / Bulk Stock Management
                          </div>
                          <div className="text-[11px] text-[#64748B] mt-0.5">
                            {formIsGroupStock
                              ? 'ON — Track a parent bulk stock pool (in kg) and split into smaller quantities in Stock Management.'
                              : 'OFF — Track stock separately for each configured variant above.'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[11px] font-bold uppercase tabular-nums ${
                              formIsGroupStock ? 'text-[#C2410C]' : 'text-[#64748B]'
                            }`}
                          >
                            {formIsGroupStock ? 'ON' : 'OFF'}
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={formIsGroupStock}
                            aria-label="Group / Bulk Stock Management"
                            onClick={() => setFormIsGroupStock((prev) => !prev)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#FB923C]/40 ${
                              formIsGroupStock ? 'bg-[#FB923C]' : 'bg-[#D1D5DB]'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                formIsGroupStock ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {formIsGroupStock && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-[#E5E7EB]">
                          <div>
                            <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                              Bulk Stock Unit
                            </label>
                            <select
                              value={formBulkUnit}
                              onChange={(e) => setFormBulkUnit(e.target.value)}
                              className="w-full h-9 px-2.5 border border-[#E5E7EB] rounded-md bg-white text-[12.5px]"
                            >
                              <option value="kg">Kilogram (kg)</option>
                              <option value="litre">Litre (litre)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                              {editingProduct ? 'Current Bulk Stock' : 'Opening Bulk Stock'} ({formBulkUnit})
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={formBulkStockQty}
                              onChange={(e) => setFormBulkStockQty(e.target.value)}
                              placeholder="e.g. 25"
                              className="w-full h-9 px-2.5 border border-[#E5E7EB] rounded-md bg-white text-[12.5px] tabular-nums"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div
                    className={`flex items-center justify-between gap-3 ${
                      formUnitType === 'weight' ? 'pt-2.5 border-t border-[#E5E7EB]' : ''
                    }`}
                  >
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
                </div>
              ) : (
                <div className="px-3.5 py-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] text-[12px] text-[#64748B]">
                  <strong className="text-[#181210]">Made Fresh:</strong> Prepared on demand — no stock entry or stock-in/out tracking required.
                </div>
              )}

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

              <div className="flex items-center justify-between gap-4 pt-2 border-t border-[#E5E7EB]">
                <div>
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

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-3 border-t border-[#E5E7EB]">
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

      {/* Delete Category Confirmation Modal */}
      {categoryToDelete && (() => {
        const assignedProducts = products.filter((p) => p.categoryId === categoryToDelete.id);
        const hasAssigned = assignedProducts.length > 0;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
            <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-md p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg shrink-0 ${
                    hasAssigned ? 'bg-[#FFEDD5] text-[#C2410C]' : 'bg-[#FEE2E2] text-[#DC2626]'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-semibold text-[#181210]">
                    {hasAssigned
                      ? `Cannot Delete "${categoryToDelete.name}"`
                      : `Delete "${categoryToDelete.name}" Category?`}
                  </h3>
                  {categoryToDelete.description && (
                    <p className="text-[12px] text-[#64748B] mt-0.5 truncate">
                      {categoryToDelete.description}
                    </p>
                  )}
                  {hasAssigned ? (
                    <div className="text-[13px] text-[#475569] mt-2 space-y-2">
                      <p>
                        This category currently has{' '}
                        <strong className="text-[#181210]">
                          {assignedProducts.length} assigned product
                          {assignedProducts.length === 1 ? '' : 's'}
                        </strong>
                        . To prevent accidental data loss, categories with products cannot be
                        deleted directly.
                      </p>
                      <p className="text-[12px] text-[#64748B]">
                        Reassign those products to another category or delete them first, then try
                        deleting this category again.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-[#64748B] mt-2">
                      This category has no assigned products and will be permanently removed from Menu
                      Categories and POS Billing navigation.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setCategoryToDelete(null)}
                  className="px-3.5 py-2 text-[12px] font-medium border border-[#E5E7EB] rounded-md text-[#181210] hover:bg-[#FAF9F5]"
                >
                  Cancel
                </button>
                {hasAssigned ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCatId(categoryToDelete.id);
                      setSelectedSubGroup('all');
                      setPage(1);
                      setCategoryToDelete(null);
                    }}
                    className="px-4 py-2 text-[12px] font-semibold bg-[#FB923C] hover:bg-[#F97316] text-white rounded-md"
                  >
                    View Assigned Products
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const deletedId = categoryToDelete.id;
                      const res = deleteCategory(deletedId);
                      if (res.ok && selectedCatId === deletedId) {
                        setSelectedCatId('all');
                        setSelectedSubGroup('all');
                        setPage(1);
                      }
                      setCategoryToDelete(null);
                    }}
                    className="px-4 py-2 text-[12px] font-semibold bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-md"
                  >
                    Delete Category
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-sm p-4 sm:p-5">
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
