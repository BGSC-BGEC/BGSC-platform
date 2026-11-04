import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('admin_theme') as Theme | null
    if (stored === 'dark' || stored === 'light') return stored
  } catch { /* ignore */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

const initial = getInitialTheme()
applyTheme(initial)

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initial,
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    localStorage.setItem('admin_theme', next)
    set({ theme: next })
  },
  setTheme: (t) => {
    applyTheme(t)
    localStorage.setItem('admin_theme', t)
    set({ theme: t })
  },
}))
