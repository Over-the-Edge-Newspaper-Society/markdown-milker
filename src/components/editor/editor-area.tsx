// src/components/editor/editor-area.tsx
'use client'

import { useEditorStore } from '@/lib/stores/editor-store'
import { useFileStore } from '@/lib/stores/file-store'
import { CollaborativeEditor } from './CollaborativeEditor'
import { SimpleEditor } from './SimpleEditor'
import { SaveStatus } from './save-status'
import { useEffect, useCallback, useState, useMemo } from 'react'
import { X, FileText, Users } from 'lucide-react'
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
  const [fileContent, setFileContent] = useState('')
  const [isCollaborative, setIsCollaborative] = useState(true)

  // Memoize documentId at the top level
  const documentId = useMemo(() => selectedFile?.replace(/[^a-zA-Z0-9]/g, '_') || '', [selectedFile])

  // Debug logging
  console.log('📊 EditorArea render:', {
    selectedFile,
    currentFilePath,
    contentLength: currentContent?.length || 0,
    hasContent: !!currentContent,
    isCollaborative
  })

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (content: string) => {
      if (selectedFile && content !== undefined) {
        try {
          console.log('💾 Auto-saving:', selectedFile, `(${content.length} chars)`)
          setSaveStatus('saving')
          
          // Update the store content first
          setContent(content)
          
          // Then save to file
          await saveFile()
          setSaveStatus('saved')
          console.log('✅ Auto-save complete')
        } catch (error) {
          console.error('❌ Failed to save:', error)
          setSaveStatus('unsaved')
        }
      }
    }, 1500),
    [selectedFile, saveFile, setSaveStatus, setContent]
  )

  // Load file content when selected
  useEffect(() => {
    if (selectedFile) {
      console.log('📁 Loading file:', selectedFile)
      setCurrentFilePath(selectedFile)
      setSaveStatus('saving')
      
      fetch(`/api/files?path=${encodeURIComponent(selectedFile)}`)
        .then(res => res.json())
        .then(data => {
          console.log('📄 File loaded:', {
            file: selectedFile,
            hasContent: data.content !== undefined,
            contentLength: data.content?.length || 0,
            preview: data.content?.substring(0, 50) + '...'
          })
          
          if (data.content !== undefined) {
            setContent(data.content)
            setFileContent(data.content)
            setSaveStatus('saved')
          } else {
            console.warn('⚠️ No content in response')
            setContent('')
            setFileContent('')
            setSaveStatus('unsaved')
          }
        })
        .catch(error => {
          console.error('❌ Failed to load file:', error)
          setContent('')
          setFileContent('')
          setSaveStatus('unsaved')
        })
    } else {
      console.log('📁 No file selected, clearing content')
      setCurrentFilePath(null)
      setContent('')
      setFileContent('')
      setSaveStatus('saved')
    }
  }, [selectedFile, setContent, setCurrentFilePath, setSaveStatus])

  // Handle editor content changes
  const handleEditorChange = useCallback((content: string) => {
    console.log('✏️ Editor content changed:', `${content.length} chars`)
    setFileContent(content)
    setSaveStatus('unsaved')
    debouncedSave(content)
  }, [debouncedSave, setSaveStatus])

  const handleClose = async () => {
    // Save before closing if there are unsaved changes
    if (selectedFile && fileContent && fileContent !== currentContent) {
      try {
        setSaveStatus('saving')
        setContent(fileContent)
        await saveFile()
        setSaveStatus('saved')
      } catch (error) {
        console.error('Failed to save before closing:', error)
        setSaveStatus('unsaved')
        return
      }
    }
    closeFile()
  }

  const toggleCollaborative = () => {
    setIsCollaborative(!isCollaborative)
  }

  if (!selectedFile) {
    return (
      <div className="h-full flex items-center justify-between">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No File Selected</h2>
            <p className="text-muted-foreground">
              Select a markdown file from the sidebar to start editing
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              ✨ Auto-save enabled • Collaborative editing available
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* File header with collaboration toggle */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">{selectedFile}</span>
          <span className="text-xs text-muted-foreground">
            • {fileContent?.length || 0} chars
          </span>
          {isCollaborative && (
            <div className="flex items-center gap-1 text-xs text-blue-600">
              <Users className="h-3 w-3" />
              <span>Collaborative</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleCollaborative}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              isCollaborative 
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={isCollaborative ? 'Disable collaboration' : 'Enable collaboration'}
          >
            {isCollaborative ? 'Collaborative' : 'Solo'}
          </button>
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
        {selectedFile && (
          <div className="h-full">
            {isCollaborative ? (
              <CollaborativeEditor
                documentId={documentId}
                initialContent={fileContent}
                onChange={handleEditorChange}
                wsUrl={process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234'}
              />
            ) : (
              <SimpleEditor
                initialContent={fileContent}
                onChange={handleEditorChange}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}