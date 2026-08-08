import React, { useState } from 'react';
import {
  TrendingUp,
  Coins,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { InvestmentEvent } from '../types/admin';
import { formatPoints } from '../utils/formatters';

export const InvestmentsPage: React.FC = () => {
  const { investments, updateInvestment, addToast } = useAdmin();
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [minVal, setMinVal] = useState<number>(50);
  const [maxVal, setMaxVal] = useState<number>(500);
  const [stepVal, setStepVal] = useState<25 | 50 | 100>(50);

  const totalPool = investments.reduce((sum: number, inv: InvestmentEvent) => sum + inv.poolInvested, 0);

  const startEdit = (inv: InvestmentEvent) => {
    setEditingEventId(inv.id);
    setMinVal(inv.minInvest);
    setMaxVal(inv.maxInvest);
    setStepVal(inv.step);
  };

  const handleSaveEdit = (id: string) => {
    if (minVal > maxVal) {
      addToast({
        title: 'Validation Error',
        description: 'Minimum allowed points cannot exceed Maximum limit.',
        type: 'error',
      });
      return;
    }

    updateInvestment(id, {
      minInvest: minVal,
      maxInvest: maxVal,
      step: stepVal,
    });
    setEditingEventId(null);
  };

  const toggleEventStatus = (inv: InvestmentEvent) => {
    const nextStatus = inv.status === 'Active' ? 'Upcoming' : 'Active';
    updateInvestment(inv.id, {
      status: nextStatus,
      allowInvestment: nextStatus === 'Active',
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">Points & Investment Bounds Manager</h1>
            <div className="text-xs text-slate-400 mt-0.5">
              Control dynamic liquidity pools, min/max investor limits, step sizes, and pool safety bounds.
            </div>
          </div>
        </div>

        {/* Global Pool Summary */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 font-mono text-xs">
          <Coins className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400">Total Invested Liquidity:</span>
          <span className="text-emerald-400 font-extrabold text-sm">{formatPoints(totalPool)}</span>
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {investments.map((inv: InvestmentEvent) => {
          const isEditing = editingEventId === inv.id;

          let statusBadge = (
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
              Active Pool
            </span>
          );
          if (inv.status === 'Upcoming') {
            statusBadge = (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                Upcoming
              </span>
            );
          } else if (inv.status === 'Completed') {
            statusBadge = (
              <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-mono text-[10px] font-bold">
                Completed
              </span>
            );
          }

          return (
            <div
              key={inv.id}
              className="p-5 rounded-2xl bg-slate-800 border border-slate-700 shadow-xl space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-teal-400 font-mono text-[11px] border border-slate-700">
                    {inv.id}
                  </span>
                  {statusBadge}
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-100">{inv.eventName}</h3>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">
                    Investment Allowed: {inv.allowInvestment ? 'YES' : 'NO'}
                  </div>
                </div>

                {/* Pool Invested Banner */}
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Total Pool Staked</span>
                  <span className="font-mono font-extrabold text-teal-300 text-base">
                    {formatPoints(inv.poolInvested)}
                  </span>
                </div>

                {/* Parameter Matrix */}
                {!isEditing ? (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-slate-850 border border-slate-700">
                      <div className="text-[10px] font-mono text-slate-400">Min Pts</div>
                      <div className="font-mono font-bold text-slate-100 mt-0.5">{inv.minInvest} pts</div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-850 border border-slate-700">
                      <div className="text-[10px] font-mono text-slate-400">Max Pts</div>
                      <div className="font-mono font-bold text-slate-100 mt-0.5">{inv.maxInvest} pts</div>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-850 border border-slate-700">
                      <div className="text-[10px] font-mono text-slate-400">Step Inc</div>
                      <div className="font-mono font-bold text-slate-100 mt-0.5">+{inv.step} pts</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-900 border border-teal-500/50 space-y-2 text-xs">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] font-mono text-slate-400">Min Pts</label>
                        <input
                          type="number"
                          value={minVal}
                          onChange={(e) => setMinVal(parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-800 border border-slate-700 rounded p-1 font-mono text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400">Max Pts</label>
                        <input
                          type="number"
                          value={maxVal}
                          onChange={(e) => setMaxVal(parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-800 border border-slate-700 rounded p-1 font-mono text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400">Step Inc</label>
                        <select
                          value={stepVal}
                          onChange={(e) => setStepVal(parseInt(e.target.value) as any)}
                          className="w-full bg-slate-800 border border-slate-700 rounded p-1 font-mono text-slate-100"
                        >
                          <option value="25">25</option>
                          <option value="50">50</option>
                          <option value="100">100</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-700">
                <button
                  onClick={() => toggleEventStatus(inv)}
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-650 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  {inv.status === 'Active' ? (
                    <>
                      <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Pause Pool</span>
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Activate Pool</span>
                    </>
                  )}
                </button>

                {!isEditing ? (
                  <button
                    onClick={() => startEdit(inv)}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors"
                  >
                    Edit Bounds
                  </button>
                ) : (
                  <button
                    onClick={() => handleSaveEdit(inv.id)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
                  >
                    Save Changes
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
