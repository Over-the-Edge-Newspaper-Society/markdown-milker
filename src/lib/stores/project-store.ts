// src/lib/stores/project-store.ts
'use client'

import { create } from 'zustand'

interface ProjectStore {
  activeProject: string | null
  activeProjectPath: string | null
  setActiveProject: (projectId: string, path: string) => void
}

export const useProjectStore = create<ProjectStore>((set) => ({
  activeProject: null,
  activeProjectPath: null,
  setActiveProject: (projectId, path) => set({ activeProject: projectId, activeProjectPath: path })
}))

