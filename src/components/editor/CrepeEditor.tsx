'use client';

import { useEffect, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/nord.css';

interface CrepeEditorProps {
  value?: string;
  onChange?: (markdown: string) => void;
}

export function CrepeEditor({ value = '', onChange }: CrepeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const crepeInstance = useRef<Crepe | null>(null);
  const isInitialized = useRef(false);

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current || isInitialized.current) return;

    // Clean up any existing instance
    if (crepeInstance.current) {
      crepeInstance.current.destroy();
      crepeInstance.current = null;
    }

    const crepe = new Crepe({
      root: editorRef.current,
      defaultValue: value,
    });

    crepe.create();
    crepeInstance.current = crepe;
    isInitialized.current = true;

    // Set up change listener using MutationObserver
    const observer = new MutationObserver(() => {
      if (onChange && crepeInstance.current) {
        const markdown = crepeInstance.current.getMarkdown();
        onChange(markdown);
      }
    });

    observer.observe(editorRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (crepeInstance.current) {
        crepeInstance.current.destroy();
        crepeInstance.current = null;
        isInitialized.current = false;
      }
    };
  }, []); // Only run on mount/unmount

  // Handle content updates from props
  useEffect(() => {
    if (crepeInstance.current && value !== undefined) {
      const currentContent = crepeInstance.current.getMarkdown();
      if (currentContent !== value) {
        // Destroy and recreate the editor with new content
        crepeInstance.current.destroy();
        const crepe = new Crepe({
          root: editorRef.current!,
          defaultValue: value,
        });
        crepe.create();
        crepeInstance.current = crepe;
      }
    }
  }, [value]);

  return <div ref={editorRef} style={{ minHeight: 400 }} />;
} 