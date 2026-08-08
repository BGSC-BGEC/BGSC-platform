import React, { useState } from 'react';
import {
  Settings,
  Shield,
  CheckCircle2,
  XCircle,
  Flame,
  Key,
  Server,
  Save,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';

export const SettingsPage: React.FC = () => {
  const { userRole, addToast, addAuditLog } = useAdmin();

  // Settings State
  const [threeSeventhsEnabled, setThreeSeventhsEnabled] = useState(true);
  const [quorumThreshold, setQuorumThreshold] = useState(42.8);
  const [vetoThreshold, setVetoThreshold] = useState(71.4);
  const [auctionFreeze, setAuctionFreeze] = useState(false);
  const [liquidityLock, setLiquidityLock] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const handleSaveSettings = () => {
    addAuditLog({
      actionType: 'rule_adjustment',
      entityId: 'SYSTEM_GOVERNANCE_CONFIG',
      details: `Updated 3/7ths governance quorum (${quorumThreshold}%) and kill-switch statuses.`,
    });
    addToast({
      title: 'Governance Settings Saved',
      description: '3/7ths policy rules and security safeguards updated.',
      type: 'success',
    });
  };

  const permissionsMatrix = [
    { permission: 'View Dashboard & Leaderboards', core: true, coordinator: true, founder: true },
    { permission: 'Override Bracket Match Scores', core: true, coordinator: true, founder: true },
    { permission: 'Approve / Reject Captain Applications', core: false, coordinator: true, founder: true },
    { permission: 'Execute Live Auction Hammer SOLD', core: false, coordinator: true, founder: true },
    { permission: 'Modify Scoring Multipliers Matrix', core: false, coordinator: false, founder: true },
    { permission: 'Adjust Investment Pool Bounds', core: false, coordinator: true, founder: true },
    { permission: 'Issue User Sanctions & Bans', core: false, coordinator: true, founder: true },
    { permission: 'Emergency Platform Kill-Switch', core: false, coordinator: false, founder: true },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-600/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">
              System Settings & Governance Architecture
            </h1>
            <div className="text-xs text-slate-400 mt-0.5">
              Configure 3/7ths governance quorum policy, inspect RBAC security matrices, and manage emergency kill-switches.
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveSettings}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-900/30 transition-all active:scale-95 shrink-0"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Governance Config</span>
        </button>
      </div>

      {/* Grid: 3/7ths Policy (6 cols) & Emergency Kill-Switches (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 3/7ths Governance Policy (6 cols) */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-slate-800 border border-slate-700 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-teal-400" />
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                3/7ths Governance & Quorum Policy
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded bg-teal-950 text-teal-300 font-mono text-[10px] font-bold border border-teal-800/40">
              Active Protocol
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            The 3/7ths governance policy mandates that any fundamental rule adjustment, bracket seed reshuffle, or prize pool reallocation requires confirmation from at least 3 out of 7 designated founder and coordinator nodes.
          </p>

          <div className="space-y-3 pt-2 text-xs">
            {/* Toggle 3/7ths */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-200">Enforce 3/7ths Quorum Rule</div>
                <div className="text-[11px] text-slate-400">
                  Block unilateral coordinator overrides without multi-sig approval.
                </div>
              </div>
              <input
                type="checkbox"
                checked={threeSeventhsEnabled}
                onChange={(e) => setThreeSeventhsEnabled(e.target.checked)}
                className="h-4 w-4 rounded bg-slate-800 border-slate-700 text-teal-600 focus:ring-0 cursor-pointer"
              />
            </div>

            {/* Quorum Threshold Slider */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Quorum Approval Threshold (3/7ths)</span>
                <span className="font-mono text-teal-400 font-bold">{quorumThreshold}% (3 of 7)</span>
              </div>
              <input
                type="range"
                min="30"
                max="60"
                step="0.1"
                value={quorumThreshold}
                onChange={(e) => setQuorumThreshold(parseFloat(e.target.value))}
                className="w-full accent-teal-500 cursor-pointer"
              />
            </div>

            {/* Veto Threshold Slider */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Founder Supermajority Veto Threshold (5/7ths)</span>
                <span className="font-mono text-teal-400 font-bold">{vetoThreshold}% (5 of 7)</span>
              </div>
              <input
                type="range"
                min="60"
                max="90"
                step="0.1"
                value={vetoThreshold}
                onChange={(e) => setVetoThreshold(parseFloat(e.target.value))}
                className="w-full accent-teal-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right: Emergency Safeguards & Kill-Switches (6 cols) */}
        <div className="lg:col-span-6 p-5 rounded-2xl bg-slate-800 border border-slate-700 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                Emergency Platform Safeguards
              </h2>
            </div>
            <span className="text-[10px] font-mono text-red-400">Founder Auth Required</span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Kill switch 1: Auction Freeze */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <span>Emergency Auction Freeze</span>
                  {auctionFreeze && (
                    <span className="px-1.5 py-0.2 rounded bg-red-950 text-red-300 font-mono text-[9px] border border-red-800">
                      FROZEN
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Immediately halts all active WebSocket bidding countdowns and pauses transactions.
                </div>
              </div>
              <button
                onClick={() => setAuctionFreeze(!auctionFreeze)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  auctionFreeze
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {auctionFreeze ? 'Thaw Auction' : 'Freeze'}
              </button>
            </div>

            {/* Kill switch 2: Liquidity Lock */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-200">Lock Point Liquidity Pools</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Prevents new investments and withdrawal conversions during audit inspections.
                </div>
              </div>
              <button
                onClick={() => setLiquidityLock(!liquidityLock)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  liquidityLock
                    ? 'bg-amber-600 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {liquidityLock ? 'Unlock Pools' : 'Lock Pools'}
              </button>
            </div>

            {/* Kill switch 3: Maintenance Mode */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-200">System Maintenance Mode</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Renders standard users to maintenance splash while leaving admin console accessible.
                </div>
              </div>
              <button
                onClick={() => setMaintenanceMode(!maintenanceMode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  maintenanceMode
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                }`}
              >
                {maintenanceMode ? 'Disable' : 'Enable'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Role-Based Access Control (RBAC) Permission Matrix Table */}
      <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Role-Based Access Control (RBAC) Matrix
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Your Active Role:</span>
            <span className="px-2 py-0.5 rounded bg-teal-950 text-teal-300 font-mono text-xs font-bold border border-teal-800/40">
              [{userRole}]
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-850 text-[11px] font-mono uppercase text-slate-400 border-b border-slate-700">
              <tr>
                <th className="p-3">Permission / Capability</th>
                <th className="p-3 text-center">Core (Standard)</th>
                <th className="p-3 text-center">Coordinator</th>
                <th className="p-3 text-center">Founder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 font-sans">
              {permissionsMatrix.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-750/50">
                  <td className="p-3 font-medium text-slate-200">{row.permission}</td>
                  <td className="p-3 text-center">
                    {row.core ? (
                      <CheckCircle2 className="w-4 h-4 text-teal-400 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {row.coordinator ? (
                      <CheckCircle2 className="w-4 h-4 text-teal-400 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {row.founder ? (
                      <CheckCircle2 className="w-4 h-4 text-teal-400 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-slate-600 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cluster Node Health & Webhooks */}
      <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 space-y-3 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Infrastructure & Edge Sync Monitor
            </h3>
          </div>
          <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> 100% Operational
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 space-y-1">
            <div className="text-slate-400 text-[10px]">WebSocket Edge Node</div>
            <div className="text-slate-100 font-bold">edge-sgp-01.bgsc.internal</div>
            <div className="text-emerald-400 text-[11px]">Latency: 24ms · 0 Dropouts</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 space-y-1">
            <div className="text-slate-400 text-[10px]">Redis State Cluster</div>
            <div className="text-slate-100 font-bold">redis-replica-cluster-primary</div>
            <div className="text-emerald-400 text-[11px]">Sync: Sub-millisecond (0.01ms)</div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 space-y-1">
            <div className="text-slate-400 text-[10px]">Immutable Audit Ledger</div>
            <div className="text-slate-100 font-bold">SHA-256 Merkle Chain</div>
            <div className="text-teal-400 text-[11px]">Verified & Sealed</div>
          </div>
        </div>
      </div>
    </div>
  );
};
