import React, { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import type { UserSearchResult } from '../../types/leaderboard'
import { searchUsers } from '../../services/leaderboardService'

export interface UserSearchPickerProps {
  selected: UserSearchResult | null
  onSelect: (user: UserSearchResult | null) => void
  placeholder?: string
}

/** Debounced search over GET /users/search (name or username), single selection. */
export const UserSearchPicker: React.FC<UserSearchPickerProps> = ({
  selected,
  onSelect,
  placeholder = 'Search member by name or username...',
}) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const term = query.trim()
    if (!term) return
    let ignore = false
    const timer = setTimeout(() => {
      setIsSearching(true)
      searchUsers(term, 10)
        .then((users) => {
          if (!ignore) {
            setResults(users)
            setError(null)
          }
        })
        .catch((err) => {
          if (!ignore) setError(err instanceof Error ? err.message : 'Search failed')
        })
        .finally(() => {
          if (!ignore) setIsSearching(false)
        })
    }, 300)
    return () => {
      ignore = true
      clearTimeout(timer)
    }
  }, [query])

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2 border border-foreground/70 rounded bg-card">
        <div className="min-w-0">
          <div className="text-sm font-bold text-foreground truncate">
            {selected.fullName || selected.username}
          </div>
          <div className="text-[11px] text-muted-foreground font-mono truncate">
            @{selected.username}
            {selected.pointsBalance !== null && ` · ${selected.pointsBalance.toLocaleString()} pts`}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="px-2 py-1 text-xs border border-border text-foreground hover:bg-muted rounded transition-colors cursor-pointer shrink-0"
        >
          Change
        </button>
      </div>
    )
  }

  const term = query.trim()

  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          maxLength={80}
          className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded text-foreground bg-card focus:outline-none focus:border-primary"
        />
      </div>
      {term && (
        <div className="border border-border rounded bg-card max-h-56 overflow-y-auto divide-y divide-border/60">
          {isSearching && <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>}
          {!isSearching && error && <div className="px-3 py-2 text-xs text-destructive">{error}</div>}
          {!isSearching && !error && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No active members match "{term}".</div>
          )}
          {!isSearching &&
            !error &&
            results.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onSelect(u)
                  setQuery('')
                  setResults([])
                }}
                className="w-full text-left px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="text-sm font-semibold text-foreground">{u.fullName || u.username}</div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  @{u.username}
                  {u.pointsBalance !== null && ` · ${u.pointsBalance.toLocaleString()} pts`}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

export default UserSearchPicker
