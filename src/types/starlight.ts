// Starlight-specific frontmatter typings for editor awareness
export interface StarlightFrontMatter {
  title: string
  description?: string
  editUrl?: boolean | string
  lastUpdated?: boolean | Date
  prev?: boolean | { link: string; label: string }
  next?: boolean | { link: string; label: string }
  sidebar?: {
    order?: number
    label?: string
    hidden?: boolean
    badge?: string | { text: string; variant: string }
  }
  hero?: {
    image?: {
      file: string // May reference centralized assets via @assets/<projectId>/path
      alt?: string
    }
    actions?: Array<{
      text: string
      link: string
      icon?: string
      variant?: 'primary' | 'secondary'
    }>
  }
}

