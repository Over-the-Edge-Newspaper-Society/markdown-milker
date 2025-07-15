'use client'

import React from 'react'
import { DirectoryTree } from '../file-tree/directory-tree'

export function Sidebar() {
  return (
    <aside className="w-64 h-screen border-r border-gray-200 bg-background">
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Files</h2>
        <DirectoryTree />
      </div>
    </aside>
  )
} 