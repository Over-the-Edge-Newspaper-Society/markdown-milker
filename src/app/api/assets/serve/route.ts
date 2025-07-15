// src/app/api/assets/serve/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Serve static assets from docs/_assets directory
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')
  const activeDir = searchParams.get('activeDir') || 'docs'
  
  if (!path) {
    return NextResponse.json({ error: 'No path provided' }, { status: 400 })
  }

  try {
    const filePath = join(process.cwd(), activeDir, '_assets', path)
    
    // Security check
    const assetsDir = join(process.cwd(), activeDir, '_assets')
    if (!filePath.startsWith(assetsDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }
    
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    const file = await readFile(filePath)
    
    // Determine content type based on file extension
    const ext = path.split('.').pop()?.toLowerCase()
    const contentTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'bmp': 'image/bmp',
      'ico': 'image/x-icon'
    }
    
    const contentType = contentTypes[ext || ''] || 'application/octet-stream'
    
    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
    
  } catch (error) {
    console.error('Error serving asset:', error)
    return NextResponse.json({ error: 'Failed to serve asset' }, { status: 500 })
  }
}