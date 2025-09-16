// src/app/api/files/batch-frontmatter/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

function deepMerge(target: any, source: any): any {
  const out = { ...(target || {}) }
  for (const [k, v] of Object.entries(source || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge(out[k] || {}, v)
    } else {
      out[k] = v
    }
  }
  return out
}

function parseFrontmatter(content: string): { data: any; body: string } {
  const m = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { data: {}, body: content }
  const yaml = m[1]
  const body = m[2] || ''
  const data: any = {}
  const lines = yaml.split('\n')
  let inSidebar = false
  let inBadge = false
  const handleKV = (kv: string, target: any) => {
    const idx = kv.indexOf(':')
    if (idx <= 0) return
    const k = kv.slice(0, idx).trim()
    const v = kv.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (k === 'order') target[k] = Number(v)
    else if (k === 'hidden') target[k] = v === 'true'
    else target[k] = v
  }
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (t === 'sidebar:') { inSidebar = true; data.sidebar = data.sidebar || {}; continue }
    if (inSidebar && t === 'badge:') { inBadge = true; data.sidebar = data.sidebar || {}; data.sidebar.badge = data.sidebar.badge || {}; continue }
    if (!line.startsWith(' ') && line.includes(':')) { inSidebar = false; inBadge = false }
    if (inSidebar) {
      if (line.startsWith('  ')) {
        if (inBadge && line.startsWith('    ')) handleKV(line.trim(), data.sidebar.badge)
        else handleKV(line.trim(), data.sidebar)
      }
      continue
    }
    if (!line.startsWith(' ')) handleKV(t, data)
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

export async function POST(request: NextRequest) {
  try {
    const { operations } = await request.json()
    if (!Array.isArray(operations)) {
      return NextResponse.json({ error: 'operations must be an array' }, { status: 400 })
    }

    const results = await Promise.all(
      operations.map(async ({ path, updates }: any) => {
        try {
          const fullPath = join(process.cwd(), path)
          const raw = await readFile(fullPath, 'utf-8')
          const { data, body } = parseFrontmatter(raw)
          const merged = deepMerge(data, updates)
          const updated = stringifyFrontmatter(body, merged)
          await writeFile(fullPath, updated, 'utf-8')
          return { path, success: true }
        } catch (e: any) {
          return { path, success: false, error: e?.message }
        }
      })
    )

    return NextResponse.json({ results })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Batch update failed' }, { status: 500 })
  }
}

