import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

const THEME_KEY = 'bgsc.theme'

interface ThemeState {
  mode: ThemeMode
  /** The resolved appearance after applying `system`. */
  resolved: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
  /** Cycle light → dark → system. */
  toggle: () => void
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return mode
}

function applyToDom(resolved: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', resolved === 'dark')
}

function readStoredMode(): ThemeMode {
  const stored =
    typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_KEY) : null
  return stored === 'light' || stored === 'dark' || stored === 'system'
    ? stored
    : 'system'
}

const initialMode = readStoredMode()
const initialResolved = resolve(initialMode)
applyToDom(initialResolved)

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: initialMode,
  resolved: initialResolved,

  setMode: (mode) => {
    const resolved = resolve(mode)
    localStorage.setItem(THEME_KEY, mode)
    applyToDom(resolved)
    set({ mode, resolved })
  },

  toggle: () => {
    const order: ThemeMode[] = ['light', 'dark', 'system']
    const next = order[(order.indexOf(get().mode) + 1) % order.length]
    get().setMode(next)
  },
}))

// Keep `system` mode reactive to OS appearance changes.
if (typeof window !== 'undefined') {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      const { mode, setMode } = useThemeStore.getState()
      if (mode === 'system') setMode('system')
    })
}
