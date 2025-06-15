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

  useEffect(() => {
    if (!editorRef.current) return;

    const crepe = new Crepe({
      root: editorRef.current,
      defaultValue: value,
      onChange: (markdown: string) => {
        onChange?.(markdown);
      },
    });

    crepe.create().then(() => {
      crepeInstance.current = crepe;
    });

    return () => {
      crepeInstance.current?.destroy();
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (crepeInstance.current && value !== undefined) {
      crepeInstance.current.setValue(value);
    }
  }, [value]);

  return <div ref={editorRef} style={{ minHeight: 400 }} />;
} 