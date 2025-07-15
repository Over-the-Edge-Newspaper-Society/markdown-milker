'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  actualTheme: 'dark' | 'light' // The resolved theme (system preference resolved)
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
  actualTheme: 'light',
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'markdown-editor-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme)
  const [actualTheme, setActualTheme] = useState<'dark' | 'light'>('light')

  useEffect(() => {
    // Load theme from localStorage on mount
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored && ['dark', 'light', 'system'].includes(stored)) {
        setTheme(stored as Theme)
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error)
    }
  }, [storageKey])

  useEffect(() => {
    // Apply theme to document root
    const root = window.document.documentElement
    
    // Remove existing theme classes
    root.classList.remove('light', 'dark')
    
    let resolvedTheme: 'dark' | 'light'
    
    if (theme === 'system') {
      // Use system preference
      resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } else {
      resolvedTheme = theme
    }
    
    // Apply the resolved theme
    root.classList.add(resolvedTheme)
    setActualTheme(resolvedTheme)
    
    // Store theme preference
    try {
      localStorage.setItem(storageKey, theme)
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error)
    }
  }, [theme, storageKey])

  useEffect(() => {
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = () => {
      if (theme === 'system') {
        const resolvedTheme = mediaQuery.matches ? 'dark' : 'light'
        const root = window.document.documentElement
        root.classList.remove('light', 'dark')
        root.classList.add(resolvedTheme)
        setActualTheme(resolvedTheme)
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      setTheme(newTheme)
    },
    actualTheme,
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}