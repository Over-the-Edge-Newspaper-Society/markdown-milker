// src/components/editor/editor-area.tsx (Fixed - Better Key Strategy)
'use client'

import { useEditorStore } from '@/lib/stores/editor-store'
import { useFileStore } from '@/lib/stores/file-store'
import { SettingsManager } from '@/lib/settings'
import { UnifiedCrepeEditor } from './UnifiedCrepeEditor'
import { DocsPreview } from '../preview/DocsPreview'
import { FrontmatterEditor } from './FrontmatterEditor'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEffect, useCallback, useState, useMemo, useRef } from 'react'
import { X, FileText, Save, Users, User, Images, Book, Edit3 } from 'lucide-react'
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
  const [markdownOnly, setMarkdownOnly] = useState('')
  // Initialize editor mode from settings
  const [editorMode, setEditorMode] = useState<EditorMode>(() => {
    const settings = SettingsManager.getSettings()
    return settings?.editor?.defaultMode || 'solo'
  })
  const [isFileLoaded, setIsFileLoaded] = useState(false)
  const [totalSaves, setTotalSaves] = useState(0)
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)
  const [isManualSaving, setIsManualSaving] = useState(false)
  const [showSaveStatus, setShowSaveStatus] = useState(false)
  const [editorInstanceId, setEditorInstanceId] = useState(0)
  const [activeTab, setActiveTab] = useState('editor')
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
            
            // Separate frontmatter from markdown
            const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
            const match = content.match(frontmatterRegex);
            
            if (match) {
              setMarkdownOnly(match[2] || '');
            } else {
              setMarkdownOnly(content);
            }
            
            setContent(content)
            setFileContent(content)
            lastSavedContentRef.current = content
            setSaveStatus('saved')
            setIsFileLoaded(true)
            console.log('✅ File loaded successfully')
          } else {
            setContent('')
            setFileContent('')
            setMarkdownOnly('')
            lastSavedContentRef.current = ''
            setSaveStatus('unsaved')
            setIsFileLoaded(true)
          }
        })
        .catch(error => {
          console.error('❌ Failed to load file:', error)
          setContent('')
          setFileContent('')
          setMarkdownOnly('')
          lastSavedContentRef.current = ''
          setSaveStatus('unsaved')
          setIsFileLoaded(true)
        })
    } else {
      setCurrentFilePath(null)
      setContent('')
      setFileContent('')
      setMarkdownOnly('')
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

  // Handle frontmatter changes
  const handleFrontmatterChange = useCallback(async (fullContent: string, markdownContent: string) => {
    if (!isFileLoaded || !selectedFile) {
      return
    }
    
    // Update local state with the full content (frontmatter + markdown)
    setFileContent(fullContent)
    setMarkdownOnly(markdownContent)
    
    if (fullContent !== lastSavedContentRef.current) {
      setSaveStatus('unsaved')
      await saveToFile(fullContent, 'frontmatter-change')
    }
  }, [isFileLoaded, selectedFile, setSaveStatus, saveToFile])

  // Handle markdown editor changes (reconstruct with existing frontmatter)
  const handleMarkdownChange = useCallback(async (markdownContent: string) => {
    if (!isFileLoaded || !selectedFile) {
      return
    }
    
    // Extract frontmatter from current fileContent
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?/;
    const match = fileContent.match(frontmatterRegex);
    
    let fullContent = markdownContent;
    if (match) {
      // Preserve existing frontmatter
      fullContent = `---\n${match[1]}\n---\n${markdownContent}`;
    }
    
    setFileContent(fullContent)
    setMarkdownOnly(markdownContent)
    
    if (fullContent !== lastSavedContentRef.current) {
      setSaveStatus('unsaved')
      await saveToFile(fullContent, `${editorMode}-auto`)
    }
  }, [editorMode, isFileLoaded, selectedFile, fileContent, setSaveStatus, saveToFile])

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
      {/* Unified 2-row header */}
      <div className="border-b bg-muted/30">
        {/* Row 1: File path, tabs, and actions */}
        <div className="px-4 h-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">{selectedFile}</span>
            <span className="text-xs text-muted-foreground">• {fileContent?.length || 0} chars</span>
            
            {/* Tab buttons inline */}
            <div className="flex items-center ml-4">
              <button
                onClick={() => setActiveTab('editor')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
                  activeTab === 'editor'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <Edit3 className="h-3.5 w-3.5" />
                Editor
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded ml-1 transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <Book className="h-3.5 w-3.5" />
                Docs Preview
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={openEditorImagePicker}
              className="h-7 px-2"
              title="Images"
            >
              <Images className="h-3.5 w-3.5" />
            </Button>
            <button
              onClick={manualSave}
              disabled={isManualSaving || isSavingRef.current}
              className="h-7 px-2.5 text-xs rounded hover:bg-muted transition-colors flex items-center gap-1"
            >
              <Save className="h-3 w-3" />
              Save
            </button>
            <button
              onClick={handleClose}
              className="h-7 w-7 rounded hover:bg-muted transition-colors flex items-center justify-center"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Row 2: Combined status and frontmatter line */}
        <div className="px-4 h-8 flex items-center justify-between text-xs border-t">
          <div className="flex items-center gap-2">
            {/* Mode status */}
            {editorMode === 'collaborative' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <Users className="h-3.5 w-3.5 text-green-600" />
                <span className="font-medium text-green-600">Collaborative</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <User className="h-3.5 w-3.5 text-blue-600" />
                <span className="font-medium text-blue-600">Solo</span>
              </>
            )}
            
            {/* Save info */}
            {totalSaves > 0 && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-green-600">{totalSaves} saves</span>
              </>
            )}
            {lastSaveTime && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-blue-600">{lastSaveTime.toLocaleTimeString()}</span>
              </>
            )}
            
            {/* Frontmatter info - will be populated by FrontmatterEditor */}
            <span id="frontmatter-info" className="flex items-center gap-2"></span>
          </div>
          
          {/* Right-aligned toggle button */}
          <button
            onClick={toggleMode}
            className="px-2 py-1 rounded text-xs bg-muted hover:bg-muted/80 transition-colors font-medium"
            title={`Switch to ${editorMode === 'collaborative' ? 'solo' : 'collaborative'} mode`}
          >
            Switch to {editorMode === 'collaborative' ? 'Solo' : 'Collaborative'}
          </button>
        </div>
      </div>

      {/* Content area - Fixed overflow to allow menus to show */}
      <div className="flex-1 flex flex-col relative">
        
        {/* Tab Content - Allow overflow for editor menus */}
        <div className="flex-1 relative">
          {activeTab === 'editor' && (
            <div className="h-full flex flex-col">
              <FrontmatterEditor
                content={fileContent}
                onChange={handleFrontmatterChange}
                inlineMode={true}
              />
              <div ref={editorRef} className="flex-1 relative min-h-0">
                <UnifiedCrepeEditor
                  key={editorKey} // This ensures complete remount on mode/file changes
                  documentId={documentId}
                  initialContent={markdownOnly}
                  onChange={handleMarkdownChange}
                  wsUrl={process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:1234'}
                  collaborative={editorMode === 'collaborative'}
                  onImageLibraryOpen={handleImageLibraryOpen}
                  hideStatusBar={true} // Hide the internal status bar since we show it above
                />
              </div>
            </div>
          )}
          
          {activeTab === 'preview' && (
            <div className="h-full">
              <DocsPreview 
                className="w-full h-full" 
                isFullScreen={true}
                currentFilePath={selectedFile}
                onClose={() => setActiveTab('editor')}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}