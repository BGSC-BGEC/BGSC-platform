import React, { useState, useEffect, useCallback } from 'react'
import {
  Gavel,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  Radio,
  Clock,
  CheckCircle,
} from 'lucide-react'
import type { LiveAuctionState, AuctionLot } from '../types/auction'
import { auctionService } from '../services/auctionService'
import { CurrentLotCard } from '../components/auction/CurrentLotCard'
import { AuctionControlPanel } from '../components/auction/AuctionControlPanel'
import { TeamPurseGrid } from '../components/auction/TeamPurseGrid'
import { LotQueueTable } from '../components/auction/LotQueueTable'

export const Auction: React.FC = () => {
  const selectedEventId = 'evt-002'

  const [auctionState, setAuctionState] = useState<LiveAuctionState | null>(null)
  const [lots, setLots] = useState<AuctionLot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timerSeconds, setTimerSeconds] = useState<number>(30)

  // Initial data load on mount
  useEffect(() => {
    let ignore = false

    Promise.all([
      auctionService.getLiveAuction(selectedEventId),
      auctionService.getLots(selectedEventId),
    ])
      .then(([liveState, catalogLots]) => {
        if (!ignore) {
          setAuctionState(liveState)
          setLots(catalogLots)
          setTimerSeconds(liveState.active_lot?.seconds_remaining ?? 30)
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

      // Refresh lots list to keep tables and history synced
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

      // Refresh catalog lots
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
                Draft Mode
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">
            {auctionState?.title || 'Valorant Spring Championship 2026'} &bull; Real-time bidding block, franchise purse ledgers, and player allocation.
          </p>
        </div>

        {/* Global Director Action Bar */}
        <div className="flex items-center gap-2">
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
    </div>
  )
}

export default Auction
