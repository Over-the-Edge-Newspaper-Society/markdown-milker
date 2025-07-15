'use client'

import React from 'react'
import { FileIcon, FolderIcon, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface FileItemProps {
  file: {
    name: string
    path: string
    type: 'file' | 'directory'
  }
  isSelected: boolean
  onSelect: (path: string) => void
}

export function FileItem({ file, isSelected, onSelect }: FileItemProps) {
  const Icon = file.type === 'file' ? FileIcon : FolderIcon
  
  // Calculate indentation based on path depth
  const depth = file.path.split('/').length - 1
  const indentation = depth * 12 // 12px per level
  
  // Only allow selection of files, not directories
  const handleClick = () => {
    if (file.type === 'file') {
      onSelect(file.path)
    }
  }

  return (
    <div
      className={cn(
        'group flex items-center justify-between px-2 py-1 rounded-sm cursor-pointer',
        file.type === 'file' && isSelected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/50',
        file.type === 'directory' && 'opacity-75'
      )}
      style={{ paddingLeft: `${8 + indentation}px` }}
      onClick={handleClick}
    >
      <div className="flex items-center space-x-2">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{file.name}</span>
        {file.type === 'directory' && (
          <span className="text-xs text-muted-foreground">/</span>
        )}
      </div>
      
      {file.type === 'file' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Rename</DropdownMenuItem>
            <DropdownMenuItem>Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}