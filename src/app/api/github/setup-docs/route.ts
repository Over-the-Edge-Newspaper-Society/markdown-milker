import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { token, repoUrl, branch = 'main', contentPath = '' } = await request.json();
    
    if (!token || !repoUrl) {
      return NextResponse.json(
        { error: 'Missing token or repository URL' },
        { status: 400 }
      );
    }
    
    console.log('🚀 Starting docs setup process...');
    console.log('📦 Repository:', repoUrl);
    console.log('🌿 Branch:', branch);
    console.log('📁 Content Path:', contentPath);
    
    // Use the actual repository URL (no modification needed)
    const docsRepoUrl = repoUrl.replace('.git', '');
    const docsDir = path.join(process.cwd(), 'repo');
    
    // Check if docs directory already exists
    if (existsSync(docsDir)) {
      console.log('📁 Docs directory exists, pulling latest changes...');
      try {
        await execAsync(`git checkout ${branch}`, { cwd: docsDir });
        await execAsync('git pull', { cwd: docsDir });
        console.log('✅ Docs updated successfully');
      } catch (pullError) {
        console.warn('⚠️ Failed to pull docs, will re-clone');
        // If pull fails, remove and re-clone
        await execAsync(`rm -rf "${docsDir}"`);
      }
    }
    
    // Clone or re-clone if directory doesn't exist
    if (!existsSync(docsDir)) {
      console.log('📥 Cloning docs repository...');
      
      // Create authenticated clone URL
      const authUrl = docsRepoUrl.replace('https://', `https://${token}@`);
      
      try {
        await execAsync(`git clone -b ${branch} "${authUrl}" "${docsDir}"`);
        console.log('✅ Docs repository cloned successfully');
      } catch (cloneError) {
        console.error('❌ Failed to clone docs repository:', cloneError);
        return NextResponse.json(
          { error: 'Failed to clone docs repository. Make sure the docs repository exists.' },
          { status: 500 }
        );
      }
    }
    
    // Install dependencies if package.json exists
    const packageJsonPath = path.join(docsDir, 'package.json');
    if (existsSync(packageJsonPath)) {
      console.log('📦 Installing docs dependencies...');
      try {
        await execAsync('npm install', { cwd: docsDir });
        console.log('✅ Dependencies installed successfully');
      } catch (installError) {
        console.warn('⚠️ Failed to install dependencies:', installError);
        // Continue anyway, as dependencies might already be installed
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Docs setup completed successfully',
      docsPath: docsDir,
      contentPath: contentPath,
      branch: branch
    });
    
  } catch (error) {
    console.error('❌ Docs setup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}