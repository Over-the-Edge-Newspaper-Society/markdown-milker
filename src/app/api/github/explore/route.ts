import { NextRequest, NextResponse } from 'next/server';
import { GitHubService } from '@/lib/github-api';

export async function POST(request: NextRequest) {
  try {
    const { token, repoUrl, path = '' } = await request.json();
    
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
    
    try {
      const contents = await githubService.getDirectoryContents(path);
      
      // Get markdown files and directories
      const structure = {
        path,
        directories: contents.filter(item => item.type === 'dir').map(item => item.name),
        markdownFiles: contents.filter(item => 
          item.type === 'file' && item.name.endsWith('.md')
        ).map(item => item.name),
        totalFiles: contents.filter(item => item.type === 'file').length,
        totalMarkdown: contents.filter(item => 
          item.type === 'file' && item.name.endsWith('.md')
        ).length
      };
      
      return NextResponse.json(structure);
    } catch (error) {
      return NextResponse.json({
        error: `Path "${path}" not found in repository`,
        suggestion: 'Try exploring from root by leaving path empty'
      }, { status: 404 });
    }
  } catch (error) {
    console.error('GitHub explore error:', error);
    return NextResponse.json(
      { error: 'Failed to explore repository' },
      { status: 500 }
    );
  }
}