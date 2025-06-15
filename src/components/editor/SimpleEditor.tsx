'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Crepe, CrepeFeature } from '@milkdown/crepe'

// Import Crepe styles
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/nord.css'

interface SimpleEditorProps {
  initialContent?: string
  onChange?: (markdown: string) => void
}

export function SimpleEditor({ 
  initialContent = '', 
  onChange
}: SimpleEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const crepeRef = useRef<Crepe | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const lastValueRef = useRef<string>(initialContent)
  const onChangeRef = useRef(onChange)
  const isInitializedRef = useRef(false)

  // Keep onChange ref current
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up simple editor')
    
    // Destroy Crepe editor
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
    
    setIsReady(false)
    setIsLoading(true)
    setHasError(false)
    setErrorMessage('')
    isInitializedRef.current = false
  }, [])

  // Initialize editor
  const initializeEditor = useCallback(async () => {
    if (!containerRef.current || crepeRef.current || isInitializedRef.current) {
      return
    }

    try {
      console.log('🎯 Creating simple Crepe editor')
      isInitializedRef.current = true
      
      // Ensure container is clean
      containerRef.current.innerHTML = ''
      
      // Small delay to ensure DOM is ready
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (!containerRef.current) {
        isInitializedRef.current = false
        return
      }

      // Create simple Crepe editor without collaboration
      const crepe = new Crepe({
        root: containerRef.current,
        defaultValue: initialContent,
        features: {
          [CrepeFeature.Toolbar]: true,
          [CrepeFeature.CodeMirror]: true,
          [CrepeFeature.ListItem]: true,
          [CrepeFeature.LinkTooltip]: true,
          [CrepeFeature.Cursor]: true,
          [CrepeFeature.ImageBlock]: true,
          [CrepeFeature.BlockEdit]: true,
          [CrepeFeature.Placeholder]: true,
          [CrepeFeature.Table]: true,
          [CrepeFeature.Latex]: true,
        }
      })

      await crepe.create()
      crepeRef.current = crepe
      setIsReady(true)
      setIsLoading(false)
      lastValueRef.current = initialContent
      
      console.log('✅ Simple Crepe editor ready')

      // Set up change detection
      const interval = setInterval(() => {
        if (crepeRef.current && onChangeRef.current) {
          try {
            const content = crepeRef.current.getMarkdown()
            if (content !== lastValueRef.current) {
              lastValueRef.current = content
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
      isInitializedRef.current = false
    }
  }, [initialContent])

  // Initialize editor on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
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
        clearTimeout(timer)
      }
    }
  }, []) // Empty dependency array - only run on mount

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up simple editor (unmount)')
      cleanup()
    }
  }, [cleanup])

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
        className="h-full min-h-[400px] w-full"
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