import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import './core/stores/themeStore' // applies persisted theme to <html> on load
import { useAuthStore } from './core/stores/authStore'
import { queryClient } from './app/queryClient'
import { router } from './app/router'

// Rehydrate the session (also wires the ApiClient auth hooks via the import).
void useAuthStore.getState().loadSession()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
