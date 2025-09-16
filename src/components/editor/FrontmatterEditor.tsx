'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useFileStore } from '@/lib/stores/file-store';
import { useProjectStore } from '@/lib/stores/project-store';

interface FrontmatterData {
  title?: string;
  description?: string;
  sidebar?: {
    order?: number;
    label?: string;
    hidden?: boolean;
    badge?: {
      text?: string;
      variant?: 'note' | 'tip' | 'caution' | 'danger' | 'success' | 'default';
    };
  };
  [key: string]: any;
}

interface FrontmatterEditorProps {
  content: string;
  onChange: (frontmatter: string, markdownContent: string) => void;
  className?: string;
  inlineMode?: boolean;
}

export const FrontmatterEditor = ({ content, onChange, className, inlineMode = false }: FrontmatterEditorProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [frontmatterData, setFrontmatterData] = useState<FrontmatterData>({});
  const [markdownContent, setMarkdownContent] = useState('');
  const [customFields, setCustomFields] = useState<Array<{key: string, value: string}>>([]);
  const { files, selectedFile, setFiles } = useFileStore()
  const { activeProject } = useProjectStore()

  // Parse frontmatter from content
  useEffect(() => {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (match) {
      const frontmatterYaml = match[1];
      const markdownBody = match[2];
      
      try {
        // Simple YAML parser for common frontmatter fields
        const parsed = parseSimpleYaml(frontmatterYaml);
        console.log('Parsed frontmatter:', parsed);
        setFrontmatterData(parsed);
        setMarkdownContent(markdownBody);
        
        // Extract custom fields (not title, description, sidebar)
        const knownFields = ['title', 'description', 'sidebar'];
        const custom = Object.entries(parsed)
          .filter(([key]) => !knownFields.includes(key))
          .map(([key, value]) => ({ key, value: String(value) }));
        setCustomFields(custom);
        console.log('Custom fields:', custom);
      } catch (error) {
        console.error('Failed to parse frontmatter:', error);
        setMarkdownContent(content);
      }
    } else {
      setMarkdownContent(content);
      setFrontmatterData({});
      setCustomFields([]);
    }
  }, [content]);

  // Simple YAML parser for frontmatter
  const parseSimpleYaml = (yaml: string): FrontmatterData => {
    const lines = yaml.split('\n');
    const result: any = {};
    let isInSidebar = false;
    let isInBadge = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Check for sidebar section
      if (trimmed === 'sidebar:') {
        isInSidebar = true;
        result.sidebar = {};
        continue;
      }
      if (isInSidebar && trimmed === 'badge:') {
        isInBadge = true;
        result.sidebar = result.sidebar || {};
        result.sidebar.badge = {};
        continue;
      }
      
      // Handle sidebar properties (indented with 2+ spaces)
      if (isInSidebar && line.startsWith('  ') && line.includes(':')) {
        const indentedContent = line.substring(2); // Remove 2-space indent
        const colonIndex = indentedContent.indexOf(':');
        if (colonIndex > 0) {
          const key = indentedContent.substring(0, colonIndex).trim();
          const value = indentedContent.substring(colonIndex + 1).trim();
          if (key && value) {
            const cleanValue = value.replace(/^['"]|['"]$/g, '');
            if (isInBadge && key) {
              // badge nested fields
              result.sidebar.badge = result.sidebar.badge || {};
              result.sidebar.badge[key] = cleanValue;
            } else {
              if (key === 'hidden') {
                result.sidebar.hidden = cleanValue === 'true';
              } else {
                result.sidebar[key] = isNaN(Number(cleanValue)) ? cleanValue : Number(cleanValue);
              }
            }
          }
        }
        continue;
      }
      
      // Handle top-level properties (not indented)
      if (!line.startsWith(' ') && line.includes(':')) {
        isInSidebar = false; // Exit sidebar section
        isInBadge = false;
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          if (key && value && key !== 'sidebar') {
            const cleanValue = value.replace(/^['"]|['"]$/g, '');
            result[key] = cleanValue;
          }
        }
      }
    }
    
    return result;
  };

  // Generate YAML from frontmatter data
  const generateYaml = (): string => {
    const lines: string[] = [];
    
    if (frontmatterData.title) {
      lines.push(`title: ${frontmatterData.title}`);
    }
    if (frontmatterData.description) {
      lines.push(`description: ${frontmatterData.description}`);
    }
    if (frontmatterData.sidebar && Object.keys(frontmatterData.sidebar).length > 0) {
      lines.push('sidebar:');
      if (frontmatterData.sidebar.order !== undefined) {
        lines.push(`  order: ${frontmatterData.sidebar.order}`);
      }
      if (frontmatterData.sidebar.label) {
        lines.push(`  label: ${frontmatterData.sidebar.label}`);
      }
      if (frontmatterData.sidebar.hidden !== undefined) {
        lines.push(`  hidden: ${frontmatterData.sidebar.hidden ? 'true' : 'false'}`);
      }
      if (frontmatterData.sidebar.badge && (frontmatterData.sidebar.badge.text || frontmatterData.sidebar.badge.variant)) {
        lines.push('  badge:');
        if (frontmatterData.sidebar.badge.text) {
          lines.push(`    text: ${frontmatterData.sidebar.badge.text}`);
        }
        if (frontmatterData.sidebar.badge.variant) {
          lines.push(`    variant: ${frontmatterData.sidebar.badge.variant}`);
        }
      }
    }
    
    // Add custom fields
    customFields.forEach(({ key, value }) => {
      if (key.trim() && value.trim()) {
        lines.push(`${key.trim()}: ${value.trim()}`);
      }
    });
    
    return lines.join('\n');
  };

  // Update the content when frontmatter changes
  const updateContent = (newData: Partial<FrontmatterData>) => {
    const updatedData = { ...frontmatterData, ...newData };
    setFrontmatterData(updatedData);
    
    const yamlContent = generateYaml();
    const fullContent = yamlContent ? `---\n${yamlContent}\n---\n${markdownContent}` : markdownContent;
    onChange(fullContent, markdownContent);
  };

  // Calculate smart order using sibling context
  const calculateSmartOrder = (currentPath: string) => {
    if (!currentPath) return undefined
    const parts = currentPath.split('/')
    const fileName = parts[parts.length - 1]
    const parentPath = parts.slice(0, -1).join('/')

    // Index pages always 0
    if (fileName === 'index.md' || fileName === 'index.mdx') return 0

    // Get alphabetical position among siblings in same directory
    const siblings = files
      .filter((f) => {
        const fp = f.path.split('/')
        const fParent = fp.slice(0, -1).join('/')
        return fParent === parentPath && f.type === 'file'
      })
      .map((f) => f.name)
      .sort((a, b) => a.localeCompare(b))

    const position = Math.max(0, siblings.indexOf(fileName))

    // Base order uses gaps of 10
    let base = (position === -1 ? siblings.length : position) * 10

    // Avoid conflicts if nearby numbers already used: nudge up until free
    // We can't read existing orders from the tree cheaply here, so keep a simple rule:
    // ensure non-zero and multiple of 10, with minimum 10
    if (base === 0) base = 10
    while (base % 10 !== 0) base += 1
    return base
  }

  const addCustomField = () => {
    setCustomFields([...customFields, { key: '', value: '' }]);
  };

  const removeCustomField = (index: number) => {
    const newFields = customFields.filter((_, i) => i !== index);
    setCustomFields(newFields);
    // Trigger update
    setTimeout(() => updateContent({}), 0);
  };

  const updateCustomField = (index: number, key: string, value: string) => {
    const newFields = [...customFields];
    newFields[index] = { key, value };
    setCustomFields(newFields);
    // Trigger update
    setTimeout(() => updateContent({}), 0);
  };

  // Update the status bar with frontmatter info in inline mode
  useEffect(() => {
    if (inlineMode) {
      const statusElement = document.getElementById('frontmatter-info');
      if (statusElement) {
        const fieldCount = Object.keys(frontmatterData).length;
        const titleText = frontmatterData.title;
        
        statusElement.innerHTML = fieldCount > 0 ? `
          <span class="text-muted-foreground">•</span>
          <button class="hover:bg-muted rounded px-1 py-0.5 transition-colors flex items-center gap-1" onclick="document.dispatchEvent(new CustomEvent('toggleFrontmatter'))">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${isExpanded ? 'M19 9l-7 7-7-7' : 'M9 5l7 7-7 7'}"></path>
            </svg>
            <span>Frontmatter (${fieldCount} fields)</span>
            ${titleText ? `<span class="text-muted-foreground">• ${titleText}</span>` : ''}
          </button>
        ` : '';
      }
    }
  }, [inlineMode, frontmatterData, isExpanded]);
  
  // Listen for toggle events in inline mode
  useEffect(() => {
    if (inlineMode) {
      const handleToggle = () => setIsExpanded(!isExpanded);
      document.addEventListener('toggleFrontmatter', handleToggle);
      return () => document.removeEventListener('toggleFrontmatter', handleToggle);
    }
  }, [inlineMode, isExpanded]);

  if (!isExpanded && !inlineMode) {
    return (
      <div className={`border-b bg-muted/30 ${className}`}>
        <div className="px-4 h-8 flex items-center text-xs">
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1.5 hover:bg-muted rounded px-2 py-1 transition-colors"
          >
            <ChevronRight className="w-3 h-3" />
            <span>
              {Object.keys(frontmatterData).length > 0 
                ? `Frontmatter (${Object.keys(frontmatterData).length} fields)` 
                : 'Add Frontmatter'
              }
            </span>
            {frontmatterData.title && (
              <span className="text-muted-foreground">
                • {frontmatterData.title}
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }
  
  if (!isExpanded && inlineMode) {
    return null; // In inline mode, content is shown in the status bar
  }

  return (
    <div className={`border-b bg-muted/30 ${className} ${inlineMode ? 'border-t' : ''}`}>
      <div className="p-2 space-y-2">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
            className="h-5 px-1 py-0"
          >
            <ChevronDown className="w-3 h-3 mr-1" />
            <span className="text-xs font-medium">Frontmatter</span>
          </Button>
        </div>

        <div className="space-y-2">
          <Input
            id="fm-title"
            placeholder="Title"
            value={frontmatterData.title || ''}
            onChange={(e) => updateContent({ title: e.target.value })}
            className="h-7 text-xs w-full"
          />

          <div className="flex gap-1">
            <Input
              id="fm-order"
              type="number"
              placeholder="Order"
              value={frontmatterData.sidebar?.order || ''}
              onChange={(e) => updateContent({
                sidebar: {
                  ...frontmatterData.sidebar,
                  order: e.target.value ? Number(e.target.value) : undefined
                }
              })}
              className="h-7 text-xs w-20"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              title="Auto-calculate order"
              onClick={() => {
                const order = calculateSmartOrder(selectedFile || '')
                if (order !== undefined) {
                  updateContent({ sidebar: { ...frontmatterData.sidebar, order } })
                }
              }}
            >
              Auto
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              title="Fix all order conflicts"
              onClick={async () => {
                const pathParts = (selectedFile || '').split('/')
                const dir = pathParts.slice(0, -1).join('/')
                try {
                  const res = await fetch('/api/starlight/rebalance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ directory: dir, projectId: activeProject || undefined })
                  })
                  if (res.ok) {
                    const url = activeProject ? `/api/files?projectId=${encodeURIComponent(activeProject)}` : '/api/files'
                    try {
                      const refreshed = await fetch(url)
                      if (refreshed.ok) {
                        const data = await refreshed.json()
                        setFiles(data)
                      }
                    } catch (err) {
                      console.error('Failed to refresh files after rebalance:', err)
                    }
                    ;(globalThis as any).__FM_CACHE__ = new Map()
                    alert('Fixed all order conflicts in the directory')
                  } else {
                    alert('Rebalance failed')
                  }
                } catch {
                  alert('Failed to trigger rebalance')
                }
              }}
            >
              Fix
            </Button>

            <Input
              id="fm-label"
              placeholder="Sidebar label"
              value={frontmatterData.sidebar?.label || ''}
              onChange={(e) => updateContent({
                sidebar: {
                  ...frontmatterData.sidebar,
                  label: e.target.value || undefined
                }
              })}
              className="h-7 text-xs flex-1"
            />
          </div>

          <div className="flex gap-1 items-center">
            <input
              type="checkbox"
              checked={!!frontmatterData.sidebar?.hidden}
              onChange={(e) => updateContent({
                sidebar: {
                  ...frontmatterData.sidebar,
                  hidden: e.target.checked || undefined
                }
              })}
              className="h-3.5 w-3.5"
            />
            <span className="text-xs whitespace-nowrap mr-3">Hide</span>

            <span className="text-xs text-muted-foreground">Badge:</span>
            <Input
              placeholder="Text"
              value={frontmatterData.sidebar?.badge?.text || ''}
              onChange={(e) => updateContent({
                sidebar: {
                  ...frontmatterData.sidebar,
                  badge: {
                    ...(frontmatterData.sidebar?.badge || {}),
                    text: e.target.value || undefined,
                  }
                }
              })}
              className="h-7 text-xs flex-1"
            />
            <select
              value={frontmatterData.sidebar?.badge?.variant || 'default'}
              onChange={(e) => updateContent({
                sidebar: {
                  ...frontmatterData.sidebar,
                  badge: {
                    ...(frontmatterData.sidebar?.badge || {}),
                    variant: e.target.value as any
                  }
                }
              })}
              className="h-7 text-xs border rounded px-2 bg-background"
              title="Badge style"
            >
              <option value="default">default</option>
              <option value="note">note</option>
              <option value="tip">tip</option>
              <option value="caution">caution</option>
              <option value="danger">danger</option>
              <option value="success">success</option>
            </select>
          </div>
        </div>

        <div>
          <Input
            id="fm-description"
            placeholder="Description (for SEO and navigation)"
            value={frontmatterData.description || ''}
            onChange={(e) => updateContent({ description: e.target.value })}
            className="h-7 text-xs"
          />
        </div>

        {customFields.length > 0 && (
          <div className="space-y-1">
            {customFields.map((field, index) => (
              <div key={index} className="flex gap-1">
                <Input
                  placeholder="Key"
                  value={field.key}
                  onChange={(e) => updateCustomField(index, e.target.value, field.value)}
                  className="h-7 text-xs flex-1"
                />
                <Input
                  placeholder="Value"
                  value={field.value}
                  onChange={(e) => updateCustomField(index, field.key, e.target.value)}
                  className="h-7 text-xs flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCustomField(index)}
                  className="h-7 w-7 p-0"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={addCustomField}
          className="h-6 px-2 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Field
        </Button>
      </div>
    </div>
  );
};
