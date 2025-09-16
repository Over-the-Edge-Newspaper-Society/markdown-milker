#!/usr/bin/env node

const { spawn } = require('child_process')
const { writeFileSync, unlinkSync, existsSync, mkdirSync } = require('fs')
const { join, resolve } = require('path')

function ensureDir(path) {
  try {
    mkdirSync(path, { recursive: true })
  } catch (error) {
    if (error && error.code !== 'EEXIST') throw error
  }
}

const projectArg = process.argv[2]
const repoRoot = projectArg ? resolve(projectArg) : join(process.cwd(), 'repo')
const astroConfigPath = join(repoRoot, 'astro.config.mjs')

if (!existsSync(astroConfigPath)) {
  console.error(`Unable to find astro.config.mjs under ${repoRoot}.`)
  process.exit(1)
}

const wrapperFileName = '__mm_dev_astro.config.mjs'
const wrapperPath = join(repoRoot, wrapperFileName)

const wrapperSource = `import baseConfig from './astro.config.mjs';
import { fileURLToPath } from 'node:url';

const sidebarConfigPath = fileURLToPath(new URL('./sidebar.config.mjs', import.meta.url));

const sidebarWatcherPlugin = () => ({
  name: 'markdown-milker-sidebar-config-reloader',
  configureServer(server) {
    const restartOnChange = (file) => {
      if (file === sidebarConfigPath) {
        server.restart();
      }
    };

    server.watcher.add(sidebarConfigPath);
    server.watcher.on('change', restartOnChange);
    server.watcher.on('add', restartOnChange);
  },
});

const baseVite = baseConfig.vite ?? {};
const rawPlugins = baseVite.plugins ?? [];
const normalizedPlugins = Array.isArray(rawPlugins)
  ? rawPlugins.filter(Boolean)
  : [rawPlugins].filter(Boolean);

const hasWatcher = normalizedPlugins.some(
  (plugin) => plugin && typeof plugin === 'object' && plugin.name === 'markdown-milker-sidebar-config-reloader'
);

const plugins = hasWatcher ? normalizedPlugins : [...normalizedPlugins, sidebarWatcherPlugin()];

export default {
  ...baseConfig,
  vite: {
    ...baseVite,
    plugins,
  },
};
`

ensureDir(repoRoot)
writeFileSync(wrapperPath, wrapperSource, 'utf-8')

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const child = spawn(npmCmd, ['run', 'dev', '--', '--config', `./${wrapperFileName}`], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: { ...process.env },
})

let cleanedUp = false
const cleanup = () => {
  if (cleanedUp) return
  cleanedUp = true
  try {
    unlinkSync(wrapperPath)
  } catch {}
}

child.on('exit', (code, signal) => {
  cleanup()
  if (signal) {
    process.kill(process.pid, signal)
  } else {
    process.exit(code ?? 0)
  }
})

const forwardSignal = (signal) => {
  if (!child.killed) {
    child.kill(signal)
  }
}

process.on('SIGINT', () => forwardSignal('SIGINT'))
process.on('SIGTERM', () => forwardSignal('SIGTERM'))
process.on('exit', cleanup)
