import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { repoUrl, branch = 'main' } = await request.json();

    if (!repoUrl) {
      return NextResponse.json(
        { error: 'Repository URL is required' },
        { status: 400 }
      );
    }

    console.log('📦 Adding repository:', repoUrl);
    console.log('🌿 Branch:', branch);

    // Extract repo name from URL
    const repoMatch = repoUrl.match(/\/([^\/]+?)(\.git)?$/);
    if (!repoMatch) {
      return NextResponse.json(
        { error: 'Invalid repository URL format' },
        { status: 400 }
      );
    }

    const repoName = repoMatch[1].replace('.git', '');
    const projectsRoot = path.join(process.cwd(), 'projects');
    const projectDir = path.join(projectsRoot, repoName);

    // Check if project already exists
    if (existsSync(projectDir)) {
      return NextResponse.json(
        { error: `A project named "${repoName}" already exists` },
        { status: 409 }
      );
    }

    try {
      console.log('📥 Cloning repository...');

      // Clone the repository
      await execAsync(`git clone -b ${branch} "${repoUrl}" "${projectDir}"`);

      console.log('✅ Repository cloned successfully');

      return NextResponse.json({
        success: true,
        message: 'Repository added successfully',
        projectId: repoName,
        projectPath: projectDir
      });

    } catch (cloneError: any) {
      console.error('❌ Failed to clone repository:', cloneError);

      // Clean up partial clone if it exists
      if (existsSync(projectDir)) {
        try {
          await execAsync(`rm -rf "${projectDir}"`);
        } catch {}
      }

      return NextResponse.json(
        { error: 'Failed to clone repository. Check the URL and branch name.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Add repo error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to add repository' },
      { status: 500 }
    );
  }
}
