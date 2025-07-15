// src/components/editor/editor-area.tsx (Fixed - Better Key Strategy)
'use client'

import { useEditorStore } from '@/lib/stores/editor-store'
import { useFileStore } from '@/lib/stores/file-store'
import { UnifiedCrepeEditor } from './UnifiedCrepeEditor'
import { useEffect, useCallback, useState, useMemo, useRef } from 'react'
import { X, FileText, Save, Users, User, Images } from 'lucide-react'
import { Button } from '@/components/ui/button'

type EditorMode = 'collaborative' | 'solo'

export function EditorArea() {
  const { 
    currentContent, 
    setContent, 
    saveFile, 
    setCurrentFilePath, 
    setSaveStatus, 
    currentFilePath,
    saveStatus 
  } = useEditorStore()
  const { selectedFile, closeFile } = useFileStore()
  const [fileContent, setFileContent] = useState('')
  const [editorMode, setEditorMode] = useState<EditorMode>('solo')
  const [isFileLoaded, setIsFileLoaded] = useState(false)
  const [totalSaves, setTotalSaves] = useState(0)
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)
  const [isManualSaving, setIsManualSaving] = useState(false)
  const [showSaveStatus, setShowSaveStatus] = useState(false)
  const [editorInstanceId, setEditorInstanceId] = useState(0)
  const editorRef = useRef<HTMLDivElement>(null)

  // Track saving state to prevent race conditions
  const isSavingRef = useRef(false)
  const lastSavedContentRef = useRef('')
  const saveStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Generate a unique key that forces complete remount on changes
  const editorKey = useMemo(() => {
    return `editor-${editorMode}-${selectedFile || 'none'}-${editorInstanceId}`
  }, [editorMode, selectedFile, editorInstanceId])

  // Memoize documentId
  const documentId = useMemo(() => selectedFile?.replace(/[^a-zA-Z0-9]/g, '_') || '', [selectedFile])

  // Show save status temporarily when saving
  const showSaveStatusTemporarily = useCallback(() => {
    setShowSaveStatus(true)
    if (saveStatusTimeoutRef.current) {
      clearTimeout(saveStatusTimeoutRef.current)
    }
    saveStatusTimeoutRef.current = setTimeout(() => {
      setShowSaveStatus(false)
    }, 2000) // Show for 2 seconds
  }, [])

  // ✅ Unified save function for both modes
  const saveToFile = useCallback(async (content: string, context: string = 'auto') => {
    // Prevent concurrent saves
    if (isSavingRef.current) {
      return false
    }

    // Don't save if content hasn't changed (unless forced)
    if (content === lastSavedContentRef.current && context !== 'force') {
      return true
    }

    if (!selectedFile || !isFileLoaded) {
      return false
    }

    try {
      isSavingRef.current = true
      setSaveStatus('saving')
      showSaveStatusTemporarily()

      // Update the editor store content
      setContent(content)
      setFileContent(content)
      
      // Save to file via API
      await saveFile()
      
      // Update tracking
      lastSavedContentRef.current = content
      setSaveStatus('saved')
      setLastSaveTime(new Date())
      setTotalSaves(prev => prev + 1)

      return true
      
    } catch (error) {
      console.error(`❌ SAVE FAILED [${context}]:`, error)
      setSaveStatus('unsaved')
      showSaveStatusTemporarily()
      return false
    } finally {
      isSavingRef.current = false
    }
  }, [selectedFile, isFileLoaded, setContent, saveFile, setSaveStatus, showSaveStatusTemporarily])

  // ✅ Manual save function
  const manualSave = useCallback(async () => {
    if (!selectedFile || isManualSaving) return
    
    setIsManualSaving(true)
    try {
      const success = await saveToFile(fileContent, 'manual')
      if (success) {
        console.log('✅ Manual save completed')
      }
    } finally {
      setIsManualSaving(false)
    }
  }, [selectedFile, fileContent, saveToFile, isManualSaving])

  // Function to open image library from editor
  const handleImageLibraryOpen = useCallback(() => {
    console.log('📸 Image library requested from editor')
    // You could emit an event or use a global state to open the main image library
    // For now, we'll use the editor's built-in image picker
  }, [])

  // Function to open editor's image picker programmatically
  const openEditorImagePicker = useCallback(() => {
    if (editorRef.current && (editorRef.current as any).openImagePicker) {
      (editorRef.current as any).openImagePicker()
    }
  }, [])

  // Load file content when selected
  useEffect(() => {
    if (selectedFile) {
      console.log('📂 Loading file:', selectedFile)
      setCurrentFilePath(selectedFile)
      setSaveStatus('saving')
      setIsFileLoaded(false)
      setTotalSaves(0)
      setLastSaveTime(null)
      lastSavedContentRef.current = ''
      
      fetch(`/api/files?path=${encodeURIComponent(selectedFile)}`)
        .then(res => res.json())
        .then(data => {
          if (data.content !== undefined) {
            const content = data.content || ''
            setContent(content)
            setFileContent(content)
            lastSavedContentRef.current = content
            setSaveStatus('saved')
            setIsFileLoaded(true)
            console.log('✅ File loaded successfully')
          } else {
            setContent('')
            setFileContent('')
            lastSavedContentRef.current = ''
            setSaveStatus('unsaved')
            setIsFileLoaded(true)
          }
        })
        .catch(error => {
          console.error('❌ Failed to load file:', error)
          setContent('')
          setFileContent('')
          lastSavedContentRef.current = ''
          setSaveStatus('unsaved')
          setIsFileLoaded(true)
        })
    } else {
      setCurrentFilePath(null)
      setContent('')
      setFileContent('')
      lastSavedContentRef.current = ''
      setSaveStatus('saved')
      setIsFileLoaded(false)
      setTotalSaves(0)
      setLastSaveTime(null)
    }
  }, [selectedFile, setContent, setCurrentFilePath, setSaveStatus])

  // ✅ Handle editor content changes
  const handleEditorChange = useCallback(async (content: string) => {
    if (!isFileLoaded || !selectedFile) {
      return
    }
    
    // Update local state immediately
    setFileContent(content)
    
    // Only process if content actually changed
    if (content !== lastSavedContentRef.current) {
      setSaveStatus('unsaved')
      
      // The unified editor handles its own saving timing based on mode
      await saveToFile(content, `${editorMode}-auto`)
    }
  }, [editorMode, isFileLoaded, selectedFile, setSaveStatus, saveToFile])

  const handleClose = async () => {
    if (selectedFile && fileContent && fileContent !== lastSavedContentRef.current) {
      await saveToFile(fileContent, 'before-close')
    }
    closeFile()
  }

  // Toggle between collaborative and solo mode with forced remount
  const toggleMode = () => {
    console.log(`🔄 Switching from ${editorMode} to ${editorMode === 'collaborative' ? 'solo' : 'collaborative'} mode`)
    setEditorMode(prev => prev === 'collaborative' ? 'solo' : 'collaborative')
    // Force a new editor instance
    setEditorInstanceId(prev => prev + 1)
  }

  // Force remount when switching files with delay to ensure proper cleanup
  useEffect(() => {
    if (selectedFile) {
      // Add small delay to ensure previous editor is fully cleaned up
      const timer = setTimeout(() => {
        setEditorInstanceId(prev => prev + 1)
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [selectedFile])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current)
      }
    }
  }, [])

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
          </div>
        </div>
      </div>
    )
  }

  if (!isFileLoaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <div className="font-medium">Loading file...</div>
          <div className="text-sm text-muted-foreground">{selectedFile}</div>
        </div>
      </div>
    )
  }

  const getSaveStatusDisplay = () => {
    if (saveStatus === 'saving') {
      return { text: 'Saving...', color: 'text-yellow-600' }
    } else if (saveStatus === 'unsaved') {
      return { text: 'Unsaved', color: 'text-red-600' }
    } else {
      return { text: 'Saved', color: 'text-green-600' }
    }
  }

  const statusDisplay = getSaveStatusDisplay()

  return (
    <div className="h-full flex flex-col">
      {/* Clean file header */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">{selectedFile}</span>
          <span className="text-xs text-muted-foreground">
            {fileContent?.length || 0} chars
          </span>
          
          {/* Show save status only when active */}
          {showSaveStatus && (
            <span className={`text-xs ${statusDisplay.color} transition-opacity`}>
              {statusDisplay.text}
            </span>
          )}
          
          {/* Save count (only show if > 0 and not too intrusive) */}
          {totalSaves > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
              {totalSaves} saves
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {/* Image Library Button for Editor */}
          <Button
            variant="ghost"
            size="sm"
            onClick={openEditorImagePicker}
            className="flex items-center gap-1"
            title="Open Image Library"
          >
            <Images className="h-3 w-3" />
            <span className="text-xs">Images</span>
          </Button>

          {/* Simple Mode Switch */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMode}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                editorMode === 'collaborative' ? 'bg-blue-600' : 'bg-gray-300'
              }`}
              title={`Switch to ${editorMode === 'collaborative' ? 'solo' : 'collaborative'} mode`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  editorMode === 'collaborative' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            
            <div className="flex items-center gap-1 text-xs">
              {editorMode === 'collaborative' ? (
                <>
                  <Users className="h-3 w-3 text-blue-600" />
                  <span className="text-blue-600 font-medium">Collaborative</span>
                </>
              ) : (
                <>
                  <User className="h-3 w-3 text-gray-600" />
                  <span className="text-gray-600 font-medium">Solo</span>
                </>
              )}
            </div>
          </div>
          
          {/* Manual save button */}
          <button
            onClick={manualSave}
            disabled={isManualSaving || isSavingRef.current}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 transition-colors"
            title="Save manually"
          >
            <Save className="h-3 w-3" />
            {isManualSaving ? 'Saving...' : 'Save'}
          </button>
          
          <button
            onClick={handleClose}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            title="Close file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Unified Crepe Editor with proper scrolling and unique key for complete remount */}
      <div className="flex-1 overflow-hidden">
        <div ref={editorRef} className="h-full">
          <UnifiedCrepeEditor
            key={editorKey} // This ensures complete remount on mode/file changes
            documentId={documentId}
            initialContent={fileContent}
            onChange={handleEditorChange}
            wsUrl={process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234'}
            collaborative={editorMode === 'collaborative'}
            onImageLibraryOpen={handleImageLibraryOpen}
          />
        </div>
      </div>
    </div>
  )
}