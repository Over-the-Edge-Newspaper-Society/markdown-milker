'use client'

import { create } from 'zustand'

interface EditorStore {
  currentContent: string
  isDirty: boolean
  setContent: (content: string) => void
  saveFile: (content: string) => Promise<void>
}

export const useEditorStore = create<EditorStore>((set) => ({
  currentContent: '',
  isDirty: false,
  setContent: (content: string) => set({ currentContent: content, isDirty: true }),
  saveFile: async (content: string) => {
    try {
      // TODO: Implement actual file saving
      set({ currentContent: content, isDirty: false })
    } catch (error) {
      console.error('Failed to save file:', error)
    }
  },
})) 