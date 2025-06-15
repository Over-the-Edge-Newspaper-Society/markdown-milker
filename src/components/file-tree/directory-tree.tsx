'use client'

import React, { useState, useMemo } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Plus, FolderPlus, FileText } from 'lucide-react'
import { CollapsibleFileItem } from './collapsible-file-item'
import { useFileTree } from '@/lib/hooks/use-file-tree'
import { useEditorStore } from '@/lib/stores/editor-store'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  size?: number
  modified?: string
}

export function DirectoryTree() {
  const { files, searchTerm, setSearchTerm, selectedFile, selectFile, refreshFiles } = useFileTree()
  const { createFile, createDirectory } = useEditorStore()
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Transform flat file list into tree structure
  const fileTree = useMemo(() => {
    const tree: FileNode[] = []
    const pathMap = new Map<string, FileNode>()

    // Sort files so directories come first
    const sortedFiles = [...files].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.path.localeCompare(b.path)
    })

    sortedFiles.forEach(file => {
      const pathParts = file.path.split('/')
      let currentPath = ''
      let currentLevel = tree

      pathParts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part
        
        let existingNode = pathMap.get(currentPath)
        
        if (!existingNode) {
          const isLastPart = index === pathParts.length - 1
          existingNode = {
            name: part,
            path: currentPath,
            type: isLastPart ? file.type : 'directory',
            children: [],
            size: file.size,
            modified: file.modified
          }
          
          pathMap.set(currentPath, existingNode)
          currentLevel.push(existingNode)
        }
        
        if (existingNode.children) {
          currentLevel = existingNode.children
        }
      })
    })

    return tree
  }, [files])

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }

  const handleCreateFile = async () => {
    const fileName = prompt('Enter file name (without .md extension):')
    if (!fileName) return
    
    try {
      let fullFileName = fileName.trim()
      if (!fullFileName.endsWith('.md') && !fullFileName.endsWith('.markdown')) {
        fullFileName += '.md'
      }
      
      await createFile(fullFileName, '# New Document\n\nStart writing here...')
      await refreshFiles()
      selectFile(fullFileName)
    } catch (error) {
      console.error('Failed to create file:', error)
      alert('Failed to create file: ' + (error as Error).message)
    }
  }

  const handleCreateFolder = async () => {
    const folderName = prompt('Enter folder name:')
    if (!folderName) return
    
    try {
      await createDirectory(folderName.trim())
      await refreshFiles()
      // Auto-expand the new folder
      setExpandedFolders(prev => new Set([...prev, folderName.trim()]))
    } catch (error) {
      console.error('Failed to create folder:', error)
      alert('Failed to create folder: ' + (error as Error).message)
    }
  }

  const filteredTree = useMemo(() => {
    if (!searchTerm) return fileTree
    
    const filterTree = (nodes: FileNode[]): FileNode[] => {
      return nodes.reduce((acc, node) => {
        const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase())
        const filteredChildren = node.children ? filterTree(node.children) : []
        
        if (matchesSearch || filteredChildren.length > 0) {
          acc.push({
            ...node,
            children: filteredChildren
          })
          // Auto-expand folders when searching
          if (node.type === 'directory' && (matchesSearch || filteredChildren.length > 0)) {
            setExpandedFolders(prev => new Set([...prev, node.path]))
          }
        }
        
        return acc
      }, [] as FileNode[])
    }
    
    return filterTree(fileTree)
  }, [fileTree, searchTerm])

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b">
        <div className="relative mb-3">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={handleCreateFile}>
            <Plus className="h-4 w-4 mr-1" />
            New File
          </Button>
          
          <Button size="sm" variant="outline" onClick={handleCreateFolder}>
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredTree.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchTerm ? 'No files match your search' : 'No files found'}
              </p>
              <p className="text-xs text-muted-foreground">
                {searchTerm ? 'Try a different search term' : 'Create your first file to get started'}
              </p>
            </div>
          ) : (
            filteredTree.map((node) => (
              <CollapsibleFileItem
                key={node.path}
                node={node}
                level={0}
                isExpanded={expandedFolders.has(node.path)}
                isSelected={selectedFile === node.path}
                onToggle={toggleFolder}
                onSelect={selectFile}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}