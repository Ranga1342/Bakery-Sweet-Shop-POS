export const TODAY_ISO = '2026-11-21';

/**
 * IEEE-754-safe rounding to a fixed number of decimal places.
 */
export function roundTo(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  // Use exponential scaling when safe to eliminate binary float drift (e.g. 1.005 -> 1.01)
  if (Math.abs(value) < 1e9 && !String(value).includes('e')) {
    const shifted = Number(`${value}e${decimals}`);
    if (Number.isFinite(shifted)) {
      return Number(`${Math.round(shifted)}e-${decimals}`);
    }
  }
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Standard 2-decimal rounding for currency amounts (prices, subtotals, tax, totals, balances). */
export function roundCurrency(amount: number): number {
  return roundTo(amount, 2);
}

/** Up to 3 decimal places for inventory/stock quantities and kg deductions (e.g. 0.125 kg, 51.1 kg). */
export function roundQty(qty: number): number {
  return roundTo(qty, 3);
}

/** Up to 1 decimal place for gram weights (e.g. 51.1 g, 250 g). */
export function roundWeightGrams(grams: number): number {
  return roundTo(grams, 1);
}

/** Up to 3 decimal places for kilogram weights (e.g. 0.125 kg, 1.5 kg). */
export function roundWeightKg(kg: number): number {
  return roundTo(kg, 3);
}

/** Up to 2 decimal places for percentage rates and shares. */
export function roundPercent(pct: number): number {
  return roundTo(pct, 2);
}

/**
 * Formats an amount in INR always showing 2 decimal places (e.g. ₹51.10, ₹21.10, ₹500.00).
 */
export function formatINR(amount: number): string {
  const safe = roundCurrency(amount);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

/**
 * Formats an amount in INR cleanly: omits .00 for exact whole rupees,
 * while always preserving 2 decimal places when fractional paise exist (e.g. ₹51.10, ₹21.10).
 */
export function formatINRCompact(amount: number): string {
  const safe = roundCurrency(amount);
  const hasDecimals = Math.abs(safe - Math.round(safe)) > 0.0001;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(safe);
}

/**
 * Formats quantities/weights naturally without forcing trailing zeros (e.g. 51.1, 0.125, 5).
 */
export function formatDecimal(value: number, maxDecimals = 3): string {
  const safe = roundTo(value, maxDecimals);
  return safe.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function daysUntil(dateStr: string, referenceDate: string = TODAY_ISO): number {
  const target = new Date(`${dateStr.slice(0, 10)}T00:00:00`).getTime();
  const ref = new Date(`${referenceDate.slice(0, 10)}T00:00:00`).getTime();
  if (Number.isNaN(target) || Number.isNaN(ref)) return 999;
  return Math.round((target - ref) / (1000 * 60 * 60 * 24));
}

export function formatStockQty(qty: number, unitLabel: string): string {
  return `${formatDecimal(qty, 3)} ${unitLabel}`;
}

export function formatWeightDisplay(grams: number): string {
  const safe = Math.max(0, roundWeightGrams(grams));
  if (safe >= 1000) {
    const kg = roundWeightKg(safe / 1000);
    return `${formatDecimal(kg, 3)} kg`;
  }
  return `${formatDecimal(safe, 1)} g`;
}

export interface OrderFinancialInputItem {
  unitPrice: number;
  quantity: number;
  taxRate: number;
}

export interface OrderFinancialSummary {
  subtotal: number;
  discountAmount: number;
  taxableBase: number;
  taxAmount: number;
  grandTotal: number;
}

/**
 * Shared authoritative POS calculation using full underlying numeric precision
 * for line items before applying consistent 2-decimal currency rounding.
 */
export function computeOrderFinancials(params: {
  items: OrderFinancialInputItem[];
  discountType: 'flat' | 'percent';
  discountValue: number;
  packagingCharge: number;
  activeBranchTaxRate: number;
  hasBranchTaxOverride: boolean;
}): OrderFinancialSummary {
  const {
    items,
    discountType,
    discountValue,
    packagingCharge,
    activeBranchTaxRate,
    hasBranchTaxOverride,
  } = params;

  const rawSubtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const subtotal = roundCurrency(rawSubtotal);

  const safeDiscountVal = Math.max(0, Number.isFinite(discountValue) ? discountValue : 0);
  const rawDiscount =
    discountType === 'percent'
      ? (rawSubtotal * Math.min(100, safeDiscountVal)) / 100
      : Math.min(rawSubtotal, safeDiscountVal);
  const discountAmount = roundCurrency(rawDiscount);

  const safePackaging = Math.max(0, Number.isFinite(packagingCharge) ? packagingCharge : 0);
  const taxableBase = roundCurrency(Math.max(0, rawSubtotal - discountAmount + safePackaging));

  const effectiveTaxRate =
    items.length > 0
      ? hasBranchTaxOverride
        ? activeBranchTaxRate
        : items.reduce((acc, i) => acc + i.taxRate * (i.unitPrice * i.quantity), 0) /
          Math.max(1e-9, rawSubtotal)
      : activeBranchTaxRate;

  const taxAmount = roundCurrency(taxableBase * (effectiveTaxRate / 100));
  const grandTotal = roundCurrency(taxableBase + taxAmount);

  return {
    subtotal,
    discountAmount,
    taxableBase,
    taxAmount,
    grandTotal,
  };
}

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csv = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
