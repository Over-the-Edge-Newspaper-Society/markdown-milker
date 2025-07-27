'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';

interface FrontmatterData {
  title?: string;
  description?: string;
  sidebar?: {
    order?: number;
    label?: string;
  };
  [key: string]: any;
}

interface FrontmatterEditorProps {
  content: string;
  onChange: (frontmatter: string, markdownContent: string) => void;
  className?: string;
}

export const FrontmatterEditor = ({ content, onChange, className }: FrontmatterEditorProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [frontmatterData, setFrontmatterData] = useState<FrontmatterData>({});
  const [markdownContent, setMarkdownContent] = useState('');
  const [customFields, setCustomFields] = useState<Array<{key: string, value: string}>>([]);

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
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Check for sidebar section
      if (trimmed === 'sidebar:') {
        isInSidebar = true;
        result.sidebar = {};
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
            result.sidebar[key] = isNaN(Number(cleanValue)) ? cleanValue : Number(cleanValue);
          }
        }
        continue;
      }
      
      // Handle top-level properties (not indented)
      if (!line.startsWith(' ') && line.includes(':')) {
        isInSidebar = false; // Exit sidebar section
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

  if (!isExpanded) {
    return (
      <div className={`border-b bg-muted/30 ${className}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(true)}
          className="w-full justify-start h-8 px-3"
        >
          <ChevronRight className="w-4 h-4 mr-2" />
          <span className="text-sm">
            {Object.keys(frontmatterData).length > 0 
              ? `Frontmatter (${Object.keys(frontmatterData).length} fields)` 
              : 'Add Frontmatter'
            }
          </span>
          {frontmatterData.title && (
            <span className="ml-2 text-xs text-muted-foreground">
              • {frontmatterData.title}
            </span>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className={`border-b bg-muted/30 ${className}`}>
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
            className="h-6 px-1"
          >
            <ChevronDown className="w-4 h-4 mr-2" />
            <span className="text-sm font-medium">Frontmatter</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="fm-title" className="text-xs">Title</Label>
            <Input
              id="fm-title"
              placeholder="Page title"
              value={frontmatterData.title || ''}
              onChange={(e) => updateContent({ title: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="fm-order" className="text-xs">Sidebar Order</Label>
            <Input
              id="fm-order"
              type="number"
              placeholder="1"
              value={frontmatterData.sidebar?.order || ''}
              onChange={(e) => updateContent({ 
                sidebar: { 
                  ...frontmatterData.sidebar, 
                  order: e.target.value ? Number(e.target.value) : undefined 
                }
              })}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="fm-description" className="text-xs">Description</Label>
          <Textarea
            id="fm-description"
            placeholder="Page description for SEO and navigation"
            value={frontmatterData.description || ''}
            onChange={(e) => updateContent({ description: e.target.value })}
            className="min-h-16 text-sm resize-none"
          />
        </div>

        {customFields.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs">Custom Fields</Label>
            {customFields.map((field, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="Key"
                  value={field.key}
                  onChange={(e) => updateCustomField(index, e.target.value, field.value)}
                  className="h-8 text-sm flex-1"
                />
                <Input
                  placeholder="Value"
                  value={field.value}
                  onChange={(e) => updateCustomField(index, field.key, e.target.value)}
                  className="h-8 text-sm flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCustomField(index)}
                  className="h-8 w-8 p-0"
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
          className="h-8"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Field
        </Button>
      </div>
    </div>
  );
};