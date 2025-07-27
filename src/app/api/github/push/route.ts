import { NextRequest, NextResponse } from 'next/server';
import { GitHubService } from '@/lib/github-api';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { token, repoUrl, message, contentPath = 'docs' } = await request.json();
    
    if (!token || !repoUrl || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: token, repoUrl, message' },
        { status: 400 }
      );
    }
    
    const githubService = GitHubService.fromRepoUrl(token, repoUrl);
    
    if (!githubService) {
      return NextResponse.json(
        { error: 'Invalid repository URL format' },
        { status: 400 }
      );
    }
    
    // Read all local markdown files
    const localDocsPath = path.join(process.cwd(), 'docs');
    
    try {
      await fs.access(localDocsPath);
    } catch {
      return NextResponse.json(
        { error: 'No local docs directory found' },
        { status: 400 }
      );
    }
    
    const files = await fs.readdir(localDocsPath, { withFileTypes: true });
    const markdownFiles = files.filter(file => 
      file.isFile() && file.name.endsWith('.md')
    );
    
    const pushedFiles = [];
    
    for (const file of markdownFiles) {
      try {
        const localPath = path.join(localDocsPath, file.name);
        const content = await fs.readFile(localPath, 'utf8');
        
        // Push to GitHub using the specified content path
        const remotePath = contentPath ? `${contentPath}/${file.name}` : file.name;
        await githubService.updateFile(remotePath, content, message);
        pushedFiles.push(file.name);
      } catch (error) {
        console.error(`Error pushing file ${file.name}:`, error);
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      pushedFiles,
      message: `Pushed ${pushedFiles.length} files to GitHub`
    });
  } catch (error) {
    console.error('GitHub push error:', error);
    return NextResponse.json(
      { error: 'Failed to push to GitHub' },
      { status: 500 }
    );
  }
}