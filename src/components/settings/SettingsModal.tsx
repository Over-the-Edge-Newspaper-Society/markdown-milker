'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsManager } from '@/lib/settings';
import { useGitHubSync } from '@/hooks/useGitHubSync';
import { Eye, EyeOff, Github, ExternalLink, CheckCircle, XCircle, FolderSearch } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsModal = ({ open, onOpenChange }: SettingsModalProps) => {
  const [settings, setSettings] = useState(SettingsManager.getDefaultSettings());
  const [showToken, setShowToken] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [branches, setBranches] = useState<string[]>(['main']);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [repoStructure, setRepoStructure] = useState<any>(null);
  const [isExploring, setIsExploring] = useState(false);
  const { testConnection } = useGitHubSync();
  
  useEffect(() => {
    if (open) {
      const savedSettings = SettingsManager.getSettings();
      if (savedSettings) {
        setSettings(savedSettings);
      }
    }
  }, [open]);
  
  const handleSave = () => {
    SettingsManager.saveSettings(settings);
    onOpenChange(false);
    // Trigger app refresh to apply new settings
    window.location.reload();
  };
  
  const handleTestConnection = async () => {
    if (!settings.github.token || !settings.github.repoUrl) {
      setConnectionStatus('error');
      return;
    }
    
    setIsTestingConnection(true);
    setConnectionStatus('idle');
    
    try {
      // Save settings temporarily to test
      SettingsManager.saveSettings(settings);
      const isConnected = await testConnection();
      setConnectionStatus(isConnected ? 'success' : 'error');
    } catch {
      setConnectionStatus('error');
    } finally {
      setIsTestingConnection(false);
    }
  };
  
  const fetchBranches = async () => {
    if (!settings.github.token || !settings.github.repoUrl) {
      return;
    }
    
    setIsLoadingBranches(true);
    try {
      const response = await fetch('/api/github/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: settings.github.token,
          repoUrl: settings.github.repoUrl
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setBranches(data.branches || ['main']);
      } else {
        setBranches(['main']);
      }
    } catch {
      setBranches(['main']);
    } finally {
      setIsLoadingBranches(false);
    }
  };
  
  // Fetch branches when repo URL or token changes
  useEffect(() => {
    if (settings.github.token && settings.github.repoUrl) {
      fetchBranches();
    }
  }, [settings.github.token, settings.github.repoUrl]);
  
  const exploreRepository = async () => {
    if (!settings.github.token || !settings.github.repoUrl) {
      return;
    }
    
    setIsExploring(true);
    setRepoStructure(null);
    
    try {
      const response = await fetch('/api/github/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: settings.github.token,
          repoUrl: settings.github.repoUrl,
          path: settings.github.contentPath || ''
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setRepoStructure(data);
      } else {
        const error = await response.json();
        setRepoStructure({ error: error.error || 'Failed to explore repository' });
      }
    } catch {
      setRepoStructure({ error: 'Failed to explore repository' });
    } finally {
      setIsExploring(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Application Settings</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {/* GitHub Integration Section */}
          <div className="space-y-3">
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <h4 className="font-medium flex items-center gap-2 text-sm text-blue-900 dark:text-blue-100">
                <Github className="w-4 h-4" />
                GitHub Setup
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                Need a personal access token with repo permissions.
              </p>
              <Button
                variant="link"
                className="px-0 h-auto text-blue-600 dark:text-blue-400 text-xs"
                onClick={() => window.open('https://github.com/settings/tokens/new', '_blank')}
              >
                Create Token <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="github-token" className="text-sm">Token</Label>
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
                  className="h-8"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </Button>
              </div>
            </div>
            
            <div className="space-y-1">
              <Label htmlFor="github-repo-url" className="text-sm">Repository URL</Label>
              <Input
                id="github-repo-url"
                placeholder="https://github.com/username/repo-name"
                value={settings.github.repoUrl}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  github: { ...prev.github, repoUrl: e.target.value }
                }))}
                className="h-8"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="github-branch" className="text-sm">Branch</Label>
                <div className="relative">
                  <select
                    id="github-branch"
                    value={settings.github.branch}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      github: { ...prev.github, branch: e.target.value }
                    }))}
                    className="w-full h-8 px-2 border rounded-md bg-background text-sm dark:bg-background"
                    disabled={isLoadingBranches}
                  >
                    {branches.map(branch => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </select>
                  {isLoadingBranches && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <div className="animate-spin w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>
            
              <div className="space-y-1">
                <Label htmlFor="github-content-path" className="text-sm">Content Path</Label>
                <div className="flex gap-2">
                  <Input
                    id="github-content-path"
                    placeholder="docs"
                    value={settings.github.contentPath}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      github: { ...prev.github, contentPath: e.target.value }
                    }))}
                    className="h-8 flex-1"
                  />
                  <Button
                    onClick={exploreRepository}
                    disabled={isExploring || !settings.github.token || !settings.github.repoUrl}
                    variant="outline"
                    size="sm"
                    className="h-8"
                    title="Explore repository structure"
                  >
                    {isExploring ? (
                      <div className="animate-spin w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full" />
                    ) : (
                      <FolderSearch className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Repository Structure Explorer */}
            {repoStructure && (
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-xs">
                {repoStructure.error ? (
                  <div className="text-red-600 dark:text-red-400">
                    {repoStructure.error}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <strong>Path:</strong> {repoStructure.path || 'root'} 
                      {repoStructure.totalMarkdown > 0 && (
                        <span className="text-green-600 dark:text-green-400 ml-2">
                          ✓ {repoStructure.totalMarkdown} markdown files found
                        </span>
                      )}
                    </div>
                    {repoStructure.directories.length > 0 && (
                      <div>
                        <strong>Folders:</strong> {repoStructure.directories.join(', ')}
                      </div>
                    )}
                    {repoStructure.markdownFiles.length > 0 && (
                      <div>
                        <strong>Markdown files:</strong> {repoStructure.markdownFiles.slice(0, 5).join(', ')}
                        {repoStructure.markdownFiles.length > 5 && ` ... and ${repoStructure.markdownFiles.length - 5} more`}
                      </div>
                    )}
                    {repoStructure.totalMarkdown === 0 && (
                      <div className="text-amber-600 dark:text-amber-400">
                        No markdown files found in this path. Try exploring subdirectories or leave path empty.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <Button
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                variant="outline"
                size="sm"
                className="h-8"
              >
                {isTestingConnection ? 'Testing...' : 'Test Connection'}
              </Button>
              
              {connectionStatus === 'success' && (
                <div className="flex items-center gap-1 text-green-600 text-xs">
                  <CheckCircle className="w-3 h-3" />
                  Connected
                </div>
              )}
              {connectionStatus === 'error' && (
                <div className="flex items-center gap-1 text-red-600 text-xs">
                  <XCircle className="w-3 h-3" />
                  Failed
                </div>
              )}
            </div>
          </div>
          
          {/* Editor Preferences Section */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Editor Preferences</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Auto-save</Label>
                <input
                  type="checkbox"
                  checked={settings.editor.autoSave}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    editor: { ...prev.editor, autoSave: e.target.checked }
                  }))}
                  className="h-4 w-4"
                />
              </div>
              
              <div className="space-y-1">
                <Label className="text-sm">Theme</Label>
                <select
                  value={settings.editor.theme}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    editor: { ...prev.editor, theme: e.target.value as any }
                  }))}
                  className="w-full h-8 px-2 border rounded-md text-sm bg-background dark:bg-background"
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            Cancel
          </Button>
          <Button onClick={handleSave} size="sm">
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};