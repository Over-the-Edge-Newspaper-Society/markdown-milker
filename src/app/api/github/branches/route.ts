import { NextRequest, NextResponse } from 'next/server';
import { GitHubService } from '@/lib/github-api';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { token, repoUrl } = await request.json();

    if (!repoUrl) {
      return NextResponse.json(
        { error: 'Missing required field: repoUrl' },
        { status: 400 }
      );
    }

    // If token is provided, use GitHub API
    if (token) {
      const githubService = GitHubService.fromRepoUrl(token, repoUrl);

      if (!githubService) {
        return NextResponse.json(
          { error: 'Invalid repository URL format' },
          { status: 400 }
        );
      }

      const branches = await githubService.getBranches();
      return NextResponse.json({ branches });
    }

    // Otherwise, use git ls-remote for public repos
    try {
      const { stdout } = await execAsync(`git ls-remote --heads "${repoUrl}"`);
      const branches = stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const match = line.match(/refs\/heads\/(.+)$/);
          return match ? match[1] : null;
        })
        .filter(Boolean);

      return NextResponse.json({ branches });
    } catch (gitError) {
      console.error('Git ls-remote error:', gitError);
      return NextResponse.json(
        { error: 'Failed to fetch branches. Repository may be private or URL is invalid.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('GitHub branches error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branches' },
      { status: 500 }
    );
  }
}