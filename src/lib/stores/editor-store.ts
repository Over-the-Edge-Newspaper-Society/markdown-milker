'use client'

import { create } from 'zustand'

export type SaveStatus = 'saved' | 'saving' | 'unsaved'

interface EditorStore {
  currentContent: string
  currentFilePath: string | null
  saveStatus: SaveStatus
  setContent: (content: string) => void
  setCurrentFilePath: (path: string | null) => void
  setSaveStatus: (status: SaveStatus) => void
  saveFile: () => Promise<void>
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  currentContent: '',
  currentFilePath: null,
  saveStatus: 'saved',
  setContent: (content: string) => {
    const { currentContent } = get()
    if (content !== currentContent) {
      set({ currentContent: content, saveStatus: 'unsaved' })
    }
  },
  setCurrentFilePath: (path: string | null) => {
    set({ currentFilePath: path, saveStatus: 'saved' })
  },
  setSaveStatus: (status: SaveStatus) => {
    set({ saveStatus: status })
  },
  saveFile: async () => {
    const { currentContent, currentFilePath } = get()
    
    console.log('Attempting to save file:', {
      path: currentFilePath,
      contentLength: currentContent?.length
    })
    
    if (!currentFilePath) {
      console.error('No file path provided for saving')
      return
    }

    try {
      console.log('Sending save request...')
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: currentFilePath,
          content: currentContent,
        }),
      })

      console.log('Save response status:', response.status)
      
      if (!response.ok) {
        const error = await response.json()
        console.error('Save failed:', error)
        throw new Error(error.error || `Failed to save file: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('Save result:', result)
      
      if (!result.success) {
        throw new Error('Failed to save file')
      }

      return result
    } catch (error) {
      console.error('Error saving file:', error)
      throw error
    }
  },
})) 