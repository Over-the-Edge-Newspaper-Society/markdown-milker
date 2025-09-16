// src/lib/starlight-order-manager.ts
import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

function parseFrontmatter(content: string): { data: any; body: string } {
  const m = content.match(/^---\n([\s\s\S]*?)\n---\n?([\s\s\S]*)$/)
  if (!m) return { data: {}, body: content }
  const yaml = m[1]
  const body = m[2] || ''
  const data: any = {}
  // simple parse for title/description/sidebar with order/label/hidden
  const lines = yaml.split('\n')
  let inSidebar = false
  let inBadge = false
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (t === 'sidebar:') { inSidebar = true; data.sidebar = data.sidebar || {}; continue }
    if (inSidebar && t === 'badge:') { inBadge = true; data.sidebar = data.sidebar || {}; data.sidebar.badge = data.sidebar.badge || {}; continue }
    if (!line.startsWith(' ') && line.includes(':')) { inSidebar = false; inBadge = false }
    const handleKV = (kv: string, target: any) => {
      const idx = kv.indexOf(':')
      if (idx <= 0) return
      const k = kv.slice(0, idx).trim()
      const v = kv.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (k === 'order') target[k] = Number(v)
      else if (k === 'hidden') target[k] = v === 'true'
      else target[k] = v
    }
    if (inSidebar) {
      if (line.startsWith('  ')) {
        if (inBadge && line.startsWith('    ')) {
          handleKV(line.trim(), data.sidebar.badge)
        } else {
          handleKV(line.trim(), data.sidebar)
        }
      }
      continue
    }
    if (!inSidebar && !inBadge && !line.startsWith(' ')) {
      handleKV(t, data)
    }
  }
  return { data, body }
}

function stringifyFrontmatter(body: string, data: any): string {
  const lines: string[] = []
  if (data.title) lines.push(`title: ${data.title}`)
  if (data.description) lines.push(`description: ${data.description}`)
  if (data.sidebar) {
    lines.push('sidebar:')
    const s = data.sidebar
    if (s.order !== undefined) lines.push(`  order: ${s.order}`)
    if (s.label) lines.push(`  label: ${s.label}`)
    if (s.hidden !== undefined) lines.push(`  hidden: ${s.hidden ? 'true' : 'false'}`)
    if (s.badge && (s.badge.text || s.badge.variant)) {
      lines.push('  badge:')
      if (s.badge.text) lines.push(`    text: ${s.badge.text}`)
      if (s.badge.variant) lines.push(`    variant: ${s.badge.variant}`)
    }
  }
  const yaml = lines.join('\n')
  return yaml ? `---\n${yaml}\n---\n${body}` : body
}

export class StarlightOrderManager {
  static docsRoot(projectId?: string): string {
    if (projectId) {
      const projectDocs = join(process.cwd(), 'projects', projectId, 'src', 'content', 'docs')
      if (existsSync(projectDocs)) return projectDocs
    }
    const repoDocs = join(process.cwd(), 'repo', 'src', 'content', 'docs')
    if (existsSync(repoDocs)) return repoDocs
    return join(process.cwd(), 'docs')
  }

  static sidebarConfigPath(): string {
    return join(process.cwd(), 'repo', 'sidebar.config.mjs')
  }

  static async readFrontmatterMeta(filePath: string): Promise<{ title?: string; order?: number; label?: string; hidden?: boolean }> {
    if (!existsSync(filePath)) return {}
    const raw = await readFile(filePath, 'utf-8')
    const { data } = parseFrontmatter(raw)
    const sidebar = data.sidebar || {}
    return {
      title: data.title,
      order: typeof sidebar.order === 'number' ? sidebar.order : undefined,
      label: sidebar.label,
      hidden: sidebar.hidden === true
    }
  }

  static formatSidebarLabel(meta: { label?: string; title?: string }, fallback: string): string {
    return meta.label || meta.title || fallback.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  static async generateSidebarConfig(docsRoot: string): Promise<void> {
    const entries = await readdir(docsRoot, { withFileTypes: true })
    const sections: { label: string; items: any[]; order: number }[] = []
    const markdownExtensions = ['.md', '.mdx']

    const directories = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (dir) => {
          const indexPath = join(docsRoot, dir.name, 'index.md')
          const meta = await StarlightOrderManager.readFrontmatterMeta(indexPath)
          return {
            name: dir.name,
            meta,
            indexPath,
          }
        })
    )

    const visibleDirectories = directories
      .filter((dir) => dir.meta && dir.meta.hidden !== true)
      .sort((a, b) => {
        const orderA = a.meta?.order ?? Number.MAX_SAFE_INTEGER
        const orderB = b.meta?.order ?? Number.MAX_SAFE_INTEGER
        if (orderA !== orderB) return orderA - orderB
        return a.name.localeCompare(b.name)
      })

    for (const dir of visibleDirectories) {
      const sectionItems: any[] = []

      const overviewLabel = StarlightOrderManager.formatSidebarLabel(dir.meta, dir.name)
      sectionItems.push({ label: overviewLabel, link: `/${dir.name}/` })

      const dirEntries = await readdir(join(docsRoot, dir.name), { withFileTypes: true })
      const pageEntries = await Promise.all(
        dirEntries
          .filter((entry) => entry.isFile() && markdownExtensions.some((ext) => entry.name.endsWith(ext)))
          .filter((entry) => entry.name !== 'index.md')
          .map(async (entry) => {
            const filePath = join(docsRoot, dir.name, entry.name)
            const meta = await StarlightOrderManager.readFrontmatterMeta(filePath)
            const baseName = entry.name.replace(/\.(md|mdx)$/, '')
            return { name: baseName, meta, filePath, extension: entry.name.split('.').pop() }
          })
      )

      const visiblePages = pageEntries
        .filter((page) => page.meta.hidden !== true)
        .sort((a, b) => {
          const orderA = a.meta.order ?? Number.MAX_SAFE_INTEGER
          const orderB = b.meta.order ?? Number.MAX_SAFE_INTEGER
          if (orderA !== orderB) return orderA - orderB
          return a.name.localeCompare(b.name)
        })

      const dedupedPages: Record<string, typeof visiblePages[number]> = {}
      for (const page of visiblePages) {
        if (!dedupedPages[page.name] || page.filePath.endsWith('.mdx')) {
          dedupedPages[page.name] = page
        }
      }

      const finalPages = Object.values(dedupedPages)
        .sort((a, b) => {
          const orderA = a.meta.order ?? Number.MAX_SAFE_INTEGER
          const orderB = b.meta.order ?? Number.MAX_SAFE_INTEGER
          if (orderA !== orderB) return orderA - orderB
          return a.name.localeCompare(b.name)
        })

      for (const page of finalPages) {
        const label = StarlightOrderManager.formatSidebarLabel(page.meta, page.name)
        sectionItems.push({ label, link: `/${dir.name}/${page.name}/` })
      }

      sections.push({ label: overviewLabel, items: sectionItems, order: dir.meta?.order ?? Number.MAX_SAFE_INTEGER })
    }

    const topLevelFiles = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && markdownExtensions.some((ext) => entry.name.endsWith(ext)))
        .filter((entry) => !entry.name.startsWith('index.'))
        .map(async (entry) => {
          const filePath = join(docsRoot, entry.name)
          const meta = await StarlightOrderManager.readFrontmatterMeta(filePath)
          const name = entry.name.replace(/\.(md|mdx)$/, '')
          return { name, meta, filePath }
        })
    )

    const visibleTopLevel = topLevelFiles
      .filter((file) => file.meta.hidden !== true)
      .sort((a, b) => {
        const orderA = a.meta.order ?? Number.MAX_SAFE_INTEGER
        const orderB = b.meta.order ?? Number.MAX_SAFE_INTEGER
        if (orderA !== orderB) return orderA - orderB
        return a.name.localeCompare(b.name)
      })

    for (const file of visibleTopLevel) {
      const label = StarlightOrderManager.formatSidebarLabel(file.meta, file.name)
      sections.push({
        label,
        items: [{ label, link: `/${file.name}/` }],
        order: file.meta.order ?? Number.MAX_SAFE_INTEGER
      })
    }

    const sidebarPath = StarlightOrderManager.sidebarConfigPath()
    const orderedSections = sections
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order
        return a.label.localeCompare(b.label)
      })
      .map(({ order, ...rest }) => rest)

    const serialized = `export default ${JSON.stringify(orderedSections, null, 2)}\n`
    await writeFile(sidebarPath, serialized, 'utf-8')
  }

  static async rebalanceDirectory(dirPath: string, docsRoot?: string): Promise<number> {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const markdownExtensions = ['.md', '.mdx']
    const mdFiles = entries
      .filter((f) => f.isFile() && markdownExtensions.some((ext) => f.name.endsWith(ext)))
      .sort((a, b) => {
        if (a.name === 'index.md') return -1
        if (b.name === 'index.md') return 1
        return a.name.localeCompare(b.name)
      })

    let updatedCount = 0
    for (let i = 0; i < mdFiles.length; i++) {
      const file = mdFiles[i]
      const filePath = join(dirPath, file.name)
      const raw = await readFile(filePath, 'utf-8')
      const { data, body } = parseFrontmatter(raw)
      const order = file.name.startsWith('index.') ? 0 : i * 10
      const newData = { ...data, sidebar: { ...(data.sidebar || {}), order } }
      const updatedContent = stringifyFrontmatter(body, newData)
      await writeFile(filePath, updatedContent, 'utf-8')
      updatedCount += 1
    }
    const root = docsRoot || StarlightOrderManager.docsRoot()
    await StarlightOrderManager.generateSidebarConfig(root)
    return updatedCount
  }

  static async applyManualOrder(dirPath: string, orderedItems: { name: string; type: 'file' | 'directory' }[], docsRoot: string): Promise<number> {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const markdownExtensions = ['.md', '.mdx']
    const fileEntries = entries.filter((entry) => entry.isFile() && markdownExtensions.some((ext) => entry.name.endsWith(ext)))
    const directoryEntries = entries.filter((entry) => entry.isDirectory())

    const availableItems: { name: string; type: 'file' | 'directory' }[] = []

    for (const file of fileEntries) {
      availableItems.push({ name: file.name, type: 'file' })
    }

    for (const directory of directoryEntries) {
      const indexPath = join(dirPath, directory.name, 'index.md')
      if (existsSync(indexPath)) {
        availableItems.push({ name: directory.name, type: 'directory' })
      }
    }

    if (availableItems.length === 0) {
      return 0
    }

    const keyFor = (item: { name: string; type: 'file' | 'directory' }) => `${item.type}:${item.name}`
    const availableMap = new Map(availableItems.map((item) => [keyFor(item), item]))
    const seen = new Set<string>()
    const finalOrder: { name: string; type: 'file' | 'directory' }[] = []

    const pushUnique = (item: { name: string; type: 'file' | 'directory' }) => {
      const key = keyFor(item)
      if (!availableMap.has(key) || seen.has(key)) return
      finalOrder.push(availableMap.get(key)!)
      seen.add(key)
    }

    orderedItems.forEach((item) => {
      pushUnique(item)
    })

    const remaining = availableItems
      .filter((item) => !seen.has(keyFor(item)))
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

    remaining.forEach((item) => pushUnique(item))

    let updatedCount = 0

    for (let index = 0; index < finalOrder.length; index++) {
      const item = finalOrder[index]
      const filePath = item.type === 'directory'
        ? join(dirPath, item.name, 'index.md')
        : join(dirPath, item.name)

      if (!existsSync(filePath)) {
        continue
      }

      const raw = await readFile(filePath, 'utf-8')
      const { data, body } = parseFrontmatter(raw)
      const order = index * 10
      const newData = { ...data, sidebar: { ...(data.sidebar || {}), order } }
      const updatedContent = stringifyFrontmatter(body, newData)
      await writeFile(filePath, updatedContent, 'utf-8')
      updatedCount += 1
    }

    await StarlightOrderManager.generateSidebarConfig(docsRoot)
    return updatedCount
  }

  static async updateSidebarHidden(filePath: string, hidden: boolean, docsRoot: string): Promise<void> {
    const raw = await readFile(filePath, 'utf-8')
    const { data, body } = parseFrontmatter(raw)
    const sidebar = { ...(data.sidebar || {}) }

    if (hidden) {
      sidebar.hidden = true
    } else {
      delete sidebar.hidden
    }

    const newData = { ...data, sidebar }
    const updatedContent = stringifyFrontmatter(body, newData)
    await writeFile(filePath, updatedContent, 'utf-8')
    await StarlightOrderManager.generateSidebarConfig(docsRoot)
  }
}
