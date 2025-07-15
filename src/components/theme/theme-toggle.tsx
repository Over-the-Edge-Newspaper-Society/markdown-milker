'use client'

import React from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from './theme-provider'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  size?: 'sm' | 'default' | 'lg'
  variant?: 'default' | 'outline' | 'ghost'
  showLabel?: boolean
  className?: string
}

export function ThemeToggle({ 
  size = 'default', 
  variant = 'ghost',
  showLabel = false,
  className 
}: ThemeToggleProps) {
  const { theme, setTheme, actualTheme } = useTheme()

  const themes = [
    {
      value: 'light' as const,
      label: 'Light',
      icon: Sun,
      description: 'Light mode'
    },
    {
      value: 'dark' as const,
      label: 'Dark', 
      icon: Moon,
      description: 'Dark mode'
    },
    {
      value: 'system' as const,
      label: 'System',
      icon: Monitor,
      description: 'Follow system preference'
    }
  ]

  const currentTheme = themes.find(t => t.value === theme) || themes[2]
  const CurrentIcon = currentTheme.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          className={cn('relative', className)}
          title={`Current theme: ${currentTheme.label}${theme === 'system' ? ` (${actualTheme})` : ''}`}
        >
          <CurrentIcon className="h-4 w-4" />
          {/* Show actual theme indicator for system mode */}
          {theme === 'system' && (
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500" 
                 title={`Following system: ${actualTheme}`} />
          )}
          {showLabel && (
            <span className="ml-2 hidden sm:inline">
              {currentTheme.label}
              {theme === 'system' && (
                <span className="text-xs opacity-75 ml-1">
                  ({actualTheme})
                </span>
              )}
            </span>
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {themes.map((themeOption) => {
          const Icon = themeOption.icon
          const isActive = theme === themeOption.value
          
          return (
            <DropdownMenuItem
              key={themeOption.value}
              onClick={() => setTheme(themeOption.value)}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                isActive && 'bg-accent text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <div className="flex flex-col">
                <span className="font-medium">{themeOption.label}</span>
                <span className="text-xs text-muted-foreground">
                  {themeOption.description}
                  {themeOption.value === 'system' && (
                    <span className="ml-1">({actualTheme})</span>
                  )}
                </span>
              </div>
              {isActive && (
                <div className="ml-auto w-2 h-2 rounded-full bg-blue-500" />
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Simple icon-only theme toggle for minimal UI
export function SimpleThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, actualTheme } = useTheme()
  
  const handleToggle = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  const getIcon = () => {
    if (theme === 'system') {
      return <Monitor className="h-4 w-4" />
    }
    return actualTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />
  }

  const getTitle = () => {
    const titles = {
      light: 'Switch to dark mode',
      dark: 'Switch to system mode', 
      system: `Switch to light mode (currently ${actualTheme})`
    }
    return titles[theme]
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      className={cn('relative', className)}
      title={getTitle()}
    >
      {getIcon()}
      {theme === 'system' && (
        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-blue-500" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}