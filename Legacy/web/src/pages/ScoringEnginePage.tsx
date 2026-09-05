import React, { useState } from 'react';
import {
  Sliders,
  Save,
  Calculator,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useAdmin } from '../context/AdminContext';
import { EventScoringCategory, GlobalMultipliers } from '../types/admin';

export const ScoringEnginePage: React.FC = () => {
  const {
    globalMultipliers,
    setGlobalMultipliers,
    scoringCategories,
    setScoringCategories,
    scoringDirty,
    saveScoringRules,
  } = useAdmin();

  const [activeCategoryIndex, setActiveCategoryIndex] = useState<number>(0);

  // Live Formula Sandbox State
  const [simGoals, setSimGoals] = useState<number>(2);
  const [simKills, setSimKills] = useState<number>(5);
  const [simAssists, setSimAssists] = useState<number>(3);
  const [simIsStreak, setSimIsStreak] = useState<boolean>(true);
  const [simIsSponsorMatch, setSimIsSponsorMatch] = useState<boolean>(true);

  const activeCategory = scoringCategories[activeCategoryIndex] || scoringCategories[0];

  // Calculate live formula output
  const computeSandboxScore = () => {
    if (!activeCategory) return 0;
    const baseActionPts =
      simGoals * activeCategory.customSportVars.goals +
      simKills * activeCategory.customSportVars.kills +
      simAssists * activeCategory.customSportVars.assists +
      activeCategory.firstPlace;

    let mult = 1.0;
    if (simIsSponsorMatch) mult *= globalMultipliers.sponsorWin;
    if (simIsStreak) mult *= globalMultipliers.dailyStreak;

    return Math.round(baseActionPts * mult);
  };

  const handleUpdateCategoryVars = (
    field: keyof EventScoringCategory['customSportVars'],
    value: number
  ) => {
    setScoringCategories((prev: EventScoringCategory[]) =>
      prev.map((cat: EventScoringCategory, idx: number) =>
        idx === activeCategoryIndex
          ? {
              ...cat,
              customSportVars: {
                ...cat.customSportVars,
                [field]: value,
              },
            }
          : cat
      )
    );
  };

  const handleUpdatePlacement = (
    field: 'participation' | 'firstPlace' | 'secondPlace' | 'thirdPlace',
    value: number
  ) => {
    setScoringCategories((prev: EventScoringCategory[]) =>
      prev.map((cat: EventScoringCategory, idx: number) =>
        idx === activeCategoryIndex ? { ...cat, [field]: value } : cat
      )
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-slate-800 border border-slate-700 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100">
              Scoring Engine & Multiplier Configurator
            </h1>
            <div className="text-xs text-slate-400 mt-0.5">
              Tune platform multiplier matrix, sport-specific base scoring parameters, and test with live sandbox.
            </div>
          </div>
        </div>

        <button
          onClick={saveScoringRules}
          disabled={!scoringDirty}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-all active:scale-95 shrink-0 ${
            scoringDirty
              ? 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-900/30'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-70'
          }`}
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Scoring Rules (⌘S)</span>
        </button>
      </div>

      {/* Unsaved Changes Floating Bar */}
      {scoringDirty && (
        <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-600/50 text-amber-300 text-xs flex items-center justify-between animate-in fade-in duration-150">
          <span className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Unsaved modifications detected in multipliers or category formulas.
          </span>
          <button
            onClick={saveScoringRules}
            className="px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold font-mono text-[11px]"
          >
            Apply Now
          </button>
        </div>
      )}

      {/* Main Grid: Multiplier Matrix (6 cols) & Category Formula Matrix (6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Global Multiplier Matrix (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Global Multipliers Matrix
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Applies across all events</span>
            </div>

            <div className="space-y-4 text-xs">
              {/* Multiplier 1: Sponsor Win */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Sponsor Win Multiplier</span>
                  <span className="font-mono text-teal-400 font-extrabold text-sm">
                    {globalMultipliers.sponsorWin.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="3.0"
                  step="0.05"
                  value={globalMultipliers.sponsorWin}
                  onChange={(e) =>
                    setGlobalMultipliers((prev: GlobalMultipliers) => ({
                      ...prev,
                      sponsorWin: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-teal-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>1.00x (Neutral)</span>
                  <span>2.00x</span>
                  <span>3.00x (Max)</span>
                </div>
              </div>

              {/* Multiplier 2: Daily Streak */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Daily Streak Multiplier</span>
                  <span className="font-mono text-teal-400 font-extrabold text-sm">
                    {globalMultipliers.dailyStreak.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="2.0"
                  step="0.05"
                  value={globalMultipliers.dailyStreak}
                  onChange={(e) =>
                    setGlobalMultipliers((prev: GlobalMultipliers) => ({
                      ...prev,
                      dailyStreak: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-teal-500 cursor-pointer"
                />
              </div>

              {/* Multiplier 3: Podium Streak */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Podium Streak Multiplier</span>
                  <span className="font-mono text-teal-400 font-extrabold text-sm">
                    {globalMultipliers.podiumStreak.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="2.0"
                  step="0.05"
                  value={globalMultipliers.podiumStreak}
                  onChange={(e) =>
                    setGlobalMultipliers((prev: GlobalMultipliers) => ({
                      ...prev,
                      podiumStreak: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full accent-teal-500 cursor-pointer"
                />
              </div>

              {/* Bonus 4: Challenge Legend Flat Bonus */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Challenge Legend Flat Bonus</span>
                  <span className="font-mono text-teal-400 font-extrabold text-sm">
                    +{globalMultipliers.challengeLegendFlatBonus} pts
                  </span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="500"
                  step="25"
                  value={globalMultipliers.challengeLegendFlatBonus}
                  onChange={(e) =>
                    setGlobalMultipliers((prev: GlobalMultipliers) => ({
                      ...prev,
                      challengeLegendFlatBonus: parseInt(e.target.value),
                    }))
                  }
                  className="w-full accent-teal-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Sport Category Formulas & Sandbox Calculator (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-800 border border-slate-700 overflow-x-auto">
            {scoringCategories.map((cat: EventScoringCategory, idx: number) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeCategoryIndex === idx
                    ? 'bg-teal-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                {cat.categoryName}
              </button>
            ))}
          </div>

          {/* Category Base Point Settings */}
          {activeCategory && (
            <div className="p-5 rounded-2xl bg-slate-800 border border-slate-700 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  {activeCategory.categoryName} Scoring Formula
                </h3>
                <span className="text-[10px] font-mono text-teal-400">Active Preset</span>
              </div>

              {/* Placement Points Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700">
                  <label className="text-[10px] font-mono text-slate-400">1st Place</label>
                  <input
                    type="number"
                    value={activeCategory.firstPlace}
                    onChange={(e) => handleUpdatePlacement('firstPlace', parseInt(e.target.value) || 0)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-1.5 font-mono font-bold text-teal-300"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700">
                  <label className="text-[10px] font-mono text-slate-400">2nd Place</label>
                  <input
                    type="number"
                    value={activeCategory.secondPlace}
                    onChange={(e) => handleUpdatePlacement('secondPlace', parseInt(e.target.value) || 0)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-1.5 font-mono font-bold text-teal-300"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700">
                  <label className="text-[10px] font-mono text-slate-400">3rd Place</label>
                  <input
                    type="number"
                    value={activeCategory.thirdPlace}
                    onChange={(e) => handleUpdatePlacement('thirdPlace', parseInt(e.target.value) || 0)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-1.5 font-mono font-bold text-teal-300"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700">
                  <label className="text-[10px] font-mono text-slate-400">Participation</label>
                  <input
                    type="number"
                    value={activeCategory.participation}
                    onChange={(e) => handleUpdatePlacement('participation', parseInt(e.target.value) || 0)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-1.5 font-mono font-bold text-slate-200"
                  />
                </div>
              </div>

              {/* Custom Sport Variable Points */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700">
                  <label className="text-[10px] font-mono text-slate-400">Goals (Pts)</label>
                  <input
                    type="number"
                    value={activeCategory.customSportVars.goals}
                    onChange={(e) => handleUpdateCategoryVars('goals', parseInt(e.target.value) || 0)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-1.5 font-mono font-bold text-teal-300"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700">
                  <label className="text-[10px] font-mono text-slate-400">Kills (Pts)</label>
                  <input
                    type="number"
                    value={activeCategory.customSportVars.kills}
                    onChange={(e) => handleUpdateCategoryVars('kills', parseInt(e.target.value) || 0)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-1.5 font-mono font-bold text-teal-300"
                  />
                </div>

                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700">
                  <label className="text-[10px] font-mono text-slate-400">Assists (Pts)</label>
                  <input
                    type="number"
                    value={activeCategory.customSportVars.assists}
                    onChange={(e) => handleUpdateCategoryVars('assists', parseInt(e.target.value) || 0)}
                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg p-1.5 font-mono font-bold text-teal-300"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs space-y-1">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Tie-Breaker Rule</div>
                <div className="text-slate-300 font-mono text-[11px]">{activeCategory.tieBreakerRule}</div>
              </div>
            </div>
          )}

          {/* Live Formula Sandbox Simulator */}
          <div className="p-5 rounded-2xl bg-linear-to-b from-slate-800 to-teal-950/30 border border-teal-500/40 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Live Sandbox Formula Calculator
                </h3>
              </div>
              <span className="text-[10px] font-mono text-teal-400 font-bold">Real-Time Simulation</span>
            </div>

            {/* Interactive Inputs */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center bg-slate-900/80 p-2 rounded-lg border border-slate-700">
                <div className="text-[10px] font-mono text-slate-400">Goals</div>
                <input
                  type="number"
                  min="0"
                  value={simGoals}
                  onChange={(e) => setSimGoals(parseInt(e.target.value) || 0)}
                  className="w-full text-center font-mono font-bold text-slate-100 bg-transparent mt-0.5"
                />
              </div>
              <div className="text-center bg-slate-900/80 p-2 rounded-lg border border-slate-700">
                <div className="text-[10px] font-mono text-slate-400">Kills</div>
                <input
                  type="number"
                  min="0"
                  value={simKills}
                  onChange={(e) => setSimKills(parseInt(e.target.value) || 0)}
                  className="w-full text-center font-mono font-bold text-slate-100 bg-transparent mt-0.5"
                />
              </div>
              <div className="text-center bg-slate-900/80 p-2 rounded-lg border border-slate-700">
                <div className="text-[10px] font-mono text-slate-400">Assists</div>
                <input
                  type="number"
                  min="0"
                  value={simAssists}
                  onChange={(e) => setSimAssists(parseInt(e.target.value) || 0)}
                  className="w-full text-center font-mono font-bold text-slate-100 bg-transparent mt-0.5"
                />
              </div>
            </div>

            {/* Checkbox Toggles */}
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={simIsSponsorMatch}
                  onChange={(e) => setSimIsSponsorMatch(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-teal-600"
                />
                <span>Sponsor Match ({globalMultipliers.sponsorWin}x)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={simIsStreak}
                  onChange={(e) => setSimIsStreak(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-teal-600"
                />
                <span>Daily Streak ({globalMultipliers.dailyStreak}x)</span>
              </label>
            </div>

            {/* Result Box */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-teal-500/50 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono uppercase text-slate-400">
                  Computed Leaderboard Rating Output
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  1st Place + Actions × Multipliers
                </div>
              </div>
              <div className="text-2xl font-black font-mono text-teal-400">
                {computeSandboxScore()} pts
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
