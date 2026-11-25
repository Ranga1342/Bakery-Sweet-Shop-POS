import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  History,
  KeyRound,
  Lock,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  UserCog,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { usePos } from '../../context/PosContext';
import { ALL_USER_ROLES } from '../../data/seedData';
import {
  EmploymentStatus,
  NavSection,
  PermissionAction,
  StaffUser,
  UserRole,
} from '../../types/pos';
import { formatDateShort, formatDateTime, formatINRCompact, TODAY_ISO } from '../../utils/formatters';

type StaffTab = 'directory' | 'roles' | 'assignments';
type SortField = 'name' | 'employeeCode' | 'role' | 'joiningDate' | 'status';

const PAGE_SIZE = 8;

const STATUS_BADGE: Record<EmploymentStatus, string> = {
  Active: 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]',
  'On Leave': 'bg-[#FFEDD5] text-[#C2410C] border-[#FED7AA]',
  Inactive: 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]',
};

const ROLE_BADGE: Record<UserRole, string> = {
  Owner: 'bg-[#181210] text-white border-[#181210]',
  Admin: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]',
  Manager: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
  Staff: 'bg-[#FAF9F5] text-[#181210] border-[#E5E7EB]',
  'Inventory Staff': 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]',
};

const MODULE_LABELS: { id: NavSection; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'pos', label: 'POS Billing' },
  { id: 'menus', label: 'Menus & Catalog' },
  { id: 'custom_orders', label: 'Custom Orders' },
  { id: 'stock', label: 'Counter Stock' },
  { id: 'inventory', label: 'Store-Room Inventory' },
  { id: 'customers', label: 'Customers' },
  { id: 'reports', label: 'Reports & Exports' },
  { id: 'staff', label: 'Staff Management' },
  { id: 'branches', label: 'Branch Management' },
  { id: 'settings', label: 'Settings' },
];

const PERMISSION_ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: 'view', label: 'View' },
  { key: 'create', label: 'Create' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'approve', label: 'Approve' },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const StaffManagementView: React.FC = () => {
  const {
    staffUsers,
    branches,
    authorizedBranches,
    canViewAllBranches,
    orders,
    customOrders,
    currentUser,
    hasPermission,
    rolePermissions,
    updateRolePermission,
    branchAssignments,
    addStaffMember,
    updateStaffMember,
    changeStaffStatus,
    assignStaffBranch,
    toggleStaffLoginAccess,
    resetStaffCredentials,
    globalSearch,
  } = usePos();

  const canCreate = hasPermission('staff', 'create');
  const canEdit = hasPermission('staff', 'edit');

  const visibleBranches = useMemo(
    () => (canViewAllBranches ? branches : authorizedBranches),
    [canViewAllBranches, branches, authorizedBranches]
  );

  const visibleBranchIds = useMemo(
    () => new Set(visibleBranches.map((b) => b.id)),
    [visibleBranches]
  );

  const visibleStaff = useMemo(() => {
    if (canViewAllBranches) return staffUsers;
    return staffUsers.filter(
      (s) =>
        visibleBranchIds.has(s.primaryBranchId) ||
        s.authorizedBranchIds.some((bid) => visibleBranchIds.has(bid))
    );
  }, [canViewAllBranches, staffUsers, visibleBranchIds]);

  const visibleAssignments = useMemo(() => {
    if (canViewAllBranches) return branchAssignments;
    return branchAssignments.filter(
      (l) =>
        visibleBranchIds.has(l.toBranchId) ||
        (l.fromBranchId ? visibleBranchIds.has(l.fromBranchId) : false)
    );
  }, [canViewAllBranches, branchAssignments, visibleBranchIds]);

  const [tab, setTab] = useState<StaffTab>('directory');

  // Directory filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | EmploymentStatus>('ALL');
  const [sortField, setSortField] = useState<SortField>('employeeCode');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(
    staffUsers[0]?.id ?? null
  );
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Roles tab selected role
  const [selectedRoleTab, setSelectedRoleTab] = useState<UserRole>('Manager');

  // Add / Edit Employee Modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('Staff');
  const [formPrimaryBranchId, setFormPrimaryBranchId] = useState(branches[0]?.id ?? 'br-1');
  const [formAuthBranches, setFormAuthBranches] = useState<string[]>([branches[0]?.id ?? 'br-1']);
  const [formJoiningDate, setFormJoiningDate] = useState(TODAY_ISO);
  const [formStatus, setFormStatus] = useState<EmploymentStatus>('Active');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formLoginAccess, setFormLoginAccess] = useState(true);
  const [formInitialPin, setFormInitialPin] = useState('');
  const [formError, setFormError] = useState('');

  // Branch Assignment Modal
  const [branchModalStaff, setBranchModalStaff] = useState<StaffUser | null>(null);
  const [assignPrimaryId, setAssignPrimaryId] = useState('');
  const [assignAuthIds, setAssignAuthIds] = useState<string[]>([]);
  const [assignNote, setAssignNote] = useState('');

  // Account & Credentials Modal
  const [credModalStaff, setCredModalStaff] = useState<StaffUser | null>(null);
  const [credNewPin, setCredNewPin] = useState('');
  const [credRequireReset, setCredRequireReset] = useState(false);
  const [credError, setCredError] = useState('');

  // Status Confirmation Dialog
  const [confirmStatusModal, setConfirmStatusModal] = useState<{
    staff: StaffUser;
    nextStatus: EmploymentStatus;
  } | null>(null);

  const branchNameById = (id: string) =>
    branches.find((b) => b.id === id)?.name ?? 'Unassigned';

  // Overview stats
  const overview = useMemo(() => {
    const total = visibleStaff.length;
    const active = visibleStaff.filter((s) => s.status === 'Active').length;
    const inactiveOrLeave = total - active;
    const loginEnabled = visibleStaff.filter(
      (s) => s.hasLoginAccess && s.status === 'Active'
    ).length;

    const byRole = ALL_USER_ROLES.map((r) => ({
      role: r,
      count: visibleStaff.filter((s) => s.role === r).length,
    }));

    const byBranch = visibleBranches.map((b) => ({
      id: b.id,
      name: b.name,
      count: visibleStaff.filter((s) => s.primaryBranchId === b.id).length,
    }));

    return { total, active, inactiveOrLeave, loginEnabled, byRole, byBranch };
  }, [visibleStaff, visibleBranches]);

  const combinedQuery = (search || globalSearch).trim().toLowerCase();

  const filteredStaff = useMemo(() => {
    const list = visibleStaff.filter((s) => {
      if (roleFilter !== 'ALL' && s.role !== roleFilter) return false;
      if (
        branchFilter !== 'ALL' &&
        s.primaryBranchId !== branchFilter &&
        !s.authorizedBranchIds.includes(branchFilter)
      ) {
        return false;
      }
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (combinedQuery) {
        const bName = branchNameById(s.primaryBranchId).toLowerCase();
        return (
          s.name.toLowerCase().includes(combinedQuery) ||
          s.phone.toLowerCase().includes(combinedQuery) ||
          s.employeeCode.toLowerCase().includes(combinedQuery) ||
          s.role.toLowerCase().includes(combinedQuery) ||
          bName.includes(combinedQuery)
        );
      }
      return true;
    });

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'employeeCode') cmp = a.employeeCode.localeCompare(b.employeeCode);
      else if (sortField === 'role') cmp = a.role.localeCompare(b.role);
      else if (sortField === 'joiningDate') cmp = a.joiningDate.localeCompare(b.joiningDate);
      else cmp = a.status.localeCompare(b.status);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [visibleStaff, roleFilter, branchFilter, statusFilter, combinedQuery, sortField, sortDir, branches]);

  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedStaff = filteredStaff.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectedStaff = useMemo(
    () => visibleStaff.find((s) => s.id === selectedStaffId) ?? null,
    [visibleStaff, selectedStaffId]
  );

  const selectedStaffStats = useMemo(() => {
    if (!selectedStaff) return { bills: 0, sales: 0, customBooked: 0, logs: [] };
    const staffOrders = orders.filter(
      (o) =>
        o.status === 'Completed' &&
        (o.staffId === selectedStaff.id || o.cashierName === selectedStaff.name)
    );
    const bills = staffOrders.length;
    const sales = staffOrders.reduce((s, o) => s + o.grandTotal, 0);
    const customBooked = customOrders.filter(
      (co) => co.staffId === selectedStaff.id || co.createdByName === selectedStaff.name
    ).length;
    const logs = branchAssignments.filter((l) => l.staffId === selectedStaff.id);
    return { bills, sales, customBooked, logs };
  }, [selectedStaff, orders, customOrders, branchAssignments]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const openAddModal = () => {
    const nextNum = 101 + staffUsers.length;
    const defaultBranchId =
      visibleBranches.find((b) => b.status === 'Active')?.id ?? visibleBranches[0]?.id ?? 'br-1';
    setEditingStaff(null);
    setFormCode(`EMP-${nextNum}`);
    setFormName('');
    setFormPhone('');
    setFormRole('Staff');
    setFormPrimaryBranchId(defaultBranchId);
    setFormAuthBranches([defaultBranchId]);
    setFormJoiningDate(TODAY_ISO);
    setFormStatus('Active');
    setFormAddress('');
    setFormNotes('');
    setFormLoginAccess(true);
    setFormInitialPin('');
    setFormError('');
    setShowFormModal(true);
  };

  const openEditModal = (s: StaffUser) => {
    setEditingStaff(s);
    setFormCode(s.employeeCode);
    setFormName(s.name);
    setFormPhone(s.phone);
    setFormRole(s.role);
    setFormPrimaryBranchId(s.primaryBranchId);
    setFormAuthBranches(s.authorizedBranchIds);
    setFormJoiningDate(s.joiningDate);
    setFormStatus(s.status);
    setFormAddress(s.address ?? '');
    setFormNotes(s.notes ?? '');
    setFormLoginAccess(s.hasLoginAccess);
    setFormInitialPin('');
    setFormError('');
    setShowFormModal(true);
  };

  const handleSaveEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formName.trim()) {
      setFormError('Employee name is required.');
      return;
    }
    if (!formPhone.trim()) {
      setFormError('Phone number is required.');
      return;
    }
    if (!formCode.trim()) {
      setFormError('Unique Employee ID is required.');
      return;
    }
    if (!formJoiningDate) {
      setFormError('Joining date is required.');
      return;
    }

    if (editingStaff) {
      const res = updateStaffMember({
        id: editingStaff.id,
        employeeCode: formCode,
        name: formName,
        phone: formPhone,
        role: formRole,
        primaryBranchId: formPrimaryBranchId,
        authorizedBranchIds: formAuthBranches,
        joiningDate: formJoiningDate,
        status: formStatus,
        address: formAddress,
        notes: formNotes,
      });
      if (!res.ok) {
        setFormError(res.error ?? 'Unable to update employee.');
        return;
      }
      setShowFormModal(false);
    } else {
      if (formLoginAccess && formInitialPin.trim() && !/^\d{4,6}$/.test(formInitialPin.trim())) {
        setFormError('Initial terminal PIN must be 4 to 6 numeric digits.');
        return;
      }
      const res = addStaffMember({
        employeeCode: formCode,
        name: formName,
        phone: formPhone,
        role: formRole,
        primaryBranchId: formPrimaryBranchId,
        authorizedBranchIds: formAuthBranches,
        joiningDate: formJoiningDate,
        status: formStatus,
        address: formAddress,
        notes: formNotes,
        hasLoginAccess: formLoginAccess,
        initialPin: formInitialPin.trim() || undefined,
      });
      if (!res.ok) {
        setFormError(res.error ?? 'Unable to add employee.');
        return;
      }
      if (res.staff) setSelectedStaffId(res.staff.id);
      setShowFormModal(false);
    }
  };

  const openBranchAssignModal = (s: StaffUser) => {
    setBranchModalStaff(s);
    setAssignPrimaryId(s.primaryBranchId);
    setAssignAuthIds(s.authorizedBranchIds);
    setAssignNote('');
  };

  const handleSaveBranchAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchModalStaff) return;
    const ok = assignStaffBranch({
      staffId: branchModalStaff.id,
      primaryBranchId: assignPrimaryId,
      authorizedBranchIds: assignAuthIds,
      notes: assignNote,
    });
    if (ok) setBranchModalStaff(null);
  };

  const openCredModal = (s: StaffUser) => {
    setCredModalStaff(s);
    setCredNewPin('');
    setCredRequireReset(Boolean(s.mustResetPin));
    setCredError('');
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!credModalStaff) return;
    setCredError('');
    const res = resetStaffCredentials({
      staffId: credModalStaff.id,
      newPin: credNewPin,
      accessStatus: credRequireReset ? 'Invited' : 'Active',
      mustResetPin: credRequireReset,
    });
    if (!res.ok) {
      setCredError(res.error ?? 'Unable to update access credentials.');
      return;
    }
    setCredModalStaff(null);
  };

  return (
    <div className="p-3 sm:p-5 space-y-4 sm:space-y-5 bg-[#E0E2E7] min-h-[calc(100vh-65px)]">
      {/* Staff Overview KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-[12px] text-[#64748B]">
            <span>Total Employees</span>
            <Users className="w-4 h-4 text-[#FB923C]" />
          </div>
          <div className="text-[19px] sm:text-[22px] font-bold text-[#181210] mt-1 tabular-nums">
            {overview.total}
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">
            Across {visibleBranches.length} branch{visibleBranches.length === 1 ? '' : 'es'}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-[12px] text-[#64748B]">
            <span>Active Staff</span>
            <UserCheck className="w-4 h-4 text-[#15803D]" />
          </div>
          <div className="text-[19px] sm:text-[22px] font-bold text-[#15803D] mt-1 tabular-nums">
            {overview.active}
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">
            Eligible for counter shifts
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-[12px] text-[#64748B]">
            <span>Inactive / On Leave</span>
            <UserX className="w-4 h-4 text-[#C2410C]" />
          </div>
          <div className="text-[19px] sm:text-[22px] font-bold text-[#C2410C] mt-1 tabular-nums">
            {overview.inactiveOrLeave}
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">
            Terminal sign-in automatically paused
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-3.5 sm:p-4">
          <div className="flex items-center justify-between text-[12px] text-[#64748B]">
            <span>POS Login Enabled</span>
            <KeyRound className="w-4 h-4 text-[#181210]" />
          </div>
          <div className="text-[19px] sm:text-[22px] font-bold text-[#181210] mt-1 tabular-nums">
            {overview.loginEnabled}
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">
            RBAC-verified active accounts
          </div>
        </div>
      </div>

      {/* Role & Branch Distribution Strips */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-3.5 sm:p-4">
          <div className="text-[12px] font-semibold text-[#181210] mb-2.5 flex items-center justify-between">
            <span>Employees by Role</span>
            {roleFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  setRoleFilter('ALL');
                  setPage(1);
                }}
                className="text-[11px] text-[#FB923C] hover:underline font-medium"
              >
                Clear role filter
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {overview.byRole.map((item) => {
              const selected = roleFilter === item.role;
              return (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => {
                    setRoleFilter(selected ? 'ALL' : item.role);
                    setTab('directory');
                    setPage(1);
                  }}
                  className={`p-2 rounded-md border text-left transition-colors ${
                    selected
                      ? 'border-[#FB923C] bg-[#FFF7ED]'
                      : 'border-[#E5E7EB] bg-[#FAF9F5] hover:bg-white'
                  }`}
                >
                  <div className="text-[16px] font-bold text-[#181210] tabular-nums">
                    {item.count}
                  </div>
                  <div className="text-[10px] font-medium text-[#64748B] truncate">
                    {item.role}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-3.5 sm:p-4">
          <div className="text-[12px] font-semibold text-[#181210] mb-2.5 flex items-center justify-between">
            <span>Employees by Primary Branch</span>
            {branchFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  setBranchFilter('ALL');
                  setPage(1);
                }}
                className="text-[11px] text-[#FB923C] hover:underline font-medium"
              >
                Clear branch filter
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {overview.byBranch.map((b) => {
              const selected = branchFilter === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setBranchFilter(selected ? 'ALL' : b.id);
                    setTab('directory');
                    setPage(1);
                  }}
                  className={`p-2 rounded-md border text-left transition-colors flex items-center justify-between gap-2 ${
                    selected
                      ? 'border-[#FB923C] bg-[#FFF7ED]'
                      : 'border-[#E5E7EB] bg-[#FAF9F5] hover:bg-white'
                  }`}
                >
                  <span className="text-[12px] font-semibold text-[#181210] truncate">
                    {b.name}
                  </span>
                  <span className="text-[14px] font-bold text-[#FB923C] tabular-nums shrink-0">
                    {b.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Workspace */}
      <div className="flex flex-col xl:flex-row gap-4 sm:gap-5 items-start">
        {/* Left: Table / Roles / Assignment Log Card */}
        <div className="flex-1 min-w-0 w-full bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
          {/* Header Row: Navigation Tabs on Left, Action Buttons on Right */}
          <div className="px-4 sm:px-5 py-3.5 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { id: 'directory', label: `Staff Directory (${visibleStaff.length})`, icon: Users },
                  { id: 'roles', label: 'Roles & Permissions', icon: Shield },
                  {
                    id: 'assignments',
                    label: `Assignment History (${visibleAssignments.length})`,
                    icon: History,
                  },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors whitespace-nowrap ${
                      tab === t.id
                        ? 'bg-[#181210] text-white'
                        : 'bg-[#FAF9F5] border border-[#E5E7EB] text-[#181210] hover:bg-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {canCreate && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[12px] font-semibold whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add Employee
              </button>
            )}
          </div>

          {/* TAB 1: STAFF DIRECTORY */}
          {tab === 'directory' && (
            <>
              {/* Filter Bar */}
              <div className="px-4 sm:px-5 py-3 border-b border-[#E5E7EB] bg-[#FAF9F5]/60 flex flex-wrap items-center gap-2.5">
                <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Search by employee name, phone, or ID..."
                    className="w-full pl-8 pr-7 py-1.5 text-[12px] bg-white border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setPage(1);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748B]"
                      aria-label="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value as 'ALL' | UserRole);
                    setPage(1);
                  }}
                  className="flex-1 sm:flex-initial px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-md text-[12px] font-medium text-[#181210]"
                  aria-label="Filter by role"
                >
                  <option value="ALL">All Roles</option>
                  {ALL_USER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <select
                  value={branchFilter}
                  onChange={(e) => {
                    setBranchFilter(e.target.value);
                    setPage(1);
                  }}
                  className="flex-1 sm:flex-initial px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-md text-[12px] font-medium text-[#181210]"
                  aria-label="Filter by branch"
                >
                  <option value="ALL">All Branches</option>
                  {visibleBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value as 'ALL' | EmploymentStatus);
                    setPage(1);
                  }}
                  className="flex-1 sm:flex-initial px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-md text-[12px] font-medium text-[#181210]"
                  aria-label="Filter by status"
                >
                  <option value="ALL">All Status</option>
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="md:hidden divide-y divide-[#E5E7EB]">
                {pagedStaff.length === 0 ? (
                  <div className="py-10 text-center text-[13px] text-[#64748B]">
                    No employees match the active search or filters.
                  </div>
                ) : (
                  pagedStaff.map((s) => {
                    const isSelected = s.id === selectedStaffId;
                    const extraBranchCount = Math.max(0, s.authorizedBranchIds.length - 1);
                    return (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedStaffId(s.id);
                          setMobileDetailOpen(true);
                        }}
                        className={`p-3.5 space-y-2.5 cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#FB923C]/8' : 'hover:bg-[#FAF9F5]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-[#FFF7ED] border border-[#FED7AA] text-[#C2410C] text-[12px] font-bold flex items-center justify-center shrink-0">
                              {getInitials(s.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-[13px] text-[#181210] flex items-center gap-1.5 flex-wrap">
                                <span className="truncate">{s.name}</span>
                                {currentUser?.id === s.id && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#181210] text-white">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-mono text-[#64748B] tabular-nums">
                                {s.employeeCode} · {s.phone}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`inline-block px-2 py-0.5 rounded border text-[10px] font-semibold whitespace-nowrap shrink-0 ${STATUS_BADGE[s.status]}`}
                          >
                            {s.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span
                            className={`inline-block px-2 py-0.5 rounded border font-semibold ${ROLE_BADGE[s.role]}`}
                          >
                            {s.role}
                          </span>
                          <span className="text-[#181210] font-medium">
                            {branchNameById(s.primaryBranchId)}
                          </span>
                          {extraBranchCount > 0 && (
                            <span className="text-[#64748B]">+{extraBranchCount} more</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#E5E7EB]/60 text-[11px]">
                          <span className="text-[#64748B] tabular-nums">
                            Joined {formatDateShort(s.joiningDate)}
                          </span>
                          <div className="inline-flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStaffId(s.id);
                                setMobileDetailOpen(true);
                              }}
                              className="px-2.5 py-1 rounded border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[11px] font-semibold text-[#181210]"
                            >
                              Details
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(s);
                                }}
                                className="p-1.5 rounded text-[#64748B] hover:text-[#181210] hover:bg-[#FAF9F5]"
                                title="Edit employee"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[760px]">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                      <th className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleSort('employeeCode')}
                          className="inline-flex items-center gap-1 hover:text-[#181210]"
                        >
                          Employee ID
                          <ArrowDownUp className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleSort('name')}
                          className="inline-flex items-center gap-1 hover:text-[#181210]"
                        >
                          Staff Name &amp; Phone
                          <ArrowDownUp className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleSort('role')}
                          className="inline-flex items-center gap-1 hover:text-[#181210]"
                        >
                          Role
                          <ArrowDownUp className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-2.5 px-3">Assigned Branch</th>
                      <th className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleSort('joiningDate')}
                          className="inline-flex items-center gap-1 hover:text-[#181210]"
                        >
                          Joined
                          <ArrowDownUp className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleSort('status')}
                          className="inline-flex items-center gap-1 hover:text-[#181210]"
                        >
                          Status
                          <ArrowDownUp className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]/70 text-[13px]">
                    {pagedStaff.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-[#64748B]">
                          No employees match the active search or filters.
                        </td>
                      </tr>
                    ) : (
                      pagedStaff.map((s) => {
                        const isSelected = s.id === selectedStaffId;
                        const extraBranchCount = Math.max(0, s.authorizedBranchIds.length - 1);
                        return (
                          <tr
                            key={s.id}
                            onClick={() => setSelectedStaffId(s.id)}
                            className={`cursor-pointer transition-colors ${
                              isSelected ? 'bg-[#FB923C]/8' : 'hover:bg-[#FAF9F5]'
                            }`}
                          >
                            <td className="py-3 px-4 font-mono text-[12px] font-semibold text-[#181210] whitespace-nowrap">
                              {s.employeeCode}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-[#FFF7ED] border border-[#FED7AA] text-[#C2410C] text-[11px] font-bold flex items-center justify-center shrink-0">
                                  {getInitials(s.name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-[#181210] flex items-center gap-1.5">
                                    <span className="truncate">{s.name}</span>
                                    {currentUser?.id === s.id && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#181210] text-white">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-[#64748B] tabular-nums">
                                    {s.phone}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold whitespace-nowrap ${ROLE_BADGE[s.role]}`}
                              >
                                {s.role}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="text-[12px] font-medium text-[#181210]">
                                {branchNameById(s.primaryBranchId)}
                              </div>
                              {extraBranchCount > 0 && (
                                <div className="text-[11px] text-[#64748B]">
                                  +{extraBranchCount} additional branch
                                  {extraBranchCount > 1 ? 'es' : ''}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-[12px] text-[#64748B] tabular-nums whitespace-nowrap">
                              {formatDateShort(s.joiningDate)}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex flex-col items-start gap-1">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold whitespace-nowrap ${STATUS_BADGE[s.status]}`}
                                >
                                  {s.status}
                                </span>
                                <span className="text-[10px] text-[#64748B]">
                                  {s.hasLoginAccess && s.status === 'Active'
                                    ? s.accessStatus === 'Invited'
                                      ? 'Reset Pending'
                                      : 'POS Login On'
                                    : 'Login Paused'}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStaffId(s.id);
                                  }}
                                  className="px-2 py-1 rounded border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[11px] font-semibold text-[#181210]"
                                >
                                  Details
                                </button>
                                {canEdit && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditModal(s);
                                    }}
                                    className="p-1.5 rounded text-[#64748B] hover:text-[#181210] hover:bg-[#FAF9F5]"
                                    title="Edit employee"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-4 sm:px-5 py-3 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#64748B]">
                <span className="tabular-nums">
                  Page {safePage} of {totalPages} · {filteredStaff.length} staff member(s)
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded border border-[#E5E7EB] disabled:opacity-40 hover:bg-[#FAF9F5]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`px-2.5 py-1 rounded text-[12px] font-semibold tabular-nums ${
                        n === safePage
                          ? 'bg-[#FB923C] text-white'
                          : 'border border-[#E5E7EB] text-[#181210] hover:bg-[#FAF9F5]'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded border border-[#E5E7EB] disabled:opacity-40 hover:bg-[#FAF9F5]"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: ROLES & PERMISSIONS MATRIX */}
          {tab === 'roles' && (
            <div className="p-3.5 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#181210]">
                    Role-Based Access Control (RBAC) Matrix
                  </h3>
                  <p className="text-[12px] text-[#64748B]">
                    Configure module-level permissions enforced across navigation, POS billing,
                    stock approvals, and multi-branch administration.
                  </p>
                </div>
                {!canEdit && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#FAF9F5] border border-[#E5E7EB] text-[11px] font-semibold text-[#64748B]">
                    <Lock className="w-3.5 h-3.5" />
                    View Only ({currentUser?.role})
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {ALL_USER_ROLES.map((role) => {
                  const count = staffUsers.filter((s) => s.role === role).length;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRoleTab(role)}
                      className={`px-3 py-1.5 rounded-md text-[12px] font-semibold border transition-colors ${
                        selectedRoleTab === role
                          ? 'bg-[#181210] text-white border-[#181210]'
                          : 'bg-[#FAF9F5] text-[#181210] border-[#E5E7EB] hover:bg-white'
                      }`}
                    >
                      {role}{' '}
                      <span
                        className={`ml-1 tabular-nums text-[11px] ${
                          selectedRoleTab === role ? 'text-white/75' : 'text-[#64748B]'
                        }`}
                      >
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg">
                <table className="w-full text-left border-collapse min-w-[540px]">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                      <th className="py-2.5 px-4">POS Module</th>
                      {PERMISSION_ACTIONS.map((act) => (
                        <th key={act.key} className="py-2.5 px-3 text-center">
                          {act.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]/70 text-[13px]">
                    {MODULE_LABELS.map((mod) => {
                      const perms = rolePermissions[selectedRoleTab]?.[mod.id];
                      const isLockedCore =
                        selectedRoleTab === 'Owner' &&
                        (mod.id === 'staff' || mod.id === 'settings' || mod.id === 'branches');
                      return (
                        <tr key={mod.id} className="hover:bg-[#FAF9F5]/60">
                          <td className="py-2.5 px-4 font-semibold text-[#181210]">
                            {mod.label}
                            {isLockedCore && (
                              <span className="ml-2 text-[10px] font-medium text-[#64748B]">
                                (Core safeguard)
                              </span>
                            )}
                          </td>
                          {PERMISSION_ACTIONS.map((act) => {
                            const checked = Boolean(perms?.[act.key]);
                            const disabled =
                              !canEdit ||
                              (isLockedCore && (act.key === 'view' || act.key === 'edit'));
                            return (
                              <td key={act.key} className="py-2.5 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={(e) =>
                                    updateRolePermission(
                                      selectedRoleTab,
                                      mod.id,
                                      act.key,
                                      e.target.checked
                                    )
                                  }
                                  aria-label={`${selectedRoleTab} ${mod.label} ${act.label}`}
                                  className="w-4 h-4 accent-[#FB923C] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: BRANCH ASSIGNMENT LOG */}
          {tab === 'assignments' && (
            <>
              <div className="md:hidden divide-y divide-[#E5E7EB]">
                {visibleAssignments.length === 0 ? (
                  <div className="py-10 text-center text-[13px] text-[#64748B]">
                    No branch assignment changes logged yet.
                  </div>
                ) : (
                  visibleAssignments.map((log) => (
                    <div key={log.id} className="p-3.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-[13px] text-[#181210] truncate">
                            {log.staffName}
                          </div>
                          <div className="text-[11px] text-[#64748B] tabular-nums">
                            {formatDateTime(log.timestamp)}
                          </div>
                        </div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                            log.assignmentType === 'Primary'
                              ? 'bg-[#FFF7ED] text-[#C2410C]'
                              : log.assignmentType === 'Additional Access'
                              ? 'bg-[#DCFCE7] text-[#15803D]'
                              : 'bg-[#FEE2E2] text-[#B91C1C]'
                          }`}
                        >
                          {log.assignmentType}
                        </span>
                      </div>
                      <div className="text-[12px] text-[#181210]">
                        {log.fromBranchName ? (
                          <span>
                            <span className="text-[#64748B]">{log.fromBranchName}</span> &rarr;{' '}
                            <strong>{log.toBranchName}</strong>
                          </span>
                        ) : (
                          <strong>{log.toBranchName}</strong>
                        )}
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        By <span className="font-medium text-[#181210]">{log.changedBy}</span>
                        {log.notes ? ` · ${log.notes}` : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[680px]">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                      <th className="py-2.5 px-4">Date &amp; Time</th>
                      <th className="py-2.5 px-3">Employee</th>
                      <th className="py-2.5 px-3">Assignment Type</th>
                      <th className="py-2.5 px-3">Branch Change</th>
                      <th className="py-2.5 px-4">Updated By &amp; Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]/70 text-[13px]">
                    {visibleAssignments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-[#64748B]">
                          No branch assignment changes logged yet.
                        </td>
                      </tr>
                    ) : (
                      visibleAssignments.map((log) => (
                        <tr key={log.id} className="hover:bg-[#FAF9F5]/60">
                          <td className="py-3 px-4 text-[12px] text-[#64748B] tabular-nums whitespace-nowrap">
                            {formatDateTime(log.timestamp)}
                          </td>
                          <td className="py-3 px-3 font-semibold text-[#181210]">
                            {log.staffName}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                                log.assignmentType === 'Primary'
                                  ? 'bg-[#FFF7ED] text-[#C2410C]'
                                  : log.assignmentType === 'Additional Access'
                                  ? 'bg-[#DCFCE7] text-[#15803D]'
                                  : 'bg-[#FEE2E2] text-[#B91C1C]'
                              }`}
                            >
                              {log.assignmentType}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[12px] text-[#181210]">
                            {log.fromBranchName ? (
                              <span>
                                <span className="text-[#64748B]">{log.fromBranchName}</span> &rarr;{' '}
                                <strong>{log.toBranchName}</strong>
                              </span>
                            ) : (
                              <strong>{log.toBranchName}</strong>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[12px]">
                            <div className="font-medium text-[#181210]">{log.changedBy}</div>
                            {log.notes && <div className="text-[11px] text-[#64748B]">{log.notes}</div>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Right Employee Detail Side Panel */}
        {selectedStaff && (
          <>
            {mobileDetailOpen && (
              <div
                className="fixed inset-0 z-30 bg-black/40 xl:hidden"
                onClick={() => setMobileDetailOpen(false)}
              />
            )}
            <aside
              className={`${
                mobileDetailOpen
                  ? 'fixed inset-y-0 right-0 z-40 w-[min(100vw,410px)] overflow-y-auto shadow-2xl block'
                  : 'hidden'
              } xl:block xl:static xl:z-auto xl:w-[390px] xl:shadow-none bg-white xl:rounded-lg border-l xl:border border-[#E5E7EB] p-4 sm:p-5 space-y-4 shrink-0`}
            >
              <div className="flex items-start justify-between border-b border-[#E5E7EB] pb-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-[#FFF7ED] border border-[#FED7AA] text-[#C2410C] text-[14px] font-bold flex items-center justify-center shrink-0">
                    {getInitials(selectedStaff.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[16px] font-bold text-[#181210] truncate">
                        {selectedStaff.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="font-mono text-[11px] font-semibold text-[#64748B]">
                        {selectedStaff.employeeCode}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${ROLE_BADGE[selectedStaff.role]}`}
                      >
                        {selectedStaff.role}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${STATUS_BADGE[selectedStaff.status]}`}
                      >
                        {selectedStaff.status}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMobileDetailOpen(false);
                    setSelectedStaffId(null);
                  }}
                  className="p-1 text-[#64748B] hover:text-[#181210]"
                  aria-label="Close employee details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

            {/* Primary Info */}
            <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] space-y-2 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#64748B] inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Phone
                </span>
                <span className="font-semibold text-[#181210] tabular-nums">
                  {selectedStaff.phone}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#64748B] inline-flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Joining Date
                </span>
                <span className="font-medium text-[#181210] tabular-nums">
                  {formatDateShort(selectedStaff.joiningDate)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#64748B] inline-flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Primary Branch
                </span>
                <span className="font-semibold text-[#181210] text-right">
                  {branchNameById(selectedStaff.primaryBranchId)}
                </span>
              </div>
              {selectedStaff.address && (
                <div className="pt-1.5 border-t border-[#E5E7EB] flex items-start gap-1.5 text-[#64748B]">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="text-[#181210]">{selectedStaff.address}</span>
                </div>
              )}
            </div>

            {/* Authorized Branches */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[#181210]">
                  Authorized Branches ({selectedStaff.authorizedBranchIds.length})
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openBranchAssignModal(selectedStaff)}
                    className="text-[11px] font-semibold text-[#FB923C] hover:text-[#F97316]"
                  >
                    Manage Branches
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedStaff.authorizedBranchIds.map((bid) => (
                  <span
                    key={bid}
                    className={`px-2 py-1 rounded text-[11px] font-medium border ${
                      bid === selectedStaff.primaryBranchId
                        ? 'bg-[#FFF7ED] border-[#FED7AA] text-[#C2410C] font-semibold'
                        : 'bg-white border-[#E5E7EB] text-[#181210]'
                    }`}
                  >
                    {branchNameById(bid)}
                    {bid === selectedStaff.primaryBranchId ? ' (Primary)' : ''}
                  </span>
                ))}
              </div>
            </div>

            {/* Account & Login Access Status (Credentials NEVER exposed) */}
            <div className="p-3.5 rounded-lg border border-[#E5E7EB] bg-white space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#181210]">
                  <ShieldCheck className="w-4 h-4 text-[#FB923C]" />
                  POS Account &amp; Access
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    selectedStaff.hasLoginAccess && selectedStaff.status === 'Active'
                      ? 'bg-[#DCFCE7] text-[#15803D]'
                      : 'bg-[#FEE2E2] text-[#B91C1C]'
                  }`}
                >
                  {selectedStaff.hasLoginAccess && selectedStaff.status === 'Active'
                    ? selectedStaff.accessStatus === 'Invited'
                      ? 'PIN Reset Pending'
                      : 'Login Enabled'
                    : 'Login Disabled'}
                </span>
              </div>
              <p className="text-[11px] text-[#64748B]">
                {selectedStaff.status !== 'Active'
                  ? `Blocked automatically because status is ${selectedStaff.status}.`
                  : selectedStaff.hasLoginAccess
                  ? 'Credentials are encrypted/hidden. Use Reset Credentials to issue a new terminal PIN.'
                  : 'Terminal sign-in is currently turned off for this employee.'}
              </p>
              {canEdit && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openCredModal(selectedStaff)}
                    className="flex-1 py-1.5 px-2.5 rounded border border-[#E5E7EB] bg-[#FAF9F5] hover:bg-white text-[11px] font-semibold text-[#181210] inline-flex items-center justify-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#FB923C]" />
                    Reset / Set PIN
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      toggleStaffLoginAccess(selectedStaff.id, !selectedStaff.hasLoginAccess)
                    }
                    className="flex-1 py-1.5 px-2.5 rounded border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[11px] font-semibold text-[#181210]"
                  >
                    {selectedStaff.hasLoginAccess ? 'Pause Login' : 'Enable Login'}
                  </button>
                </div>
              )}
            </div>

            {/* Historical POS Output (Always preserved) */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB]">
                <div className="text-[10px] text-[#64748B]">Bills Handled</div>
                <div className="text-[15px] font-bold text-[#181210] tabular-nums mt-0.5">
                  {selectedStaffStats.bills}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB]">
                <div className="text-[10px] text-[#64748B]">Sales Volume</div>
                <div className="text-[15px] font-bold text-[#FB923C] tabular-nums mt-0.5">
                  {formatINRCompact(selectedStaffStats.sales)}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB]">
                <div className="text-[10px] text-[#64748B]">Custom Bookings</div>
                <div className="text-[15px] font-bold text-[#181210] tabular-nums mt-0.5">
                  {selectedStaffStats.customBooked}
                </div>
              </div>
            </div>

            {selectedStaff.notes && (
              <div className="p-3 rounded-lg bg-[#FFF7ED] border border-[#FED7AA] text-[12px] text-[#181210]">
                <div className="text-[11px] font-semibold text-[#C2410C] mb-0.5">Staff Notes</div>
                {selectedStaff.notes}
              </div>
            )}

            {/* Quick Role & Status Actions */}
            {canEdit && (
              <div className="pt-3 border-t border-[#E5E7EB] space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedStaff)}
                    className="py-2 px-3 rounded-md bg-[#181210] hover:bg-[#181210]/90 text-white text-[12px] font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Employee
                  </button>
                  <button
                    type="button"
                    onClick={() => openBranchAssignModal(selectedStaff)}
                    className="py-2 px-3 rounded-md border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[#181210] text-[12px] font-semibold inline-flex items-center justify-center gap-1.5"
                  >
                    <Building2 className="w-3.5 h-3.5 text-[#FB923C]" />
                    Transfer Branch
                  </button>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-[#64748B] mb-1.5">
                    Update Employment Status
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['Active', 'On Leave', 'Inactive'] as EmploymentStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={selectedStaff.status === st}
                        onClick={() =>
                          setConfirmStatusModal({ staff: selectedStaff, nextStatus: st })
                        }
                        className={`py-1.5 px-2 rounded text-[11px] font-semibold border transition-colors ${
                          selectedStaff.status === st
                            ? 'bg-[#181210] text-white border-[#181210]'
                            : 'bg-[#FAF9F5] text-[#181210] border-[#E5E7EB] hover:bg-white'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Assignment History for this employee */}
            {selectedStaffStats.logs.length > 0 && (
              <div className="pt-3 border-t border-[#E5E7EB] space-y-2">
                <div className="text-[12px] font-semibold text-[#181210] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#FB923C]" />
                  Recent Branch Assignments
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedStaffStats.logs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="p-2 rounded bg-[#FAF9F5] border border-[#E5E7EB] text-[11px]"
                    >
                      <div className="font-semibold text-[#181210]">
                        {log.assignmentType}: {log.toBranchName}
                      </div>
                      <div className="text-[#64748B]">
                        {formatDateShort(log.timestamp.slice(0, 10))} · By {log.changedBy}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
          </>
        )}
      </div>

      {/* Add / Edit Employee Modal */}
      {showFormModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-4 sm:px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <UserCog className="w-4 h-4 text-[#FB923C] shrink-0" />
                <h3 className="text-[15px] font-semibold text-[#181210] truncate">
                  {editingStaff ? `Edit Employee — ${editingStaff.name}` : 'Add New Employee'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="text-[#64748B] hover:text-[#181210]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-[13px] flex-1">
              {formError && (
                <div className="p-3 rounded-md bg-[#FEE2E2] border border-[#FCA5A5] text-[12px] font-medium text-[#B91C1C]">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Vikram Shetty"
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Employee ID (Unique) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. EMP-108"
                    className="w-full px-3 py-2 font-mono border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+91 98450 00000"
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Role / Designation *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md bg-white focus:outline-none focus:border-[#FB923C]"
                  >
                    {ALL_USER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Primary Assigned Branch *
                  </label>
                  <select
                    value={formPrimaryBranchId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setFormPrimaryBranchId(nextId);
                      setFormAuthBranches((prev) =>
                        prev.includes(nextId) ? prev : [nextId, ...prev]
                      );
                    }}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md bg-white focus:outline-none focus:border-[#FB923C]"
                  >
                    {visibleBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.branchCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Joining Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formJoiningDate}
                    onChange={(e) => setFormJoiningDate(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md tabular-nums focus:outline-none focus:border-[#FB923C]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Employment Status *
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as EmploymentStatus)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md bg-white focus:outline-none focus:border-[#FB923C]"
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="Residential locality"
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                  />
                </div>
              </div>

              {/* Additional Authorized Branches */}
              <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] space-y-2">
                <div className="text-[12px] font-semibold text-[#181210]">
                  Authorized Branches (POS &amp; Inventory Access)
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleBranches.map((b) => {
                    const isPrimary = b.id === formPrimaryBranchId;
                    const checked = isPrimary || formAuthBranches.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-[12px] cursor-pointer ${
                          checked
                            ? 'bg-white border-[#FB923C] text-[#181210] font-semibold'
                            : 'bg-white/60 border-[#E5E7EB] text-[#64748B]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isPrimary}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormAuthBranches((prev) => Array.from(new Set([...prev, b.id])));
                            } else {
                              setFormAuthBranches((prev) => prev.filter((id) => id !== b.id));
                            }
                          }}
                          className="accent-[#FB923C]"
                        />
                        {b.name}
                        {isPrimary && <span className="text-[10px] text-[#FB923C]">(Primary)</span>}
                      </label>
                    );
                  })}
                </div>
              </div>

              {!editingStaff && (
                <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[12px] font-semibold text-[#181210]">
                        POS Terminal Login Access
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        Allow employee to sign into counter terminals using a 4–6 digit PIN
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={formLoginAccess}
                      onChange={(e) => setFormLoginAccess(e.target.checked)}
                      className="w-4 h-4 accent-[#FB923C]"
                    />
                  </div>
                  {formLoginAccess && (
                    <div>
                      <label className="block text-[11px] font-semibold text-[#64748B] mb-1">
                        Initial Terminal PIN (4–6 digits; leave blank for standard onboarding)
                      </label>
                      <input
                        type="password"
                        maxLength={6}
                        value={formInitialPin}
                        onChange={(e) => setFormInitialPin(e.target.value)}
                        placeholder="Enter 4–6 digit numeric PIN"
                        className="w-full sm:w-64 px-3 py-1.5 font-mono bg-white border border-[#E5E7EB] rounded-md"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Shift preference, certifications, or handover notes..."
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="w-full sm:w-auto px-4 py-2 rounded-md border border-[#E5E7EB] text-[12px] font-semibold text-[#181210] hover:bg-[#FAF9F5]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[12px] font-semibold"
                >
                  {editingStaff ? 'Save Employee Changes' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Branch Assignment / Transfer Modal */}
      {branchModalStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-4 sm:px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between shrink-0">
              <h3 className="text-[14px] font-semibold text-[#181210] truncate pr-2">
                Branch Assignment — {branchModalStaff.name}
              </h3>
              <button
                type="button"
                onClick={() => setBranchModalStaff(null)}
                className="text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveBranchAssignment} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-[13px]">
              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                  Primary Branch
                </label>
                <select
                  value={assignPrimaryId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setAssignPrimaryId(nextId);
                    setAssignAuthIds((prev) =>
                      prev.includes(nextId) ? prev : [nextId, ...prev]
                    );
                  }}
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
                >
                  {visibleBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1.5">
                  Additional Authorized Branches
                </label>
                <div className="space-y-1.5">
                  {visibleBranches.map((b) => {
                    const isPrimary = b.id === assignPrimaryId;
                    const checked = isPrimary || assignAuthIds.includes(b.id);
                    return (
                      <label
                        key={b.id}
                        className="flex items-center justify-between p-2.5 rounded-md border border-[#E5E7EB] bg-[#FAF9F5] cursor-pointer"
                      >
                        <span className="text-[12px] font-medium text-[#181210]">
                          {b.name}{' '}
                          <span className="text-[11px] text-[#64748B]">({b.branchCode})</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isPrimary}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignAuthIds((prev) => Array.from(new Set([...prev, b.id])));
                            } else {
                              setAssignAuthIds((prev) => prev.filter((id) => id !== b.id));
                            }
                          }}
                          className="accent-[#FB923C]"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                  Transfer / Assignment Note
                </label>
                <input
                  type="text"
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  placeholder="e.g. Weekend festival counter coverage"
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setBranchModalStaff(null)}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-md border border-[#E5E7EB] text-[12px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[12px] font-semibold"
                >
                  Save Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credential Reset Modal (Never displays old PIN) */}
      {credModalStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-4 sm:px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between shrink-0">
              <h3 className="text-[14px] font-semibold text-[#181210]">
                Credential &amp; PIN Reset
              </h3>
              <button
                type="button"
                onClick={() => setCredModalStaff(null)}
                className="text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveCredentials} className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-[13px]">
              <div className="text-[12px] text-[#64748B]">
                Issue a new terminal PIN for <strong className="text-[#181210]">{credModalStaff.name}</strong> ({credModalStaff.employeeCode}). Existing credentials remain masked for security.
              </div>
              {credError && (
                <div className="p-2.5 rounded bg-[#FEE2E2] text-[#B91C1C] text-[12px] font-medium">
                  {credError}
                </div>
              )}
              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                  New Terminal PIN (4–6 numeric digits) *
                </label>
                <input
                  type="password"
                  required
                  maxLength={6}
                  value={credNewPin}
                  onChange={(e) => setCredNewPin(e.target.value)}
                  placeholder="Enter new numeric PIN"
                  className="w-full px-3 py-2 font-mono border border-[#E5E7EB] rounded-md"
                />
              </div>
              <label className="flex items-center gap-2 text-[12px] text-[#181210] cursor-pointer">
                <input
                  type="checkbox"
                  checked={credRequireReset}
                  onChange={(e) => setCredRequireReset(e.target.checked)}
                  className="accent-[#FB923C]"
                />
                Mark as reset/invite pending until next sign-in
              </label>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setCredModalStaff(null)}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-md border border-[#E5E7EB] text-[12px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[12px] font-semibold"
                >
                  Update Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Change Confirmation Dialog */}
      {confirmStatusModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-sm overflow-hidden p-4 sm:p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[#FFF7ED] text-[#C2410C] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[#181210]">
                  Confirm Status Change
                </h3>
                <p className="text-[12px] text-[#64748B] mt-1">
                  Change <strong className="text-[#181210]">{confirmStatusModal.staff.name}</strong>{' '}
                  from <strong>{confirmStatusModal.staff.status}</strong> to{' '}
                  <strong>{confirmStatusModal.nextStatus}</strong>?
                </p>
                {confirmStatusModal.nextStatus !== 'Active' && (
                  <p className="text-[11px] text-[#C2410C] mt-1.5">
                    Terminal login will be blocked immediately while preserving all past POS bills,
                    stock logs, and custom orders.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setConfirmStatusModal(null)}
                className="w-full sm:w-auto px-3.5 py-2 rounded-md border border-[#E5E7EB] text-[12px] font-semibold text-[#181210]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  changeStaffStatus(
                    confirmStatusModal.staff.id,
                    confirmStatusModal.nextStatus
                  );
                  setConfirmStatusModal(null);
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[12px] font-semibold"
              >
                Confirm Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
