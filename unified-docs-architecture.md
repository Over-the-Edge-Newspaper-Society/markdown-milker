# Unified Documentation Platform Architecture

## System Overview

Combine your Next.js Markdown Editor with the Astro Starlight documentation site to create a unified platform for editing, previewing, and publishing documentation with seamless GitHub integration.

## Architecture Components

### 1. Integrated Application Structure
```
unified-docs-platform/
├── docker-compose.yml           # Container orchestration
├── Dockerfile.editor           # Next.js editor container
├── Dockerfile.docs            # Astro docs container
├── Dockerfile.gateway         # Nginx reverse proxy
├── .github/
│   └── workflows/
│       ├── deploy-docs.yml     # Auto-deploy docs
│       └── sync-content.yml    # Content synchronization
├── packages/
│   ├── editor/                 # Next.js Markdown Editor
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── github-sync/
│   │   │   │   │   ├── GitHubPullButton.tsx
│   │   │   │   │   ├── GitHubPushButton.tsx
│   │   │   │   │   └── GitHubStatusIndicator.tsx
│   │   │   │   ├── preview/
│   │   │   │   │   └── DocsPreview.tsx
│   │   │   │   └── file-tree/
│   │   │   ├── lib/
│   │   │   │   ├── github-api.ts
│   │   │   │   └── docs-builder.ts
│   │   │   └── hooks/
│   │   │       └── useGitHubSync.ts
│   │   └── package.json
│   ├── docs/                   # Astro Starlight Documentation
│   │   ├── src/
│   │   │   ├── content/docs/   # Markdown content
│   │   │   └── components/
│   │   ├── astro.config.mjs
│   │   └── package.json
│   └── shared/                 # Shared utilities
│       ├── types/
│       └── utils/
└── services/
    ├── gateway/                # Nginx reverse proxy
    ├── webhooks/              # GitHub webhook handler
    └── builder/               # Documentation build service
```

### 2. Core Integration Features

#### A. Real-time Documentation Editing
- **Milkdown Editor** with enhanced file tree showing docs structure
- **Live Preview** of Astro documentation rendering
- **Collaborative Editing** with Y.js for team collaboration
- **Syntax Highlighting** for MDX and Astro components

#### B. GitHub Synchronization System
- **Pull from GitHub**: Button to fetch latest content from repository
- **Push to GitHub**: Button to commit and push changes with commit messages
- **Auto-sync**: Optional real-time synchronization
- **Conflict Resolution**: Handle merge conflicts with visual diff viewer
- **Branch Management**: Work on feature branches for content changes

#### C. Preview Integration
- **Embedded Astro Preview**: Live preview of how docs will look
- **Hot Reload**: Instant updates when editing content
- **Component Preview**: See Starlight components rendered in real-time
- **Mobile/Desktop Toggle**: Preview responsive design

## Implementation Strategy

### Phase 1: Container Setup
```dockerfile
# docker-compose.yml
version: '3.8'

services:
  editor:
    build:
      context: ./packages/editor
      dockerfile: ../../Dockerfile.editor
    ports:
      - "3000:3000"
    environment:
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - GITHUB_REPO=${GITHUB_REPO}
      - DOCS_SERVICE_URL=http://docs:4321
    volumes:
      - ./shared-content:/app/content
      - /app/node_modules
    
  docs:
    build:
      context: ./packages/docs
      dockerfile: ../../Dockerfile.docs
    ports:
      - "4321:4321"
    volumes:
      - ./shared-content:/app/src/content
      - /app/node_modules
    
  gateway:
    build: ./services/gateway
    ports:
      - "80:80"
    depends_on:
      - editor
      - docs
    
  webhooks:
    build: ./services/webhooks
    ports:
      - "3001:3001"
    environment:
      - GITHUB_WEBHOOK_SECRET=${GITHUB_WEBHOOK_SECRET}
    
  yjs-server:
    build: ./services/collaboration
    ports:
      - "1234:1234"
```

### Phase 2: Local Settings & GitHub Integration

#### Settings Management
```typescript
// packages/editor/src/lib/settings.ts
interface GitHubSettings {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

interface AppSettings {
  github: GitHubSettings;
  editor: {
    autoSave: boolean;
    theme: 'light' | 'dark' | 'system';
  };
}

export class SettingsManager {
  private static readonly STORAGE_KEY = 'docs-editor-settings';
  
  static getSettings(): AppSettings | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
  
  static saveSettings(settings: AppSettings): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
  }
  
  static clearSettings(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
  
  static isConfigured(): boolean {
    const settings = this.getSettings();
    return !!(settings?.github?.token && settings?.github?.owner && settings?.github?.repo);
  }
}
```

#### Settings Modal Component
```typescript
// packages/editor/src/components/settings/SettingsModal.tsx
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SettingsManager } from '@/lib/settings';
import { Eye, EyeOff, Github, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsModal = ({ open, onOpenChange }: SettingsModalProps) => {
  const [settings, setSettings] = useState(SettingsManager.getSettings() || {
    github: { token: '', owner: '', repo: '', branch: 'main' },
    editor: { autoSave: true, theme: 'system' }
  });
  const [showToken, setShowToken] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  const handleSave = () => {
    SettingsManager.saveSettings(settings);
    onOpenChange(false);
    // Trigger app refresh to apply new settings
    window.location.reload();
  };
  
  const testGitHubConnection = async () => {
    if (!settings.github.token || !settings.github.owner || !settings.github.repo) {
      setConnectionStatus('error');
      return;
    }
    
    setIsTestingConnection(true);
    try {
      const response = await fetch('/api/github/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings.github)
      });
      
      setConnectionStatus(response.ok ? 'success' : 'error');
    } catch {
      setConnectionStatus('error');
    } finally {
      setIsTestingConnection(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Application Settings</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="github" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="github">GitHub Integration</TabsTrigger>
            <TabsTrigger value="editor">Editor Preferences</TabsTrigger>
          </TabsList>
          
          <TabsContent value="github" className="space-y-4">
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Github className="w-4 h-4" />
                  GitHub Setup Required
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  To sync with GitHub, you'll need a personal access token with repository permissions.
                </p>
                <Button
                  variant="link"
                  className="px-0 h-auto text-blue-600"
                  onClick={() => window.open('https://github.com/settings/tokens/new', '_blank')}
                >
                  Create GitHub Token <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="github-token">Personal Access Token</Label>
                <div className="relative">
                  <Input
                    id="github-token"
                    type={showToken ? 'text' : 'password'}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={settings.github.token}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      github: { ...prev.github, token: e.target.value }
                    }))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="github-owner">Repository Owner</Label>
                  <Input
                    id="github-owner"
                    placeholder="username or organization"
                    value={settings.github.owner}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      github: { ...prev.github, owner: e.target.value }
                    }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="github-repo">Repository Name</Label>
                  <Input
                    id="github-repo"
                    placeholder="my-docs-repo"
                    value={settings.github.repo}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      github: { ...prev.github, repo: e.target.value }
                    }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="github-branch">Default Branch</Label>
                <Input
                  id="github-branch"
                  placeholder="main"
                  value={settings.github.branch}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    github: { ...prev.github, branch: e.target.value }
                  }))}
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  onClick={testGitHubConnection}
                  disabled={isTestingConnection}
                  variant="outline"
                  size="sm"
                >
                  {isTestingConnection ? 'Testing...' : 'Test Connection'}
                </Button>
                
                {connectionStatus === 'success' && (
                  <span className="text-green-600 text-sm">✓ Connection successful</span>
                )}
                {connectionStatus === 'error' && (
                  <span className="text-red-600 text-sm">✗ Connection failed</span>
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="editor" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-save</Label>
                  <p className="text-sm text-gray-600">Automatically save changes as you type</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.editor.autoSave}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    editor: { ...prev.editor, autoSave: e.target.checked }
                  }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Theme</Label>
                <select
                  value={settings.editor.theme}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    editor: { ...prev.editor, theme: e.target.value as any }
                  }))}
                  className="w-full p-2 border rounded"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

#### GitHub Sync Hook (Updated)
```typescript
// packages/editor/src/hooks/useGitHubSync.ts
import { useState, useEffect } from 'react';
import { SettingsManager } from '@/lib/settings';

export const useGitHubSync = () => {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'pulling' | 'pushing' | 'error'>('idle');
  const [isConfigured, setIsConfigured] = useState(false);
  
  useEffect(() => {
    setIsConfigured(SettingsManager.isConfigured());
  }, []);
  
  const pullFromGitHub = async () => {
    if (!isConfigured) {
      throw new Error('GitHub not configured');
    }
    
    setSyncStatus('pulling');
    try {
      const settings = SettingsManager.getSettings();
      const response = await fetch('/api/github/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings?.github)
      });
      
      if (response.ok) {
        // Refresh file tree and content
        window.location.reload();
      } else {
        throw new Error('Failed to pull from GitHub');
      }
    } catch (error) {
      setSyncStatus('error');
      throw error;
    } finally {
      setSyncStatus('idle');
    }
  };
  
  const pushToGitHub = async (commitMessage: string) => {
    if (!isConfigured) {
      throw new Error('GitHub not configured');
    }
    
    setSyncStatus('pushing');
    try {
      const settings = SettingsManager.getSettings();
      const response = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...settings?.github,
          message: commitMessage 
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to push to GitHub');
      }
    } catch (error) {
      setSyncStatus('error');
      throw error;
    } finally {
      setSyncStatus('idle');
    }
  };
  
  return { 
    syncStatus, 
    isConfigured, 
    pullFromGitHub, 
    pushToGitHub,
    refreshConfig: () => setIsConfigured(SettingsManager.isConfigured())
  };
};
```

#### GitHub API Integration
```typescript
// packages/editor/src/lib/github-api.ts
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
  
  async getFileContent(path: string): Promise<string> {
    const response = await this.octokit.rest.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
    });
    
    if ('content' in response.data) {
      return atob(response.data.content);
    }
    throw new Error('File not found');
  }
  
  async updateFile(path: string, content: string, message: string): Promise<void> {
    // Get current file to get SHA
    const currentFile = await this.octokit.rest.repos.getContent({
      owner: this.owner,
      repo: this.repo,
      path,
    });
    
    await this.octokit.rest.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path,
      message,
      content: btoa(content),
      sha: 'sha' in currentFile.data ? currentFile.data.sha : undefined,
    });
  }
  
  async createPullRequest(title: string, body: string, headBranch: string): Promise<void> {
    await this.octokit.rest.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      head: headBranch,
      base: 'main',
    });
  }
}
```

#### Updated GitHub Sync Buttons
```typescript
// packages/editor/src/components/github-sync/GitHubSyncButtons.tsx
import { useState } from 'react';
import { useGitHubSync } from '@/hooks/useGitHubSync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GitPull, GitCommit, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const GitHubSyncButtons = () => {
  const { syncStatus, isConfigured, pullFromGitHub, pushToGitHub } = useGitHubSync();
  const [commitMessage, setCommitMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const handlePull = async () => {
    try {
      setError(null);
      await pullFromGitHub();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pull from GitHub');
    }
  };
  
  const handlePush = async () => {
    try {
      setError(null);
      await pushToGitHub(commitMessage);
      setCommitMessage(''); // Clear message on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push to GitHub');
    }
  };
  
  if (!isConfigured) {
    return null; // Settings alert will show instead
  }
  
  return (
    <div className="flex items-center gap-2">
      {error && (
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Button
        onClick={handlePull}
        disabled={syncStatus !== 'idle'}
        variant="outline"
        size="sm"
      >
        {syncStatus === 'pulling' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <GitPull className="w-4 h-4" />
        )}
        Pull
      </Button>
      
      <div className="flex items-center gap-2">
        <Input
          type="text"
          placeholder="Commit message..."
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          className="w-48 h-8"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && commitMessage.trim()) {
              handlePush();
            }
          }}
        />
        <Button
          onClick={handlePush}
          disabled={syncStatus !== 'idle' || !commitMessage.trim()}
          size="sm"
        >
          {syncStatus === 'pushing' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <GitCommit className="w-4 h-4" />
          )}
          Push
        </Button>
      </div>
    </div>
  );
};
```

## Quick Start Guide

### 1. Clone and Setup
```bash
# Clone the repository
git clone <your-repo-url>
cd unified-docs-platform

# Copy environment template
cp .env.example .env.local

# Install dependencies for all packages
npm install

# Or if using specific package managers
cd packages/editor && npm install
cd ../docs && npm install
cd ../..
```

### 2. Local Development (Without Docker)
```bash
# Terminal 1: Start the Y.js collaboration server
npm run dev:yjs

# Terminal 2: Start the Next.js editor
cd packages/editor
npm run dev

# Terminal 3: Start the Astro docs site
cd packages/docs
npm run dev

# Access the application
# Editor: http://localhost:3000
# Docs: http://localhost:4321
```

### 3. Docker Development
```bash
# Build and start all services
docker-compose up --build

# Access the application
# Gateway (routes to both): http://localhost
# Direct editor access: http://localhost:3000
# Direct docs access: http://localhost:4321
```

### 4. First-Time Setup
1. **Open the editor** at `http://localhost:3000`
2. **Setup Wizard** will appear automatically
3. **Create GitHub Token**:
   - Go to https://github.com/settings/tokens/new
   - Create token with `repo` scope
   - Copy the token
4. **Configure Settings**:
   - Enter your GitHub token
   - Set repository owner/name
   - Test the connection
5. **Start Editing**:
   - Pull content from GitHub
   - Edit documentation files
   - Preview changes live
   - Push changes back to GitHub

### 5. Key Features

#### Collaborative Editing
- Multiple users can edit simultaneously
- Real-time synchronization via Y.js
- Conflict resolution built-in

#### GitHub Integration
- Pull latest content from repository
- Push changes with commit messages
- Branch management support
- Automatic conflict detection

#### Live Preview
- See Astro Starlight output in real-time
- Component rendering preview
- Mobile/desktop responsive testing

#### File Management
- File tree showing documentation structure
- Create/delete/rename files
- Drag and drop organization
- Search across all files

## Production Deployment

### Environment Variables
```bash
# Production .env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_DOCS_URL=https://docs.your-domain.com

# GitHub Webhook (optional)
GITHUB_WEBHOOK_SECRET=your-webhook-secret

# SSL Configuration
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
```

### Docker Production
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  editor:
    image: your-registry/docs-editor:latest
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    
  docs:
    image: your-registry/docs-site:latest
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    
  gateway:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./ssl:/etc/ssl
      - ./nginx.prod.conf:/etc/nginx/nginx.conf
    restart: unless-stopped
```

This architecture provides a complete solution that:
- ✅ Combines your existing Milkdown editor with Astro Starlight docs
- ✅ Includes local GitHub token configuration via UI
- ✅ Provides Docker containerization for easy deployment
- ✅ Supports real-time collaboration
- ✅ Enables seamless GitHub synchronization
- ✅ Offers live documentation preview
```

#### Main App Layout with Settings
```typescript
// packages/editor/src/components/layout/AppLayout.tsx
import { useState, useEffect } from 'react';
import { Settings, Github, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { SetupWizard } from '@/components/setup/SetupWizard';
import { GitHubSyncButtons } from '@/components/github-sync/GitHubSyncButtons';
import { SettingsManager } from '@/lib/settings';

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  
  useEffect(() => {
    const configured = SettingsManager.isConfigured();
    setIsConfigured(configured);
    
    // Show setup wizard on first run
    if (!configured) {
      setShowSetup(true);
    }
  }, []);
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <h1 className="text-lg font-semibold">Documentation Editor</h1>
          </div>
          
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            {/* GitHub sync status */}
            {!isConfigured && (
              <Alert className="mr-4 max-w-md">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  GitHub integration not configured. 
                  <Button 
                    variant="link" 
                    className="h-auto p-0 ml-1"
                    onClick={() => setShowSettings(true)}
                  >
                    Configure now
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            
            {isConfigured && <GitHubSyncButtons />}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>
      
      {/* Modals */}
      <SettingsModal 
        open={showSettings} 
        onOpenChange={(open) => {
          setShowSettings(open);
          if (!open) {
            setIsConfigured(SettingsManager.isConfigured());
          }
        }} 
      />
      
      <SetupWizard 
        open={showSetup} 
        onComplete={() => {
          setShowSetup(false);
          setIsConfigured(true);
        }}
      />
    </div>
  );
};
```

#### Setup Wizard for First Run
```typescript
// packages/editor/src/components/setup/SetupWizard.tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Github, FileText, Settings, CheckCircle } from 'lucide-react';
import { SettingsModal } from '@/components/settings/SettingsModal';

interface SetupWizardProps {
  open: boolean;
  onComplete: () => void;
}

export const SetupWizard = ({ open, onComplete }: SetupWizardProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  
  const steps = [
    {
      title: 'Welcome to Documentation Editor',
      description: 'A unified platform for editing and publishing documentation with GitHub integration.',
      icon: FileText,
      content: (
        <div className="space-y-4">
          <p>This application combines the power of:</p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Milkdown Editor</strong> - Rich markdown editing experience</li>
            <li><strong>Astro Starlight</strong> - Beautiful documentation site generation</li>
            <li><strong>GitHub Integration</strong> - Seamless version control and collaboration</li>
            <li><strong>Live Preview</strong> - See your changes in real-time</li>
          </ul>
        </div>
      )
    },
    {
      title: 'GitHub Integration',
      description: 'Connect your GitHub repository to enable content synchronization.',
      icon: Github,
      content: (
        <div className="space-y-4">
          <p>To get started, you'll need to configure GitHub integration:</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>Create a Personal Access Token on GitHub</li>
            <li>Provide your repository details</li>
            <li>Test the connection</li>
          </ol>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm">
              <strong>Note:</strong> Your GitHub token is stored locally in your browser and never sent to external servers.
            </p>
          </div>
        </div>
      )
    },
    {
      title: 'Configure Settings',
      description: 'Set up your GitHub repository and editor preferences.',
      icon: Settings,
      content: (
        <div className="space-y-4">
          <p>Click the button below to open the settings and configure:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>GitHub Personal Access Token</li>
            <li>Repository owner and name</li>
            <li>Default branch</li>
            <li>Editor preferences</li>
          </ul>
          <Button onClick={() => setShowSettings(true)} className="w-full">
            <Settings className="w-4 h-4 mr-2" />
            Open Settings
          </Button>
        </div>
      )
    }
  ];
  
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };
  
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;
  
  return (
    <>
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="max-w-2xl" hideCloseButton>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5" />
              {currentStepData.title}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-6">
            <Card>
              <CardHeader>
                <CardDescription>{currentStepData.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {currentStepData.content}
              </CardContent>
            </Card>
          </div>
          
          {/* Progress indicators */}
          <div className="flex justify-center space-x-2 mb-4">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-3 h-3 rounded-full ${
                  index <= currentStep ? 'bg-primary' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              Previous
            </Button>
            
            <Button onClick={handleNext}>
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <SettingsModal 
        open={showSettings} 
        onOpenChange={setShowSettings}
      />
    </>
  );
};
```

### Phase 3: Updated Docker Configuration

#### Environment Setup
```bash
# .env.example (for local development)
# Copy to .env.local and fill in your values

# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DOCS_URL=http://localhost:4321

# GitHub Integration (Optional - can be set via UI)
# GITHUB_TOKEN=your_github_token_here
# GITHUB_OWNER=your_username_or_org
# GITHUB_REPO=your_repo_name

# Y.js Collaboration Server
YJS_SERVER_URL=ws://localhost:1234

# Webhook Secret (for production)
# GITHUB_WEBHOOK_SECRET=your_webhook_secret
```

#### Updated Docker Compose
```dockerfile
# docker-compose.yml
version: '3.8'

services:
  editor:
    build:
      context: ./packages/editor
      dockerfile: ../../Dockerfile.editor
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_DOCS_URL=http://localhost:4321
      - YJS_SERVER_URL=ws://yjs-server:1234
    volumes:
      - ./shared-content:/app/content
      - /app/node_modules
      - /app/.next
    depends_on:
      - yjs-server
    
  docs:
    build:
      context: ./packages/docs
      dockerfile: ../../Dockerfile.docs
    ports:
      - "4321:4321"
    volumes:
      - ./shared-content:/app/src/content
      - /app/node_modules
      - /app/dist
    
  yjs-server:
    build: ./services/collaboration
    ports:
      - "1234:1234"
    volumes:
      - ./shared-content:/app/documents
    
  gateway:
    build: ./services/gateway
    ports:
      - "80:80"
    depends_on:
      - editor
      - docs
    environment:
      - EDITOR_URL=http://editor:3000
      - DOCS_URL=http://docs:4321

volumes:
  shared-content:
    driver: local
```

### Phase 4: Docker Configuration

#### Editor Dockerfile
```dockerfile
# Dockerfile.editor
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY packages/editor/package*.json ./
RUN npm ci --only=production

# Copy source code
COPY packages/editor/ .
COPY packages/shared/ ../shared/

# Build application
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### Docs Dockerfile
```dockerfile
# Dockerfile.docs
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY packages/docs/package*.json ./
RUN npm ci

# Copy source code
COPY packages/docs/ .

# Install dependencies and build
RUN npm run build

EXPOSE 4321

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
```

#### Gateway Configuration
```nginx
# services/gateway/nginx.conf
upstream editor {
    server editor:3000;
}

upstream docs {
    server docs:4321;
}

server {
    listen 80;
    
    location /editor/ {
        proxy_pass http://editor/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /docs/ {
        proxy_pass http://docs/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    