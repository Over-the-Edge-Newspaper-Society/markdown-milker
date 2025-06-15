// src/utils/collaboration-manager.ts
import { WebsocketProvider } from 'y-websocket'
import { Doc } from 'yjs'
import { collabServiceCtx } from '@milkdown/plugin-collab'
import { CollaborationCallbacks, CrepeInstance } from '@/types/editor'
import { setCrepeContent, getCrepeContent } from './crepe-api'

// Generate random color for user awareness
const randomColor = () => '#' + Math.floor(Math.random() * 16777215).toString(16)

export class CollaborationManager {
  private ydoc: Doc | null = null
  private provider: WebsocketProvider | null = null
  private callbacks: CollaborationCallbacks
  private shouldContinue = true
  private timeoutId: NodeJS.Timeout | null = null
  private readyCheckInterval: NodeJS.Timeout | null = null

  constructor(
    private wsUrl: string,
    private documentId: string,
    private initialContent: string,
    callbacks: CollaborationCallbacks
  ) {
    this.callbacks = callbacks
  }

  async setupCollaboration(crepe: CrepeInstance, internalEditor: any): Promise<void> {
    console.log('🚀 Setting up Y.js collaboration...')
    
    // Reset flags
    this.shouldContinue = true
    
    try {
      // First check if the editor contexts are properly set up for collaboration
      const isCollabReady = await this.checkEditorCollabReadiness(internalEditor)
      
      if (!isCollabReady) {
        this.failover('Editor not configured for collaboration')
        return
      }

      // Create Y.js document and WebSocket provider
      this.ydoc = new Doc()
      this.provider = new WebsocketProvider(
        this.wsUrl,
        this.documentId,
        this.ydoc,
        { 
          connect: true,
          params: { documentId: this.documentId },
          resyncInterval: 5000,
          maxBackoffTime: 1000,
          maxReconnectTimeout: 5000
        }
      )

      // Set user awareness
      this.provider.awareness.setLocalStateField('user', {
        color: randomColor(),
        name: `User-${Math.floor(Math.random() * 1000)}`
      })

      // Set up event listeners
      this.setupEventListeners()

      // Set up collaboration service
      const hasCollabService = await this.checkCollabServiceAvailability(internalEditor)
      
      if (!hasCollabService) {
        this.failover('Collaboration service not available')
        return
      }

      await this.bindCollaborationService(internalEditor, crepe)
      
    } catch (error) {
      console.error('Error setting up collaboration:', error)
      this.failover(`Setup error: ${(error as Error).message}`)
    }
  }

  private setupEventListeners(): void {
    if (!this.provider) return

    // Track connection failures
    let connectionAttempts = 0
    const maxAttempts = 3

    this.provider.on('status', (payload: { status: string }) => {
      if (!this.shouldContinue) return
      console.log('WebSocket status:', payload.status)
      this.callbacks.onStatusChange(payload.status as any)
    })

    this.provider.on('connection-close', () => {
      if (!this.shouldContinue) return
      console.log('WebSocket connection closed')
      this.callbacks.onStatusChange('disconnected')
      connectionAttempts++
      
      if (connectionAttempts >= maxAttempts) {
        console.warn('💥 Too many connection failures')
        this.failover('Connection failed')
      }
    })

    this.provider.on('connection-error', (error: any) => {
      if (!this.shouldContinue) return
      console.error('WebSocket connection error:', error)
      this.callbacks.onStatusChange('error')
      connectionAttempts++
      
      if (connectionAttempts >= maxAttempts) {
        console.warn('💥 Too many connection errors')
        this.failover('Connection failed')
      }
    })

    // Track collaborators
    this.provider.awareness.on('change', () => {
      if (!this.shouldContinue) return
      const states = this.provider!.awareness.getStates()
      this.callbacks.onCollaboratorsChange(states.size)
    })
  }

  private async checkEditorCollabReadiness(internalEditor: any): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        console.log('🔍 Checking if editor is ready for collaboration...')
        
        // Try to access the editor context to see if required contexts exist
        internalEditor.action((ctx: any) => {
          try {
            // Check for essential contexts that collaboration needs
            const requiredContexts = ['editorState', 'editorView', 'schema']
            
            for (const contextName of requiredContexts) {
              try {
                ctx.get(contextName + 'Ctx')
                console.log(`✅ Found required context: ${contextName}`)
              } catch (error) {
                console.warn(`❌ Missing required context: ${contextName}`)
                resolve(false)
                return
              }
            }
            
            console.log('✅ Editor appears ready for collaboration')
            resolve(true)
          } catch (error) {
            console.warn('❌ Error checking editor contexts:', (error as Error).message)
            resolve(false)
          }
        })
      } catch (error) {
        console.warn('❌ Cannot access editor action context:', (error as Error).message)
        resolve(false)
      }
    })
  }

  private async checkCollabServiceAvailability(internalEditor: any): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        internalEditor.action((ctx: any) => {
          try {
            const collabService = ctx.get(collabServiceCtx)
            resolve(!!collabService)
          } catch (error) {
            console.warn('Collab service not available:', (error as Error).message)
            resolve(false)
          }
        })
      } catch (error) {
        console.warn('Cannot access editor context:', (error as Error).message)
        resolve(false)
      }
    })
  }

  private async bindCollaborationService(internalEditor: any, crepe: CrepeInstance): Promise<void> {
    if (!this.ydoc || !this.provider) return

    internalEditor.action((ctx: any) => {
      try {
        const collabService = ctx.get(collabServiceCtx)
        
        // Bind collaboration
        collabService
          .bindDoc(this.ydoc!)
          .setAwareness(this.provider!.awareness)

        // Wait for sync
        this.provider!.once('synced', async (isSynced: boolean) => {
          if (!this.shouldContinue) return
          
          console.log('Y.js synced:', isSynced)
          
          if (isSynced) {
            await this.handleSuccessfulSync(crepe, collabService)
          }
        })
      } catch (serviceError) {
        console.error('Error setting up collaboration service:', serviceError)
        this.failover(`Service setup failed: ${(serviceError as Error).message}`)
      }
    })

    // Set up connection timeout
    this.timeoutId = setTimeout(() => {
      if (this.shouldContinue) {
        console.warn('⏰ Collaboration connection timeout')
        this.failover('Connection timeout')
      }
    }, 8000)
  }

  private async handleSuccessfulSync(crepe: CrepeInstance, collabService: any): Promise<void> {
    try {
      // Apply initial content if needed
      if (this.initialContent && this.initialContent.trim() !== '') {
        console.log('Applying initial content...')
        setCrepeContent(crepe, this.initialContent)
      }
      
      // Try to establish text synchronization
      await this.establishTextSync(collabService)
      
      this.callbacks.onStatusChange('synced')
      this.callbacks.onReady()
      this.cleanup()
      
      console.log('🎉 Collaboration setup complete!')
      
    } catch (syncError) {
      console.error('Error during sync:', syncError)
      this.failover(`Sync failed: ${(syncError as Error).message}`)
    }
  }

  private async establishTextSync(collabService: any): Promise<void> {
    console.log('🔄 Establishing text synchronization...')
    
    try {
      await collabService.connect()
      console.log('✅ Collaboration service connected successfully')
    } catch (connectError) {
      console.warn('⚠️ collabService.connect() failed:', (connectError as Error).message)
      // Continue anyway - collaboration might still work
    }
  }

  private failover(reason: string): void {
    this.shouldContinue = false
    this.cleanup()
    this.callbacks.onError(reason)
  }

  private cleanup(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
    
    if (this.readyCheckInterval) {
      clearInterval(this.readyCheckInterval)
      this.readyCheckInterval = null
    }
  }

  destroy(): void {
    this.shouldContinue = false
    this.cleanup()
    
    if (this.provider) {
      try {
        this.provider.disconnect()
        this.provider.destroy()
      } catch (error) {
        console.error('Error destroying WebSocket provider:', error)
      }
      this.provider = null
    }
    
    if (this.ydoc) {
      try {
        this.ydoc.destroy()
      } catch (error) {
        console.error('Error destroying Y.js document:', error)
      }
      this.ydoc = null
    }
  }

  getProvider(): WebsocketProvider | null {
    return this.provider
  }

  getYDoc(): Doc | null {
    return this.ydoc
  }
}