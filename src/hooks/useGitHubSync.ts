import { useState, useEffect } from 'react';
import { SettingsManager } from '@/lib/settings';
import { useFileStore } from '@/lib/stores/file-store';
import { useProjectStore } from '@/lib/stores/project-store';

export const useGitHubSync = () => {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'pulling' | 'pushing' | 'error'>('idle');
  const [isConfigured, setIsConfigured] = useState(false);
  const { setFiles } = useFileStore();
  const { activeProject } = useProjectStore();

  useEffect(() => {
    setIsConfigured(SettingsManager.isConfigured());
  }, []);

  const pullFromGitHub = async () => {
    if (!isConfigured) {
      throw new Error('GitHub not configured');
    }

    if (!activeProject) {
      throw new Error('No active project selected');
    }

    setSyncStatus('pulling');
    try {
      // Pull the active project
      const response = await fetch('/api/github/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Pull successful:', data);

        // Refresh the file tree by fetching the updated list
        const filesResponse = await fetch(`/api/files?projectId=${encodeURIComponent(activeProject)}`);
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

    if (!activeProject) {
      throw new Error('No active project selected');
    }

    if (!commitMessage.trim()) {
      throw new Error('Commit message is required');
    }

    setSyncStatus('pushing');
    try {
      const response = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject,
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