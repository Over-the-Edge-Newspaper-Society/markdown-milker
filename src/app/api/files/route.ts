import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, readdir, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'

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

// Handle both POST and PUT methods for saving files
export async function POST(request: NextRequest) {
  return handleSave(request)
}

export async function PUT(request: NextRequest) {
  return handleSave(request)
}

async function handleSave(request: NextRequest) {
  try {
    const body = await request.json()
    const { path, content } = body
    
    console.log('Saving file:', { path, contentLength: content?.length })
    
    if (!path || content === undefined) {
      console.error('Missing path or content:', { path, hasContent: content !== undefined })
      return NextResponse.json({ error: 'Missing path or content' }, { status: 400 })
    }

    const fullPath = join(process.cwd(), 'docs', path)
    const dir = dirname(fullPath)

    console.log('Full path:', fullPath)
    console.log('Directory:', dir)

    // Ensure the directory exists
    if (!existsSync(dir)) {
      console.log('Creating directory:', dir)
      await mkdir(dir, { recursive: true })
    }

    // Write the file
    console.log('Writing file...')
    await writeFile(fullPath, content, 'utf-8')
    console.log('File written successfully')
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving file:', error)
    return NextResponse.json({ error: 'Failed to save file' }, { status: 500 })
  }
} 