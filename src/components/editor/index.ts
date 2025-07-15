// src/components/editor/index.ts

// ✅ PRIMARY: Unified Crepe editor for both solo and collaborative modes
export { UnifiedCrepeEditor } from './UnifiedCrepeEditor'

// ✅ UI COMPONENTS: Utility components
export { SaveStatus } from './save-status'

// ✅ LEGACY: Keep old editors for backwards compatibility (but mark as deprecated)
/**
 * @deprecated Use UnifiedCrepeEditor with collaborative=false instead
 */
export { SimpleEditor } from './SimpleEditor'

/**
 * @deprecated Use UnifiedCrepeEditor with collaborative=true instead
 */
export { WorkingCollaborativeCrepe } from './WorkingCollaborativeCrepe'

// ✅ FALLBACK: Basic collaborative editor (if needed)
// export { CollaborativeEditor } from './CollaborativeEditor'

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