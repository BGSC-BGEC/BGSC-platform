import React, { useState, useEffect, useCallback } from 'react'
import {
  Gavel,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  Radio,
  Clock,
  CheckCircle,
  Play,
  Square,
  Settings,
} from 'lucide-react'
import type { LiveAuctionState, AuctionLot } from '../types/auction'
import type { ClubEvent } from '../types/event'
import { auctionService } from '../services/auctionService'
import { eventService } from '../services/eventService'
import { CurrentLotCard } from '../components/auction/CurrentLotCard'
import { AuctionControlPanel } from '../components/auction/AuctionControlPanel'
import { TeamPurseGrid } from '../components/auction/TeamPurseGrid'
import { LotQueueTable } from '../components/auction/LotQueueTable'

export const Auction: React.FC = () => {
  const [events, setEvents] = useState<ClubEvent[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('evt-002')

  const [auctionState, setAuctionState] = useState<LiveAuctionState | null>(null)
  const [lots, setLots] = useState<AuctionLot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timerSeconds, setTimerSeconds] = useState<number>(30)

  // Config / Seed Lots Modal
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [minBidIncrement, setMinBidIncrement] = useState(100)
  const [bidTimerSeconds, setBidTimerSeconds] = useState(15)
  const [pursePerTeam, setPursePerTeam] = useState(10000)
  const [lotRegId, setLotRegId] = useState('')
  const [lotUserId, setLotUserId] = useState('')
  const [lotBasePrice, setLotBasePrice] = useState(500)

  // Load events for dropdown
  useEffect(() => {
    eventService
      .getEvents()
      .then((list) => {
        setEvents(list)
        const auctionEvents = list.filter((e) => e.type === 'ALL')
        if (auctionEvents.length > 0) {
          setSelectedEventId(auctionEvents[0].id)
        } else if (list.length > 0) {
          setSelectedEventId(list[0].id)
        }
      })
      .catch(() => {})
  }, [])

  // Initial data load when selectedEventId changes
  useEffect(() => {
    let ignore = false
    setIsLoading(true)

    Promise.all([
      auctionService.getLiveAuction(selectedEventId),
      auctionService.getLots(selectedEventId),
    ])
      .then(([liveState, catalogLots]) => {
        if (!ignore) {
          setAuctionState(liveState)
          setLots(catalogLots)
          setTimerSeconds(liveState.active_lot?.seconds_remaining ?? 30)
          setMinBidIncrement(liveState.config?.min_bid_increment ?? 100)
          setBidTimerSeconds(liveState.config?.bid_timer_seconds ?? 15)
          setPursePerTeam(liveState.config?.purse_per_team ?? 10000)
          setError(null)
          setIsLoading(false)
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to connect to live auction console.'
          )
          setIsLoading(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [selectedEventId])

  // Explicit refresh action handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)

    try {
      const [liveState, catalogLots] = await Promise.all([
        auctionService.getLiveAuction(selectedEventId),
        auctionService.getLots(selectedEventId),
      ])
      setAuctionState(liveState)
      setLots(catalogLots)
      setTimerSeconds(liveState.active_lot?.seconds_remaining ?? 30)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to connect to live auction console.'
      )
    } finally {
      setIsRefreshing(false)
    }
  }, [selectedEventId])

  // Countdown timer interval for active lot
  useEffect(() => {
    if (auctionState?.status !== 'live' || !auctionState?.active_lot) {
      return
    }

    const interval = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(interval)
  }, [auctionState?.status, auctionState?.active_lot])

  const handleStartAuction = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const updated = await auctionService.startAuction(selectedEventId)
      setAuctionState(updated)
      await handleRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start auction')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCloseAuction = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const updated = await auctionService.closeAuction(selectedEventId)
      setAuctionState(updated)
      await handleRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close auction')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      await auctionService.updateConfig(selectedEventId, {
        min_bid_increment: minBidIncrement,
        bid_timer_seconds: bidTimerSeconds,
        purse_per_team: pursePerTeam,
      })
      setIsConfigOpen(false)
      await handleRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update auction config')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddLot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!lotRegId.trim() || !lotUserId.trim()) return
    setIsSubmitting(true)
    setError(null)
    try {
      await auctionService.createLots(selectedEventId, [
        {
          registration_id: lotRegId.trim(),
          user_id: lotUserId.trim(),
          base_price: lotBasePrice,
          order: lots.length + 1,
        },
      ])
      setLotRegId('')
      setLotUserId('')
      setIsConfigOpen(false)
      await handleRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed player lot')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Bid submission handler
  const handlePlaceBid = async (teamId: string, amount: number) => {
    if (!auctionState?.active_lot) return

    setIsSubmitting(true)
    setError(null)

    try {
      const updatedState = await auctionService.placeBid(
        auctionState.active_lot.id,
        teamId,
        amount,
        auctionState.active_lot.version
      )
      setAuctionState(updatedState)
      setTimerSeconds(updatedState.active_lot?.seconds_remaining ?? 30)

      const updatedLots = await auctionService.getLots(selectedEventId)
      setLots(updatedLots)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit bid')
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  // Advance lot handler (Hammer down / Pass lot)
  const handleAdvanceLot = async () => {
    if (!auctionState?.active_lot) return

    setIsSubmitting(true)
    setError(null)

    try {
      const result = await auctionService.advanceLot(auctionState.active_lot.id)
      setAuctionState(result.state)
      setTimerSeconds(result.nextLot?.seconds_remaining ?? 0)

      const updatedLots = await auctionService.getLots(selectedEventId)
      setLots(updatedLots)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance auction block')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Pause / Resume toggle handler
  const handleTogglePause = async () => {
    if (!auctionState) return

    setIsSubmitting(true)
    setError(null)

    try {
      let updated: LiveAuctionState
      if (auctionState.status === 'paused') {
        updated = await auctionService.resumeAuction(selectedEventId)
      } else {
        updated = await auctionService.pauseAuction(selectedEventId)
      }
      setAuctionState(updated)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to toggle auction timer'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Demo state reset handler
  const handleResetDemo = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      auctionService.resetMockAuction()
      await handleRefresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset demo auction')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black uppercase tracking-tight text-black flex items-center gap-2">
              <Gavel className="w-5 h-5 text-black" />
              Live Auction Console
            </h1>

            {/* Auction Status Pill */}
            {auctionState?.status === 'live' ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-green-300 bg-green-50 text-green-700">
                <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
                Live Auction
              </span>
            ) : auctionState?.status === 'paused' ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-800">
                <Clock className="w-3 h-3 text-amber-600" />
                Auction Paused
              </span>
            ) : auctionState?.status === 'finished' ? (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-black text-white">
                <CheckCircle className="w-3 h-3" />
                Auction Concluded
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-gray-300 bg-gray-100 text-gray-700">
                <Radio className="w-3 h-3 text-gray-500" />
                Draft / Not Started
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {auctionState?.title || 'Valorant Spring Championship 2026'} &bull; Real-time bidding block, franchise purse ledgers, and player allocation.
          </p>
        </div>

        {/* Global Director Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {events.length > 0 && (
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded border border-gray-300 bg-white text-black focus:outline-none focus:border-black"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title} {ev.type === 'ALL' ? '(ALL)' : ''}
                </option>
              ))}
            </select>
          )}

          {(auctionState?.status === 'not_started' ||
            auctionState?.status === 'draft') && (
            <button
              type="button"
              onClick={handleStartAuction}
              disabled={isSubmitting || isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border border-black bg-black text-white hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Start Auction</span>
            </button>
          )}

          {(auctionState?.status === 'live' ||
            auctionState?.status === 'paused') && (
            <button
              type="button"
              onClick={handleCloseAuction}
              disabled={isSubmitting || isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border border-red-600 text-red-600 bg-white hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Close Auction</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsConfigOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-gray-200 bg-white text-gray-700 hover:border-black hover:text-black transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configure / Lots</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleResetDemo}
            disabled={isSubmitting || isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-gray-200 bg-white text-gray-700 hover:text-black hover:border-gray-400 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-gray-600" />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>

      {/* 2. Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="font-bold underline hover:no-underline text-red-800 cursor-pointer flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Loading State */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-black animate-spin mx-auto" />
          <p className="text-xs uppercase font-bold tracking-wider text-gray-500">
            Connecting to Live Auction Block...
          </p>
        </div>
      ) : auctionState ? (
        <>
          {/* 4. Live Block Spotlight & Director Controls */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7">
              <CurrentLotCard
                lot={auctionState.active_lot}
                auctionStatus={auctionState.status}
                timerSeconds={timerSeconds}
              />
            </div>
            <div className="lg:col-span-5">
              <AuctionControlPanel
                activeLot={auctionState.active_lot}
                teams={auctionState.teams}
                status={auctionState.status}
                isSubmitting={isSubmitting}
                onAdvance={handleAdvanceLot}
                onTogglePause={handleTogglePause}
                onPlaceBid={handlePlaceBid}
                onReset={handleResetDemo}
              />
            </div>
          </div>

          {/* 5. Franchise Squads & Purse Balances */}
          <div>
            <TeamPurseGrid
              teams={auctionState.teams}
              leadingTeamId={auctionState.active_lot?.current_bidder?.team_id}
            />
          </div>

          {/* 6. Auction Lot Queue & Completed History */}
          <div>
            <LotQueueTable
              lots={lots}
              activeLotId={auctionState.active_lot?.id}
            />
          </div>
        </>
      ) : (
        <div className="p-12 text-center rounded-lg border border-gray-200 bg-white space-y-2">
          <AlertCircle className="w-8 h-8 text-gray-400 mx-auto" />
          <h3 className="text-sm font-bold text-black uppercase tracking-wider">
            No Auction Data Found
          </h3>
          <p className="text-xs text-gray-500">
            Please make sure the tournament event has an auction enabled.
          </p>
        </div>
      )}

      {/* Configure / Seed Lots Modal */}
      {isConfigOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setIsConfigOpen(false)}
        >
          <div
            className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-black">
                Auction Parameters & Lot Seeding
              </h2>
              <button
                type="button"
                onClick={() => setIsConfigOpen(false)}
                className="px-2 py-1 text-xs font-bold border border-black text-black hover:bg-black hover:text-white cursor-pointer"
              >
                X
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3 text-left">
              <div className="text-xs font-bold uppercase text-black">
                1. Update Bidding Rules
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                    Min Increment
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={minBidIncrement}
                    onChange={(e) => setMinBidIncrement(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded text-black bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                    Timer (Sec)
                  </label>
                  <input
                    type="number"
                    min={5}
                    value={bidTimerSeconds}
                    onChange={(e) => setBidTimerSeconds(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded text-black bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                    Team Purse
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={pursePerTeam}
                    onChange={(e) => setPursePerTeam(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded text-black bg-white"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs font-bold border border-black bg-black text-white rounded cursor-pointer"
                >
                  Save Config
                </button>
              </div>
            </form>

            <form
              onSubmit={handleAddLot}
              className="space-y-3 pt-4 border-t border-gray-200 text-left"
            >
              <div className="text-xs font-bold uppercase text-black">
                2. Add Player Lot to Queue
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                    Registration ObjectId
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="24-char hex ID"
                    value={lotRegId}
                    onChange={(e) => setLotRegId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded text-black bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                    Player User UUID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="User UUID"
                    value={lotUserId}
                    onChange={(e) => setLotUserId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded text-black bg-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-600 mb-1">
                  Base Price (Pts)
                </label>
                <input
                  type="number"
                  min={0}
                  value={lotBasePrice}
                  onChange={(e) => setLotBasePrice(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded text-black bg-white"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs font-bold border border-black bg-white text-black hover:bg-black hover:text-white rounded cursor-pointer"
                >
                  Seed Player Lot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Auction
