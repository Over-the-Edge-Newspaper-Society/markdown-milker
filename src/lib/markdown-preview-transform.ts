// src/lib/markdown-preview-transform.ts
import { getAssetStrategyClient, getProjectId } from '@/lib/project'

// Convert @assets/<projectId>/<file> to API serve URL for in-app preview
export function transformAssetPathsToDisplay(markdown: string, projectId?: string): string {
  const pid = projectId || getProjectId()
  const strategy = getAssetStrategyClient()
  if (strategy !== 'centralized') return markdown

  return markdown.replace(/@assets\/(\w[\w.-]*)\/(\S+?)(?=[)\s\]\n]|$)/g, (_m, p1: string, file: string) => {
    const targetPid = p1 || pid
    const qs = new URLSearchParams({
      path: file,
      projectId: targetPid,
      strategy: 'centralized',
    }).toString()
    return `/api/assets/serve?${qs}`
  })
}

// Convert API serve URLs back to @assets/<projectId>/<file> before saving to disk
export function transformAssetPathsToStorage(markdown: string): string {
  const strategy = getAssetStrategyClient()
  if (strategy !== 'centralized') return markdown

  return markdown.replace(/\(([^)]+)\)/g, (whole, url: string) => {
    try {
      if (!url.includes('/api/assets/serve?')) return whole
      const query = url.split('?')[1]
      if (!query) return whole
      const params = new URLSearchParams(query)
      const path = params.get('path') || ''
      const projectId = params.get('projectId') || getProjectId()
      if (!path) return whole
      return `(@assets/${projectId}/${path})`
    } catch {
      return whole
    }
  })
}

