// src/components/editor/index.ts
// Working editor components
export { SimpleEditor } from './SimpleEditor'
export { WorkingCollaborativeCrepe } from './WorkingCollaborativeCrepe'

// Utility components
export { SaveStatus } from './save-status'

// Keep basic collaborative editor as fallback
export { CollaborativeEditor } from './CollaborativeEditor'

// Re-export types for convenience
export type { 
  ExtendedCrepeEditorProps,
  ConnectionStatus,
  EditorState,
  CrepeInstance,
  CollaborationCallbacks
} from '@/types/editor'