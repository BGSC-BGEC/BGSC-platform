import React from 'react';
import { SlideOverDrawer } from './SlideOverDrawer';
import { useAdmin } from '../../context/AdminContext';
import { History, Shield, ArrowRight, Download } from 'lucide-react';
import { exportToCsv } from '../../utils/exportCsv';

export const AuditDrawer: React.FC = () => {
  const { auditDrawerOpen, setAuditDrawerOpen, auditLogs } = useAdmin();

  const handleExport = () => {
    exportToCsv('bgsc_immutable_audit_log', auditLogs, [
      { key: 'id', label: 'Log ID' },
      { key: 'timestamp', label: 'Timestamp' },
      { key: 'actorName', label: 'Actor Name' },
      { key: 'actorRole', label: 'Actor Role' },
      { key: 'actionType', label: 'Action Type' },
      { key: 'entityId', label: 'Entity ID' },
      { key: 'details', label: 'Details' },
      { key: 'previousValue', label: 'Previous Value' },
      { key: 'newValue', label: 'New Value' },
      { key: 'reason', label: 'Coordinator Justification' },
    ]);
  };

  return (
    <SlideOverDrawer
      isOpen={auditDrawerOpen}
      onClose={() => setAuditDrawerOpen(false)}
      width="560px"
      title={
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-teal-400" />
          <span>Immutable System Audit Trail</span>
        </div>
      }
      subtitle="Cryptographically tracked log of coordinator overrides & rule engine changes"
      footer={
        <div className="w-full flex items-center justify-between">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export Audit Log (CSV)</span>
          </button>
          <button
            onClick={() => setAuditDrawerOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {auditLogs.map((entry) => (
          <div
            key={entry.id}
            className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2.5 relative"
          >
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono text-teal-400 font-bold">{entry.id}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono text-[10px]">
                  {entry.entityId}
                </span>
              </div>
              <span className="font-mono text-slate-400 text-[11px]">{entry.timestamp}</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-200">
              <Shield className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span className="font-semibold text-slate-100">{entry.actorName}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800/40">
                [{entry.actorRole}]
              </span>
            </div>

            <div className="text-xs text-slate-300 font-medium leading-relaxed">{entry.details}</div>

            {(entry.previousValue || entry.newValue) && (
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-700/80 font-mono text-xs flex items-center gap-2">
                <span className="text-red-400 line-through truncate max-w-[40%]">
                  {entry.previousValue || 'None'}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="text-emerald-400 font-bold truncate max-w-[50%]">
                  {entry.newValue || 'Updated'}
                </span>
              </div>
            )}

            {entry.reason && (
              <div className="text-[11px] text-slate-400 bg-slate-900/50 p-2 rounded border border-slate-800 italic">
                <span className="font-semibold text-slate-300 not-italic">Justification: </span>
                "{entry.reason}"
              </div>
            )}
          </div>
        ))}
      </div>
    </SlideOverDrawer>
  );
};
