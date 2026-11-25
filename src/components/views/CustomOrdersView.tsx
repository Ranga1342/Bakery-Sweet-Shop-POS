import React, { useMemo, useState } from 'react';
import {
  Plus,
  Calendar,
  CheckCircle2,
  X,
  IndianRupee,
  Cake,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { usePos } from '../../context/PosContext';
import { CustomOrder, CustomOrderStatus, Customer, PaymentMethod } from '../../types/pos';
import { formatDateShort, formatINRCompact, roundCurrency, TODAY_ISO } from '../../utils/formatters';

const STATUS_BADGE: Record<CustomOrderStatus, string> = {
  Booked: 'bg-[#FAF9F5] border border-[#E5E7EB] text-[#181210]',
  'In Baking': 'bg-[#FFEDD5] text-[#C2410C]',
  'Ready for Pickup': 'bg-[#DCFCE7] text-[#15803D]',
  'Handed Over': 'bg-[#E5E7EB] text-[#64748B]',
  Cancelled: 'bg-[#FEE2E2] text-[#B91C1C]',
};

export const CustomOrdersView: React.FC = () => {
  const {
    customOrders,
    createCustomOrder,
    updateCustomOrderStatus,
    collectCustomOrderBalance,
    customers,
    products,
    globalSearch,
    settings,
    activeBranchId,
    activeBranch,
    branches,
    canViewAllBranches,
    hasPermission,
  } = usePos();

  const canCreate = hasPermission('custom_orders', 'create') && activeBranch.status === 'Active';
  const canEdit = hasPermission('custom_orders', 'edit');

  const [branchScope, setBranchScope] = useState<'ACTIVE' | 'ALL'>('ACTIVE');
  const [statusFilter, setStatusFilter] = useState<'All' | CustomOrderStatus>('All');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [balanceMethod, setBalanceMethod] = useState<PaymentMethod>('UPI');

  // Create Form (direct customer entry + smart autocomplete suggestions)
  const [custId, setCustId] = useState<string | undefined>(undefined);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [baseProductId] = useState<string>(products[0]?.id ?? '');
  const [itemTitle, setItemTitle] = useState('Belgian Chocolate Celebration Cake');
  const [weightOrSize, setWeightOrSize] = useState('1.5 kg');
  const [flavourOrDetails, setFlavourOrDetails] = useState('Dark Chocolate Truffle');
  const [isEggless, setIsEggless] = useState(true);
  const [cakeInscription, setCakeInscription] = useState('');
  const [designNotes, setDesignNotes] = useState('');
  const [pickupDate, setPickupDate] = useState(TODAY_ISO);
  const [pickupTime, setPickupTime] = useState('18:00');
  const [totalAmount, setTotalAmount] = useState('1800');
  const [advancePaid, setAdvancePaid] = useState('900');
  const [advanceMethod, setAdvanceMethod] = useState<PaymentMethod>('UPI');

  const branchScopedOrders = useMemo(() => {
    if (branchScope === 'ALL' && canViewAllBranches) return customOrders;
    return customOrders.filter((co) => (co.branchId ?? 'br-1') === activeBranchId);
  }, [customOrders, branchScope, canViewAllBranches, activeBranchId]);

  const filteredOrders = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return branchScopedOrders.filter((co) => {
      if (statusFilter !== 'All' && co.status !== statusFilter) return false;
      if (q) {
        return (
          co.orderNumber.toLowerCase().includes(q) ||
          co.customerName.toLowerCase().includes(q) ||
          co.customerPhone.toLowerCase().includes(q) ||
          co.itemTitle.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [branchScopedOrders, statusFilter, globalSearch]);

  // Matching customer suggestions as cashier types name or phone
  const matchingSuggestions = useMemo(() => {
    const nameQ = custName.trim().toLowerCase();
    const phoneQ = custPhone.replace(/\s+/g, '').toLowerCase();
    if (!nameQ && !phoneQ) return [];
    return customers.filter((c) => {
      const cPhone = c.phone.replace(/\s+/g, '').toLowerCase();
      const matchName = nameQ.length >= 2 && c.name.toLowerCase().includes(nameQ);
      const matchPhone = phoneQ.length >= 3 && cPhone.includes(phoneQ);
      return matchName || matchPhone;
    });
  }, [customers, custName, custPhone]);

  const selectedOrder: CustomOrder | null =
    customOrders.find((c) => c.id === selectedOrderId) ?? null;

  const counts = {
    booked: branchScopedOrders.filter((c) => c.status === 'Booked').length,
    baking: branchScopedOrders.filter((c) => c.status === 'In Baking').length,
    ready: branchScopedOrders.filter((c) => c.status === 'Ready for Pickup').length,
    dueToday: branchScopedOrders.filter(
      (c) =>
        c.pickupDate === TODAY_ISO &&
        c.status !== 'Handed Over' &&
        c.status !== 'Cancelled'
    ).length,
  };

  const handleSelectSuggestion = (customer: Customer) => {
    setCustId(customer.id);
    setCustName(customer.name);
    setCustPhone(customer.phone);
    setShowSuggestions(false);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim()) return;
    const total = Math.max(0, roundCurrency(Number(totalAmount) || 0));
    const adv = Math.min(total, Math.max(0, roundCurrency(Number(advancePaid) || 0)));
    const created = createCustomOrder({
      customerId: custId,
      customerName: custName.trim(),
      customerPhone: custPhone.trim(),
      productId: baseProductId || undefined,
      itemTitle: itemTitle.trim(),
      weightOrSize: weightOrSize.trim(),
      flavourOrDetails: flavourOrDetails.trim(),
      isEggless,
      cakeInscription: cakeInscription.trim() || 'No inscription',
      designNotes: designNotes.trim(),
      pickupDate,
      pickupTime,
      totalAmount: total,
      advancePaid: adv,
      advanceMethod,
      balancePaid: 0,
      status: 'Booked',
    });
    setShowCreateModal(false);
    setSelectedOrderId(created.id);
    setCustId(undefined);
    setCustName('');
    setCustPhone('');
    setCakeInscription('');
    setDesignNotes('');
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-65px)] bg-[#E0E2E7]">
      <div className="flex-1 p-3.5 sm:p-5 space-y-4 sm:space-y-5 min-w-0">
        {/* Top Pipeline Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-3 sm:p-4">
            <div className="text-[12px] text-[#64748B]">Booked</div>
            <div className="text-[18px] sm:text-[20px] font-bold text-[#181210] mt-1 tabular-nums">
              {counts.booked} Orders
            </div>
          </div>
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-3 sm:p-4">
            <div className="text-[12px] text-[#64748B]">In Baking / Packing</div>
            <div className="text-[18px] sm:text-[20px] font-bold text-[#C2410C] mt-1 tabular-nums">
              {counts.baking} Orders
            </div>
          </div>
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-3 sm:p-4">
            <div className="text-[12px] text-[#64748B]">Ready for Pickup</div>
            <div className="text-[18px] sm:text-[20px] font-bold text-[#15803D] mt-1 tabular-nums">
              {counts.ready} Ready
            </div>
          </div>
          <div className="bg-white rounded-lg border border-[#E5E7EB] p-3 sm:p-4">
            <div className="text-[12px] text-[#64748B]">Due Today</div>
            <div className="text-[18px] sm:text-[20px] font-bold text-[#FB923C] mt-1 tabular-nums">
              {counts.dueToday} Pickups
            </div>
          </div>
        </div>

        {/* Orders List Card */}
        <div className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
          <div className="px-3.5 sm:px-5 py-3.5 sm:py-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                ['All', 'Booked', 'In Baking', 'Ready for Pickup', 'Handed Over', 'Cancelled'] as const
              ).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-[#181210] text-white'
                      : 'bg-[#FAF9F5] border border-[#E5E7EB] text-[#181210] hover:bg-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {canViewAllBranches && (
                <select
                  value={branchScope}
                  onChange={(e) => setBranchScope(e.target.value as 'ACTIVE' | 'ALL')}
                  aria-label="Filter custom orders by branch"
                  className="px-3 py-2 rounded-md border border-[#E5E7EB] bg-white text-[12px] font-semibold text-[#181210]"
                >
                  <option value="ACTIVE">{activeBranch.name}</option>
                  <option value="ALL">All Branches</option>
                </select>
              )}

              {canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setCustId(undefined);
                    setCustName('');
                    setCustPhone('');
                    setShowSuggestions(false);
                    setShowCreateModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[12px] font-semibold whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  New Custom Order
                </button>
              )}
            </div>
          </div>

          {/* Mobile Orders Cards */}
          <div className="md:hidden divide-y divide-[#E5E7EB]">
            {filteredOrders.length === 0 ? (
              <div className="py-10 px-4 text-center text-[13px] text-[#64748B]">
                No custom orders found for this filter.
              </div>
            ) : (
              filteredOrders.map((co) => {
                const remaining = Math.max(
                  0,
                  roundCurrency(co.totalAmount - co.advancePaid - co.balancePaid)
                );
                const isSelected = co.id === selectedOrderId;
                return (
                  <div
                    key={co.id}
                    onClick={() => setSelectedOrderId(co.id)}
                    className={`p-3.5 space-y-2.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#FB923C]/8' : 'hover:bg-[#FAF9F5]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-semibold text-[12.5px] text-[#181210]">
                            {co.orderNumber}
                          </span>
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10.5px] font-semibold whitespace-nowrap ${STATUS_BADGE[co.status]}`}
                          >
                            {co.status}
                          </span>
                        </div>
                        <div className="text-[11.5px] text-[#64748B] tabular-nums mt-0.5">
                          Pickup: {formatDateShort(co.pickupDate)} · {co.pickupTime}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrderId(co.id);
                        }}
                        className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-[#FB923C] shrink-0"
                      >
                        Manage
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-[12.5px]">
                      <div className="font-semibold text-[#181210]">{co.itemTitle}</div>
                      <div className="text-[11.5px] text-[#64748B]">
                        {co.weightOrSize} · {co.isEggless ? 'Eggless' : 'Regular'} · &ldquo;{co.cakeInscription}&rdquo;
                      </div>
                      <div className="text-[11.5px] text-[#181210] mt-1">
                        {co.customerName}{' '}
                        <span className="text-[#64748B] tabular-nums">({co.customerPhone})</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#E5E7EB]/70 text-[11.5px] tabular-nums">
                      <div>
                        <div className="text-[#64748B]">Total</div>
                        <div className="font-semibold text-[#181210]">
                          {formatINRCompact(co.totalAmount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#64748B]">Paid</div>
                        <div className="font-medium text-[#15803D]">
                          {formatINRCompact(co.advancePaid + co.balancePaid)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[#64748B]">Balance Due</div>
                        <div className="font-bold text-[#C2410C]">
                          {formatINRCompact(remaining)}
                        </div>
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
                  <th className="py-2.5 px-4">Order # &amp; Pickup</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Cake / Hamper Details</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-right">Paid</th>
                  <th className="py-2.5 px-3 text-right">Balance Due</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]/70 text-[13px]">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-[#64748B]">
                      No custom orders found for this filter.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((co) => {
                    const remaining = Math.max(
                      0,
                      roundCurrency(co.totalAmount - co.advancePaid - co.balancePaid)
                    );
                    const isSelected = co.id === selectedOrderId;
                    return (
                      <tr
                        key={co.id}
                        onClick={() => setSelectedOrderId(co.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#FB923C]/8' : 'hover:bg-[#FAF9F5]'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-mono font-semibold text-[#181210]">{co.orderNumber}</div>
                          <div className="text-[11px] text-[#64748B] tabular-nums">
                            {formatDateShort(co.pickupDate)} · {co.pickupTime}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-[#181210]">{co.customerName}</div>
                          <div className="text-[11px] text-[#64748B] tabular-nums">{co.customerPhone}</div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-[#181210]">{co.itemTitle}</div>
                          <div className="text-[11px] text-[#64748B]">
                            {co.weightOrSize} · {co.isEggless ? 'Eggless' : 'Regular'} · &ldquo;{co.cakeInscription}&rdquo;
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-semibold tabular-nums">
                          {formatINRCompact(co.totalAmount)}
                        </td>
                        <td className="py-3 px-3 text-right text-[#15803D] font-medium tabular-nums">
                          {formatINRCompact(co.advancePaid + co.balancePaid)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold tabular-nums text-[#C2410C]">
                          {formatINRCompact(remaining)}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${STATUS_BADGE[co.status]}`}
                          >
                            {co.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrderId(co.id);
                            }}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#FB923C] hover:text-[#F97316]"
                          >
                            Manage
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right-Side Order Detail Panel (Slide-over on mobile/tablet, side panel on lg+) */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-40 bg-black/45 flex justify-end lg:static lg:inset-auto lg:bg-transparent lg:z-auto shrink-0"
          onClick={() => setSelectedOrderId(null)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md lg:max-w-none lg:w-[370px] bg-white border-l border-[#E5E7EB] p-4 sm:p-5 flex flex-col justify-between gap-4 shrink-0 h-full lg:h-auto overflow-y-auto"
          >
            <div className="space-y-4 overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#E5E7EB] pb-3">
              <div>
                <div className="text-[11px] font-mono text-[#64748B]">{selectedOrder.orderNumber}</div>
                <h3 className="text-[16px] font-bold text-[#181210] mt-0.5">
                  {selectedOrder.itemTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderId(null)}
                className="p-1 text-[#64748B] hover:text-[#181210]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] space-y-1.5 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Branch</span>
                <span className="font-semibold text-[#181210]">
                  {branches.find((b) => b.id === (selectedOrder.branchId ?? 'br-1'))?.name ??
                    selectedOrder.branchName ??
                    activeBranch.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Customer</span>
                <span className="font-semibold text-[#181210]">{selectedOrder.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Phone</span>
                <span className="tabular-nums">{selectedOrder.customerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Pickup
                </span>
                <span className="font-semibold text-[#181210] tabular-nums">
                  {formatDateShort(selectedOrder.pickupDate)} at {selectedOrder.pickupTime}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-[12px]">
              <div className="font-semibold text-[#181210] flex items-center gap-1.5">
                <Cake className="w-4 h-4 text-[#FB923C]" />
                Baking &amp; Customization Specifications
              </div>
              <div className="p-3 rounded-lg border border-[#E5E7EB] space-y-1.5">
                <div>
                  <span className="text-[#64748B]">Weight / Qty:</span>{' '}
                  <span className="font-semibold">{selectedOrder.weightOrSize}</span> ·{' '}
                  <span className="font-semibold">
                    {selectedOrder.isEggless ? '100% Eggless' : 'Regular'}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B]">Flavour:</span>{' '}
                  <span className="font-medium">{selectedOrder.flavourOrDetails}</span>
                </div>
                <div>
                  <span className="text-[#64748B]">Inscription:</span>{' '}
                  <span className="font-semibold text-[#C2410C]">
                    &ldquo;{selectedOrder.cakeInscription}&rdquo;
                  </span>
                </div>
                {selectedOrder.designNotes && (
                  <div>
                    <span className="text-[#64748B]">Design Notes:</span>{' '}
                    <span>{selectedOrder.designNotes}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-[#E5E7EB] bg-[#FAF9F5] space-y-1.5 text-[12px]">
              <div className="font-semibold text-[#181210] mb-1">Payment Summary</div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Order Total</span>
                <span className="font-semibold tabular-nums">
                  {formatINRCompact(selectedOrder.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between text-[#15803D]">
                <span>Advance Paid ({selectedOrder.advanceMethod})</span>
                <span className="font-semibold tabular-nums">
                  -{formatINRCompact(selectedOrder.advancePaid)}
                </span>
              </div>
              {selectedOrder.balancePaid > 0 && (
                <div className="flex justify-between text-[#15803D]">
                  <span>Balance Settled</span>
                  <span className="font-semibold tabular-nums">
                    -{formatINRCompact(selectedOrder.balancePaid)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-[#E5E7EB] text-[14px] font-bold">
                <span>Remaining Due</span>
                <span className="text-[#FB923C] tabular-nums">
                  {formatINRCompact(
                    Math.max(
                      0,
                      roundCurrency(
                        selectedOrder.totalAmount -
                          selectedOrder.advancePaid -
                          selectedOrder.balancePaid
                      )
                    )
                  )}
                </span>
              </div>
            </div>

            {canEdit &&
              selectedOrder.status !== 'Handed Over' &&
              selectedOrder.status !== 'Cancelled' && (
                <div className="space-y-2">
                  <div className="text-[12px] font-semibold text-[#181210]">Update Stage</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['Booked', 'In Baking', 'Ready for Pickup'] as CustomOrderStatus[]).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => updateCustomOrderStatus(selectedOrder.id, st)}
                          className={`py-1.5 px-2 rounded text-[11px] font-semibold border ${
                            selectedOrder.status === st
                              ? 'bg-[#181210] text-white border-[#181210]'
                              : 'bg-white text-[#181210] border-[#E5E7EB] hover:bg-[#FAF9F5]'
                          }`}
                        >
                          {st}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
          </div>

          {canEdit &&
            selectedOrder.status !== 'Handed Over' &&
            selectedOrder.status !== 'Cancelled' && (
              <div className="pt-3 border-t border-[#E5E7EB] space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[#181210]">Balance Method</span>
                  <div className="flex gap-1">
                    {settings.acceptedPaymentMethods.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setBalanceMethod(m)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold border ${
                          balanceMethod === m
                            ? 'bg-[#181210] text-white border-[#181210]'
                            : 'bg-[#FAF9F5] text-[#181210] border-[#E5E7EB]'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => collectCustomOrderBalance(selectedOrder.id, balanceMethod)}
                  className="w-full py-2.5 px-4 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[13px] font-semibold inline-flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Collect Balance &amp; Hand Over
                </button>

                <button
                  type="button"
                  onClick={() => updateCustomOrderStatus(selectedOrder.id, 'Cancelled')}
                  className="w-full py-2 px-3 rounded-md border border-[#FEE2E2] text-[#B91C1C] hover:bg-[#FEE2E2]/50 text-[12px] font-semibold"
                >
                  Cancel Custom Order
                </button>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* New Custom Order Modal — Direct Customer Entry + Smart Match Suggestions (Requirement D) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-4 sm:px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between gap-2">
              <h3 className="text-[14px] sm:text-[15px] font-semibold text-[#181210] truncate">
                New Custom Cake or Sweet Hamper Order
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-[#64748B] shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-[13px]">
              {/* Direct Customer Entry with Live Matching Suggestions */}
              <div className="relative p-3.5 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold text-[#181210]">
                    Customer Details (Type Name or Phone)
                  </span>
                  {custId && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#15803D]">
                      <UserCheck className="w-3.5 h-3.5" />
                      Existing Customer Linked
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#181210] mb-1">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={custName}
                      onChange={(e) => {
                        setCustName(e.target.value);
                        setCustId(undefined);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder="Enter customer name"
                      className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#181210] mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={custPhone}
                      onChange={(e) => {
                        setCustPhone(e.target.value);
                        setCustId(undefined);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      placeholder="+91 98..."
                      className="w-full px-3 py-2 bg-white border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                    />
                  </div>
                </div>

                {/* Live Matching Customer Suggestions Dropdown */}
                {showSuggestions && matchingSuggestions.length > 0 && (
                  <div className="border border-[#FB923C]/50 bg-white rounded-md shadow-md overflow-hidden">
                    <div className="px-3 py-1.5 bg-[#FFEDD5]/60 text-[11px] font-semibold text-[#C2410C] flex items-center justify-between">
                      <span>Matching Existing Customers (Click to Auto-Fill)</span>
                      <button
                        type="button"
                        onClick={() => setShowSuggestions(false)}
                        className="text-[#64748B] hover:text-[#181210]"
                      >
                        Dismiss
                      </button>
                    </div>
                    <div className="max-h-32 overflow-y-auto divide-y divide-[#E5E7EB]/60">
                      {matchingSuggestions.map((match) => (
                        <button
                          key={match.id}
                          type="button"
                          onClick={() => handleSelectSuggestion(match)}
                          className="w-full px-3 py-2 text-left text-[12px] hover:bg-[#FAF9F5] flex items-center justify-between"
                        >
                          <span className="font-semibold text-[#181210]">{match.name}</span>
                          <span className="text-[#64748B] tabular-nums">{match.phone}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!custId && (custName.trim() || custPhone.trim()) && matchingSuggestions.length === 0 && (
                  <div className="text-[11px] text-[#64748B]">
                    No existing match — a new customer record will be created automatically on save.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#181210] mb-1">
                    Order Item / Cake Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#181210] mb-1">
                    Weight / Box Count *
                  </label>
                  <input
                    type="text"
                    required
                    value={weightOrSize}
                    onChange={(e) => setWeightOrSize(e.target.value)}
                    placeholder="e.g. 2 kg or 10 Boxes"
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#181210] mb-1">
                    Flavour / Contents
                  </label>
                  <input
                    type="text"
                    value={flavourOrDetails}
                    onChange={(e) => setFlavourOrDetails(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#181210] mb-1">
                    Message / Cake Inscription
                  </label>
                  <input
                    type="text"
                    value={cakeInscription}
                    onChange={(e) => setCakeInscription(e.target.value)}
                    placeholder="Happy Birthday..."
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#181210] mb-1">
                  Design / Theme / Packing Instructions
                </label>
                <input
                  type="text"
                  value={designNotes}
                  onChange={(e) => setDesignNotes(e.target.value)}
                  placeholder="e.g. Pastel pink rosettes, gold topper"
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#181210] mb-1">
                    Pickup Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#181210] mb-1">
                    Pickup Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={pickupTime}
                    onChange={(e) => setPickupTime(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#181210]">
                    <input
                      type="checkbox"
                      checked={isEggless}
                      onChange={(e) => setIsEggless(e.target.checked)}
                      className="accent-[#FB923C]"
                    />
                    100% Eggless
                  </label>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#181210] mb-1">
                    Total Amount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#181210] mb-1">
                    Advance Paid (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={advancePaid}
                    onChange={(e) => setAdvancePaid(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#181210] mb-1">
                    Advance Via
                  </label>
                  <select
                    value={advanceMethod}
                    onChange={(e) => setAdvanceMethod(e.target.value as PaymentMethod)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded"
                  >
                    {settings.acceptedPaymentMethods.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#E5E7EB]">
                <span className="text-[12px] text-[#64748B] inline-flex items-center gap-1">
                  <IndianRupee className="w-3.5 h-3.5 shrink-0" />
                  Remaining on Pickup:{' '}
                  <strong className="text-[#181210] tabular-nums">
                    {formatINRCompact(
                      Math.max(0, roundCurrency((Number(totalAmount) || 0) - (Number(advancePaid) || 0)))
                    )}
                  </strong>
                </span>
                <div className="flex flex-col-reverse sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3.5 py-2 text-[12px] font-medium border border-[#E5E7EB] rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-[12px] font-semibold bg-[#FB923C] hover:bg-[#F97316] text-white rounded-md"
                  >
                    Save Custom Order
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
