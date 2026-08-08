import React, { useState } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Flame,
  ChevronRight,
  Shield,
  Clock,
  Trophy,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { SlideOverDrawer } from '../components/common/SlideOverDrawer';
import { CaptainApplication } from '../types/admin';
import { formatNumber, formatPoints } from '../utils/formatters';
import { exportToCsv } from '../utils/exportCsv';

export const CaptainsPage: React.FC = () => {
  const {
    captains,
    selectedCaptainId,
    setSelectedCaptainId,
    approveCaptain,
    rejectCaptain,
  } = useAdmin();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [leagueFilter, setLeagueFilter] = useState<string>('All');
  const [sortField, setSortField] = useState<'name' | 'deviationPercent' | 'rosterCount'>('deviationPercent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [decisionReason, setDecisionReason] = useState<string>('');

  // Active selected captain for 560px drawer
  const activeCaptain = captains.find((c: CaptainApplication) => c.id === selectedCaptainId);

  // Filter and sort
  const filteredCaptains = captains
    .filter((cap: CaptainApplication) => {
      const matchesSearch =
        cap.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cap.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cap.proposedTeam.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || cap.status === statusFilter;
      const matchesLeague = leagueFilter === 'All' || cap.league === leagueFilter;
      return matchesSearch && matchesStatus && matchesLeague;
    })
    .sort((a: CaptainApplication, b: CaptainApplication) => {
      let comparison = 0;
      if (sortField === 'name') comparison = a.applicantName.localeCompare(b.applicantName);
      if (sortField === 'deviationPercent') comparison = a.deviationPercent - b.deviationPercent;
      if (sortField === 'rosterCount') comparison = a.rosterCount - b.rosterCount;
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  const handleExportCsv = () => {
    exportToCsv('captain_applications', filteredCaptains);
  };

  const handleApprove = () => {
    if (!activeCaptain) return;
    approveCaptain(activeCaptain.id, decisionReason || 'Application approved following roster review.');
    setDecisionReason('');
  };

  const handleReject = () => {
    if (!activeCaptain) return;
    rejectCaptain(activeCaptain.id, decisionReason || 'Valuation exceeds baseline parameters.');
    setDecisionReason('');
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-600/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">Captain Application & Vetting Hub</h1>
            <div className="text-xs text-slate-400 mt-0.5">
              Review captain candidate submissions, market baseline deviations, and roster eligibility.
            </div>
          </div>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-650 text-slate-200 text-xs font-semibold border border-slate-600 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-teal-400" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate name, handle, or proposed team..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:border-teal-500 focus:outline-hidden"
        >
          <option value="All">All Statuses</option>
          <option value="Approved">Approved</option>
          <option value="Pending">Pending Review</option>
          <option value="Rejected">Rejected</option>
        </select>

        {/* League filter */}
        <select
          value={leagueFilter}
          onChange={(e) => setLeagueFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:border-teal-500 focus:outline-hidden"
        >
          <option value="All">All Leagues</option>
          <option value="Offside S3">Offside S3</option>
          <option value="Airball S1">Airball S1</option>
          <option value="PowerPlay S2">PowerPlay S2</option>
        </select>

        {/* Sort */}
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as any)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:border-teal-500 focus:outline-hidden"
        >
          <option value="deviationPercent">Sort by Price Deviation</option>
          <option value="name">Sort by Name</option>
          <option value="rosterCount">Sort by Roster Count</option>
        </select>

        <button
          onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-teal-400 font-mono"
        >
          {sortOrder.toUpperCase()}
        </button>
      </div>

      {/* Table of Captains */}
      <div className="rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-850 text-[11px] font-mono uppercase text-slate-400 border-b border-slate-700">
              <tr>
                <th className="p-3">Candidate</th>
                <th className="p-3">Proposed Team & League</th>
                <th className="p-3">Roster Size</th>
                <th className="p-3">Requested Base</th>
                <th className="p-3">Market Baseline</th>
                <th className="p-3">Deviation Alert</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 font-sans">
              {filteredCaptains.map((cap: CaptainApplication) => {
                const isHighDev = cap.deviationPercent >= 20;

                let statusBadge = (
                  <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Pending
                  </span>
                );
                if (cap.status === 'Approved') {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Approved
                    </span>
                  );
                } else if (cap.status === 'Rejected') {
                  statusBadge = (
                    <span className="px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                      Rejected
                    </span>
                  );
                }

                return (
                  <tr
                    key={cap.id}
                    className="hover:bg-slate-750/70 transition-colors group cursor-pointer"
                    onClick={() => setSelectedCaptainId(cap.id)}
                  >
                    {/* Candidate */}
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={cap.avatar}
                          alt={cap.applicantName}
                          className="w-8 h-8 rounded-full object-cover border border-slate-600"
                        />
                        <div>
                          <div className="font-semibold text-slate-100">{cap.applicantName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{cap.handle}</div>
                        </div>
                      </div>
                    </td>

                    {/* Team & League */}
                    <td className="p-3">
                      <div className="font-medium text-slate-200 flex items-center gap-1.5">
                        <span>{cap.proposedTeam.crestUrl}</span>
                        <span>{cap.proposedTeam.name}</span>
                      </div>
                      <div className="text-[11px] text-teal-400 font-mono">{cap.league} · {cap.leagueType}</div>
                    </td>

                    {/* Roster Size */}
                    <td className="p-3 font-mono">
                      <span className="text-slate-100 font-bold">{cap.rosterCount}</span>
                      <span className="text-slate-400"> / {cap.rosterMax}</span>
                    </td>

                    {/* Requested Base */}
                    <td className="p-3 font-mono font-bold text-slate-100">
                      {formatPoints(cap.basePrice)}
                    </td>

                    {/* Market Baseline */}
                    <td className="p-3 font-mono text-slate-400">
                      {formatPoints(cap.marketBase)}
                    </td>

                    {/* Deviation Alert */}
                    <td className="p-3 font-mono">
                      {isHighDev ? (
                        <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 font-bold text-[10px] border border-red-800 flex items-center gap-1 w-fit">
                          <Flame className="w-3 h-3 text-red-400" />
                          +{cap.deviationPercent}% High Dev!
                        </span>
                      ) : cap.deviationPercent > 0 ? (
                        <span className="text-amber-400 text-[11px]">
                          +{cap.deviationPercent}% (Moderate)
                        </span>
                      ) : (
                        <span className="text-emerald-400 text-[11px]">
                          0% (Aligned)
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-3">{statusBadge}</td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCaptainId(cap.id);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-700 hover:bg-teal-600 hover:text-white text-slate-300 font-semibold text-xs transition-colors inline-flex items-center gap-1"
                      >
                        <span>Review</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Drawer (560px) for Captain Application Vetting */}
      {activeCaptain && (
        <SlideOverDrawer
          isOpen={!!selectedCaptainId}
          onClose={() => setSelectedCaptainId(null)}
          width="560px"
          title={
            <div className="flex items-center gap-2">
              <img
                src={activeCaptain.avatar}
                alt={activeCaptain.applicantName}
                className="w-7 h-7 rounded-full object-cover border border-slate-600"
              />
              <span>{activeCaptain.applicantName}</span>
            </div>
          }
          subtitle={`Captain Application · ${activeCaptain.proposedTeam.name} (${activeCaptain.league})`}
          footer={
            <div className="w-full flex items-center justify-between">
              <button
                onClick={handleReject}
                className="px-3.5 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                <span>Reject Application</span>
              </button>

              <button
                onClick={handleApprove}
                className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-900/30 flex items-center gap-1.5 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Approve Captain (⌘↵)</span>
              </button>
            </div>
          }
        >
          <div className="space-y-5 text-xs text-slate-200">
            {/* Price Deviation Breakdown Banner */}
            <div
              className={`p-4 rounded-xl border space-y-2 ${
                activeCaptain.deviationPercent >= 20
                  ? 'bg-red-950/40 border-red-600/50 text-red-200'
                  : 'bg-slate-800 border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-100 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-red-400" />
                  <span>Market Valuation & Deviation Analysis</span>
                </span>
                <span className="font-mono font-bold text-sm text-red-400">
                  +{activeCaptain.deviationPercent}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-slate-300 pt-1">
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-400">Requested Base Price</div>
                  <div className="text-sm font-bold font-mono text-slate-100 mt-0.5">
                    {formatPoints(activeCaptain.basePrice)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase text-slate-400">Market Baseline</div>
                  <div className="text-sm font-bold font-mono text-slate-100 mt-0.5">
                    {formatPoints(activeCaptain.marketBase)}
                  </div>
                </div>
              </div>
              {activeCaptain.deviationPercent >= 20 && (
                <div className="text-[11px] text-red-300 font-mono mt-1">
                  * Alert: Requested valuation exceeds 20% tolerance over algorithm market baseline.
                </div>
              )}
            </div>

            {/* Historical Record Grid */}
            <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
              <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>Historical Tournament Performance</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-700">
                  <div className="text-[10px] font-mono text-slate-400">Played</div>
                  <div className="font-bold font-mono text-slate-100 mt-0.5">
                    {activeCaptain.historicalRecord.tournamentsPlayed}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-700">
                  <div className="text-[10px] font-mono text-slate-400">Won</div>
                  <div className="font-bold font-mono text-emerald-400 mt-0.5">
                    {activeCaptain.historicalRecord.tournamentsWon}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-700">
                  <div className="text-[10px] font-mono text-slate-400">Win Rate</div>
                  <div className="font-bold font-mono text-teal-300 mt-0.5">
                    {activeCaptain.historicalRecord.winRate}
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-700">
                  <div className="text-[10px] font-mono text-slate-400">Exp (Yrs)</div>
                  <div className="font-bold font-mono text-slate-100 mt-0.5">
                    {activeCaptain.historicalRecord.captaincyExperienceYears}y
                  </div>
                </div>
              </div>
            </div>

            {/* Candidate Statement */}
            <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-1.5">
              <div className="font-semibold text-slate-100">Candidate Statement & Justification</div>
              <div className="text-slate-300 leading-relaxed text-xs">
                {activeCaptain.selfEvaluationNotes}
              </div>
            </div>

            {/* Roster Vetting Sub-Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-100">
                  Submitted Roster ({activeCaptain.rosterMembers.length} / {activeCaptain.rosterMax} Players)
                </span>
                <span className="text-[10px] font-mono text-teal-400">Verified Roster</span>
              </div>

              <div className="space-y-2">
                {activeCaptain.rosterMembers.map((player, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-850 border border-slate-700 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-100 flex items-center gap-2">
                        <span>{player.name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-700 text-teal-300 font-mono text-[10px]">
                          {player.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Handle: {player.handle} · Overall Rating: {player.rating}
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold">
                      ELIGIBLE
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coordinator Audit Justification input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-teal-400" />
                <span>Coordinator Decision Note (Immutable Audit Trail)</span>
              </label>
              <input
                type="text"
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="Enter justification for approval or rejection..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden"
              />
            </div>
          </div>
        </SlideOverDrawer>
      )}
    </div>
  );
};
