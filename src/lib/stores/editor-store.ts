// src/lib/stores/editor-store.ts
'use client'

import { create } from 'zustand'

export type SaveStatus = 'saved' | 'saving' | 'unsaved'

interface EditorStore {
  currentContent: string
  currentFilePath: string | null
  saveStatus: SaveStatus
  activeDirectory: string // Add active directory
  setContent: (content: string) => void
  setCurrentFilePath: (path: string | null) => void
  setSaveStatus: (status: SaveStatus) => void
  setActiveDirectory: (dir: string) => void
  saveFile: () => Promise<void>
  createFile: (path: string, content?: string) => Promise<void>
  createDirectory: (path: string) => Promise<void>
  moveFile: (sourcePath: string, targetPath: string) => Promise<void>
  deleteFile: (path: string) => Promise<void>
  uploadImage: (file: File) => Promise<string>
  getAssetImages: () => Promise<string[]>
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  currentContent: '',
  currentFilePath: null,
  saveStatus: 'saved',
  activeDirectory: 'docs', // Default to docs
  
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

  setActiveDirectory: (dir: string) => {
    set({ activeDirectory: dir })
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

  moveFile: async (sourcePath: string, targetPath: string) => {
    try {
      const response = await fetch('/api/files/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourcePath,
          targetPath
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to move file')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error('Move operation failed')
      }
    } catch (error) {
      console.error('Error moving file:', error)
      throw error
    }
  },

  deleteFile: async (path: string) => {
    try {
      const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete file')
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error('Delete operation failed')
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      throw error
    }
  },

  uploadImage: async (file: File): Promise<string> => {
    const { activeDirectory } = get()
    
    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('activeDir', activeDirectory)

      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload image')
      }

      const result = await response.json()
      return result.relativePath // Return relative path for markdown
    } catch (error) {
      console.error('Error uploading image:', error)
      throw error
    }
  },

  getAssetImages: async (): Promise<string[]> => {
    const { activeDirectory } = get()
    
    try {
      const response = await fetch(`/api/assets?activeDir=${encodeURIComponent(activeDirectory)}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch images')
      }

      const result = await response.json()
      return result.images || []
    } catch (error) {
      console.error('Error fetching asset images:', error)
      return []
    }
  },
}))