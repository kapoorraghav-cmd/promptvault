import { create } from 'zustand'

/**
 * Passes data between screens in memory only (for example, text extracted
 * from a screenshot that the user wants to turn into a new creation).
 */
interface HandoffState {
  pendingPrompt: { prompt: string; screenshot: File | null } | null
  setPendingPrompt: (value: HandoffState['pendingPrompt']) => void
  takePendingPrompt: () => HandoffState['pendingPrompt']
}

export const useHandoff = create<HandoffState>()((set, get) => ({
  pendingPrompt: null,
  setPendingPrompt: (pendingPrompt) => set({ pendingPrompt }),
  takePendingPrompt: () => {
    const value = get().pendingPrompt
    set({ pendingPrompt: null })
    return value
  },
}))
