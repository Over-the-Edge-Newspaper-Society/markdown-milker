// src/lib/project.ts
import { SettingsManager } from '@/lib/settings'
import { useProjectStore } from '@/lib/stores/project-store'

/**
 * Derive a stable project ID for centralized asset storage.
 * Priority:
 * - GitHub repo URL owner/repo -> owner-repo
 * - Fallback to 'local-docs'
 */
export function getProjectId(): string {
  if (typeof window !== 'undefined') {
    // Respect active project selected in UI
    try {
      const { activeProject } = useProjectStore.getState()
      if (activeProject) return activeProject
    } catch {}
    const settings = SettingsManager.getSettings()
    const repoUrl = settings?.github?.repoUrl
    if (repoUrl) {
      const parsed = SettingsManager.parseRepoUrl(repoUrl)
      if (parsed) return `${parsed.owner}-${parsed.repo}`
    }
  }
  // Server-side or missing settings: try env, then fallback
  const envId = process.env.PROJECT_ID
  if (envId && /^[A-Za-z0-9_.\-]+$/.test(envId)) return envId
  return 'local-docs'
}

export type AssetStrategy = 'local' | 'centralized'

export function getAssetStrategyClient(): AssetStrategy {
  const mode = process.env.NEXT_PUBLIC_ASSET_STORAGE as AssetStrategy | undefined
  return mode === 'centralized' ? 'centralized' : 'local'
}
