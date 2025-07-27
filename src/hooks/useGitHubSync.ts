import { useState, useEffect } from 'react';
import { SettingsManager } from '@/lib/settings';
import { useFileStore } from '@/lib/stores/file-store';

export const useGitHubSync = () => {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'pulling' | 'pushing' | 'error'>('idle');
  const [isConfigured, setIsConfigured] = useState(false);
  const { setFiles } = useFileStore();
  
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
      
      // First, pull the main content
      const response = await fetch('/api/github/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: settings?.github.token,
          repoUrl: settings?.github.repoUrl,
          branch: settings?.github.branch,
          contentPath: settings?.github.contentPath
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Pull successful:', data);
        
        // Also setup/update docs
        try {
          console.log('🚀 Setting up docs...');
          const docsResponse = await fetch('/api/github/setup-docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: settings?.github.token,
              repoUrl: settings?.github.repoUrl,
              branch: settings?.github.branch,
              contentPath: settings?.github.contentPath
            })
          });
          
          if (docsResponse.ok) {
            const docsData = await docsResponse.json();
            console.log('📚 Docs setup successful:', docsData);
            data.docsSetup = docsData;
          } else {
            console.warn('⚠️ Docs setup failed, continuing without docs');
          }
        } catch (docsError) {
          console.warn('⚠️ Docs setup error:', docsError);
          // Continue without docs setup
        }
        
        // Refresh the file tree by fetching the updated list
        const filesResponse = await fetch('/api/files');
        if (filesResponse.ok) {
          const files = await filesResponse.json();
          setFiles(files);
        }
        
        // Show success message
        return data;
      } else {
        const error = await response.text();
        throw new Error(error || 'Failed to pull from GitHub');
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
    
    if (!commitMessage.trim()) {
      throw new Error('Commit message is required');
    }
    
    setSyncStatus('pushing');
    try {
      const settings = SettingsManager.getSettings();
      const response = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: settings?.github.token,
          repoUrl: settings?.github.repoUrl,
          branch: settings?.github.branch,
          message: commitMessage 
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to push to GitHub');
      }
    } catch (error) {
      setSyncStatus('error');
      throw error;
    } finally {
      setSyncStatus('idle');
    }
  };
  
  const testConnection = async (): Promise<boolean> => {
    if (!isConfigured) {
      return false;
    }
    
    try {
      const settings = SettingsManager.getSettings();
      const response = await fetch('/api/github/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: settings?.github.token,
          repoUrl: settings?.github.repoUrl
        })
      });
      
      return response.ok;
    } catch {
      return false;
    }
  };
  
  return { 
    syncStatus, 
    isConfigured, 
    pullFromGitHub, 
    pushToGitHub,
    testConnection,
    refreshConfig: () => setIsConfigured(SettingsManager.isConfigured())
  };
};