import { NextRequest, NextResponse } from 'next/server';
import { GitHubService } from '@/lib/github-api';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { token, repoUrl, contentPath = 'docs' } = await request.json();
    
    if (!token || !repoUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: token, repoUrl' },
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
    
    // Get all markdown files from the repository using the specified content path
    let contents = [];
    
    try {
      console.log(`Attempting to fetch contents from path: ${contentPath}`);
      contents = await githubService.getDirectoryContents(contentPath);
      console.log(`Found ${contents.length} items in ${contentPath}`);
    } catch (error) {
      console.log(`Failed to fetch from ${contentPath}, trying root directory`);
      // If content path doesn't exist, try root
      try {
        contents = await githubService.getDirectoryContents('');
        console.log(`Found ${contents.length} items in root directory`);
      } catch (rootError) {
        console.error('Failed to fetch from root:', rootError);
        return NextResponse.json({
          success: false,
          error: `Could not access repository. Check if the path "${contentPath}" exists in your repo.`,
          suggestion: 'Try leaving Content Path empty to search from root, or check your repository structure.'
        }, { status: 404 });
      }
    }
    
    console.log('Directory contents:', contents.map(item => ({ name: item.name, type: item.type, path: item.path })));
    
    // Download and save files locally
    const localDocsPath = path.join(process.cwd(), 'docs');
    
    // Clear and recreate the docs directory for a clean sync
    try {
      // Remove existing docs directory
      await fs.rm(localDocsPath, { recursive: true, force: true });
      console.log('Cleared existing docs directory');
    } catch (error) {
      console.log('No existing docs directory to clear');
    }
    
    // Create fresh docs directory
    await fs.mkdir(localDocsPath, { recursive: true });
    console.log('Created fresh docs directory');
    
    const syncedFiles = [];
    
    // Process files recursively if needed
    const processFiles = async (items: any[], basePath: string = '') => {
      for (const item of items) {
        if (item.type === 'file' && item.name.endsWith('.md')) {
          try {
            const content = await githubService.getFileContent(item.path);
            const localPath = path.join(localDocsPath, basePath, item.name);
            
            // Ensure directory exists
            const dir = path.dirname(localPath);
            await fs.mkdir(dir, { recursive: true });
            
            await fs.writeFile(localPath, content, 'utf8');
            syncedFiles.push(path.join(basePath, item.name));
          } catch (error) {
            console.error(`Error syncing file ${item.name}:`, error);
          }
        } else if (item.type === 'dir') {
          // Handle subdirectories
          try {
            const subContents = await githubService.getDirectoryContents(item.path);
            await processFiles(subContents, path.join(basePath, item.name));
          } catch (error) {
            console.error(`Error processing directory ${item.name}:`, error);
          }
        }
      }
    };
    
    await processFiles(contents);
    
    console.log('Pull complete. Synced files:', syncedFiles);
    console.log('Local docs path:', localDocsPath);
    
    const message = syncedFiles.length === 0 
      ? `No markdown files found in "${contentPath}". Directory cleared.`
      : `Cleared docs folder and synced ${syncedFiles.length} file${syncedFiles.length !== 1 ? 's' : ''} from GitHub`;
    
    return NextResponse.json({ 
      success: true, 
      syncedFiles,
      message,
      contentPath,
      localPath: localDocsPath,
      clearedDirectory: true
    });
  } catch (error) {
    console.error('GitHub pull error:', error);
    return NextResponse.json(
      { error: 'Failed to pull from GitHub' },
      { status: 500 }
    );
  }
}