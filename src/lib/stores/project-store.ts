// src/lib/stores/project-store.ts
'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ProjectStore {
  activeProject: string | null
  activeProjectPath: string | null
  setActiveProject: (projectId: string, path: string) => void
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      activeProject: null,
      activeProjectPath: null,
      setActiveProject: (projectId, path) => set({ activeProject: projectId, activeProjectPath: path })
    }),
    {
      name: 'markdown-milker-project-storage',
    }
  )
)

