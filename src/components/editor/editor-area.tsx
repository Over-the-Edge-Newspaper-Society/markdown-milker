// src/components/editor/editor-area.tsx
'use client'

import { useEditorStore } from '@/lib/stores/editor-store'
import { useFileStore } from '@/lib/stores/file-store'
import { UnifiedCrepeEditor } from './UnifiedCrepeEditor'
import { SaveStatus } from './save-status'
import { useEffect, useCallback, useState, useMemo, useRef } from 'react'
import { X, FileText, Users, ChevronDown, Save } from 'lucide-react'

type EditorMode = 'collaborative' | 'solo'

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
  const [editorMode, setEditorMode] = useState<EditorMode>('collaborative')
  const [isFileLoaded, setIsFileLoaded] = useState(false)
  const [showModeDropdown, setShowModeDropdown] = useState(false)
  const [totalSaves, setTotalSaves] = useState(0)
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)
  const [isManualSaving, setIsManualSaving] = useState(false)

  // Track saving state to prevent race conditions
  const isSavingRef = useRef(false)
  const lastSavedContentRef = useRef('')

  // Memoize documentId
  const documentId = useMemo(() => selectedFile?.replace(/[^a-zA-Z0-9]/g, '_') || '', [selectedFile])

  const editorModes = [
    { 
      value: 'collaborative' as EditorMode, 
      label: 'Collaborative Mode', 
      description: 'Real-time collaboration with immediate file saving (1s)',
      icon: '🤝'
    },
    { 
      value: 'solo' as EditorMode, 
      label: 'Solo Mode', 
      description: 'Single-user editing with debounced saving (1.5s)',
      icon: '✨'
    }
  ]

  const currentMode = editorModes.find(mode => mode.value === editorMode) || editorModes[0]

  // ✅ Unified save function for both modes
  const saveToFile = useCallback(async (content: string, context: string = 'auto') => {
    // Prevent concurrent saves
    if (isSavingRef.current) {
      console.log('🔒 Save already in progress, skipping...')
      return false
    }

    // Don't save if content hasn't changed (unless forced)
    if (content === lastSavedContentRef.current && context !== 'force') {
      return true
    }

    if (!selectedFile || !isFileLoaded) {
      console.log('⚠️ No file selected or not loaded yet')
      return false
    }

    try {
      isSavingRef.current = true
      setSaveStatus('saving')
      
      console.log(`💾 SAVING [${editorMode}] [${context}]:`, {
        file: selectedFile,
        contentLength: content.length,
        previousLength: lastSavedContentRef.current.length
      })

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

      console.log(`✅ SAVE SUCCESS [${context}]:`, content.length, 'chars saved')
      return true
      
    } catch (error) {
      console.error(`❌ SAVE FAILED [${context}]:`, error)
      setSaveStatus('unsaved')
      return false
    } finally {
      isSavingRef.current = false
    }
  }, [selectedFile, isFileLoaded, editorMode, setContent, saveFile, setSaveStatus])

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

  // Load file content when selected
  useEffect(() => {
    if (selectedFile) {
      console.log('📁 Loading file:', selectedFile, 'Mode:', editorMode)
      setCurrentFilePath(selectedFile)
      setSaveStatus('saving')
      setIsFileLoaded(false)
      setTotalSaves(0)
      setLastSaveTime(null)
      lastSavedContentRef.current = ''
      
      fetch(`/api/files?path=${encodeURIComponent(selectedFile)}`)
        .then(res => res.json())
        .then(data => {
          console.log('📄 File loaded:', {
            file: selectedFile,
            hasContent: data.content !== undefined,
            contentLength: data.content?.length || 0,
            mode: editorMode
          })
          
          if (data.content !== undefined) {
            const content = data.content || ''
            setContent(content)
            setFileContent(content)
            lastSavedContentRef.current = content
            setSaveStatus('saved')
            setIsFileLoaded(true)
            
            console.log('✅ File content loaded and ready for editing')
          } else {
            console.warn('⚠️ No content in response')
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
  }, [selectedFile, setContent, setCurrentFilePath, setSaveStatus, editorMode])

  // ✅ Handle editor content changes
  const handleEditorChange = useCallback(async (content: string) => {
    console.log('✏️ Unified editor content changed:', {
      contentLength: content.length,
      mode: editorMode,
      previousLength: lastSavedContentRef.current.length,
      hasChanged: content !== lastSavedContentRef.current,
      isFileLoaded,
      selectedFile
    })
    
    if (!isFileLoaded || !selectedFile) {
      console.log('⚠️ File not ready, ignoring change')
      return
    }
    
    // Update local state immediately
    setFileContent(content)
    
    // Only process if content actually changed
    if (content !== lastSavedContentRef.current) {
      setSaveStatus('unsaved')
      
      // The unified editor handles its own saving timing based on mode
      // We just need to provide the save function
      await saveToFile(content, `${editorMode}-auto`)
    }
  }, [editorMode, isFileLoaded, selectedFile, setSaveStatus, saveToFile])

  const handleClose = async () => {
    if (selectedFile && fileContent && fileContent !== lastSavedContentRef.current) {
      console.log('💾 Saving before close...')
      await saveToFile(fileContent, 'before-close')
    }
    closeFile()
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
              ✨ Unified Crepe editor with collaborative & solo modes
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
          <div className="text-xs text-blue-600 mt-2">
            Preparing for {editorMode} mode
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Enhanced file header */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">{selectedFile}</span>
          <span className="text-xs text-muted-foreground">
            • {fileContent?.length || 0} chars
          </span>
          
          <div className="flex items-center gap-1 text-xs">
            {editorMode === 'collaborative' ? (
              <>
                <Users className="h-3 w-3 text-blue-600" />
                <span className="text-blue-600">Collaborative</span>
              </>
            ) : (
              <span className="text-gray-600">Solo</span>
            )}
            
            {totalSaves > 0 && (
              <span className="bg-green-100 text-green-700 px-1 rounded text-xs ml-1">
                {totalSaves} saves
              </span>
            )}
            
            {lastSaveTime && (
              <span className="text-green-600 text-xs ml-1">
                • {lastSaveTime.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
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
          
          {/* Editor Mode Selector */}
          <div className="relative">
            <button
              onClick={() => setShowModeDropdown(!showModeDropdown)}
              className="flex items-center gap-2 px-3 py-1 text-xs rounded bg-white border hover:bg-gray-50 transition-colors"
              title="Switch editor mode"
            >
              <span>{currentMode?.icon}</span>
              <span>{currentMode?.label}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            
            {showModeDropdown && (
              <div className="absolute right-0 top-full mt-1 w-96 bg-white border rounded-lg shadow-lg z-50">
                {editorModes.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => {
                      setEditorMode(mode.value)
                      setShowModeDropdown(false)
                    }}
                    className={`w-full text-left px-3 py-3 text-xs hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                      editorMode === mode.value ? 'bg-blue-50 text-blue-700' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span>{mode.icon}</span>
                      <span className="font-medium">{mode.label}</span>
                      {editorMode === mode.value && <span className="text-blue-500">✓</span>}
                    </div>
                    <div className="text-gray-600 text-xs mb-1">
                      {mode.description}
                    </div>
                    <div className={`text-xs mt-1 ${mode.value === 'collaborative' ? 'text-green-600' : 'text-blue-600'}`}>
                      ✅ Same Crepe editor • {mode.value === 'collaborative' ? 'Y.js collaboration' : 'No Y.js conflicts'}<br/>
                      ✅ Unified styling • Consistent features<br/>
                      ✅ Auto-save • File persistence
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
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

      {/* Unified Crepe Editor */}
      <div className="flex-1 overflow-hidden">
        <UnifiedCrepeEditor
          key={`unified-${editorMode}-${selectedFile}-${isFileLoaded}`}
          documentId={documentId}
          initialContent={fileContent}
          onChange={handleEditorChange}
          wsUrl={process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234'}
          collaborative={editorMode === 'collaborative'}
        />
      </div>
      
      {/* Click outside to close dropdown */}
      {showModeDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowModeDropdown(false)}
        />
      )}
    </div>
  )
}