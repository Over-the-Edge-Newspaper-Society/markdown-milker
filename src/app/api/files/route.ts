import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET() {
  try {
    const files = await fs.readdir(process.cwd(), { withFileTypes: true })
    const fileList = files.map(file => ({
      name: file.name,
      path: path.join(process.cwd(), file.name),
      type: file.isDirectory() ? 'directory' : 'file'
    }))

    return NextResponse.json(fileList)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to read directory' },
      { status: 500 }
    )
  }
} 