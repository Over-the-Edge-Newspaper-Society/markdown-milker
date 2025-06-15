'use client'

import { useEditorStore } from '@/lib/stores/editor-store'
import { useFileStore } from '@/lib/stores/file-store'
import { CrepeEditor } from './CrepeEditor'
import { SaveStatus } from './save-status'
import { useEffect, useCallback } from 'react'
import { X, FileText } from 'lucide-react'
import debounce from 'lodash/debounce'

export function EditorArea() {
  const { 
    currentContent, 
    setContent, 
    saveFile, 
    setCurrentFilePath, 
    setSaveStatus, 
    currentFilePath 
  } = useEditorStore()
  const { selectedFile, closeFile } = useFileStore()

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async () => {
      if (selectedFile && currentContent !== undefined) {
        try {
          setSaveStatus('saving')
          await saveFile()
          setSaveStatus('saved')
        } catch (error) {
          console.error('Failed to save:', error)
          setSaveStatus('unsaved')
        }
      }
    }, 1500), // Increased debounce time
    [selectedFile, currentContent, saveFile, setSaveStatus]
  )

  // Load file content when selected
  useEffect(() => {
    if (selectedFile) {
      setCurrentFilePath(selectedFile)
      setSaveStatus('saving')
      
      fetch(`/api/files?path=${encodeURIComponent(selectedFile)}`)
        .then(res => res.json())
        .then(data => {
          if (data.content !== undefined) {
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

  // Auto-save when content changes (but not on initial load)
  useEffect(() => {
    if (currentContent && selectedFile && currentFilePath) {
      setSaveStatus('unsaved')
      debouncedSave()
    }
  }, [currentContent, selectedFile, currentFilePath, debouncedSave, setSaveStatus])

  const handleClose = async () => {
    // Save before closing if there are unsaved changes
    if (selectedFile && currentContent) {
      try {
        setSaveStatus('saving')
        await saveFile()
        setSaveStatus('saved')
      } catch (error) {
        console.error('Failed to save before closing:', error)
        setSaveStatus('unsaved')
        return // Don't close if save failed
      }
    }
    closeFile()
  }

  if (!selectedFile) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No File Selected</h2>
          <p className="text-muted-foreground">
            Select a markdown file from the sidebar to start editing
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* File header */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">{selectedFile}</span>
        </div>
        <div className="flex items-center gap-3">
          <SaveStatus />
          <button
            onClick={handleClose}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title="Close file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <CrepeEditor
          key={selectedFile} // Force re-mount when file changes
          value={currentContent}
          onChange={setContent}
        />
      </div>
    </div>
  )
}