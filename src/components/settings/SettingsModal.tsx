'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsManager } from '@/lib/settings';
import { Eye, EyeOff, Github, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsModal = ({ open, onOpenChange }: SettingsModalProps) => {
  const [settings, setSettings] = useState(SettingsManager.getDefaultSettings());
  const [showToken, setShowToken] = useState(false);
  
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
                GitHub Personal Access Token
              </h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                Required for pushing changes to GitHub repositories. Repository settings are managed per-project.
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
              <Label htmlFor="github-token" className="text-sm">Personal Access Token</Label>
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
              <p className="text-xs text-muted-foreground mt-1">
                This token is used for all projects. Repository-specific settings are configured when adding or editing projects.
              </p>
            </div>
          </div>
          
          {/* Editor Preferences Section */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Editor Preferences</h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Auto-save</Label>
                <div className="flex items-center h-8">
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
            
            <div className="space-y-1">
              <Label className="text-sm">Default Editor Mode</Label>
              <select
                value={settings.editor.defaultMode}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  editor: { ...prev.editor, defaultMode: e.target.value as 'solo' | 'collaborative' }
                }))}
                className="w-full h-8 px-2 border rounded-md text-sm bg-background dark:bg-background"
              >
                <option value="solo">Solo Mode (work independently)</option>
                <option value="collaborative">Collaborative Mode (real-time sharing)</option>
              </select>
            </div>
          </div>

          {/* File Tree Section */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">File Tree</h4>

            <div className="space-y-1">
              <Label className="text-sm">File Name Display</Label>
              <select
                value={settings.fileTree?.fileNameDisplay || 'truncate'}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  fileTree: {
                    ...prev.fileTree,
                    fileNameDisplay: e.target.value as 'truncate' | 'wrap'
                  }
                }))}
                className="w-full h-8 px-2 border rounded-md text-sm bg-background dark:bg-background"
              >
                <option value="truncate">Truncate (with ...)</option>
                <option value="wrap">Wrap to multiple lines</option>
              </select>
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