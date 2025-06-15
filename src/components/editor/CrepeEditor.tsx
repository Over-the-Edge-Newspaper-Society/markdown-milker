// src/components/editor/CrepeEditor.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/nord.css'

interface CrepeEditorProps {
  value?: string
  onChange?: (markdown: string) => void
}

// Global registry to prevent multiple instances
const editorRegistry = new Set<string>()

export function CrepeEditor({ value = '', onChange }: CrepeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Crepe | null>(null)
  const [isReady, setIsReady] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const instanceIdRef = useRef<string>('')
  const lastValueRef = useRef<string>(value)
  const onChangeRef = useRef(onChange)

  // Keep onChange ref current
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Generate unique instance ID
  useEffect(() => {
    instanceIdRef.current = `editor-${Date.now()}-${Math.random()}`
  }, [])

  const cleanup = useCallback(() => {
    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    
    // Destroy editor
    if (editorRef.current) {
      try {
        editorRef.current.destroy()
      } catch (error) {
        console.error('Error destroying editor:', error)
      }
      editorRef.current = null
    }
    
    // Clean DOM
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }
    
    // Remove from registry
    if (instanceIdRef.current) {
      editorRegistry.delete(instanceIdRef.current)
    }
    
    setIsReady(false)
  }, [])

  // Initialize editor ONLY ONCE - no value dependency!
  const initializeEditor = useCallback(async () => {
    // Prevent multiple instances
    if (!containerRef.current || editorRef.current) {
      return
    }

    // Check if another instance is already running
    if (editorRegistry.size > 0) {
      console.warn('Another editor instance is already running')
      return
    }

    try {
      // Register this instance
      editorRegistry.add(instanceIdRef.current)
      
      // Ensure container is clean
      containerRef.current.innerHTML = ''
      
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (!containerRef.current) {
        editorRegistry.delete(instanceIdRef.current)
        return
      }

      console.log('🎯 Creating Milkdown editor (one time only)')

      const editor = new Crepe({
        root: containerRef.current,
        defaultValue: value, // Use initial value only
        featureConfigs: {
          toolbar: {
            config: [
              'heading',
              'bold',
              'italic',
              'strike',
              'divider',
              'bullet_list',
              'ordered_list',
              'task_list',
              'divider',
              'code_inline',
              'code_block',
              'link',
              'image',
              'table',
              'divider',
              'quote'
            ]
          },
          preview: false,
        }
      })

      await editor.create()
      editorRef.current = editor
      lastValueRef.current = value
      setIsReady(true)

      console.log('✅ Milkdown editor ready')

      // Set up change detection
      intervalRef.current = setInterval(() => {
        if (editorRef.current) {
          try {
            const content = editorRef.current.getMarkdown()
            if (content !== lastValueRef.current) {
              lastValueRef.current = content
              if (onChangeRef.current) {
                onChangeRef.current(content)
              }
            }
          } catch (error) {
            console.error('Error reading editor content:', error)
          }
        }
      }, 1000)
    } catch (error) {
      console.error('Failed to create editor:', error)
      editorRegistry.delete(instanceIdRef.current)
      cleanup()
    }
  }, [cleanup]) // NO value or onChange dependency!

  // Handle content updates separately (smooth updates, no remount)
  useEffect(() => {
    if (isReady && editorRef.current && value !== lastValueRef.current) {
      try {
        console.log('📝 Updating content smoothly (no remount)')
        editorRef.current.setMarkdown(value)
        lastValueRef.current = value
      } catch (error) {
        console.error('Error setting editor content:', error)
      }
    }
  }, [value, isReady]) // This effect only updates content

  // Initialize editor ONLY ONCE on mount
  useEffect(() => {
    console.log('🚀 Initializing editor (mount only)')
    const timer = setTimeout(() => {
      initializeEditor()
    }, 50)

    return () => {
      console.log('🧹 Cleaning up editor (unmount only)')
      clearTimeout(timer)
      cleanup()
    }
  }, []) // Empty dependency array = run only on mount/unmount

  return (
    <div className="h-full w-full relative">
      <div 
        ref={containerRef}
        className="h-full min-h-[400px] w-full"
        style={{ 
          height: '100%',
          width: '100%'
        }}
      />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-background/80">
          Loading editor...
        </div>
      )}
    </div>
  )
}