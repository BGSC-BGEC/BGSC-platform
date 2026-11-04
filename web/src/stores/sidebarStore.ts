import { create } from 'zustand'

interface SidebarState {
  collapsed: boolean
  toggleCollapsed: () => void
  setCollapsed: (collapsed: boolean) => void
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
  toggleMobileOpen: () => void
}

const getInitialCollapsed = (): boolean => {
  try {
    return localStorage.getItem('admin_sidebar_collapsed') === 'true'
  } catch {
    return false
  }
}

export const useSidebarStore = create<SidebarState>((set, get) => ({
  collapsed: getInitialCollapsed(),
  mobileOpen: false,
  toggleCollapsed: () => {
    const next = !get().collapsed
    try {
      localStorage.setItem('admin_sidebar_collapsed', String(next))
    } catch {
      /* ignore */
    }
    set({ collapsed: next })
  },
  setCollapsed: (collapsed) => {
    try {
      localStorage.setItem('admin_sidebar_collapsed', String(collapsed))
    } catch {
      /* ignore */
    }
    set({ collapsed })
  },
  setMobileOpen: (mobileOpen) => set({ mobileOpen }),
  toggleMobileOpen: () => set({ mobileOpen: !get().mobileOpen }),
}))
