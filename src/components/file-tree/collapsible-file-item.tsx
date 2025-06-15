'use client'

import React from 'react'
import { 
  FileIcon, 
  FolderIcon, 
  FolderOpenIcon, 
  ChevronRight, 
  ChevronDown,
  MoreHorizontal 
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
}

interface CollapsibleFileItemProps {
  node: FileNode
  level: number
  isExpanded: boolean
  isSelected: boolean
  onToggle: (path: string) => void
  onSelect: (path: string) => void
  isLast?: boolean
  parentIsLast?: boolean[]
}

export function CollapsibleFileItem({ 
  node, 
  level, 
  isExpanded, 
  isSelected, 
  onToggle, 
  onSelect,
  isLast = false,
  parentIsLast = []
}: CollapsibleFileItemProps) {
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

  // Calculate indentation and tree lines
  const baseIndent = 8
  const levelIndent = 20
  const totalIndent = baseIndent + (level * levelIndent)

  return (
    <div>
      {/* Current item */}
      <div
        className={cn(
          'group flex items-center py-1 px-2 rounded-sm cursor-pointer relative',
          !isDirectory && isSelected
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-accent/50',
          isDirectory && 'font-medium'
        )}
        style={{ paddingLeft: `${totalIndent}px` }}
        onClick={handleClick}
      >
        {/* Tree lines */}
        {level > 0 && (
          <div className="absolute left-0 top-0 bottom-0">
            {parentIsLast.map((isParentLast, index) => (
              <div
                key={index}
                className="absolute top-0 bottom-0 w-px bg-border"
                style={{ 
                  left: `${baseIndent + (index * levelIndent) + 10}px`,
                  display: isParentLast ? 'none' : 'block'
                }}
              />
            ))}
            {/* Horizontal line to current item */}
            <div
              className="absolute top-1/2 w-2 h-px bg-border"
              style={{ 
                left: `${baseIndent + ((level - 1) * levelIndent) + 10}px`,
                transform: 'translateY(-50%)'
              }}
            />
            {/* Vertical line continuation */}
            {!isLast && (
              <div
                className="absolute top-1/2 bottom-0 w-px bg-border"
                style={{ 
                  left: `${baseIndent + ((level - 1) * levelIndent) + 10}px`
                }}
              />
            )}
          </div>
        )}

        <div className="flex items-center space-x-1 flex-1 min-w-0">
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
          <span className="text-sm truncate">{node.name}</span>
          
          {/* File size for files */}
          {!isDirectory && node.size !== undefined && (
            <span className="text-xs text-muted-foreground ml-auto">
              {formatFileSize(node.size)}
            </span>
          )}
        </div>

        {/* Actions menu for files */}
        {!isDirectory && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Rename</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Children (if expanded) */}
      {isDirectory && hasChildren && isExpanded && node.children && (
        <div>
          {node.children.map((child, index) => (
            <CollapsibleFileItem
              key={child.path}
              node={child}
              level={level + 1}
              isExpanded={false} // Will be managed by parent state
              isSelected={isSelected && child.path === node.path}
              onToggle={onToggle}
              onSelect={onSelect}
              isLast={index === node.children!.length - 1}
              parentIsLast={[...parentIsLast, isLast]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}