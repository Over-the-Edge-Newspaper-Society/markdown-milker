'use client'

import { create } from 'zustand'
import { useEditorStore } from './editor-store'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

interface FileStore {
  files: FileNode[]
  selectedFile: string | null
  searchTerm: string
  setFiles: (files: FileNode[]) => void
  selectFile: (path: string) => void
  setSearchTerm: (term: string) => void
  setSelectedFile: (file: string | null) => void
  closeFile: () => void
}

export const useFileStore = create<FileStore>((set) => ({
  files: [],
  selectedFile: null,
  searchTerm: '',
  setFiles: (files) => set({ files }),
  selectFile: (path) => set({ selectedFile: path }),
  setSearchTerm: (term) => set({ searchTerm: term }),
  setSelectedFile: (file) => set({ selectedFile: file }),
  closeFile: () => set({ selectedFile: null })
})) 