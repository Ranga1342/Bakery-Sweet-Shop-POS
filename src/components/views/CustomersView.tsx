import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Phone,
  ShoppingBag,
  X,
  Pencil,
  StickyNote,
  Clock,
  CheckCircle2,
  Download,
} from 'lucide-react';
import { usePos } from '../../context/PosContext';
import { CompletedOrder, CustomOrder, Customer } from '../../types/pos';
import {
  exportToCsv,
  formatDateShort,
  formatDateTime,
  formatINRCompact,
} from '../../utils/formatters';

type HistoryEntry =
  | { kind: 'pos'; sortDate: string; order: CompletedOrder }
  | { kind: 'custom'; sortDate: string; custom: CustomOrder };

function getCustomerInitials(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const CustomerAvatar: React.FC<{ name: string; avatarUrl?: string }> = ({
  name,
  avatarUrl,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  if (avatarUrl && !imgFailed) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImgFailed(true)}
        className="w-9 h-9 rounded-full object-cover border border-[#E5E7EB] shrink-0 bg-[#FAF9F5]"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="w-9 h-9 rounded-full bg-[#FFF7ED] border border-[#FED7AA] text-[#C2410C] text-[12px] font-bold flex items-center justify-center shrink-0 select-none tracking-tight"
    >
      {getCustomerInitials(name)}
    </div>
  );
};

export const CustomersView: React.FC = () => {
  const {
    customers,
    addCustomer,
    updateCustomer,
    orders,
    customOrders,
    globalSearch,
    selectCartCustomer,
    setActiveNav,
    setActiveReceipt,
    hasPermission,
  } = usePos();

  const canCreate = hasPermission('customers', 'create');
  const canEdit = hasPermission('customers', 'edit');
  const canBill = hasPermission('pos', 'create');

  const [selectedId, setSelectedId] = useState<string | null>(customers[0]?.id ?? null);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  const enriched = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return customers
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q)
        );
      })
      .map((c) => {
        const custOrders = orders.filter(
          (o) =>
            o.status === 'Completed' &&
            (o.customerId === c.id || (o.customerPhone && o.customerPhone === c.phone))
        );
        const custCustom = customOrders.filter(
          (co) => co.customerId === c.id || co.customerPhone === c.phone
        );
        const totalSpent = custOrders.reduce((s, o) => s + o.grandTotal, 0);
        const outstandingBalance = custCustom
          .filter((co) => co.status !== 'Cancelled' && co.status !== 'Handed Over')
          .reduce(
            (s, co) => s + Math.max(0, co.totalAmount - co.advancePaid - co.balancePaid),
            0
          );

        const pendingCustomOrders = custCustom
          .filter((co) => co.status !== 'Handed Over' && co.status !== 'Cancelled')
          .sort((a, b) => a.pickupDate.localeCompare(b.pickupDate));

        const historyEntries: HistoryEntry[] = [
          ...custOrders.map((order) => ({
            kind: 'pos' as const,
            sortDate: order.createdAt,
            order,
          })),
          ...custCustom
            .filter((co) => co.status === 'Handed Over' || co.status === 'Cancelled')
            .map((custom) => ({
              kind: 'custom' as const,
              sortDate: custom.createdAt,
              custom,
            })),
        ].sort((a, b) => b.sortDate.localeCompare(a.sortDate));

        return {
          customer: c,
          orderCount: custOrders.length,
          customCount: custCustom.length,
          totalOrdersCount: custOrders.length + custCustom.length,
          totalSpent,
          outstandingBalance,
          pendingCustomOrders,
          historyEntries,
        };
      });
  }, [customers, orders, customOrders, globalSearch]);

  const activeDetail = enriched.find((e) => e.customer.id === selectedId) ?? null;

  const openAdd = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setNotes('');
    setShowModal(true);
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setPhone(c.phone);
    setNotes(c.notes ?? '');
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    if (editingCustomer) {
      updateCustomer({
        ...editingCustomer,
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim() || undefined,
      });
    } else {
      const created = addCustomer({
        name: name.trim(),
        phone: phone.trim(),
        notes: notes.trim() || undefined,
      });
      setSelectedId(created.id);
    }
    setShowModal(false);
  };

  const handleExport = () => {
    exportToCsv(
      'bakecore_customers_directory.csv',
      ['Customer Name', 'Phone Number', 'Orders', 'Order Spend', 'Order Balance Due', 'Notes'],
      enriched.map((row) => [
        row.customer.name,
        row.customer.phone,
        row.totalOrdersCount,
        row.totalSpent.toFixed(2),
        row.outstandingBalance.toFixed(2),
        row.customer.notes ?? '',
      ])
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-61px)] bg-[#E0E2E7]">
      <div className="flex-1 p-5 space-y-5 min-w-0">
        <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#181210]">Customer Directory</h2>
              <p className="text-[12px] text-[#64748B]">
                Track repeat bakery &amp; mithai buyers by name and phone, custom cake bookings &amp; dues
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border border-[#E5E7EB] rounded-md text-[#181210] hover:bg-[#FAF9F5] whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
              {canCreate && (
                <button
                  type="button"
                  onClick={openAdd}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[12px] font-semibold whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Add Customer
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                  <th className="py-2.5 px-4">Customer Name</th>
                  <th className="py-2.5 px-3">Phone Number</th>
                  <th className="py-2.5 px-3 text-right">Orders</th>
                  <th className="py-2.5 px-3 text-right">Total Spent</th>
                  <th className="py-2.5 px-4 text-right">Outstanding Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]/70 text-[13px]">
                {enriched.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-[#64748B]">
                      No customers match the search query.
                    </td>
                  </tr>
                ) : (
                  enriched.map((row) => (
                    <tr
                      key={row.customer.id}
                      onClick={() => setSelectedId(row.customer.id)}
                      className={`cursor-pointer transition-colors ${
                        selectedId === row.customer.id ? 'bg-[#FB923C]/8' : 'hover:bg-[#FAF9F5]'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <CustomerAvatar
                            name={row.customer.name}
                            avatarUrl={row.customer.avatarUrl}
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-[#181210] truncate">
                              {row.customer.name}
                            </div>
                            {row.customer.notes && (
                              <div className="text-[11px] text-[#64748B] truncate max-w-[220px]">
                                {row.customer.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 tabular-nums text-[#181210]">{row.customer.phone}</td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        <div className="font-semibold text-[#181210]">{row.totalOrdersCount}</div>
                        {row.totalOrdersCount > 0 && (
                          <div className="text-[11px] text-[#64748B]">
                            {row.orderCount} bill{row.orderCount === 1 ? '' : 's'} · {row.customCount} custom
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold tabular-nums">
                        {formatINRCompact(row.totalSpent)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">
                        <span className={row.outstandingBalance > 0 ? 'text-[#C2410C]' : 'text-[#64748B]'}>
                          {formatINRCompact(row.outstandingBalance)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Customer Profile & History Panel */}
      {activeDetail && (
        <aside className="w-full lg:w-[390px] bg-white border-l border-[#E5E7EB] p-5 flex flex-col justify-between gap-4 shrink-0">
          <div className="space-y-4 overflow-y-auto pr-0.5">
            {/* Customer Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <CustomerAvatar
                  name={activeDetail.customer.name}
                  avatarUrl={activeDetail.customer.avatarUrl}
                />
                <div className="min-w-0">
                  <h3 className="text-[16px] font-bold text-[#181210] truncate">
                    {activeDetail.customer.name}
                  </h3>
                  <div className="text-[12px] text-[#64748B] mt-0.5 flex items-center gap-1.5 tabular-nums">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>{activeDetail.customer.phone}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openEdit(activeDetail.customer)}
                    className="p-1.5 rounded text-[#64748B] hover:text-[#181210] hover:bg-[#FAF9F5]"
                    title="Edit customer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="p-1.5 text-[#64748B] hover:text-[#181210]"
                  aria-label="Close customer details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Highlighted Customer Notes Card */}
            {activeDetail.customer.notes && (
              <div className="p-3 rounded-lg bg-[#FFF7ED] border border-[#FDBA74]/80 border-l-4 border-l-[#FB923C]">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#C2410C]">
                  <StickyNote className="w-3.5 h-3.5 text-[#FB923C]" />
                  Notes &amp; Preferences
                </div>
                <p className="text-[12px] font-medium text-[#181210] mt-1 leading-relaxed">
                  {activeDetail.customer.notes}
                </p>
              </div>
            )}

            {/* Spend & Balance KPIs */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB]">
                <div className="text-[11px] text-[#64748B]">Order Spend</div>
                <div className="text-[15px] font-bold text-[#181210] tabular-nums mt-0.5">
                  {formatINRCompact(activeDetail.totalSpent)}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB]">
                <div className="text-[11px] text-[#64748B]">Order Balance Due</div>
                <div className="text-[15px] font-bold text-[#C2410C] tabular-nums mt-0.5">
                  {formatINRCompact(activeDetail.outstandingBalance)}
                </div>
              </div>
            </div>

            {/* Combined Orders & Pending List Container */}
            <div className="rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] font-semibold text-[#181210] flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#FB923C]" />
                  Orders ({activeDetail.totalOrdersCount})
                </div>
                {activeDetail.pendingCustomOrders.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-[#FFEDD5] text-[#C2410C] text-[10px] font-semibold tabular-nums">
                    {activeDetail.pendingCustomOrders.length} Pending
                  </span>
                )}
              </div>

              {activeDetail.totalOrdersCount === 0 ? (
                <div className="text-[12px] text-[#64748B] py-3 text-center">
                  No orders or bookings yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Pending Orders Section (Top) */}
                  {activeDetail.pendingCustomOrders.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#C2410C]">
                        <Clock className="w-3 h-3" />
                        Pending Orders
                      </div>
                      <div className="space-y-1.5">
                        {activeDetail.pendingCustomOrders.map((co) => {
                          const due = Math.max(0, co.totalAmount - co.advancePaid - co.balancePaid);
                          return (
                            <div
                              key={co.id}
                              className="p-2.5 rounded-md border border-[#FDBA74] bg-white text-[12px] space-y-1"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-semibold text-[#181210] truncate">
                                    {co.itemTitle}
                                  </div>
                                  <div className="text-[11px] font-mono text-[#64748B]">
                                    {co.orderNumber}
                                  </div>
                                </div>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                                    co.status === 'Ready for Pickup'
                                      ? 'bg-[#DCFCE7] text-[#15803D]'
                                      : 'bg-[#FFEDD5] text-[#C2410C]'
                                  }`}
                                >
                                  {co.status}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#E5E7EB]/60">
                                <span className="text-[#64748B]">
                                  Pickup {formatDateShort(co.pickupDate)} · {co.pickupTime}
                                </span>
                                <span
                                  className={
                                    due > 0
                                      ? 'font-bold text-[#C2410C] tabular-nums'
                                      : 'font-semibold text-[#15803D] tabular-nums'
                                  }
                                >
                                  {due > 0
                                    ? `Due ${formatINRCompact(due)}`
                                    : formatINRCompact(co.totalAmount)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Remaining Order History Section (Below Pending) */}
                  {activeDetail.historyEntries.length > 0 && (
                    <div
                      className={`space-y-2 ${
                        activeDetail.pendingCustomOrders.length > 0
                          ? 'pt-2.5 border-t border-[#E5E7EB]'
                          : ''
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                        <CheckCircle2 className="w-3 h-3 text-[#15803D]" />
                        Order History
                      </div>
                      <div className="space-y-1.5">
                        {activeDetail.historyEntries.map((entry) => {
                          if (entry.kind === 'pos') {
                            const ord = entry.order;
                            return (
                              <button
                                key={ord.id}
                                type="button"
                                onClick={() => setActiveReceipt(ord)}
                                className="w-full p-2.5 rounded-md border border-[#E5E7EB] hover:border-[#FB923C] bg-white text-left space-y-1 transition-colors"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono font-semibold text-[12px] text-[#181210]">
                                    {ord.billNumber}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#DCFCE7] text-[#15803D]">
                                    Completed
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                                  <span className="truncate">
                                    {formatDateTime(ord.createdAt)} ·{' '}
                                    {ord.payments.map((p) => p.method).join(' + ')}
                                  </span>
                                  <span className="font-bold text-[12px] text-[#181210] tabular-nums shrink-0">
                                    {formatINRCompact(ord.grandTotal)}
                                  </span>
                                </div>
                              </button>
                            );
                          }

                          const co = entry.custom;
                          return (
                            <div
                              key={co.id}
                              className="p-2.5 rounded-md border border-[#E5E7EB] bg-white space-y-1 text-[12px]"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-[#181210] truncate">
                                  {co.orderNumber} · {co.itemTitle}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                                    co.status === 'Handed Over'
                                      ? 'bg-[#DCFCE7] text-[#15803D]'
                                      : 'bg-[#FEE2E2] text-[#B91C1C]'
                                  }`}
                                >
                                  {co.status}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                                <span>Pickup {formatDateShort(co.pickupDate)}</span>
                                <span className="font-bold text-[12px] text-[#181210] tabular-nums">
                                  {formatINRCompact(co.totalAmount)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {canBill && (
            <button
              type="button"
              onClick={() => {
                selectCartCustomer(activeDetail.customer);
                setActiveNav('pos');
              }}
              className="w-full py-2.5 px-4 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[13px] font-semibold"
            >
              Start POS Bill for {activeDetail.customer.name}
            </button>
          )}
        </aside>
      )}

      {/* Add / Edit Customer Modal — Strictly Name & Phone (no email) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#181210]">
                {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-[#64748B]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-3.5 text-[13px]">
              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                  Phone Number *
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98..."
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                  Preferences / Notes (optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Eggless only, low sugar mithai"
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 text-[12px] font-medium border border-[#E5E7EB] rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-[12px] font-semibold bg-[#FB923C] hover:bg-[#F97316] text-white rounded-md"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
