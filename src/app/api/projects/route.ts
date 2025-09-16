// src/app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'

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

