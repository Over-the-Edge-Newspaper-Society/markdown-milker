'use client'

import { useEffect } from 'react'
import { useFileStore } from '@/lib/stores/file-store'
import { useEditorStore } from '@/lib/stores/editor-store'

export function useFileTree() {
  const { files, setFiles, searchTerm, setSearchTerm, selectedFile, selectFile } = useFileStore()
  const { setContent } = useEditorStore()

  useEffect(() => {
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

    fetchFiles()
  }, [setFiles])

  useEffect(() => {
    const loadFileContent = async () => {
      if (!selectedFile || selectedFile.type !== 'file') return

      try {
        const response = await fetch(`/api/files/${encodeURIComponent(selectedFile.path)}`)
        if (!response.ok) throw new Error('Failed to fetch file content')
        const { content } = await response.json()
        setContent(content)
      } catch (error) {
        console.error('Error loading file content:', error)
      }
    }

    loadFileContent()
  }, [selectedFile, setContent])

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return {
    files: filteredFiles,
    searchTerm,
    setSearchTerm,
    selectedFile,
    selectFile,
  }
} 