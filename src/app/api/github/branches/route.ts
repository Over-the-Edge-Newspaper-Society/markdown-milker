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
        { error: 'Invalid repository URL format' },
        { status: 400 }
      );
    }
    
    const branches = await githubService.getBranches();
    
    return NextResponse.json({ branches });
  } catch (error) {
    console.error('GitHub branches error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branches' },
      { status: 500 }
    );
  }
}