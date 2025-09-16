// src/app/api/assets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readdir, stat, mkdir } from 'fs/promises'
import { join, extname } from 'path'
import { existsSync } from 'fs'

// Get assets path based on active directory
function getLocalAssetsPath(activeDir: string = 'docs'): string {
  return join(process.cwd(), activeDir, '_assets')
}

function getCentralAssetsPath(projectId: string): string {
  return join(process.cwd(), 'shared-assets', projectId)
}

function getStrategyFromEnv(input?: string | null) {
  const fallback = process.env.ASSET_STORAGE === 'centralized' ? 'centralized' : 'local'
  if (!input) return fallback
  return input === 'centralized' ? 'centralized' : 'local'
}

// Supported image extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico']

// Ensure assets directory exists
async function ensureAssetsDir(path: string) {
  const assetsPath = path
  if (!existsSync(assetsPath)) {
    await mkdir(assetsPath, { recursive: true })
  }
  return assetsPath
}

// GET - List all images in _assets directory
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const activeDir = searchParams.get('activeDir') || 'docs'
  const projectId = searchParams.get('projectId') || 'local-docs'
  const strategy = getStrategyFromEnv(searchParams.get('strategy'))
  
  try {
    const basePath = strategy === 'centralized'
      ? getCentralAssetsPath(projectId)
      : getLocalAssetsPath(activeDir)

    const assetsPath = await ensureAssetsDir(basePath)
    
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
          
          const qs = new URLSearchParams({
            path: file.name,
            activeDir,
            projectId,
            strategy,
          }).toString()
          const relativePath = strategy === 'centralized'
            ? `@assets/${projectId}/${file.name}`
            : `_assets/${file.name}`

          images.push({
            name: file.name,
            path: `/api/assets/serve?${qs}`,
            relativePath,
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
