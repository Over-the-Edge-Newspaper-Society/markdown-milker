// src/app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { existsSync, rmSync } from 'fs'

export async function GET(_request: NextRequest) {
  try {
    const projectsRoot = join(process.cwd(), 'projects')
    let items: any[] = []
    try {
      const entries = await readdir(projectsRoot, { withFileTypes: true })
      for (const e of entries) {
        if (e.isDirectory()) {
          const id = e.name
          const astroConfig = join(projectsRoot, id, 'astro.config.mjs')
          const isStarlight = true // assume; deeper detection optional
          items.push({ id, name: id, isStarlight, path: join(projectsRoot, id) })
        }
      }
    } catch {}
    return NextResponse.json({ projects: items })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to list projects' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const projectsRoot = join(process.cwd(), 'projects')
    const projectPath = join(projectsRoot, projectId)

    // Check if project exists
    if (!existsSync(projectPath)) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Delete the project directory recursively using sync method (more reliable for large node_modules)
    rmSync(projectPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })

    console.log(`✅ Deleted project: ${projectId}`)

    return NextResponse.json({ success: true, message: 'Project deleted successfully' })
  } catch (error: any) {
    console.error('DELETE Error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to delete project' }, { status: 500 })
  }
}
