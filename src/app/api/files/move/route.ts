// src/app/api/files/move/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir, unlink, rmdir, stat } from 'fs/promises'
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

    // Get source stats to determine if it's a file or directory
    const sourceStats = await stat(sourceFullPath)

    if (sourceStats.isFile()) {
      // Move file
      const content = await readFile(sourceFullPath, 'utf-8')
      await writeFile(targetFullPath, content, 'utf-8')
      await unlink(sourceFullPath)
    } else if (sourceStats.isDirectory()) {
      // Move directory (recursive)
      await moveDirectory(sourceFullPath, targetFullPath)
      await removeDirectory(sourceFullPath)
    }
    
    console.log('Successfully moved:', sourceFullPath, '->', targetFullPath)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Move Error:', error)
    return NextResponse.json({ error: 'Failed to move item' }, { status: 500 })
  }
}

// Helper function to recursively move directory contents
async function moveDirectory(sourcePath: string, targetPath: string) {
  const { readdir } = require('fs/promises')
  
  // Create target directory
  await mkdir(targetPath, { recursive: true })
  
  // Read source directory contents
  const items = await readdir(sourcePath, { withFileTypes: true })
  
  for (const item of items) {
    const sourceItemPath = join(sourcePath, item.name)
    const targetItemPath = join(targetPath, item.name)
    
    if (item.isDirectory()) {
      await moveDirectory(sourceItemPath, targetItemPath)
    } else {
      const content = await readFile(sourceItemPath, 'utf-8')
      await writeFile(targetItemPath, content, 'utf-8')
    }
  }
}

// Helper function to recursively remove directory
async function removeDirectory(dirPath: string) {
  const { readdir } = require('fs/promises')
  
  try {
    const items = await readdir(dirPath, { withFileTypes: true })
    
    for (const item of items) {
      const itemPath = join(dirPath, item.name)
      
      if (item.isDirectory()) {
        await removeDirectory(itemPath)
      } else {
        await unlink(itemPath)
      }
    }
    
    await rmdir(dirPath)
  } catch (error) {
    console.error('Error removing directory:', error)
  }
}