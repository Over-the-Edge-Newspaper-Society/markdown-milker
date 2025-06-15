'use client'

import React from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Plus } from 'lucide-react'
import { FileItem } from './file-item'
import { useFileTree } from '@/lib/hooks/use-file-tree'

export function DirectoryTree() {
  const { files, searchTerm, setSearchTerm, selectedFile, selectFile } = useFileTree()

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" className="flex-1">
            <Plus className="h-4 w-4 mr-1" />
            New File
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {files.map((file) => (
            <FileItem
              key={file.path}
              file={file}
              isSelected={selectedFile === file.path}
              onSelect={selectFile}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
} 