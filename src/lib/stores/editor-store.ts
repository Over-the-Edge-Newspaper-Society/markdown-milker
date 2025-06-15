'use client'

import { create } from 'zustand'

export type SaveStatus = 'saved' | 'saving' | 'unsaved'

interface EditorStore {
  currentContent: string
  isDirty: boolean
  saveStatus: SaveStatus
  setContent: (content: string) => void
  setSaveStatus: (status: SaveStatus) => void
  saveFile: (content: string) => Promise<void>
}

export const useEditorStore = create<EditorStore>((set) => ({
  currentContent: '',
  isDirty: false,
  saveStatus: 'saved',
  setContent: (content) => set({ currentContent: content, isDirty: true, saveStatus: 'unsaved' }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  saveFile: async (content) => {
    try {
      set({ saveStatus: 'saving' })
      // TODO: Implement actual file saving
      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate network delay
      set({ currentContent: content, isDirty: false, saveStatus: 'saved' })
    } catch (error) {
      console.error('Failed to save file:', error)
      set({ saveStatus: 'unsaved' })
    }
  },
})) 