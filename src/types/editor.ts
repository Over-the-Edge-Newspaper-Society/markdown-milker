// src/types/editor.ts
import { Crepe } from '@milkdown/crepe'
import { WebsocketProvider } from 'y-websocket'
import { Doc } from 'yjs'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'synced'

export interface ExtendedCrepeEditorProps {
  documentId: string
  initialContent?: string
  onChange?: (markdown: string) => void
  wsUrl?: string
}

export interface CollaborationRefs {
  crepe: Crepe | null
  ydoc: Doc | null
  provider: WebsocketProvider | null
}

export interface EditorState {
  isReady: boolean
  connectionStatus: ConnectionStatus
  collaborators: number
  hasError: boolean
  isLoading: boolean
  errorMessage: string
  isInitialized: boolean
}

export interface CrepeInstance extends Crepe {
  getMarkdown?: () => string
  setMarkdown?: (content: string) => void
  getValue?: () => string
  setValue?: (content: string) => void
  getContent?: () => string
  setContent?: (content: string) => void
}

export interface CollaborationCallbacks {
  onStatusChange: (status: ConnectionStatus) => void
  onCollaboratorsChange: (count: number) => void
  onError: (error: string) => void
  onReady: () => void
}