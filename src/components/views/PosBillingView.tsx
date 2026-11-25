import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Cake,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Minus,
  PauseCircle,
  Plus,
  Printer,
  Receipt,
  ShoppingBag,
  Star,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { usePos } from '../../context/PosContext';
import { ProductThumb } from '../common/ProductThumb';
import { CategoryIcon } from '../../utils/categoryIcons';
import {
  HeldOrder,
  PaymentEntry,
  PaymentMethod,
  Product,
} from '../../types/pos';
import {
  computeOrderFinancials,
  formatDecimal,
  formatINR,
  formatINRCompact,
  formatWeightDisplay,
  roundCurrency,
  roundQty,
  roundWeightGrams,
  roundWeightKg,
} from '../../utils/formatters';

type WeightUnit = 'g' | 'kg';

function formatHoldTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export const PosBillingView: React.FC = () => {
  const {
    categories,
    products,
    globalSearch,
    getProductDefaultVariant,
    getVariantStock,
    getVariantMinStock,
    lowStockProducts,
    expiringSoonBatches,
    setActiveNav,
    toggleProductFavourite,
    cart,
    cartCustomerName,
    setCartCustomerName,
    cartCustomerPhone,
    setCartCustomerPhone,
    customers,
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
    heldOrders,
    holdCurrentOrder,
    resumeHeldOrder,
    deleteHeldOrder,
    completeSale,
    settings,
    pushToast,
    activeBranch,
    activeBranchId,
    hasPermission,
  } = usePos();

  const canCreateBill = hasPermission('pos', 'create');
  const isBranchActive = activeBranch.status === 'Active';
  const canBill = canCreateBill && isBranchActive;

  const branchHeldOrders = useMemo(
    () => heldOrders.filter((h) => (h.branchId ?? 'br-1') === activeBranchId),
    [heldOrders, activeBranchId]
  );

  const branchPackagingFee =
    activeBranch.operationalSettings.packagingFee ?? settings.defaultPackagingFee;
  const branchTaxRate =
    activeBranch.operationalSettings.taxRate ?? settings.defaultTaxRate;

  // Category, Dynamic Subcategory (top row), and Unit Type (second row) state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubGroup, setSelectedSubGroup] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<'all' | 'weight' | 'piece' | 'box'>('all');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Selected variant per quantity-based card (zero-popup inline switching)
  const [cardVariantMap, setCardVariantMap] = useState<Record<string, string>>({});

  // Reusable Top Selected-Product Configuration Area (Zero Popups)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const selectedProduct = useMemo(
    () => (selectedProductId ? products.find((p) => p.id === selectedProductId) ?? null : null),
    [products, selectedProductId]
  );

  // Weight configuration state (exclusive mode: either 'preset' or 'custom')
  const [weightSelectionMode, setWeightSelectionMode] = useState<'preset' | 'custom'>('preset');
  const [selectedPresetGrams, setSelectedPresetGrams] = useState<number>(500);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('g');
  const [weightInput, setWeightInput] = useState<string>('');
  const [weightQty, setWeightQty] = useState<number>(1);

  // Piece / Box configuration state (for piece/box products in reusable top bar)
  const [selectedTopVariantId, setSelectedTopVariantId] = useState<string>('');
  const [pieceQty, setPieceQty] = useState<number>(1);

  const [lastAddedProductId, setLastAddedProductId] = useState<string | null>(null);
  const lastAddedTimerRef = useRef<number | null>(null);

  // Customer dropdown & mobile tickets collapse
  const [showCustLookup, setShowCustLookup] = useState(false);
  const [mobileTicketsOpen, setMobileTicketsOpen] = useState(false);

  // Order summary expandable payment & charges
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [paymentMode, setPaymentMode] = useState<PaymentMethod | 'Split'>(
    settings.acceptedPaymentMethods[0] ?? 'UPI'
  );
  const [splitAmounts, setSplitAmounts] = useState<Record<PaymentMethod, string>>({
    Cash: '',
    UPI: '',
    Card: '',
  });

  useEffect(() => {
    if (paymentMode === 'Split' && cartTotals.grandTotal > 0) {
      const half = roundCurrency(cartTotals.grandTotal / 2);
      const rest = roundCurrency(cartTotals.grandTotal - half);
      setSplitAmounts({
        Cash: String(half),
        UPI: String(rest),
        Card: '0',
      });
    }
  }, [paymentMode, cartTotals.grandTotal]);

  useEffect(() => {
    return () => {
      if (lastAddedTimerRef.current) {
        window.clearTimeout(lastAddedTimerRef.current);
      }
    };
  }, []);

  const markRecentlyAdded = (productId: string) => {
    setLastAddedProductId(productId);
    if (lastAddedTimerRef.current) {
      window.clearTimeout(lastAddedTimerRef.current);
    }
    lastAddedTimerRef.current = window.setTimeout(() => {
      setLastAddedProductId(null);
    }, 1200);
  };

  // Products scoped by Main Category (used to populate the top Subcategories row)
  const categoryScopedProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.isActive) return false;
      if (selectedCategory === 'favourites' && !p.isFavourite) return false;
      if (
        selectedCategory !== 'all' &&
        selectedCategory !== 'favourites' &&
        p.categoryId !== selectedCategory
      ) {
        return false;
      }
      return true;
    });
  }, [products, selectedCategory]);

  // Dynamic Subcategories based on selected Main Category (displayed on TOP row)
  const subcategories = useMemo(() => {
    const map = new Map<string, number>();
    categoryScopedProducts.forEach((p) => {
      const key = p.subGroup?.trim() || 'Other';
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [categoryScopedProducts]);

  // Ensure selectedSubGroup stays valid when switching Main Category
  useEffect(() => {
    if (
      selectedSubGroup !== 'all' &&
      !subcategories.some((sub) => sub.name === selectedSubGroup)
    ) {
      setSelectedSubGroup('all');
    }
  }, [subcategories, selectedSubGroup]);

  const handleSelectCategory = (catId: string) => {
    setSelectedCategory(catId);
    setSelectedSubGroup('all');
    setSelectedProductId(null);
  };

  useEffect(() => {
    setSelectedProductId(null);
  }, [activeBranchId]);

  const handleSelectUnitFilter = (nextUnit: 'all' | 'weight' | 'piece' | 'box') => {
    setUnitFilter(nextUnit);
  };

  const filteredProducts = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return categoryScopedProducts.filter((p) => {
      if (selectedSubGroup !== 'all' && (p.subGroup?.trim() || 'Other') !== selectedSubGroup) {
        return false;
      }
      if (unitFilter !== 'all' && p.unitType !== unitFilter) {
        return false;
      }
      if (q) {
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.subGroup.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [categoryScopedProducts, selectedSubGroup, unitFilter, globalSearch]);

  // Helper: get product default weight in grams
  const getDefaultWeightGrams = (product: Product): number =>
    product.defaultWeightGrams ??
    product.variants.find((v) => v.weightGrams && v.weightGrams > 0)?.weightGrams ??
    500;

  // Helper: get product price per kg
  const getPricePerKg = (product: Product): number => {
    if (product.pricePerKg && product.pricePerKg > 0) return roundCurrency(product.pricePerKg);
    const kgVariant = product.variants.find((v) => v.weightGrams === 1000);
    if (kgVariant) return roundCurrency(kgVariant.price);
    const first = product.variants[0];
    if (first?.weightGrams && first.weightGrams > 0) {
      return roundCurrency((first.price * 1000) / first.weightGrams);
    }
    return roundCurrency(first?.price ?? 500);
  };

  // Helper: get presets for a weight product (250g, 500g, 750g, 1kg, 2kg + product variants)
  const getWeightPresetsForProduct = (product: Product) => {
    const defaultGrams = getDefaultWeightGrams(product);
    const pricePerKg = getPricePerKg(product);

    const map = new Map<
      number,
      {
        grams: number;
        label: string;
        price: number;
        isDefault: boolean;
        variantId?: string;
        skuSuffix?: string;
      }
    >();

    const register = (
      grams: number,
      label: string,
      variantId?: string,
      skuSuffix?: string,
      explicitPrice?: number
    ) => {
      if (!grams || grams <= 0) return;
      const dynamicPrice = roundCurrency((pricePerKg * grams) / 1000);
      const computedPrice =
        explicitPrice !== undefined && (!product.pricePerKg || product.pricePerKg <= 0)
          ? roundCurrency(explicitPrice)
          : dynamicPrice;
      const existing = map.get(grams);
      if (!existing || variantId) {
        map.set(grams, {
          grams,
          label,
          price: computedPrice,
          isDefault: Math.abs(grams - defaultGrams) < 0.01,
          variantId,
          skuSuffix,
        });
      }
    };

    [250, 500, 750, 1000, 2000].forEach((g) => {
      register(g, g >= 1000 ? `${formatDecimal(g / 1000, 3)} kg` : `${g} g`);
    });

    product.variants.forEach((v) => {
      if (v.weightGrams && v.weightGrams > 0) {
        register(v.weightGrams, v.label, v.id, v.skuSuffix, v.price);
      }
    });

    if (!map.has(defaultGrams)) {
      register(defaultGrams, formatWeightDisplay(defaultGrams));
    }

    return Array.from(map.values()).sort((a, b) => a.grams - b.grams);
  };

  // Populate / update the reusable top selection bar ONLY for weight or multi-variant products
  const selectProductForTopBar = (product: Product, presetGrams?: number) => {
    if (product.unitType !== 'weight' && product.variants.length <= 1) {
      setSelectedProductId(null);
      return;
    }
    setSelectedProductId(product.id);
    if (product.unitType === 'weight') {
      const presets = getWeightPresetsForProduct(product);
      const defaultVar = getProductDefaultVariant(product);
      const mappedVarId = cardVariantMap[product.id];
      const mappedVar = product.variants.find((v) => v.id === mappedVarId);
      const targetGrams =
        presetGrams ??
        mappedVar?.weightGrams ??
        defaultVar?.weightGrams ??
        getDefaultWeightGrams(product);
      const matched = presets.find((p) => Math.abs(p.grams - targetGrams) < 0.01);
      if (matched?.variantId) {
        setCardVariantMap((prev) => ({ ...prev, [product.id]: matched.variantId! }));
      }
      setWeightSelectionMode('preset');
      setSelectedPresetGrams(targetGrams);
      setWeightUnit('g');
      setWeightInput('');
      setWeightQty(1);
    } else {
      const defaultVar = getProductDefaultVariant(product);
      const activeVarId =
        cardVariantMap[product.id] ?? defaultVar?.id ?? product.variants[0]?.id ?? '';
      setSelectedTopVariantId(activeVarId);
      setPieceQty(1);
    }
  };

  // Weight configuration data for the reusable top bar
  const inlineWeightData = useMemo(() => {
    if (!selectedProduct || selectedProduct.unitType !== 'weight') return null;
    const allowCustomWeight = selectedProduct.allowCustomWeight !== false;
    const effectiveMode: 'preset' | 'custom' = allowCustomWeight ? weightSelectionMode : 'preset';
    const defaultGrams = getDefaultWeightGrams(selectedProduct);
    const pricePerKg = getPricePerKg(selectedProduct);
    const presets = getWeightPresetsForProduct(selectedProduct);

    let weightInGrams = 0;
    let validationError: string | null = null;

    if (effectiveMode === 'preset') {
      weightInGrams =
        selectedPresetGrams > 0 ? roundWeightGrams(selectedPresetGrams) : defaultGrams;
    } else {
      const trimmed = weightInput.trim();
      const parsedNum = Number(trimmed);
      if (!trimmed) {
        validationError = 'Enter a custom weight.';
      } else if (!Number.isFinite(parsedNum)) {
        validationError = 'Enter a valid numeric weight.';
      } else if (parsedNum <= 0) {
        validationError = 'Weight must be greater than zero.';
      } else {
        const computedGrams =
          weightUnit === 'kg'
            ? roundWeightGrams(parsedNum * 1000)
            : roundWeightGrams(parsedNum);
        if (computedGrams <= 0) {
          validationError = 'Weight must be greater than zero.';
        } else if (computedGrams > 50000) {
          validationError = 'Maximum single-line weight is 50 kg.';
        } else {
          weightInGrams = computedGrams;
        }
      }
    }

    const matchedPreset =
      effectiveMode === 'preset'
        ? presets.find((p) => Math.abs(p.grams - weightInGrams) < 0.01)
        : undefined;

    const unitPrice =
      weightInGrams > 0
        ? matchedPreset
          ? roundCurrency(matchedPreset.price)
          : roundCurrency((pricePerKg * weightInGrams) / 1000)
        : 0;
    const totalPrice = roundCurrency(unitPrice * weightQty);

    const convertedDisplay =
      weightInGrams > 0
        ? weightUnit === 'g'
          ? `${formatDecimal(roundWeightKg(weightInGrams / 1000), 3)} kg`
          : `${formatDecimal(roundWeightGrams(weightInGrams), 1)} g`
        : null;

    return {
      allowCustomWeight,
      effectiveMode,
      defaultGrams,
      pricePerKg,
      presets,
      weightInGrams,
      validationError,
      matchedPreset,
      unitPrice,
      totalPrice,
      convertedDisplay,
    };
  }, [
    selectedProduct,
    weightSelectionMode,
    selectedPresetGrams,
    weightInput,
    weightUnit,
    weightQty,
  ]);

  // Piece / Box configuration data for the reusable top bar
  const inlinePieceData = useMemo(() => {
    if (!selectedProduct || selectedProduct.unitType === 'weight') return null;
    const variant =
      selectedProduct.variants.find((v) => v.id === selectedTopVariantId) ??
      selectedProduct.variants[0];
    const unitPrice = roundCurrency(variant?.price ?? 0);
    const totalPrice = roundCurrency(unitPrice * pieceQty);
    return {
      variant,
      unitPrice,
      totalPrice,
    };
  }, [selectedProduct, selectedTopVariantId, pieceQty]);

  const handleToggleWeightUnit = (nextUnit: WeightUnit) => {
    if (nextUnit === weightUnit) return;
    if (weightSelectionMode === 'custom') {
      const val = parseFloat(weightInput);
      if (Number.isFinite(val) && val > 0) {
        if (nextUnit === 'kg') {
          setWeightInput(String(roundWeightKg(val / 1000)));
        } else {
          setWeightInput(String(roundWeightGrams(val * 1000)));
        }
      }
    }
    setWeightUnit(nextUnit);
  };

  const handleSelectWeightPreset = (grams: number) => {
    if (selectedProduct) {
      const matched = getWeightPresetsForProduct(selectedProduct).find(
        (p) => Math.abs(p.grams - grams) < 0.01
      );
      if (matched?.variantId) {
        setCardVariantMap((prev) => ({
          ...prev,
          [selectedProduct.id]: matched.variantId!,
        }));
      }
    }
    setWeightSelectionMode('preset');
    setSelectedPresetGrams(grams);
    setWeightInput('');
  };

  const handleCustomWeightInputChange = (val: string) => {
    setWeightSelectionMode('custom');
    setWeightInput(val);
  };

  const handleFocusCustomWeight = () => {
    setWeightSelectionMode('custom');
  };

  const handleAddConfiguredToBill = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedProduct || !canBill) return;

    if (selectedProduct.unitType === 'weight') {
      if (!inlineWeightData) return;
      if (inlineWeightData.validationError || inlineWeightData.weightInGrams <= 0) return;

      const grams = inlineWeightData.weightInGrams;
      const variantId =
        inlineWeightData.matchedPreset?.variantId ?? `wt-${formatDecimal(grams, 1)}g`;
      const variantLabel =
        inlineWeightData.matchedPreset?.label ?? formatWeightDisplay(grams);
      const skuSuffix =
        inlineWeightData.matchedPreset?.skuSuffix ?? `${Math.round(grams)}G`;

      addToCart({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sku: `${selectedProduct.sku}-${skuSuffix}`,
        imageUrl: selectedProduct.imageUrl,
        unitType: 'weight',
        variantId,
        variantLabel,
        unitPrice: inlineWeightData.unitPrice,
        quantity: weightQty,
        weightInGrams: grams,
        taxRate: selectedProduct.taxRate,
        gstTreatment: selectedProduct.gstTreatment,
        baseUnitDeduction: roundWeightKg(grams / 1000),
      });

      markRecentlyAdded(selectedProduct.id);
      pushToast(
        `Added ${weightQty > 1 ? `${weightQty} × ` : ''}${variantLabel} ${selectedProduct.name} to bill.`
      );
      setWeightQty(1);
    } else {
      if (!inlinePieceData?.variant) return;
      const v = inlinePieceData.variant;
      addToCart({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sku: `${selectedProduct.sku}-${v.skuSuffix}`,
        imageUrl: selectedProduct.imageUrl,
        unitType: selectedProduct.unitType,
        variantId: v.id,
        variantLabel: v.label,
        unitPrice: roundCurrency(v.price),
        quantity: pieceQty,
        taxRate: selectedProduct.taxRate,
        gstTreatment: selectedProduct.gstTreatment,
        baseUnitDeduction: 1,
      });
      markRecentlyAdded(selectedProduct.id);
      pushToast(
        `Added ${pieceQty} × ${selectedProduct.name} (${v.label}) to bill.`
      );
      setPieceQty(1);
    }
  };

  const computeHeldTotal = (held: HeldOrder): number => {
    const hasOverride = branchTaxRate !== settings.defaultTaxRate;
    return computeOrderFinancials({
      items: held.items,
      discountType: held.discountType,
      discountValue: held.discountValue,
      packagingCharge: held.packagingCharge,
      activeBranchTaxRate: branchTaxRate,
      hasBranchTaxOverride: hasOverride,
    }).grandTotal;
  };

  const quickAddQuantityVariant = (
    product: Product,
    variantId?: string,
    qty: number = 1
  ) => {
    if (!canBill) return;
    const defaultVar = getProductDefaultVariant(product);
    const variant =
      product.variants.find((v) => v.id === variantId) ??
      defaultVar ??
      product.variants[0];
    if (!variant) return;
    addToCart({
      productId: product.id,
      productName: product.name,
      sku: `${product.sku}-${variant.skuSuffix}`,
      imageUrl: product.imageUrl,
      unitType: product.unitType,
      variantId: variant.id,
      variantLabel: variant.label,
      unitPrice: roundCurrency(variant.price),
      quantity: qty,
      taxRate: product.taxRate,
      gstTreatment: product.gstTreatment,
      baseUnitDeduction: 1,
    });
    markRecentlyAdded(product.id);
  };

  const handleCheckout = () => {
    if (!isBranchActive) {
      pushToast(`Cannot bill on inactive branch "${activeBranch.name}".`, 'error');
      return;
    }
    if (!canCreateBill) {
      pushToast('Your role does not have permission to generate POS bills.', 'error');
      return;
    }
    if (cart.length === 0) {
      pushToast('Select items from the bakery catalog to generate a bill.', 'warning');
      return;
    }
    let payments: PaymentEntry[] = [];
    if (paymentMode === 'Split') {
      (['Cash', 'UPI', 'Card'] as PaymentMethod[]).forEach((m) => {
        const val = parseFloat(splitAmounts[m] || '0');
        if (val > 0) payments.push({ method: m, amount: roundCurrency(val) });
      });
    } else {
      payments = [{ method: paymentMode, amount: cartTotals.grandTotal }];
    }
    completeSale({ payments });
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        if (canBill) holdCurrentOrder();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const matchingCustomers = customers.filter((c) => {
    const q = (cartCustomerName + ' ' + cartCustomerPhone).trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q);
  });

  const alertCount = lowStockProducts.length + expiringSoonBatches.length;

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-65px)] lg:h-[calc(100vh-65px)] bg-[#E0E2E7] lg:overflow-hidden">
      {/* Left Navigation Panel: Main Categories (top) + Anchored Tickets & Hold Bill (bottom) */}
      <aside className="w-full lg:w-[245px] xl:w-[258px] bg-white border-b lg:border-b-0 lg:border-r border-[#E5E7EB] flex flex-col lg:h-full shrink-0 lg:overflow-hidden">
        {/* Scrollable Top: Main Categories Only (No Separate Subcategory Container) */}
        <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto p-2.5 sm:p-3 space-y-1">
          <div className="px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
            Categories
          </div>

          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0">
            <button
              type="button"
              onClick={() => handleSelectCategory('all')}
              className={`min-h-[38px] px-3 py-2 rounded-md text-[13px] font-medium text-left whitespace-nowrap transition-colors flex items-center justify-between gap-2 shrink-0 ${
                selectedCategory === 'all'
                  ? 'bg-[#FB923C] text-white font-semibold'
                  : 'text-[#181210] hover:bg-[#FAF9F5]'
              }`}
            >
              <span className="inline-flex items-center gap-2 min-w-0">
                <CategoryIcon
                  category="all"
                  className={`w-4 h-4 shrink-0 ${
                    selectedCategory === 'all' ? 'text-white' : 'text-[#FB923C]'
                  }`}
                />
                <span className="truncate">All Products</span>
              </span>
              <span
                className={`text-[11px] tabular-nums ${
                  selectedCategory === 'all' ? 'text-white/90' : 'text-[#64748B]'
                }`}
              >
                {products.filter((p) => p.isActive).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectCategory('favourites')}
              className={`min-h-[38px] px-3 py-2 rounded-md text-[13px] font-medium text-left whitespace-nowrap transition-colors flex items-center justify-between gap-2 shrink-0 ${
                selectedCategory === 'favourites'
                  ? 'bg-[#FB923C] text-white font-semibold'
                  : 'text-[#181210] hover:bg-[#FAF9F5]'
              }`}
            >
              <span className="inline-flex items-center gap-2 min-w-0">
                <CategoryIcon
                  category="favourites"
                  className={`w-4 h-4 shrink-0 ${
                    selectedCategory === 'favourites' ? 'text-white' : 'text-[#FB923C]'
                  }`}
                />
                <span className="truncate">Favourites</span>
              </span>
              <span
                className={`text-[11px] tabular-nums ${
                  selectedCategory === 'favourites' ? 'text-white/90' : 'text-[#64748B]'
                }`}
              >
                {products.filter((p) => p.isActive && p.isFavourite).length}
              </span>
            </button>

            <div className="hidden lg:block h-px bg-[#E5E7EB] my-1.5" />

            {categories.map((cat) => {
              const count = products.filter(
                (p) => p.isActive && p.categoryId === cat.id
              ).length;
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`min-h-[38px] px-3 py-2 rounded-md text-[13px] font-medium text-left whitespace-nowrap transition-colors flex items-center justify-between gap-2 shrink-0 ${
                    active
                      ? 'bg-[#FB923C] text-white font-semibold'
                      : 'text-[#181210] hover:bg-[#FAF9F5]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <CategoryIcon
                      category={cat.name}
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-white' : 'text-[#64748B]'
                      }`}
                    />
                    <span className="truncate">{cat.name}</span>
                  </span>
                  <span
                    className={`text-[11px] tabular-nums shrink-0 ${
                      active ? 'text-white/90' : 'text-[#64748B]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Anchored Section: Tickets & Hold Bill */}
        <div className="shrink-0 border-t border-[#E5E7EB] bg-[#FAF9F5] p-2.5 sm:p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setMobileTicketsOpen((o) => !o)}
              className="flex items-center gap-1.5 min-w-0 lg:pointer-events-none text-left"
              aria-expanded={mobileTicketsOpen}
            >
              <Receipt className="w-3.5 h-3.5 text-[#FB923C] shrink-0" />
              <span className="text-[12px] font-bold text-[#181210]">Tickets</span>
              <span className="text-[11px] text-[#64748B] tabular-nums">
                · {branchHeldOrders.length} held
              </span>
              <span className="lg:hidden text-[#64748B] ml-0.5">
                {mobileTicketsOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </span>
            </button>

            <button
              type="button"
              disabled={!canBill || cart.length === 0}
              onClick={() => holdCurrentOrder()}
              className="px-2.5 py-1.5 rounded-md bg-[#FB923C] hover:bg-[#F97316] disabled:opacity-45 disabled:cursor-not-allowed text-white text-[11px] font-semibold inline-flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
              title="Hold current active bill (F4)"
            >
              <PauseCircle className="w-3.5 h-3.5" />
              Hold Bill (F4)
            </button>
          </div>

          <div
            className={`${
              mobileTicketsOpen ? 'flex' : 'hidden'
            } lg:flex flex-col gap-2`}
          >
            <div className="px-2.5 py-1.5 rounded-md bg-[#181210] text-white flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold truncate">
                Active Bill ({cart.length})
              </span>
              <span className="text-[11px] font-bold text-[#FB923C] tabular-nums shrink-0">
                {formatINRCompact(cartTotals.grandTotal)}
              </span>
            </div>

            <div className="overflow-y-auto max-h-[165px] space-y-1.5 pr-0.5">
              {branchHeldOrders.length === 0 ? (
                <div className="py-2.5 px-2 text-center rounded-md border border-dashed border-[#E5E7EB] bg-white/70 text-[11px] text-[#64748B]">
                  No bills currently on hold
                </div>
            ) : (
              branchHeldOrders.map((held) => {
                const total = computeHeldTotal(held);
                const itemCount = held.items.reduce((sum, i) => sum + i.quantity, 0);
                return (
                  <div
                    key={held.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => resumeHeldOrder(held.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        resumeHeldOrder(held.id);
                      }
                    }}
                    className="group p-2 rounded-md bg-white border border-[#E5E7EB] hover:border-[#FB923C] hover:bg-[#FFF7ED]/50 cursor-pointer transition-colors"
                    title={`Resume ${held.ticketLabel}`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-semibold text-[#181210] truncate group-hover:text-[#C2410C]">
                          {held.ticketLabel}
                        </div>
                        <div className="text-[11px] text-[#64748B] truncate mt-0.5">
                          {held.customerName || 'Walk-in Customer'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteHeldOrder(held.id);
                        }}
                        className="p-1 rounded text-[#94A3B8] hover:text-[#B91C1C] hover:bg-[#FEE2E2] shrink-0"
                        aria-label={`Delete ${held.ticketLabel}`}
                        title="Remove held bill"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="mt-1.5 pt-1 border-t border-[#E5E7EB]/70 flex items-center justify-between text-[11px]">
                      <span className="inline-flex items-center gap-1 text-[#64748B] tabular-nums">
                        <Clock className="w-3 h-3" />
                        {formatHoldTime(held.heldAt)} · {formatDecimal(itemCount, 3)} item
                        {itemCount === 1 ? '' : 's'}
                      </span>
                      <span className="font-bold text-[#181210] tabular-nums">
                        {formatINRCompact(total)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>
        </div>
      </aside>

      {/* Center Product Container */}
      <section className="flex-1 flex flex-col min-w-0 lg:overflow-hidden p-3 sm:p-3.5 gap-2.5">
        {!canBill && (
          <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3.5 py-2 flex items-center gap-2 text-[12px] text-[#B91C1C] shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {!isBranchActive
                ? `Branch "${activeBranch.name}" is currently Inactive. Switch to an Active branch in the header to bill or hold orders.`
                : 'Your role has read-only POS access and cannot generate new bills.'}
            </span>
          </div>
        )}

        {!bannerDismissed && alertCount > 0 && (
          <div className="bg-[#FFEDD5] border border-[#FB923C]/40 rounded-lg px-3.5 py-1.5 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-[#C2410C] shrink-0" />
              <div className="text-[12px] text-[#181210] truncate">
                <span className="font-semibold">Freshness &amp; Stock Notice:</span>{' '}
                {lowStockProducts.length} low-stock item(s) and {expiringSoonBatches.length} batch(es)
                nearing expiry today ({activeBranch.name}).
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {hasPermission('stock', 'view') && (
                <button
                  type="button"
                  onClick={() => setActiveNav('stock')}
                  className="px-2.5 py-1 rounded bg-white border border-[#FB923C]/40 text-[11px] font-semibold text-[#C2410C] hover:bg-[#FAF9F5] whitespace-nowrap"
                >
                  View Stock
                </button>
              )}
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                className="p-1 rounded text-[#C2410C] hover:bg-[#FB923C]/20"
                aria-label="Dismiss stock warning"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Product Container Navigation (Top row: Subcategories; Below: Unit Filters) */}
        <div className="bg-white rounded-[10px] border border-[#E5E7EB] px-3 py-2 space-y-1.5 shrink-0">
          {/* Top Row: Relevant Subcategories for Selected Main Category */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setSelectedSubGroup('all')}
              className={`min-h-[34px] px-3 py-1 rounded-md text-[12px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                selectedSubGroup === 'all'
                  ? 'bg-[#FB923C] text-white'
                  : 'bg-[#FAF9F5] border border-[#E5E7EB] text-[#475569] hover:text-[#181210] hover:border-[#FB923C]/60'
              }`}
            >
              All ({categoryScopedProducts.length})
            </button>
            {subcategories.map((sub) => {
              const isSubActive = selectedSubGroup === sub.name;
              return (
                <button
                  key={sub.name}
                  type="button"
                  onClick={() => setSelectedSubGroup(sub.name)}
                  className={`min-h-[34px] px-3 py-1 rounded-md text-[12px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    isSubActive
                      ? 'bg-[#FB923C] text-white'
                      : 'bg-[#FAF9F5] border border-[#E5E7EB] text-[#475569] hover:text-[#181210] hover:border-[#FB923C]/60'
                  }`}
                >
                  {sub.name} ({sub.count})
                </button>
              );
            })}
          </div>

          {/* Second Row: Unit Filters (All Units, By Weight, By Piece, Gift Boxes) */}
          <div className="pt-1.5 border-t border-[#E5E7EB] flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { id: 'all', label: 'All Units' },
                  { id: 'weight', label: 'By Weight' },
                  { id: 'piece', label: 'By Piece' },
                  { id: 'box', label: 'Gift Boxes' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleSelectUnitFilter(chip.id)}
                  className={`min-h-[32px] px-3 py-1 rounded-md text-[12px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    unitFilter === chip.id
                      ? 'bg-[#181210] text-white'
                      : 'bg-[#FAF9F5] border border-[#E5E7EB] text-[#181210] hover:bg-white hover:border-[#FB923C]/60'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <span className="text-[11px] font-medium text-[#64748B] tabular-nums">
              {filteredProducts.length} item{filteredProducts.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Reusable Selected-Product Configuration Area (Zero Popups, keeps Product Grid visible) */}
        {selectedProduct && (
          <form
            onSubmit={handleAddConfiguredToBill}
            className="bg-white rounded-[10px] border-2 border-[#FB923C] px-3.5 py-2.5 space-y-2.5 shrink-0 shadow-xs"
            aria-label={`Selected item configuration for ${selectedProduct.name}`}
          >
            {/* Header Row */}
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <ProductThumb
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.name}
                  className="w-9 h-9 rounded-md shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-[#181210] truncate">
                    {selectedProduct.name}
                  </div>
                  {selectedProduct.unitType === 'weight' && inlineWeightData ? (
                    (() => {
                      const defaultVar = getProductDefaultVariant(selectedProduct);
                      const matchedVar =
                        selectedProduct.variants.find(
                          (v) => v.id === inlineWeightData.matchedPreset?.variantId
                        ) ?? defaultVar;
                      const varStock = matchedVar
                        ? getVariantStock(selectedProduct.id, matchedVar.id)
                        : 0;
                      const varMin = getVariantMinStock(selectedProduct, matchedVar);
                      const defaultPrice = roundCurrency(
                        (inlineWeightData.pricePerKg * inlineWeightData.defaultGrams) / 1000
                      );
                      const defaultUnitLabel =
                        defaultVar?.label ?? formatWeightDisplay(inlineWeightData.defaultGrams);
                      return (
                        <div className="text-[11px] text-[#64748B] flex items-center gap-2 flex-wrap tabular-nums">
                          <span className="font-semibold text-[#C2410C]">
                            {formatINRCompact(defaultPrice)} ({defaultUnitLabel})
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatINRCompact(inlineWeightData.pricePerKg)} / kg</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-semibold ${
                              varStock <= 0
                                ? 'text-[#B91C1C]'
                                : varStock <= varMin
                                ? 'text-[#C2410C]'
                                : 'text-[#15803D]'
                            }`}
                          >
                            {roundQty(varStock)} left
                          </span>
                        </div>
                      );
                    })()
                  ) : (
                    (() => {
                      const activeVar = inlinePieceData?.variant;
                      const varStock = activeVar
                        ? getVariantStock(selectedProduct.id, activeVar.id)
                        : 0;
                      const varMin = getVariantMinStock(selectedProduct, activeVar);
                      return (
                        <div className="text-[11px] text-[#64748B] flex items-center gap-2 flex-wrap tabular-nums">
                          <span className="font-semibold text-[#C2410C]">
                            {formatINRCompact(inlinePieceData?.unitPrice ?? 0)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{activeVar?.label}</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-semibold ${
                              varStock <= 0
                                ? 'text-[#B91C1C]'
                                : varStock <= varMin
                                ? 'text-[#C2410C]'
                                : 'text-[#15803D]'
                            }`}
                          >
                            Stock: {roundQty(varStock)} left
                          </span>
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProductId(null)}
                className="p-1.5 rounded-md text-[#64748B] hover:text-[#181210] hover:bg-[#FAF9F5] shrink-0"
                aria-label="Close product configuration"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Configuration Controls */}
            {selectedProduct.unitType === 'weight' && inlineWeightData ? (
              <div className="space-y-2.5">
                {/* Predefined Weight Options Row (plus inline stepper/action when Custom Weight is OFF) */}
                <div
                  className={`flex flex-col ${
                    inlineWeightData.allowCustomWeight
                      ? 'gap-2'
                      : 'xl:flex-row xl:items-center justify-between gap-2.5'
                  }`}
                >
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    {inlineWeightData.presets.map((preset) => {
                      const active =
                        inlineWeightData.effectiveMode === 'preset' &&
                        Math.abs(inlineWeightData.weightInGrams - preset.grams) < 0.01;
                      return (
                        <button
                          key={preset.grams}
                          type="button"
                          onClick={() => handleSelectWeightPreset(preset.grams)}
                          className={`min-h-[38px] px-3 py-1.5 rounded-md border text-[12px] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 tabular-nums ${
                            active
                              ? 'bg-[#FB923C] border-[#FB923C] text-white font-semibold'
                              : preset.isDefault
                              ? 'bg-[#FFF7ED] border-[#FB923C]/60 text-[#9A3412] font-semibold hover:bg-[#FFEDD5]'
                              : 'bg-[#FAF9F5] border-[#E5E7EB] text-[#181210] font-medium hover:border-[#FB923C]'
                          }`}
                        >
                          <span>{preset.label}</span>
                          {preset.isDefault && (
                            <span
                              className={`text-[10px] font-bold uppercase ${
                                active ? 'text-white/90' : 'text-[#C2410C]'
                              }`}
                            >
                              Default
                            </span>
                          )}
                          <span className={active ? 'text-white/90' : 'text-[#64748B]'}>
                            · {formatINRCompact(preset.price)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* When Custom Weight is DISABLED: Compact single-block footer controls right alongside presets */}
                  {!inlineWeightData.allowCustomWeight && (
                    <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2.5 pt-2 xl:pt-0 border-t xl:border-t-0 border-[#E5E7EB] shrink-0">
                      <div className="flex items-center border border-[#E5E7EB] bg-[#FAF9F5] rounded-md h-[38px]">
                        <button
                          type="button"
                          onClick={() => setWeightQty((q) => Math.max(1, q - 1))}
                          className="px-3 h-full text-[#181210] hover:bg-white rounded-l-md"
                          aria-label="Decrease pack quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3 text-[13px] font-bold text-[#181210] tabular-nums">
                          {weightQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setWeightQty((q) => q + 1)}
                          className="px-3 h-full text-[#181210] hover:bg-white rounded-r-md"
                          aria-label="Increase pack quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-right min-w-[82px]">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                          Total
                        </div>
                        <div className="text-[15px] font-bold text-[#181210] tabular-nums leading-tight">
                          {formatINR(inlineWeightData.totalPrice)}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={!canBill || inlineWeightData.weightInGrams <= 0}
                        className="min-h-[38px] px-4 py-1.5 rounded-md bg-[#FB923C] hover:bg-[#F97316] disabled:opacity-45 disabled:cursor-not-allowed text-white text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Check className="w-4 h-4" />
                        Add to Bill
                      </button>
                    </div>
                  )}
                </div>

                {/* When Custom Weight is ENABLED: Dedicated Custom Weight Section + Quantity, Total & Add to Bill */}
                {inlineWeightData.allowCustomWeight && (
                  <div className="pt-2.5 border-t border-[#E5E7EB] flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
                    <div
                      className={`flex flex-wrap items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors ${
                        inlineWeightData.effectiveMode === 'custom'
                          ? 'bg-[#FFF7ED]/70 border-[#FB923C]'
                          : 'bg-[#FAF9F5] border-[#E5E7EB]'
                      }`}
                    >
                      <span className="text-[12px] font-semibold text-[#181210] whitespace-nowrap">
                        Custom Weight:
                      </span>
                      <div className="inline-flex rounded-md border border-[#E5E7EB] bg-white p-0.5 shrink-0">
                        {(['g', 'kg'] as const).map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => handleToggleWeightUnit(u)}
                            className={`min-h-[30px] px-3 rounded text-[12px] font-semibold transition-colors whitespace-nowrap ${
                              weightUnit === u
                                ? 'bg-[#181210] text-white'
                                : 'text-[#64748B] hover:text-[#181210]'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                      <div className="relative w-28 sm:w-32">
                        <input
                          type="number"
                          step="any"
                          min={weightUnit === 'kg' ? '0.001' : '0.1'}
                          value={weightInput}
                          onFocus={handleFocusCustomWeight}
                          onChange={(e) => handleCustomWeightInputChange(e.target.value)}
                          placeholder={weightUnit === 'kg' ? 'e.g. 0.6' : 'e.g. 350'}
                          aria-label="Custom weight amount"
                          className={`w-full min-h-[36px] px-2.5 pr-8 text-[13px] font-semibold bg-white border rounded-md tabular-nums focus:outline-none ${
                            inlineWeightData.effectiveMode === 'custom' &&
                            inlineWeightData.validationError
                              ? 'border-[#DC2626]'
                              : inlineWeightData.effectiveMode === 'custom'
                              ? 'border-[#FB923C]'
                              : 'border-[#E5E7EB] focus:border-[#FB923C]'
                          }`}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#64748B]">
                          {weightUnit}
                        </span>
                      </div>

                      {inlineWeightData.effectiveMode === 'custom' &&
                        !inlineWeightData.validationError &&
                        inlineWeightData.weightInGrams > 0 && (
                          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#181210] tabular-nums whitespace-nowrap">
                            <span className="text-[#64748B] font-medium">
                              = {inlineWeightData.convertedDisplay}
                            </span>
                            <span className="text-[#64748B]" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-[#C2410C]">
                              {formatINRCompact(inlineWeightData.unitPrice)}
                            </span>
                          </div>
                        )}

                      {inlineWeightData.effectiveMode === 'custom' &&
                        inlineWeightData.validationError && (
                          <span className="text-[11.5px] font-medium text-[#DC2626]">
                            {inlineWeightData.validationError}
                          </span>
                        )}
                    </div>

                    {/* Quantity Stepper + Immediate Calculated Total + Add to Bill */}
                    <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2.5 shrink-0">
                      <div className="flex items-center border border-[#E5E7EB] bg-[#FAF9F5] rounded-md h-[38px]">
                        <button
                          type="button"
                          onClick={() => setWeightQty((q) => Math.max(1, q - 1))}
                          className="px-3 h-full text-[#181210] hover:bg-white rounded-l-md"
                          aria-label="Decrease pack quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-3 text-[13px] font-bold text-[#181210] tabular-nums">
                          {weightQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setWeightQty((q) => q + 1)}
                          className="px-3 h-full text-[#181210] hover:bg-white rounded-r-md"
                          aria-label="Increase pack quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="text-right min-w-[82px]">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                          Total
                        </div>
                        <div className="text-[15px] font-bold text-[#181210] tabular-nums leading-tight">
                          {formatINR(inlineWeightData.totalPrice)}
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={
                          !canBill ||
                          Boolean(inlineWeightData.validationError) ||
                          inlineWeightData.weightInGrams <= 0
                        }
                        className="min-h-[38px] px-4 py-1.5 rounded-md bg-[#FB923C] hover:bg-[#F97316] disabled:opacity-45 disabled:cursor-not-allowed text-white text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Check className="w-4 h-4" />
                        Add to Bill
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Piece / Box Configuration in Reusable Top Bar */
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  {selectedProduct.variants.map((v) => {
                    const active = v.id === inlinePieceData?.variant?.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setSelectedTopVariantId(v.id);
                          setCardVariantMap((prev) => ({
                            ...prev,
                            [selectedProduct.id]: v.id,
                          }));
                        }}
                        className={`min-h-[34px] px-2.5 py-1 rounded-md border text-[12px] font-semibold whitespace-nowrap transition-colors ${
                          active
                            ? 'bg-[#181210] border-[#181210] text-white'
                            : 'bg-[#FAF9F5] border-[#E5E7EB] text-[#181210] hover:border-[#FB923C]'
                        }`}
                      >
                        {v.label} · {formatINRCompact(v.price)}
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2.5 pt-2 xl:pt-0 border-t xl:border-t-0 border-[#E5E7EB] shrink-0">
                  <div className="flex items-center border border-[#E5E7EB] bg-[#FAF9F5] rounded-md h-[36px]">
                    <button
                      type="button"
                      onClick={() => setPieceQty((q) => Math.max(1, q - 1))}
                      className="px-2.5 h-full text-[#181210] hover:bg-white rounded-l-md"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-2.5 text-[13px] font-bold text-[#181210] tabular-nums">
                      {pieceQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPieceQty((q) => q + 1)}
                      className="px-2.5 h-full text-[#181210] hover:bg-white rounded-r-md"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right min-w-[78px]">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
                      Total
                    </div>
                    <div className="text-[15px] font-bold text-[#181210] tabular-nums leading-tight">
                      {formatINR(inlinePieceData?.totalPrice ?? 0)}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!canBill || !inlinePieceData?.variant}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-md bg-[#FB923C] hover:bg-[#F97316] disabled:opacity-45 disabled:cursor-not-allowed text-white text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Check className="w-4 h-4" />
                    Add to Bill
                  </button>
                </div>
              </div>
            )}
          </form>
        )}

        {/* Compact, Touch-Friendly Product Cards Grid */}
        <div className="flex-1 lg:overflow-y-auto lg:pr-1">
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-[10px] border border-[#E5E7EB] p-8 sm:p-10 text-center">
              <p className="text-[14px] font-medium text-[#181210]">
                No matching bakery or sweet items
              </p>
              <p className="text-[12px] text-[#64748B] mt-1">
                Try clearing the search query or choosing another category, subcategory, or unit filter.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5 auto-rows-fr">
              {filteredProducts.map((product) => {
                const isWeight = product.unitType === 'weight';
                const defaultVariant =
                  getProductDefaultVariant(product) ?? product.variants[0];

                const defaultStock = defaultVariant
                  ? getVariantStock(product.id, defaultVariant.id)
                  : 0;
                const defaultMinStock = getVariantMinStock(product, defaultVariant);
                const isOos = defaultStock <= 0;
                const isLow = defaultStock > 0 && defaultStock <= defaultMinStock;

                const rawUnitLabel = defaultVariant?.label?.trim() ?? '';
                const unitDisplay = /^per piece$/i.test(rawUnitLabel)
                  ? '1 Pc'
                  : rawUnitLabel;

                const matchingCartLine = !isWeight
                  ? cart.find(
                      (c) =>
                        c.productId === product.id &&
                        c.variantId === defaultVariant?.id &&
                        !c.notes
                    )
                  : undefined;

                const weightCartCount = isWeight
                  ? cart
                      .filter((c) => c.productId === product.id)
                      .reduce((sum, c) => sum + c.quantity, 0)
                  : 0;

                const hasMultipleVariants = product.variants.length > 1;
                const canOpenSelector = isWeight || hasMultipleVariants;
                const isTopSelected = canOpenSelector && selectedProduct?.id === product.id;
                const wasJustAdded = lastAddedProductId === product.id;

                return (
                  <div
                    key={product.id}
                    className={`group bg-white rounded-[10px] border overflow-hidden flex flex-col h-full transition-all text-left ${
                      isTopSelected
                        ? 'border-[#FB923C] ring-2 ring-[#FB923C]/25 bg-[#FFF7ED]/30'
                        : wasJustAdded ||
                          (matchingCartLine && matchingCartLine.quantity > 0) ||
                          weightCartCount > 0
                        ? 'border-[#FB923C]/80 shadow-xs'
                        : 'border-[#E5E7EB] hover:border-[#FB923C]/70 hover:shadow-xs'
                    }`}
                  >
                    {/* 1. Image Section (Overlapping Stock Left & Favourite Right) + 2. Name & Price Row */}
                    <div
                      role={canOpenSelector ? 'button' : undefined}
                      tabIndex={canOpenSelector ? 0 : undefined}
                      onClick={canOpenSelector ? () => selectProductForTopBar(product) : undefined}
                      onKeyDown={
                        canOpenSelector
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                selectProductForTopBar(product);
                              }
                            }
                          : undefined
                      }
                      className={`${
                        canOpenSelector ? 'cursor-pointer focus:outline-none' : ''
                      } flex-1 flex flex-col`}
                    >
                      <div className="relative w-full h-24 bg-[#FAF9F5] overflow-hidden shrink-0">
                        <ProductThumb
                          src={product.imageUrl}
                          alt={product.name}
                          borderless
                          className="w-full h-full object-cover block group-hover:scale-[1.03] transition-transform duration-200"
                        />

                        <span
                          className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-white/95 border border-[#E5E7EB] text-[10.5px] font-semibold tabular-nums leading-tight ${
                            isOos
                              ? 'text-[#B91C1C]'
                              : isLow
                              ? 'text-[#C2410C]'
                              : 'text-[#15803D]'
                          }`}
                        >
                          {roundQty(defaultStock)} left
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleProductFavourite(product.id);
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                          className={`absolute top-1.5 right-1.5 p-1 rounded-md bg-white/95 border border-[#E5E7EB] transition-colors ${
                            product.isFavourite
                              ? 'text-[#FB923C]'
                              : 'text-[#64748B] hover:text-[#181210]'
                          }`}
                          aria-label={
                            product.isFavourite
                              ? 'Remove from favourites'
                              : 'Add to favourites'
                          }
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              product.isFavourite ? 'fill-[#FB923C]' : ''
                            }`}
                          />
                        </button>
                      </div>

                      {/* Product Name Left + Default Price & Unit Right */}
                      <div className="px-2.5 pt-2 pb-1.5 flex-1 flex flex-col sm:flex-row sm:items-start justify-between gap-0.5 sm:gap-2">
                        <div className="text-[12.5px] font-semibold text-[#181210] leading-snug line-clamp-2 min-w-0">
                          {product.name}
                        </div>
                        <div className="text-left sm:text-right shrink-0 leading-snug tabular-nums whitespace-nowrap">
                          <span className="text-[13px] font-bold text-[#181210]">
                            {formatINRCompact(
                              isWeight && product.pricePerKg && product.pricePerKg > 0
                                ? roundCurrency(
                                    (product.pricePerKg * getDefaultWeightGrams(product)) / 1000
                                  )
                                : defaultVariant?.price ?? 0
                            )}
                          </span>
                          {unitDisplay && (
                            <span className="text-[10.5px] font-medium text-[#64748B] ml-1">
                              ({unitDisplay})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 3. Bottom Action Button */}
                    <div className="px-2.5 pb-2.5 pt-1 mt-auto">
                      {isWeight ? (
                        <button
                          type="button"
                          onClick={() => selectProductForTopBar(product)}
                          className={`w-full min-h-[34px] px-2.5 py-1 rounded-md text-[11.5px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                            isTopSelected
                              ? 'bg-[#181210] text-white'
                              : weightCartCount > 0
                              ? 'bg-[#FFF7ED] border border-[#FB923C] text-[#C2410C] hover:bg-[#FFEDD5]'
                              : 'bg-[#FAF9F5] border border-[#E5E7EB] text-[#181210] hover:border-[#FB923C] hover:bg-[#FFF7ED]'
                          }`}
                        >
                          <span className="truncate">
                            {isTopSelected
                              ? 'Configuring Weight'
                              : weightCartCount > 0
                              ? `Select Weight (${formatDecimal(weightCartCount, 3)} in bill)`
                              : 'Select Weight'}
                          </span>
                        </button>
                      ) : matchingCartLine ? (
                        <div className="w-full min-h-[34px] flex items-center justify-between border border-[#FB923C] bg-[#FFF7ED] rounded-md overflow-hidden">
                          <button
                            type="button"
                            onClick={() => updateCartQty(matchingCartLine.lineId, -1)}
                            className="h-[34px] px-3 text-[#C2410C] hover:bg-[#FB923C]/20 transition-colors flex items-center justify-center"
                            aria-label={`Decrease ${product.name}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 text-[12px] font-bold text-[#181210] tabular-nums">
                            {formatDecimal(matchingCartLine.quantity, 3)}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              quickAddQuantityVariant(product, defaultVariant?.id, 1)
                            }
                            className="h-[34px] px-3 text-[#C2410C] hover:bg-[#FB923C]/20 transition-colors flex items-center justify-center"
                            aria-label={`Increase ${product.name}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!canBill}
                          onClick={() => {
                            if (hasMultipleVariants) {
                              selectProductForTopBar(product);
                            } else {
                              quickAddQuantityVariant(product, defaultVariant?.id, 1);
                            }
                          }}
                          className="w-full min-h-[34px] px-2.5 py-1 rounded-md bg-[#FB923C] hover:bg-[#F97316] disabled:opacity-45 text-white text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Right Order Summary Panel */}
      <aside className="w-full lg:w-[355px] xl:w-[385px] bg-white border-t lg:border-t-0 lg:border-l border-[#E5E7EB] flex flex-col lg:h-full shrink-0">
        {/* Customer Info */}
        <div className="px-3.5 sm:px-4 py-3 border-b border-[#E5E7EB] space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-[12px] font-semibold text-[#181210]">Customer Details</div>
            {cart.length > 0 && (
              <span className="text-[11px] font-medium text-[#64748B] tabular-nums">
                {cart.length} line{cart.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 relative">
            <input
              type="text"
              value={cartCustomerName}
              onChange={(e) => {
                setCartCustomerName(e.target.value);
                setShowCustLookup(true);
              }}
              onFocus={() => setShowCustLookup(true)}
              placeholder="Customer name (optional)"
              className="px-2.5 py-1.5 text-[12px] bg-[#FAF9F5] border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C] focus:bg-white"
            />
            <div className="relative flex items-center">
              <input
                type="text"
                value={cartCustomerPhone}
                onChange={(e) => {
                  setCartCustomerPhone(e.target.value);
                  setShowCustLookup(true);
                }}
                onFocus={() => setShowCustLookup(true)}
                placeholder="Phone number"
                className="w-full px-2.5 py-1.5 text-[12px] bg-[#FAF9F5] border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C] focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowCustLookup((s) => !s)}
                className="absolute right-1.5 text-[#64748B] hover:text-[#FB923C]"
                title="Pick existing customer"
              >
                <UserPlus className="w-3.5 h-3.5" />
              </button>
            </div>

            {showCustLookup && matchingCustomers.length > 0 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowCustLookup(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E5E7EB] rounded-md shadow-lg z-20 max-h-40 overflow-y-auto">
                  {matchingCustomers.slice(0, 5).map((cust) => (
                    <button
                      key={cust.id}
                      type="button"
                      onClick={() => {
                        selectCartCustomer(cust);
                        setShowCustLookup(false);
                      }}
                      className="w-full px-3 py-1.5 text-left text-[12px] hover:bg-[#FAF9F5] flex items-center justify-between border-b border-[#E5E7EB]/60 last:border-0"
                    >
                      <span className="font-medium text-[#181210]">{cust.name}</span>
                      <span className="text-[#64748B] tabular-nums">{cust.phone}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Cart Items Area or Empty State */}
        <div className="flex-1 lg:overflow-y-auto px-3.5 sm:px-4 py-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-8 px-4">
              <div className="w-14 h-14 rounded-full bg-[#FB923C]/12 text-[#FB923C] flex items-center justify-center mb-3">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div className="text-[14px] font-semibold text-[#181210]">
                No items in current bill
              </div>
              <p className="text-[12px] text-[#64748B] mt-1 max-w-[235px]">
                Tap Add on product cards or tap any card to select options, weight, and quantity above.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div
                  key={item.lineId}
                  className="p-2.5 rounded-md border border-[#E5E7EB] bg-[#FAF9F5] flex flex-col sm:flex-row sm:items-start justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-[#181210] leading-tight truncate">
                      {item.productName}
                    </div>
                    <div className="text-[11px] text-[#64748B] mt-0.5 tabular-nums">
                      {item.variantLabel} · {formatINRCompact(item.unitPrice)}
                    </div>
                    {item.notes && (
                      <div className="text-[11px] text-[#C2410C] mt-0.5">
                        Note: {item.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <div className="flex items-center border border-[#E5E7EB] bg-white rounded">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.lineId, -1)}
                        className="p-1.5 text-[#181210] hover:bg-[#FAF9F5]"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-[12px] font-semibold tabular-nums">
                        {formatDecimal(item.quantity, 3)}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.lineId, 1)}
                        className="p-1.5 text-[#181210] hover:bg-[#FAF9F5]"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 text-right text-[13px] font-bold text-[#181210] tabular-nums">
                        {formatINRCompact(roundCurrency(item.unitPrice * item.quantity))}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.lineId)}
                        className="p-1 text-[#B91C1C] hover:bg-[#FEE2E2] rounded"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expandable Payment & Billing Summary */}
        <div className="border-t border-[#E5E7EB] bg-white px-3.5 sm:px-4 py-3 space-y-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setDetailsExpanded((e) => !e)}
            aria-expanded={detailsExpanded}
            className="w-full flex items-center justify-between text-[12px] font-semibold text-[#181210]"
          >
            <span>Payment, Discount &amp; Box Charges</span>
            {detailsExpanded ? (
              <ChevronDown className="w-4 h-4 text-[#64748B]" />
            ) : (
              <ChevronUp className="w-4 h-4 text-[#64748B]" />
            )}
          </button>

          {detailsExpanded && (
            <div className="space-y-2.5 pt-1 text-[12px]">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-[#64748B] mb-1">Discount</label>
                  <div className="flex">
                    <button
                      type="button"
                      onClick={() =>
                        setDiscountType(discountType === 'flat' ? 'percent' : 'flat')
                      }
                      className="px-2 py-1 border border-r-0 border-[#E5E7EB] rounded-l bg-[#FAF9F5] font-semibold text-[#181210]"
                    >
                      {discountType === 'flat' ? '₹' : '%'}
                    </button>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={discountValue || ''}
                      onChange={(e) => {
                        const raw = parseFloat(e.target.value);
                        setDiscountValue(Number.isFinite(raw) ? Math.max(0, roundCurrency(raw)) : 0);
                      }}
                      placeholder="0"
                      className="w-full px-2 py-1 border border-[#E5E7EB] rounded-r bg-white tabular-nums focus:outline-none focus:border-[#FB923C]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-[#64748B] mb-1">
                    Box / Packing (₹)
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={packagingCharge || ''}
                      onChange={(e) => {
                        const raw = parseFloat(e.target.value);
                        setPackagingCharge(Number.isFinite(raw) ? Math.max(0, roundCurrency(raw)) : 0);
                      }}
                      placeholder="0"
                      className="w-full px-2 py-1 border border-[#E5E7EB] rounded bg-white tabular-nums focus:outline-none focus:border-[#FB923C]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPackagingCharge(
                          packagingCharge > 0 ? 0 : roundCurrency(branchPackagingFee)
                        )
                      }
                      className="px-2 py-1 rounded border border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold hover:bg-[#E5E7EB]/50 shrink-0 tabular-nums"
                      title="Toggle branch standard gift box fee"
                    >
                      +{formatINRCompact(branchPackagingFee)}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] text-[#64748B] mb-1">Payment Method</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    ...settings.acceptedPaymentMethods,
                    ...(settings.enableSplitPayment ? ['Split' as const] : []),
                  ].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMode(method)}
                      className={`py-1.5 px-2 rounded text-[11px] font-semibold border transition-colors ${
                        paymentMode === method
                          ? 'bg-[#181210] text-white border-[#181210]'
                          : 'bg-[#FAF9F5] text-[#181210] border-[#E5E7EB] hover:bg-white'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMode === 'Split' && (
                <div className="grid grid-cols-3 gap-1.5 p-2 rounded bg-[#FAF9F5] border border-[#E5E7EB]">
                  {(['Cash', 'UPI', 'Card'] as PaymentMethod[]).map((m) => (
                    <div key={m}>
                      <label className="block text-[10px] font-semibold text-[#64748B] mb-0.5">
                        {m} (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={splitAmounts[m]}
                        onChange={(e) =>
                          setSplitAmounts((prev) => ({ ...prev, [m]: e.target.value }))
                        }
                        className="w-full px-1.5 py-1 text-[11px] bg-white border border-[#E5E7EB] rounded tabular-nums"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Totals Summary */}
          <div className="pt-2 border-t border-[#E5E7EB] space-y-1 text-[12px]">
            <div className="flex justify-between text-[#64748B]">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatINR(cartTotals.subtotal)}</span>
            </div>
            {cartTotals.discountAmount > 0 && (
              <div className="flex justify-between text-[#15803D]">
                <span>Discount</span>
                <span className="tabular-nums">-{formatINR(cartTotals.discountAmount)}</span>
              </div>
            )}
            {packagingCharge > 0 && (
              <div className="flex justify-between text-[#64748B]">
                <span>Box / Packing</span>
                <span className="tabular-nums">{formatINR(packagingCharge)}</span>
              </div>
            )}
            <div className="flex justify-between text-[#64748B]">
              <span>GST (Tax)</span>
              <span className="tabular-nums">{formatINR(cartTotals.taxAmount)}</span>
            </div>
            <div className="flex justify-between items-center pt-1.5 border-t border-[#E5E7EB]">
              <span className="text-[14px] font-bold text-[#181210]">Grand Total</span>
              <span className="text-[18px] font-bold text-[#FB923C] tabular-nums">
                {formatINR(cartTotals.grandTotal)}
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={!canBill}
              onClick={handleCheckout}
              className="w-full py-2.5 px-4 rounded-md bg-[#FB923C] hover:bg-[#F97316] disabled:opacity-50 disabled:cursor-not-allowed text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Bill &amp; Print
            </button>

            <div className="grid grid-cols-2 gap-2">
              {hasPermission('custom_orders', 'view') ? (
                <button
                  type="button"
                  onClick={() => setActiveNav('custom_orders')}
                  className="py-2 px-3 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[#181210] text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Cake className="w-3.5 h-3.5 text-[#FB923C]" />
                  Custom Cake
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={() => clearCart()}
                className="py-2 px-3 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] disabled:opacity-45 disabled:cursor-not-allowed text-[#181210] text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#64748B]" />
                Clear Bill
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
