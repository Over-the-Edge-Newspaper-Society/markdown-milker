'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, RefreshCw, Monitor, Smartphone, X, ChevronLeft } from 'lucide-react';

interface DocsPreviewProps {
  className?: string;
  onClose?: () => void;
  isFullScreen?: boolean;
  currentFilePath?: string;
}

export const DocsPreview = ({ className, onClose, isFullScreen = false, currentFilePath }: DocsPreviewProps) => {
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isLoading, setIsLoading] = useState(true);
  const [docsUrl, setDocsUrl] = useState('http://localhost:4321');

  // Function to convert file path to docs URL
  const getDocsUrlForFile = (filePath: string | undefined): string => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const baseUrl = isDevelopment ? 'http://localhost:4321' : '/docs-preview';
    
    if (!filePath) {
      return baseUrl;
    }
    
    // Convert file path to docs route
    // Example: "submission-process/email-drafter.md" -> "/submission-process/email-drafter/"
    let route = filePath
      .replace(/\.md$/, '') // Remove .md extension
      .replace(/\/index$/, '') // Remove /index if present
      .replace(/^src\/content\/docs\//, '') // Remove content path prefix if present
      .replace(/\\/g, '/'); // Normalize path separators
    
    // Special handling for index files
    if (route === 'index' || route === '') {
      return baseUrl;
    }
    
    // Ensure route starts with /
    if (!route.startsWith('/')) {
      route = '/' + route;
    }
    
    // Ensure route ends with /
    if (!route.endsWith('/')) {
      route += '/';
    }
    
    return `${baseUrl}${route}`;
  };

  useEffect(() => {
    const url = getDocsUrlForFile(currentFilePath);
    console.log('📍 DocsPreview URL mapping:', { 
      currentFilePath, 
      generatedUrl: url 
    });
    setDocsUrl(url);
    
    // Check if docs are available
    const checkDocsAvailability = async () => {
      try {
        const baseCheckUrl = url.split('/').slice(0, 3).join('/'); // Get just the base URL for checking
        const response = await fetch(baseCheckUrl, { mode: 'no-cors' });
        // If we get here without error, docs are probably available
      } catch (error) {
        console.log('Docs not available yet, may need to run "npm run dev:unified"');
      }
    };
    
    checkDocsAvailability();
  }, [currentFilePath]); // Re-run when currentFilePath changes

  const handleRefresh = () => {
    setIsLoading(true);
    // Force iframe reload
    const iframe = document.getElementById('docs-preview-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  const openInNewTab = () => {
    window.open(docsUrl, '_blank');
  };

  return (
    <div className={`flex flex-col h-full bg-background ${isFullScreen ? '' : 'border rounded-lg'} ${className}`}>
      {/* Preview Controls */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm">Live Documentation Preview</h3>
          {isLoading && (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Device Toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={previewMode === 'desktop' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPreviewMode('desktop')}
              className="rounded-r-none border-r"
            >
              <Monitor className="h-4 w-4" />
            </Button>
            <Button
              variant={previewMode === 'mobile' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPreviewMode('mobile')}
              className="rounded-l-none"
            >
              <Smartphone className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            title="Refresh Preview"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          {/* Open in New Tab */}
          <Button
            variant="outline"
            size="sm"
            onClick={openInNewTab}
            title="Open in New Tab"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Preview Frame */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span>Loading documentation preview...</span>
            </div>
          </div>
        )}
        
        <div 
          className={`h-full transition-all duration-300 ${
            previewMode === 'mobile' 
              ? 'max-w-md mx-auto border-x' 
              : 'w-full'
          }`}
        >
          <iframe
            id="docs-preview-iframe"
            src={docsUrl}
            className="w-full h-full border-0"
            title="Documentation Preview"
            onLoad={handleLoad}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        </div>
      </div>
      
      {/* Status Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
        <span>
          {previewMode === 'desktop' ? 'Desktop' : 'Mobile'} Preview • Astro Starlight
        </span>
        <span className="font-mono">{docsUrl}</span>
      </div>
    </div>
  );
};