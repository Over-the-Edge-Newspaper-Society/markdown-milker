import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { token, repoUrl, message, branch = 'main' } = await request.json();
    
    if (!token || !repoUrl || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: token, repoUrl, message' },
        { status: 400 }
      );
    }
    
    console.log('📤 Starting git push process...');
    console.log('📦 Repository:', repoUrl);
    console.log('🌿 Branch:', branch);
    console.log('💬 Message:', message);
    
    const repoDir = path.join(process.cwd(), 'repo');
    
    // Check if repo directory exists
    if (!existsSync(repoDir)) {
      return NextResponse.json(
        { error: 'Repository not found. Please pull from GitHub first to clone the repository.' },
        { status: 400 }
      );
    }
    
    try {
      // Check for changes
      const statusResult = await execAsync('git status --porcelain', { cwd: repoDir });
      
      if (!statusResult.stdout.trim()) {
        return NextResponse.json({
          success: true,
          message: 'No changes to commit',
          pushedFiles: []
        });
      }
      
      console.log('📝 Changes detected:', statusResult.stdout);
      
      // Add all changes
      await execAsync('git add .', { cwd: repoDir });
      console.log('✅ Added changes to staging');
      
      // Commit changes
      await execAsync(`git commit -m "${message}"`, { cwd: repoDir });
      console.log('✅ Committed changes');
      
      // Push changes
      await execAsync(`git push origin ${branch}`, { cwd: repoDir });
      console.log('✅ Pushed to GitHub');
      
      // Get list of changed files
      const changedFiles = statusResult.stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.substring(3)) // Remove status indicators
        .filter(file => file.endsWith('.md'));
      
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