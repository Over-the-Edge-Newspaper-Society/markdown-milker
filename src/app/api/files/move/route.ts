// src/app/api/files/move/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { rename, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'

const DOCS_PATH = join(process.cwd(), 'docs')

// Security check to prevent path traversal
function isSecurePath(requestedPath: string) {
  const fullPath = join(DOCS_PATH, requestedPath)
  return fullPath.startsWith(DOCS_PATH)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourcePath, targetPath } = body
    
    console.log('Move request:', { sourcePath, targetPath })
    
    if (!sourcePath || !targetPath) {
      return NextResponse.json({ error: 'Source and target paths are required' }, { status: 400 })
    }

    if (!isSecurePath(sourcePath) || !isSecurePath(targetPath)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const sourceFullPath = join(DOCS_PATH, sourcePath)
    const targetFullPath = join(DOCS_PATH, targetPath)

    // Check if source exists
    if (!existsSync(sourceFullPath)) {
      return NextResponse.json({ error: 'Source file/directory does not exist' }, { status: 404 })
    }

    // Check if target already exists
    if (existsSync(targetFullPath)) {
      return NextResponse.json({ error: 'Target already exists' }, { status: 409 })
    }

    // Ensure target directory exists
    const targetDir = dirname(targetFullPath)
    if (!existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true })
    }

    // Use rename for atomic move (works for both files and directories)
    await rename(sourceFullPath, targetFullPath)
    
    console.log('Successfully moved:', sourceFullPath, '->', targetFullPath)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Move Error:', error)
    return NextResponse.json({ error: 'Failed to move item' }, { status: 500 })
  }
}

