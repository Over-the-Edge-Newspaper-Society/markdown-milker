// server/yjs-websocket-server.js
// Proper Y.js WebSocket server using official utilities

const WebSocket = require('ws')
const http = require('http')
const { setupWSConnection } = require('y-websocket/bin/utils')
const { v4: uuidv4 } = require('uuid')

const port = process.env.PORT || 1234
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('okay')
})

const wss = new WebSocket.Server({ 
  server,
  // Add ping/pong to keep connections alive
  clientTracking: true,
  perMessageDeflate: false
})

// Track active connections
const connections = new Map()

// Health check endpoint
server.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      connections: connections.size,
      documents: Array.from(connections.keys())
    }))
  }
})

wss.on('connection', (ws, req) => {
  const docName = req.url.slice(1).split('?')[0] // Remove leading slash and query params
  const connectionId = uuidv4()
  
  console.log(`📞 New Y.js connection to document: "${docName}"`)
  
  // Add connection to tracking
  if (!connections.has(docName)) {
    connections.set(docName, new Set())
  }
  connections.get(docName).add(connectionId)
  
  // Set up ping/pong
  ws.isAlive = true
  ws.on('pong', () => {
    ws.isAlive = true
  })
  
  // Handle connection setup
  try {
    setupWSConnection(ws, req, {
      docName,
      gc: true,
      pingTimeout: 30000
    })
    
    console.log(`✅ Y.js connection established for "${docName}" (${connectionId})`)
    
    // Handle connection close
    ws.on('close', (code, reason) => {
      console.log(`📞 Y.js connection closed for "${docName}" (${connectionId}): ${code} ${reason || ''}`)
      const docConnections = connections.get(docName)
      if (docConnections) {
        docConnections.delete(connectionId)
        if (docConnections.size === 0) {
          connections.delete(docName)
        }
      }
    })
    
    // Handle errors
    ws.on('error', (error) => {
      console.error(`❌ Y.js connection error for "${docName}" (${connectionId}):`, error)
    })
    
  } catch (error) {
    console.error(`❌ Failed to setup Y.js connection for "${docName}" (${connectionId}):`, error)
    ws.close(1011, 'Internal Server Error')
  }
})

// Keep connections alive
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('🔄 Cleaning up stale connection')
      return ws.terminate()
    }
    ws.isAlive = false
    ws.ping()
  })
}, 30000)

wss.on('close', () => {
  clearInterval(interval)
})

server.listen(port, () => {
  console.log(`🚀 Y.js WebSocket server running on port ${port}`)
  console.log('📝 Ready for collaborative editing')
})

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('🛑 Shutting down Y.js WebSocket server...')
  wss.close(() => {
    server.close(() => {
      console.log('✅ Y.js WebSocket server closed')
      process.exit(0)
    })
  })
})

// Health check and stats
setInterval(() => {
  const activeConnections = connections.size
  const documents = new Set()
  
  connections.forEach((docConnections) => {
    docConnections.forEach((connectionId) => {
      documents.add(connectionId)
    })
  })
  
  if (activeConnections > 0) {
    console.log(`📊 Y.js Stats: ${activeConnections} connections, ${documents.size} documents`)
    
    // Group by document
    const docCounts = new Map()
    connections.forEach((docConnections) => {
      docConnections.forEach((connectionId) => {
        docCounts.set(connectionId, (docCounts.get(connectionId) || 0) + 1)
      })
    })
    
    docCounts.forEach((count, docName) => {
      console.log(`  📄 "${docName}": ${count} connections`)
    })
  }
}, 60000)

// Log startup info
console.log('📋 Y.js Server Configuration:')
console.log(`   Port: ${port}`)
console.log(`   Y.js version: ${require('yjs/package.json').version}`)
console.log(`   y-websocket version: ${require('y-websocket/package.json').version}`)
console.log(`   WebSocket compression: disabled`)