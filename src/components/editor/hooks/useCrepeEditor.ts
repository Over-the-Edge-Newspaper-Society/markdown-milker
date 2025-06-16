// src/components/editor/hooks/useCrepeEditor.ts
'use client'

import { useRef, useState, useCallback } from 'react'
import { CrepeBuilder } from '@milkdown/crepe/builder'
import { collab } from '@milkdown/plugin-collab'
import { cursor } from '@milkdown/crepe/feature/cursor'
import { listItem } from '@milkdown/crepe/feature/list-item'
import { linkTooltip } from '@milkdown/crepe/feature/link-tooltip'
import { imageBlock } from '@milkdown/crepe/feature/image-block'
import { blockEdit } from '@milkdown/crepe/feature/block-edit'
import { placeholder } from '@milkdown/crepe/feature/placeholder'
import { toolbar } from '@milkdown/crepe/feature/toolbar'
import { codeMirror } from '@milkdown/crepe/feature/code-mirror'
import { table } from '@milkdown/crepe/feature/table'
import { latex } from '@milkdown/crepe/feature/latex'

interface UseCrepeEditorProps {
  containerRef: React.RefObject<HTMLDivElement>
  initialContent: string
  collaborative: boolean
  onImageUpload: (file?: File | null) => Promise<string>
}

export function useCrepeEditor({ 
  containerRef, 
  initialContent, 
  collaborative,
  onImageUpload 
}: UseCrepeEditorProps) {
  const builderRef = useRef<CrepeBuilder | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const isInitializedRef = useRef(false)
  const isDestroyedRef = useRef(false)

  const createEditor = useCallback(async () => {
    // Prevent multiple initialization
    if (!containerRef.current || builderRef.current || isInitializedRef.current || isDestroyedRef.current) {
      console.log('🚫 Editor creation skipped - already initialized or destroyed')
      return builderRef.current
    }

    isInitializedRef.current = true
    isDestroyedRef.current = false
    
    try {
      console.log(`🎯 Creating ${collaborative ? 'collaborative' : 'solo'} Crepe editor...`)
      
      // Clear container
      containerRef.current.innerHTML = ''
      
      const builder = new CrepeBuilder({
        root: containerRef.current,
        defaultValue: collaborative ? '' : initialContent
      })

      // Add collaboration plugin BEFORE other features if collaborative mode
      if (collaborative) {
        console.log('✅ Adding collaboration plugin to builder')
        builder.editor.use(collab)
      }

      // Add features
      builder.addFeature(cursor, { 
        color: collaborative ? '#3b82f6' : '#6b7280', 
        width: 2, 
        virtual: true 
      })
      builder.addFeature(listItem, {})
      builder.addFeature(linkTooltip, {})
      builder.addFeature(imageBlock, {
        onUpload: onImageUpload,
        blockUploadPlaceholderText: 'Paste image URL or click to browse library',
        blockUploadButton: 'Browse Library',
        inlineUploadPlaceholderText: 'Paste image URL or click to browse',
        inlineUploadButton: 'Browse',
      })
      builder.addFeature(blockEdit, {})
      builder.addFeature(placeholder, { 
        text: collaborative ? 'Start collaborating...' : 'Start writing...', 
        mode: 'block' 
      })
      builder.addFeature(toolbar, {})
      builder.addFeature(codeMirror, {})
      builder.addFeature(table, {})
      builder.addFeature(latex, {})

      console.log(`🎯 Creating ${collaborative ? 'collaborative' : 'solo'} Crepe editor...`)
      await builder.create()
      
      // Check if we were destroyed during creation
      if (isDestroyedRef.current) {
        console.log('🚫 Editor was destroyed during creation, cleaning up...')
        try {
          builder.destroy()
        } catch (error) {
          console.warn('Warning during post-creation cleanup:', error)
        }
        return null
      }
      
      builderRef.current = builder
      
      if (!collaborative) {
        setIsReady(true)
      }
      
      console.log('✅ Crepe editor created successfully')
      return builder
      
    } catch (error) {
      console.error('❌ Failed to create editor:', error)
      setHasError(true)
      setErrorMessage('Failed to initialize editor')
      isInitializedRef.current = false
      throw error
    }
  }, [containerRef, initialContent, collaborative, onImageUpload])

  const getContent = useCallback((): string => {
    // Safety check - don't try to get content if editor is destroyed
    if (isDestroyedRef.current || !builderRef.current) {
      console.warn('⚠️ Attempted to get content from destroyed editor')
      return ''
    }
    
    try {
      const methods = ['getMarkdown', 'getValue', 'getContent']
      
      for (const method of methods) {
        if (typeof (builderRef.current as any)[method] === 'function') {
          try {
            const content = (builderRef.current as any)[method]()
            if (typeof content === 'string' && content.length >= 0) {
              return content
            }
          } catch (e) {
            console.log(`Method ${method} failed:`, (e as Error).message)
          }
        }
      }
      
      return ''
    } catch (error) {
      console.error('Error getting editor content:', error)
      return ''
    }
  }, [])

  const cleanup = useCallback(() => {
    console.log('🧹 Starting Crepe editor cleanup...')
    
    // Mark as destroyed first to prevent any new operations
    isDestroyedRef.current = true
    
    if (builderRef.current) {
      try {
        console.log('🗑️ Destroying Crepe builder...')
        builderRef.current.destroy()
        console.log('✅ Crepe builder destroyed')
      } catch (error) {
        console.error('⚠️ Error destroying builder:', error)
      }
      builderRef.current = null
    }
    
    if (containerRef.current) {
      try {
        containerRef.current.innerHTML = ''
      } catch (error) {
        console.error('⚠️ Error clearing container:', error)
      }
    }
    
    setIsReady(false)
    setHasError(false)
    setErrorMessage('')
    isInitializedRef.current = false
    
    console.log('✅ Crepe editor cleanup completed')
  }, [containerRef])

  return {
    builder: builderRef.current,
    isReady,
    hasError,
    errorMessage,
    createEditor,
    getContent,
    cleanup,
    setIsReady,
    setHasError,
    setErrorMessage
  }
}