// src/components/editor/editor-area.tsx
'use client'

import { useEditorStore } from '@/lib/stores/editor-store'
import { useFileStore } from '@/lib/stores/file-store'
import { CollaborativeEditor } from './CollaborativeEditor'
import { SimpleEditor } from './SimpleEditor'
// Optional imports - these components may not exist yet
let CrepeCollaborativeEditor: any = null
let ExtendedCrepeEditor: any = null

try {
  CrepeCollaborativeEditor = require('./CrepeCollaborativeEditor').CrepeCollaborativeEditor
} catch (e) {
  console.log('CrepeCollaborativeEditor not available yet')
}

try {
  ExtendedCrepeEditor = require('./ExtendedCrepeEditor').ExtendedCrepeEditor
} catch (e) {
  console.log('ExtendedCrepeEditor not available yet')
}
import { SaveStatus } from './save-status'
import { useEffect, useCallback, useState, useMemo } from 'react'
import { X, FileText, Users, ChevronDown } from 'lucide-react'
import debounce from 'lodash/debounce'

type EditorMode = 'crepe-solo' | 'crepe-styled-collab' | 'crepe-extended-collab' | 'vanilla-collab'

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
  const [editorMode, setEditorMode] = useState<EditorMode>('crepe-solo')
  const [isFileLoaded, setIsFileLoaded] = useState(false)
  const [showModeDropdown, setShowModeDropdown] = useState(false)

  // Memoize documentId at the top level
  const documentId = useMemo(() => selectedFile?.replace(/[^a-zA-Z0-9]/g, '_') || '', [selectedFile])

  const editorModes = [
    { 
      value: 'crepe-solo' as EditorMode, 
      label: 'Crepe Solo', 
      description: 'Beautiful Crepe editor, single-user',
      icon: '✨'
    },
    ...(CrepeCollaborativeEditor ? [{ 
      value: 'crepe-styled-collab' as EditorMode, 
      label: 'Crepe-Styled Collaborative', 
      description: 'Crepe design with collaboration',
      icon: '🎨'
    }] : []),
    ...(ExtendedCrepeEditor ? [{ 
      value: 'crepe-extended-collab' as EditorMode, 
      label: 'Extended Crepe', 
      description: 'Real Crepe + collaboration (experimental)',
      icon: '🔬'
    }] : []),
    { 
      value: 'vanilla-collab' as EditorMode, 
      label: 'Vanilla Collaborative', 
      description: 'Basic Milkdown with collaboration',
      icon: '⚡'
    }
  ]

  const currentMode = editorModes.find(mode => mode.value === editorMode) || editorModes[0]

  // Debug logging
  console.log('📊 EditorArea render:', {
    selectedFile,
    currentFilePath,
    contentLength: currentContent?.length || 0,
    fileContentLength: fileContent?.length || 0,
    hasContent: !!currentContent,
    editorMode,
    isFileLoaded
  })

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (content: string) => {
      if (selectedFile && content !== undefined && isFileLoaded) {
        try {
          console.log('💾 Auto-saving:', selectedFile, `(${content.length} chars)`)
          setSaveStatus('saving')
          
          setContent(content)
          await saveFile()
          setSaveStatus('saved')
          console.log('✅ Auto-save complete')
        } catch (error) {
          console.error('❌ Failed to save:', error)
          setSaveStatus('unsaved')
        }
      } else {
        console.log('⏸️ Skipping save - file not loaded yet')
      }
    }, 2000),
    [selectedFile, saveFile, setSaveStatus, setContent, isFileLoaded]
  )

  // Load file content when selected
  useEffect(() => {
    if (selectedFile) {
      console.log('📁 Loading file:', selectedFile)
      setCurrentFilePath(selectedFile)
      setSaveStatus('saving')
      setIsFileLoaded(false)
      
      fetch(`/api/files?path=${encodeURIComponent(selectedFile)}`)
        .then(res => res.json())
        .then(data => {
          console.log('📄 File loaded:', {
            file: selectedFile,
            hasContent: data.content !== undefined,
            contentLength: data.content?.length || 0,
            preview: data.content?.substring(0, 100) + '...'
          })
          
          if (data.content !== undefined) {
            const content = data.content || ''
            setContent(content)
            setFileContent(content)
            setSaveStatus('saved')
            setIsFileLoaded(true)
          } else {
            console.warn('⚠️ No content in response')
            setContent('')
            setFileContent('')
            setSaveStatus('unsaved')
            setIsFileLoaded(true)
          }
        })
        .catch(error => {
          console.error('❌ Failed to load file:', error)
          setContent('')
          setFileContent('')
          setSaveStatus('unsaved')
          setIsFileLoaded(true)
        })
    } else {
      console.log('📁 No file selected, clearing content')
      setCurrentFilePath(null)
      setContent('')
      setFileContent('')
      setSaveStatus('saved')
      setIsFileLoaded(false)
    }
  }, [selectedFile, setContent, setCurrentFilePath, setSaveStatus])

  // Handle editor content changes
  const handleEditorChange = useCallback((content: string) => {
    console.log('✏️ Editor content changed:', {
      contentLength: content.length,
      firstLine: content.split('\n')[0]?.substring(0, 50) + '...',
      isFileLoaded,
      mode: editorMode
    })
    
    if (isFileLoaded) {
      setFileContent(content)
      setSaveStatus('unsaved')
      debouncedSave(content)
    } else {
      console.log('⏸️ Ignoring content change - file not loaded yet')
    }
  }, [debouncedSave, setSaveStatus, isFileLoaded, editorMode])

  const handleClose = async () => {
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

  const isCollaborative = editorMode !== 'crepe-solo' && 
    (editorMode === 'vanilla-collab' || 
     (editorMode === 'crepe-styled-collab' && CrepeCollaborativeEditor) || 
     (editorMode === 'crepe-extended-collab' && ExtendedCrepeEditor))

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
              ✨ Starting with beautiful Crepe editor • Auto-save enabled
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

  const renderEditor = () => {
    const editorKey = `${editorMode}-${selectedFile}`
    const commonProps = {
      documentId,
      initialContent: fileContent,
      onChange: handleEditorChange,
      wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234'
    }

    switch (editorMode) {
      case 'crepe-solo':
        return (
          <SimpleEditor
            key={`simple-${selectedFile}`}
            initialContent={fileContent}
            onChange={handleEditorChange}
          />
        )
      
      case 'crepe-styled-collab':
        if (CrepeCollaborativeEditor) {
          return <CrepeCollaborativeEditor key={editorKey} {...commonProps} />
        } else {
          console.warn('CrepeCollaborativeEditor not available, falling back to vanilla collab')
          return <CollaborativeEditor key={editorKey} {...commonProps} />
        }
      
      case 'crepe-extended-collab':
        if (ExtendedCrepeEditor) {
          return <ExtendedCrepeEditor key={editorKey} {...commonProps} />
        } else {
          console.warn('ExtendedCrepeEditor not available, falling back to vanilla collab')
          return <CollaborativeEditor key={editorKey} {...commonProps} />
        }
      
      case 'vanilla-collab':
        return <CollaborativeEditor key={editorKey} {...commonProps} />
      
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
      {/* File header with mode selector */}
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
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border rounded-lg shadow-lg z-50">
                {editorModes.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => {
                      setEditorMode(mode.value)
                      setShowModeDropdown(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors ${
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