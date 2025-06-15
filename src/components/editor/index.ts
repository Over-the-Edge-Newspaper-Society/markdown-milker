// src/components/editor/index.ts
// Main editor components
export { CollaborativeEditor } from './CollaborativeEditor'
export { SimpleEditor } from './SimpleEditor'
export { ExtendedCrepeEditor } from './ExtendedCrepeEditor'
export { TrueCollaborativeCrepe } from './TrueCollaborativeCrepe'

// Utility components
export { SaveStatus } from './save-status'

// Re-export types for convenience
export type { 
  ExtendedCrepeEditorProps,
  ConnectionStatus,
  EditorState,
  CrepeInstance,
  CollaborationCallbacks
} from '@/types/editor'