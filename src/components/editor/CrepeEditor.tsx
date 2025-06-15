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
  const observerRef = useRef<MutationObserver | null>(null);
  const isMounted = useRef(false);

  // Handle editor initialization and updates
  useEffect(() => {
    if (!editorRef.current) return;

    // Cleanup previous instance if it exists
    if (crepeInstance.current) {
      crepeInstance.current.destroy();
      crepeInstance.current = null;
    }

    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    // Only initialize once
    if (!isMounted.current) {
      isMounted.current = true;
      
      const initializeEditor = async () => {
        const crepe = new Crepe({
          root: editorRef.current,
          defaultValue: value,
        });

        await crepe.create();
        crepeInstance.current = crepe;

        // Set up change listener
        const observer = new MutationObserver(() => {
          if (onChange && crepeInstance.current) {
            try {
              const markdown = crepeInstance.current.getMarkdown();
              onChange(markdown);
            } catch (error) {
              console.error('Error getting markdown:', error);
            }
          }
        });

        observerRef.current = observer;
        observer.observe(editorRef.current, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      };

      initializeEditor();
    }

    // Handle value updates
    const updateContent = async () => {
      if (crepeInstance.current) {
        try {
          const currentContent = crepeInstance.current.getMarkdown();
          if (currentContent !== value) {
            // Destroy and recreate the editor with new content
            crepeInstance.current.destroy();
            const crepe = new Crepe({
              root: editorRef.current,
              defaultValue: value,
            });
            await crepe.create();
            crepeInstance.current = crepe;
          }
        } catch (error) {
          console.error('Error updating content:', error);
        }
      }
    };

    updateContent();

    // Cleanup on unmount
    return () => {
      isMounted.current = false;
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (crepeInstance.current) {
        crepeInstance.current.destroy();
        crepeInstance.current = null;
      }
    };
  }, [value, onChange]);

  return <div ref={editorRef} style={{ minHeight: 400 }} />;
} 