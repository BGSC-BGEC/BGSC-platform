import React, { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { hallOfFameService, type HofUserOption } from '../../services/hallOfFameService'

interface UserSearchPickerProps {
  /** Called with the chosen user; the parent decides what to fill from it. */
  onSelect: (user: HofUserOption) => void
  placeholder?: string
  /** Ids already chosen, shown as disabled in the results. */
  excludeIds?: string[]
}

/** Search-as-you-type over GET /users/search (any authed user; active, public profiles). */
export const UserSearchPicker: React.FC<UserSearchPickerProps> = ({
  onSelect,
  placeholder = 'Search members by name or username...',
  excludeIds = [],
}) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<HofUserOption[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const requestSeq = useRef(0)

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      setResults([])
      setSearchError(null)
      return
    }
    const seq = ++requestSeq.current
    const timer = setTimeout(async () => {
      setIsSearching(true)
      setSearchError(null)
      try {
        const list = await hallOfFameService.searchUsers(term, 10)
        if (seq === requestSeq.current) setResults(list)
      } catch (err) {
        if (seq === requestSeq.current) {
          setResults([])
          setSearchError(err instanceof Error ? err.message : 'User search failed')
        }
      } finally {
        if (seq === requestSeq.current) setIsSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const pick = (user: HofUserOption) => {
    onSelect(user)
    setQuery('')
    setResults([])
  }

  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          maxLength={80}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded text-foreground bg-card focus:outline-none focus:border-primary"
        />
      </div>
      {query.trim() && (
        <div className="border border-border rounded bg-card max-h-48 overflow-y-auto divide-y divide-border/60">
          {isSearching ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
          ) : searchError ? (
            <div className="px-3 py-2 text-xs text-foreground">{searchError}</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No matching members.</div>
          ) : (
            results.map((u) => {
              const taken = excludeIds.includes(u.id)
              return (
                <button
                  key={u.id}
                  type="button"
                  disabled={taken}
                  onClick={() => pick(u)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-muted/30 cursor-pointer disabled:cursor-not-allowed disabled:text-muted-foreground"
                >
                  <span className="font-bold text-foreground">{u.fullName || u.username}</span>{' '}
                  <span className="text-muted-foreground">@{u.username}</span>
                  {taken && <span className="ml-1 text-muted-foreground">(added)</span>}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default UserSearchPicker
