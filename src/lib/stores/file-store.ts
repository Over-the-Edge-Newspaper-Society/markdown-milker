'use client'

import { create } from 'zustand'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

interface FileStore {
  files: FileNode[]
  selectedFile: FileNode | null
  searchTerm: string
  setFiles: (files: FileNode[]) => void
  selectFile: (file: FileNode | null) => void
  setSearchTerm: (term: string) => void
}

export const useFileStore = create<FileStore>((set) => ({
  files: [],
  selectedFile: null,
  searchTerm: '',
  setFiles: (files) => set({ files }),
  selectFile: (file) => set({ selectedFile: file }),
  setSearchTerm: (term) => set({ searchTerm: term }),
})) 