'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { CrepeEditor } from '@/components/editor/CrepeEditor'
import { SaveStatus } from '@/components/editor/save-status'
import { useEditorStore } from '@/lib/stores/editor-store'
import { useFileStore } from '@/lib/stores/file-store'
import { useEffect, useCallback } from 'react'
import debounce from 'lodash/debounce'

export default function Home() {
  const { currentContent, setContent, saveFile } = useEditorStore()
  const { selectedFile } = useFileStore()

  // Debounced save function
  const debouncedSave = useCallback(
    debounce((content: string) => {
      if (selectedFile) {
        saveFile(content)
      }
    }, 1000),
    [selectedFile, saveFile]
  )

  // Load file content when selected
  useEffect(() => {
    if (selectedFile) {
      fetch(`/api/files?path=${encodeURIComponent(selectedFile)}`)
        .then(res => res.json())
        .then(data => {
          if (data.content) {
            setContent(data.content)
          }
        })
        .catch(error => {
          console.error('Failed to load file:', error)
          setContent('')
        })
    } else {
      setContent('')
    }
  }, [selectedFile, setContent])

  // Auto-save when content changes
  useEffect(() => {
    if (currentContent && selectedFile) {
      debouncedSave(currentContent)
    }
  }, [currentContent, selectedFile, debouncedSave])

  return (
    <MainLayout>
      <div className="flex-1 p-4">
        {selectedFile ? (
          <div className="h-[calc(100vh-2rem)] relative">
            <SaveStatus />
            <CrepeEditor
              value={currentContent}
              onChange={setContent}
            />
          </div>
        ) : (
          <div className="h-[calc(100vh-2rem)] flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">No File Selected</h2>
              <p className="text-muted-foreground">
                Select a file from the sidebar to start editing
              </p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
} 