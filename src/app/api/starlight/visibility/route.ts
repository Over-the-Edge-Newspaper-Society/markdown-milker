// src/app/api/starlight/visibility/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { existsSync } from 'fs'
import { StarlightOrderManager } from '@/lib/starlight-order-manager'

function getDocsPath(projectId?: string): string {
  if (projectId) {
    const projectDocs = join(process.cwd(), 'projects', projectId, 'src', 'content', 'docs')
    if (existsSync(projectDocs)) {
      return projectDocs
    }
  }

  const repoDocs = join(process.cwd(), 'repo', 'src', 'content', 'docs')
  if (existsSync(repoDocs)) {
    return repoDocs
  }

  return join(process.cwd(), 'docs')
}

export async function POST(request: NextRequest) {
  try {
    const { path, hidden, projectId } = await request.json()

    if (typeof path !== 'string') {
      return NextResponse.json({ success: false, error: 'path is required' }, { status: 400 })
    }

    const docsRoot = getDocsPath(projectId)
    const fullPath = join(docsRoot, path)

    if (!existsSync(fullPath)) {
      return NextResponse.json({ success: false, error: 'File not found', fullPath }, { status: 404 })
    }

    await StarlightOrderManager.updateSidebarHidden(fullPath, Boolean(hidden), docsRoot)

    return NextResponse.json({ success: true, fullPath })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Visibility update failed' }, { status: 500 })
  }
}
