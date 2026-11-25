import React from 'react';
import { Printer, X, CheckCircle2 } from 'lucide-react';
import { CompletedOrder, StoreSettings } from '../../types/pos';
import { formatDateTime, formatDecimal, formatINR, roundCurrency } from '../../utils/formatters';
import { usePos } from '../../context/PosContext';

interface ReceiptModalProps {
  order: CompletedOrder | null;
  settings: StoreSettings;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, settings, onClose }) => {
  const { branches } = usePos();
  if (!order) return null;

  const issuingBranch = branches.find((b) => b.id === order.branchId);
  const branchName = issuingBranch?.name || order.branchName || settings.branchName;
  const branchAddress = issuingBranch?.address || settings.address;
  const branchPhone = issuingBranch?.phone || settings.phone;
  const headerNote =
    issuingBranch?.operationalSettings.receiptHeaderNote || settings.receiptHeaderNote;
  const footerNote =
    issuingBranch?.operationalSettings.receiptFooterNote || settings.receiptFooterNote;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F5] gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
            <h3 className="text-[14px] sm:text-[15px] font-semibold text-[#181210] truncate">
              Bill Receipt — {order.billNumber}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[#64748B] hover:text-[#181210] hover:bg-[#E5E7EB]/50 transition-colors shrink-0"
            aria-label="Close receipt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 sm:p-5 overflow-y-auto bg-[#E0E2E7]/40 flex justify-center">
          <div
            id="printable-receipt"
            className={`w-full bg-white border border-[#E5E7EB] rounded-lg text-[#181210] shadow-xs ${
              settings.receiptPaperSize === '2inch'
                ? 'max-w-[230px] p-3 text-[10px]'
                : 'max-w-[330px] p-4'
            }`}
          >
            <div className="text-center border-b border-dashed border-[#D1D5DB] pb-3 mb-3">
              {settings.businessLogoUrl && (
                <img
                  src={settings.businessLogoUrl}
                  alt="Store logo"
                  className="mx-auto h-9 max-w-[120px] object-contain mb-1.5"
                />
              )}
              <div className="text-[15px] font-bold tracking-tight">{settings.businessName}</div>
              <div className="text-[11px] text-[#64748B] mt-0.5">{branchName}</div>
              <div className="text-[11px] text-[#64748B]">{branchAddress}</div>
              {branchPhone && <div className="text-[11px] text-[#64748B]">Tel: {branchPhone}</div>}
              {settings.showFssaiOnReceipt && settings.fssaiNumber && (
                <div className="text-[10px] font-mono text-[#64748B] mt-1">FSSAI: {settings.fssaiNumber}</div>
              )}
              {settings.showGstOnReceipt && settings.gstin && (
                <div className="text-[10px] font-mono text-[#64748B]">GSTIN: {settings.gstin}</div>
              )}
              {headerNote && (
                <div className="text-[10px] text-[#181210] font-medium mt-1.5">{headerNote}</div>
              )}
            </div>

            <div className="text-[11px] space-y-1 border-b border-dashed border-[#D1D5DB] pb-2.5 mb-2.5">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Bill No:</span>
                <span className="font-mono font-semibold">{order.billNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Date:</span>
                <span className="tabular-nums">{formatDateTime(order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Customer:</span>
                <span className="font-medium">{order.customerName}</span>
              </div>
              {settings.showCustomerPhoneOnReceipt && order.customerPhone && (
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Phone:</span>
                  <span className="tabular-nums">{order.customerPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#64748B]">Staff:</span>
                <span>{order.cashierName}</span>
              </div>
            </div>

            <div className="border-b border-dashed border-[#D1D5DB] pb-2.5 mb-2.5">
              <div className="flex text-[10px] font-semibold uppercase text-[#64748B] pb-1.5">
                <span className="flex-1">Item / Variant</span>
                <span className="w-10 text-right">Qty</span>
                <span className="w-20 text-right">Amount</span>
              </div>
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div key={item.lineId} className="text-[11px] flex items-start gap-1">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium leading-tight">{item.productName}</div>
                      <div className="text-[10px] text-[#64748B]">
                        {item.variantLabel} · {formatINR(item.unitPrice)}
                      </div>
                    </div>
                    <span className="w-10 text-right tabular-nums">{formatDecimal(item.quantity, 3)}</span>
                    <span className="w-20 text-right font-medium tabular-nums">
                      {formatINR(roundCurrency(item.unitPrice * item.quantity))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[11px] space-y-1 border-b border-dashed border-[#D1D5DB] pb-2.5 mb-2.5">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Subtotal</span>
                <span className="tabular-nums">{formatINR(order.subtotal)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-[#16A34A]">
                  <span>Discount</span>
                  <span className="tabular-nums">-{formatINR(order.discountAmount)}</span>
                </div>
              )}
              {order.packagingCharge > 0 && (
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Box / Packaging</span>
                  <span className="tabular-nums">{formatINR(order.packagingCharge)}</span>
                </div>
              )}
              {settings.showGstOnReceipt && (
                <div className="flex justify-between">
                  <span className="text-[#64748B]">GST (Tax)</span>
                  <span className="tabular-nums">{formatINR(order.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[14px] font-bold pt-1.5 border-t border-[#E5E7EB]">
                <span>Grand Total</span>
                <span className="tabular-nums">{formatINR(order.grandTotal)}</span>
              </div>
            </div>

            <div className="text-[11px] space-y-1 border-b border-dashed border-[#D1D5DB] pb-2.5 mb-3">
              <div className="font-semibold text-[#64748B] text-[10px] uppercase">Payment Settled</div>
              {order.payments.map((p, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{p.method}</span>
                  <span className="font-medium tabular-nums">{formatINR(p.amount)}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center py-1">
              <div className="flex items-stretch gap-[1.5px] h-8 px-4" aria-hidden="true">
                {[2, 1, 3, 1, 2, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 1, 2, 2, 1, 3, 1, 2].map((w, i) => (
                  <div
                    key={i}
                    className="bg-[#181210]"
                    style={{ width: `${w * 1.5}px`, opacity: i % 2 === 0 ? 1 : 0.78 }}
                  />
                ))}
              </div>
              <span className="font-mono text-[10px] text-[#64748B] mt-1 tracking-widest">{order.billNumber}</span>
              {footerNote && (
                <p className="text-[10px] text-center text-[#64748B] mt-2 leading-snug">{footerNote}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-2.5 px-4 sm:px-5 py-3.5 border-t border-[#E5E7EB] bg-white">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-[13px] font-medium rounded-md border border-[#E5E7EB] text-[#181210] hover:bg-[#FAF9F5] transition-colors whitespace-nowrap shrink-0"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-md bg-[#FB923C] text-white hover:bg-[#F97316] transition-colors whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
};
