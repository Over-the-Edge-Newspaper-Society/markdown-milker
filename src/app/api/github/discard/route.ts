import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    console.log('🗑️  Starting discard changes process...');

    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const repoDir = path.join(process.cwd(), 'projects', projectId);

    // Check if project directory exists
    if (!existsSync(repoDir)) {
      return NextResponse.json(
        { error: 'Project not found locally' },
        { status: 404 }
      );
    }

    console.log(`📁 Project "${projectId}" found, discarding all local changes...`);

    try {
      // Backup the injected dev config file if it exists
      const devConfigPath = path.join(repoDir, '__mm_dev_astro.config.mjs');
      let devConfigBackup: string | null = null;
      if (existsSync(devConfigPath)) {
        devConfigBackup = readFileSync(devConfigPath, 'utf-8');
        console.log('💾 Backed up dev config file');
      }

      // Reset all tracked files to HEAD
      await execAsync('git reset --hard HEAD', { cwd: repoDir });
      console.log('✅ Tracked files reset successfully');

      // Remove all untracked files and directories
      await execAsync('git clean -fd', { cwd: repoDir });
      console.log('✅ Untracked files removed successfully');

      // Restore the dev config file if it was backed up
      if (devConfigBackup) {
        writeFileSync(devConfigPath, devConfigBackup, 'utf-8');
        console.log('♻️  Restored dev config file');
      }

      console.log('✅ All local changes discarded successfully');

      return NextResponse.json({
        success: true,
        message: 'All local changes have been discarded',
      });

    } catch (discardError) {
      console.error('❌ Failed to discard changes:', discardError);
      return NextResponse.json(
        { error: 'Failed to discard changes. There might be an issue with the git repository.' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Discard changes error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to discard changes' },
      { status: 500 }
    );
  }
}
