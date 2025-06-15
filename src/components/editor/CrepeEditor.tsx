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

      const editor = new Crepe({
        root: containerRef.current,
        defaultValue: value,
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

      // Set up change detection
      if (onChange) {
        intervalRef.current = setInterval(() => {
          if (editorRef.current) {
            try {
              const content = editorRef.current.getMarkdown()
              if (content !== lastValueRef.current) {
                lastValueRef.current = content
                onChange(content)
              }
            } catch (error) {
              console.error('Error reading editor content:', error)
            }
          }
        }, 1000)
      }
    } catch (error) {
      console.error('Failed to create editor:', error)
      editorRegistry.delete(instanceIdRef.current)
      cleanup()
    }
  }, [value, onChange, cleanup])

  // Update content when value prop changes
  useEffect(() => {
    if (isReady && editorRef.current && value !== lastValueRef.current) {
      try {
        editorRef.current.setMarkdown(value)
        lastValueRef.current = value
      } catch (error) {
        console.error('Error setting editor content:', error)
      }
    }
  }, [value, isReady])

  // Initialize on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      initializeEditor()
    }, 50)

    return () => {
      clearTimeout(timer)
      cleanup()
    }
  }, [initializeEditor, cleanup])

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