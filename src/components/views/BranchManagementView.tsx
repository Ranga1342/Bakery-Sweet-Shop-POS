import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings2,
  Store,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { usePos } from '../../context/PosContext';
import { Branch, BranchOperationalSettings, BranchStatus } from '../../types/pos';
import { formatINRCompact, roundCurrency, roundPercent, TODAY_ISO } from '../../utils/formatters';

type SortField = 'branchCode' | 'name' | 'status' | 'employeeCount';

const PAGE_SIZE = 8;

const BRANCH_STATUS_BADGE: Record<BranchStatus, string> = {
  Active: 'bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0]',
  Inactive: 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]',
};

export const BranchManagementView: React.FC = () => {
  const {
    branches,
    authorizedBranches,
    staffUsers,
    orders,
    activeBranchId,
    setActiveBranchId,
    canViewAllBranches,
    currentUser,
    hasPermission,
    addBranch,
    updateBranch,
    changeBranchStatus,
    assignBranchManager,
    updateBranchOperationalSettings,
    assignStaffBranch,
    globalSearch,
  } = usePos();

  const canCreate = hasPermission('branches', 'create');
  const canEdit = hasPermission('branches', 'edit');

  const visibleBranches = useMemo(
    () => (canViewAllBranches ? branches : authorizedBranches),
    [canViewAllBranches, branches, authorizedBranches]
  );

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | BranchStatus>('ALL');
  const [managerFilter, setManagerFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('branchCode');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(
    activeBranchId || visibleBranches[0]?.id || null
  );

  // Add / Edit Branch Modal
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formManagerId, setFormManagerId] = useState('');
  const [formStatus, setFormStatus] = useState<BranchStatus>('Active');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Manager Assignment Modal
  const [managerModalBranch, setManagerModalBranch] = useState<Branch | null>(null);
  const [nextManagerId, setNextManagerId] = useState('');

  // Operational Settings Modal
  const [opsModalBranch, setOpsModalBranch] = useState<Branch | null>(null);
  const [opsDraft, setOpsDraft] = useState<BranchOperationalSettings>({
    taxRate: 5,
    packagingFee: 25,
    openingHours: '08:00 AM – 10:00 PM',
    receiptHeaderNote: '',
    receiptFooterNote: '',
  });

  // Assign Staff to Branch Modal
  const [assignStaffModalBranch, setAssignStaffModalBranch] = useState<Branch | null>(null);
  const [assignStaffId, setAssignStaffId] = useState('');
  const [assignAsPrimary, setAssignAsPrimary] = useState(false);
  const [assignStaffNote, setAssignStaffNote] = useState('');

  // Status Confirmation Dialog
  const [confirmStatusModal, setConfirmStatusModal] = useState<{
    branch: Branch;
    nextStatus: BranchStatus;
  } | null>(null);

  const managerCandidates = useMemo(
    () =>
      staffUsers.filter(
        (s) =>
          s.status === 'Active' &&
          (s.role === 'Owner' || s.role === 'Admin' || s.role === 'Manager')
      ),
    [staffUsers]
  );

  const getManagerName = (managerId?: string) =>
    staffUsers.find((s) => s.id === managerId)?.name ?? 'Unassigned';

  const getBranchStaff = (branchId: string) =>
    staffUsers.filter(
      (s) => s.primaryBranchId === branchId || s.authorizedBranchIds.includes(branchId)
    );

  // Overview stats
  const overview = useMemo(() => {
    const total = visibleBranches.length;
    const active = visibleBranches.filter((b) => b.status === 'Active').length;
    const inactive = total - active;
    const visibleIds = new Set(visibleBranches.map((b) => b.id));
    const activeEmployeesAssigned = staffUsers.filter(
      (s) =>
        s.status === 'Active' &&
        (visibleIds.has(s.primaryBranchId) ||
          s.authorizedBranchIds.some((bid) => visibleIds.has(bid)))
    ).length;
    return { total, active, inactive, activeEmployeesAssigned };
  }, [visibleBranches, staffUsers]);

  const combinedQuery = (search || globalSearch).trim().toLowerCase();

  const filteredBranches = useMemo(() => {
    const list = visibleBranches.filter((b) => {
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
      if (managerFilter === 'UNASSIGNED' && b.managerId) return false;
      if (managerFilter !== 'ALL' && managerFilter !== 'UNASSIGNED' && b.managerId !== managerFilter) {
        return false;
      }
      if (combinedQuery) {
        const mgr = getManagerName(b.managerId).toLowerCase();
        return (
          b.name.toLowerCase().includes(combinedQuery) ||
          b.branchCode.toLowerCase().includes(combinedQuery) ||
          b.address.toLowerCase().includes(combinedQuery) ||
          b.phone.toLowerCase().includes(combinedQuery) ||
          mgr.includes(combinedQuery)
        );
      }
      return true;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'branchCode') cmp = a.branchCode.localeCompare(b.branchCode);
      else if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
      else cmp = getBranchStaff(a.id).length - getBranchStaff(b.id).length;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [visibleBranches, statusFilter, managerFilter, combinedQuery, sortField, sortDir, staffUsers]);

  const totalPages = Math.max(1, Math.ceil(filteredBranches.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedBranches = filteredBranches.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectedBranch = useMemo(
    () => visibleBranches.find((b) => b.id === selectedBranchId) ?? null,
    [visibleBranches, selectedBranchId]
  );

  const selectedBranchDetails = useMemo(() => {
    if (!selectedBranch) return null;
    const assignedStaff = getBranchStaff(selectedBranch.id);
    const branchOrders = orders.filter(
      (o) => o.status === 'Completed' && (o.branchId ?? 'br-1') === selectedBranch.id
    );
    const todayRevenue = branchOrders
      .filter((o) => o.createdAt.startsWith(TODAY_ISO))
      .reduce((s, o) => s + o.grandTotal, 0);
    const totalRevenue = branchOrders.reduce((s, o) => s + o.grandTotal, 0);
    return {
      assignedStaff,
      orderCount: branchOrders.length,
      todayRevenue,
      totalRevenue,
    };
  }, [selectedBranch, staffUsers, orders]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const openAddBranch = () => {
    const nextNum = branches.length + 1;
    setEditingBranch(null);
    setFormCode(`BR-OUT-${String(nextNum).padStart(2, '0')}`);
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setFormEmail('');
    setFormManagerId('');
    setFormStatus('Active');
    setFormNotes('');
    setFormError('');
    setShowBranchModal(true);
  };

  const openEditBranch = (b: Branch) => {
    setEditingBranch(b);
    setFormCode(b.branchCode);
    setFormName(b.name);
    setFormPhone(b.phone);
    setFormAddress(b.address);
    setFormEmail(b.email ?? '');
    setFormManagerId(b.managerId ?? '');
    setFormStatus(b.status);
    setFormNotes(b.notes ?? '');
    setFormError('');
    setShowBranchModal(true);
  };

  const handleSaveBranch = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formName.trim()) {
      setFormError('Branch name is required.');
      return;
    }
    if (!formCode.trim()) {
      setFormError('Unique Branch ID is required.');
      return;
    }
    if (!formAddress.trim()) {
      setFormError('Branch address is required.');
      return;
    }

    if (editingBranch) {
      const res = updateBranch({
        ...editingBranch,
        branchCode: formCode,
        name: formName,
        phone: formPhone,
        address: formAddress,
        email: formEmail,
        managerId: formManagerId || undefined,
        status: formStatus,
        notes: formNotes,
      });
      if (!res.ok) {
        setFormError(res.error ?? 'Unable to update branch.');
        return;
      }
      setShowBranchModal(false);
    } else {
      const res = addBranch({
        branchCode: formCode,
        name: formName,
        phone: formPhone,
        address: formAddress,
        email: formEmail,
        managerId: formManagerId || undefined,
        status: formStatus,
        notes: formNotes,
      });
      if (!res.ok) {
        setFormError(res.error ?? 'Unable to create branch.');
        return;
      }
      if (res.branch) setSelectedBranchId(res.branch.id);
      setShowBranchModal(false);
    }
  };

  const openOpsModal = (b: Branch) => {
    setOpsModalBranch(b);
    setOpsDraft({ ...b.operationalSettings });
  };

  const handleSaveOps = (e: React.FormEvent) => {
    e.preventDefault();
    if (!opsModalBranch) return;
    updateBranchOperationalSettings(opsModalBranch.id, {
      ...opsDraft,
      taxRate: roundPercent(Math.max(0, opsDraft.taxRate)),
      packagingFee: roundCurrency(Math.max(0, opsDraft.packagingFee)),
    });
    setOpsModalBranch(null);
  };

  const openAssignStaffModal = (b: Branch) => {
    const unassigned = staffUsers.filter(
      (s) => s.primaryBranchId !== b.id && !s.authorizedBranchIds.includes(b.id)
    );
    setAssignStaffModalBranch(b);
    setAssignStaffId(unassigned[0]?.id ?? '');
    setAssignAsPrimary(false);
    setAssignStaffNote('');
  };

  const handleAssignStaffToBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignStaffModalBranch || !assignStaffId) return;
    const emp = staffUsers.find((s) => s.id === assignStaffId);
    if (!emp) return;
    const nextPrimary = assignAsPrimary ? assignStaffModalBranch.id : emp.primaryBranchId;
    const nextAuth = Array.from(
      new Set([...emp.authorizedBranchIds, assignStaffModalBranch.id])
    );
    const ok = assignStaffBranch({
      staffId: emp.id,
      primaryBranchId: nextPrimary,
      authorizedBranchIds: nextAuth,
      notes:
        assignStaffNote.trim() ||
        (assignAsPrimary
          ? `Transferred primary assignment to ${assignStaffModalBranch.name}`
          : `Authorized for ${assignStaffModalBranch.name}`),
    });
    if (ok) setAssignStaffModalBranch(null);
  };

  const canSwitchToSelected =
    selectedBranch &&
    (canViewAllBranches ||
      currentUser?.authorizedBranchIds.includes(selectedBranch.id));

  return (
    <div className="p-5 space-y-5 bg-[#E0E2E7] min-h-[calc(100vh-61px)]">
      {/* Branch Overview KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
          <div className="flex items-center justify-between text-[12px] text-[#64748B]">
            <span>Total Branches</span>
            <Building2 className="w-4 h-4 text-[#FB923C]" />
          </div>
          <div className="text-[22px] font-bold text-[#181210] mt-1 tabular-nums">
            {overview.total}
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">Retail &amp; kitchen outlets</div>
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
          <div className="flex items-center justify-between text-[12px] text-[#64748B]">
            <span>Active Branches</span>
            <Store className="w-4 h-4 text-[#15803D]" />
          </div>
          <div className="text-[22px] font-bold text-[#15803D] mt-1 tabular-nums">
            {overview.active}
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">Live for POS &amp; stock ops</div>
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
          <div className="flex items-center justify-between text-[12px] text-[#64748B]">
            <span>Inactive Branches</span>
            <Building2 className="w-4 h-4 text-[#64748B]" />
          </div>
          <div className="text-[22px] font-bold text-[#C2410C] mt-1 tabular-nums">
            {overview.inactive}
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">Paused from new transactions</div>
        </div>

        <div className="bg-white rounded-lg border border-[#E5E7EB] p-4">
          <div className="flex items-center justify-between text-[12px] text-[#64748B]">
            <span>Active Staff Assigned</span>
            <Users className="w-4 h-4 text-[#181210]" />
          </div>
          <div className="text-[22px] font-bold text-[#181210] mt-1 tabular-nums">
            {overview.activeEmployeesAssigned}
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">Across active &amp; shared rosters</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col xl:flex-row gap-5 items-start">
        {/* Branch Directory Table Card */}
        <div className="flex-1 min-w-0 w-full bg-white rounded-lg border border-[#E5E7EB] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#FB923C]" />
              <h2 className="text-[15px] font-semibold text-[#181210]">Branch Directory</h2>
              <span className="px-2 py-0.5 rounded bg-[#FAF9F5] border border-[#E5E7EB] text-[11px] font-semibold text-[#64748B] tabular-nums">
                {filteredBranches.length} outlets
              </span>
            </div>

            {canCreate && (
              <button
                type="button"
                onClick={openAddBranch}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[12px] font-semibold whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add Branch
              </button>
            )}
          </div>

          {/* Search & Filters */}
          <div className="px-5 py-3 border-b border-[#E5E7EB] bg-[#FAF9F5]/60 flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search branch name, code, address, or manager..."
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
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'ALL' | BranchStatus);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-md text-[12px] font-medium text-[#181210]"
              aria-label="Filter by branch status"
            >
              <option value="ALL">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <select
              value={managerFilter}
              onChange={(e) => {
                setManagerFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-white border border-[#E5E7EB] rounded-md text-[12px] font-medium text-[#181210]"
              aria-label="Filter by branch manager"
            >
              <option value="ALL">All Managers</option>
              <option value="UNASSIGNED">Unassigned Manager</option>
              {managerCandidates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#FAF9F5] text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                  <th className="py-2.5 px-4">
                    <button
                      type="button"
                      onClick={() => handleSort('branchCode')}
                      className="inline-flex items-center gap-1 hover:text-[#181210]"
                    >
                      Branch ID
                      <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3">
                    <button
                      type="button"
                      onClick={() => handleSort('name')}
                      className="inline-flex items-center gap-1 hover:text-[#181210]"
                    >
                      Branch &amp; Contact
                      <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3">Address</th>
                  <th className="py-2.5 px-3">Manager</th>
                  <th className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('employeeCount')}
                      className="inline-flex items-center gap-1 hover:text-[#181210]"
                    >
                      Staff
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
                {pagedBranches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#64748B]">
                      No branches match the selected filters.
                    </td>
                  </tr>
                ) : (
                  pagedBranches.map((b) => {
                    const isSelected = b.id === selectedBranchId;
                    const isActiveTerminal = b.id === activeBranchId;
                    const assignedCount = getBranchStaff(b.id).length;
                    const primaryCount = staffUsers.filter((s) => s.primaryBranchId === b.id).length;
                    return (
                      <tr
                        key={b.id}
                        onClick={() => setSelectedBranchId(b.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#FB923C]/8' : 'hover:bg-[#FAF9F5]'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono text-[12px] font-semibold text-[#181210] whitespace-nowrap">
                          {b.branchCode}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-[#181210] flex items-center gap-1.5">
                            <span>{b.name}</span>
                            {isActiveTerminal && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FFF7ED] border border-[#FED7AA] text-[#C2410C]">
                                Active View
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#64748B] tabular-nums">
                            {b.phone || 'Contact not set'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[12px] text-[#64748B] max-w-[230px] truncate">
                          {b.address}
                        </td>
                        <td className="py-3 px-3 text-[12px] font-medium text-[#181210]">
                          {getManagerName(b.managerId)}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          <div className="font-semibold text-[#181210]">{assignedCount}</div>
                          <div className="text-[10px] text-[#64748B]">{primaryCount} primary</div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${BRANCH_STATUS_BADGE[b.status]}`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBranchId(b.id);
                              }}
                              className="px-2 py-1 rounded border border-[#E5E7EB] bg-white hover:bg-[#FAF9F5] text-[11px] font-semibold text-[#181210]"
                            >
                              Manage
                            </button>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditBranch(b);
                                }}
                                className="p-1.5 rounded text-[#64748B] hover:text-[#181210] hover:bg-[#FAF9F5]"
                                title="Edit branch"
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
          <div className="px-5 py-3 border-t border-[#E5E7EB] flex items-center justify-between text-[12px] text-[#64748B]">
            <span className="tabular-nums">
              Page {safePage} of {totalPages} · {filteredBranches.length} branch(es)
            </span>
            <div className="flex items-center gap-1">
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
        </div>

        {/* Right Branch Detail Side Panel */}
        {selectedBranch && selectedBranchDetails && (
          <aside className="w-full xl:w-[410px] bg-white rounded-lg border border-[#E5E7EB] p-5 space-y-4 shrink-0">
            <div className="flex items-start justify-between border-b border-[#E5E7EB] pb-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold text-[#64748B]">
                    {selectedBranch.branchCode}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${BRANCH_STATUS_BADGE[selectedBranch.status]}`}
                  >
                    {selectedBranch.status}
                  </span>
                </div>
                <h3 className="text-[16px] font-bold text-[#181210] mt-1 truncate">
                  {selectedBranch.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBranchId(null)}
                className="p-1 text-[#64748B] hover:text-[#181210]"
                aria-label="Close branch details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {canSwitchToSelected && selectedBranch.id !== activeBranchId && (
              <button
                type="button"
                onClick={() => setActiveBranchId(selectedBranch.id)}
                className="w-full py-2 px-3 rounded-md bg-[#FFF7ED] border border-[#FED7AA] text-[#C2410C] hover:bg-[#FFEDD5] text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                <Store className="w-3.5 h-3.5" />
                Switch Active Terminal to {selectedBranch.name}
              </button>
            )}

            {/* Contact & Address */}
            <div className="p-3.5 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB] space-y-2 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#64748B] inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Phone
                </span>
                <span className="font-semibold text-[#181210] tabular-nums">
                  {selectedBranch.phone || 'Contact not set'}
                </span>
              </div>
              {selectedBranch.email && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#64748B] inline-flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </span>
                  <span className="font-medium text-[#181210] truncate">
                    {selectedBranch.email}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#64748B] inline-flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Hours
                </span>
                <span className="font-medium text-[#181210]">
                  {selectedBranch.operationalSettings.openingHours}
                </span>
              </div>
              <div className="pt-1.5 border-t border-[#E5E7EB] flex items-start gap-1.5 text-[#64748B]">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="text-[#181210]">{selectedBranch.address}</span>
              </div>
            </div>

            {/* Branch Revenue Snapshot */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB]">
                <div className="text-[10px] text-[#64748B]">Today Sales</div>
                <div className="text-[14px] font-bold text-[#FB923C] tabular-nums mt-0.5">
                  {formatINRCompact(selectedBranchDetails.todayRevenue)}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB]">
                <div className="text-[10px] text-[#64748B]">Total Bills</div>
                <div className="text-[14px] font-bold text-[#181210] tabular-nums mt-0.5">
                  {selectedBranchDetails.orderCount}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5E7EB]">
                <div className="text-[10px] text-[#64748B]">Total Revenue</div>
                <div className="text-[14px] font-bold text-[#181210] tabular-nums mt-0.5">
                  {formatINRCompact(selectedBranchDetails.totalRevenue)}
                </div>
              </div>
            </div>

            {/* Assigned Manager Card */}
            <div className="p-3 rounded-lg border border-[#E5E7EB] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#181210] text-white flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4 text-[#FB923C]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-[#64748B] font-semibold">
                    Branch Manager
                  </div>
                  <div className="text-[13px] font-semibold text-[#181210] truncate">
                    {getManagerName(selectedBranch.managerId)}
                  </div>
                </div>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setManagerModalBranch(selectedBranch);
                    setNextManagerId(selectedBranch.managerId ?? '');
                  }}
                  className="px-2.5 py-1 rounded border border-[#E5E7EB] bg-[#FAF9F5] hover:bg-white text-[11px] font-semibold text-[#181210] shrink-0"
                >
                  Change
                </button>
              )}
            </div>

            {/* Branch Operational Overrides */}
            <div className="p-3.5 rounded-lg border border-[#E5E7EB] bg-[#FAF9F5] space-y-2 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#181210] inline-flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-[#FB923C]" />
                  Branch Operational Defaults
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openOpsModal(selectedBranch)}
                    className="text-[11px] font-semibold text-[#FB923C] hover:text-[#F97316]"
                  >
                    Configure
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[#64748B]">Default GST:</span>{' '}
                  <strong className="tabular-nums">
                    {selectedBranch.operationalSettings.taxRate}%
                  </strong>
                </div>
                <div>
                  <span className="text-[#64748B]">Box Fee:</span>{' '}
                  <strong className="tabular-nums">
                    ₹{selectedBranch.operationalSettings.packagingFee}
                  </strong>
                </div>
              </div>
              <div className="text-[11px] text-[#64748B] truncate">
                Receipt Header: {selectedBranch.operationalSettings.receiptHeaderNote || '—'}
              </div>
            </div>

            {/* Assigned Employees List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[#181210]">
                  Assigned Employees ({selectedBranchDetails.assignedStaff.length})
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => openAssignStaffModal(selectedBranch)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FB923C] hover:text-[#F97316]"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Assign Staff
                  </button>
                )}
              </div>
              {selectedBranchDetails.assignedStaff.length === 0 ? (
                <div className="p-3 rounded-md border border-dashed border-[#E5E7EB] text-center text-[12px] text-[#64748B]">
                  No employees currently assigned to this branch.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                  {selectedBranchDetails.assignedStaff.map((emp) => {
                    const isPrimary = emp.primaryBranchId === selectedBranch.id;
                    return (
                      <div
                        key={emp.id}
                        className="p-2.5 rounded-md border border-[#E5E7EB] bg-white flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold text-[#181210] truncate">
                            {emp.name}{' '}
                            <span className="font-mono text-[10px] text-[#64748B]">
                              ({emp.employeeCode})
                            </span>
                          </div>
                          <div className="text-[11px] text-[#64748B]">
                            {emp.role} · {emp.status}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isPrimary
                                ? 'bg-[#FFF7ED] text-[#C2410C]'
                                : 'bg-[#FAF9F5] border border-[#E5E7EB] text-[#64748B]'
                            }`}
                          >
                            {isPrimary ? 'Primary' : 'Authorized'}
                          </span>
                          {canEdit && !isPrimary && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  assignStaffBranch({
                                    staffId: emp.id,
                                    primaryBranchId: selectedBranch.id,
                                    authorizedBranchIds: emp.authorizedBranchIds,
                                    notes: `Set ${selectedBranch.name} as primary branch`,
                                  })
                                }
                                className="px-1.5 py-0.5 rounded border border-[#E5E7EB] bg-[#FAF9F5] hover:bg-white text-[10px] font-semibold text-[#181210]"
                                title="Transfer primary assignment to this branch"
                              >
                                Make Primary
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  assignStaffBranch({
                                    staffId: emp.id,
                                    primaryBranchId: emp.primaryBranchId,
                                    authorizedBranchIds: emp.authorizedBranchIds.filter(
                                      (id) => id !== selectedBranch.id
                                    ),
                                    notes: `Removed secondary access to ${selectedBranch.name}`,
                                  })
                                }
                                className="p-0.5 rounded text-[#B91C1C] hover:bg-[#FEE2E2]"
                                title="Revoke additional branch access"
                                aria-label={`Revoke ${selectedBranch.name} access for ${emp.name}`}
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedBranch.notes && (
              <div className="p-3 rounded-lg bg-[#FFF7ED] border border-[#FED7AA] text-[12px] text-[#181210]">
                <div className="text-[11px] font-semibold text-[#C2410C] mb-0.5">Branch Notes</div>
                {selectedBranch.notes}
              </div>
            )}

            {/* Actions Footer */}
            {canEdit && (
              <div className="pt-3 border-t border-[#E5E7EB] grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openEditBranch(selectedBranch)}
                  className="py-2 px-3 rounded-md bg-[#181210] hover:bg-[#181210]/90 text-white text-[12px] font-semibold inline-flex items-center justify-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Branch
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfirmStatusModal({
                      branch: selectedBranch,
                      nextStatus: selectedBranch.status === 'Active' ? 'Inactive' : 'Active',
                    })
                  }
                  className={`py-2 px-3 rounded-md border text-[12px] font-semibold ${
                    selectedBranch.status === 'Active'
                      ? 'border-[#FEE2E2] text-[#B91C1C] hover:bg-[#FEE2E2]/50'
                      : 'border-[#BBF7D0] text-[#15803D] bg-[#F0FDF4] hover:bg-[#DCFCE7]'
                  }`}
                >
                  {selectedBranch.status === 'Active' ? 'Deactivate Branch' : 'Activate Branch'}
                </button>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Add / Edit Branch Modal */}
      {showBranchModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-[#181210]">
                {editingBranch ? `Edit Branch — ${editingBranch.name}` : 'Add New Branch'}
              </h3>
              <button
                type="button"
                onClick={() => setShowBranchModal(false)}
                className="text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBranch} className="p-5 overflow-y-auto space-y-4 text-[13px]">
              {formError && (
                <div className="p-3 rounded-md bg-[#FEE2E2] border border-[#FCA5A5] text-[12px] font-medium text-[#B91C1C]">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Branch Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Puducherry Main Branch"
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Branch ID (Unique) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. BR-PY-02"
                    className="w-full px-3 py-2 font-mono border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Contact Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="Enter contact number (optional)"
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="branch@rbsweetsbakery.in"
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                  Branch Address *
                </label>
                <textarea
                  rows={2}
                  required
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Locality, State, Country (e.g. Kirumambakkam, Puducherry, India)"
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Assigned Branch Manager (Optional)
                  </label>
                  <select
                    value={formManagerId}
                    onChange={(e) => setFormManagerId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
                  >
                    <option value="">Unassigned</option>
                    {managerCandidates.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Branch Status *
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as BranchStatus)}
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Kitchen setup, delivery bay info, or seasonal schedule..."
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowBranchModal(false)}
                  className="px-4 py-2 rounded-md border border-[#E5E7EB] text-[12px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[12px] font-semibold"
                >
                  {editingBranch ? 'Save Branch Changes' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Branch Manager Modal */}
      {managerModalBranch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#181210]">
                Assign Branch Manager
              </h3>
              <button
                type="button"
                onClick={() => setManagerModalBranch(null)}
                className="text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                assignBranchManager(managerModalBranch.id, nextManagerId || undefined);
                setManagerModalBranch(null);
              }}
              className="p-5 space-y-4 text-[13px]"
            >
              <div className="text-[12px] text-[#64748B]">
                Select the Manager, Admin, or Owner responsible for{' '}
                <strong className="text-[#181210]">{managerModalBranch.name}</strong>.
              </div>
              <select
                value={nextManagerId}
                onChange={(e) => setNextManagerId(e.target.value)}
                className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
              >
                <option value="">Unassigned</option>
                {managerCandidates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setManagerModalBranch(null)}
                  className="px-3.5 py-2 rounded-md border border-[#E5E7EB] text-[12px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[12px] font-semibold"
                >
                  Save Manager
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Employee to Branch Modal */}
      {assignStaffModalBranch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#181210]">
                Assign Staff to {assignStaffModalBranch.name}
              </h3>
              <button
                type="button"
                onClick={() => setAssignStaffModalBranch(null)}
                className="text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAssignStaffToBranch} className="p-5 space-y-4 text-[13px]">
              {staffUsers.filter(
                (s) =>
                  s.primaryBranchId !== assignStaffModalBranch.id &&
                  !s.authorizedBranchIds.includes(assignStaffModalBranch.id)
              ).length === 0 ? (
                <div className="text-[12px] text-[#64748B]">
                  All existing employees are already assigned or authorized for this branch.
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                      Select Employee
                    </label>
                    <select
                      value={assignStaffId}
                      onChange={(e) => setAssignStaffId(e.target.value)}
                      className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md bg-white"
                      required
                    >
                      {staffUsers
                        .filter(
                          (s) =>
                            s.primaryBranchId !== assignStaffModalBranch.id &&
                            !s.authorizedBranchIds.includes(assignStaffModalBranch.id)
                        )
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.employeeCode} · {s.role})
                          </option>
                        ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-[#181210] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignAsPrimary}
                      onChange={(e) => setAssignAsPrimary(e.target.checked)}
                      className="accent-[#FB923C]"
                    />
                    Make {assignStaffModalBranch.name} their Primary Branch (transfer)
                  </label>
                  <div>
                    <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                      Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={assignStaffNote}
                      onChange={(e) => setAssignStaffNote(e.target.value)}
                      placeholder="Reason for branch assignment"
                      className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                    />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setAssignStaffModalBranch(null)}
                  className="px-3.5 py-2 rounded-md border border-[#E5E7EB] text-[12px] font-semibold"
                >
                  Close
                </button>
                {assignStaffId && (
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[12px] font-semibold"
                  >
                    Assign Staff
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Branch Operational Settings Modal */}
      {opsModalBranch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#181210]">
                Operational Settings — {opsModalBranch.name}
              </h3>
              <button
                type="button"
                onClick={() => setOpsModalBranch(null)}
                className="text-[#64748B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveOps} className="p-5 space-y-3.5 text-[13px]">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Default GST Rate (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={28}
                    step="0.01"
                    value={opsDraft.taxRate}
                    onChange={(e) =>
                      setOpsDraft((d) => ({ ...d, taxRate: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                    Gift Box Fee (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={opsDraft.packagingFee}
                    onChange={(e) =>
                      setOpsDraft((d) => ({ ...d, packagingFee: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                  Operating Hours
                </label>
                <input
                  type="text"
                  value={opsDraft.openingHours}
                  onChange={(e) =>
                    setOpsDraft((d) => ({ ...d, openingHours: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                  Branch Receipt Header Note
                </label>
                <input
                  type="text"
                  value={opsDraft.receiptHeaderNote}
                  onChange={(e) =>
                    setOpsDraft((d) => ({ ...d, receiptHeaderNote: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#181210] mb-1">
                  Branch Receipt Footer Note
                </label>
                <textarea
                  rows={2}
                  value={opsDraft.receiptFooterNote}
                  onChange={(e) =>
                    setOpsDraft((d) => ({ ...d, receiptFooterNote: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-[#E5E7EB] rounded-md"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setOpsModalBranch(null)}
                  className="px-3.5 py-2 rounded-md border border-[#E5E7EB] text-[12px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[12px] font-semibold"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Change Confirmation Dialog */}
      {confirmStatusModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-xl w-full max-w-sm overflow-hidden p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[#FFF7ED] text-[#C2410C] flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[#181210]">
                  Confirm Branch Status Change
                </h3>
                <p className="text-[12px] text-[#64748B] mt-1">
                  Change <strong className="text-[#181210]">{confirmStatusModal.branch.name}</strong>{' '}
                  to <strong>{confirmStatusModal.nextStatus}</strong>?
                </p>
                {confirmStatusModal.nextStatus === 'Inactive' && (
                  <p className="text-[11px] text-[#C2410C] mt-1.5">
                    New POS sales and stock operations will be paused at this branch while
                    retaining all historical bills and reports.
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => setConfirmStatusModal(null)}
                className="px-3.5 py-2 rounded-md border border-[#E5E7EB] text-[12px] font-semibold text-[#181210]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  changeBranchStatus(
                    confirmStatusModal.branch.id,
                    confirmStatusModal.nextStatus
                  );
                  setConfirmStatusModal(null);
                }}
                className="px-4 py-2 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[12px] font-semibold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
