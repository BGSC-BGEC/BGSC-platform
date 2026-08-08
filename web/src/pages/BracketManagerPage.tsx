import React, { useState, useRef, useCallback, useLayoutEffect } from 'react';
import {
  Trophy,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  Save,
  ArrowLeft,
  Shield,
  FileEdit,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { SlideOverDrawer } from '../components/common/SlideOverDrawer';
import { BracketFormat, BracketRules, MatchNode } from '../types/admin';

export const BracketManagerPage: React.FC = () => {
  const {
    matches,
    updateMatchScore,
    bracketRules,
    setBracketRules,
    saveBracketState,
    setCurrentTab,
    autosaveStatus,
  } = useAdmin();

  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rulesDrawerOpen, setRulesDrawerOpen] = useState<boolean>(false);
  const [editingScoreMatch, setEditingScoreMatch] = useState<MatchNode | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState<boolean>(false);
  const [scoreT1, setScoreT1] = useState<number>(0);
  const [scoreT2, setScoreT2] = useState<number>(0);
  const [overrideReason, setOverrideReason] = useState<string>('');

  const bracketContainerRef = useRef<HTMLDivElement>(null);
  const [connectorPaths, setConnectorPaths] = useState<
    Array<{
      id: string;
      d: string;
      stroke: string;
      strokeWidth: number;
      strokeDasharray?: string;
    }>
  >([]);

  // Count complete matches
  const completedMatchesCount = matches.filter((m: MatchNode) => m.status === 'Completed').length;

  const round1Matches = matches.filter((m: MatchNode) => m.round === 1);
  const round2Matches = matches.filter((m: MatchNode) => m.round === 2);
  const round3Matches = matches.filter((m: MatchNode) => m.round === 3);

  // Dynamic Anchor & Connector Path Calculation
  const updatePaths = useCallback(() => {
    if (!bracketContainerRef.current) return;
    const container = bracketContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const scale = zoomLevel / 100;

    const getAnchor = (matchId: string) => {
      const el = container.querySelector(`[data-match-id="${matchId}"]`);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        left: (rect.left - containerRect.left) / scale,
        right: (rect.right - containerRect.left) / scale,
        top: (rect.top - containerRect.top) / scale,
        height: rect.height / scale,
        centerY: (rect.top - containerRect.top + rect.height / 2) / scale,
      };
    };

    const newPaths: Array<{
      id: string;
      d: string;
      stroke: string;
      strokeWidth: number;
      strokeDasharray?: string;
    }> = [];

    const connectPair = (
      topSourceId: string,
      bottomSourceId: string,
      targetId: string,
      isDash: boolean = false
    ) => {
      const topAnchor = getAnchor(topSourceId);
      const bottomAnchor = getAnchor(bottomSourceId);
      const targetAnchor = getAnchor(targetId);

      if (!topAnchor || !bottomAnchor || !targetAnchor) return;

      const topMatch = matches.find((m) => m.id === topSourceId);
      const bottomMatch = matches.find((m) => m.id === bottomSourceId);

      const midX = (topAnchor.right + targetAnchor.left) / 2;

      // Top feeder line
      const topAdvancing = topMatch?.status === 'Completed';
      newPaths.push({
        id: `${topSourceId}-${targetId}`,
        d: `M ${topAnchor.right} ${topAnchor.centerY} H ${midX} V ${targetAnchor.centerY} H ${targetAnchor.left}`,
        stroke: topAdvancing ? '#0D9488' : isDash ? '#475569' : '#0D9488',
        strokeWidth: topAdvancing ? 2.5 : 2,
        strokeDasharray: isDash && !topAdvancing ? '4 4' : undefined,
      });

      // Bottom feeder line
      const bottomAdvancing = bottomMatch?.status === 'Completed';
      newPaths.push({
        id: `${bottomSourceId}-${targetId}`,
        d: `M ${bottomAnchor.right} ${bottomAnchor.centerY} H ${midX} V ${targetAnchor.centerY} H ${targetAnchor.left}`,
        stroke: bottomAdvancing ? '#0D9488' : isDash ? '#475569' : '#0D9488',
        strokeWidth: bottomAdvancing ? 2.5 : 2,
        strokeDasharray: isDash && !bottomAdvancing ? '4 4' : undefined,
      });
    };

    // Connect Round 1 (#M101, #M102) -> Round 2 (#M201)
    connectPair('#M101', '#M102', '#M201');
    // Connect Round 1 (#M103, #M104) -> Round 2 (#M202)
    connectPair('#M103', '#M104', '#M202');
    // Connect Round 2 (#M201, #M202) -> Round 3 (#M301 Finals)
    connectPair('#M201', '#M202', '#M301', true);

    setConnectorPaths(newPaths);
  }, [zoomLevel, matches]);

  useLayoutEffect(() => {
    updatePaths();
    const handleResize = () => updatePaths();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(updatePaths, 60);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [updatePaths]);

  const handleOpenScoreEdit = (match: MatchNode) => {
    setEditingScoreMatch(match);
    setScoreT1(match.team1.score ?? 0);
    setScoreT2(match.team2.score ?? 0);
    setOverrideReason('');
    setOverrideModalOpen(true);
  };

  const handleConfirmScore = () => {
    if (!editingScoreMatch) return;
    updateMatchScore(editingScoreMatch.id, scoreT1, scoreT2, overrideReason);
    setOverrideModalOpen(false);
    setEditingScoreMatch(null);
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className="p-2 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-100">
                Offside Season 3 — Championship Bracket
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold">
                Live
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-mono">
                {autosaveStatus === 'saved' ? 'Autosaved' : 'Saving...'}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Visual scalable vector tournament bracket with real-time score input & dynamic progression lines.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setRulesDrawerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-650 text-slate-200 text-xs font-semibold border border-slate-600 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-teal-400" />
            <span>Configure Rules</span>
          </button>
          <button
            onClick={saveBracketState}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md shadow-teal-900/30 transition-all active:scale-95"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Bracket State</span>
          </button>
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
        {/* Left Toolbar: Format & Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Format:</span>
            <select
              value={bracketRules.format}
              onChange={(e) =>
                setBracketRules((prev: BracketRules) => ({ ...prev, format: e.target.value as BracketFormat }))
              }
              className="bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1 text-slate-200 font-semibold focus:border-teal-500 focus:outline-hidden"
            >
              <option value="Single Elimination">Single Elimination</option>
              <option value="Double Elimination">Double Elimination</option>
              <option value="Round Robin">Round Robin</option>
              <option value="Elimination after N Fails">Elimination after N Fails</option>
            </select>
          </div>

          <div className="hidden sm:flex items-center gap-2 border-l border-slate-700 pl-4">
            <span className="text-slate-400">Status:</span>
            <span className="px-2 py-0.5 rounded bg-teal-950/60 text-teal-300 font-mono font-bold border border-teal-800/40">
              {completedMatchesCount} / {matches.length} Matches Complete
            </span>
          </div>
        </div>

        {/* Right Toolbar: Zoom & Pan Controls */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium mr-1">Zoom:</span>
          <button
            onClick={() => setZoomLevel((prev) => Math.max(70, prev - 10))}
            className="p-1.5 rounded bg-slate-700 hover:bg-slate-655 text-slate-200"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-slate-200 w-12 text-center">{zoomLevel}%</span>
          <button
            onClick={() => setZoomLevel((prev) => Math.min(130, prev + 10))}
            className="p-1.5 rounded bg-slate-700 hover:bg-slate-655 text-slate-200"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(100)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-655 text-slate-200 font-medium"
            title="Reset to 100%"
          >
            <RotateCcw className="w-3 h-3 text-slate-400" />
            <span>Reset Fit</span>
          </button>
        </div>
      </div>

      {/* Interactive Bracket Vector Surface */}
      <div className="relative rounded-2xl bg-slate-900 border border-slate-700/80 p-6 overflow-x-auto shadow-2xl min-h-[580px]">
        {/* Visual Minimap in bottom-right corner */}
        <div className="absolute bottom-4 right-4 p-2 rounded-lg bg-slate-800/90 border border-slate-700 shadow-xl hidden md:flex flex-col items-center pointer-events-none z-20">
          <div className="text-[9px] font-mono text-slate-400 uppercase tracking-wider mb-1">Canvas Minimap</div>
          <div className="w-24 h-14 bg-slate-900 rounded border border-slate-700 relative flex items-center justify-between px-1">
            <div className="w-3 h-8 bg-teal-600/40 rounded-xs" />
            <div className="w-3 h-6 bg-teal-600/60 rounded-xs" />
            <div className="w-3 h-4 bg-teal-500 rounded-xs" />
            <div className="absolute inset-1 border border-teal-400/50 rounded-xs" />
          </div>
        </div>

        {/* Scalable Container */}
        <div
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left' }}
          className="transition-transform duration-150 min-w-[960px] pb-8"
        >
          {/* Round Titles */}
          <div className="grid grid-cols-3 gap-16 mb-6">
            <div className="text-center">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400">
                Round 1 (Quarter-Finals)
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Best of 3 Sets · 4 Matches</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-teal-400">
                Round 2 (Semi-Finals)
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Single Elimination · 2 Matches</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center justify-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>Championship Finals</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Grand Cup · Winner Takes 5,000 pts</div>
            </div>
          </div>

          {/* Connected SVG Progression Vector Layer & Bracket Columns */}
          <div ref={bracketContainerRef} className="relative grid grid-cols-3 gap-16 items-stretch min-h-[520px]">
            {/* Dynamic SVG Connecting Paths Layer */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
              xmlns="http://www.w3.org/2000/svg"
            >
              {connectorPaths.map((p) => (
                <path
                  key={p.id}
                  d={p.d}
                  fill="none"
                  stroke={p.stroke}
                  strokeWidth={p.strokeWidth}
                  strokeDasharray={p.strokeDasharray}
                />
              ))}
            </svg>

            {/* Column 1: Round 1 (Quarter Finals) */}
            <div className="flex flex-col justify-between space-y-8 z-10">
              {/* Pair 1 (#M101, #M102) */}
              <div className="space-y-6">
                {round1Matches.slice(0, 2).map((match: MatchNode) => (
                  <MatchNodeCard
                    key={match.id}
                    match={match}
                    onEditScore={() => handleOpenScoreEdit(match)}
                  />
                ))}
              </div>
              {/* Pair 2 (#M103, #M104) */}
              <div className="space-y-6">
                {round1Matches.slice(2, 4).map((match: MatchNode) => (
                  <MatchNodeCard
                    key={match.id}
                    match={match}
                    onEditScore={() => handleOpenScoreEdit(match)}
                  />
                ))}
              </div>
            </div>

            {/* Column 2: Round 2 (Semi Finals) */}
            <div className="flex flex-col justify-around h-full py-4 z-10">
              <div className="flex items-center justify-center">
                {round2Matches[0] && (
                  <MatchNodeCard
                    key={round2Matches[0].id}
                    match={round2Matches[0]}
                    onEditScore={() => handleOpenScoreEdit(round2Matches[0])}
                  />
                )}
              </div>
              <div className="flex items-center justify-center">
                {round2Matches[1] && (
                  <MatchNodeCard
                    key={round2Matches[1].id}
                    match={round2Matches[1]}
                    onEditScore={() => handleOpenScoreEdit(round2Matches[1])}
                  />
                )}
              </div>
            </div>

            {/* Column 3: Round 3 (Championship Finals) */}
            <div className="flex flex-col justify-center h-full z-10">
              <div className="flex items-center justify-center">
                {round3Matches[0] && (
                  <MatchNodeCard
                    key={round3Matches[0].id}
                    match={round3Matches[0]}
                    isFinals
                    onEditScore={() => handleOpenScoreEdit(round3Matches[0])}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rules Configuration Slide-Over Drawer (560px) */}
      <SlideOverDrawer
        isOpen={rulesDrawerOpen}
        onClose={() => setRulesDrawerOpen(false)}
        width="560px"
        title={
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-teal-400" />
            <span>Bracket Rules & Normalization Engine</span>
          </div>
        }
        subtitle="Configure seed topology, bye allocations, and [0, 1000] point bounds"
        footer={
          <div className="w-full flex items-center justify-between">
            <button
              onClick={() => setRulesDrawerOpen(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-650 text-slate-200 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                saveBracketState();
                setRulesDrawerOpen(false);
              }}
              className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold"
            >
              Apply Rules & Sync
            </button>
          </div>
        }
      >
        <div className="space-y-5 text-xs text-slate-200">
          {/* Rule 1: Seed Positions */}
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-2">
            <div className="font-semibold text-slate-100">Seed Placement Topology</div>
            <div className="text-slate-400 text-[11px]">
              Determines how teams (1 through 8) are paired across initial round matchups.
            </div>
            <select
              value={bracketRules.seedPositions}
              onChange={(e) =>
                setBracketRules((prev: BracketRules) => ({
                  ...prev,
                  seedPositions: e.target.value as BracketRules['seedPositions'],
                }))
              }
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-teal-500 focus:outline-hidden"
            >
              <option value="Standard Seeded">Standard Seeded (1 vs 8, 4 vs 5, 2 vs 7, 3 vs 6)</option>
              <option value="Randomized">Randomized Lottery Draw</option>
              <option value="Manual Placement">Manual Coordinator Override Placement</option>
            </select>
          </div>

          {/* Rule 2: Bye Allocation */}
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-2">
            <div className="font-semibold text-slate-100">Bye Award Policy</div>
            <div className="text-slate-400 text-[11px]">
              Governs automatic advancement when competitor bracket slots are unfilled.
            </div>
            <select
              value={bracketRules.byeAwards}
              onChange={(e) =>
                setBracketRules((prev: BracketRules) => ({
                  ...prev,
                  byeAwards: e.target.value as BracketRules['byeAwards'],
                }))
              }
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-teal-500 focus:outline-hidden"
            >
              <option value="Highest Seed First">Highest Seed First Priority (Seed 1 & 2)</option>
              <option value="Random Allocation">Random Allocation</option>
              <option value="None">None (Require Full 8 Team Roster)</option>
            </select>
          </div>

          {/* Rule 3: Score Normalization Bounds */}
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
            <div className="font-semibold text-slate-100">Score Normalization Scale [0, 1000]</div>
            <div className="text-slate-400 text-[11px]">
              Clamps numeric match scores and converts goals/points into normalized leaderboard rating points.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400">Scale Minimum</label>
                <input
                  type="number"
                  value={bracketRules.scoreScaleMin}
                  onChange={(e) =>
                    setBracketRules((prev: BracketRules) => ({
                      ...prev,
                      scoreScaleMin: Number(e.target.value),
                    }))
                  }
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-slate-200"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400">Scale Maximum</label>
                <input
                  type="number"
                  value={bracketRules.scoreScaleMax}
                  onChange={(e) =>
                    setBracketRules((prev: BracketRules) => ({
                      ...prev,
                      scoreScaleMax: Number(e.target.value),
                    }))
                  }
                  className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-slate-200"
                />
              </div>
            </div>
          </div>

          {/* Rule 4: Tie-Breaker Parameters */}
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-2">
            <div className="font-semibold text-slate-100">Tie-Breaker Rule</div>
            <select
              value={bracketRules.tieBreakerRule}
              onChange={(e) =>
                setBracketRules((prev: BracketRules) => ({
                  ...prev,
                  tieBreakerRule: e.target.value as BracketRules['tieBreakerRule'],
                }))
              }
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-teal-500 focus:outline-hidden"
            >
              <option value="Penalties">Penalties Shootout (5 Kicks)</option>
              <option value="Fair Play Points">Fair Play Points (Fewest Cards/Fouls)</option>
              <option value="Coin Toss">Official Coordinator Coin Toss</option>
            </select>
          </div>
        </div>
      </SlideOverDrawer>

      {/* Score Override Audit Justification Modal */}
      {overrideModalOpen && editingScoreMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setOverrideModalOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-teal-400" />
                <h3 className="text-base font-bold text-slate-100">
                  Update Score for {editingScoreMatch.id}
                </h3>
              </div>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-teal-400 border border-slate-700">
                {editingScoreMatch.pitch}
              </span>
            </div>

            {/* Team Score Inputs */}
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-800 border border-slate-700">
              <div className="text-center space-y-2">
                <div className="text-sm font-semibold text-slate-200">
                  ({editingScoreMatch.team1.seed}) {editingScoreMatch.team1.name}
                </div>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={scoreT1}
                  onChange={(e) => setScoreT1(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 mx-auto text-center font-mono font-extrabold text-2xl p-2 bg-slate-900 border border-slate-600 rounded-lg text-teal-300 focus:border-teal-400 focus:outline-hidden"
                />
              </div>

              <div className="text-center space-y-2">
                <div className="text-sm font-semibold text-slate-200">
                  ({editingScoreMatch.team2.seed}) {editingScoreMatch.team2.name}
                </div>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={scoreT2}
                  onChange={(e) => setScoreT2(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-20 mx-auto text-center font-mono font-extrabold text-2xl p-2 bg-slate-900 border border-slate-600 rounded-lg text-teal-300 focus:border-teal-400 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Coordinator Justification for Immutable Audit */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-teal-400" />
                <span>Coordinator Audit Justification (Required)</span>
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Official referee scorecard signed; second half extra-time goal verified."
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setOverrideModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmScore}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md shadow-teal-900/30"
              >
                Commit & Log Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Bracket Node Card Component (240px width container)
interface MatchNodeCardProps {
  match: MatchNode;
  isFinals?: boolean;
  onEditScore: () => void;
}

const MatchNodeCard: React.FC<MatchNodeCardProps> = ({ match, isFinals, onEditScore }) => {
  const isLive = match.status === 'Live';
  const isCompleted = match.status === 'Completed';

  let statusBadgeColor = 'bg-slate-700 text-slate-300';
  if (isLive) statusBadgeColor = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
  if (isCompleted) statusBadgeColor = 'bg-teal-950 text-teal-300 border border-teal-700/50';

  return (
    <div
      data-match-id={match.id}
      className={`w-60 rounded-xl bg-slate-800 border shadow-lg transition-all duration-200 relative group select-none ${
        isLive
          ? 'border-emerald-500 ring-2 ring-emerald-500/30 animate-pulse-emerald'
          : isFinals
          ? 'border-amber-500/60 ring-1 ring-amber-500/20'
          : 'border-slate-700 hover:border-slate-600'
      }`}
    >
      {/* Node Header */}
      <div className="px-3 py-2 border-b border-slate-700/80 bg-slate-850/50 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-teal-400 font-bold">{match.id}</span>
          <span className="text-slate-400 truncate">· {match.pitch}</span>
        </div>
        <span className={`px-1.5 py-0.2 rounded font-mono text-[10px] font-semibold ${statusBadgeColor}`}>
          {match.status}
        </span>
      </div>

      {/* Competitor Rows */}
      <div className="p-2.5 space-y-1.5">
        {/* Team 1 */}
        <div
          className={`flex items-center justify-between p-1.5 rounded-lg text-xs transition-colors ${
            match.team1.isWinner
              ? 'bg-teal-950/60 border border-teal-700/40 font-bold text-teal-200'
              : 'hover:bg-slate-750 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span className="text-[10px] font-mono text-slate-400">({match.team1.seed || '-'})</span>
            <span className="truncate font-medium">{match.team1.name}</span>
          </div>
          <span className="font-mono font-extrabold text-sm w-7 text-center rounded bg-slate-900/80 px-1 py-0.5 text-slate-100 shrink-0">
            {match.team1.score !== undefined ? match.team1.score : '—'}
          </span>
        </div>

        {/* Team 2 */}
        <div
          className={`flex items-center justify-between p-1.5 rounded-lg text-xs transition-colors ${
            match.team2.isWinner
              ? 'bg-teal-950/60 border border-teal-700/40 font-bold text-teal-200'
              : 'hover:bg-slate-750 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <span className="text-[10px] font-mono text-slate-400">({match.team2.seed || '-'})</span>
            <span className="truncate font-medium">{match.team2.name}</span>
          </div>
          <span className="font-mono font-extrabold text-sm w-7 text-center rounded bg-slate-900/80 px-1 py-0.5 text-slate-100 shrink-0">
            {match.team2.score !== undefined ? match.team2.score : '—'}
          </span>
        </div>
      </div>

      {/* Edit Score CTA Overlay on Hover */}
      <div className="px-3 py-1.5 border-t border-slate-700/60 bg-slate-800/90 flex items-center justify-between text-[10px] text-slate-400">
        <span className="font-mono">{match.scheduledTime}</span>
        <button
          onClick={onEditScore}
          className="text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1 transition-colors"
        >
          <FileEdit className="w-3 h-3" />
          <span>Edit Score</span>
        </button>
      </div>
    </div>
  );
};
