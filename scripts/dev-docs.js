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

const { readdirSync } = require('fs')

const projectArg = process.argv[2]
let repoRoot

if (projectArg) {
  repoRoot = resolve(projectArg)
} else {
  // Find first available project in projects/ directory
  const projectsDir = join(process.cwd(), 'projects')
  if (existsSync(projectsDir)) {
    try {
      const projects = readdirSync(projectsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
      if (projects.length > 0) {
        repoRoot = join(projectsDir, projects[0])
        console.log(`📁 Using project: ${projects[0]}`)
      }
    } catch {}
  }

  if (!repoRoot) {
    console.error('No projects found in /projects directory. Please add a project first.')
    process.exit(1)
  }
}

const astroConfigPath = join(repoRoot, 'astro.config.mjs')

if (!existsSync(astroConfigPath)) {
  console.error(`Unable to find astro.config.mjs under ${repoRoot}.`)
  process.exit(1)
}

const wrapperFileName = '__mm_dev_astro.config.mjs'
const wrapperPath = join(repoRoot, wrapperFileName)

const wrapperSource = `import baseConfig from './astro.config.mjs';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const sidebarConfigPath = fileURLToPath(new URL('./sidebar.config.mjs', import.meta.url));
const wrapperConfigPath = fileURLToPath(new URL('./__mm_dev_astro.config.mjs', import.meta.url));

const sidebarWatcherPlugin = () => ({
  name: 'markdown-milker-sidebar-config-reloader',
  configureServer(server) {
    let isRestarting = false;

    const restartOnChange = async (file) => {
      // Prevent restart if already restarting or if wrapper config changed
      if (isRestarting || file === wrapperConfigPath) {
        return;
      }

      // Only restart if the sidebar config exists and changed
      if (file === sidebarConfigPath && existsSync(sidebarConfigPath)) {
        console.log('Sidebar config changed, restarting...');
        isRestarting = true;

        try {
          await server.restart();
        } catch (error) {
          console.error('Failed to restart server:', error);
        } finally {
          // Reset the flag after a delay to allow the restart to complete
          setTimeout(() => {
            isRestarting = false;
          }, 2000);
        }
      }
    };

    if (existsSync(sidebarConfigPath)) {
      server.watcher.add(sidebarConfigPath);
    }

    // Unwatch the wrapper config to prevent restart loops
    try {
      server.watcher.unwatch(wrapperConfigPath);
    } catch (e) {
      // Wrapper might not be watched yet, that's fine
    }

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
