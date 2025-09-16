// src/components/ui/use-toast.ts
'use client'

export type ToastVariant = 'default' | 'success' | 'error' | 'warning'

export interface ToastMessage {
  id?: number
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

type Listener = (msg: ToastMessage) => void

const listeners = new Set<Listener>()
let idCounter = 1

export function toast(msg: ToastMessage) {
  const withId = { id: idCounter++, duration: 3000, variant: 'default', ...msg }
  listeners.forEach((l) => l(withId))
}

export function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

