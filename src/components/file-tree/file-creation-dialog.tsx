// src/components/file-tree/file-creation-dialog.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, FolderPlus, FileText, Folder } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileCreationDialogProps {
  onCreateFile: (name: string, content?: string) => Promise<void>
  onCreateFolder: (name: string, path?: string) => Promise<void>
  currentPath?: string
  trigger?: React.ReactNode
  defaultType?: 'file' | 'folder' // Add default type prop
}

type CreationType = 'file' | 'folder'

export function FileCreationDialog({
  onCreateFile,
  onCreateFolder,
  currentPath = '',
  trigger,
  defaultType = 'file' // Default to file
}: FileCreationDialogProps) {
  const [open, setOpen] = useState(false)
  const [creationType, setCreationType] = useState<CreationType>(defaultType)
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [createIndexFile, setCreateIndexFile] = useState(true)
  const [showIndexTitleDialog, setShowIndexTitleDialog] = useState(false)
  const [indexTitle, setIndexTitle] = useState('')
  const [pendingFolderPath, setPendingFolderPath] = useState('')

  // Reset to default type when dialog opens
  useEffect(() => {
    if (open) {
      setCreationType(defaultType)
      setName('')
      setError('')
      setCreateIndexFile(true)
      setIndexTitle('')
    }
  }, [open, defaultType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsLoading(true)
    setError('')

    try {
      const fullPath = currentPath ? `${currentPath}/${name.trim()}` : name.trim()

      if (creationType === 'file') {
        let fileName = fullPath
        if (!fileName.endsWith('.md') && !fileName.endsWith('.markdown')) {
          fileName += '.md'
        }
        await onCreateFile(fileName)
        setOpen(false)
        setName('')
        setCreationType(defaultType)
        setCreateIndexFile(true)
      } else {
        // Create the folder
        await onCreateFolder(fullPath)

        // If checkbox is checked, show title dialog
        if (createIndexFile) {
          setPendingFolderPath(fullPath)
          setIndexTitle(name.trim().split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' '))
          setOpen(false)
          setShowIndexTitleDialog(true)
        } else {
          setOpen(false)
          setName('')
          setCreationType(defaultType)
          setCreateIndexFile(true)
        }
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to create item')
    } finally {
      setIsLoading(false)
    }
  }

  const handleIndexSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!indexTitle.trim()) return

    setIsLoading(true)
    setError('')

    try {
      const indexFileName = `${pendingFolderPath}/index.md`
      const indexContent = `---
title: ${indexTitle.trim()}
---

# ${indexTitle.trim()}

Start writing here...`

      await onCreateFile(indexFileName, indexContent)

      setShowIndexTitleDialog(false)
      setName('')
      setCreationType(defaultType)
      setCreateIndexFile(true)
      setIndexTitle('')
      setPendingFolderPath('')
    } catch (err) {
      setError((err as Error).message || 'Failed to create index file')
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setName('')
      setError('')
      setCreationType(defaultType)
      setCreateIndexFile(true)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New {creationType === 'file' ? 'File' : 'Folder'}</DialogTitle>
          <DialogDescription>
            Create a new {creationType} in {currentPath || 'the root directory'}.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type Selection */}
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={creationType === 'file' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setCreationType('file')}
              >
                <FileText className="h-4 w-4 mr-2" />
                File
              </Button>
              <Button
                type="button"
                variant={creationType === 'folder' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setCreationType('folder')}
              >
                <Folder className="h-4 w-4 mr-2" />
                Folder
              </Button>
            </div>
          </div>

          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="name">
              {creationType === 'file' ? 'File name' : 'Folder name'}
            </Label>
            <div className="flex items-center space-x-2">
              <div className="flex-1">
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    creationType === 'file'
                      ? 'my-document'
                      : 'my-folder'
                  }
                  className={cn(error && 'border-red-500')}
                  autoFocus
                />
                {creationType === 'file' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    .md extension will be added automatically
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Create Index File Option - Only show for folders */}
          {creationType === 'folder' && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="create-index"
                checked={createIndexFile}
                onCheckedChange={(checked) => setCreateIndexFile(checked as boolean)}
              />
              <Label
                htmlFor="create-index"
                className="text-sm font-normal cursor-pointer"
              >
                Create index.md file
              </Label>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
              {error}
            </div>
          )}

          {/* Path Preview */}
          {(currentPath || name) && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Path Preview</Label>
              <div className="text-sm bg-muted p-2 rounded font-mono">
                {currentPath ? `${currentPath}/` : ''}{name || '...'}
                {creationType === 'file' && name && !name.endsWith('.md') && !name.endsWith('.markdown') ? '.md' : ''}
              </div>
            </div>
          )}
        </form>

        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!name.trim() || isLoading}
          >
            {isLoading ? 'Creating...' : `Create ${creationType}`}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Index Title Dialog */}
      <Dialog open={showIndexTitleDialog} onOpenChange={setShowIndexTitleDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Set Index File Title</DialogTitle>
            <DialogDescription>
              Enter the title for the index.md file in {pendingFolderPath}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleIndexSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="index-title">Title</Label>
              <Input
                id="index-title"
                value={indexTitle}
                onChange={(e) => setIndexTitle(e.target.value)}
                placeholder="Enter title"
                className={cn(error && 'border-red-500')}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This will be used in the frontmatter and as the main heading
              </p>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Preview</Label>
              <div className="text-sm bg-muted p-2 rounded font-mono whitespace-pre">
                {`---
title: ${indexTitle || '...'}
---

# ${indexTitle || '...'}`}
              </div>
            </div>
          </form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowIndexTitleDialog(false)
                setIndexTitle('')
                setPendingFolderPath('')
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleIndexSubmit}
              disabled={!indexTitle.trim() || isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Index File'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

// Quick action buttons component with proper default types
export function QuickCreateButtons({ 
  onCreateFile, 
  onCreateFolder, 
  currentPath 
}: Omit<FileCreationDialogProps, 'trigger' | 'defaultType'>) {
  return (
    <div className="flex gap-2">
      {/* File Button - defaults to file mode */}
      <FileCreationDialog
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        currentPath={currentPath}
        defaultType="file"
        trigger={
          <Button size="sm" variant="outline" className="flex-1">
            <Plus className="h-4 w-4 mr-1" />
            New File
          </Button>
        }
      />
      
      {/* Folder Button - defaults to folder mode */}
      <FileCreationDialog
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        currentPath={currentPath}
        defaultType="folder"
        trigger={
          <Button size="sm" variant="outline">
            <FolderPlus className="h-4 w-4" />
          </Button>
        }
      />
    </div>
  )
}