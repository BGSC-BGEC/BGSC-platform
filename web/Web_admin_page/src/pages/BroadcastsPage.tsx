import React, { useState } from 'react';
import {
  Radio,
  Send,
  Save,
  Smartphone,
  Megaphone,
  Bell,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { BroadcastCategory, Broadcast } from '../types/admin';

export const BroadcastsPage: React.FC = () => {
  const { broadcasts, publishBroadcast, saveBroadcastDraft } = useAdmin();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<BroadcastCategory>('Leagues');
  const [audience, setAudience] = useState<string>('All Active Members');
  const [content, setContent] = useState('');
  const [bannerUrl, setBannerUrl] = useState(
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&auto=format&fit=crop&q=80'
  );
  const [sendInstantPush, setSendInstantPush] = useState(true);
  const [scheduleTime, setScheduleTime] = useState('');

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    publishBroadcast({
      title,
      category,
      audience,
      content,
      bannerUrl: bannerUrl || undefined,
      sendInstantPush,
      scheduleTime: scheduleTime || undefined,
    });

    setTitle('');
    setContent('');
    setScheduleTime('');
  };

  const handleDraft = () => {
    if (!title.trim()) return;
    saveBroadcastDraft({
      title,
      category,
      audience,
      content,
      bannerUrl: bannerUrl || undefined,
      sendInstantPush,
    });
    setTitle('');
    setContent('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">Multichannel Broadcast Engine</h1>
            <div className="text-xs text-slate-400 mt-0.5">
              Compose community announcements with 16:9 banners, targeted audience reach, and instant push delivery.
            </div>
          </div>
        </div>
      </div>

      {/* Composer Grid: Form (7 cols) & Live Preview (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Composer Form (7 cols) */}
        <form
          onSubmit={handlePublish}
          className="lg:col-span-7 p-6 rounded-2xl bg-slate-800 border border-slate-700 space-y-4 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-teal-400" />
              <span>Compose New Broadcast</span>
            </h2>
            <span className="text-[10px] font-mono text-slate-400">Multichannel Dispatcher</span>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Broadcast Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Offside S3 Championship Finals Schedule & Golden Boot Standings"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden font-medium"
              required
            />
          </div>

          {/* Audience & Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as BroadcastCategory)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-teal-500 focus:outline-hidden"
              >
                <option value="Leagues">Leagues</option>
                <option value="BGEC">BGEC (Esports)</option>
                <option value="FitSoc">FitSoc</option>
                <option value="General">General Platform</option>
                <option value="All">All Categories</option>
              </select>
            </div>

            {/* Audience */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Target Audience</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-teal-500 focus:outline-hidden"
              >
                <option value="All Active Members">All Active Members (2,450 users)</option>
                <option value="Leagues & Captains">Leagues & Captains Only (450 users)</option>
                <option value="Investors Club">Investors Club (820 users)</option>
                <option value="Esports Participants">Esports Participants (310 users)</option>
              </select>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Broadcast Body (Markdown Supported)</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter announcement details, fixture links, referee updates, or reward pool disclosures..."
              rows={4}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden leading-relaxed"
              required
            />
          </div>

          {/* 16:9 Banner URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>16:9 Header Banner Image URL</span>
              <span className="text-[10px] font-mono text-slate-400">16:9 Aspect Banner</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden font-mono"
              />
              <button
                type="button"
                onClick={() =>
                  setBannerUrl(
                    'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&auto=format&fit=crop&q=80'
                  )
                }
                className="px-2.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-teal-300 text-xs font-semibold whitespace-nowrap"
              >
                Sample Preset
              </button>
            </div>
          </div>

          {/* Delivery Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-xl bg-slate-900 border border-slate-700/80 items-center">
            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={sendInstantPush}
                onChange={(e) => setSendInstantPush(e.target.checked)}
                className="rounded bg-slate-800 border-slate-700 text-teal-600 focus:ring-0"
              />
              <span className="flex items-center gap-1.5 font-medium">
                <Bell className="w-3.5 h-3.5 text-teal-400" />
                <span>Send Instant Push Alert</span>
              </span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">Schedule:</span>
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-200"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleDraft}
              className="px-3.5 py-2 rounded-lg bg-slate-700 hover:bg-slate-650 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Draft</span>
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold shadow-lg shadow-teal-900/30 flex items-center gap-2 transition-all active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{scheduleTime ? 'Schedule Broadcast' : 'Publish Broadcast Now'}</span>
            </button>
          </div>
        </form>

        {/* Right: Live Feed Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-800 border border-slate-700 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                  Live Feed & Push Notification Preview
                </h3>
              </div>
              <span className="text-[10px] font-mono text-teal-400">Desktop & Mobile</span>
            </div>

            {/* Mobile / In-App Notification Card Mockup */}
            <div className="rounded-xl bg-slate-900 border border-slate-700 overflow-hidden shadow-2xl space-y-3 p-4">
              {/* 16:9 Banner Mockup */}
              {bannerUrl ? (
                <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                  <img
                    src={bannerUrl}
                    alt="Broadcast Banner Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur-xs text-teal-300 font-mono text-[10px] font-bold border border-teal-500/40">
                    {category}
                  </div>
                </div>
              ) : (
                <div className="aspect-video w-full rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-slate-500 text-xs">
                  16:9 Banner Preview
                </div>
              )}

              {/* Push Header */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span className="flex items-center gap-1 text-teal-400 font-bold">
                  <Megaphone className="w-3 h-3" /> BGSC Official
                </span>
                <span>Just now</span>
              </div>

              {/* Body */}
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-100">
                  {title || 'Your announcement headline will appear here...'}
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {content ||
                    'Your message body and fixtures schedule will render with responsive formatting...'}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Audience: {audience}</span>
                <span className="text-teal-400 font-semibold">Tap to view fixture</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Broadcasts Delivery Table */}
      <div className="rounded-xl bg-slate-800 border border-slate-700 overflow-hidden shadow-xl space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider font-mono">
            Recent Broadcast Deliveries & Open Rates
          </h3>
          <span className="text-xs text-slate-400 font-mono">{broadcasts.length} Sent</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-850 text-[11px] font-mono uppercase text-slate-400 border-b border-slate-700">
              <tr>
                <th className="p-3">Title</th>
                <th className="p-3">Category</th>
                <th className="p-3">Audience</th>
                <th className="p-3">Sent Date</th>
                <th className="p-3">Target Reach</th>
                <th className="p-3">Open Rate</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {broadcasts.map((b: Broadcast) => (
                <tr key={b.id} className="hover:bg-slate-750/70 transition-colors">
                  <td className="p-3 font-semibold text-slate-100 max-w-xs truncate">{b.title}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-teal-300 font-mono text-[10px] border border-slate-700">
                      {b.category}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-300">{b.audience}</td>
                  <td className="p-3 font-mono text-slate-400 text-[11px]">{b.sendDate}</td>
                  <td className="p-3 font-mono font-bold text-slate-200">
                    {b.targetReach > 0 ? `${b.targetReach} users` : '—'}
                  </td>
                  <td className="p-3 font-mono text-emerald-400 font-bold">{b.openRate}</td>
                  <td className="p-3 text-right">
                    <span
                      className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                        b.status === 'Published'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : b.status === 'Scheduled'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
