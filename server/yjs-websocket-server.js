// server/yjs-websocket-server.js
// Proper Y.js WebSocket server using official utilities

const WebSocket = require('ws')
const Y = require('yjs')

// Import the official y-websocket utilities
let setupWSConnection
try {
  setupWSConnection = require('y-websocket/bin/utils').setupWSConnection
  console.log('✅ Using official y-websocket utilities')
} catch (error) {
  console.error('❌ Failed to import y-websocket utilities:', error.message)
  console.log('📦 Please install: npm install y-websocket')
  process.exit(1)
}

const port = process.env.WS_PORT || 1234

// Create WebSocket server
const wss = new WebSocket.Server({ 
  port,
  perMessageDeflate: {
    zlibDeflateOptions: {
      threshold: 1024,
      concurrencyLimit: 10,
    },
    threshold: 1024,
  }
})

console.log('🚀 Starting Y.js WebSocket server with official utilities...')

// Track connections for debugging
const connections = new Map()

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const docName = url.pathname.slice(1) || 'default'
  
  console.log(`📞 New Y.js connection to document: "${docName}"`)
  
  // Store connection info
  const connectionId = Math.random().toString(36).substring(2, 15)
  connections.set(connectionId, { ws, docName, connectedAt: new Date() })
  
  // Use official setupWSConnection
  try {
    setupWSConnection(ws, req, { docName })
    console.log(`✅ Y.js connection established for "${docName}" (${connectionId})`)
  } catch (error) {
    console.error(`❌ Failed to setup Y.js connection for "${docName}":`, error)
    ws.close(1011, 'Internal server error')
    connections.delete(connectionId)
    return
  }
  
  // Handle connection close
  ws.on('close', (code, reason) => {
    console.log(`📞 Y.js connection closed for "${docName}" (${connectionId}): ${code} ${reason}`)
    connections.delete(connectionId)
  })
  
  ws.on('error', (error) => {
    console.error(`❌ Y.js connection error for "${docName}" (${connectionId}):`, error.message)
    connections.delete(connectionId)
  })
})

wss.on('listening', () => {
  console.log(`✅ Y.js WebSocket server running on port ${port}`)
  console.log(`🎯 Ready for Y.js collaborative editing!`)
  console.log(`📡 WebSocket URL: ws://localhost:${port}/[document-name]`)
})

wss.on('error', (error) => {
  console.error('❌ Y.js WebSocket server error:', error)
})

// Health check and stats
setInterval(() => {
  const activeConnections = connections.size
  const documents = new Set()
  
  connections.forEach(({ docName }) => {
    documents.add(docName)
  })
  
  if (activeConnections > 0) {
    console.log(`📊 Y.js Stats: ${activeConnections} connections, ${documents.size} documents`)
    
    // Group by document
    const docCounts = new Map()
    connections.forEach(({ docName }) => {
      docCounts.set(docName, (docCounts.get(docName) || 0) + 1)
    })
    
    docCounts.forEach((count, docName) => {
      console.log(`  📄 "${docName}": ${count} connections`)
    })
  }
}, 60000)

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Y.js WebSocket server...')
  
  // Close all connections gracefully
  connections.forEach(({ ws }, connectionId) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'Server shutting down')
    }
  })
  
  wss.close(() => {
    console.log('✅ Y.js WebSocket server closed')
    process.exit(0)
  })
})

// Log startup info
console.log('📋 Y.js Server Configuration:')
console.log(`   Port: ${port}`)
console.log(`   Y.js version: ${require('yjs/package.json').version}`)
console.log(`   y-websocket version: ${require('y-websocket/package.json').version}`)
console.log(`   WebSocket compression: enabled`)