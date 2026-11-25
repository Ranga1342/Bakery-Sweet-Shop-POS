import React, { useState } from 'react';
import {
  Search,
  Plus,
  LogOut,
  UserCheck,
  ChevronDown,
  X,
  Bell,
  CheckCheck,
  AlertTriangle,
  Info,
  AlertCircle,
  Building2,
  Check,
  Lock,
} from 'lucide-react';
import { usePos } from '../../context/PosContext';
import { AppNotification, NavSection } from '../../types/pos';
import { formatDateTime } from '../../utils/formatters';

const PAGE_META: Record<NavSection, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Daily counter sales, held bills, freshness alerts & cake pickups',
  },
  pos: {
    title: 'POS Billing',
    subtitle: 'Counter sales by piece, weight, box & instant GST receipt',
  },
  menus: {
    title: 'Menus',
    subtitle: 'Organize bakery & sweet categories, variants, weights & counter availability',
  },
  custom_orders: {
    title: 'Custom Orders',
    subtitle: 'Advance cake bookings, inscriptions, pickup schedules & balances',
  },
  stock: {
    title: 'Stock Management',
    subtitle: 'Counter finished-goods batches, prep & expiry dates, movement & wastage',
  },
  inventory: {
    title: 'Inventory Management',
    subtitle: 'Store-room supplies, stock-in receipts, stock-out issues & audit ledger',
  },
  customers: {
    title: 'Customers',
    subtitle: 'Customer directory, phone lookup, purchase history & dues',
  },
  reports: {
    title: 'Reports',
    subtitle: 'Sales, product performance, branch comparison, staff sales & wastage',
  },
  staff: {
    title: 'Staff Management',
    subtitle: 'Employee directory, branch assignments, RBAC permissions & terminal credentials',
  },
  branches: {
    title: 'Branch Management',
    subtitle: 'Multi-branch outlets, managers, staff rosters & operational overrides',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Store profile, GST & packaging rules, thermal receipt preview & workspace reset',
  },
};

export const TopHeader: React.FC = () => {
  const {
    activeNav,
    setActiveNav,
    globalSearch,
    setGlobalSearch,
    currentUser,
    staffUsers,
    switchUser,
    logoutUser,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    activeBranch,
    activeBranchId,
    authorizedBranches,
    setActiveBranchId,
    hasPermission,
    cart,
    cartCustomerName,
    cartCustomerPhone,
    discountValue,
    packagingCharge,
    clearCart,
    holdCurrentOrder,
    pushToast,
  } = usePos();

  const [menuOpen, setMenuOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTab, setNotifTab] = useState<'unread' | 'all'>('all');
  const [showAllNotifModal, setShowAllNotifModal] = useState(false);
  const [showNewBillConfirm, setShowNewBillConfirm] = useState(false);

  const hasDraftInCart =
    cart.length > 0 ||
    cartCustomerName.trim().length > 0 ||
    cartCustomerPhone.trim().length > 0 ||
    discountValue > 0 ||
    packagingCharge > 0;

  const handleNewBillClick = () => {
    if (activeNav !== 'pos') {
      setActiveNav('pos');
      return;
    }
    if (!hasDraftInCart) {
      clearCart();
      pushToast('Ready for a new bill.');
      return;
    }
    setShowNewBillConfirm(true);
  };

  const switchableStaff = staffUsers.filter(
    (s) => s.status === 'Active' && s.hasLoginAccess
  );

  const meta = PAGE_META[activeNav];
  const initials = currentUser?.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const displayedNotifs =
    notifTab === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const handleNotificationClick = (n: AppNotification) => {
    markNotificationRead(n.id);
    setActiveNav(n.targetNav);
    setNotifOpen(false);
    setShowAllNotifModal(false);
  };

  const renderSeverityIcon = (severity: AppNotification['severity']) => {
    if (severity === 'critical') return <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />;
    if (severity === 'warning') return <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0" />;
    return <Info className="w-4 h-4 text-[#FB923C] shrink-0" />;
  };

  return (
    <>
      <header className="bg-white border-b border-[#E5E7EB] px-5 py-3 flex items-center justify-between gap-4 sticky top-0 z-30">
        {/* Left: Page Title & Descriptor */}
        <div className="min-w-0">
          <h1 className="text-[18px] font-semibold text-[#181210] leading-tight truncate">
            {meta.title}
          </h1>
          <p className="text-[12px] text-[#64748B] truncate mt-0.5">{meta.subtitle}</p>
        </div>

        {/* Center-Left: Search Input */}
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search products, SKU, bills, or customer phone..."
              className="w-full pl-9 pr-8 py-1.5 text-[13px] bg-[#FAF9F5] border border-[#E5E7EB] rounded-md text-[#181210] placeholder:text-[#64748B] focus:outline-none focus:border-[#FB923C] focus:bg-white transition-colors"
            />
            {globalSearch && (
              <button
                type="button"
                onClick={() => setGlobalSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#181210]"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Primary Action + Branch Switcher + Notifications + Profile */}
        <div className="flex items-center gap-2.5 shrink-0">
          {hasPermission('pos', 'create') && (
            <button
              type="button"
              onClick={handleNewBillClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[13px] font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              New Bill
            </button>
          )}

          {/* Active Branch Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (authorizedBranches.length > 1) {
                  setBranchOpen((o) => !o);
                  setMenuOpen(false);
                  setNotifOpen(false);
                }
              }}
              title={
                authorizedBranches.length > 1
                  ? 'Switch active branch terminal'
                  : `Assigned branch: ${activeBranch.name}`
              }
              className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-[12px] font-medium transition-colors whitespace-nowrap ${
                activeBranch.status === 'Inactive'
                  ? 'border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]'
                  : 'border-[#E5E7EB] bg-[#FAF9F5] hover:bg-white text-[#181210]'
              } ${authorizedBranches.length <= 1 ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <Building2 className="w-3.5 h-3.5 text-[#FB923C] shrink-0" />
              <span className="max-w-[140px] truncate font-semibold">{activeBranch.name}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums ${
                  activeBranch.status === 'Active'
                    ? 'bg-[#DCFCE7] text-[#15803D]'
                    : 'bg-[#FEE2E2] text-[#B91C1C]'
                }`}
              >
                {activeBranch.status === 'Active' ? activeBranch.branchCode : 'Inactive'}
              </span>
              {authorizedBranches.length > 1 ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
              ) : (
                <Lock className="w-3 h-3 text-[#94A3B8]" />
              )}
            </button>

            {branchOpen && authorizedBranches.length > 1 && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setBranchOpen(false)} />
                <div className="absolute right-0 mt-1.5 w-72 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-50 py-1.5 overflow-hidden">
                  <div className="px-3 py-2 border-b border-[#E5E7EB] bg-[#FAF9F5]">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                      Active Branch Terminal
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-[#E5E7EB]/60">
                    {authorizedBranches.map((br) => {
                      const isCurrent = br.id === activeBranchId;
                      return (
                        <button
                          key={br.id}
                          type="button"
                          onClick={() => {
                            setActiveBranchId(br.id);
                            setBranchOpen(false);
                          }}
                          className={`w-full px-3 py-2.5 text-left flex items-start justify-between gap-2 hover:bg-[#FAF9F5] transition-colors ${
                            isCurrent ? 'bg-[#FB923C]/5' : ''
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[13px] truncate ${
                                  isCurrent
                                    ? 'font-semibold text-[#FB923C]'
                                    : 'font-medium text-[#181210]'
                                }`}
                              >
                                {br.name}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                                  br.status === 'Active'
                                    ? 'bg-[#DCFCE7] text-[#15803D]'
                                    : 'bg-[#F3F4F6] text-[#4B5563]'
                                }`}
                              >
                                {br.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-[#64748B] truncate mt-0.5">
                              {br.branchCode} · {br.address}
                            </div>
                          </div>
                          {isCurrent && <Check className="w-4 h-4 text-[#FB923C] shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Notification Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifOpen((o) => !o);
                setMenuOpen(false);
                setBranchOpen(false);
              }}
              className="relative p-2 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[#181210] transition-colors"
              aria-label="Open notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FB923C] text-white text-[10px] font-bold flex items-center justify-center tabular-nums border-2 border-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 mt-1.5 w-[360px] bg-white border border-[#E5E7EB] rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-bold text-[#181210]">
                        Operational Notifications
                      </div>
                      <div className="text-[11px] text-[#64748B] tabular-nums">
                        {unreadCount} unread alert(s)
                      </div>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FB923C] hover:text-[#F97316]"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Filter Switch */}
                  <div className="px-3 py-2 border-b border-[#E5E7EB] flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNotifTab('all')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                        notifTab === 'all'
                          ? 'bg-[#181210] text-white'
                          : 'text-[#64748B] hover:bg-[#FAF9F5]'
                      }`}
                    >
                      All ({notifications.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifTab('unread')}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                        notifTab === 'unread'
                          ? 'bg-[#181210] text-white'
                          : 'text-[#64748B] hover:bg-[#FAF9F5]'
                      }`}
                    >
                      Unread ({unreadCount})
                    </button>
                  </div>

                  {/* List */}
                  <div className="max-h-[320px] overflow-y-auto divide-y divide-[#E5E7EB]/70">
                    {displayedNotifs.length === 0 ? (
                      <div className="py-8 text-center text-[12px] text-[#64748B]">
                        {notifTab === 'unread'
                          ? 'All caught up — no unread notifications.'
                          : 'No operational notifications yet.'}
                      </div>
                    ) : (
                      displayedNotifs.slice(0, 7).map((n) => (
                        <div
                          key={n.id}
                          className={`px-4 py-2.5 flex items-start gap-2.5 transition-colors ${
                            n.read ? 'bg-white opacity-75' : 'bg-[#FB923C]/5'
                          }`}
                        >
                          <div className="mt-0.5">{renderSeverityIcon(n.severity)}</div>
                          <button
                            type="button"
                            onClick={() => handleNotificationClick(n)}
                            className="flex-1 text-left min-w-0"
                          >
                            <div className="text-[12px] font-semibold text-[#181210] leading-snug">
                              {n.title}
                            </div>
                            <div className="text-[11px] text-[#64748B] mt-0.5 line-clamp-2">
                              {n.message}
                            </div>
                            <div className="text-[10px] text-[#64748B] mt-1 tabular-nums">
                              {formatDateTime(n.createdAt)}
                            </div>
                          </button>
                          {!n.read && (
                            <button
                              type="button"
                              onClick={() => markNotificationRead(n.id)}
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-[#FB923C] hover:bg-[#FB923C]/10 shrink-0"
                              title="Mark as read"
                            >
                              Read
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="px-4 py-2.5 border-t border-[#E5E7EB] bg-[#FAF9F5] flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        setShowAllNotifModal(true);
                      }}
                      className="text-[12px] font-semibold text-[#FB923C] hover:text-[#F97316]"
                    >
                      View All Notifications ({notifications.length})
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Profile Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMenuOpen((o) => !o);
                setNotifOpen(false);
                setBranchOpen(false);
              }}
              className="flex items-center gap-2.5 pl-2 pr-2.5 py-1.5 rounded-md border border-[#E5E7EB] hover:bg-[#FAF9F5] transition-colors"
            >
              <div className="text-right hidden sm:block">
                <div className="text-[12px] font-semibold text-[#181210] leading-tight whitespace-nowrap">
                  {currentUser?.name}
                </div>
                <div className="text-[11px] text-[#64748B] leading-tight whitespace-nowrap">
                  {currentUser?.role} · {currentUser?.employeeCode}
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#181210] text-white text-[12px] font-semibold flex items-center justify-center shrink-0">
                {initials || 'BC'}
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1.5 w-64 bg-white border border-[#E5E7EB] rounded-lg shadow-lg z-50 py-1.5">
                  <div className="px-3 py-2 border-b border-[#E5E7EB]">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                      Switch Active Operator
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {switchableStaff.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          switchUser(s.id);
                          setMenuOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left flex items-center justify-between text-[13px] hover:bg-[#FAF9F5] ${
                          currentUser?.id === s.id ? 'text-[#FB923C] font-semibold' : 'text-[#181210]'
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{s.name}</span>
                          <span className="block text-[11px] text-[#64748B] font-normal truncate">
                            {s.role} · {s.employeeCode}
                          </span>
                        </span>
                        {currentUser?.id === s.id && <UserCheck className="w-4 h-4 shrink-0" />}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-[#E5E7EB] mt-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        logoutUser();
                      }}
                      className="w-full px-3 py-2 text-left flex items-center gap-2 text-[13px] text-[#B91C1C] hover:bg-[#FEE2E2]/50 font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      Lock Terminal / Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Full Notifications Modal */}
      {showAllNotifModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[#181210]">
                  All Operational Notifications
                </h3>
                <p className="text-[11px] text-[#64748B] tabular-nums">
                  {unreadCount} unread · {notifications.length} total alerts
                </p>
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#FB923C] hover:text-[#F97316]"
                  >
                    <CheckCheck className="w-4 h-4" />
                    Mark All Read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAllNotifModal(false)}
                  className="p-1 text-[#64748B] hover:text-[#181210]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto divide-y divide-[#E5E7EB]/70">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-[13px] text-[#64748B]">
                  No system notifications recorded.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-5 py-3 flex items-start justify-between gap-3 ${
                      n.read ? 'bg-white' : 'bg-[#FB923C]/5'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5">{renderSeverityIcon(n.severity)}</div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-[#181210]">{n.title}</span>
                          {!n.read && (
                            <span className="px-1.5 py-0.5 rounded bg-[#FB923C] text-white text-[10px] font-semibold">
                              New
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-[#64748B] mt-0.5">{n.message}</p>
                        <div className="text-[11px] text-[#64748B] mt-1 tabular-nums">
                          {formatDateTime(n.createdAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!n.read && (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(n.id)}
                          className="px-2.5 py-1 rounded border border-[#E5E7EB] text-[11px] font-semibold text-[#181210] hover:bg-[#FAF9F5]"
                        >
                          Mark Read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(n)}
                        className="px-2.5 py-1 rounded bg-[#FB923C] text-white text-[11px] font-semibold hover:bg-[#F97316]"
                      >
                        Open Module
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Safe New Bill Confirmation Modal (only shown when active bill has unsaved items/details) */}
      {showNewBillConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Start New Bill Confirmation"
        >
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-[#181210]">
                Start a New Bill?
              </h3>
              <button
                type="button"
                onClick={() => setShowNewBillConfirm(false)}
                className="p-1 text-[#64748B] hover:text-[#181210]"
                aria-label="Close confirmation"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-[13px] text-[#475569] leading-relaxed">
                Your current active bill has{' '}
                <span className="font-semibold text-[#181210] tabular-nums">
                  {cart.length} item{cart.length === 1 ? '' : 's'}
                </span>
                . Place it on hold so you can resume it later, or discard it to begin a fresh bill.
              </p>
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewBillConfirm(false)}
                  className="px-3.5 py-2 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[12px] font-semibold text-[#181210]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearCart();
                    setShowNewBillConfirm(false);
                    pushToast('Started a fresh bill.');
                  }}
                  className="px-3.5 py-2 rounded-md border border-[#FECACA] bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[12px] font-semibold text-[#B91C1C]"
                >
                  Discard &amp; New Bill
                </button>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      holdCurrentOrder();
                      setShowNewBillConfirm(false);
                    }}
                    className="px-4 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[12px] font-semibold"
                  >
                    Hold Current &amp; New Bill
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
