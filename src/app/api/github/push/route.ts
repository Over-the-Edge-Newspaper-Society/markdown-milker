import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { projectId, message } = await request.json();

    if (!projectId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, message' },
        { status: 400 }
      );
    }

    console.log('📤 Starting git push process...');
    console.log('📦 Project:', projectId);
    console.log('💬 Message:', message);

    const projectDir = path.join(process.cwd(), 'projects', projectId);

    // Check if project directory exists
    if (!existsSync(projectDir)) {
      return NextResponse.json(
        { error: 'Project not found locally' },
        { status: 404 }
      );
    }

    try {
      // Check for changes
      const statusResult = await execAsync('git status --porcelain', { cwd: projectDir });

      if (!statusResult.stdout.trim()) {
        return NextResponse.json({
          success: true,
          message: 'No changes to commit',
          pushedFiles: []
        });
      }

      console.log('📝 Changes detected:', statusResult.stdout);

      // Add all changes
      await execAsync('git add .', { cwd: projectDir });
      console.log('✅ Added changes to staging');

      // Commit changes
      const escapedMessage = message.replace(/"/g, '\\"');
      await execAsync(`git commit -m "${escapedMessage}"`, { cwd: projectDir });
      console.log('✅ Committed changes');

      // Get current branch
      const branchResult = await execAsync('git branch --show-current', { cwd: projectDir });
      const branch = branchResult.stdout.trim();

      // Push changes
      await execAsync(`git push origin ${branch}`, { cwd: projectDir });
      console.log('✅ Pushed to GitHub');

      // Get list of changed files
      const changedFiles = statusResult.stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.substring(3)) // Remove status indicators
        .filter(file => file.endsWith('.md') || file.endsWith('.mdx'));

      return NextResponse.json({
        success: true,
        message: `Successfully pushed ${changedFiles.length} changes to GitHub`,
        pushedFiles: changedFiles,
        branch: branch
      });

    } catch (error) {
      console.error('❌ Git push error:', error);

      // Check if it's an authentication error
      if (error instanceof Error && error.message.includes('authentication')) {
        return NextResponse.json(
          { error: 'Authentication failed. Please check your GitHub token.' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: `Failed to push to GitHub: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ GitHub push error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to push to GitHub' },
      { status: 500 }
    );
  }
}