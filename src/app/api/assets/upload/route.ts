// src/app/api/assets/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join, extname } from 'path'
import { existsSync } from 'fs'

// Get assets path based on active directory
function getAssetsPath(activeDir: string = 'docs'): string {
  return join(process.cwd(), activeDir, '_assets')
}

// Supported image extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024

// Ensure assets directory exists
async function ensureAssetsDir(activeDir: string = 'docs') {
  const assetsPath = getAssetsPath(activeDir)
  if (!existsSync(assetsPath)) {
    await mkdir(assetsPath, { recursive: true })
  }
  return assetsPath
}

// Generate unique filename if file already exists
function generateUniqueFilename(assetsPath: string, originalName: string): string {
  const ext = extname(originalName)
  const nameWithoutExt = originalName.slice(0, -ext.length)
  
  let counter = 1
  let filename = originalName
  
  while (existsSync(join(assetsPath, filename))) {
    filename = `${nameWithoutExt}_${counter}${ext}`
    counter++
  }
  
  return filename
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('image') as File
    const activeDir = formData.get('activeDir') as string || 'docs'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const ext = extname(file.name).toLowerCase()
    if (!IMAGE_EXTENSIONS.includes(ext)) {
      return NextResponse.json({ 
        error: `Unsupported file type. Supported types: ${IMAGE_EXTENSIONS.join(', ')}` 
      }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
      }, { status: 400 })
    }

    // Ensure assets directory exists
    const assetsPath = await ensureAssetsDir(activeDir)

    // Generate unique filename
    const filename = generateUniqueFilename(assetsPath, file.name)
    const filePath = join(assetsPath, filename)

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    
    await writeFile(filePath, buffer)

    console.log('Image uploaded successfully:', filename, 'to', assetsPath)

    return NextResponse.json({ 
      success: true, 
      path: `/api/assets/serve?path=${encodeURIComponent(filename)}&activeDir=${encodeURIComponent(activeDir)}`,
      relativePath: `_assets/${filename}`,
      filename,
      size: file.size
    })

  } catch (error) {
    console.error('Upload Error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}