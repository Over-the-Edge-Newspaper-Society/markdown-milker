// src/components/editor/hooks/useContentSync.ts
'use client'

import { useRef, useCallback, useEffect } from 'react'

interface UseContentSyncProps {
  getContent: () => string
  onChange?: (content: string) => void
  collaborative: boolean
  isReady: boolean
}

export function useContentSync({ getContent, onChange, collaborative, isReady }: UseContentSyncProps) {
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastContentRef = useRef('')
  const isSavingRef = useRef(false)

  const saveContent = useCallback(async (content: string, context: string = 'auto') => {
    if (isSavingRef.current || !onChange) return false
    
    let cleanedContent = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/!\[([^\]]*)\]\(<([^>]+)>\)/g, '![$1]($2)')
      .trim()
    
    if (cleanedContent === lastContentRef.current && context !== 'force') {
      return false
    }

    try {
      isSavingRef.current = true
      console.log(`💾 SAVING [${collaborative ? 'collaborative' : 'solo'}] [${context}]:`, cleanedContent.length, 'chars')
      
      await onChange(cleanedContent)
      lastContentRef.current = cleanedContent
      
      return true
    } catch (error) {
      console.error(`❌ SAVE FAILED [${context}]:`, error)
      return false
    } finally {
      isSavingRef.current = false
    }
  }, [onChange, collaborative])

  const setupContentMonitoring = useCallback(() => {
    if (collaborative) {
      // Collaborative mode: frequent auto-save
      saveIntervalRef.current = setInterval(async () => {
        if (isReady) {
          const content = getContent()
          if (content) {
            await saveContent(content, 'collaborative-auto')
          }
        }
      }, 1000)
    } else {
      // Solo mode: debounced change detection
      saveIntervalRef.current = setInterval(async () => {
        if (isReady) {
          const content = getContent()
          if (content && content !== lastContentRef.current) {
            await saveContent(content, 'solo-auto')
          }
        }
      }, 1500)
    }
  }, [collaborative, isReady, getContent, saveContent])

  const cleanup = useCallback(() => {
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current)
      saveIntervalRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isReady) {
      setupContentMonitoring()
    }
    return cleanup
  }, [isReady, setupContentMonitoring, cleanup])

  return {
    saveContent,
    cleanup
  }
}
