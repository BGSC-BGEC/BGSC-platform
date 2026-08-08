import React, { useState } from 'react';
import {
  ShieldAlert,
  Search,
  CheckCircle2,
  Trash2,
  Ban,
  UserX,
  Shield,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { ModerationItem, SanctionType } from '../types/admin';

export const ModerationPage: React.FC = () => {
  const {
    moderationItems,
    dismissModeration,
    removeModerationContent,
    sanctionUser,
  } = useAdmin();

  const [searchQuery, setSearchQuery] = useState('');
  const [reasonFilter, setReasonFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Sanction Modal State
  const [sanctionModalItem, setSanctionModalItem] = useState<ModerationItem | null>(null);
  const [selectedSanction, setSelectedSanction] = useState<SanctionType>('Warning');
  const [sanctionNote, setSanctionNote] = useState('');

  const filteredItems = moderationItems.filter((m: ModerationItem) => {
    const matchesSearch =
      m.offender.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.offender.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.reportedContent.text && m.reportedContent.text.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesReason = reasonFilter === 'All' || m.reason === reasonFilter;
    const matchesStatus = statusFilter === 'All' || m.status === statusFilter;
    return matchesSearch && matchesReason && matchesStatus;
  });

  const handleOpenSanctionModal = (item: ModerationItem) => {
    setSanctionModalItem(item);
    setSelectedSanction('Warning');
    setSanctionNote('');
  };

  const handleConfirmSanction = () => {
    if (!sanctionModalItem) return;
    sanctionUser(sanctionModalItem.id, selectedSanction, sanctionNote || 'Regulatory violation sanctioned by coordinator.');
    setSanctionModalItem(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">Community Safety & Moderation Queue</h1>
            <div className="text-xs text-slate-400 mt-0.5">
              Review flagged content, chat abuse reports, and issue disciplinary sanctions with audit trails.
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search offender name, handle, or reported text..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden"
          />
        </div>

        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:border-teal-500 focus:outline-hidden"
        >
          <option value="All">All Violation Reasons</option>
          <option value="Harassment">Harassment</option>
          <option value="Spam">Spam</option>
          <option value="Inappropriate Content">Inappropriate Content</option>
          <option value="Cheating">Cheating</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:border-teal-500 focus:outline-hidden"
        >
          <option value="All">All Statuses</option>
          <option value="pending">Pending Review</option>
          <option value="dismissed">Dismissed</option>
          <option value="removed">Content Removed</option>
          <option value="sanctioned">Sanctioned</option>
        </select>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.map((item: ModerationItem) => {
          let statusBadge = (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
              Pending Review
            </span>
          );
          if (item.status === 'dismissed') {
            statusBadge = (
              <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-400 font-mono text-[10px]">
                Dismissed
              </span>
            );
          } else if (item.status === 'removed') {
            statusBadge = (
              <span className="px-2 py-0.5 rounded bg-amber-900/60 text-amber-300 font-mono text-[10px] border border-amber-700">
                Content Removed
              </span>
            );
          } else if (item.status === 'sanctioned') {
            statusBadge = (
              <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 font-mono text-[10px] border border-red-800">
                Sanctioned
              </span>
            );
          }

          return (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-slate-800 border border-slate-700 space-y-4 shadow-xl flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-teal-400 font-bold text-xs">{item.id}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-mono text-[10px] border border-slate-700">
                      {item.reason}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-teal-400 font-mono text-[10px]">
                      {item.contentType}
                    </span>
                    {statusBadge}
                  </div>
                </div>

                {/* Offender & Reporter Info */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-700/80 text-xs">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-slate-400">Reported User</div>
                    <div className="font-semibold text-slate-100 mt-0.5">{item.offender.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {item.offender.handle} · Flags: {item.offender.priorFlags}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase text-slate-400">Reported By</div>
                    <div className="font-medium text-slate-300 mt-0.5">{item.reporterHandle}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{item.timestamp}</div>
                  </div>
                </div>

                {/* Flagged Content Preview */}
                <div className="space-y-1">
                  <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Flagged Content</span>
                    <span className="text-slate-500">{item.reportedContent.location}</span>
                  </div>

                  {item.reportedContent.text && (
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 italic leading-relaxed">
                      "{item.reportedContent.text}"
                    </div>
                  )}

                  {item.reportedContent.mediaUrl && (
                    <div className="relative rounded-xl overflow-hidden border border-slate-700 max-h-36 bg-slate-950">
                      <img
                        src={item.reportedContent.mediaUrl}
                        alt="Reported Media"
                        className="w-full h-36 object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* Sanction Note if already sanctioned */}
                {item.sanctionNote && (
                  <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-900/50 text-[11px] text-red-300 font-mono">
                    <strong>Disciplinary Record:</strong> {item.sanctionNote}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-700">
                <button
                  onClick={() => dismissModeration(item.id)}
                  disabled={item.status !== 'pending'}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-655 disabled:opacity-40 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Dismiss</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => removeModerationContent(item.id)}
                    disabled={item.status === 'removed' || item.status === 'sanctioned'}
                    className="px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600 disabled:opacity-40 text-amber-300 hover:text-white border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Content</span>
                  </button>

                  <button
                    onClick={() => handleOpenSanctionModal(item)}
                    disabled={item.status === 'sanctioned'}
                    className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold shadow-md shadow-red-900/30 flex items-center gap-1.5 transition-colors"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Sanction User</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sanction User Disciplinary Modal */}
      {sanctionModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setSanctionModalItem(null)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserX className="w-5 h-5 text-red-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Issue Disciplinary Sanction
                </h3>
              </div>
              <span className="font-mono text-xs text-red-400 font-semibold">
                {sanctionModalItem.offender.handle}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs space-y-1">
              <div className="text-slate-400">Violation Reason:</div>
              <div className="font-semibold text-slate-100">
                {sanctionModalItem.reason} ({sanctionModalItem.contentType})
              </div>
              {sanctionModalItem.reportedContent.text && (
                <div className="text-slate-400 mt-1 italic">
                  "{sanctionModalItem.reportedContent.text}"
                </div>
              )}
            </div>

            {/* Sanction Type Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Sanction Level</label>
              <select
                value={selectedSanction}
                onChange={(e) => setSelectedSanction(e.target.value as SanctionType)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-red-500 focus:outline-hidden font-semibold"
              >
                <option value="Warning">Warning Notice (Email & In-App Alert)</option>
                <option value="1h Mute">Chat Mute (1 Hour Duration)</option>
                <option value="24h Mute">Chat Mute (24 Hours Duration)</option>
                <option value="7d Mute">Chat Mute (7 Days Duration)</option>
                <option value="Shadowban">Shadowban (Hidden Community Visibility)</option>
                <option value="Hard Ban">Permanent Hard Ban</option>
              </select>
            </div>

            {/* Mandatory Justification Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-teal-400" />
                <span>Coordinator Audit Justification (Recorded Immutably)</span>
              </label>
              <textarea
                value={sanctionNote}
                onChange={(e) => setSanctionNote(e.target.value)}
                placeholder="State the regulatory basis and evidence for this disciplinary action..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-red-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSanctionModalItem(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSanction}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-md shadow-red-900/40"
              >
                Apply Sanction & Log Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
