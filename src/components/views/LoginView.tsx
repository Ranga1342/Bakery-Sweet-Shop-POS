import React, { useState } from 'react';
import { Croissant, Lock, ShieldAlert, Building2 } from 'lucide-react';
import { usePos } from '../../context/PosContext';

export const LoginView: React.FC = () => {
  const { staffUsers, branches, loginUser, settings } = usePos();
  const initialStaff =
    staffUsers.find((s) => s.status === 'Active' && s.hasLoginAccess) ?? staffUsers[0];
  const [selectedId, setSelectedId] = useState(initialStaff?.id ?? '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const selectedStaff = staffUsers.find((s) => s.id === selectedId);
  const branchNameById = (id: string) =>
    branches.find((b) => b.id === id)?.name ?? 'Primary Branch';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = loginUser(selectedId, pin);
    if (!res.ok) {
      setError(res.error ?? 'Authentication failed. Check your terminal PIN.');
    }
  };

  return (
    <div className="min-h-screen bg-[#E0E2E7] flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-5 sm:p-7">
        <div className="flex items-center gap-3 mb-5">
          {settings.businessLogoUrl ? (
            <div className="w-10 h-10 rounded-lg border border-[#E5E7EB] bg-[#FAF9F5] flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={settings.businessLogoUrl}
                alt={settings.businessName}
                className="w-full h-full object-contain p-1"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-[#181210] flex items-center justify-center text-[#FB923C] shrink-0">
              <Croissant className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-[17px] sm:text-[19px] font-bold text-[#181210] leading-tight truncate">
              {settings.businessName}
            </h1>
            <p className="text-[12px] text-[#64748B]">Multi-Branch POS Terminal</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#181210] mb-1.5">
              Select Staff Account
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-0.5">
              {staffUsers.map((staff) => {
                const blocked =
                  staff.status !== 'Active' ||
                  !staff.hasLoginAccess ||
                  staff.accessStatus === 'Disabled';
                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(staff.id);
                      setPin('');
                      setError('');
                    }}
                    className={`flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-md border text-left transition-colors ${
                      selectedId === staff.id
                        ? 'border-[#FB923C] bg-[#FB923C]/8 text-[#181210]'
                        : blocked
                        ? 'border-[#E5E7EB] bg-[#FAF9F5] text-[#64748B]'
                        : 'border-[#E5E7EB] hover:bg-[#FAF9F5] text-[#181210]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold truncate">{staff.name}</div>
                      <div className="text-[11px] text-[#64748B] flex items-center gap-1.5 truncate mt-0.5">
                        <span>{staff.role}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-0.5 truncate">
                          <Building2 className="w-3 h-3 shrink-0" />
                          {branchNameById(staff.primaryBranchId)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] font-mono text-[#64748B]">
                        {staff.employeeCode}
                      </span>
                      {blocked ? (
                        <span className="px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#B91C1C] text-[10px] font-semibold">
                          {staff.status !== 'Active' ? staff.status : 'Login Off'}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#15803D] text-[10px] font-semibold">
                          Active
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedStaff &&
            (selectedStaff.status !== 'Active' ||
              !selectedStaff.hasLoginAccess ||
              selectedStaff.accessStatus === 'Disabled') && (
              <div className="p-2.5 rounded-md bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-[12px] flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {selectedStaff.status !== 'Active'
                    ? `Account status is "${selectedStaff.status}". Terminal login is blocked until reactivated in Staff Management.`
                    : 'POS terminal login access is currently disabled for this staff profile.'}
                </span>
              </div>
            )}

          <div>
            <label htmlFor="staff-pin" className="block text-[12px] font-semibold text-[#181210] mb-1.5">
              Terminal PIN
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="staff-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ''));
                  setError('');
                }}
                maxLength={6}
                className="w-full pl-9 pr-3 py-2 text-[14px] font-mono bg-[#FAF9F5] border border-[#E5E7EB] rounded-md focus:outline-none focus:border-[#FB923C] focus:bg-white"
                placeholder="Enter 4–6 digit terminal PIN"
                required
              />
            </div>
            {error && <p className="text-[12px] text-[#B91C1C] mt-1.5">{error}</p>}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-md bg-[#FB923C] hover:bg-[#F97316] text-white text-[14px] font-semibold transition-colors"
          >
            Sign In to POS Terminal
          </button>
        </form>
      </div>
    </div>
  );
};
