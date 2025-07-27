import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { token, repoUrl, branch = 'main', contentPath = '' } = await request.json();
    
    if (!token || !repoUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: token, repoUrl' },
        { status: 400 }
      );
    }
    
    console.log('🔄 Starting git pull process...');
    console.log('📦 Repository:', repoUrl);
    console.log('🌿 Branch:', branch);
    console.log('📁 Content Path:', contentPath);
    
    const repoDir = path.join(process.cwd(), 'repo');
    
    // Check if repo directory exists
    if (!existsSync(repoDir)) {
      console.log('📥 Repository not found locally, cloning...');
      
      // Clone the repository
      const authUrl = repoUrl.replace('https://', `https://${token}@`);
      
      try {
        await execAsync(`git clone -b ${branch} "${authUrl}" "${repoDir}"`);
        console.log('✅ Repository cloned successfully');
      } catch (cloneError) {
        console.error('❌ Failed to clone repository:', cloneError);
        return NextResponse.json(
          { error: 'Failed to clone repository. Make sure the repository exists and branch is correct.' },
          { status: 500 }
        );
      }
    } else {
      console.log('📁 Repository exists, pulling latest changes...');
      
      try {
        // Ensure we're on the correct branch
        await execAsync(`git checkout ${branch}`, { cwd: repoDir });
        
        // Pull latest changes
        await execAsync('git pull', { cwd: repoDir });
        console.log('✅ Repository updated successfully');
      } catch (pullError) {
        console.error('❌ Failed to pull changes:', pullError);
        return NextResponse.json(
          { error: 'Failed to pull changes. Check if the branch exists or if there are conflicts.' },
          { status: 500 }
        );
      }
    }
    
    // Get information about the content
    const contentDir = contentPath ? path.join(repoDir, contentPath) : repoDir;
    const contentExists = existsSync(contentDir);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Repository synchronized successfully',
      repoPath: repoDir,
      contentPath: contentPath,
      contentExists: contentExists,
      branch: branch
    });
    
  } catch (error) {
    console.error('❌ GitHub pull error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to pull from GitHub' },
      { status: 500 }
    );
  }
}