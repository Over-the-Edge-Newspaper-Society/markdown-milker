'use client';

import { useState, useEffect } from 'react';
import { useGitHubSync } from '@/hooks/useGitHubSync';
import { useProjectStore } from '@/lib/stores/project-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Upload, Loader2, AlertCircle, Trash2 } from 'lucide-react';

export const GitHubSyncButtons = () => {
  const { syncStatus, isConfigured, pullFromGitHub, pushToGitHub } = useGitHubSync();
  const { activeProject } = useProjectStore();
  const [commitMessage, setCommitMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);
  
  const handlePull = async () => {
    try {
      setError(null);
      setSuccess(null);
      const result = await pullFromGitHub();
      
      if (result) {
        if (result.clearedDirectory) {
          setSuccess(result.message || 'Directory cleared and synced');
        } else if (result.docsSetup) {
          setSuccess('Pull completed and docs setup successful! Run "npm run dev:unified" to start docs server.');
        } else {
          setSuccess('Pull completed');
        }
        console.log('Pull result:', result);
      } else {
        setSuccess('Pull completed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pull from GitHub');
    }
  };
  
  const handlePush = async () => {
    try {
      setError(null);
      setSuccess(null);
      await pushToGitHub(commitMessage);
      setCommitMessage(''); // Clear message on success
      setSuccess('Successfully pushed to GitHub');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push to GitHub');
    }
  };

  const handleDiscard = async () => {
    if (!window.confirm('Are you sure you want to discard all local changes? This cannot be undone.')) {
      return;
    }

    try {
      setError(null);
      setSuccess(null);

      // Call the API to discard changes
      const response = await fetch('/api/github/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: activeProject }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to discard changes');
      }

      setSuccess('All local changes have been discarded');
      // Reload the page to reflect the changes
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discard changes');
    }
  };
  
  
  if (!isConfigured) {
    return null; // Settings alert will show instead
  }
  
  return (
    <div className="space-y-2">
      {(error || success) && (
        <div className={`flex items-center gap-2 text-sm ${error ? 'text-red-600' : 'text-green-600'}`}>
          {error && <AlertCircle className="h-4 w-4" />}
          <span>{error || success}</span>
        </div>
      )}
      
      <div className="flex items-center gap-2">
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
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Push
          </Button>
        </div>
        
        <Button
          onClick={handlePull}
          disabled={syncStatus !== 'idle'}
          variant="outline"
          size="sm"
        >
          {syncStatus === 'pulling' ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Pull
        </Button>

        <Button
          onClick={handleDiscard}
          disabled={syncStatus !== 'idle'}
          variant="destructive"
          size="sm"
          title="Discard all local changes to the repo (cannot be undone)"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Discard
        </Button>

      </div>
    </div>
  );
};