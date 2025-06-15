'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { CrepeEditor } from '@/components/editor/CrepeEditor'
import { SaveStatus } from '@/components/editor/save-status'
import { useEditorStore } from '@/lib/stores/editor-store'
import { useFileStore } from '@/lib/stores/file-store'
import { useEffect, useCallback } from 'react'
import debounce from 'lodash/debounce'
import { X } from 'lucide-react'

export default function Home() {
  const { currentContent, setContent, saveFile, setCurrentFilePath, setSaveStatus } = useEditorStore()
  const { selectedFile, closeFile } = useFileStore()

  const handleClose = async () => {
    // Save before closing
    if (selectedFile && currentContent) {
      try {
        setSaveStatus('saving')
        await saveFile()
        setSaveStatus('saved')
      } catch (error) {
        console.error('Failed to save before closing:', error)
        setSaveStatus('unsaved')
        // Don't close if save failed
        return
      }
    }
    // Only close if save was successful or no save was needed
    closeFile()
  }

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async () => {
      if (selectedFile && currentContent) {
        try {
          setSaveStatus('saving')
          await saveFile()
          setSaveStatus('saved')
        } catch (error) {
          console.error('Failed to save:', error)
          setSaveStatus('unsaved')
        }
      }
    }, 1000),
    [selectedFile, currentContent, saveFile]
  )

  // Load file content when selected
  useEffect(() => {
    if (selectedFile) {
      setCurrentFilePath(selectedFile)
      setSaveStatus('saving')
      fetch(`/api/files?path=${encodeURIComponent(selectedFile)}`)
        .then(res => res.json())
        .then(data => {
          if (data.content) {
            setContent(data.content)
            setSaveStatus('saved')
          }
        })
        .catch(error => {
          console.error('Failed to load file:', error)
          setContent('')
          setSaveStatus('unsaved')
        })
    } else {
      setCurrentFilePath(null)
      setContent('')
      setSaveStatus('saved')
    }
  }, [selectedFile, setContent, setCurrentFilePath, setSaveStatus])

  // Auto-save when content changes
  useEffect(() => {
    if (currentContent && selectedFile) {
      setSaveStatus('unsaved')
      debouncedSave()
    }
  }, [currentContent, selectedFile, debouncedSave])

  return (
    <MainLayout>
      <div className="flex-1 p-4">
        {selectedFile ? (
          <div className="h-[calc(100vh-2rem)] relative">
            <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
              <SaveStatus />
              <button
                onClick={handleClose}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Close file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
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