// src/components/file-tree/enhanced-directory-tree.tsx
'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Search, FileText } from 'lucide-react'
import { FileCreationDialog, QuickCreateButtons } from './file-creation-dialog'
import { DraggableFileItem } from './draggable-file-item'
import { useFileTree } from '@/lib/hooks/use-file-tree'
import { useEditorStore } from '@/lib/stores/editor-store'
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

export function EnhancedDirectoryTree() {
  const { files, searchTerm, setSearchTerm, selectedFile, selectFile, refreshFiles } = useFileTree()
  const { createFile, createDirectory, moveFile } = useEditorStore()
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']))
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)
  const [isRootDragOver, setIsRootDragOver] = useState(false)

  // Build nested tree structure from flat file list
  const fileTree = useMemo(() => {
    const tree: FileNode[] = []
    const nodeMap = new Map<string, FileNode>()

    // Filter out _assets folder from display
    const visibleFiles = files.filter(file => !file.path.startsWith('_assets'))

    // Sort files: directories first, then alphabetically
    const sortedFiles = [...visibleFiles].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      return a.path.localeCompare(b.path)
    })

    // Build tree structure
    sortedFiles.forEach(file => {
      const pathParts = file.path.split('/')
      let currentPath = ''
      let currentLevel = tree
      let level = 0

      pathParts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part
        level = index
        
        let existingNode = nodeMap.get(currentPath)
        
        if (!existingNode) {
          const isLastPart = index === pathParts.length - 1
          existingNode = {
            name: part,
            path: currentPath,
            type: isLastPart ? file.type : 'directory',
            children: isLastPart && file.type === 'directory' ? [] : undefined,
            size: file.size,
            modified: file.modified,
            level
          }
          
          // Only add children array for directories
          if (existingNode.type === 'directory' && !existingNode.children) {
            existingNode.children = []
          }
          
          nodeMap.set(currentPath, existingNode)
          currentLevel.push(existingNode)
          
          // Sort current level
          currentLevel.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1
            }
            return a.name.localeCompare(b.name)
          })
        }
        
        if (existingNode.children && index < pathParts.length - 1) {
          currentLevel = existingNode.children
        }
      })
    })

    return tree
  }, [files])

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }, [])

  const handleCreateFile = async (name: string, parentPath?: string) => {
    try {
      const fullPath = parentPath ? `${parentPath}/${name}` : name
      let fileName = fullPath
      if (!fileName.endsWith('.md') && !fileName.endsWith('.markdown')) {
        fileName += '.md'
      }
      
      await createFile(fileName, '# New Document\n\nStart writing here...')
      await refreshFiles()
      selectFile(fileName)
    } catch (error) {
      console.error('Failed to create file:', error)
      throw error
    }
  }

  const handleCreateFolder = async (name: string, parentPath?: string) => {
    try {
      const fullPath = parentPath ? `${parentPath}/${name}` : name
      await createDirectory(fullPath)
      await refreshFiles()
      // Auto-expand the new folder
      setExpandedFolders(prev => new Set([...prev, fullPath]))
    } catch (error) {
      console.error('Failed to create folder:', error)
      throw error
    }
  }

  const handleMove = async (sourcePath: string, targetPath: string) => {
    try {
      await moveFile(sourcePath, targetPath)
      await refreshFiles()
    } catch (error) {
      console.error('Failed to move item:', error)
      throw error
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent, path: string, isDirectory: boolean) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (isDirectory) {
      setDragOverPath(path)
      setIsRootDragOver(false)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverPath(null)
    setIsRootDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent, targetPath: string, isDirectory: boolean) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverPath(null)
    setIsRootDragOver(false)

    if (!isDirectory) return

    const sourcePath = e.dataTransfer.getData('text/plain')
    if (!sourcePath || sourcePath === targetPath) return

    try {
      const fileName = sourcePath.split('/').pop()
      const newPath = targetPath ? `${targetPath}/${fileName}` : fileName
      await handleMove(sourcePath, newPath!)
    } catch (error) {
      console.error('Drop failed:', error)
    }
  }, [handleMove])

  // Enhanced root drag handlers
  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const sourcePath = e.dataTransfer.getData('text/plain')
    // Only show root drop zone if the file is NOT already in root
    if (sourcePath && sourcePath.includes('/')) {
      setIsRootDragOver(true)
      setDragOverPath(null)
    }
  }, [])

  const handleRootDragLeave = useCallback((e: React.DragEvent) => {
    // Check if we're actually leaving the scroll area
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsRootDragOver(false)
    }
  }, [])

  const handleRootDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsRootDragOver(false)

    const sourcePath = e.dataTransfer.getData('text/plain')
    if (!sourcePath || !sourcePath.includes('/')) return // Already in root

    try {
      const fileName = sourcePath.split('/').pop()
      if (fileName && sourcePath !== fileName) {
        await handleMove(sourcePath, fileName)
      }
    } catch (error) {
      console.error('Root drop failed:', error)
    }
  }, [handleMove])

  // Filter tree based on search
  const filteredTree = useMemo(() => {
    if (!searchTerm) return fileTree
    
    const filterTree = (nodes: FileNode[]): FileNode[] => {
      return nodes.reduce((acc, node) => {
        const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase())
        const filteredChildren = node.children ? filterTree(node.children) : []
        
        if (matchesSearch || filteredChildren.length > 0) {
          acc.push({
            ...node,
            children: filteredChildren.length > 0 ? filteredChildren : node.children
          })
          
          // Auto-expand matching folders
          if (node.type === 'directory' && (matchesSearch || filteredChildren.length > 0)) {
            setExpandedFolders(prev => new Set([...prev, node.path]))
          }
        }
        
        return acc
      }, [] as FileNode[])
    }
    
    return filterTree(fileTree)
  }, [fileTree, searchTerm])

  const renderFileTree = (nodes: FileNode[], level: number = 0): React.ReactNode => {
    return nodes.map((node, index) => {
      const isExpanded = expandedFolders.has(node.path)
      const isSelected = selectedFile === node.path
      const isDragOver = dragOverPath === node.path
      
      return (
        <div key={node.path}>
          <DraggableFileItem
            node={node}
            level={level}
            isExpanded={isExpanded}
            isSelected={isSelected}
            isDragOver={isDragOver}
            isLast={index === nodes.length - 1}
            onToggle={toggleFolder}
            onSelect={selectFile}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
          
          {/* Render children if expanded */}
          {node.type === 'directory' && 
           node.children && 
           node.children.length > 0 && 
           isExpanded && (
            <div>
              {renderFileTree(node.children, level + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        
        {/* Quick Create Buttons */}
        <QuickCreateButtons
          onCreateFile={handleCreateFile}
          onCreateFolder={handleCreateFolder}
        />
      </div>

      {/* File Tree with Full Height Root Drop Zone */}
      <div className="flex-1 relative">
        <ScrollArea 
          className="h-full"
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
        >
          <div 
            className={cn(
              "p-2 min-h-full relative",
              isRootDragOver && "bg-blue-50 dark:bg-blue-900/20"
            )}
          >
            {/* Root drop indicator - spans full height */}
            {isRootDragOver && (
              <div className="absolute inset-2 border-2 border-dashed border-blue-400 rounded bg-blue-50/50 dark:bg-blue-900/20 flex items-center justify-center z-10 pointer-events-none">
                <div className="text-center">
                  <div className="text-4xl mb-2">📁</div>
                  <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    Drop here to move to root directory
                  </div>
                </div>
              </div>
            )}
            
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
              renderFileTree(filteredTree)
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}