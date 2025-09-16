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
import { FolderOpen, Plus } from 'lucide-react'
import { useProjectStore } from '@/lib/stores/project-store'
import { useEditorStore } from '@/lib/stores/editor-store'

interface Project {
  id: string
  name: string
  isStarlight?: boolean
}

export function ProjectSwitcher() {
  const [projects, setProjects] = useState<Project[]>([])
  const [activeProject, setActiveProject] = useState<string | undefined>(undefined)
  const setActiveDirectory = useEditorStore((s) => s.setActiveDirectory)
  const { setActiveProject: setActiveProjectStore } = useProjectStore()
  const [openCreate, setOpenCreate] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

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
    setActiveProject(id)
    const projPath = path || `/projects/${id}`
    // Update zustand store
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
    </>
  )
}
