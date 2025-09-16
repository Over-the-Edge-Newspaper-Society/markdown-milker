'use client'

import { useEffect } from 'react'
import { useFileStore } from '@/lib/stores/file-store'
import { useProjectStore } from '@/lib/stores/project-store'

export function useFileTree() {
  const { 
    files, 
    setFiles, 
    searchTerm, 
    setSearchTerm, 
    selectedFile, 
    selectFile 
  } = useFileStore()

  const { activeProject } = useProjectStore()

  const fetchFiles = async () => {
    try {
      const url = activeProject ? `/api/files?projectId=${encodeURIComponent(activeProject)}` : '/api/files'
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch files')
      const data = await response.json()
      setFiles(data)
    } catch (error) {
      console.error('Error fetching files:', error)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [activeProject])

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
