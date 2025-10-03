import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    console.log('🔄 Starting git pull process...');
    console.log('📦 Project:', projectId);

    const projectDir = path.join(process.cwd(), 'projects', projectId);

    // Check if project directory exists
    if (!existsSync(projectDir)) {
      return NextResponse.json(
        { error: 'Project not found locally' },
        { status: 404 }
      );
    }

    console.log('📁 Project exists, pulling latest changes...');

    try {
      // Pull latest changes
      await execAsync('git pull', { cwd: projectDir });
      console.log('✅ Repository updated successfully');
    } catch (pullError) {
      console.error('❌ Failed to pull changes:', pullError);
      return NextResponse.json(
        { error: 'Failed to pull changes. Check if there are conflicts or uncommitted changes.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Repository synchronized successfully',
      projectId: projectId
    });

  } catch (error) {
    console.error('❌ GitHub pull error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to pull from GitHub' },
      { status: 500 }
    );
  }
}