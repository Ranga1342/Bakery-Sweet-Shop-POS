import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Layers,
  ClipboardList,
  PackageCheck,
  Boxes,
  Users,
  BarChart3,
  Settings,
  Croissant,
  PanelLeftClose,
  PanelLeftOpen,
  UserCog,
  Building2,
} from 'lucide-react';
import { NavSection } from '../../types/pos';
import { usePos } from '../../context/PosContext';
import { daysUntil, TODAY_ISO } from '../../utils/formatters';

interface NavItemConfig {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface TooltipState {
  label: string;
  badge?: number;
  top: number;
  left: number;
}

const SIDEBAR_STORAGE_KEY = 'bakecore_sidebar_collapsed';

export const Sidebar: React.FC = () => {
  const {
    activeNav,
    setActiveNav,
    customOrders,
    lowStockProducts,
    expiringSoonBatches,
    heldOrders,
    inventoryItems,
    activeBranchId,
    activeBranch,
    hasPermission,
  } = usePos();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isCollapsed));
    } catch {
      // Ignore storage failures
    }
    if (!isCollapsed) {
      setTooltip(null);
    }
  }, [isCollapsed]);

  const pendingCustomCount = customOrders.filter(
    (c) =>
      (c.branchId ?? 'br-1') === activeBranchId &&
      c.status !== 'Handed Over' &&
      c.status !== 'Cancelled'
  ).length;
  const branchHeldCount = heldOrders.filter(
    (h) => (h.branchId ?? 'br-1') === activeBranchId
  ).length;
  const stockAlertCount = new Set([
    ...lowStockProducts.map((p) => p.id),
    ...expiringSoonBatches.map((b) => b.productId),
  ]).size;
  const inventoryAlertCount = inventoryItems.filter((item) => {
    if ((item.branchId ?? 'br-1') !== activeBranchId) return false;
    if (item.status === 'Inactive') return false;
    const isLowOrOos = item.quantity <= item.minStockLevel;
    const isExpiring =
      item.trackExpiry &&
      item.expiryDate &&
      item.quantity > 0 &&
      daysUntil(item.expiryDate, TODAY_ISO) <= 3;
    return isLowOrOos || isExpiring;
  }).length;

  const allNavItems: NavItemConfig[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'pos',
      label: 'POS Billing',
      icon: ShoppingBag,
      badge: branchHeldCount > 0 ? branchHeldCount : undefined,
    },
    { id: 'menus', label: 'Menus', icon: Layers },
    {
      id: 'custom_orders',
      label: 'Custom Orders',
      icon: ClipboardList,
      badge: pendingCustomCount > 0 ? pendingCustomCount : undefined,
    },
    {
      id: 'stock',
      label: 'Stock Management',
      icon: PackageCheck,
      badge: stockAlertCount > 0 ? stockAlertCount : undefined,
    },
    {
      id: 'inventory',
      label: 'Inventory Management',
      icon: Boxes,
      badge: inventoryAlertCount > 0 ? inventoryAlertCount : undefined,
    },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'staff', label: 'Staff Management', icon: UserCog },
    { id: 'branches', label: 'Branch Management', icon: Building2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const navItems = allNavItems.filter((item) => hasPermission(item.id, 'view'));

  const showTooltip = (
    el: HTMLElement,
    label: string,
    badge?: number
  ) => {
    if (!isCollapsed) return;
    const rect = el.getBoundingClientRect();
    setTooltip({
      label,
      badge,
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    });
  };

  const hideTooltip = () => setTooltip(null);

  return (
    <>
      <aside
        className={`${
          isCollapsed ? 'w-[74px]' : 'w-[232px]'
        } shrink-0 bg-[#181210] text-white flex flex-col h-screen sticky top-0 select-none transition-[width] duration-200 ease-in-out z-30`}
      >
        {/* Top Brand & Collapse Toggle Block */}
        <div
          className={`h-[65px] border-b border-white/10 flex items-center shrink-0 ${
            isCollapsed ? 'justify-between px-2.5 gap-1' : 'justify-between px-4 gap-2'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`${
                isCollapsed ? 'w-7 h-7' : 'w-8 h-8'
              } rounded-md bg-[#FB923C] flex items-center justify-center text-white shrink-0 transition-all duration-200`}
            >
              <Croissant className={isCollapsed ? 'w-4 h-4' : 'w-4.5 h-4.5'} />
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="text-[13px] font-bold tracking-tight leading-tight text-white truncate">
                  RB Sweets &amp; Bakery
                </div>
                <div className="text-[11px] text-white/60 leading-tight truncate">
                  Multi-Branch POS
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              hideTooltip();
              setIsCollapsed((prev) => !prev);
            }}
            onMouseEnter={(e) =>
              showTooltip(
                e.currentTarget,
                isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'
              )
            }
            onMouseLeave={hideTooltip}
            onFocus={(e) =>
              showTooltip(
                e.currentTarget,
                isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'
              )
            }
            onBlur={hideTooltip}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-7 h-7 rounded-md flex items-center justify-center text-white/65 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation */}
        <div
          className={`flex-1 overflow-y-auto py-4 ${isCollapsed ? 'px-2.5' : 'px-3'}`}
          onScroll={hideTooltip}
        >
          {!isCollapsed ? (
            <div className="px-2.5 mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45 whitespace-nowrap">
              Workspace
            </div>
          ) : (
            <div className="h-[16px] mb-2 flex items-center justify-center">
              <div className="w-6 h-px bg-white/12" />
            </div>
          )}

          <nav className="space-y-1" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  onMouseEnter={(e) => showTooltip(e.currentTarget, item.label, item.badge)}
                  onMouseLeave={hideTooltip}
                  onFocus={(e) => showTooltip(e.currentTarget, item.label, item.badge)}
                  onBlur={hideTooltip}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative w-full flex items-center rounded-md text-[13px] font-medium transition-colors whitespace-nowrap ${
                    isCollapsed
                      ? 'justify-center h-[38px] px-0'
                      : 'justify-between gap-2 px-3 py-2.5'
                  } ${
                    isActive
                      ? 'bg-[#FB923C] text-white font-semibold'
                      : 'text-white/75 hover:text-white hover:bg-white/8'
                  }`}
                >
                  <span
                    className={`flex items-center min-w-0 ${
                      isCollapsed ? 'justify-center' : 'gap-2.5'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-white/70'}`}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </span>

                  {!isCollapsed && item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 text-[11px] font-semibold rounded tabular-nums ${
                        isActive ? 'bg-white/25 text-white' : 'bg-white/12 text-white/85'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {isCollapsed && item.badge !== undefined && (
                    <span
                      className={`absolute top-1.5 right-2.5 w-1.5 h-1.5 rounded-full ${
                        isActive ? 'bg-white' : 'bg-[#FB923C]'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Store Footer Info */}
        <div
          className={`border-t border-white/10 text-[11px] text-white/55 shrink-0 ${
            isCollapsed ? 'px-2 py-3 flex justify-center' : 'px-4 py-3'
          }`}
          onMouseEnter={(e) =>
            showTooltip(
              e.currentTarget,
              `${activeBranch.branchCode} · ${activeBranch.name} · ${activeBranch.status}`
            )
          }
          onMouseLeave={hideTooltip}
        >
          {isCollapsed ? (
            <div className="px-1.5 py-0.5 rounded bg-white/8 text-[10px] font-semibold text-white/80 tabular-nums truncate max-w-full">
              {activeBranch.branchCode.replace('BR-', '#')}
            </div>
          ) : (
            <>
              <div className="font-medium text-white/85 truncate flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    activeBranch.status === 'Active' ? 'bg-[#22C55E]' : 'bg-[#EF4444]'
                  }`}
                />
                <span className="truncate">{activeBranch.name}</span>
              </div>
              <div className="truncate mt-0.5 tabular-nums">
                {activeBranch.branchCode} · {activeBranch.status}
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Fixed-position Floating Tooltip (unclipped by sidebar scroll container) */}
      {isCollapsed && tooltip && (
        <div
          role="tooltip"
          style={{ top: `${tooltip.top}px`, left: `${tooltip.left}px` }}
          className="fixed -translate-y-1/2 z-50 pointer-events-none flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#181210] text-white text-[12px] font-medium border border-white/15 shadow-lg whitespace-nowrap"
        >
          <span>{tooltip.label}</span>
          {tooltip.badge !== undefined && (
            <span className="px-1.5 py-0.5 rounded bg-[#FB923C] text-white text-[10px] font-semibold tabular-nums">
              {tooltip.badge}
            </span>
          )}
        </div>
      )}
    </>
  );
};
