// src/components/editor/hooks/useImageManagement.ts (Updated with Original Implementation)
'use client'

import { useCallback, useRef, useState } from 'react'
import { useEditorStore } from '@/lib/stores/editor-store'
import { editorViewCtx, commandsCtx } from '@milkdown/kit/core'

export function useImageManagement() {
  const { uploadImage, activeDirectory } = useEditorStore()
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [pendingImageResolve, setPendingImageResolve] = useState<((value: string) => void) | null>(null)
  const [currentImageBlock, setCurrentImageBlock] = useState<HTMLElement | null>(null)

  // Enhanced image upload handler
  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    try {
      console.log('📸 Uploading image to assets:', file.name)
      const imagePath = await uploadImage(file)
      console.log('✅ Image uploaded successfully:', imagePath)
      return imagePath
    } catch (error) {
      console.error('❌ Image upload failed:', error)
      throw error
    }
  }, [uploadImage])

  // Custom image upload handler that opens the picker for "browse library"
  const handleCustomImageUpload = useCallback(async (file?: File | null): Promise<string> => {
    if (file) {
      // User provided a file - upload it normally
      const result = await handleImageUpload(file)
      
      // Always return the API URL format for proper loading
      if (result.startsWith('/api/assets/serve?path=')) {
        return result
      } else if (result.startsWith('_assets/')) {
        const filename = result.replace('_assets/', '')
        return `/api/assets/serve?path=${encodeURIComponent(filename)}&activeDir=${encodeURIComponent(activeDirectory)}`
      } else {
        // Assume it's a filename
        return `/api/assets/serve?path=${encodeURIComponent(result)}&activeDir=${encodeURIComponent(activeDirectory)}`
      }
    } else {
      // No file provided - user wants to browse library
      console.log('📸 Opening image picker for library browsing...')
      setShowImagePicker(true)
      
      // Return a promise that will be resolved when user selects an image
      return new Promise((resolve, reject) => {
        setPendingImageResolve(() => resolve)
        
        // Auto-reject after 30 seconds to prevent hanging
        setTimeout(() => {
          setPendingImageResolve(null)
          reject(new Error('Image selection timeout'))
        }, 30000)
      })
    }
  }, [handleImageUpload, activeDirectory])

  // Enhanced markdown fallback that ensures the content is actually saved
  const insertMarkdownFallback = useCallback((imagePath: string, getContent: () => string, saveContent: (content: string, context?: string) => Promise<boolean>) => {
    try {
      console.log('📸 Using enhanced markdown fallback insertion for:', imagePath)
      
      // Create clean markdown
      const imageMarkdown = `![Image](${imagePath})`
      
      // Get current content
      const currentContent = getContent()
      console.log('📖 Current content length:', currentContent.length)
      
      // Prepare new content with proper spacing
      let newContent = currentContent
      if (currentContent && !currentContent.endsWith('\n')) {
        newContent += '\n\n'
      } else if (currentContent) {
        newContent += '\n'
      }
      newContent += imageMarkdown + '\n'
      
      console.log('📝 New content length:', newContent.length)
      console.log('📝 Image markdown to insert:', imageMarkdown)
      
      // Save the new content through the normal save mechanism
      saveContent(newContent, 'image-insert-fallback')
      console.log('✅ Enhanced markdown fallback completed')
      
    } catch (error) {
      console.error('❌ Enhanced markdown fallback failed:', error)
      
      // Ultimate fallback: copy to clipboard and notify user
      if (navigator.clipboard) {
        const markdown = `![Image](${imagePath})`
        navigator.clipboard.writeText(markdown).then(() => {
          alert('Image URL copied to clipboard. Please paste it manually in the editor.')
        })
      } else {
        alert(`Image uploaded successfully! Please manually add: ![Image](${imagePath})`)
      }
    }
  }, [])

  // Alternative approach using Milkdown API directly
  const insertImageViaAPI = useCallback((imagePath: string, builder: any) => {
    if (!builder) return false
    
    try {
      console.log('🎯 Attempting API-based image insertion')
      
      // Try to access the Milkdown editor instance
      builder.editor.action((ctx: any) => {
        try {
          // Import the necessary contexts
          const view = ctx.get(editorViewCtx)
          const schema = view.state.schema
          
          console.log('📝 Got editor view and schema')
          
          // Create image node
          const imageNodeType = schema.nodes.image || schema.nodes.imageBlock
          if (!imageNodeType) {
            console.error('❌ No image node type found in schema')
            return false
          }
          
          const imageNode = imageNodeType.create({
            src: imagePath,
            alt: 'Uploaded image',
            title: ''
          })
          
          console.log('📝 Created image node:', imageNode)
          
          // Get current selection
          const { state } = view
          const { selection } = state
          
          // Create transaction to insert image
          const transaction = state.tr.replaceSelectionWith(imageNode)
          
          // Dispatch the transaction
          view.dispatch(transaction)
          
          console.log('✅ Image inserted via Milkdown API')
          return true
          
        } catch (apiError) {
          console.error('❌ API insertion failed:', apiError)
          return false
        }
      })
      
      return true
      
    } catch (error) {
      console.error('❌ Failed to access editor context:', error)
      return false
    }
  }, [])

  // Enhanced insertImageIntoBlock function with Milkdown-specific fixes
  const insertImageIntoBlock = useCallback((imageBlock: HTMLElement, imagePath: string) => {
    console.log('🎯 Inserting image into block:', imagePath)
    console.log('🔍 Image block HTML:', imageBlock.outerHTML.substring(0, 500))
    
    // Try multiple selectors to find the input field
    const selectors = [
      '.link-input-area',
      'input[type="text"]',
      'input[placeholder*="image"]',
      'input[placeholder*="URL"]',
      'input[placeholder*="url"]',
      '.image-input',
      '.url-input',
      '.link-input',
      'input'
    ]
    
    let input: HTMLInputElement | null = null
    
    for (const selector of selectors) {
      input = imageBlock.querySelector(selector) as HTMLInputElement
      if (input) {
        console.log(`📝 Found input with selector: ${selector}`)
        break
      }
    }
    
    if (!input) {
      console.error('❌ Could not find any input field in image block')
      return false
    }

    console.log('📝 Input element:', input)
    console.log('📝 Input current value:', input.value)
    console.log('📝 Input placeholder:', input.placeholder)
    
    // CRITICAL FIX: Use a more aggressive approach for Milkdown
    const setValueAndTrigger = () => {
      // Clear first
      input!.value = ''
      input!.dispatchEvent(new Event('input', { bubbles: true }))
      
      // Small delay then set the actual value
      setTimeout(() => {
        input!.value = imagePath
        input!.setAttribute('value', imagePath)
        
        // Focus and select all
        input!.focus()
        input!.select()
        
        // Dispatch input event immediately
        input!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
        
        // Then dispatch change
        setTimeout(() => {
          input!.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
          
          // Finally try Enter key
          setTimeout(() => {
            const enterEvent = new KeyboardEvent('keydown', {
              bubbles: true,
              cancelable: true,
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13
            })
            input!.dispatchEvent(enterEvent)
            
            // Also dispatch keyup
            const enterUpEvent = new KeyboardEvent('keyup', {
              bubbles: true,
              cancelable: true,
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13
            })
            input!.dispatchEvent(enterUpEvent)
            
            // Force blur to commit the value
            setTimeout(() => {
              input!.blur()
            }, 50)
            
          }, 100)
        }, 50)
      }, 50)
    }
    
    // Execute the value setting
    setValueAndTrigger()
    
    // Also try to find any submit/confirm buttons
    setTimeout(() => {
      const buttons = imageBlock.querySelectorAll('button, [role="button"], .confirm, .submit, .ok')
      for (const button of buttons) {
        if (button.textContent?.toLowerCase().includes('ok') || 
            button.textContent?.toLowerCase().includes('confirm') ||
            button.textContent?.toLowerCase().includes('submit') ||
            (button as HTMLElement).classList.contains('confirm')) {
          console.log('📤 Clicking confirm button:', button.textContent)
          ;(button as HTMLElement).click()
          break
        }
      }
    }, 300)
    
    console.log('✅ Enhanced image insertion events dispatched')
    return true
  }, [])

  // Updated handleImageSelect with all original strategies
  const createImageSelectHandler = useCallback((
    builder: any, 
    getContent: () => string, 
    saveContent: (content: string, context?: string) => Promise<boolean>
  ) => {
    return (imagePath: string) => {
      console.log('📸 Image selected from picker:', imagePath)
      setShowImagePicker(false)
      
      // Convert relative path to proper format
      let processedImagePath = imagePath
      
      if (imagePath.startsWith('_assets/')) {
        const filename = imagePath.replace('_assets/', '')
        processedImagePath = `/api/assets/serve?path=${encodeURIComponent(filename)}&activeDir=${encodeURIComponent(activeDirectory)}`
      } else if (!imagePath.startsWith('http') && !imagePath.startsWith('/api/')) {
        processedImagePath = `/api/assets/serve?path=${encodeURIComponent(imagePath)}&activeDir=${encodeURIComponent(activeDirectory)}`
      }
      
      console.log('🔄 Processed image path:', processedImagePath)
      
      // Strategy 0: Try Milkdown API first (NEW)
      console.log('🎯 Strategy 0: Using Milkdown API directly')
      if (insertImageViaAPI(processedImagePath, builder)) {
        console.log('✅ Image inserted successfully via Strategy 0 (API)')
        setCurrentImageBlock(null)
        return
      }
      
      // Strategy 1: Try to insert into current image block
      if (currentImageBlock) {
        console.log('🎯 Strategy 1: Inserting into current image block')
        const success = insertImageIntoBlock(currentImageBlock, processedImagePath)
        if (success) {
          console.log('✅ Image inserted successfully via Strategy 1')
          setCurrentImageBlock(null)
          
          // Wait a bit then check if it worked
          setTimeout(() => {
            const content = getContent()
            if (content.includes(processedImagePath)) {
              console.log('✅ Confirmed image in content')
            } else {
              console.warn('⚠️ Image not found in content, trying fallback')
              insertMarkdownFallback(processedImagePath, getContent, saveContent)
            }
          }, 1000)
          
          return
        }
      }
      
      // Strategy 2: Try to find any active image block
      console.log('🎯 Strategy 2: Looking for any active image block')
      const activeImageBlocks = document.querySelectorAll('.milkdown-image-block, [class*="image-block"]')
      for (let i = 0; i < activeImageBlocks.length; i++) {
        const block = activeImageBlocks[i]
        if (insertImageIntoBlock(block as HTMLElement, processedImagePath)) {
          console.log('✅ Image inserted successfully via Strategy 2')
          setCurrentImageBlock(null)
          
          // Wait and verify
          setTimeout(() => {
            const content = getContent()
            if (!content.includes(processedImagePath)) {
              console.warn('⚠️ Image not confirmed, using fallback')
              insertMarkdownFallback(processedImagePath, getContent, saveContent)
            }
          }, 1000)
          
          return
        }
      }
      
      // Strategy 3: Use markdown fallback
      console.log('🎯 Strategy 3: Using markdown fallback')
      insertMarkdownFallback(processedImagePath, getContent, saveContent)
      
      // Strategy 4: Resolve pending promise (for programmatic insertion)
      if (pendingImageResolve) {
        console.log('🎯 Strategy 4: Resolving pending promise')
        pendingImageResolve(processedImagePath)
        setPendingImageResolve(null)
      }
      
      setCurrentImageBlock(null)
    }
  }, [activeDirectory, currentImageBlock, insertImageViaAPI, insertImageIntoBlock, insertMarkdownFallback, pendingImageResolve])

  // Set up click interception for image block "Browse Library" buttons
  const setupImageBlockInterception = useCallback((containerRef: React.RefObject<HTMLDivElement>, isReady: boolean) => {
    if (!containerRef.current || !isReady) return

    const handleImageBlockClick = (event: Event) => {
      const target = event.target as HTMLElement
      
      // Check if this is the "Browse Library" button in an image block
      if (target.classList.contains('uploader') || 
          target.closest('.uploader') ||
          (target.textContent && target.textContent.includes('Browse Library'))) {
        
        console.log('📸 Image block Browse Library clicked!')
        event.preventDefault()
        event.stopPropagation()
        
        // Find the parent image block
        const imageBlock = target.closest('.milkdown-image-block') as HTMLElement
        if (imageBlock) {
          console.log('🎯 Found parent image block')
          setCurrentImageBlock(imageBlock)
        }
        
        // Open our image picker instead of file dialog
        setShowImagePicker(true)
        return false
      }
    }

    // Add event listener with capture to intercept before default behavior
    containerRef.current.addEventListener('click', handleImageBlockClick, true)
    
    // Also listen for file input clicks and redirect them
    const handleFileInputClick = (event: Event) => {
      const target = event.target as HTMLInputElement
      if (target.type === 'file' && target.accept?.includes('image')) {
        console.log('📸 File input intercepted!')
        event.preventDefault()
        event.stopPropagation()
        
        // Find the parent image block
        const imageBlock = target.closest('.milkdown-image-block') as HTMLElement
        if (imageBlock) {
          setCurrentImageBlock(imageBlock)
        }
        
        // Trigger our image picker instead
        setShowImagePicker(true)
        return false
      }
    }
    
    containerRef.current.addEventListener('click', handleFileInputClick, true)

    return () => {
      if (containerRef.current) {
        containerRef.current.removeEventListener('click', handleImageBlockClick, true)
        containerRef.current.removeEventListener('click', handleFileInputClick, true)
      }
    }
  }, [])

  // Handle image picker close without selection
  const handleImagePickerClose = useCallback(() => {
    console.log('📸 Image picker closed without selection')
    setShowImagePicker(false)
    setPendingImageResolve(null)
    setCurrentImageBlock(null)
  }, [])

  return {
    handleImageUpload,
    handleCustomImageUpload,
    createImageSelectHandler,
    setupImageBlockInterception,
    handleImagePickerClose,
    showImagePicker,
    setShowImagePicker,
    currentImageBlock,
    setCurrentImageBlock,
    pendingImageResolve,
    setPendingImageResolve
  }
}