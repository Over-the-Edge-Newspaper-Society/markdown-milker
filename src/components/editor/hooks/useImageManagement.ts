// src/components/editor/hooks/useImageManagement.ts
'use client'

import { useCallback } from 'react'
import { useEditorStore } from '@/lib/stores/editor-store'

export function useImageManagement() {
  const { uploadImage, activeDirectory } = useEditorStore()

  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    try {
      console.log('📸 Uploading image to assets:', file.name)
      const imagePath = await uploadImage(file)
      console.log('✅ Image uploaded successfully:', imagePath)
      return imagePath
    } catch (error) {
      console.error('❌ Image upload failed:', error)
      throw error
    }
  }, [uploadImage])

  const handleCustomImageUpload = useCallback(async (file?: File | null): Promise<string> => {
    if (file) {
      const result = await handleImageUpload(file)
      
      if (result.startsWith('/api/assets/serve?path=')) {
        return result
      } else if (result.startsWith('_assets/')) {
        const filename = result.replace('_assets/', '')
        return `/api/assets/serve?path=${encodeURIComponent(filename)}&activeDir=${encodeURIComponent(activeDirectory)}`
      } else {
        return `/api/assets/serve?path=${encodeURIComponent(result)}&activeDir=${encodeURIComponent(activeDirectory)}`
      }
    }
    
    // Open image picker instead
    return Promise.reject(new Error('User will select from picker'))
  }, [handleImageUpload, activeDirectory])

  return {
    handleImageUpload,
    handleCustomImageUpload
  }
}