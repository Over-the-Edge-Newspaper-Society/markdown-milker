// src/components/file-tree/draggable-file-item.tsx
'use client'

import React, { useState, useRef, useCallback } from 'react'
import { 
  FileIcon, 
  FolderIcon, 
  FolderOpenIcon, 
  ChevronRight, 
  ChevronDown,
  MoreHorizontal,
  GripVertical
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  size?: number
  modified?: string
  level?: number
}

interface DraggableFileItemProps {
  node: FileNode
  level: number
  isExpanded: boolean
  isSelected: boolean
  isDragOver: boolean
  isLast?: boolean
  onToggle: (path: string) => void
  onSelect: (path: string) => void
  onDragOver: (e: React.DragEvent, path: string, isDirectory: boolean) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, path: string, isDirectory: boolean) => void
}

export function DraggableFileItem({ 
  node, 
  level, 
  isExpanded, 
  isSelected, 
  isDragOver,
  isLast = false,
  onToggle, 
  onSelect,
  onDragOver,
  onDragLeave,
  onDrop
}: DraggableFileItemProps) {
  const [isDragging, setIsDragging] = useState(false)
  const dragPreviewRef = useRef<HTMLDivElement | null>(null)
  
  const hasChildren = node.children && node.children.length > 0
  const isDirectory = node.type === 'directory'
  
  const handleClick = () => {
    if (isDirectory) {
      if (hasChildren) {
        onToggle(node.path)
      }
    } else {
      onSelect(node.path)
    }
  }

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggle(node.path)
  }

  // Enhanced drag handlers with better data transfer
  const handleDragStart = useCallback((e: React.DragEvent) => {
    setIsDragging(true)
    
    // Set multiple data formats for better compatibility
    e.dataTransfer.setData('text/plain', node.path)
    e.dataTransfer.setData('application/x-file-path', node.path)
    e.dataTransfer.effectAllowed = 'move'
    
    // Create a better drag preview that follows the cursor
    const dragImage = document.createElement('div')
    dragImage.innerHTML = `
      <div style="
        background: var(--background, white); 
        border: 1px solid var(--border, #ccc); 
        border-radius: 6px; 
        padding: 8px 12px; 
        font-size: 13px;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 6px;
        max-width: 250px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--foreground, #000);
      ">
        ${isDirectory ? '📁' : '📄'} ${node.name}
      </div>
    `
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-1000px'
    dragImage.style.left = '-1000px'
    dragImage.style.pointerEvents = 'none'
    dragImage.style.zIndex = '9999'
    
    document.body.appendChild(dragImage)
    dragPreviewRef.current = dragImage
    
    // Set drag image with proper offset to center under cursor
    e.dataTransfer.setDragImage(dragImage, 125, 20)
    
    // Clean up drag image after a short delay
    setTimeout(() => {
      if (dragPreviewRef.current && document.body.contains(dragPreviewRef.current)) {
        document.body.removeChild(dragPreviewRef.current)
        dragPreviewRef.current = null
      }
    }, 100)
  }, [node.path, node.name, isDirectory])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    // Clean up any remaining drag preview
    if (dragPreviewRef.current) {
      try {
        if (document.body.contains(dragPreviewRef.current)) {
          document.body.removeChild(dragPreviewRef.current)
        }
      } catch (e) {
        // Element might already be removed
      }
      dragPreviewRef.current = null
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDragOver(e, node.path, isDirectory)
  }, [node.path, isDirectory, onDragOver])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDrop(e, node.path, isDirectory)
  }, [node.path, isDirectory, onDrop])

  // Calculate indentation and tree lines
  const baseIndent = 8
  const levelIndent = 20
  const totalIndent = baseIndent + (level * levelIndent)

  return (
    <div
      className={cn(
        'group flex items-center py-1.5 px-2 rounded-sm cursor-pointer relative transition-all duration-150',
        !isDirectory && isSelected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/50',
        isDirectory && 'font-medium',
        isDragging && 'opacity-50 scale-95',
        isDragOver && isDirectory && 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-400 ring-inset'
      )}
      style={{ paddingLeft: `${totalIndent}px` }}
      onClick={handleClick}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
    >
      {/* Tree lines visualization */}
      {level > 0 && (
        <div className="absolute left-0 top-0 bottom-0 pointer-events-none">
          {/* Vertical lines for parent levels */}
          {Array.from({ length: level }, (_, index) => (
            <div
              key={index}
              className="absolute top-0 bottom-0 w-px bg-border/50"
              style={{ 
                left: `${baseIndent + (index * levelIndent) + 10}px`
              }}
            />
          ))}
          {/* Horizontal line to current item */}
          <div
            className="absolute top-1/2 w-2 h-px bg-border/50"
            style={{ 
              left: `${baseIndent + ((level - 1) * levelIndent) + 10}px`,
              transform: 'translateY(-50%)'
            }}
          />
          {/* Vertical line continuation (stop if last item) */}
          {!isLast && (
            <div
              className="absolute top-1/2 bottom-0 w-px bg-border/50"
              style={{ 
                left: `${baseIndent + ((level - 1) * levelIndent) + 10}px`
              }}
            />
          )}
        </div>
      )}

      <div className="flex items-center space-x-1 flex-1 min-w-0">
        {/* Drag handle (visible on hover) */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="h-3 w-3 text-muted-foreground cursor-grab active:cursor-grabbing" />
        </div>

        {/* Expand/collapse button for directories */}
        {isDirectory && hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-4 w-4 p-0 hover:bg-transparent"
            onClick={handleToggleClick}
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        ) : (
          <div className="w-4" /> // Spacer for alignment
        )}

        {/* Icon */}
        <div className="flex-shrink-0">
          {isDirectory ? (
            isExpanded ? (
              <FolderOpenIcon className="h-4 w-4 text-blue-500" />
            ) : (
              <FolderIcon className="h-4 w-4 text-blue-500" />
            )
          ) : (
            <FileIcon className="h-4 w-4 text-gray-500" />
          )}
        </div>

        {/* Name */}
        <span className="text-sm truncate select-none">{node.name}</span>
        
        {/* File size for files - only show if size is meaningful */}
        {!isDirectory && node.size !== undefined && node.size > 0 && (
          <span className="text-xs text-muted-foreground ml-auto font-mono">
            {formatFileSize(node.size)}
          </span>
        )}

        {/* Children count for directories */}
        {isDirectory && hasChildren && (
          <span className="text-xs text-muted-foreground ml-auto bg-muted px-1.5 py-0.5 rounded">
            {node.children!.length}
          </span>
        )}
      </div>

      {/* Actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Rename</DropdownMenuItem>
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Drop zone indicator */}
      {isDragOver && isDirectory && (
        <div className="absolute inset-0 border-2 border-dashed border-blue-400 rounded bg-blue-50/50 dark:bg-blue-900/20 pointer-events-none" />
      )}
    </div>
  )
}

// Improved helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 0) return '--'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  if (i === 0) {
    return bytes + ' B'
  }
  
  const size = (bytes / Math.pow(k, i))
  const decimals = size < 10 ? 1 : 0
  return parseFloat(size.toFixed(decimals)) + ' ' + sizes[i]
}