import React, { useEffect, useState } from 'react';
import {
  Save,
  RotateCcw,
  Printer,
  Store,
  Percent,
  Receipt,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  UserCog,
  Building2,
  Upload,
  Trash2,
  Image as ImageIcon,
  Usb,
} from 'lucide-react';
import { usePos } from '../../context/PosContext';
import {
  BusinessCategory,
  NavSection,
  PaymentMethod,
  ReceiptPaperSize,
  StoreSettings,
} from '../../types/pos';
import { formatINR, roundCurrency, roundPercent, roundQty } from '../../utils/formatters';

const BUSINESS_CATEGORIES: BusinessCategory[] = [
  'Bakery & Sweets',
  'Bakery & Cafe',
  'Mithai & Confectionery',
  'Patisserie & Cake Shop',
  'Restaurant & Dining',
  'Fast Food & QSR',
  'Cloud Kitchen',
  'Other',
];

const APPLICATION_SCREENS: { id: NavSection; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'pos', label: 'POS Billing' },
  { id: 'menus', label: 'Menus' },
  { id: 'custom_orders', label: 'Custom Orders' },
  { id: 'stock', label: 'Stock Management' },
  { id: 'inventory', label: 'Inventory Management' },
  { id: 'customers', label: 'Customers' },
  { id: 'reports', label: 'Reports' },
  { id: 'staff', label: 'Staff Management' },
  { id: 'branches', label: 'Branch Management' },
  { id: 'settings', label: 'Settings' },
];

type SettingsTab = 'store' | 'tax_units' | 'receipt' | 'payments';

const SETTINGS_NAV: {
  id: SettingsTab;
  label: string;
  desc: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: 'store', label: 'Store & FSSAI Profile', desc: 'Business logo, GSTIN & phone info', icon: Store },
  {
    id: 'tax_units',
    label: 'Tax, Packaging & Alerts',
    desc: 'GST defaults, gift boxes & thresholds',
    icon: Percent,
  },
  {
    id: 'receipt',
    label: 'Receipt & Print Preview',
    desc: 'Thermal layout, printer & preview',
    icon: Receipt,
  },
  {
    id: 'payments',
    label: 'Payments, Staff & Reset',
    desc: 'Accepted tenders, roles & demo reset',
    icon: CreditCard,
  },
];

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    staffUsers,
    currentUser,
    switchUser,
    resetDemoData,
    activeBranch,
    setActiveNav,
    hasPermission,
  } = usePos();

  const canEditSettings = hasPermission('settings', 'edit');
  const canResetDemo = hasPermission('settings', 'approve');
  const switchableStaff = staffUsers.filter(
    (s) => s.status === 'Active' && s.hasLoginAccess
  );

  const [tab, setTab] = useState<SettingsTab>('store');
  const [draft, setDraft] = useState<StoreSettings>(settings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string>('');
  const [printerNotice, setPrinterNotice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);

  // Sync draft when settings reset externally
  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoError('Please select a valid image file (PNG, JPG, WebP, or SVG).');
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setLogoError('Logo image must be 1.5 MB or smaller.');
      return;
    }
    setLogoError('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDraft((prev) => ({ ...prev, businessLogoUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const validateSection = (section: SettingsTab): boolean => {
    const nextErrors: Record<string, string> = {};
    if (section === 'store') {
      if (!draft.businessName.trim()) nextErrors.businessName = 'Business name is required.';
      if (!draft.address.trim()) nextErrors.address = 'Store address is required.';
      if (draft.phone.trim() && draft.phone.replace(/\D/g, '').length < 8) {
        nextErrors.phone = 'Enter a valid phone number.';
      }
    }
    if (section === 'tax_units') {
      if (Number.isNaN(draft.defaultTaxRate) || draft.defaultTaxRate < 0 || draft.defaultTaxRate > 28) {
        nextErrors.defaultTaxRate = 'GST rate must be between 0% and 28%.';
      }
      if (Number.isNaN(draft.defaultPackagingFee) || draft.defaultPackagingFee < 0) {
        nextErrors.defaultPackagingFee = 'Packaging fee cannot be negative.';
      }
      if (Number.isNaN(draft.lowStockThresholdDefault) || draft.lowStockThresholdDefault <= 0) {
        nextErrors.lowStockThresholdDefault = 'Low-stock threshold must be greater than 0.';
      }
    }
    if (section === 'payments') {
      if (draft.acceptedPaymentMethods.length === 0) {
        nextErrors.acceptedPaymentMethods = 'Enable at least one payment method.';
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = (e: React.FormEvent, section: SettingsTab) => {
    e.preventDefault();
    if (!validateSection(section)) return;
    updateSettings({
      ...draft,
      defaultTaxRate: roundPercent(draft.defaultTaxRate),
      defaultPackagingFee: roundCurrency(draft.defaultPackagingFee),
      lowStockThresholdDefault: roundQty(draft.lowStockThresholdDefault),
    });
    setSavedNotice('Settings saved and applied across POS, receipts, and stock alerts.');
    window.setTimeout(() => setSavedNotice(null), 3500);
  };

  const togglePaymentMethod = (m: PaymentMethod) => {
    const exists = draft.acceptedPaymentMethods.includes(m);
    if (exists && draft.acceptedPaymentMethods.length === 1) {
      setErrors({ acceptedPaymentMethods: 'At least one payment method must remain active.' });
      return;
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next.acceptedPaymentMethods;
      return next;
    });
    setDraft((prev) => ({
      ...prev,
      acceptedPaymentMethods: exists
        ? prev.acceptedPaymentMethods.filter((x) => x !== m)
        : [...prev.acceptedPaymentMethods, m],
    }));
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100vh-65px)] bg-[#E0E2E7]">
      {/* Left Settings Sections */}
      <aside className="w-full lg:w-[250px] bg-white border-b lg:border-b-0 lg:border-r border-[#E5E7EB] p-3 sm:p-4 lg:space-y-1.5 shrink-0">
        <div className="hidden lg:block px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
          Settings &amp; Configuration
        </div>
        <div className="flex lg:flex-col gap-1.5 overflow-x-auto pb-0.5 lg:pb-0">
          {SETTINGS_NAV.map((item) => {
            const active = tab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setErrors({});
                }}
                className={`shrink-0 lg:shrink lg:w-full px-3 py-2 lg:py-2.5 rounded-md text-left transition-colors flex items-center lg:items-start gap-2 lg:gap-2.5 whitespace-nowrap lg:whitespace-normal ${
                  active ? 'bg-[#FB923C] text-white' : 'text-[#181210] bg-[#FAF9F5] lg:bg-transparent hover:bg-[#FAF9F5]'
                }`}
              >
                <Icon className={`w-4 h-4 lg:mt-0.5 shrink-0 ${active ? 'text-white' : 'text-[#64748B]'}`} />
                <div className="min-w-0">
                  <div className={`text-[12.5px] lg:text-[13px] ${active ? 'font-semibold' : 'font-medium'}`}>
                    {item.label}
                  </div>
                  <div className={`hidden lg:block text-[11px] mt-0.5 leading-snug ${active ? 'text-white/85' : 'text-[#64748B]'}`}>
                    {item.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-3 sm:p-5 min-w-0 space-y-4">
        {/* Global Save / Dirty Status Banner */}
        {(savedNotice || isDirty) && (
          <div
            className={`max-w-5xl rounded-lg border px-3.5 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-[12px] font-medium ${
              savedNotice
                ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#15803D]'
                : 'bg-[#FFF7ED] border-[#FDBA74] text-[#C2410C]'
            }`}
          >
            <div className="flex items-center gap-2">
              {savedNotice ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{savedNotice || 'You have unsaved configuration changes.'}</span>
            </div>
            {isDirty && !savedNotice && (
              <button
                type="button"
                onClick={() => {
                  setDraft(settings);
                  setErrors({});
                }}
                className="text-[11px] font-semibold underline hover:no-underline"
              >
                Discard edits
              </button>
            )}
          </div>
        )}

        {tab === 'store' && (
          <form
            onSubmit={(e) => handleSave(e, 'store')}
            noValidate
            className="bg-white rounded-lg border border-[#E5E7EB] p-4 sm:p-6 max-w-3xl space-y-5 text-[13px]"
          >
            <div>
              <h2 className="text-[16px] font-semibold text-[#181210]">
                Store &amp; Profile Information
              </h2>
              <p className="text-[12px] text-[#64748B] mt-0.5">
                Displayed on counter receipts, custom cake order slips, and store headers.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 rounded-lg border border-[#E5E7EB] bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {draft.businessLogoUrl ? (
                    <img
                      src={draft.businessLogoUrl}
                      alt="Business logo preview"
                      className="w-full h-full object-contain p-1"
                    />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-[#94A3B8]" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[#181210]">Business Logo</div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    PNG, JPG, WebP, or SVG (max 1.5 MB). Shown on store header &amp; printed bills.
                  </p>
                  {logoError && <p className="text-[11px] text-[#DC2626] mt-0.5">{logoError}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[12px] font-semibold text-[#181210] cursor-pointer whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5 text-[#FB923C]" />
                  {draft.businessLogoUrl ? 'Change Logo' : 'Upload Logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
                {draft.businessLogoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft((prev) => ({ ...prev, businessLogoUrl: '' }));
                      setLogoError('');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#FEE2E2] bg-white hover:bg-[#FEE2E2]/40 text-[12px] font-semibold text-[#B91C1C] whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1.5">
                  Business Name *
                </label>
                <input
                  type="text"
                  value={draft.businessName}
                  onChange={(e) => setDraft({ ...draft, businessName: e.target.value })}
                  className={`w-full h-[38px] px-3 border rounded-md ${
                    errors.businessName ? 'border-[#DC2626]' : 'border-[#E5E7EB]'
                  }`}
                />
                {errors.businessName && (
                  <p className="text-[11px] text-[#DC2626] mt-1">{errors.businessName}</p>
                )}
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1.5">
                  Business Category
                </label>
                <select
                  value={draft.businessCategory ?? 'Bakery & Sweets'}
                  onChange={(e) =>
                    setDraft({ ...draft, businessCategory: e.target.value as BusinessCategory })
                  }
                  className="w-full h-[38px] px-3 border border-[#E5E7EB] rounded-md bg-white"
                >
                  {BUSINESS_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[12px] font-semibold text-[#181210] mb-1.5">
                  Store Address *
                </label>
                <input
                  type="text"
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                  className={`w-full h-[38px] px-3 border rounded-md ${
                    errors.address ? 'border-[#DC2626]' : 'border-[#E5E7EB]'
                  }`}
                />
                {errors.address && (
                  <p className="text-[11px] text-[#DC2626] mt-1">{errors.address}</p>
                )}
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  placeholder="Enter phone number"
                  className={`w-full h-[38px] px-3 border rounded-md ${
                    errors.phone ? 'border-[#DC2626]' : 'border-[#E5E7EB]'
                  }`}
                />
                {errors.phone && <p className="text-[11px] text-[#DC2626] mt-1">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1.5">
                  GSTIN
                </label>
                <input
                  type="text"
                  value={draft.gstin}
                  onChange={(e) => setDraft({ ...draft, gstin: e.target.value })}
                  placeholder="Enter GSTIN (optional)"
                  className="w-full h-[38px] px-3 font-mono border border-[#E5E7EB] rounded-md"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1.5">
                  FSSAI License No.
                </label>
                <input
                  type="text"
                  value={draft.fssaiNumber}
                  onChange={(e) => setDraft({ ...draft, fssaiNumber: e.target.value })}
                  placeholder="Enter FSSAI number (optional)"
                  className="w-full h-[38px] px-3 font-mono border border-[#E5E7EB] rounded-md"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1.5">
                  Default Screen
                </label>
                <select
                  value={draft.defaultScreen ?? 'dashboard'}
                  onChange={(e) =>
                    setDraft({ ...draft, defaultScreen: e.target.value as NavSection })
                  }
                  className="w-full h-[38px] px-3 border border-[#E5E7EB] rounded-md bg-white"
                >
                  {APPLICATION_SCREENS.map((screen) => (
                    <option key={screen.id} value={screen.id}>
                      {screen.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#64748B] mt-1">
                  Opens automatically upon sign-in (when permitted by staff role).
                </p>
              </div>
            </div>

            {canEditSettings && (
              <div className="pt-4 border-t border-[#E5E7EB] flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white font-semibold whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  Save Store Profile
                </button>
              </div>
            )}
          </form>
        )}

        {tab === 'tax_units' && (
          <form
            onSubmit={(e) => handleSave(e, 'tax_units')}
            noValidate
            className="bg-white rounded-lg border border-[#E5E7EB] p-4 sm:p-6 max-w-3xl space-y-4 text-[13px]"
          >
            <div>
              <h2 className="text-[16px] font-semibold text-[#181210]">
                Tax, Packaging &amp; Stock Alert Defaults
              </h2>
              <p className="text-[12px] text-[#64748B]">
                Configure default GST rates for new menu items, gift box packing fees, and low-stock
                alert thresholds.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1">Default GST Rate (%)</label>
                <input
                  type="number"
                  min={0}
                  max={28}
                  step="0.01"
                  value={draft.defaultTaxRate}
                  onChange={(e) =>
                    setDraft({ ...draft, defaultTaxRate: Number(e.target.value) })
                  }
                  className={`w-full px-3 py-2 border rounded-md tabular-nums ${
                    errors.defaultTaxRate ? 'border-[#DC2626]' : 'border-[#E5E7EB]'
                  }`}
                />
                {errors.defaultTaxRate && (
                  <p className="text-[11px] text-[#DC2626] mt-1">{errors.defaultTaxRate}</p>
                )}
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1">
                  Standard Gift Box Fee (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.defaultPackagingFee}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      defaultPackagingFee: Number(e.target.value),
                    })
                  }
                  className={`w-full px-3 py-2 border rounded-md tabular-nums ${
                    errors.defaultPackagingFee ? 'border-[#DC2626]' : 'border-[#E5E7EB]'
                  }`}
                />
                {errors.defaultPackagingFee && (
                  <p className="text-[11px] text-[#DC2626] mt-1">{errors.defaultPackagingFee}</p>
                )}
              </div>
              <div>
                <label className="block text-[12px] font-semibold mb-1">
                  Default Low-Stock Alert
                </label>
                <input
                  type="number"
                  min={0.1}
                  step="any"
                  value={draft.lowStockThresholdDefault}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      lowStockThresholdDefault: Number(e.target.value),
                    })
                  }
                  className={`w-full px-3 py-2 border rounded-md tabular-nums ${
                    errors.lowStockThresholdDefault ? 'border-[#DC2626]' : 'border-[#E5E7EB]'
                  }`}
                />
                {errors.lowStockThresholdDefault && (
                  <p className="text-[11px] text-[#DC2626] mt-1">
                    {errors.lowStockThresholdDefault}
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] space-y-1.5">
              <div className="text-[12px] font-semibold text-[#181210]">
                Active Selling &amp; Inventory Units
              </div>
              <p className="text-[12px] text-[#64748B]">
                Piece (pc), Weight (kg / custom grams), and Gift Box / Pack (box) are
                active across Menus, POS Billing, and Counter Stock Management.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#FFF7ED] border border-[#FED7AA] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-[12px] font-semibold text-[#181210]">
                  Active Branch Operational Override: {activeBranch.name}
                </div>
                <p className="text-[11.5px] text-[#64748B] mt-0.5 tabular-nums">
                  Branch Tax {activeBranch.operationalSettings.taxRate}% · Packaging ₹
                  {activeBranch.operationalSettings.packagingFee} · Hours{' '}
                  {activeBranch.operationalSettings.openingHours}
                </p>
              </div>
              {hasPermission('branches', 'view') && (
                <button
                  type="button"
                  onClick={() => setActiveNav('branches')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-[#FDBA74] text-[12px] font-semibold text-[#C2410C] hover:bg-[#FAF9F5] whitespace-nowrap"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Branch Settings
                </button>
              )}
            </div>

            {canEditSettings && (
              <div className="pt-3 border-t border-[#E5E7EB] flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white font-semibold whitespace-nowrap"
                >
                  <Save className="w-4 h-4" />
                  Save Billing Defaults
                </button>
              </div>
            )}
          </form>
        )}

        {/* Two-column Document / Receipt Preview Page */}
        {tab === 'receipt' && (() => {
          const paperSize: ReceiptPaperSize = draft.receiptPaperSize ?? '3inch';
          const is2Inch = paperSize === '2inch';
          const isPrinterConnected = (draft.printerStatus ?? 'Connected') === 'Connected';
          const printerName = draft.printerName || 'Epson TM-T82III Thermal';
          const printerConn = draft.printerConnectionType || 'USB (Port USB001)';
          const printerMeta = draft.printerDetails || 'ESC/POS · 58mm / 80mm Roll Supported';

          return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-5xl items-start">
              <form
                onSubmit={(e) => handleSave(e, 'receipt')}
                className="lg:col-span-7 bg-white rounded-lg border border-[#E5E7EB] p-4 sm:p-6 space-y-5 text-[13px]"
              >
                <div>
                  <h2 className="text-[16px] font-semibold text-[#181210]">
                    Thermal Receipt Layout &amp; Copy
                  </h2>
                  <p className="text-[12px] text-[#64748B] mt-0.5">
                    Customize 2-inch and 3-inch thermal bill headers, storage instructions, and tax
                    visibility.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[12px] font-semibold text-[#181210] mb-1.5">
                      Receipt Header Note
                    </label>
                    <input
                      type="text"
                      value={draft.receiptHeaderNote}
                      onChange={(e) => setDraft({ ...draft, receiptHeaderNote: e.target.value })}
                      className="w-full h-[38px] px-3 border border-[#E5E7EB] rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-semibold text-[#181210] mb-1.5">
                      Receipt Footer / Care Note
                    </label>
                    <textarea
                      rows={3}
                      value={draft.receiptFooterNote}
                      onChange={(e) => setDraft({ ...draft, receiptFooterNote: e.target.value })}
                      className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                    />
                  </div>

                  <div className="rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] p-3.5 space-y-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                      Receipt Display Options
                    </div>
                    <label className="flex items-center gap-2.5 text-[12px] font-medium text-[#181210] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.showGstOnReceipt}
                        onChange={(e) => setDraft({ ...draft, showGstOnReceipt: e.target.checked })}
                        className="accent-[#FB923C]"
                      />
                      Show GSTIN &amp; GST Tax Breakdown
                    </label>
                    <label className="flex items-center gap-2.5 text-[12px] font-medium text-[#181210] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.showFssaiOnReceipt}
                        onChange={(e) => setDraft({ ...draft, showFssaiOnReceipt: e.target.checked })}
                        className="accent-[#FB923C]"
                      />
                      Print FSSAI License Number on Bill
                    </label>
                    <label className="flex items-center gap-2.5 text-[12px] font-medium text-[#181210] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.showCustomerPhoneOnReceipt}
                        onChange={(e) =>
                          setDraft({ ...draft, showCustomerPhoneOnReceipt: e.target.checked })
                        }
                        className="accent-[#FB923C]"
                      />
                      Include Customer Phone Number
                    </label>
                  </div>
                </div>

                {canEditSettings && (
                  <div className="pt-4 border-t border-[#E5E7EB] flex justify-end gap-2">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white font-semibold whitespace-nowrap"
                    >
                      <Save className="w-4 h-4" />
                      Apply Receipt Settings
                    </button>
                  </div>
                )}
              </form>

              {/* Live Thermal Receipt & Printer Preview */}
              <div className="lg:col-span-5 bg-white rounded-lg border border-[#E5E7EB] p-4 sm:p-5 flex flex-col gap-4">
                {/* Connected Printer Status Card */}
                <div className="w-full rounded-lg border border-[#E5E7EB] bg-[#FAF9F5] p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0">
                        <Printer className="w-4 h-4 text-[#181210]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold text-[#181210] truncate">
                          {printerName}
                        </div>
                        <div className="text-[11px] text-[#64748B] flex items-center gap-1 truncate mt-0.5">
                          <Usb className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {isPrinterConnected
                              ? `${printerConn} · ${printerMeta}`
                              : `${printerConn} · Offline`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10.5px] font-semibold shrink-0 ${
                        isPrinterConnected
                          ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#15803D]'
                          : 'bg-[#FEE2E2] border-[#FCA5A5] text-[#B91C1C]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isPrinterConnected ? 'bg-[#16A34A]' : 'bg-[#DC2626]'
                        }`}
                      />
                      {isPrinterConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#E5E7EB] text-[11px]">
                    <span className="text-[#64748B]">
                      {isPrinterConnected
                        ? 'Ready for thermal receipt printing'
                        : 'No active printer link'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPrinterNotice(null);
                        setDraft((prev) => ({
                          ...prev,
                          printerStatus: isPrinterConnected ? 'Disconnected' : 'Connected',
                        }));
                      }}
                      className="font-semibold text-[#FB923C] hover:text-[#F97316] whitespace-nowrap"
                    >
                      {isPrinterConnected ? 'Disconnect' : 'Connect Printer'}
                    </button>
                  </div>
                </div>

                {/* Preview Controls Bar: Size Switcher Left, Test Print Action Right */}
                <div className="w-full flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-[#E5E7EB]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[12px] font-semibold text-[#181210] whitespace-nowrap">
                      Preview Size
                    </span>
                    <div
                      className="inline-flex items-center rounded-md border border-[#E5E7EB] bg-[#FAF9F5] p-0.5 shrink-0"
                      role="group"
                      aria-label="Receipt paper width"
                    >
                      {(['2inch', '3inch'] as ReceiptPaperSize[]).map((size) => {
                        const selected = paperSize === size;
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({ ...prev, receiptPaperSize: size }))
                            }
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                              selected
                                ? 'bg-[#181210] text-white'
                                : 'text-[#64748B] hover:text-[#181210]'
                            }`}
                          >
                            {size === '2inch' ? '2-inch' : '3-inch'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isPrinterConnected) {
                        setPrinterNotice(
                          'Printer is currently disconnected. Connect a printer to run a test print.'
                        );
                        return;
                      }
                      setPrinterNotice(null);
                      window.print();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-[#FAF9F5] hover:bg-white hover:border-[#FB923C] text-[12px] font-semibold text-[#181210] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#FB923C]" />
                    Test Print
                  </button>
                </div>

                {printerNotice && (
                  <div className="w-full px-3 py-2 rounded-md bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] text-[11px] font-medium">
                    {printerNotice}
                  </div>
                )}

                {/* Dynamic Thermal Receipt Preview Stage */}
                <div className="w-full rounded-lg bg-[#E0E2E7]/35 border border-[#E5E7EB]/80 p-4 flex flex-col items-center gap-2.5">
                  <div className="text-[11px] font-medium text-[#64748B]">
                    {is2Inch ? '2-inch (58mm) Thermal Roll' : '3-inch (80mm) Thermal Roll'}
                  </div>

                  <div
                    className={`border border-[#E5E7EB] rounded-lg bg-white text-[#181210] shadow-xs transition-all duration-200 ${
                      is2Inch
                        ? 'w-[216px] p-3 text-[10px] leading-snug'
                        : 'w-full max-w-[304px] p-4 text-[11px] leading-normal'
                    }`}
                  >
                    <div
                      className={`text-center border-b border-dashed border-[#D1D5DB] ${
                        is2Inch ? 'pb-2 mb-2' : 'pb-2.5 mb-2.5'
                      }`}
                    >
                      {draft.businessLogoUrl && (
                        <img
                          src={draft.businessLogoUrl}
                          alt="Store logo"
                          className={`mx-auto object-contain ${
                            is2Inch ? 'h-7 max-w-[90px] mb-1' : 'h-9 max-w-[120px] mb-1.5'
                          }`}
                        />
                      )}
                      <div
                        className={`font-bold break-words ${
                          is2Inch ? 'text-[12px] leading-tight' : 'text-[14px]'
                        }`}
                      >
                        {draft.businessName}
                      </div>
                      <div className="text-[#64748B] break-words">{activeBranch.name}</div>
                      {draft.address && (
                        <div className={`text-[#64748B] break-words ${is2Inch ? 'text-[9px]' : 'text-[10px]'}`}>
                          {draft.address}
                        </div>
                      )}
                      {draft.phone && (
                        <div className={`text-[#64748B] tabular-nums break-words ${is2Inch ? 'text-[9px]' : 'text-[10.5px]'}`}>
                          Tel: {draft.phone}
                        </div>
                      )}
                      {draft.showFssaiOnReceipt && draft.fssaiNumber && (
                        <div
                          className={`font-mono text-[#64748B] mt-1 break-all ${
                            is2Inch ? 'text-[9px]' : 'text-[10px]'
                          }`}
                        >
                          FSSAI: {draft.fssaiNumber}
                        </div>
                      )}
                      {draft.showGstOnReceipt && draft.gstin && (
                        <div
                          className={`font-mono text-[#64748B] break-all ${
                            is2Inch ? 'text-[9px]' : 'text-[10px]'
                          }`}
                        >
                          GSTIN: {draft.gstin}
                        </div>
                      )}
                      {draft.receiptHeaderNote && (
                        <div
                          className={`font-medium mt-1 break-words ${
                            is2Inch ? 'text-[9.5px]' : 'text-[10.5px]'
                          }`}
                        >
                          {draft.receiptHeaderNote}
                        </div>
                      )}
                    </div>

                    {draft.showCustomerPhoneOnReceipt && (
                      <div
                        className={`text-[#64748B] border-b border-dashed border-[#D1D5DB] pb-1.5 mb-2 break-words ${
                          is2Inch ? 'text-[9px]' : 'text-[10px]'
                        }`}
                      >
                        Customer: Meera Natarajan · +91 98421 44310
                      </div>
                    )}

                    <div className="space-y-1.5 border-b border-dashed border-[#D1D5DB] pb-2 mb-2">
                      <div className="flex justify-between items-start gap-2">
                        <span className="min-w-0 flex-1 break-words">
                          Royal Kaju Katli (500g) x 1
                        </span>
                        <span className="tabular-nums shrink-0 font-medium">{formatINR(650)}</span>
                      </div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="min-w-0 flex-1 break-words">Butter Croissant x 2</span>
                        <span className="tabular-nums shrink-0 font-medium">{formatINR(190)}</span>
                      </div>
                    </div>

                    <div className="space-y-1 border-b border-dashed border-[#D1D5DB] pb-2 mb-2">
                      {draft.showGstOnReceipt && (
                        <div className="flex justify-between items-center gap-2 text-[#64748B]">
                          <span>GST ({draft.defaultTaxRate}%)</span>
                          <span className="tabular-nums shrink-0">
                            {formatINR((840 * draft.defaultTaxRate) / 100)}
                          </span>
                        </div>
                      )}
                      <div
                        className={`flex justify-between items-center gap-2 font-bold ${
                          is2Inch ? 'text-[11.5px]' : 'text-[13px]'
                        }`}
                      >
                        <span>Grand Total</span>
                        <span className="tabular-nums shrink-0">
                          {formatINR(
                            draft.showGstOnReceipt
                              ? 840 + (840 * draft.defaultTaxRate) / 100
                              : 840
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center pt-1">
                      <div className={`flex items-stretch gap-[1.5px] ${is2Inch ? 'h-5' : 'h-7'}`}>
                        {[2, 1, 3, 1, 2, 2, 1, 3, 2, 1, 2, 1, 3, 1, 2, 2, 1, 3].map((w, i) => (
                          <div
                            key={i}
                            className="bg-[#181210]"
                            style={{ width: `${w * (is2Inch ? 1.0 : 1.4)}px` }}
                          />
                        ))}
                      </div>
                      <div
                        className={`font-mono text-[#64748B] mt-1 ${
                          is2Inch ? 'text-[8.5px]' : 'text-[9px]'
                        }`}
                      >
                        BC-SAMPLE-1051
                      </div>
                      {draft.receiptFooterNote && (
                        <p
                          className={`text-center text-[#64748B] mt-2 break-words ${
                            is2Inch ? 'text-[9px] leading-snug' : 'text-[10px]'
                          }`}
                        >
                          {draft.receiptFooterNote}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {tab === 'payments' && (
          <div className="space-y-5 max-w-3xl">
            <form
              onSubmit={(e) => handleSave(e, 'payments')}
              className="bg-white rounded-lg border border-[#E5E7EB] p-4 sm:p-6 space-y-4 text-[13px]"
            >
              <div>
                <h2 className="text-[16px] font-semibold text-[#181210]">
                  Payment Methods &amp; Split Billing
                </h2>
                <p className="text-[12px] text-[#64748B]">
                  Enabled tenders immediately appear in POS Checkout and Custom Order balance
                  collection.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {(['Cash', 'UPI', 'Card'] as PaymentMethod[]).map((m) => {
                  const enabled = draft.acceptedPaymentMethods.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => togglePaymentMethod(m)}
                      className={`px-4 py-2 rounded-md border font-semibold transition-colors ${
                        enabled
                          ? 'bg-[#181210] text-white border-[#181210]'
                          : 'bg-[#FAF9F5] text-[#64748B] border-[#E5E7EB]'
                      }`}
                    >
                      {m} {enabled ? '· Enabled' : '· Disabled'}
                    </button>
                  );
                })}
              </div>
              {errors.acceptedPaymentMethods && (
                <p className="text-[11px] text-[#DC2626]">{errors.acceptedPaymentMethods}</p>
              )}

              <label className="flex items-center gap-2 text-[12px] font-medium pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.enableSplitPayment}
                  onChange={(e) => setDraft({ ...draft, enableSplitPayment: e.target.checked })}
                  className="accent-[#FB923C]"
                />
                Allow Split Payments (e.g. Cash + UPI on the same bill)
              </label>

              {canEditSettings && (
                <div className="pt-3 border-t border-[#E5E7EB] flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white font-semibold whitespace-nowrap"
                  >
                    <Save className="w-4 h-4" />
                    Save Payment Rules
                  </button>
                </div>
              )}
            </form>

            <div className="bg-white rounded-lg border border-[#E5E7EB] p-4 sm:p-6 space-y-3 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#181210]">
                    Active Operators &amp; Workspace Data
                  </h3>
                  <p className="text-[12px] text-[#64748B]">
                    Switch between active POS-enabled staff or manage credentials and RBAC in Staff Management.
                  </p>
                </div>
                {hasPermission('staff', 'view') && (
                  <button
                    type="button"
                    onClick={() => setActiveNav('staff')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-[#FAF9F5] hover:bg-white text-[12px] font-semibold text-[#181210] whitespace-nowrap"
                  >
                    <UserCog className="w-3.5 h-3.5 text-[#FB923C]" />
                    Open Staff Management
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {switchableStaff.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-md bg-[#FAF9F5] border border-[#E5E7EB]"
                  >
                    <div>
                      <div className="font-semibold text-[#181210]">{s.name}</div>
                      <div className="text-[11px] text-[#64748B]">
                        {s.role} · {s.employeeCode} · {s.status}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchUser(s.id)}
                      className={`px-3 py-1.5 rounded text-[12px] font-semibold whitespace-nowrap ${
                        currentUser?.id === s.id
                          ? 'bg-[#DCFCE7] text-[#15803D]'
                          : 'bg-white border border-[#E5E7EB] text-[#181210] hover:bg-[#FAF9F5]'
                      }`}
                    >
                      {currentUser?.id === s.id ? 'Active Operator' : 'Switch To'}
                    </button>
                  </div>
                ))}
              </div>

              {canResetDemo && (
                <div className="pt-3 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[12px] text-[#64748B]">
                    Reset bills, stock batches, store-room inventory, staff, branches, and custom orders back to the
                    initial bakery dataset
                  </span>
                  {!confirmReset ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-[#FEE2E2] text-[#B91C1C] hover:bg-[#FEE2E2]/50 text-[12px] font-semibold shrink-0 whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Demo Data
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="px-3 py-1.5 rounded-md border border-[#E5E7EB] text-[12px] font-semibold text-[#64748B]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          resetDemoData();
                          setConfirmReset(false);
                        }}
                        className="px-3 py-1.5 rounded-md bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[12px] font-semibold whitespace-nowrap"
                      >
                        Confirm Reset
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
