import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')

  if (!filePath) {
    return NextResponse.json({ error: 'No file path provided' }, { status: 400 })
  }

  try {
    const fullPath = path.join(process.cwd(), filePath)
    const content = await fs.readFile(fullPath, 'utf-8')
    return new NextResponse(content)
  } catch (error) {
    console.error('Error reading file:', error)
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 })
  }
} 