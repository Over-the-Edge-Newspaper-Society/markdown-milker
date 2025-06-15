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

  return (
    <div
      className={cn(
        'group flex items-center justify-between px-2 py-1 rounded-sm cursor-pointer',
        isSelected
          ? 'bg-accent text-accent-foreground'
          : 'hover:bg-accent/50'
      )}
      onClick={() => onSelect(file.path)}
    >
      <div className="flex items-center space-x-2">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{file.name}</span>
      </div>
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
    </div>
  )
} 