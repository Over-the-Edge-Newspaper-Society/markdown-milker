interface GitHubSettings {
  token: string;
  repoUrl: string;
  branch: string;
  contentPath: string; // Path within repo where docs are stored
}

interface AppSettings {
  github: GitHubSettings;
  editor: {
    autoSave: boolean;
    theme: 'light' | 'dark' | 'system';
    defaultMode: 'solo' | 'collaborative';
  };
}

export class SettingsManager {
  private static readonly STORAGE_KEY = 'docs-editor-settings';
  
  static getSettings(): AppSettings | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
  
  static saveSettings(settings: AppSettings): void {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
  }
  
  static clearSettings(): void {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem(this.STORAGE_KEY);
  }
  
  static isConfigured(): boolean {
    const settings = this.getSettings();
    return !!(settings?.github?.token && settings?.github?.repoUrl);
  }
  
  static getDefaultSettings(): AppSettings {
    return {
      github: {
        token: '',
        repoUrl: '',
        branch: 'main',
        contentPath: 'docs' // Default to 'docs' folder
      },
      editor: {
        autoSave: true,
        theme: 'system',
        defaultMode: 'solo'
      }
    };
  }
  
  static parseRepoUrl(repoUrl: string): { owner: string; repo: string } | null {
    try {
      // Handle both https://github.com/owner/repo and github.com/owner/repo
      const cleanUrl = repoUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '');
      const match = cleanUrl.match(/^github\.com\/([^\/]+)\/([^\/]+)/);
      
      if (match) {
        return {
          owner: match[1],
          repo: match[2]
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}