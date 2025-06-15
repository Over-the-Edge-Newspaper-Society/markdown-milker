'use client'

import { useEffect } from 'react'
import { useFileStore } from '@/lib/stores/file-store'

export function useFileTree() {
  const { 
    files, 
    setFiles, 
    searchTerm, 
    setSearchTerm, 
    selectedFile, 
    selectFile 
  } = useFileStore()

  const fetchFiles = async () => {
    try {
      const response = await fetch('/api/files')
      if (!response.ok) throw new Error('Failed to fetch files')
      const data = await response.json()
      setFiles(data)
    } catch (error) {
      console.error('Error fetching files:', error)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return {
    files: filteredFiles,
    searchTerm,
    setSearchTerm,
    selectedFile,
    selectFile,
    refreshFiles: fetchFiles,
  }
}