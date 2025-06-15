// src/components/editor/ExtendedCrepeEditor.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { collab } from '@milkdown/plugin-collab'
import { 
  ExtendedCrepeEditorProps, 
  ConnectionStatus, 
  EditorState,
  CrepeInstance,
  CollaborationCallbacks 
} from '@/types/editor'
import { createCrepeInstance, setCrepeContent } from '@/utils/crepe-api'
import { CollaborationManager } from '@/utils/collaboration-manager'
import { ContentSyncManager, createContentChangeDetector } from '@/utils/content-sync'

// Import Crepe styles
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

// Custom styles for container consistency
const editorContainerStyles = `
  .crepe-editor-container {
    height: 100% !important;
    width: 100% !important;
    overflow: hidden;
  }
  
  .crepe-editor-container .milkdown {
    height: 100% !important;
    max-height: none !important;
    overflow-y: auto;
  }
  
  .crepe-editor-container .editor {
    min-height: 300px;
    height: auto;
  }
`

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('extended-crepe-styles')) {
  const styleSheet = document.createElement('style')
  styleSheet.id = 'extended-crepe-styles'
  styleSheet.textContent = editorContainerStyles
  document.head.appendChild(styleSheet)
}

export function ExtendedCrepeEditor({ 
  documentId, 
  initialContent = '', 
  onChange,
  wsUrl = 'ws://localhost:1234'
}: ExtendedCrepeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<CrepeInstance | null>(null)
  const collaborationManagerRef = useRef<CollaborationManager | null>(null)
  const contentSyncManagerRef = useRef<ContentSyncManager | null>(null)
  const isInitializedRef = useRef(false)
  const onChangeRef = useRef(onChange)

  // Editor state
  const [editorState, setEditorState] = useState<EditorState>({
    isReady: false,
    connectionStatus: 'connecting',
    collaborators: 0,
    hasError: false,
    isLoading: true,
    errorMessage: '',
    isInitialized: false
  })

  // Keep onChange ref current
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Collaboration callbacks
  const collaborationCallbacks: CollaborationCallbacks = {
    onStatusChange: (status: ConnectionStatus) => {
      setEditorState(prev => ({ ...prev, connectionStatus: status }))
    },
    onCollaboratorsChange: (count: number) => {
      setEditorState(prev => ({ ...prev, collaborators: count }))
    },
    onError: (error: string) => {
      console.warn('🔄 Collaboration failed, falling back to limited mode:', error)
      fallbackToLimitedMode(error)
    },
    onReady: () => {
      setEditorState(prev => ({ 
        ...prev, 
        isReady: true, 
        isLoading: false,
        connectionStatus: 'synced'
      }))
    }
  }

  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up Extended Crepe Editor')
    
    // Cleanup content sync
    if (contentSyncManagerRef.current) {
      contentSyncManagerRef.current.destroy()
      contentSyncManagerRef.current = null
    }
    
    // Cleanup collaboration
    if (collaborationManagerRef.current) {
      collaborationManagerRef.current.destroy()
      collaborationManagerRef.current = null
    }
    
    // Cleanup Crepe editor
    if (crepeRef.current) {
      try {
        crepeRef.current.destroy()
      } catch (error) {
        console.error('Error destroying Crepe editor:', error)
      }
      crepeRef.current = null
    }
    
    // Clean DOM
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }
    
    // Reset state
    setEditorState({
      isReady: false,
      connectionStatus: 'disconnected',
      collaborators: 0,
      hasError: false,
      isLoading: true,
      errorMessage: '',
      isInitialized: false
    })
    
    isInitializedRef.current = false
  }, [])

  const fallbackToLimitedMode = useCallback((reason: string) => {
    console.log(`⚠️ Falling back to limited mode: ${reason}`)
    
    // Cleanup collaboration but keep the Crepe editor
    if (collaborationManagerRef.current) {
      collaborationManagerRef.current.destroy()
      collaborationManagerRef.current = null
    }
    
    // Update state to limited mode first
    setEditorState(prev => ({
      ...prev,
      hasError: true,
      errorMessage: `Limited mode - ${reason}`,
      isReady: true,
      isLoading: false,
      connectionStatus: 'connected'
    }))
    
    // Set initial content if editor exists and content is missing
    if (crepeRef.current && initialContent && initialContent.trim()) {
      console.log('🔄 Ensuring content is visible in limited mode...')
      
      // Give the editor a moment to be ready, then set content
      setTimeout(() => {
        if (crepeRef.current) {
          setCrepeContent(crepeRef.current, initialContent)
          console.log('✅ Content set in limited mode')
        }
      }, 200)
    }
    
    console.log('✅ Extended Crepe running in limited mode - single-user editing with full Crepe features')
  }, [initialContent])

  const setupContentMonitoring = useCallback(() => {
    if (!crepeRef.current) return

    console.log('📊 Setting up content monitoring...')
    
    contentSyncManagerRef.current = createContentChangeDetector(
      crepeRef.current,
      initialContent,
      (content: string) => {
        if (onChangeRef.current) {
          onChangeRef.current(content)
        }
      }
    )
  }, [initialContent])

  const attemptCollaborationSetup = useCallback(async (crepe: CrepeInstance) => {
    console.log('🔍 Attempting to add collaboration to Crepe editor...')
    console.log('⚠️  Note: This is experimental and will likely fall back to limited mode')
    
    try {
      // Try to access internal editor
      const internalEditor = (crepe as any).editor || (crepe as any)._editor
      
      if (!internalEditor) {
        throw new Error('Cannot access internal editor')
      }

      console.log('🔍 Found Crepe internal editor, checking collaboration compatibility...')

      // Pre-check: See if the editor has the required contexts for collaboration
      const isCompatible = await checkEditorCompatibility(internalEditor)
      
      if (!isCompatible) {
        throw new Error('Editor contexts not compatible with collaboration')
      }

      // Try to add collaboration plugin - this will almost certainly fail
      try {
        await internalEditor.use(collab)
        console.log('🎉 Miraculously succeeded adding collab plugin!')
        
        // If we somehow get here, set up full collaboration
        collaborationManagerRef.current = new CollaborationManager(
          wsUrl,
          documentId,
          initialContent,
          collaborationCallbacks
        )
        
        await collaborationManagerRef.current.setupCollaboration(crepe, internalEditor)
        
      } catch (pluginError) {
        console.warn('❌ Cannot add collab plugin (expected):', (pluginError as Error).message)
        
        // Check if this is the specific context error we're trying to avoid
        if ((pluginError as Error).message.includes('Context') && 
            (pluginError as Error).message.includes('not found')) {
          throw new Error('Milkdown contexts incompatible - editor created without collaboration support')
        } else {
          throw new Error('Plugin injection failed - Milkdown editors are immutable after creation')
        }
      }
      
    } catch (collabError) {
      console.warn('⚠️ Collaboration setup failed (this is expected):', (collabError as Error).message)
      
      // Expected failure - fall back to limited mode with a helpful message
      const reason = (collabError as Error).message.includes('contexts incompatible') 
        ? 'Crepe editor not built with collaboration support'
        : 'Cannot modify editor after creation'
        
      fallbackToLimitedMode(reason)
    }
  }, [wsUrl, documentId, initialContent, collaborationCallbacks, fallbackToLimitedMode])

  // Helper function to check if editor has required contexts
  const checkEditorCompatibility = async (internalEditor: any): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        internalEditor.action((ctx: any) => {
          try {
            // Try to access some basic contexts that should exist
            ctx.get('schemaCtx')
            console.log('✅ Editor has basic contexts')
            resolve(true)
          } catch (error) {
            console.warn('❌ Editor missing basic contexts:', (error as Error).message)
            resolve(false)
          }
        })
      } catch (error) {
        console.warn('❌ Cannot check editor compatibility:', (error as Error).message)
        resolve(false)
      }
    })
  }

  const initializeEditor = useCallback(async () => {
    if (!containerRef.current || crepeRef.current || isInitializedRef.current) {
      return
    }

    isInitializedRef.current = true
    
    try {
      // Ensure container is clean
      containerRef.current.innerHTML = ''
      
      console.log('🎯 Creating Crepe Editor (single-user mode)')
      console.log('💡 Note: Crepe editors cannot be retrofitted with collaboration')

      // Create Crepe editor with initial content
      const crepe = await createCrepeInstance(containerRef.current, initialContent)
      crepeRef.current = crepe

      console.log('✅ Crepe editor created successfully')

      // Set up content monitoring
      setupContentMonitoring()

      // Skip collaboration attempt entirely - go straight to "limited mode" 
      // which is really just "Crepe mode"
      console.log('💡 Skipping collaboration setup - using single-user Crepe mode')
      
      setEditorState(prev => ({
        ...prev,
        hasError: false, // Not really an error - this is the intended mode
        errorMessage: '',
        isReady: true,
        isLoading: false,
        connectionStatus: 'connected'
      }))
      
      console.log('✅ Crepe Editor ready - full-featured single-user editing')

    } catch (error) {
      console.error('Failed to create Crepe editor:', error)
      setEditorState(prev => ({
        ...prev,
        hasError: true,
        errorMessage: 'Failed to initialize editor',
        isLoading: false
      }))
      isInitializedRef.current = false
    }
  }, [initialContent, setupContentMonitoring])

  // Initialize editor on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      console.log('🚀 Initializing Extended Crepe Editor')
      const timer = setTimeout(() => {
        initializeEditor().catch(error => {
          console.error('Failed to initialize Extended Crepe editor:', error)
          setEditorState(prev => ({
            ...prev,
            hasError: true,
            errorMessage: 'Failed to initialize editor',
            isLoading: false
          }))
        })
      }, 50)

      return () => clearTimeout(timer)
    }
  }, [initializeEditor])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Extended Crepe Editor unmounting')
      cleanup()
    }
  }, [cleanup])

  const getStatusColor = () => {
    if (editorState.hasError) return 'bg-red-500'
    if (editorState.connectionStatus === 'connected') return 'bg-blue-500' // Blue for single-user
    if (editorState.connectionStatus === 'connecting') return 'bg-yellow-500 animate-pulse'
    return 'bg-green-500'
  }

  const getStatusText = () => {
    if (editorState.hasError) return `Error: ${editorState.errorMessage}`
    if (editorState.isLoading) return 'Loading...'
    if (editorState.connectionStatus === 'connected') return 'Crepe Editor (Single User)'
    return 'Crepe Editor'
  }

  return (
    <div className="h-full w-full relative">
      {/* Status bar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30 text-sm">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          <span>{getStatusText()}</span>
          
          {editorState.connectionStatus === 'connected' && !editorState.hasError && (
            <>
              <span className="text-blue-600 font-medium">• Full Crepe Features</span>
              <span className="text-gray-600 text-xs">• Auto-save</span>
            </>
          )}
          
          {editorState.hasError && (
            <span className="text-red-600 text-xs">• {editorState.errorMessage}</span>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground">
          {documentId} • Single User
        </div>
      </div>

      {/* Editor container with consistent styling */}
      <div 
        ref={containerRef}
        className="h-full w-full"
        style={{ 
          height: 'calc(100% - 48px)', // Subtract status bar height
          width: '100%',
          overflow: 'hidden' // Prevent layout shifts
        }}
      />
      
      {!editorState.isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-background/80">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <div className="font-medium">
              {editorState.isLoading ? 'Creating Crepe Editor...' : 'Preparing editor...'}
            </div>
            <div className="text-xs mt-1 text-muted-foreground">
              Loading beautiful single-user markdown editor
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Full Crepe features • Auto-save • No collaboration
            </div>
          </div>
        </div>
      )}
    </div>
  )
}