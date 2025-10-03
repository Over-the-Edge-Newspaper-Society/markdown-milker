// src/app/api/files/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, readdir, mkdir, stat } from 'fs/promises'
import { join, dirname, extname } from 'path'
import { existsSync } from 'fs'
import { StarlightOrderManager } from '@/lib/starlight-order-manager'

// Dynamic function to get the docs path based on settings
function getDocsPath(projectId?: string): string {
  if (projectId) {
    const projPath = join(process.cwd(), 'projects', projectId, 'src', 'content', 'docs')
    if (existsSync(projPath)) return projPath
  }

  // Fallback: Try to find first available project
  const projectsDir = join(process.cwd(), 'projects')
  if (existsSync(projectsDir)) {
    try {
      const { readdirSync } = require('fs')
      const projects = readdirSync(projectsDir, { withFileTypes: true })
        .filter((d: any) => d.isDirectory())
        .map((d: any) => d.name)
      if (projects.length > 0) {
        const firstProjectPath = join(projectsDir, projects[0], 'src', 'content', 'docs')
        if (existsSync(firstProjectPath)) return firstProjectPath
      }
    } catch {}
  }

  // Final fallback to local docs folder
  return join(process.cwd(), 'docs')
}

// Ensure docs directory exists
async function ensureDocsDir(docsPath: string) {
  if (!existsSync(docsPath)) {
    await mkdir(docsPath, { recursive: true })
  }
}

interface SidebarMeta {
  order?: number
  hidden?: boolean
}

function extractSidebarMetaFromFrontmatter(frontmatter: string): SidebarMeta {
  const lines = frontmatter.split('\n')
  let inSidebar = false
  const result: SidebarMeta = {}

  for (const rawLine of lines) {
    const line = rawLine
    const trimmed = line.trim()

    if (trimmed === 'sidebar:') {
      inSidebar = true
      continue
    }

    if (inSidebar) {
      if (!line.startsWith(' ')) {
        inSidebar = false
      } else {
        const orderMatch = line.trim().match(/^order:\s*([^#]+?)(?:\s+#.*)?$/)
        if (orderMatch) {
          const value = Number(orderMatch[1].replace(/^['"]|['"]$/g, ''))
          if (!Number.isNaN(value)) {
            result.order = value
          }
        }
        const hiddenMatch = line.trim().match(/^hidden:\s*(true|false)/)
        if (hiddenMatch) {
          result.hidden = hiddenMatch[1] === 'true'
        }
      }
    }

    if (!inSidebar) {
      const topMatch = trimmed.match(/^order:\s*([^#]+?)(?:\s+#.*)?$/)
      if (topMatch) {
        const value = Number(topMatch[1].replace(/^['"]|['"]$/g, ''))
        if (!Number.isNaN(value)) {
          result.order = value
        }
      }
      const hiddenMatch = trimmed.match(/^hidden:\s*(true|false)/)
      if (hiddenMatch) {
        result.hidden = hiddenMatch[1] === 'true'
      }
    }
  }

  return result
}

async function extractSidebarMeta(fullPath: string): Promise<SidebarMeta> {
  try {
    const content = await readFile(fullPath, 'utf-8')
    const match = content.match(/^---\n([\s\S]*?)\n---/)
    if (!match) return {}
    return extractSidebarMetaFromFrontmatter(match[1])
  } catch (error) {
    console.error('Failed to read sidebar order for', fullPath, error)
    return {}
  }
}

// Security check to prevent path traversal
function isSecurePath(requestedPath: string, docsPath: string) {
  const fullPath = join(docsPath, requestedPath)
  return fullPath.startsWith(docsPath)
}

// GET - Read file content or list directory
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId') || undefined
  const DOCS_PATH = getDocsPath(projectId)
  await ensureDocsDir(DOCS_PATH)
  const path = searchParams.get('path')

  try {
    if (path) {
      // Read specific file
      if (!isSecurePath(path, DOCS_PATH)) {
        return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
      }
      
      const fullPath = join(DOCS_PATH, path)
      
      // Check if it's a directory first
      const stats = await stat(fullPath)
      if (stats.isDirectory()) {
        return NextResponse.json({ error: 'Cannot read directory as file' }, { status: 400 })
      }
      
      const content = await readFile(fullPath, 'utf-8')
      return NextResponse.json({ content })
    }

    await StarlightOrderManager.generateSidebarConfig(DOCS_PATH, projectId)

    // List files and directories with full paths (not nested structure)
    // The frontend will handle building the tree
    // Exclude _assets folder from file tree
    async function getAllFiles(dirPath: string, relativePath: string = ''): Promise<any[]> {
      const files = await readdir(dirPath, { withFileTypes: true })
      const result = []
      
      for (const file of files) {
        // Skip _assets folder
        if (file.name === '_assets') {
          continue
        }
        
        const fullPath = join(dirPath, file.name)
        const relativeFilePath = relativePath ? join(relativePath, file.name) : file.name
        const stats = await stat(fullPath)
        
        if (file.isDirectory()) {
          let dirMeta: SidebarMeta | undefined
          const indexCandidates = ['index.md', 'index.mdx']
          for (const candidate of indexCandidates) {
            const candidatePath = join(fullPath, candidate)
            if (existsSync(candidatePath)) {
              dirMeta = await extractSidebarMeta(candidatePath)
              break
            }
          }

          // Add directory entry
          result.push({
            name: file.name,
            path: relativeFilePath,
            type: 'directory',
            size: 0,
            modified: stats.mtime.toISOString(),
            sidebarOrder: dirMeta?.order,
            sidebarHidden: dirMeta?.hidden
          })
          
          // Recursively get files from subdirectory
          const subFiles = await getAllFiles(fullPath, relativeFilePath)
          result.push(...subFiles)
        } else {
          // Only include markdown files
          if (['.md', '.mdx', '.markdown'].includes(extname(file.name).toLowerCase())) {
            const sidebarMeta = await extractSidebarMeta(fullPath)
            result.push({
              name: file.name,
              path: relativeFilePath,
              type: 'file',
              size: stats.size, // This is the actual file size in bytes from filesystem
              modified: stats.mtime.toISOString(),
              sidebarOrder: sidebarMeta.order,
              sidebarHidden: sidebarMeta.hidden
            })
          }
        }
      }

      return result
    }

    const fileList = await getAllFiles(DOCS_PATH)
    
    // Sort by path to maintain consistent ordering
    fileList.sort((a, b) => a.path.localeCompare(b.path))

    return NextResponse.json(fileList)
  } catch (error) {
    console.error('GET Error:', error)
    return NextResponse.json({ error: 'Failed to read' }, { status: 500 })
  }
}

// POST - Save file content
export async function POST(request: NextRequest) {
  const DOCS_PATH = getDocsPath()
  await ensureDocsDir(DOCS_PATH)
  
  try {
    const body = await request.json()
    const { path, content, type = 'file', projectId } = body
    const targetDocsPath = getDocsPath(projectId)
    
    console.log('POST request:', { path, contentLength: content?.length, type })
    
    if (!path) {
      return NextResponse.json({ error: 'Path is required' }, { status: 400 })
    }

    if (!isSecurePath(path, targetDocsPath)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const fullPath = join(targetDocsPath, path)
    const dir = dirname(fullPath)

    // Ensure directory exists
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    if (type === 'directory') {
      // Create directory
      await mkdir(fullPath, { recursive: true })
    } else {
      // Save file
      if (content === undefined) {
        return NextResponse.json({ error: 'Content is required for files' }, { status: 400 })
      }
      await writeFile(fullPath, content, 'utf-8')
    }
    
    console.log('Successfully saved:', fullPath)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST Error:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}

// PUT - Update file content (alias for POST)
export async function PUT(request: NextRequest) {
  return POST(request)
}

// DELETE - Delete file or directory
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId') || undefined
  const DOCS_PATH = getDocsPath(projectId)
  await ensureDocsDir(DOCS_PATH)
  
  try {
    const path = searchParams.get('path')
    
    if (!path || !isSecurePath(path, DOCS_PATH)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const fullPath = join(DOCS_PATH, path)
    
    // For now, we'll skip deletion implementation for safety
    // You can implement this later with proper safeguards
    return NextResponse.json({ error: 'Delete not implemented yet' }, { status: 501 })
  } catch (error) {
    console.error('DELETE Error:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
