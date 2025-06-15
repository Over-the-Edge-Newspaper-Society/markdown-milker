'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Editor, rootCtx, defaultValueCtx } from '@milkdown/kit/core'
import { commonmark } from '@milkdown/kit/preset/commonmark'
import { nord } from '@milkdown/theme-nord'

interface SimpleEditorProps {
  initialContent?: string
  onChange?: (markdown: string) => void
}

export function SimpleEditor({ 
  initialContent = '', 
  onChange
}: SimpleEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const lastValueRef = useRef<string>(initialContent)
  const onChangeRef = useRef(onChange)

  // Keep onChange ref current
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up simple editor')
    
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
    
    setIsReady(false)
    setIsLoading(true)
    setHasError(false)
    setErrorMessage('')
  }, [])

  // Initialize editor
  const initializeEditor = useCallback(async () => {
    if (!containerRef.current || editorRef.current) {
      return
    }

    try {
      console.log('🎯 Creating simple editor')
      
      // Ensure container is clean
      containerRef.current.innerHTML = ''
      
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (!containerRef.current) {
        return
      }

      // Create simple Milkdown editor
      const editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, containerRef.current)
          ctx.set(defaultValueCtx, initialContent)
        })
        .config(nord)
        .use(commonmark)
        .create()

      editorRef.current = editor
      setIsReady(true)
      setIsLoading(false)
      lastValueRef.current = initialContent
      
      console.log('✅ Simple editor ready')

      // Set up change detection
      const interval = setInterval(() => {
        if (editorRef.current && onChangeRef.current) {
          try {
            // For now, we'll use a simple approach
            // In a real implementation, you'd want to properly get the markdown content
            // This is a placeholder - Milkdown doesn't have a direct getMarkdown() method
            const content = lastValueRef.current
            if (content !== lastValueRef.current) {
              onChangeRef.current(content)
            }
          } catch (error) {
            console.error('Error reading editor content:', error)
          }
        }
      }, 1000)

      return () => clearInterval(interval)

    } catch (error) {
      console.error('Failed to create simple editor:', error)
      setHasError(true)
      setErrorMessage('Failed to initialize editor')
      setIsLoading(false)
    }
  }, [initialContent])

  // Initialize editor on mount
  useEffect(() => {
    console.log('🚀 Initializing simple editor')
    const timer = setTimeout(() => {
      initializeEditor().catch(error => {
        console.error('Failed to initialize simple editor:', error)
        setHasError(true)
        setErrorMessage('Failed to initialize editor')
        setIsLoading(false)
      })
    }, 50)

    return () => {
      console.log('🧹 Cleaning up simple editor (unmount)')
      clearTimeout(timer)
      cleanup()
    }
  }, [initializeEditor, cleanup])

  // Handle content updates
  useEffect(() => {
    if (isReady && editorRef.current && initialContent !== lastValueRef.current) {
      try {
        console.log('📝 Updating simple editor content')
        // For now, we'll recreate the editor with new content
        // In a real implementation, you'd want to update the content directly
        cleanup()
        setTimeout(() => initializeEditor(), 100)
      } catch (error) {
        console.error('Error updating editor content:', error)
      }
    }
  }, [initialContent, isReady, cleanup, initializeEditor])

  return (
    <div className="h-full w-full relative">
      {/* Status bar */}
      <div className="flex items-center justify-between p-2 border-b bg-muted/30 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span>Solo Mode</span>
          <span className="text-gray-600 font-medium">• Single User</span>
          
          {hasError && errorMessage && (
            <span className="text-red-600 text-xs">• {errorMessage}</span>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground">
          Non-collaborative
        </div>
      </div>

      {/* Editor container */}
      <div 
        ref={containerRef}
        className="h-full min-h-[400px] w-full prose prose-sm max-w-none p-4"
        style={{ 
          height: 'calc(100% - 48px)', // Subtract status bar height
          width: '100%'
        }}
      />
      
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-background/80">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-gray-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <div className="font-medium">
              {isLoading ? 'Loading editor...' : 'Setting up editor...'}
            </div>
            <div className="text-xs mt-1 text-muted-foreground">
              {errorMessage || 'Preparing single-user editor'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 