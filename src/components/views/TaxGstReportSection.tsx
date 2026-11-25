import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  FileSpreadsheet,
  Info,
  Plus,
  ReceiptIndianRupee,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  Branch,
  Category,
  CompletedOrder,
  GstPaymentRecord,
  GstPaymentStatus,
  GstTreatment,
  Product,
} from '../../types/pos';
import {
  formatDateShort,
  formatDecimal,
  formatINR,
  formatINRCompact,
  roundCurrency,
  roundQty,
  TODAY_ISO,
} from '../../utils/formatters';
import { ExportSheet } from '../../utils/reportExport';

export interface ProductGstRow {
  productId: string;
  productName: string;
  sku: string;
  categoryId: string;
  categoryName: string;
  qtySold: number;
  totalSalesAmount: number;
  taxableValue: number;
  gstRate: number;
  gstTreatment: GstTreatment;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalGst: number;
  totalIncludingGst: number;
}

export interface GstRateSlabRow {
  slabKey: string;
  label: string;
  gstRate: number;
  gstTreatment: GstTreatment;
  productCount: number;
  totalSales: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalGst: number;
}

export interface TaxGstComputedData {
  totalRevenue: number;
  taxableRevenue: number;
  gstCollected: number;
  revenueExcludingTax: number;
  totalTaxableSales: number;
  exemptSales: number;
  nilRatedSales: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  refundedOrdersCount: number;
  refundedGstReversal: number;
  refundedSalesReversal: number;
  hasItcData: boolean;
  recordedItc: number;
  recordedAdjustments: number;
  estimatedNetPayable: number | null;
  productRows: ProductGstRow[];
  rateRows: GstRateSlabRow[];
  matchingPaymentRecords: GstPaymentRecord[];
}

function round2(n: number): number {
  return roundCurrency(n);
}

export function computeTaxGstReport(params: {
  completedOrders: CompletedOrder[];
  refundedOrders: CompletedOrder[];
  products: Product[];
  categories: Category[];
  gstPaymentRecords: GstPaymentRecord[];
  resolvedBranchId: string | null;
  categoryFilter: string;
  productFilter: string;
  rateFilter: string;
  searchQuery: string;
  overlapsDateRange: (periodStart: string, periodEnd: string) => boolean;
}): TaxGstComputedData {
  const {
    completedOrders,
    refundedOrders,
    products,
    categories,
    gstPaymentRecords,
    resolvedBranchId,
    categoryFilter,
    productFilter,
    rateFilter,
    searchQuery,
    overlapsDateRange,
  } = params;

  const productById = new Map<string, Product>();
  products.forEach((p) => productById.set(p.id, p));

  const categoryById = new Map<string, string>();
  categories.forEach((c) => categoryById.set(c.id, c.name));

  // Aggregate line items across completed orders with exact order-level reconciliation
  const productMap = new Map<
    string,
    {
      productId: string;
      productName: string;
      sku: string;
      categoryId: string;
      categoryName: string;
      qtySold: number;
      totalSalesAmount: number;
      taxableValue: number;
      gstRate: number;
      gstTreatment: GstTreatment;
      cgstAmount: number;
      sgstAmount: number;
      igstAmount: number;
      totalGst: number;
      totalIncludingGst: number;
    }
  >();

  let totalRevenue = 0;
  let taxableRevenue = 0;
  let gstCollected = 0;
  let totalTaxableSales = 0;
  let exemptSales = 0;
  let nilRatedSales = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  completedOrders.forEach((order) => {
    const rawItemsSum = order.items.reduce((s, item) => s + item.unitPrice * item.quantity, 0);
    const orderNetBeforeTax = Math.max(
      0,
      order.subtotal - order.discountAmount + order.packagingCharge
    );

    // Track remainder for exact order-level tax & net sales reconciliation
    let allocatedNetRunning = 0;
    let allocatedTaxRunning = 0;

    // Identify taxable lines for proportional tax distribution
    const lineRawTaxes = order.items.map((item) => {
      const prod = productById.get(item.productId);
      const treatment: GstTreatment =
        item.gstTreatment ??
        prod?.gstTreatment ??
        (item.taxRate === 0 ? 'Nil-Rated' : 'Taxable');
      const effectiveRate = treatment === 'Taxable' ? item.taxRate : 0;
      const lineRaw = item.unitPrice * item.quantity;
      return {
        raw: lineRaw,
        effectiveRate,
        treatment,
        weightedTaxBase: effectiveRate > 0 ? lineRaw * effectiveRate : 0,
      };
    });

    const totalWeightedTax = lineRawTaxes.reduce((s, l) => s + l.weightedTaxBase, 0);

    order.items.forEach((item, idx) => {
      const prod = productById.get(item.productId);
      const categoryId = prod?.categoryId ?? 'custom';
      const categoryName = categoryById.get(categoryId) ?? 'Custom / Other';
      const info = lineRawTaxes[idx];
      const isLast = idx === order.items.length - 1;

      const lineNetBeforeTax =
        isLast && rawItemsSum > 0
          ? round2(orderNetBeforeTax - allocatedNetRunning)
          : rawItemsSum > 0
          ? round2((info.raw / rawItemsSum) * orderNetBeforeTax)
          : 0;
      allocatedNetRunning = round2(allocatedNetRunning + lineNetBeforeTax);

      let lineTax = 0;
      if (info.effectiveRate > 0) {
        if (isLast) {
          lineTax = round2(Math.max(0, order.taxAmount - allocatedTaxRunning));
        } else if (totalWeightedTax > 0) {
          lineTax = round2((info.weightedTaxBase / totalWeightedTax) * order.taxAmount);
        }
      }
      allocatedTaxRunning = round2(allocatedTaxRunning + lineTax);

      const isInterState = order.supplyType === 'Inter-State';
      const lineIgst = isInterState ? lineTax : 0;
      const lineCgst = isInterState ? 0 : round2(lineTax / 2);
      const lineSgst = isInterState ? 0 : round2(lineTax - lineCgst);

      const lineTaxableValue = info.effectiveRate > 0 ? lineNetBeforeTax : 0;
      const lineGrandTotal = round2(lineNetBeforeTax + lineTax);

      // Apply Tax & GST report filters (Category, Individual Product, GST Rate, Search)
      if (categoryFilter !== 'ALL' && categoryId !== categoryFilter) return;
      if (productFilter !== 'ALL' && item.productId !== productFilter) return;
      if (rateFilter !== 'ALL') {
        const rateKey =
          info.effectiveRate === 0 ? `0-${info.treatment}` : String(info.effectiveRate);
        if (rateFilter === '0-ALL') {
          if (info.effectiveRate !== 0) return;
        } else if (rateKey !== rateFilter && String(info.effectiveRate) !== rateFilter) {
          return;
        }
      }
      if (searchQuery) {
        const matchesSearch =
          item.productName.toLowerCase().includes(searchQuery) ||
          item.sku.toLowerCase().includes(searchQuery) ||
          categoryName.toLowerCase().includes(searchQuery) ||
          order.billNumber.toLowerCase().includes(searchQuery);
        if (!matchesSearch) return;
      }

      totalRevenue = round2(totalRevenue + lineGrandTotal);
      taxableRevenue = round2(taxableRevenue + lineNetBeforeTax);
      gstCollected = round2(gstCollected + lineTax);
      totalCgst = round2(totalCgst + lineCgst);
      totalSgst = round2(totalSgst + lineSgst);
      totalIgst = round2(totalIgst + lineIgst);

      if (info.effectiveRate > 0) {
        totalTaxableSales = round2(totalTaxableSales + lineNetBeforeTax);
      } else if (info.treatment === 'Exempt') {
        exemptSales = round2(exemptSales + lineNetBeforeTax);
      } else {
        nilRatedSales = round2(nilRatedSales + lineNetBeforeTax);
      }

      const key = `${item.productId}::${info.effectiveRate}::${info.treatment}`;
      const existing = productMap.get(key) ?? {
        productId: item.productId,
        productName: item.productName,
        sku: prod?.sku ?? item.sku,
        categoryId,
        categoryName,
        qtySold: 0,
        totalSalesAmount: 0,
        taxableValue: 0,
        gstRate: info.effectiveRate,
        gstTreatment: info.treatment,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        totalGst: 0,
        totalIncludingGst: 0,
      };

      existing.qtySold = roundQty(existing.qtySold + item.quantity);
      existing.totalSalesAmount = round2(existing.totalSalesAmount + lineNetBeforeTax);
      existing.taxableValue = round2(existing.taxableValue + lineTaxableValue);
      existing.cgstAmount = round2(existing.cgstAmount + lineCgst);
      existing.sgstAmount = round2(existing.sgstAmount + lineSgst);
      existing.igstAmount = round2(existing.igstAmount + lineIgst);
      existing.totalGst = round2(existing.totalGst + lineTax);
      existing.totalIncludingGst = round2(existing.totalIncludingGst + lineGrandTotal);
      productMap.set(key, existing);
    });
  });

  const productRows = Array.from(productMap.values()).sort(
    (a, b) => b.totalGst - a.totalGst || b.totalIncludingGst - a.totalIncludingGst
  );

  // Build GST Rate-wise Breakdown
  const rateMap = new Map<
    string,
    {
      slabKey: string;
      label: string;
      gstRate: number;
      gstTreatment: GstTreatment;
      productIds: Set<string>;
      totalSales: number;
      taxableValue: number;
      cgst: number;
      sgst: number;
      igst: number;
      totalGst: number;
    }
  >();

  productRows.forEach((row) => {
    const slabKey =
      row.gstRate === 0 ? `0-${row.gstTreatment}` : `${row.gstRate}-Taxable`;
    const label =
      row.gstRate === 0
        ? `0% (${row.gstTreatment})`
        : `${row.gstRate}% GST`;

    const prev = rateMap.get(slabKey) ?? {
      slabKey,
      label,
      gstRate: row.gstRate,
      gstTreatment: row.gstTreatment,
      productIds: new Set<string>(),
      totalSales: 0,
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      totalGst: 0,
    };

    prev.productIds.add(row.productId);
    prev.totalSales = round2(prev.totalSales + row.totalSalesAmount);
    prev.taxableValue = round2(prev.taxableValue + row.taxableValue);
    prev.cgst = round2(prev.cgst + row.cgstAmount);
    prev.sgst = round2(prev.sgst + row.sgstAmount);
    prev.igst = round2(prev.igst + row.igstAmount);
    prev.totalGst = round2(prev.totalGst + row.totalGst);
    rateMap.set(slabKey, prev);
  });

  const rateRows: GstRateSlabRow[] = Array.from(rateMap.values())
    .map((r) => ({
      slabKey: r.slabKey,
      label: r.label,
      gstRate: r.gstRate,
      gstTreatment: r.gstTreatment,
      productCount: r.productIds.size,
      totalSales: r.totalSales,
      taxableValue: r.taxableValue,
      cgst: r.cgst,
      sgst: r.sgst,
      igst: r.igst,
      totalGst: r.totalGst,
    }))
    .sort((a, b) => a.gstRate - b.gstRate || a.label.localeCompare(b.label));

  // Refunded orders tax reversal transparency
  const refundedGstReversal = round2(
    refundedOrders.reduce((s, o) => s + o.taxAmount, 0)
  );
  const refundedSalesReversal = round2(
    refundedOrders.reduce((s, o) => s + o.grandTotal, 0)
  );

  // Payment & ITC records scoped to selected branch & overlapping date range
  const matchingPaymentRecords = gstPaymentRecords
    .filter((rec) => {
      if (resolvedBranchId && rec.branchId !== resolvedBranchId) return false;
      return overlapsDateRange(rec.periodStart, rec.periodEnd);
    })
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));

  // Only compute Estimated Net GST Payable if ITC/adjustment record exists for the active branch/period
  const hasItcData = matchingPaymentRecords.length > 0;
  const recordedItc = round2(
    matchingPaymentRecords.reduce((s, r) => s + r.inputTaxCredit, 0)
  );
  const recordedAdjustments = round2(
    matchingPaymentRecords.reduce((s, r) => s + r.adjustments, 0)
  );

  const estimatedNetPayable = hasItcData
    ? round2(Math.max(0, gstCollected - recordedItc + recordedAdjustments))
    : null;

  const revenueExcludingTax = round2(totalRevenue - gstCollected);

  return {
    totalRevenue,
    taxableRevenue,
    gstCollected,
    revenueExcludingTax,
    totalTaxableSales,
    exemptSales,
    nilRatedSales,
    totalCgst,
    totalSgst,
    totalIgst,
    refundedOrdersCount: refundedOrders.length,
    refundedGstReversal,
    refundedSalesReversal,
    hasItcData,
    recordedItc,
    recordedAdjustments,
    estimatedNetPayable,
    productRows,
    rateRows,
    matchingPaymentRecords,
  };
}

export function buildTaxGstExportSheets(
  data: TaxGstComputedData,
  paymentRecordsToExport: GstPaymentRecord[],
  scope:
    | 'all'
    | 'overview'
    | 'product_wise'
    | 'rate_wise'
    | 'collection_summary'
    | 'payment_records'
): ExportSheet[] {
  const overviewSheet: ExportSheet = {
    name: 'Tax & GST Summary',
    title: 'Tax & GST Overview',
    headers: ['Metric', 'Amount / Value (INR)', 'Notes'],
    rows: [
      ['Total Revenue (Incl. GST)', data.totalRevenue.toFixed(2), 'Completed bills only (refunds excluded)'],
      ['Taxable Revenue (Pre-GST Base)', data.taxableRevenue.toFixed(2), 'Subtotal - Discounts + Packaging'],
      ['GST Collected (Output GST)', data.gstCollected.toFixed(2), 'Actual GST collected from customers'],
      ['Revenue Excluding Tax', data.revenueExcludingTax.toFixed(2), 'Total Revenue minus GST Collected'],
      ['Total Taxable Sales', data.totalTaxableSales.toFixed(2), 'Sales on items with GST rate > 0%'],
      [
        'Estimated GST Liability',
        data.estimatedNetPayable !== null
          ? data.estimatedNetPayable.toFixed(2)
          : 'Pending ITC & Adjustment Data',
        data.hasItcData
          ? `After ITC (${data.recordedItc.toFixed(2)}) & Adjustments (${data.recordedAdjustments.toFixed(2)})`
          : 'Record Input Tax Credit & adjustments to estimate final payable',
      ],
    ],
  };

  const productSheet: ExportSheet = {
    name: 'Product-wise GST',
    title: 'Product-wise GST Report',
    headers: [
      'Product Name',
      'SKU',
      'Product Category',
      'Total Quantity Sold',
      'Total Sales Amount',
      'Taxable Value',
      'GST Rate (%)',
      'GST Treatment',
      'CGST Amount',
      'SGST Amount',
      'IGST Amount',
      'Total GST',
      'Total Amount Including GST',
    ],
    rows: data.productRows.map((r) => [
      r.productName,
      r.sku,
      r.categoryName,
      roundQty(r.qtySold),
      r.totalSalesAmount.toFixed(2),
      r.taxableValue.toFixed(2),
      r.gstRate,
      r.gstTreatment,
      r.cgstAmount.toFixed(2),
      r.sgstAmount.toFixed(2),
      r.igstAmount.toFixed(2),
      r.totalGst.toFixed(2),
      r.totalIncludingGst.toFixed(2),
    ]),
    totalsRow: [
      'TOTAL',
      '',
      '',
      roundQty(data.productRows.reduce((s, r) => s + r.qtySold, 0)),
      data.productRows.reduce((s, r) => s + r.totalSalesAmount, 0).toFixed(2),
      data.productRows.reduce((s, r) => s + r.taxableValue, 0).toFixed(2),
      '',
      '',
      data.totalCgst.toFixed(2),
      data.totalSgst.toFixed(2),
      data.totalIgst.toFixed(2),
      data.gstCollected.toFixed(2),
      data.totalRevenue.toFixed(2),
    ],
  };

  const rateSheet: ExportSheet = {
    name: 'GST Rate Breakdown',
    title: 'GST Rate-wise Breakdown',
    headers: [
      'GST Rate Slab',
      'Number of Products',
      'Total Sales',
      'Taxable Value',
      'CGST',
      'SGST',
      'IGST',
      'Total GST Collected',
    ],
    rows: data.rateRows.map((r) => [
      r.label,
      r.productCount,
      r.totalSales.toFixed(2),
      r.taxableValue.toFixed(2),
      r.cgst.toFixed(2),
      r.sgst.toFixed(2),
      r.igst.toFixed(2),
      r.totalGst.toFixed(2),
    ]),
    totalsRow: [
      'TOTAL',
      data.rateRows.reduce((s, r) => s + r.productCount, 0),
      data.rateRows.reduce((s, r) => s + r.totalSales, 0).toFixed(2),
      data.rateRows.reduce((s, r) => s + r.taxableValue, 0).toFixed(2),
      data.totalCgst.toFixed(2),
      data.totalSgst.toFixed(2),
      data.totalIgst.toFixed(2),
      data.gstCollected.toFixed(2),
    ],
  };

  const collectionSheet: ExportSheet = {
    name: 'Tax Collection Summary',
    title: 'GST Collection & Tax Summary',
    headers: ['Line Item', 'Amount (INR)', 'Classification'],
    rows: [
      ['Total Taxable Sales', data.totalTaxableSales.toFixed(2), 'Taxable Supply'],
      ['Exempt Sales', data.exemptSales.toFixed(2), 'Exempt Supply'],
      ['Nil-rated Sales', data.nilRatedSales.toFixed(2), 'Nil-Rated Supply'],
      ['CGST Collected', data.totalCgst.toFixed(2), 'Actual Output Tax'],
      ['SGST Collected', data.totalSgst.toFixed(2), 'Actual Output Tax'],
      ['IGST Collected', data.totalIgst.toFixed(2), 'Actual Output Tax'],
      ['Total Output GST Collected', data.gstCollected.toFixed(2), 'Actual Output Tax'],
      [
        'Refunded / Voided Bills GST Reversal (Excluded)',
        data.refundedGstReversal.toFixed(2),
        `${data.refundedOrdersCount} Refunded Order(s)`,
      ],
      [
        'Applicable Adjustments',
        data.hasItcData ? data.recordedAdjustments.toFixed(2) : 'Not Recorded',
        'Recorded Adjustments',
      ],
      [
        'Available Input Tax Credit (ITC)',
        data.hasItcData ? data.recordedItc.toFixed(2) : 'Not Recorded',
        'Input Tax Credit',
      ],
      [
        'Estimated Net GST Payable',
        data.estimatedNetPayable !== null
          ? data.estimatedNetPayable.toFixed(2)
          : 'Pending ITC & Adjustment Data',
        'Estimated Payable (For Accounts Review)',
      ],
    ],
  };

  const paymentSheet: ExportSheet = {
    name: 'Tax Payment Records',
    title: 'Tax Payment Summary',
    headers: [
      'Period',
      'Branch',
      'Total Output GST',
      'Available Input Tax Credit',
      'Adjustments',
      'Estimated GST Payable',
      'Paid Amount',
      'Payment Status',
      'Payment Date',
      'Reference Number',
      'Notes',
    ],
    rows: paymentRecordsToExport.map((rec) => {
      const estPayable = Math.max(0, rec.outputGst - rec.inputTaxCredit + rec.adjustments);
      return [
        rec.periodLabel,
        rec.branchName,
        rec.outputGst.toFixed(2),
        rec.inputTaxCredit.toFixed(2),
        rec.adjustments.toFixed(2),
        estPayable.toFixed(2),
        rec.paidAmount.toFixed(2),
        rec.status,
        rec.paymentDate || '—',
        rec.referenceNumber || '—',
        rec.notes || '',
      ];
    }),
  };

  if (scope === 'overview') return [overviewSheet];
  if (scope === 'product_wise') return [productSheet];
  if (scope === 'rate_wise') return [rateSheet];
  if (scope === 'collection_summary') return [collectionSheet];
  if (scope === 'payment_records') return [paymentSheet];
  return [overviewSheet, productSheet, rateSheet, collectionSheet, paymentSheet];
}

interface TaxGstReportSectionProps {
  data: TaxGstComputedData;
  allBranchPaymentRecords: GstPaymentRecord[];
  branches: Branch[];
  activeBranchId: string;
  resolvedBranchId: string | null;
  canManageTaxRecords: boolean;
  onAddRecord: (
    record: Omit<GstPaymentRecord, 'id' | 'updatedAt' | 'updatedBy'>
  ) => GstPaymentRecord | null;
  onUpdateRecord: (record: GstPaymentRecord) => boolean;
}

export const TaxGstReportSection: React.FC<TaxGstReportSectionProps> = ({
  data,
  allBranchPaymentRecords,
  branches,
  activeBranchId,
  resolvedBranchId,
  canManageTaxRecords,
  onAddRecord,
  onUpdateRecord,
}) => {
  const [showAllPeriods, setShowAllPeriods] = useState<boolean>(true);
  const [showRecordModal, setShowRecordModal] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<GstPaymentRecord | null>(null);

  // Modal Form State
  const [formPeriodLabel, setFormPeriodLabel] = useState('Nov 2026 (Current Period)');
  const [formPeriodStart, setFormPeriodStart] = useState('2026-11-01');
  const [formPeriodEnd, setFormPeriodEnd] = useState('2026-11-30');
  const [formBranchId, setFormBranchId] = useState(resolvedBranchId ?? activeBranchId);
  const [formOutputGst, setFormOutputGst] = useState('');
  const [formItc, setFormItc] = useState('');
  const [formAdjustments, setFormAdjustments] = useState('0');
  const [formPaidAmount, setFormPaidAmount] = useState('0');
  const [formStatus, setFormStatus] = useState<GstPaymentStatus>('Pending');
  const [formPaymentDate, setFormPaymentDate] = useState('');
  const [formReferenceNumber, setFormReferenceNumber] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const displayedPaymentRecords = useMemo(() => {
    const base = showAllPeriods ? allBranchPaymentRecords : data.matchingPaymentRecords;
    return base.filter((rec) => !resolvedBranchId || rec.branchId === resolvedBranchId);
  }, [showAllPeriods, allBranchPaymentRecords, data.matchingPaymentRecords, resolvedBranchId]);

  const openCreateModal = () => {
    setEditingRecord(null);
    setFormPeriodLabel('Nov 2026 (Current Period)');
    setFormPeriodStart('2026-11-01');
    setFormPeriodEnd('2026-11-30');
    setFormBranchId(resolvedBranchId ?? activeBranchId);
    setFormOutputGst(data.gstCollected.toFixed(2));
    setFormItc('');
    setFormAdjustments('0');
    setFormPaidAmount('0');
    setFormStatus('Pending');
    setFormPaymentDate('');
    setFormReferenceNumber('');
    setFormNotes('');
    setShowRecordModal(true);
  };

  const openEditModal = (rec: GstPaymentRecord) => {
    setEditingRecord(rec);
    setFormPeriodLabel(rec.periodLabel);
    setFormPeriodStart(rec.periodStart);
    setFormPeriodEnd(rec.periodEnd);
    setFormBranchId(rec.branchId);
    setFormOutputGst(rec.outputGst.toFixed(2));
    setFormItc(rec.inputTaxCredit.toFixed(2));
    setFormAdjustments(rec.adjustments.toFixed(2));
    setFormPaidAmount(rec.paidAmount.toFixed(2));
    setFormStatus(rec.status);
    setFormPaymentDate(rec.paymentDate ?? '');
    setFormReferenceNumber(rec.referenceNumber ?? '');
    setFormNotes(rec.notes ?? '');
    setShowRecordModal(true);
  };

  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const br = branches.find((b) => b.id === formBranchId);
    const payload = {
      periodLabel: formPeriodLabel.trim() || 'Custom Period',
      periodStart: formPeriodStart || TODAY_ISO,
      periodEnd: formPeriodEnd || TODAY_ISO,
      branchId: formBranchId,
      branchName: br?.name ?? 'Kirumambakkam Branch',
      outputGst: roundCurrency(Math.max(0, Number(formOutputGst) || 0)),
      inputTaxCredit: roundCurrency(Math.max(0, Number(formItc) || 0)),
      adjustments: roundCurrency(Number(formAdjustments) || 0),
      paidAmount: roundCurrency(Math.max(0, Number(formPaidAmount) || 0)),
      status: formStatus,
      paymentDate: formPaymentDate.trim() || undefined,
      referenceNumber: formReferenceNumber.trim() || undefined,
      notes: formNotes.trim() || undefined,
    };

    if (editingRecord) {
      onUpdateRecord({
        ...editingRecord,
        ...payload,
      });
    } else {
      onAddRecord(payload);
    }
    setShowRecordModal(false);
  };

  const topGstContributor = data.productRows[0] ?? null;

  const productTotals = useMemo(
    () =>
      data.productRows.reduce(
        (acc, r) => ({
          qty: roundQty(acc.qty + r.qtySold),
          sales: round2(acc.sales + r.totalSalesAmount),
          taxable: round2(acc.taxable + r.taxableValue),
          cgst: round2(acc.cgst + r.cgstAmount),
          sgst: round2(acc.sgst + r.sgstAmount),
          igst: round2(acc.igst + r.igstAmount),
          totalGst: round2(acc.totalGst + r.totalGst),
          totalIncl: round2(acc.totalIncl + r.totalIncludingGst),
        }),
        { qty: 0, sales: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0, totalIncl: 0 }
      ),
    [data.productRows]
  );

  return (
    <div className="space-y-5">
      {/* Section A – Tax & GST Overview (6 KPI Cards) */}
      <section aria-label="Tax and GST Overview">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-3.5 sm:p-4">
            <div className="text-[12px] font-medium text-[#64748B]">Total Revenue</div>
            <div className="text-[19px] sm:text-[22px] font-bold text-[#181210] mt-1 tabular-nums">
              {formatINR(data.totalRevenue)}
            </div>
            <div className="text-[11px] text-[#64748B] mt-1">
              Total completed sales including applicable GST
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
            <div className="text-[12px] font-medium text-[#64748B]">Taxable Revenue</div>
            <div className="text-[22px] font-bold text-[#181210] mt-1 tabular-nums">
              {formatINR(data.taxableRevenue)}
            </div>
            <div className="text-[11px] text-[#64748B] mt-1">
              Total sales value before GST (after discounts &amp; packaging)
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[#64748B]">GST Collected</span>
              <span className="px-2 py-0.5 rounded bg-[#FFF7ED] text-[#C2410C] text-[10px] font-semibold uppercase tracking-wide">
                Actual Output Tax
              </span>
            </div>
            <div className="text-[22px] font-bold text-[#FB923C] mt-1 tabular-nums">
              {formatINR(data.gstCollected)}
            </div>
            <div className="text-[11px] text-[#64748B] mt-1 tabular-nums">
              CGST {formatINR(data.totalCgst)} · SGST {formatINR(data.totalSgst)}
              {data.totalIgst > 0 ? ` · IGST ${formatINR(data.totalIgst)}` : ''}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
            <div className="text-[12px] font-medium text-[#64748B]">Revenue Excluding Tax</div>
            <div className="text-[22px] font-bold text-[#181210] mt-1 tabular-nums">
              {formatINR(data.revenueExcludingTax)}
            </div>
            <div className="text-[11px] text-[#64748B] mt-1">
              Net revenue after excluding collected GST
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
            <div className="text-[12px] font-medium text-[#64748B]">Total Taxable Sales</div>
            <div className="text-[22px] font-bold text-[#181210] mt-1 tabular-nums">
              {formatINR(data.totalTaxableSales)}
            </div>
            <div className="text-[11px] text-[#64748B] mt-1 tabular-nums">
              Sales subject to GST &gt; 0%
              {data.exemptSales + data.nilRatedSales > 0
                ? ` · ${formatINR(data.exemptSales + data.nilRatedSales)} exempt/nil-rated`
                : ''}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[#64748B]">Estimated GST Liability</span>
              <span className="px-2 py-0.5 rounded bg-[#FAF9F5] border border-[#E5E7EB] text-[#64748B] text-[10px] font-semibold uppercase tracking-wide">
                Estimated
              </span>
            </div>
            {data.estimatedNetPayable !== null ? (
              <>
                <div className="text-[22px] font-bold text-[#181210] mt-1 tabular-nums">
                  {formatINR(data.estimatedNetPayable)}
                </div>
                <div className="text-[11px] text-[#64748B] mt-1 tabular-nums">
                  After ITC {formatINR(data.recordedItc)}
                  {data.recordedAdjustments !== 0
                    ? ` & adj. ${formatINR(data.recordedAdjustments)}`
                    : ''}
                </div>
              </>
            ) : (
              <>
                <div className="text-[16px] font-bold text-[#C2410C] mt-1.5">
                  Pending ITC &amp; Adjustment Data
                </div>
                <div className="text-[11px] text-[#64748B] mt-1">
                  Output GST collected is {formatINR(data.gstCollected)}. Record ITC below to estimate payable.
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Section B – Product-wise GST Report */}
      <section className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <div className="px-4 py-3.5 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[14px] font-bold text-[#181210]">Product-wise GST Report</h3>
            <p className="text-[12px] text-[#64748B]">
              Item-level GST contribution sorted by highest tax collected ({data.productRows.length} items)
            </p>
          </div>
          {topGstContributor && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FFF7ED] border border-[#FED7AA] text-[11px] font-semibold text-[#C2410C]">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#FB923C]" />
              Top GST Contributor: {topGstContributor.productName} ({formatINRCompact(topGstContributor.totalGst)})
            </div>
          )}
        </div>

        <div className="md:hidden divide-y divide-[#E5E7EB]">
          {data.productRows.length === 0 ? (
            <div className="py-10 px-4 text-center text-[13px] text-[#64748B]">
              No tax records match the selected date range, branch, or product filters.
            </div>
          ) : (
            data.productRows.map((row, idx) => (
              <div
                key={`${row.productId}-${row.gstRate}-${row.gstTreatment}`}
                className="p-3.5 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-[13px] text-[#181210]">
                        {row.productName}
                      </span>
                      {idx === 0 && row.totalGst > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-[#FFF7ED] text-[#C2410C] text-[10px] font-semibold">
                          Top
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-[#64748B]">
                      {row.sku} · {row.categoryName}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[13.5px] font-bold text-[#C2410C] tabular-nums">
                      {formatINR(row.totalGst)} GST
                    </div>
                    <div className="text-[11px] text-[#64748B] tabular-nums">
                      {row.gstRate === 0 ? `0% (${row.gstTreatment})` : `${row.gstRate}% GST`}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-[#64748B] tabular-nums pt-1 border-t border-[#E5E7EB]/60">
                  <div>Qty: <strong className="text-[#181210]">{formatDecimal(row.qtySold, 3)}</strong></div>
                  <div className="text-right">Taxable: <strong className="text-[#181210]">{formatINR(row.taxableValue)}</strong></div>
                  <div>CGST {formatINR(row.cgstAmount)} · SGST {formatINR(row.sgstAmount)}</div>
                  <div className="text-right">Incl. GST: <strong className="text-[#181210]">{formatINR(row.totalIncludingGst)}</strong></div>
                </div>
              </div>
            ))
          )}
          {data.productRows.length > 0 && (
            <div className="p-3.5 bg-[#FAF9F5] border-t border-[#E5E7EB] flex items-center justify-between text-[12px] font-bold text-[#181210]">
              <span>Total ({data.productRows.length} items)</span>
              <span className="tabular-nums text-[#C2410C]">
                {formatINR(productTotals.totalGst)} / {formatINR(productTotals.totalIncl)}
              </span>
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[880px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase text-[#64748B]">
                <th className="py-2.5 px-4">Product Name</th>
                <th className="py-2.5 px-3">Product Category</th>
                <th className="py-2.5 px-3 text-right">Qty Sold</th>
                <th className="py-2.5 px-3 text-right">Total Sales Amt</th>
                <th className="py-2.5 px-3 text-right">Taxable Value</th>
                <th className="py-2.5 px-3 text-right">GST Rate</th>
                <th className="py-2.5 px-3 text-right">CGST</th>
                <th className="py-2.5 px-3 text-right">SGST</th>
                <th className="py-2.5 px-3 text-right">IGST</th>
                <th className="py-2.5 px-3 text-right">Total GST</th>
                <th className="py-2.5 px-4 text-right">Total Incl. GST</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]/70 text-[12px]">
              {data.productRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-[13px] text-[#64748B]">
                    No tax records match the selected date range, branch, or product filters.
                  </td>
                </tr>
              ) : (
                data.productRows.map((row, idx) => (
                  <tr
                    key={`${row.productId}-${row.gstRate}-${row.gstTreatment}`}
                    className="hover:bg-[#FAF9F5]/70"
                  >
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#181210]">{row.productName}</span>
                        {idx === 0 && row.totalGst > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FFF7ED] text-[#C2410C] text-[10px] font-semibold">
                            Top
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-[#64748B]">{row.sku}</div>
                    </td>
                    <td className="py-2.5 px-3 text-[#64748B]">{row.categoryName}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-medium">
                      {formatDecimal(row.qtySold, 3)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatINR(row.totalSalesAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatINR(row.taxableValue)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {row.gstRate === 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#4B5563] text-[11px] font-semibold">
                          0% ({row.gstTreatment})
                        </span>
                      ) : (
                        <span className="font-semibold text-[#181210]">{row.gstRate}%</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[#64748B]">
                      {formatINR(row.cgstAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[#64748B]">
                      {formatINR(row.sgstAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-[#64748B]">
                      {formatINR(row.igstAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#C2410C]">
                      {formatINR(row.totalGst)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-bold text-[#181210]">
                      {formatINR(row.totalIncludingGst)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data.productRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#E5E7EB] bg-[#FAF9F5] text-[12px] font-bold text-[#181210]">
                  <td className="py-2.5 px-4" colSpan={2}>
                    Total ({data.productRows.length} Product Lines)
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {formatDecimal(productTotals.qty, 3)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {formatINR(productTotals.sales)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {formatINR(productTotals.taxable)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#64748B]">—</td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {formatINR(productTotals.cgst)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {formatINR(productTotals.sgst)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    {formatINR(productTotals.igst)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-[#FB923C]">
                    {formatINR(productTotals.totalGst)}
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums">
                    {formatINR(productTotals.totalIncl)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* Section C & Section D Side-by-Side on wide screens */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Section C – GST Rate-wise Breakdown */}
        <section className="xl:col-span-7 bg-white rounded-lg border border-[#E5E7EB] overflow-hidden flex flex-col">
          <div className="px-4 py-3.5 border-b border-[#E5E7EB]">
            <h3 className="text-[14px] font-bold text-[#181210]">GST Rate-wise Breakdown</h3>
            <p className="text-[12px] text-[#64748B]">
              Compare taxable base and tax collected across applicable GST rate slabs
            </p>
          </div>
          <div className="md:hidden divide-y divide-[#E5E7EB]">
            {data.rateRows.length === 0 ? (
              <div className="py-10 px-4 text-center text-[13px] text-[#64748B]">
                No GST rate slabs found for the current filter selection.
              </div>
            ) : (
              data.rateRows.map((slab) => (
                <div key={slab.slabKey} className="p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[13px] text-[#181210]">{slab.label}</span>
                    <span className="font-bold text-[13px] text-[#FB923C] tabular-nums">
                      {formatINR(slab.totalGst)}
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2 text-[11px] text-[#64748B] tabular-nums">
                    <span>{slab.productCount} products · Sales {formatINR(slab.totalSales)}</span>
                    <span>CGST {formatINR(slab.cgst)} · SGST {formatINR(slab.sgst)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="hidden md:block overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[660px]">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase text-[#64748B]">
                  <th className="py-2.5 px-4">GST Rate</th>
                  <th className="py-2.5 px-3 text-right">Products</th>
                  <th className="py-2.5 px-3 text-right">Total Sales</th>
                  <th className="py-2.5 px-3 text-right">Taxable Value</th>
                  <th className="py-2.5 px-3 text-right">CGST</th>
                  <th className="py-2.5 px-3 text-right">SGST</th>
                  <th className="py-2.5 px-3 text-right">IGST</th>
                  <th className="py-2.5 px-4 text-right">Total GST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]/70 text-[12px]">
                {data.rateRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-[#64748B]">
                      No GST rate slabs found for the current filter selection.
                    </td>
                  </tr>
                ) : (
                  data.rateRows.map((slab) => (
                    <tr key={slab.slabKey} className="hover:bg-[#FAF9F5]/70">
                      <td className="py-2.5 px-4 font-semibold text-[#181210]">{slab.label}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{slab.productCount}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {formatINR(slab.totalSales)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {formatINR(slab.taxableValue)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[#64748B]">
                        {formatINR(slab.cgst)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[#64748B]">
                        {formatINR(slab.sgst)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[#64748B]">
                        {formatINR(slab.igst)}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-bold text-[#FB923C]">
                        {formatINR(slab.totalGst)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {data.rateRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-[#E5E7EB] bg-[#FAF9F5] text-[12px] font-bold text-[#181210]">
                    <td className="py-2.5 px-4">Total</td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {data.rateRows.reduce((s, r) => s + r.productCount, 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatINR(productTotals.sales)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatINR(productTotals.taxable)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatINR(data.totalCgst)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatINR(data.totalSgst)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">
                      {formatINR(data.totalIgst)}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-[#FB923C]">
                      {formatINR(data.gstCollected)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>

        {/* Section D – GST Collection & Tax Summary */}
        <section className="xl:col-span-5 bg-white rounded-lg border border-[#E5E7EB] overflow-hidden flex flex-col">
          <div className="px-4 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between gap-2">
            <div>
              <h3 className="text-[14px] font-bold text-[#181210]">
                GST Collection &amp; Tax Summary
              </h3>
              <p className="text-[12px] text-[#64748B]">
                Actual Output GST collected vs. estimated net payable
              </p>
            </div>
            <ReceiptIndianRupee className="w-4 h-4 text-[#FB923C] shrink-0" />
          </div>

          <div className="p-4 space-y-2 text-[12px] flex-1">
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]/60">
              <span className="text-[#64748B]">Total Taxable Sales</span>
              <span className="font-semibold text-[#181210] tabular-nums">
                {formatINR(data.totalTaxableSales)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]/60">
              <span className="text-[#64748B]">Exempt Sales</span>
              <span className="font-semibold text-[#181210] tabular-nums">
                {formatINR(data.exemptSales)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]/60">
              <span className="text-[#64748B]">Nil-rated Sales</span>
              <span className="font-semibold text-[#181210] tabular-nums">
                {formatINR(data.nilRatedSales)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]/60">
              <span className="text-[#64748B]">CGST Collected (Intra-State)</span>
              <span className="font-semibold text-[#181210] tabular-nums">
                {formatINR(data.totalCgst)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]/60">
              <span className="text-[#64748B]">SGST Collected (Intra-State)</span>
              <span className="font-semibold text-[#181210] tabular-nums">
                {formatINR(data.totalSgst)}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]/60">
              <span className="text-[#64748B]">IGST Collected (Inter-State)</span>
              <span className="font-semibold text-[#181210] tabular-nums">
                {formatINR(data.totalIgst)}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 px-2.5 rounded-md bg-[#FFF7ED] border border-[#FED7AA]">
              <div>
                <div className="font-bold text-[#181210]">Total Output GST</div>
                <div className="text-[11px] text-[#C2410C]">Actual tax collected from bills</div>
              </div>
              <span className="text-[15px] font-bold text-[#FB923C] tabular-nums">
                {formatINR(data.gstCollected)}
              </span>
            </div>

            {data.refundedOrdersCount > 0 && (
              <div className="flex justify-between items-center py-1.5 px-2.5 rounded bg-[#FAF9F5] border border-[#E5E7EB] text-[11px]">
                <span className="text-[#64748B]">
                  Excluded Refunded Bills ({data.refundedOrdersCount}) GST Reversal
                </span>
                <span className="font-semibold text-[#B91C1C] tabular-nums">
                  {formatINR(data.refundedGstReversal)}
                </span>
              </div>
            )}

            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]/60">
              <span className="text-[#64748B]">Applicable Adjustments</span>
              <span className="font-semibold text-[#181210] tabular-nums">
                {data.hasItcData ? formatINR(data.recordedAdjustments) : 'Not Recorded'}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-[#E5E7EB]/60">
              <span className="text-[#64748B]">Available Input Tax Credit (ITC)</span>
              <span className="font-semibold text-[#15803D] tabular-nums">
                {data.hasItcData ? `-${formatINR(data.recordedItc)}` : 'Not Recorded'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2.5 px-2.5 rounded-md bg-[#FAF9F5] border border-[#E5E7EB]">
              <div>
                <div className="font-bold text-[#181210]">Estimated Net GST Payable</div>
                <div className="text-[11px] text-[#64748B]">
                  {data.hasItcData
                    ? 'Estimated liability after recorded ITC & adjustments'
                    : 'Requires ITC & adjustment entry for selected branch/period'}
                </div>
              </div>
              <span className="text-[14px] font-bold text-[#181210] tabular-nums text-right">
                {data.estimatedNetPayable !== null
                  ? formatINR(data.estimatedNetPayable)
                  : 'Pending ITC'}
              </span>
            </div>

            {!data.hasItcData && (
              <div className="flex items-start gap-2 p-2.5 rounded-md bg-[#FFFBEB] border border-[#FDE68A] text-[11px] text-[#92400E]">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Final net GST payable is not calculated because Input Tax Credit and statutory adjustment data have not been recorded for this branch/period yet.
                </span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Section E – Tax Payment Summary */}
      <section className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
        <div className="px-4 py-3.5 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-bold text-[#181210]">Tax Payment Summary</h3>
            <p className="text-[12px] text-[#64748B]">
              Accounts reconciliation ledger for GST output, ITC offsets, challan references, and payment status
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAllPeriods((prev) => !prev)}
              className="px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-[#FAF9F5] hover:bg-white text-[12px] font-semibold text-[#181210]"
            >
              {showAllPeriods ? 'Showing All Recorded Periods' : 'Showing Selected Date Range'}
            </button>

            {canManageTaxRecords && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[12px] font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Record ITC / Tax Payment
              </button>
            )}
          </div>
        </div>

        <div className="px-4 py-2.5 bg-[#FAF9F5] border-b border-[#E5E7EB] flex items-center gap-2 text-[11px] text-[#64748B]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#FB923C] shrink-0" />
          <span>
            Accounts preparation view only — this report helps review GST collections, ITC, and payment references; it does not submit GST returns or process statutory payments.
          </span>
        </div>

        <div className="md:hidden divide-y divide-[#E5E7EB]">
          {displayedPaymentRecords.length === 0 ? (
            <div className="py-10 px-4 text-center text-[13px] text-[#64748B]">
              No GST payment or ITC records logged for the selected branch or period.
            </div>
          ) : (
            displayedPaymentRecords.map((rec) => {
              const estPayable = Math.max(
                0,
                round2(rec.outputGst - rec.inputTaxCredit + rec.adjustments)
              );
              return (
                <div key={rec.id} className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-[13px] text-[#181210]">{rec.periodLabel}</div>
                      <div className="text-[11px] text-[#64748B]">{rec.branchName}</div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                        rec.status === 'Paid'
                          ? 'bg-[#DCFCE7] text-[#15803D]'
                          : rec.status === 'Partially Paid'
                          ? 'bg-[#FFEDD5] text-[#C2410C]'
                          : 'bg-[#FEE2E2] text-[#B91C1C]'
                      }`}
                    >
                      {rec.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[11.5px] text-[#64748B] tabular-nums">
                    <div>Output: <strong className="text-[#181210]">{formatINR(rec.outputGst)}</strong></div>
                    <div className="text-right">ITC: <strong className="text-[#15803D]">{formatINR(rec.inputTaxCredit)}</strong></div>
                    <div>Payable: <strong className="text-[#181210]">{formatINR(estPayable)}</strong></div>
                    <div className="text-right">Paid: <strong className="text-[#181210]">{formatINR(rec.paidAmount)}</strong></div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#E5E7EB]/60 text-[11px]">
                    <span className="font-mono text-[#64748B] truncate">
                      {rec.referenceNumber || 'No ref'} {rec.paymentDate ? `· ${formatDateShort(rec.paymentDate)}` : ''}
                    </span>
                    {canManageTaxRecords && (
                      <button
                        type="button"
                        onClick={() => openEditModal(rec)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-[#E5E7EB] hover:bg-[#FAF9F5] text-[11px] font-semibold text-[#181210] shrink-0"
                      >
                        <Edit3 className="w-3 h-3" />
                        Update
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase text-[#64748B]">
                <th className="py-2.5 px-4">Period &amp; Branch</th>
                <th className="py-2.5 px-3 text-right">Total Output GST</th>
                <th className="py-2.5 px-3 text-right">Available ITC</th>
                <th className="py-2.5 px-3 text-right">Adjustments</th>
                <th className="py-2.5 px-3 text-right">Estimated Payable</th>
                <th className="py-2.5 px-3 text-right">Paid Amount</th>
                <th className="py-2.5 px-3">Payment Status</th>
                <th className="py-2.5 px-3">Payment Date</th>
                <th className="py-2.5 px-3">Reference Number</th>
                {canManageTaxRecords && <th className="py-2.5 px-4 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]/70 text-[12px]">
              {displayedPaymentRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManageTaxRecords ? 10 : 9}
                    className="py-10 text-center text-[#64748B]"
                  >
                    No GST payment or ITC records logged for the selected branch or period.
                  </td>
                </tr>
              ) : (
                displayedPaymentRecords.map((rec) => {
                  const estPayable = Math.max(
                    0,
                    round2(rec.outputGst - rec.inputTaxCredit + rec.adjustments)
                  );
                  return (
                    <tr key={rec.id} className="hover:bg-[#FAF9F5]/70">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-[#181210]">{rec.periodLabel}</div>
                        <div className="text-[11px] text-[#64748B]">{rec.branchName}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium">
                        {formatINR(rec.outputGst)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[#15803D]">
                        {formatINR(rec.inputTaxCredit)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[#64748B]">
                        {formatINR(rec.adjustments)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-[#181210]">
                        {formatINR(estPayable)}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-[#181210]">
                        {formatINR(rec.paidAmount)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            rec.status === 'Paid'
                              ? 'bg-[#DCFCE7] text-[#15803D]'
                              : rec.status === 'Partially Paid'
                              ? 'bg-[#FFEDD5] text-[#C2410C]'
                              : 'bg-[#FEE2E2] text-[#B91C1C]'
                          }`}
                        >
                          {rec.status === 'Paid' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : rec.status === 'Partially Paid' ? (
                            <Clock className="w-3 h-3" />
                          ) : (
                            <AlertCircle className="w-3 h-3" />
                          )}
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 tabular-nums text-[#64748B] whitespace-nowrap">
                        {rec.paymentDate ? formatDateShort(rec.paymentDate) : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#181210]">
                        {rec.referenceNumber || '—'}
                      </td>
                      {canManageTaxRecords && (
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => openEditModal(rec)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#E5E7EB] hover:bg-[#FAF9F5] text-[11px] font-semibold text-[#181210]"
                          >
                            <Edit3 className="w-3 h-3" />
                            Update
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal to Record / Update ITC & GST Payment Entry */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#E5E7EB] flex items-center justify-between gap-2 shrink-0">
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-[#181210] truncate">
                  {editingRecord ? 'Update ITC & Tax Payment Record' : 'Record ITC & Tax Payment Entry'}
                </h3>
                <p className="text-[12px] text-[#64748B] truncate">
                  Log verified Input Tax Credit, adjustments, or GST challan payment reference
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRecordModal(false)}
                className="p-1.5 rounded text-[#64748B] hover:text-[#181210] shrink-0"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-[12px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#181210] mb-1">
                    Tax Period Label
                  </label>
                  <input
                    type="text"
                    required
                    value={formPeriodLabel}
                    onChange={(e) => setFormPeriodLabel(e.target.value)}
                    placeholder="e.g. Nov 2026"
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#181210] mb-1">Branch</label>
                  <select
                    value={formBranchId}
                    onChange={(e) => setFormBranchId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#181210] mb-1">Period From</label>
                  <input
                    type="date"
                    required
                    value={formPeriodStart}
                    onChange={(e) => setFormPeriodStart(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#181210] mb-1">Period To</label>
                  <input
                    type="date"
                    required
                    value={formPeriodEnd}
                    onChange={(e) => setFormPeriodEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#181210] mb-1">Output GST (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formOutputGst}
                    onChange={(e) => setFormOutputGst(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#181210] mb-1">
                    Available ITC (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formItc}
                    onChange={(e) => setFormItc(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#181210] mb-1">
                    Adjustments (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formAdjustments}
                    onChange={(e) => setFormAdjustments(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#181210] mb-1">Payment Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as GstPaymentStatus)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#181210] mb-1">Paid Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formPaidAmount}
                    onChange={(e) => setFormPaidAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#181210] mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={formPaymentDate}
                    onChange={(e) => setFormPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#181210] mb-1">
                  Challan / Reference Number
                </label>
                <input
                  type="text"
                  value={formReferenceNumber}
                  onChange={(e) => setFormReferenceNumber(e.target.value)}
                  placeholder="e.g. PMT-GST-261121-1042"
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#181210] mb-1">Notes</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Optional accounts / ITC invoice notes"
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="w-full sm:w-auto px-4 py-2 rounded-md border border-[#E5E7EB] font-medium text-[#181210]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white font-semibold"
                >
                  {editingRecord ? 'Save Changes' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
