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
      return NextResponse.json({ success: false, error: 'path is required' }, {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      })
    }

    const docsRoot = getDocsPath(projectId)
    const fullPath = join(docsRoot, path)

    console.log('[Visibility API] docsRoot:', docsRoot)
    console.log('[Visibility API] path:', path)
    console.log('[Visibility API] fullPath:', fullPath)
    console.log('[Visibility API] hidden:', hidden)
    console.log('[Visibility API] projectId:', projectId)

    if (!existsSync(fullPath)) {
      return NextResponse.json({ success: false, error: 'File not found', fullPath }, {
        status: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      })
    }

    await StarlightOrderManager.updateSidebarHidden(fullPath, Boolean(hidden), docsRoot, projectId)

    console.log('[Visibility API] Successfully updated sidebar config')

    return NextResponse.json({ success: true, fullPath }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Visibility update failed' }, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
