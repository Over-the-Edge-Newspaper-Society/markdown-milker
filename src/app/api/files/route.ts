import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, readdir } from 'fs/promises'
import { join } from 'path'

// List files in the docs directory
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')

  try {
    // If path is provided, read file content
    if (path) {
      const fullPath = join(process.cwd(), 'docs', path)
      const content = await readFile(fullPath, 'utf-8')
      return NextResponse.json({ content })
    }

    // Otherwise, list files in the docs directory
    const docsPath = join(process.cwd(), 'docs')
    const files = await readdir(docsPath, { withFileTypes: true })
    
    const fileList = files.map(file => ({
      name: file.name,
      path: file.name,
      type: file.isDirectory() ? 'directory' : 'file'
    }))

    return NextResponse.json(fileList)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Failed to read directory' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { path, content } = await request.json()
  
  try {
    const fullPath = join(process.cwd(), 'docs', path)
    await writeFile(fullPath, content, 'utf-8')
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 })
  }
} 