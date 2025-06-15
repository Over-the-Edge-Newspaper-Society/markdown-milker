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
  createFile: (path: string, content?: string) => Promise<void>
  createDirectory: (path: string) => Promise<void>
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
    
    if (!currentFilePath) {
      throw new Error('No file path provided')
    }

    try {
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: currentFilePath,
          content: currentContent,
          type: 'file'
        }),
      })

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // If JSON parsing fails, use the status text
        }
        
        throw new Error(errorMessage)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error('Save operation failed')
      }
    } catch (error) {
      console.error('Error saving file:', error)
      throw error
    }
  },

  createFile: async (path: string, content = '') => {
    try {
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path,
          content,
          type: 'file'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create file')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error('File creation failed')
      }
    } catch (error) {
      console.error('Error creating file:', error)
      throw error
    }
  },

  createDirectory: async (path: string) => {
    try {
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path,
          type: 'directory'
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create directory')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error('Directory creation failed')
      }
    } catch (error) {
      console.error('Error creating directory:', error)
      throw error
    }
  },
}))