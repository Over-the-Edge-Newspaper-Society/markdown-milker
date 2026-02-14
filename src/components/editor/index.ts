// src/components/editor/index.ts

// ✅ PRIMARY: Unified Crepe editor for both solo and collaborative modes
export { UnifiedCrepeEditor } from './UnifiedCrepeEditor'

// ✅ UI COMPONENTS: Utility components
export { SaveStatus } from './save-status'

// ✅ TYPES: Re-export types for convenience
export type { 
  ExtendedCrepeEditorProps,
  ConnectionStatus,
  EditorState,
  CrepeInstance,
  CollaborationCallbacks
} from '@/types/editor'

// ✅ NEW: Export unified editor props interface
export interface UnifiedCrepeEditorProps {
  documentId: string
  initialContent?: string
  onChange?: (markdown: string) => void
  wsUrl?: string
  /** Enable/disable Y.js collaboration features */
  collaborative?: boolean
}