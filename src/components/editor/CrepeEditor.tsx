'use client'

import { useEffect, useRef, useState } from 'react'
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/nord.css'

interface CrepeEditorProps {
  value?: string
  onChange?: (markdown: string) => void
}

export function CrepeEditor({ value = '', onChange }: CrepeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const crepeInstance = useRef<Crepe | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (!editorRef.current || isInitialized) return

    const initializeEditor = async () => {
      try {
        const crepe = new Crepe({
          root: editorRef.current!,
          defaultValue: value,
          featureConfigs: {
            // Configure features you want
            toolbar: true,
            preview: false, // Disable preview to avoid conflicts
          }
        })

        await crepe.create()
        crepeInstance.current = crepe

        // Set up change listener
        if (onChange) {
          // Listen for changes using Milkdown's API
          const handleChange = () => {
            if (crepeInstance.current) {
              try {
                const markdown = crepeInstance.current.getMarkdown()
                onChange(markdown)
              } catch (error) {
                console.error('Error getting markdown:', error)
              }
            }
          }

          // Use a simple interval to check for changes
          // This is a workaround since Crepe's event system can be tricky
          const changeInterval = setInterval(handleChange, 1000)
          
          // Cleanup function
          return () => {
            clearInterval(changeInterval)
            if (crepeInstance.current) {
              crepeInstance.current.destroy()
              crepeInstance.current = null
            }
          }
        }

        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to initialize Crepe editor:', error)
      }
    }

    initializeEditor()

    return () => {
      if (crepeInstance.current) {
        crepeInstance.current.destroy()
        crepeInstance.current = null
      }
      setIsInitialized(false)
    }
  }, []) // Remove value from dependencies to prevent re-initialization

  // Handle value updates without re-initializing
  useEffect(() => {
    if (isInitialized && crepeInstance.current && value !== undefined) {
      try {
        const currentContent = crepeInstance.current.getMarkdown()
        if (currentContent !== value) {
          // Only update if the content is actually different
          // This prevents unnecessary updates and potential conflicts
          crepeInstance.current.action((ctx) => {
            // Use Milkdown's action API to update content
            // This is safer than destroying and recreating
            const view = ctx.get('view')
            // Simple approach: just set the value if very different
            if (Math.abs(currentContent.length - value.length) > 10) {
              editorRef.current!.innerHTML = ''
              crepeInstance.current!.destroy()
              setIsInitialized(false)
              // This will trigger re-initialization with new value
            }
          })
        }
      } catch (error) {
        console.error('Error updating content:', error)
      }
    }
  }, [value, isInitialized])

  return (
    <div className="h-full">
      <div 
        ref={editorRef} 
        className="h-full min-h-[400px] p-4"
        style={{ 
          height: '100%',
          overflow: 'auto'
        }}
      />
    </div>
  )
}