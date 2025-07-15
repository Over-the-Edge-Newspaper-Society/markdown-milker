import React from 'react'
import { GitBranch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function GitStatus() {
  return (
    <div className="flex items-center space-x-2">
      <GitBranch className="h-3 w-3" />
      <span>main</span>
      <Badge variant="secondary">clean</Badge>
    </div>
  )
} 