import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'dark' | 'light' | 'system'
export type ViewMode = 'grid' | 'list'

interface PreferencesState {
  theme: ThemePreference
  defaultView: ViewMode
  setTheme: (theme: ThemePreference) => void
  setDefaultView: (view: ViewMode) => void
}

/** Small UI preferences only. Library data lives in IndexedDB, never here. */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'dark',
      defaultView: 'grid',
      setTheme: (theme) => set({ theme }),
      setDefaultView: (defaultView) => set({ defaultView }),
    }),
    { name: 'promptvault:preferences', version: 1 },
  ),
)

export function resolveTheme(theme: ThemePreference): 'dark' | 'light' {
  if (theme !== 'system') return theme
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function applyTheme(theme: ThemePreference) {
  const resolved = resolveTheme(theme)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}
