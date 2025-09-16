// src/app/api/starlight/init/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile, stat } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { exec as execCb } from 'child_process'
import { promisify } from 'util'

const exec = promisify(execCb)

function sanitizeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._\-]/g, '')
}

async function ensureDir(path: string) {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true })
  }
}

async function updateAstroConfig(projectPath: string, projectId: string) {
  const astroConfigPath = join(projectPath, 'astro.config.mjs')
  const contents = `import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      components: {
        Image: './src/components/CustomImage.astro',
      },
    }),
  ],
  vite: {
    resolve: {
      alias: {
        '@assets': new URL('../shared-assets', import.meta.url).pathname,
      },
    },
  },
});
`
  if (!existsSync(join(projectPath, 'src/components'))) {
    await mkdir(join(projectPath, 'src/components'), { recursive: true })
  }
  await writeFile(astroConfigPath, contents, 'utf-8')

  const customImagePath = join(projectPath, 'src/components/CustomImage.astro')
  const customImage = `---
interface Props { src: string; alt?: string; width?: number | string; height?: number | string; class?: string }
const { src, alt = '', width, height, class: className } = Astro.props as Props
function resolveSrc(input: string): string {
  if (!input) return input
  if (input.startsWith('@assets/')) return input.replace(/^@assets\//, '/assets/')
  if (input.startsWith('_assets/')) return '/' + input
  return input
}
const resolved = resolveSrc(src)
---
<img src={resolved} alt={alt} width={width} height={height} class={className} />
`
  await writeFile(customImagePath, customImage, 'utf-8')
}

export async function POST(request: NextRequest) {
  try {
    const { projectName, template = 'docs' } = await request.json()
    if (!projectName) {
      return NextResponse.json({ error: 'projectName is required' }, { status: 400 })
    }

    const safeName = sanitizeName(projectName)
    if (!safeName) {
      return NextResponse.json({ error: 'Invalid project name' }, { status: 400 })
    }

    const projectsRoot = join(process.cwd(), 'projects')
    await ensureDir(projectsRoot)

    const projectPath = join(projectsRoot, safeName)
    if (existsSync(projectPath)) {
      return NextResponse.json({ error: 'Project already exists' }, { status: 409 })
    }
    await ensureDir(projectPath)

    // Try to scaffold via create-astro; if it fails, write minimal files
    let scaffolded = false
    try {
      const cmd = `npx create-astro@latest ${projectPath} --template starlight --no-install --yes`
      await exec(cmd)
      scaffolded = true
    } catch (e) {
      // Fallback: write minimal package and astro config
      const pkg = {
        name: safeName,
        private: true,
        type: 'module',
        scripts: { dev: 'astro dev', build: 'astro build', preview: 'astro preview' },
        dependencies: { astro: '^5.11.0', '@astrojs/starlight': '^0.34.5' },
      }
      await writeFile(join(projectPath, 'package.json'), JSON.stringify(pkg, null, 2), 'utf-8')
      await ensureDir(join(projectPath, 'src/content/docs'))
      await writeFile(join(projectPath, 'src/content/docs/index.md'), '# New Starlight Project\n', 'utf-8')
    }

    await updateAstroConfig(projectPath, safeName)

    // Initialize git repo (best effort)
    try {
      await exec(`cd ${projectPath} && git init`)
    } catch {}

    return NextResponse.json({ success: true, projectId: safeName, path: projectPath })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to initialize project' }, { status: 500 })
  }
}

