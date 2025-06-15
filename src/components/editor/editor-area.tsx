// src/components/editor/editor-area.tsx
'use client'

import { useEditorStore } from '@/lib/stores/editor-store'
import { useFileStore } from '@/lib/stores/file-store'
import { SimpleEditor } from './SimpleEditor'

// Import the working collaborative Crepe editor
let WorkingCollaborativeCrepe: any = null
try {
  WorkingCollaborativeCrepe = require('./WorkingCollaborativeCrepe').WorkingCollaborativeCrepe
} catch (e) {
  console.log('WorkingCollaborativeCrepe not available')
}

import { SaveStatus } from './save-status'
import { useEffect, useCallback, useState, useMemo, useRef } from 'react'
import { X, FileText, Users, ChevronDown, Save } from 'lucide-react'
import debounce from 'lodash/debounce'

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
  const [collaborativeSaves, setCollaborativeSaves] = useState(0)
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)
  const [isManualSaving, setIsManualSaving] = useState(false)

  // Track saving state to prevent race conditions
  const isSavingRef = useRef(false)
  const lastSavedContentRef = useRef('')

  // Memoize documentId at the top level
  const documentId = useMemo(() => selectedFile?.replace(/[^a-zA-Z0-9]/g, '_') || '', [selectedFile])

  const editorModes = [
    ...(WorkingCollaborativeCrepe ? [{ 
      value: 'collaborative' as EditorMode, 
      label: 'Collaborative + File Persistence', 
      description: 'Real-time collaboration with automatic file saving',
      icon: '🔄'
    }] : []),
    { 
      value: 'solo' as EditorMode, 
      label: 'Solo Mode', 
      description: 'Single-user Crepe editor',
      icon: '✨'
    }
  ]

  const currentMode = editorModes.find(mode => mode.value === editorMode) || editorModes[0]

  // ✅ SOLUTION 1: Immediate save function for collaborative mode (no debouncing)
  const saveToFileImmediate = useCallback(async (content: string, context: string = 'unknown') => {
    // Prevent concurrent saves
    if (isSavingRef.current) {
      console.log('🔒 Save already in progress, queueing...')
      return false
    }

    // Don't save if content hasn't actually changed
    if (content === lastSavedContentRef.current) {
      console.log('📋 Content unchanged, skipping save')
      return true
    }

    if (!selectedFile || !isFileLoaded) {
      console.log('⚠️ No file selected or not loaded yet')
      return false
    }

    try {
      isSavingRef.current = true
      setSaveStatus('saving')
      
      console.log(`💾 IMMEDIATE SAVE [${context}]:`, {
        file: selectedFile,
        contentLength: content.length,
        previousLength: lastSavedContentRef.current.length,
        mode: editorMode
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
      
      if (editorMode === 'collaborative') {
        setCollaborativeSaves(prev => prev + 1)
      }

      console.log(`✅ SAVE SUCCESSFUL [${context}]:`, content.length, 'chars saved')
      return true
      
    } catch (error) {
      console.error(`❌ SAVE FAILED [${context}]:`, error)
      setSaveStatus('unsaved')
      return false
    } finally {
      isSavingRef.current = false
    }
  }, [selectedFile, isFileLoaded, editorMode, setContent, saveFile, setSaveStatus])

  // ✅ SOLUTION 2: Debounced save for solo mode only
  const debouncedSoloSave = useCallback(
    debounce(async (content: string) => {
      if (editorMode === 'solo') {
        await saveToFileImmediate(content, 'solo-debounced')
      }
    }, 2000),
    [editorMode, saveToFileImmediate]
  )

  // ✅ SOLUTION 3: Manual save function
  const manualSave = useCallback(async () => {
    if (!selectedFile || isManualSaving) return
    
    setIsManualSaving(true)
    try {
      const success = await saveToFileImmediate(fileContent, 'manual')
      if (success) {
        console.log('✅ Manual save completed')
      }
    } finally {
      setIsManualSaving(false)
    }
  }, [selectedFile, fileContent, saveToFileImmediate, isManualSaving])

  // Load file content when selected
  useEffect(() => {
    if (selectedFile) {
      console.log('📁 Loading file:', selectedFile, 'Mode:', editorMode)
      setCurrentFilePath(selectedFile)
      setSaveStatus('saving')
      setIsFileLoaded(false)
      setCollaborativeSaves(0)
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
      setCollaborativeSaves(0)
      setLastSaveTime(null)
    }
  }, [selectedFile, setContent, setCurrentFilePath, setSaveStatus, editorMode])

  // ✅ SOLUTION 4: Handle editor content changes with different strategies per mode
  const handleEditorChange = useCallback(async (content: string) => {
    console.log('✏️ Editor content changed:', {
      contentLength: content.length,
      mode: editorMode,
      previousLength: lastSavedContentRef.current.length,
      hasChanged: content !== lastSavedContentRef.current
    })
    
    if (!isFileLoaded) {
      console.log('⚠️ File not loaded yet, ignoring change')
      return
    }
    
    // Update local state immediately
    setFileContent(content)
    setSaveStatus('unsaved')
    
    // Different saving strategies based on editor mode
    if (editorMode === 'collaborative') {
      // Collaborative mode: immediate save for every change
      console.log('🤝 Collaborative mode: immediate save')
      await saveToFileImmediate(content, 'collaborative-auto')
    } else {
      // Solo mode: debounced save
      console.log('✨ Solo mode: debounced save')
      debouncedSoloSave(content)
    }
  }, [editorMode, isFileLoaded, setSaveStatus, saveToFileImmediate, debouncedSoloSave])

  const handleClose = async () => {
    if (selectedFile && fileContent && fileContent !== lastSavedContentRef.current) {
      console.log('💾 Saving before close...')
      await saveToFileImmediate(fileContent, 'before-close')
    }
    closeFile()
  }

  const isCollaborative = editorMode === 'collaborative' && WorkingCollaborativeCrepe

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
              🔄 Collaborative editor with file persistence ready
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
            {editorMode === 'collaborative' ? 'Collaborative with file persistence' : 'Single-user mode'}
          </div>
        </div>
      </div>
    )
  }

  const renderEditor = () => {
    const editorKey = `${editorMode}-${selectedFile}-${isFileLoaded}`
    const commonProps = {
      documentId,
      initialContent: fileContent,
      onChange: handleEditorChange,
      wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234'
    }

    switch (editorMode) {
      case 'collaborative':
        if (WorkingCollaborativeCrepe) {
          return <WorkingCollaborativeCrepe key={editorKey} {...commonProps} />
        } else {
          console.warn('WorkingCollaborativeCrepe not available, falling back to solo mode')
          return (
            <SimpleEditor
              key={`simple-${selectedFile}`}
              initialContent={fileContent}
              onChange={handleEditorChange}
            />
          )
        }

      case 'solo':
        return (
          <SimpleEditor
            key={`simple-${selectedFile}`}
            initialContent={fileContent}
            onChange={handleEditorChange}
          />
        )
      
      default:
        return (
          <SimpleEditor
            key={`simple-${selectedFile}`}
            initialContent={fileContent}
            onChange={handleEditorChange}
          />
        )
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Enhanced file header with save information */}
      <div className="border-b px-4 py-2 flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">{selectedFile}</span>
          <span className="text-xs text-muted-foreground">
            • {fileContent?.length || 0} chars
          </span>
          
          {isCollaborative && (
            <div className="flex items-center gap-1 text-xs">
              <Users className="h-3 w-3 text-blue-600" />
              <span className="text-blue-600">Collaborative</span>
              {collaborativeSaves > 0 && (
                <span className="bg-green-100 text-green-700 px-1 rounded text-xs">
                  {collaborativeSaves} saves
                </span>
              )}
              {lastSaveTime && (
                <span className="text-green-600 text-xs">
                  • {lastSaveTime.toLocaleTimeString()}
                </span>
              )}
            </div>
          )}
          
          {editorMode === 'solo' && (
            <span className="text-gray-600 text-xs">• Solo mode</span>
          )}
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
                    <div className="text-gray-600 text-xs">
                      {mode.description}
                    </div>
                    {mode.value === 'collaborative' && (
                      <div className="text-green-600 text-xs mt-1">
                        ✅ Saves to file immediately on every change<br/>
                        ✅ Preserves work through server restarts<br/>
                        ✅ Real-time collaboration + file persistence
                      </div>
                    )}
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

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        {renderEditor()}
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