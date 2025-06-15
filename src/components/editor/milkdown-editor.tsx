'use client'

import { useEditor } from '@milkdown/react'
import { Editor, rootCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { nord } from '@milkdown/theme-nord'

interface MilkdownEditorProps {
  content: string
  onChange: (content: string) => void
}

export function MilkdownEditor({ content, onChange }: MilkdownEditorProps) {
  useEditor((root) => {
    return Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
      })
      .use(nord)
      .use(commonmark)
  })

  return <div className="h-full" />
} 