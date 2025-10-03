// src/components/ProjectSwitcher.tsx
'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FolderOpen, Plus, GitBranch } from 'lucide-react'
import { useProjectStore } from '@/lib/stores/project-store'
import { useEditorStore } from '@/lib/stores/editor-store'

interface Project {
  id: string
  name: string
  isStarlight?: boolean
}

export function ProjectSwitcher() {
  const [projects, setProjects] = useState<Project[]>([])
  const setActiveDirectory = useEditorStore((s) => s.setActiveDirectory)
  const { activeProject, setActiveProject: setActiveProjectStore } = useProjectStore()
  const [openCreate, setOpenCreate] = useState(false)
  const [openAddRepo, setOpenAddRepo] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [repoBranch, setRepoBranch] = useState('')
  const [availableBranches, setAvailableBranches] = useState<string[]>([])
  const [isFetchingBranches, setIsFetchingBranches] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isAddingRepo, setIsAddingRepo] = useState(false)

  const load = async () => {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects || [])
      }
    } catch {}
  }

  useEffect(() => {
    load()
  }, [])

  const switchProject = (id: string, path?: string) => {
    const projPath = path || `/projects/${id}`
    // Update zustand store (persisted in localStorage)
    setActiveProjectStore(id, projPath)
    // Update editor active directory for local asset mode
    setActiveDirectory(`projects/${id}/src/content/docs`)
    // Hint: file tree listens to project changes and will refresh
  }

  const createNewProject = async () => {
    if (!newProjectName.trim()) return
    setIsCreating(true)
    try {
      const res = await fetch('/api/starlight/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: newProjectName.trim() })
      })
      if (res.ok) {
        await load()
        switchProject(newProjectName.trim())
        setOpenCreate(false)
        setNewProjectName('')
      } else {
        const err = await res.json().catch(() => ({}))
        alert('Failed to create project: ' + (err.error || res.statusText))
      }
    } finally {
      setIsCreating(false)
    }
  }

  const fetchBranches = async (url: string) => {
    if (!url.trim()) return
    setIsFetchingBranches(true)
    try {
      const res = await fetch('/api/github/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: url.trim() })
      })
      if (res.ok) {
        const data = await res.json()
        setAvailableBranches(data.branches || [])
        if (data.branches && data.branches.length > 0) {
          // Set default branch or first branch
          const defaultBranch = data.branches.find((b: string) => b === 'main' || b === 'master') || data.branches[0]
          setRepoBranch(defaultBranch)
        }
      } else {
        setAvailableBranches([])
      }
    } catch {
      setAvailableBranches([])
    } finally {
      setIsFetchingBranches(false)
    }
  }

  const addRepo = async () => {
    if (!repoUrl.trim()) return
    setIsAddingRepo(true)
    try {
      const res = await fetch('/api/projects/add-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          branch: repoBranch.trim() || 'main'
        })
      })
      if (res.ok) {
        const data = await res.json()
        await load()
        switchProject(data.projectId)
        setOpenAddRepo(false)
        setRepoUrl('')
        setRepoBranch('')
        setAvailableBranches([])
      } else {
        const err = await res.json().catch(() => ({}))
        alert('Failed to add repo: ' + (err.error || res.statusText))
      }
    } finally {
      setIsAddingRepo(false)
    }
  }

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderOpen className="w-4 h-4 mr-2" />
          {activeProject || 'Select Project'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {projects.map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => switchProject(p.id, (p as any).path)}>
            {p.name}
            {p.isStarlight && <span className="ml-2 text-[10px] bg-muted px-1 rounded">Starlight</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setOpenCreate(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Starlight Project
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setOpenAddRepo(true)}>
          <GitBranch className="w-4 h-4 mr-2" />
          Add Existing Repo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <Dialog open={openCreate} onOpenChange={setOpenCreate}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Starlight Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="proj-name">Project Name</Label>
            <Input
              id="proj-name"
              placeholder="e.g. docs-website"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Will be created under projects/&lt;name&gt;</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpenCreate(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={createNewProject} disabled={!newProjectName.trim() || isCreating}>
            {isCreating ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={openAddRepo} onOpenChange={setOpenAddRepo}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Existing Repository</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="repo-url">Repository URL</Label>
            <div className="flex gap-2">
              <Input
                id="repo-url"
                placeholder="https://github.com/user/repo.git"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={() => fetchBranches(repoUrl)}
                disabled={!repoUrl.trim() || isFetchingBranches}
                variant="outline"
                size="sm"
              >
                {isFetchingBranches ? 'Fetching...' : 'Fetch Branches'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">HTTPS URL of the Git repository</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="repo-branch">Branch</Label>
            {availableBranches.length > 0 ? (
              <select
                id="repo-branch"
                value={repoBranch}
                onChange={(e) => setRepoBranch(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {availableBranches.map((branch) => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            ) : (
              <Input
                id="repo-branch"
                placeholder="main"
                value={repoBranch}
                onChange={(e) => setRepoBranch(e.target.value)}
              />
            )}
            <p className="text-xs text-muted-foreground">
              {availableBranches.length > 0
                ? `${availableBranches.length} branches available`
                : 'Fetch branches or enter branch name manually'
              }
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpenAddRepo(false)} disabled={isAddingRepo}>
            Cancel
          </Button>
          <Button onClick={addRepo} disabled={!repoUrl.trim() || !repoBranch.trim() || isAddingRepo}>
            {isAddingRepo ? 'Adding…' : 'Add Repository'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
