// src/utils/content-sync.ts
import { CrepeInstance } from '@/types/editor'
import { getCrepeContent } from './crepe-api'

export class ContentSyncManager {
  private syncInterval: NodeJS.Timeout | null = null
  private lastContent: string = ''
  private onChange: ((content: string) => void) | null = null
  private initialContentSet: boolean = false

  constructor(
    private crepe: CrepeInstance,
    initialContent: string = '',
    onChange?: (content: string) => void
  ) {
    this.lastContent = initialContent
    this.onChange = onChange || null
    
    // Verify initial content is actually in the editor
    try {
      const currentContent = getCrepeContent(this.crepe)
      if (currentContent && currentContent.length > 0) {
        console.log('📊 Content sync manager: Content verified in editor')
        this.lastContent = currentContent
        this.initialContentSet = true
      }
    } catch (error) {
      console.warn('📊 Content sync manager: Could not verify initial content')
    }
  }

  startMonitoring(intervalMs: number = 2000): void {
    if (this.syncInterval) {
      this.stopMonitoring()
    }

    console.log('📊 Starting content sync monitoring...')
    
    this.syncInterval = setInterval(() => {
      this.checkForContentChanges()
    }, intervalMs)
  }

  stopMonitoring(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
      console.log('📊 Content sync monitoring stopped')
    }
  }

  private checkForContentChanges(): void {
    try {
      const currentContent = getCrepeContent(this.crepe)
      
      if (currentContent !== this.lastContent) {
        // First change detection
        if (!this.initialContentSet && currentContent.length > 0) {
          console.log('📊 Initial content detected in editor')
          this.initialContentSet = true
        }
        
        console.log('✏️ Content changed - notifying onChange callback')
        console.log(`Previous: ${this.lastContent.length} chars, Current: ${currentContent.length} chars`)
        
        this.lastContent = currentContent
        
        if (this.onChange) {
          this.onChange(currentContent)
        }
      }
    } catch (error) {
      console.error('Error checking content changes:', error)
    }
  }

  updateOnChange(onChange: (content: string) => void): void {
    this.onChange = onChange
  }

  getCurrentContent(): string {
    return this.lastContent
  }

  isContentInitialized(): boolean {
    return this.initialContentSet
  }

  destroy(): void {
    this.stopMonitoring()
    this.onChange = null
  }
}

export function createContentChangeDetector(
  crepe: CrepeInstance,
  initialContent: string,
  onChange?: (content: string) => void
): ContentSyncManager {
  const manager = new ContentSyncManager(crepe, initialContent, onChange)
  manager.startMonitoring()
  return manager
}