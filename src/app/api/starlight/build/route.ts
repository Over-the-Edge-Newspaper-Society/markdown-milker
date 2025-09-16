// src/app/api/starlight/build/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { spawn } from 'child_process'
import { existsSync } from 'fs'

export async function POST(request: NextRequest) {
  try {
    const { projectId, incremental = true } = await request.json()
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const projectPath = join(process.cwd(), 'projects', String(projectId).replace(/[^A-Za-z0-9._\-]/g, ''))
    if (!existsSync(projectPath)) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const command = incremental ? 'npm' : 'npm'
    const args = incremental ? ['run', 'dev'] : ['run', 'build']

    // Fire-and-forget build (detached if possible)
    const child = spawn(command, args, {
      cwd: projectPath,
      stdio: 'ignore',
      detached: true,
      shell: true,
    })
    child.unref?.()

    return NextResponse.json({
      success: true,
      previewUrl: 'http://localhost:4321',
      buildId: Date.now(),
      mode: incremental ? 'dev' : 'build'
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to trigger build' }, { status: 500 })
  }
}

