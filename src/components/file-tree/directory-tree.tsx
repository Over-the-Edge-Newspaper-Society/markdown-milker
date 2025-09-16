// src/components/file-tree/enhanced-directory-tree.tsx
'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Search, FileText, Wrench } from 'lucide-react'
import { FileCreationDialog, QuickCreateButtons } from './file-creation-dialog'
import { DraggableFileItem } from './draggable-file-item'
import { useFileTree } from '@/lib/hooks/use-file-tree'
import { useEditorStore } from '@/lib/stores/editor-store'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/use-toast'
import { useProjectStore } from '@/lib/stores/project-store'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  size?: number
  modified?: string
  level?: number
  sidebarOrder?: number
}

export function EnhancedDirectoryTree() {
  const { files, searchTerm, setSearchTerm, selectedFile, selectFile, refreshFiles } = useFileTree()
  const { createFile, createDirectory, moveFile } = useEditorStore()
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']))
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)
  const [isRootDragOver, setIsRootDragOver] = useState(false)
  const { activeProject } = useProjectStore()

  // Build nested tree structure from flat file list
  const fileTree = useMemo(() => {
    const tree: FileNode[] = []
    const nodeMap = new Map<string, FileNode>()

    // Filter out _assets folder from display
    const visibleFiles = files.filter(file => !file.path.startsWith('_assets'))

    // Build tree structure
    visibleFiles.forEach(file => {
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
            level,
            sidebarOrder: isLastPart ? file.sidebarOrder : undefined
          }
          
          // Only add children array for directories
          if (existingNode.type === 'directory' && !existingNode.children) {
            existingNode.children = []
          }
          
          nodeMap.set(currentPath, existingNode)
          currentLevel.push(existingNode)
        }

        const isLastPart = index === pathParts.length - 1
        if (isLastPart && file.type === 'file' && file.sidebarOrder !== undefined) {
          existingNode.sidebarOrder = file.sidebarOrder
        }
        
        if (existingNode.children && index < pathParts.length - 1) {
          currentLevel = existingNode.children
        }
      })
    })

    // Sort each level by sidebar order (with fallbacks)
    const orderCache = new WeakMap<FileNode, number>()
    const UNKNOWN_ORDER = 1_000_000

    const getNodeOrder = (node: FileNode): number => {
      if (orderCache.has(node)) {
        return orderCache.get(node)!
      }

      let value = typeof node.sidebarOrder === 'number' ? node.sidebarOrder : undefined

      if (value === undefined && node.type === 'directory' && node.children && node.children.length > 0) {
        const indexChild = node.children.find((child) => child.type === 'file' && child.name.startsWith('index.'))
        if (indexChild) {
          const childOrder = getNodeOrder(indexChild)
          if (childOrder !== UNKNOWN_ORDER) {
            value = childOrder
          }
        }

        if (value === undefined) {
          const childOrders = node.children
            .map((child) => getNodeOrder(child))
            .filter((childOrder) => childOrder !== UNKNOWN_ORDER)

          if (childOrders.length > 0) {
            value = Math.min(...childOrders)
          }
        }
      }

      if (value === undefined) {
        value = UNKNOWN_ORDER
      }

      orderCache.set(node, value)
      return value
    }

    const sortNodes = (nodes: FileNode[]) => {
      nodes.sort((a, b) => {
        const orderA = getNodeOrder(a)
        const orderB = getNodeOrder(b)

        if (orderA !== orderB) {
          return orderA - orderB
        }

        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }

        return a.name.localeCompare(b.name)
      })

      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          sortNodes(node.children)
        }
      })
    }

    sortNodes(tree)

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

  const reorderDirectory = useCallback(async (directory: string, orderedFiles: string[]) => {
    try {
      const res = await fetch('/api/starlight/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory, orderedFiles, projectId: activeProject || undefined })
      })

      if (res.ok) {
        const data = await res.json()
        toast({ title: 'Order updated', description: `${data.updated || 0} files reordered`, variant: 'success' })
        ;(globalThis as any).__FM_CACHE__ = new Map()
        await refreshFiles()
      } else {
        const err = await res.json().catch(() => ({}))
        toast({ title: 'Reorder failed', description: err.error || 'Unknown error', variant: 'error' })
      }
    } catch (error) {
      toast({ title: 'Reorder error', description: (error as Error).message, variant: 'error' })
    }
  }, [activeProject, refreshFiles])

  const handleMove = async (sourcePath: string, targetPath: string) => {
    try {
      await moveFile(sourcePath, targetPath)

      const sourceDir = sourcePath.includes('/') ? sourcePath.split('/').slice(0, -1).join('/') : ''
      const targetDir = targetPath.includes('/') ? targetPath.split('/').slice(0, -1).join('/') : ''

      const uniqueDirs = Array.from(new Set([sourceDir, targetDir]))

      await Promise.all(uniqueDirs.map(async (dir) => {
        try {
          const dirRes = await fetch('/api/starlight/rebalance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ directory: dir, projectId: activeProject || undefined })
          })
          if (!dirRes.ok) {
            const err = await dirRes.json().catch(() => ({}))
            console.error('Rebalance failed for', dir, err)
          }
        } catch (err) {
          console.error('Failed to trigger rebalance for', dir, err)
        }
      }))

      ;(globalThis as any).__FM_CACHE__ = new Map()
      await refreshFiles()
    } catch (error) {
      console.error('Failed to move item:', error)
      throw error
    }
  }

  const handleOrderMove = useCallback(async (node: FileNode, direction: 'up' | 'down', levelNodes: FileNode[]) => {
    if (node.type !== 'file' || node.name === 'index.md') {
      return
    }

    const siblings = levelNodes.filter((n) => n.type === 'file')
    const currentIndex = siblings.findIndex((n) => n.path === node.path)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= siblings.length) return

    const ordered = [...siblings]
    const [moved] = ordered.splice(currentIndex, 1)
    ordered.splice(targetIndex, 0, moved)

    const parentPath = node.path.includes('/') ? node.path.split('/').slice(0, -1).join('/') : ''
    const orderedNames = ordered.map((sibling) => sibling.name)

    await reorderDirectory(parentPath, orderedNames)
  }, [reorderDirectory])

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
      if (!newPath || newPath === sourcePath) {
        return
      }
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
    const fileNodes = nodes.filter((n) => n.type === 'file')

    return nodes.map((node, index) => {
      const isExpanded = expandedFolders.has(node.path)
      const isSelected = selectedFile === node.path
      const isDragOver = dragOverPath === node.path
      const fileIndex = node.type === 'file' ? fileNodes.findIndex((n) => n.path === node.path) : -1
      const canMoveUp = node.type === 'file' && node.name !== 'index.md' && fileIndex > 0
      const canMoveDown = node.type === 'file' && node.name !== 'index.md' && fileIndex > -1 && fileIndex < fileNodes.length - 1
      
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
            onMoveUp={canMoveUp ? () => handleOrderMove(node, 'up', nodes) : undefined}
            onMoveDown={canMoveDown ? () => handleOrderMove(node, 'down', nodes) : undefined}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
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

        {/* Order tools */}
        <div className="flex items-center justify-between">
          <button
            className="text-xs px-2 py-1 rounded border hover:bg-muted"
            title="Fix all sidebar orders in this directory"
            onClick={async () => {
              const path = selectedFile || ''
              const dir = path ? path.split('/').slice(0, -1).join('/') : ''
              try {
                const res = await fetch('/api/starlight/rebalance', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ directory: dir, projectId: activeProject || undefined })
                })
                if (res.ok) {
                  const data = await res.json()
                  toast({ title: 'Orders fixed', description: `${data.updated || 0} files updated`, variant: 'success' })
                  ;(globalThis as any).__FM_CACHE__ = new Map() // invalidate cached frontmatter
                  await refreshFiles()
                } else {
                  const err = await res.json().catch(() => ({}))
                  toast({ title: 'Rebalance failed', description: err.error || 'Unknown error', variant: 'error' })
                }
              } catch (e) {
                toast({ title: 'Rebalance error', description: (e as Error).message, variant: 'error' })
              }
            }}
          >
            <span className="inline-flex items-center gap-1"><Wrench className="h-3 w-3" /> Fix All Orders</span>
          </button>
          <button
            className="text-xs px-2 py-1 rounded border hover:bg-muted"
            title="Fix all sidebar orders in the entire docs tree"
            onClick={async () => {
              try {
                const res = await fetch('/api/starlight/rebalance', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ directory: '', projectId: activeProject || undefined })
                })
                if (res.ok) {
                  const data = await res.json()
                  toast({ title: 'Orders fixed (root)', description: `${data.updated || 0} files updated`, variant: 'success' })
                  ;(globalThis as any).__FM_CACHE__ = new Map()
                  await refreshFiles()
                } else {
                  const err = await res.json().catch(() => ({}))
                  toast({ title: 'Rebalance failed', description: err.error || 'Unknown error', variant: 'error' })
                }
              } catch (e) {
                toast({ title: 'Rebalance error', description: (e as Error).message, variant: 'error' })
              }
            }}
          >
            <span className="inline-flex items-center gap-1"><Wrench className="h-3 w-3" /> Fix All • Root</span>
          </button>
        </div>
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
