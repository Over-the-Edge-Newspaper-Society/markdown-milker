// src/app/api/starlight/reorder/route.ts
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
    const { directory = '', orderedItems, projectId } = await request.json()

    if (!Array.isArray(orderedItems)) {
      return NextResponse.json({ success: false, error: 'orderedItems must be an array' }, { status: 400 })
    }

    const docsRoot = getDocsPath(projectId)
    const targetDir = directory ? join(docsRoot, directory) : docsRoot

    if (!existsSync(targetDir)) {
      return NextResponse.json({ success: false, error: 'Directory not found', targetDir }, { status: 404 })
    }

    const normalized = orderedItems
      .map((item: any) => ({
        name: typeof item?.name === 'string' ? item.name : undefined,
        type: item?.type === 'directory' ? 'directory' : 'file'
      }))
      .filter((item: { name?: string; type: 'file' | 'directory' }) => Boolean(item.name)) as { name: string; type: 'file' | 'directory' }[]

    const updated = await StarlightOrderManager.applyManualOrder(targetDir, normalized, docsRoot)

    return NextResponse.json({ success: true, updated, targetDir })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Reorder failed' }, { status: 500 })
  }
}
