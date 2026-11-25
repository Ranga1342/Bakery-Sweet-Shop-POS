import React from 'react';
import { CheckCircle2, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { PosProvider, usePos } from './context/PosContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { LoginView } from './components/views/LoginView';
import { DashboardView } from './components/views/DashboardView';
import { PosBillingView } from './components/views/PosBillingView';
import { MenusView } from './components/views/MenusView';
import { CustomOrdersView } from './components/views/CustomOrdersView';
import { StockView } from './components/views/StockView';
import { InventoryView } from './components/views/InventoryView';
import { CustomersView } from './components/views/CustomersView';
import { ReportsView } from './components/views/ReportsView';
import { StaffManagementView } from './components/views/StaffManagementView';
import { BranchManagementView } from './components/views/BranchManagementView';
import { SettingsView } from './components/views/SettingsView';
import { ReceiptModal } from './components/common/ReceiptModal';
import { NavSection } from './types/pos';

const FALLBACK_NAV_ORDER: NavSection[] = [
  'dashboard',
  'pos',
  'stock',
  'inventory',
  'custom_orders',
  'menus',
  'customers',
  'reports',
  'staff',
  'branches',
  'settings',
];

const PosWorkspace: React.FC = () => {
  const {
    currentUser,
    activeNav,
    setActiveNav,
    hasPermission,
    activeReceipt,
    setActiveReceipt,
    settings,
    toasts,
    dismissToast,
  } = usePos();

  if (!currentUser) {
    return <LoginView />;
  }

  const canViewCurrent = hasPermission(activeNav, 'view');
  const firstAllowedNav =
    FALLBACK_NAV_ORDER.find((m) => hasPermission(m, 'view')) ?? 'dashboard';

  return (
    <div className="flex min-h-screen bg-[#E0E2E7] text-[#181210]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader />

        <main className="flex-1 min-w-0">
          {!canViewCurrent ? (
            <div className="p-6 max-w-lg mx-auto mt-12 bg-white rounded-xl border border-[#E5E7EB] text-center space-y-3">
              <div className="w-11 h-11 rounded-lg bg-[#FEE2E2] text-[#B91C1C] flex items-center justify-center mx-auto">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h2 className="text-[16px] font-semibold text-[#181210]">
                Module Access Restricted
              </h2>
              <p className="text-[13px] text-[#64748B]">
                Your current role ({currentUser.role}) does not have view access to this module.
              </p>
              {firstAllowedNav !== activeNav && (
                <button
                  type="button"
                  onClick={() => setActiveNav(firstAllowedNav)}
                  className="px-4 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[13px] font-semibold"
                >
                  Go to Allowed Workspace
                </button>
              )}
            </div>
          ) : (
            <>
              {activeNav === 'dashboard' && <DashboardView />}
              {activeNav === 'pos' && <PosBillingView />}
              {activeNav === 'menus' && <MenusView />}
              {activeNav === 'custom_orders' && <CustomOrdersView />}
              {activeNav === 'stock' && <StockView />}
              {activeNav === 'inventory' && <InventoryView />}
              {activeNav === 'customers' && <CustomersView />}
              {activeNav === 'reports' && <ReportsView />}
              {activeNav === 'staff' && <StaffManagementView />}
              {activeNav === 'branches' && <BranchManagementView />}
              {activeNav === 'settings' && <SettingsView />}
            </>
          )}
        </main>
      </div>

      {/* Thermal Receipt Preview & Print Modal */}
      <ReceiptModal
        order={activeReceipt}
        settings={settings}
        onClose={() => setActiveReceipt(null)}
      />

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border shadow-md text-[12px] font-medium bg-white ${
                toast.type === 'error'
                  ? 'border-[#FCA5A5] text-[#B91C1C]'
                  : toast.type === 'warning'
                  ? 'border-[#FDBA74] text-[#C2410C]'
                  : 'border-[#86EFAC] text-[#15803D]'
              }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span className="flex-1 text-[#181210]">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-[#64748B] hover:text-[#181210]"
                aria-label="Dismiss notification"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <PosProvider>
      <PosWorkspace />
    </PosProvider>
  );
}
