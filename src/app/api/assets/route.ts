// src/app/api/assets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readdir, stat, mkdir } from 'fs/promises'
import { join, extname } from 'path'
import { existsSync } from 'fs'

// Get assets path based on active directory
function getAssetsPath(activeDir: string = 'docs'): string {
  return join(process.cwd(), activeDir, '_assets')
}

// Supported image extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']

// Ensure assets directory exists
async function ensureAssetsDir(activeDir: string = 'docs') {
  const assetsPath = getAssetsPath(activeDir)
  if (!existsSync(assetsPath)) {
    await mkdir(assetsPath, { recursive: true })
  }
  return assetsPath
}

// GET - List all images in _assets directory
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const activeDir = searchParams.get('activeDir') || 'docs'
  
  try {
    const assetsPath = await ensureAssetsDir(activeDir)
    
    if (!existsSync(assetsPath)) {
      return NextResponse.json({ images: [] })
    }

    const files = await readdir(assetsPath, { withFileTypes: true })
    const images = []

    for (const file of files) {
      if (file.isFile()) {
        const ext = extname(file.name).toLowerCase()
        if (IMAGE_EXTENSIONS.includes(ext)) {
          const filePath = join(assetsPath, file.name)
          const stats = await stat(filePath)
          
          images.push({
            name: file.name,
            path: `/api/assets/serve?path=${encodeURIComponent(file.name)}&activeDir=${encodeURIComponent(activeDir)}`,
            relativePath: `_assets/${file.name}`,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            extension: ext
          })
        }
      }
    }

    // Sort by name
    images.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({ images })
  } catch (error) {
    console.error('Assets GET Error:', error)
    return NextResponse.json({ error: 'Failed to list assets' }, { status: 500 })
  }
}