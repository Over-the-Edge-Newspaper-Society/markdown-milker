'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, RefreshCw, Monitor, Smartphone, X, ChevronLeft } from 'lucide-react';

// Import shared docs config
const DOCS_CONFIG = {
  site: 'https://over-the-edge-newspaper-society.github.io',
  base: '/over-the-edge-docs/',
  devPort: 4321
};

const normalizeBasePath = (base: string) => {
  if (!base) return '/';
  let normalized = base.startsWith('/') ? base : `/${base}`;
  if (!normalized.endsWith('/')) {
    normalized = `${normalized}/`;
  }
  return normalized;
};

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
  const docsBasePath = normalizeBasePath(DOCS_CONFIG.base);
  const isLocalHost = () => {
    if (typeof window === 'undefined') return process.env.NODE_ENV === 'development';
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  };

  const getDocsUrlForFile = (filePath: string | undefined): string => {
    const isDevelopment = isLocalHost();
    const devOrigin = `http://localhost:${DOCS_CONFIG.devPort}`;
    const remoteOrigin = DOCS_CONFIG.site.replace(/\/$/, '');
    const basePath = docsBasePath.replace(/\/$/, '');
    const baseUrl = isDevelopment
      ? `${devOrigin}${basePath}`
      : `${remoteOrigin}${basePath}`;

    if (!filePath) {
      const resolvedBase = baseUrl || `${devOrigin}${docsBasePath}`;
      return resolvedBase.endsWith('/') ? resolvedBase : `${resolvedBase}/`;
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

    let cancelled = false;
    const isDevelopment = isLocalHost();

    const waitForDocs = async () => {
      setIsLoading(true);
      if (!isDevelopment) {
        if (!cancelled) {
          setDocsUrl(url);
        }
        return;
      }

      setDocsUrl('about:blank');

      if (url === 'about:blank') {
        setIsLoading(false);
        return;
      }

      const generated = new URL(url);
      const basePath = docsBasePath;
      const remoteBase = `${DOCS_CONFIG.site.replace(/\/$/, '')}${docsBasePath}`;
      const routeSuffix = generated.pathname.startsWith(basePath)
        ? generated.pathname.slice(basePath.length)
        : generated.pathname;
      const remoteUrl = `${remoteBase}${routeSuffix}`;

      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      let attempts = 0;
      const maxAttempts = 40;

      while (!cancelled && attempts < maxAttempts) {
        try {
          const response = await fetch(`${url}?t=${Date.now()}`, {
            method: 'GET',
            cache: 'no-store',
            headers: {
              'x-docs-preview-ping': '1'
            }
          });
          if (response.ok) {
            break;
          }
        } catch (error) {
          // Ignore errors while waiting for the dev server to restart
        }
        attempts += 1;
        await sleep(500);
      }

      if (!cancelled) {
        if (attempts >= maxAttempts) {
          setDocsUrl(remoteUrl);
        } else {
          setDocsUrl(url);
        }
      }
    };

    waitForDocs();

    return () => {
      cancelled = true;
    };
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
    const iframe = document.getElementById('docs-preview-iframe') as HTMLIFrameElement | null;
    if (iframe && iframe.src === 'about:blank') {
      return;
    }
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
