import React, { useState } from 'react';
import {
  TicketCheck,
  Search,
  Send,
  Lock,
  Globe,
  ChevronRight,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { SlideOverDrawer } from '../components/common/SlideOverDrawer';
import { Ticket, TicketMessage } from '../types/admin';

export const TicketsPage: React.FC = () => {
  const {
    tickets,
    selectedTicketId,
    setSelectedTicketId,
    addTicketMessage,
    updateTicketStatus,
  } = useAdmin();

  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [replyContent, setReplyContent] = useState('');
  const [replyType, setReplyType] = useState<'public' | 'internal'>('public');

  const activeTicket = tickets.find((t: Ticket) => t.id === selectedTicketId);

  const filteredTickets = tickets.filter((t: Ticket) => {
    const matchesSearch =
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === 'All' || t.severity === severityFilter;
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !activeTicket) return;
    addTicketMessage(activeTicket.id, replyContent, replyType);
    setReplyContent('');
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-600/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0">
            <TicketCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">Feedback Ticket Resolution Queue</h1>
            <div className="text-xs text-slate-400 mt-0.5">
              Triage user complaints, match dispute escalations, and communicate via public or internal threads.
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
            placeholder="Search ticket ID, user, or dispute details..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden"
          />
        </div>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:border-teal-500 focus:outline-hidden"
        >
          <option value="All">All Severities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:border-teal-500 focus:outline-hidden"
        >
          <option value="All">All Statuses</option>
          <option value="Submitted">Submitted</option>
          <option value="Under Review">Under Review</option>
          <option value="Resolved">Resolved</option>
          <option value="Closed">Closed</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-850 text-[11px] font-mono uppercase text-slate-400 border-b border-slate-700">
              <tr>
                <th className="p-3">Ticket ID</th>
                <th className="p-3">User & Handle</th>
                <th className="p-3">Category</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Status</th>
                <th className="p-3">Assigned To</th>
                <th className="p-3">Submitted At</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {filteredTickets.map((t: Ticket) => {
                let sevBadge = (
                  <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-700 text-slate-300">
                    Low
                  </span>
                );
                if (t.severity === 'Critical') {
                  sevBadge = (
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">
                      CRITICAL
                    </span>
                  );
                } else if (t.severity === 'High') {
                  sevBadge = (
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                      High
                    </span>
                  );
                } else if (t.severity === 'Medium') {
                  sevBadge = (
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-800">
                      Medium
                    </span>
                  );
                }

                return (
                  <tr key={t.id} className="hover:bg-slate-750/70 transition-colors">
                    <td className="p-3 font-mono font-bold text-teal-400">{t.id}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={t.userAvatar}
                          alt={t.userName}
                          className="w-7 h-7 rounded-full object-cover border border-slate-600"
                        />
                        <div>
                          <div className="font-semibold text-slate-100">{t.userName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{t.userHandle}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 font-mono text-[10px] border border-slate-700">
                        {t.category}
                      </span>
                    </td>
                    <td className="p-3">{sevBadge}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-900 text-slate-200 font-mono text-[10px] border border-slate-700">
                        {t.status}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-300">{t.assignedTo}</td>
                    <td className="p-3 text-slate-400 font-mono text-[11px]">{t.submittedAt}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedTicketId(t.id)}
                        className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs transition-colors inline-flex items-center gap-1"
                      >
                        <span>Resolve</span>
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

      {/* Ticket Detail & Two-Way Thread Slide-Over Drawer (720px) */}
      {activeTicket && (
        <SlideOverDrawer
          isOpen={!!selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
          width="720px"
          title={
            <div className="flex items-center gap-2">
              <span className="font-mono text-teal-400 font-bold">{activeTicket.id}</span>
              <span>— {activeTicket.userName}</span>
            </div>
          }
          subtitle={`Dispute Category: ${activeTicket.category} · Priority: ${activeTicket.severity}`}
          footer={
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateTicketStatus(activeTicket.id, 'Under Review')}
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-655 text-slate-200 text-xs font-medium transition-colors"
                >
                  Under Review
                </button>
                <button
                  onClick={() => updateTicketStatus(activeTicket.id, 'Closed')}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-medium transition-colors"
                >
                  Close Ticket
                </button>
              </div>

              <button
                onClick={() => updateTicketStatus(activeTicket.id, 'Resolved')}
                className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-900/30 transition-colors"
              >
                Mark Resolved
              </button>
            </div>
          }
        >
          <div className="space-y-5 text-xs text-slate-200">
            {/* User Complaint Details Card */}
            <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={activeTicket.userAvatar}
                    alt={activeTicket.userName}
                    className="w-8 h-8 rounded-full object-cover border border-slate-600"
                  />
                  <div>
                    <span className="font-bold text-slate-100">{activeTicket.userName}</span>
                    <span className="text-[11px] text-slate-400 font-mono ml-2">
                      {activeTicket.userHandle}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-slate-400 text-[11px]">
                  Submitted {activeTicket.submittedAt}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-700/80 text-slate-200 leading-relaxed font-sans text-xs">
                {activeTicket.description}
              </div>
            </div>

            {/* Two-Way Message Thread */}
            <div className="space-y-3">
              <div className="font-semibold text-slate-300 uppercase font-mono text-[11px] tracking-wider">
                Conversation History ({activeTicket.thread.length} messages)
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {activeTicket.thread.map((msg: TicketMessage) => {
                  const isInternal = msg.type === 'internal';
                  const isAdmin = msg.senderRole === 'admin';

                  return (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-xl border space-y-1.5 ${
                        isInternal
                          ? 'bg-amber-950/20 border-amber-600/40 text-amber-200'
                          : isAdmin
                          ? 'bg-teal-950/20 border-teal-600/40 text-teal-100'
                          : 'bg-slate-800 border-slate-700 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-100">{msg.sender}</span>
                          {isInternal ? (
                            <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-300 font-mono text-[9px] border border-amber-700/50">
                              <Lock className="w-2.5 h-2.5" /> INTERNAL NOTE ONLY
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-teal-900/60 text-teal-300 font-mono text-[9px] border border-teal-700/50">
                              <Globe className="w-2.5 h-2.5" /> PUBLIC REPLY
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-slate-400 text-[10px]">{msg.timestamp}</span>
                      </div>
                      <div className="text-xs leading-relaxed">{msg.content}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reply Composer */}
            <form onSubmit={handleSendReply} className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Compose Response</span>
                {/* Reply Mode Toggle Switch */}
                <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] font-medium">
                  <button
                    type="button"
                    onClick={() => setReplyType('public')}
                    className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors ${
                      replyType === 'public'
                        ? 'bg-teal-600 text-white font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Globe className="w-3 h-3" /> Public Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => setReplyType('internal')}
                    className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors ${
                      replyType === 'internal'
                        ? 'bg-amber-600 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Lock className="w-3 h-3" /> Internal Note
                  </button>
                </div>
              </div>

              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={
                  replyType === 'public'
                    ? 'Write a public response to the user...'
                    : 'Write an internal note visible only to admins and coordinators...'
                }
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!replyContent.trim()}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send {replyType === 'public' ? 'Public Reply' : 'Internal Note'}</span>
                </button>
              </div>
            </form>
          </div>
        </SlideOverDrawer>
      )}
    </div>
  );
};
