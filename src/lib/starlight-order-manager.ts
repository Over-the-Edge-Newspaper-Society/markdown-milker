// src/lib/starlight-order-manager.ts
import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

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
  static async rebalanceDirectory(dirPath: string): Promise<number> {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const mdFiles = entries
      .filter((f) => f.isFile() && f.name.endsWith('.md'))
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
      const order = file.name === 'index.md' ? 0 : i * 10
      const newData = { ...data, sidebar: { ...(data.sidebar || {}), order } }
      const updatedContent = stringifyFrontmatter(body, newData)
      await writeFile(filePath, updatedContent, 'utf-8')
      updatedCount += 1
    }
    return updatedCount
  }

  static async applyManualOrder(dirPath: string, orderedFileNames: string[]): Promise<number> {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const mdFiles = entries.filter((f) => f.isFile() && f.name.endsWith('.md'))

    if (mdFiles.length === 0) return 0

    const fileSet = new Set(mdFiles.map((f) => f.name))
    const finalOrder: string[] = []

    const pushUnique = (name: string) => {
      if (fileSet.has(name) && !finalOrder.includes(name)) {
        finalOrder.push(name)
      }
    }

    orderedFileNames.forEach((name) => pushUnique(name))

    mdFiles
      .map((file) => file.name)
      .sort((a, b) => a.localeCompare(b))
      .forEach((name) => pushUnique(name))

    const indexPosition = finalOrder.indexOf('index.md')
    if (indexPosition > 0) {
      finalOrder.splice(indexPosition, 1)
      finalOrder.unshift('index.md')
    }

    let updatedCount = 0
    let orderStep = 0

    for (const name of finalOrder) {
      const filePath = join(dirPath, name)
      const raw = await readFile(filePath, 'utf-8')
      const { data, body } = parseFrontmatter(raw)
      const order = name === 'index.md' ? 0 : ++orderStep * 10
      const newData = { ...data, sidebar: { ...(data.sidebar || {}), order } }
      const updatedContent = stringifyFrontmatter(body, newData)
      await writeFile(filePath, updatedContent, 'utf-8')
      updatedCount += 1
    }

    return updatedCount
  }
}
