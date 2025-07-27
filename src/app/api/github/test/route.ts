import { NextRequest, NextResponse } from 'next/server';
import { GitHubService } from '@/lib/github-api';

export async function POST(request: NextRequest) {
  try {
    const { token, repoUrl } = await request.json();
    
    if (!token || !repoUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: token, repoUrl' },
        { status: 400 }
      );
    }
    
    const githubService = GitHubService.fromRepoUrl(token, repoUrl);
    
    if (!githubService) {
      return NextResponse.json(
        { error: 'Invalid repository URL format. Expected: https://github.com/owner/repo' },
        { status: 400 }
      );
    }
    const isConnected = await githubService.testConnection();
    
    if (isConnected) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Failed to connect to GitHub repository' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('GitHub test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}