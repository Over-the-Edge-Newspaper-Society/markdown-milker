import React from 'react'
import { Bold, Italic, List, ListOrdered, Heading1, Heading2 } from 'lucide-react'

interface EditorToolbarProps {
  onFormat: (format: string) => void
}

export function EditorToolbar({ onFormat }: EditorToolbarProps) {
  return (
    <div className="flex items-center space-x-2 p-2 border-b border-gray-200">
      <button
        onClick={() => onFormat('bold')}
        className="p-2 hover:bg-gray-100 rounded"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        onClick={() => onFormat('italic')}
        className="p-2 hover:bg-gray-100 rounded"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        onClick={() => onFormat('heading1')}
        className="p-2 hover:bg-gray-100 rounded"
      >
        <Heading1 className="w-4 h-4" />
      </button>
      <button
        onClick={() => onFormat('heading2')}
        className="p-2 hover:bg-gray-100 rounded"
      >
        <Heading2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => onFormat('bulletList')}
        className="p-2 hover:bg-gray-100 rounded"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={() => onFormat('orderedList')}
        className="p-2 hover:bg-gray-100 rounded"
      >
        <ListOrdered className="w-4 h-4" />
      </button>
    </div>
  )
} 