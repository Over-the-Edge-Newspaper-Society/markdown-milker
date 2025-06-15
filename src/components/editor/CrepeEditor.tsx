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
  const currentValueRef = useRef<string>(value)

  useEffect(() => {
    currentValueRef.current = value
  }, [value])

  useEffect(() => {
    if (!editorRef.current || isInitialized) return

    let changeInterval: NodeJS.Timeout | null = null

    const initializeEditor = async () => {
      try {
        const crepe = new Crepe({
          root: editorRef.current!,
          defaultValue: value,
          featureConfigs: {
            toolbar: true,
            preview: false,
          }
        })

        await crepe.create()
        crepeInstance.current = crepe

        // Set up change listener
        if (onChange) {
          const handleChange = () => {
            if (crepeInstance.current) {
              try {
                const markdown = crepeInstance.current.getMarkdown()
                // Only call onChange if the content actually changed and is different from current value
                if (markdown !== currentValueRef.current) {
                  onChange(markdown)
                }
              } catch (error) {
                console.error('Error getting markdown:', error)
              }
            }
          }

          // Use a simple interval to check for changes
          changeInterval = setInterval(handleChange, 1000)
        }

        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to initialize Crepe editor:', error)
      }
    }

    initializeEditor()

    return () => {
      if (changeInterval) {
        clearInterval(changeInterval)
      }
      if (crepeInstance.current) {
        try {
          crepeInstance.current.destroy()
        } catch (error) {
          console.error('Error destroying editor:', error)
        }
        crepeInstance.current = null
      }
      setIsInitialized(false)
    }
  }, []) // Only run once on mount

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