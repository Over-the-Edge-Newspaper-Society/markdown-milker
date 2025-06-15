'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { CrepeEditor } from '@/components/editor/CrepeEditor'
import { useEditorStore } from '@/lib/stores/editor-store'
import { useFileStore } from '@/lib/stores/file-store'

export default function Home() {
  const { currentContent, setContent } = useEditorStore()
  const { selectedFile } = useFileStore()

  return (
    <MainLayout>
      <div className="flex-1 p-4">
        {selectedFile ? (
          <div className="h-[calc(100vh-2rem)]">
            <CrepeEditor
              value={currentContent}
              onChange={setContent}
            />
          </div>
        ) : (
          <div className="h-[calc(100vh-2rem)] flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">No File Selected</h2>
              <p className="text-muted-foreground">
                Select a file from the sidebar to start editing
              </p>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
} 