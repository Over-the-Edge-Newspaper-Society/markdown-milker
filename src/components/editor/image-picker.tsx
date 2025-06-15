// src/components/editor/image-picker.tsx
'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Upload, 
  Image as ImageIcon, 
  Search, 
  Check,
  FileImage,
  Eye
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEditorStore } from '@/lib/stores/editor-store'

interface ImageAsset {
  name: string
  path: string
  relativePath: string
  size: number
  modified: string
  extension: string
}

interface ImagePickerProps {
  onImageSelect: (imagePath: string) => void
  trigger?: React.ReactNode
  activeDir?: string
}

export function ImagePicker({ onImageSelect, trigger, activeDir = 'docs' }: ImagePickerProps) {
  const [open, setOpen] = useState(false)
  const [assets, setAssets] = useState<ImageAsset[]>([])
  const [filteredAssets, setFilteredAssets] = useState<ImageAsset[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { uploadImage, getAssetImages } = useEditorStore()

  // Load assets when dialog opens
  useEffect(() => {
    if (open) {
      loadAssets()
    }
  }, [open])

  // Filter assets based on search term
  useEffect(() => {
    if (searchTerm) {
      setFilteredAssets(
        assets.filter(asset => 
          asset.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    } else {
      setFilteredAssets(assets)
    }
  }, [assets, searchTerm])

  const loadAssets = async () => {
    setIsLoading(true)
    try {
      // Use the updated API with activeDir parameter
      const response = await fetch(`/api/assets?activeDir=${encodeURIComponent(activeDir)}`)
      if (!response.ok) {
        throw new Error('Failed to fetch assets')
      }
      const data = await response.json()
      setAssets(data.images || [])
    } catch (error) {
      console.error('Failed to load assets:', error)
      setAssets([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 100)

      // Create FormData with activeDir
      const formData = new FormData()
      formData.append('image', file)
      formData.append('activeDir', activeDir)

      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result = await response.json()
      
      clearInterval(progressInterval)
      setUploadProgress(100)
      
      // Reload assets to include the new image
      await loadAssets()
      
      // Auto-select the newly uploaded image
      setSelectedAsset(result.relativePath)
      
      setTimeout(() => {
        setUploadProgress(0)
        setIsUploading(false)
      }, 500)

    } catch (error) {
      console.error('Upload failed:', error)
      alert('Failed to upload image: ' + (error as Error).message)
      setUploadProgress(0)
      setIsUploading(false)
    }
  }

  const handleImageSelect = () => {
    if (selectedAsset) {
      onImageSelect(selectedAsset)
      setOpen(false)
      setSelectedAsset(null)
      setSearchTerm('')
      setPreviewImage(null)
    }
  }

  const handleAssetClick = (asset: ImageAsset) => {
    setSelectedAsset(asset.relativePath)
    setPreviewImage(asset.path)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString()
  }

  const handleDialogClose = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      setSelectedAsset(null)
      setSearchTerm('')
      setPreviewImage(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <ImageIcon className="h-4 w-4 mr-2" />
            Insert Image
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-6xl h-[75vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-0 flex-shrink-0">
          <DialogTitle>Insert Image</DialogTitle>
          <DialogDescription>
            Choose an existing image or upload a new one to your assets library ({activeDir}/_assets).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 gap-0 overflow-hidden min-h-0">
          {/* Left Panel - Upload and Library */}
          <div className="flex-1 flex flex-col p-6 pt-4 space-y-4 min-w-0 border-r">
            {/* Upload Section */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">Upload New Image</Label>
                {isUploading && (
                  <div className="text-xs text-muted-foreground">
                    {uploadProgress}%
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e.target.files)}
                  className="hidden"
                />
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? 'Uploading...' : 'Choose File'}
                </Button>
              </div>
              
              {isUploading && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Search Section */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Choose from Library</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search images..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            {/* Assets Grid - Fixed height to prevent layout issues */}
            <div className="flex-1 border rounded-lg overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
                      <span className="ml-2 text-sm text-muted-foreground">Loading images...</span>
                    </div>
                  ) : filteredAssets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center">
                      <FileImage className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {searchTerm ? 'No images match your search' : 'No images in library'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {searchTerm ? 'Try a different search term' : 'Upload your first image to get started'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {filteredAssets.map((asset) => (
                        <div
                          key={asset.relativePath}
                          className={cn(
                            'relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200',
                            selectedAsset === asset.relativePath
                              ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                              : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                          )}
                          onClick={() => handleAssetClick(asset)}
                        >
                          <div className="aspect-square bg-transparent relative overflow-hidden">
                            <img
                              src={asset.path}
                              alt={asset.name}
                              className="w-full h-full object-cover"
                              style={{ backgroundColor: 'transparent' }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ0cmFuc3BhcmVudCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZTwvdGV4dD48L3N2Zz4='
                              }}
                            />
                            
                            {/* Selection Indicator */}
                            {selectedAsset === asset.relativePath && (
                              <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                  <Check className="w-4 h-4 text-white" />
                                </div>
                              </div>
                            )}
                            
                            {/* Hover Info */}
                            <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-xs truncate">{asset.name}</p>
                              <p className="text-xs text-gray-300">
                                {formatFileSize(asset.size)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Right Panel - Preview (Fixed width, no overlap) */}
          <div className="w-80 flex flex-col p-6 pt-4 space-y-4 overflow-hidden">
            {selectedAsset ? (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Preview</Label>
                  <div className="border rounded-lg p-2 bg-muted/30 overflow-hidden">
                    <div className="w-full h-48 bg-transparent rounded overflow-hidden flex items-center justify-center">
                      {previewImage && (
                        <img
                          src={previewImage}
                          alt="Preview"
                          className="max-w-full max-h-full object-contain"
                          style={{ backgroundColor: 'transparent' }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Selected Image Info */}
                <div className="space-y-2 flex-1">
                  <Label className="text-sm font-medium">Image Details</Label>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    {(() => {
                      const asset = filteredAssets.find(a => a.relativePath === selectedAsset)
                      if (!asset) return null
                      
                      return (
                        <>
                          <p className="text-sm font-medium truncate">{asset.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Size: {formatFileSize(asset.size)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Modified: {formatDate(asset.modified)}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono break-all">
                            Path: {asset.relativePath}
                          </p>
                        </>
                      )
                    })()}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Select an image to see preview
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions - Fixed at bottom, no overlap */}
        <div className="flex justify-end gap-2 p-6 pt-4 border-t bg-background flex-shrink-0">
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleImageSelect}
            disabled={!selectedAsset}
          >
            Insert Image
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}