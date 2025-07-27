# Unified Documentation Platform Setup

This guide walks you through setting up the unified documentation platform that combines the Markdown Milker editor with Astro Starlight documentation preview and GitHub integration.

## ✨ Features

- **Live Markdown Editing** with Milkdown editor
- **Real-time Collaboration** via Y.js
- **GitHub Integration** with token-based authentication
- **Live Documentation Preview** using Astro Starlight
- **Docker Containerization** for easy deployment
- **Asset Management** with drag & drop image support

## 🚀 Quick Start

### Option 1: Local Development

1. **Clone and Install**
   ```bash
   git clone <your-repo-url>
   cd markdown-milker
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start Development Servers**
   ```bash
   # Terminal 1: Start collaboration server
   npm run dev:yjs
   
   # Terminal 2: Start Next.js editor
   npm run dev
   
   # Terminal 3: Start Astro docs (if using existing docs)
   cd over-the-edge-docs-starlight
   npm install
   npm run dev
   ```

4. **Access the Application**
   - Editor: http://localhost:3000
   - Docs Preview: http://localhost:4321 (if running Astro separately)

### Option 2: Docker Development

1. **Build and Start Services**
   ```bash
   docker-compose up --build
   ```

2. **Access the Application**
   - Gateway (unified access): http://localhost
   - Direct editor: http://localhost:3000
   - Direct docs: http://localhost:4321

## ⚙️ GitHub Integration Setup

### 1. Create GitHub Personal Access Token

1. Go to https://github.com/settings/tokens/new
2. Create a token with `repo` scope
3. Copy the token for use in settings

### 2. Configure in Application

1. Open the application at http://localhost:3000
2. Click the "GitHub not configured" alert or the Settings button
3. Fill in your GitHub details:
   - **Personal Access Token**: Your GitHub token
   - **Repository Owner**: Your username or organization
   - **Repository Name**: The repository containing your docs
   - **Default Branch**: Usually `main` or `master`
4. Test the connection
5. Save settings

### 3. Using GitHub Sync

- **Pull**: Click "Pull" to fetch latest content from GitHub
- **Push**: Enter a commit message and click "Push" to send changes to GitHub

## 📝 Using the Editor

### Basic Editing
1. Select a markdown file from the file tree
2. Choose between Editor and Docs Preview tabs
3. Edit content in the markdown editor
4. Preview changes in real-time in the Docs Preview tab

### Collaboration Mode
- Toggle between Solo and Collaborative modes
- In Collaborative mode, multiple users can edit simultaneously
- Changes are synchronized in real-time via Y.js

### Image Management
- Click the "Library" button to access the image library
- Drag & drop images directly into the editor
- Images are automatically managed and referenced

## 🐳 Docker Configuration

### Services Overview

- **editor**: Next.js application (port 3000)
- **docs**: Astro Starlight documentation site (port 4321)
- **yjs-server**: Collaboration server (port 1234)
- **gateway**: Nginx reverse proxy (port 80)

### Environment Variables

```bash
# Docker Compose Environment
NODE_ENV=development
NEXT_PUBLIC_DOCS_URL=http://localhost:4321
YJS_SERVER_URL=ws://yjs-server:1234
EDITOR_URL=http://editor:3000
DOCS_URL=http://docs:4321
```

## 📁 File Structure

```
markdown-milker/
├── src/
│   ├── components/
│   │   ├── editor/           # Markdown editor components
│   │   ├── file-tree/        # File management
│   │   ├── github-sync/      # GitHub integration
│   │   ├── preview/          # Documentation preview
│   │   ├── settings/         # Settings modal
│   │   └── ui/               # Shared UI components
│   ├── hooks/                # React hooks
│   ├── lib/                  # Utilities and services
│   └── app/
│       └── api/              # API routes
│           ├── files/        # File operations
│           └── github/       # GitHub integration
├── docs/                     # Local markdown files
├── over-the-edge-docs-starlight/  # Astro documentation
├── server/                   # Y.js collaboration server
├── services/
│   └── gateway/              # Nginx reverse proxy
├── docker-compose.yml        # Docker orchestration
├── Dockerfile.editor         # Editor container
├── Dockerfile.docs           # Docs container
└── Dockerfile.yjs            # Collaboration server
```

## 🔧 Configuration

### GitHub Settings
GitHub configuration is stored locally in browser localStorage:
- Token and repository details
- Editor preferences (theme, auto-save)
- Settings persist across sessions

### File Synchronization
- Local files in `docs/` folder are synced with GitHub
- Pull operation downloads files from GitHub to local `docs/`
- Push operation uploads local files to GitHub repository

## 🚀 Production Deployment

### Environment Variables
```bash
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_DOCS_URL=https://docs.your-domain.com
GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

### Docker Production
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

## 🎯 Key Benefits

1. **Unified Experience**: Edit and preview documentation in one interface
2. **Real-time Collaboration**: Multiple editors can work simultaneously
3. **GitHub Integration**: Seamless version control and publishing
4. **Live Preview**: See exactly how documentation will look
5. **Asset Management**: Easy image and file handling
6. **Containerized**: Easy deployment and scaling

## 🔍 Troubleshooting

### Common Issues

1. **GitHub Connection Failed**
   - Verify token has correct permissions
   - Check repository owner/name spelling
   - Ensure repository exists and is accessible

2. **Docs Preview Not Loading**
   - Check if Astro service is running (port 4321)
   - Verify NEXT_PUBLIC_DOCS_URL environment variable
   - Try refreshing the preview

3. **Collaboration Not Working**
   - Ensure Y.js server is running (port 1234)
   - Check WebSocket connection in browser dev tools
   - Verify NEXT_PUBLIC_WS_URL configuration

### Development Tips

- Use browser dev tools to check API responses
- Check server logs for error messages
- Verify file permissions for local docs folder
- Test GitHub token permissions with curl:

```bash
curl -H "Authorization: token YOUR_TOKEN" \
     https://api.github.com/repos/OWNER/REPO
```

## 📋 Requirements

- Node.js 18+
- Docker (for containerized deployment)
- GitHub repository for documentation
- GitHub Personal Access Token with repo permissions

This unified platform provides a complete solution for collaborative documentation editing with live preview and seamless GitHub integration.