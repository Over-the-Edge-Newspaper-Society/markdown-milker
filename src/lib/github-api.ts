import { Octokit } from '@octokit/rest';

export class GitHubService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  
  constructor(token: string, owner: string, repo: string) {
    this.octokit = new Octokit({ auth: token });
    this.owner = owner;
    this.repo = repo;
  }
  
  static fromRepoUrl(token: string, repoUrl: string): GitHubService | null {
    const cleanUrl = repoUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '');
    const match = cleanUrl.match(/^github\.com\/([^\/]+)\/([^\/]+)/);
    
    if (match) {
      return new GitHubService(token, match[1], match[2]);
    }
    return null;
  }
  
  async testConnection(): Promise<boolean> {
    try {
      await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo,
      });
      return true;
    } catch {
      return false;
    }
  }
  
  async getBranches(): Promise<string[]> {
    try {
      const response = await this.octokit.rest.repos.listBranches({
        owner: this.owner,
        repo: this.repo,
      });
      return response.data.map(branch => branch.name);
    } catch {
      return ['main']; // fallback to main if we can't fetch branches
    }
  }
  
  async getFileContent(path: string): Promise<string> {
    const response = await this.octokit.rest.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
    });
    
    if ('content' in response.data) {
      return atob(response.data.content.replace(/\n/g, ''));
    }
    throw new Error('File not found');
  }
  
  async getDirectoryContents(path: string = ''): Promise<Array<{name: string, type: 'file' | 'dir', path: string}>> {
    const response = await this.octokit.rest.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
    });
    
    if (Array.isArray(response.data)) {
      return response.data.map(item => ({
        name: item.name,
        type: item.type === 'dir' ? 'dir' : 'file',
        path: item.path
      }));
    }
    return [];
  }
  
  async updateFile(path: string, content: string, message: string): Promise<void> {
    try {
      // Get current file to get SHA
      const currentFile = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
      });
      
      const sha = 'sha' in currentFile.data ? currentFile.data.sha : undefined;
      
      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        content: btoa(content),
        sha,
      });
    } catch (error) {
      // If file doesn't exist, create it
      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        content: btoa(content),
      });
    }
  }
  
  async createFile(path: string, content: string, message: string): Promise<void> {
    await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path,
      message,
      content: btoa(content),
    });
  }
  
  async deleteFile(path: string, message: string): Promise<void> {
    const currentFile = await this.octokit.rest.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
    });
    
    if ('sha' in currentFile.data) {
      await this.octokit.rest.repos.deleteFile({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        sha: currentFile.data.sha,
      });
    }
  }
  
  async createPullRequest(title: string, body: string, headBranch: string, baseBranch: string = 'main'): Promise<void> {
    await this.octokit.rest.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      head: headBranch,
      base: baseBranch,
    });
  }
}