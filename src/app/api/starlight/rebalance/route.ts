// src/app/api/starlight/rebalance/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { StarlightOrderManager } from '@/lib/starlight-order-manager'
import { existsSync } from 'fs'

export async function POST(request: NextRequest) {
  try {
    const { directory = '', projectId } = await request.json()
    function getDefaultDocsPath(): string {
      const repoRoot = join(process.cwd(), 'repo', 'src', 'content', 'docs')
      if (existsSync(repoRoot)) return repoRoot
      return join(process.cwd(), 'docs')
    }
    const docsRoot = projectId
      ? join(process.cwd(), 'projects', projectId, 'src', 'content', 'docs')
      : getDefaultDocsPath()

    const targetDir = directory ? join(docsRoot, directory) : docsRoot

    if (!existsSync(targetDir)) {
      return NextResponse.json({ success: false, error: 'Directory not found', targetDir }, { status: 404 })
    }

    const count = await StarlightOrderManager.rebalanceDirectory(targetDir, docsRoot)
    return NextResponse.json({ success: true, updated: count, targetDir })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Rebalance failed' }, { status: 500 })
  }
}
