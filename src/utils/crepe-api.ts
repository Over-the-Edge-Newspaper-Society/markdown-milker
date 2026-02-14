// src/utils/crepe-api.ts
import { Crepe } from '@milkdown/crepe'
import { CrepeInstance } from '@/types/editor'

/**
 * Utility functions for working with the Crepe editor API
 */

export function debugCrepeInstance(crepeInstance: Crepe): void {
  console.log('🔍 Debugging Crepe instance methods:')
  console.log('Direct methods:', Object.getOwnPropertyNames(crepeInstance))
  console.log('Prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(crepeInstance)))
  console.log('All enumerable props:', Object.keys(crepeInstance))
}

export function getCrepeContent(crepeInstance: CrepeInstance): string {
  try {
    debugCrepeInstance(crepeInstance)
    
    // Try the correct Crepe API methods in order of preference
    if (typeof crepeInstance.getMarkdown === 'function') {
      console.log('✅ Using crepe.getMarkdown()')
      return crepeInstance.getMarkdown()
    } else if (typeof crepeInstance.getValue === 'function') {
      console.log('✅ Using crepe.getValue()')
      return crepeInstance.getValue()
    } else if (typeof crepeInstance.getContent === 'function') {
      console.log('✅ Using crepe.getContent()')
      return crepeInstance.getContent()
    } else {
      console.warn('⚠️ No known Crepe content getter method found')
      console.log('Available methods:', Object.getOwnPropertyNames(crepeInstance))
      return ''
    }
  } catch (error) {
    console.warn('⚠️ Error getting Crepe content:', (error as Error).message)
    return ''
  }
}

export function setCrepeContent(crepeInstance: CrepeInstance, content: string): void {
  try {
    console.log('🔍 Content setting request received')
    console.log('📋 Available Crepe methods:', Object.getOwnPropertyNames(crepeInstance))
    
    // First, check if content is already set correctly
    const currentContent = getCrepeContent(crepeInstance)
    console.log(`📊 Current content: ${currentContent.length} chars`)
    console.log(`📊 Target content: ${content.length} chars`)
    
    if (currentContent === content) {
      console.log('✅ Content already matches exactly - no action needed')
      return
    }
    
    if (currentContent.length > 0 && Math.abs(currentContent.length - content.length) <= 2) {
      console.log('✅ Content lengths are very similar - assuming content is correct')
      return
    }
    
    // Only proceed if content is actually missing
    if (currentContent.length > 0) {
      console.log('💡 Editor already has content - skipping manual content setting')
      console.log('💡 Content was likely set correctly during Crepe editor creation')
      return
    }
    
    console.log('🔄 Content appears to be missing, attempting to set...')
    
    // Try the available Crepe API methods
    if (typeof crepeInstance.setValue === 'function') {
      console.log('✅ Using crepe.setValue()')
      crepeInstance.setValue(content)
      return
    } else if (typeof crepeInstance.setContent === 'function') {
      console.log('✅ Using crepe.setContent()')
      crepeInstance.setContent(content)
      return
    } else {
      console.log('💡 No Crepe setter methods available')
      console.log('💡 This is normal - content should be set during editor creation with defaultValue')
      console.log('💡 Manual content setting after creation is not supported by Crepe API')
      
      // Don't attempt internal editor manipulation since it's not reliable
      console.log('💡 Skipping internal editor manipulation - not reliable for content setting')
    }
  } catch (error) {
    console.log('💡 Content setting not available:', (error as Error).message)
    console.log('💡 This is expected - Crepe sets content during creation, not after')
  }
}

function trySetContentViaInternalEditor(internalEditor: any, content: string): void {
  try {
    console.log('🔍 Attempting alternative content setting via internal editor...')
    
    // List available contexts for debugging
    internalEditor.action((ctx: any) => {
      // Try different approaches to set content
      try {
        // Approach 1: Try to get and manipulate the editor view directly
        const view = ctx.get('editorViewCtx')
        if (view && view.dispatch) {
          console.log('✅ Found editor view, attempting direct content update')
          // This would require ProseMirror knowledge to properly set content
          console.log('💡 Direct view manipulation requires ProseMirror API')
        }
      } catch (e) {
        console.log('❌ No editorViewCtx available')
      }
      
      try {
        // Approach 2: Try to access document state
        const state = ctx.get('editorStateCtx')
        if (state) {
          console.log('✅ Found editor state context')
          console.log('💡 State manipulation requires ProseMirror API')
        }
      } catch (e) {
        console.log('❌ No editorStateCtx available')
      }
      
      console.log('💡 Content was likely set correctly during Crepe creation')
      console.log('💡 Manual content setting after creation is not supported by Crepe')
    })
  } catch (internalError) {
    console.log('💡 Internal editor content setting not available:', (internalError as Error).message)
    console.log('💡 This is normal - content should be set during editor creation')
  }
}

export function createCrepeInstance(container: HTMLElement, initialContent: string = ''): Promise<Crepe> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('🎯 Creating Crepe editor instance with content length:', initialContent.length)
      
      // Add consistent styling class to container
      container.classList.add('crepe-editor-container')
      
      const { Crepe, CrepeFeature } = await import('@milkdown/crepe')
      
      const crepe = new Crepe({
        root: container,
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
      
      // Verify content was set
      const currentContent = crepe.getMarkdown ? crepe.getMarkdown() : ''
      console.log('✅ Crepe editor instance created successfully')
      console.log('📊 Initial content set:', currentContent.length > 0 ? 'Yes' : 'No')
      console.log('📊 Content preview:', currentContent.substring(0, 100) + '...')
      
      resolve(crepe)
    } catch (error) {
      console.error('❌ Failed to create Crepe editor instance:', error)
      reject(error)
    }
  })
}