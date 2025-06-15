// server/yjs-websocket-server.js
// Fixed Y.js WebSocket server with correct imports
const WebSocket = require('ws')
const Y = require('yjs')

// Try to use the y-websocket utils if available, otherwise implement basic version
let setupWSConnection

try {
  // Try to use y-websocket utilities
  const yWebsocketUtils = require('y-websocket/lib/utils')
  setupWSConnection = yWebsocketUtils.setupWSConnection
  console.log('✅ Using y-websocket utilities')
} catch (error) {
  console.log('⚠️  y-websocket utilities not available, using basic implementation')
  
  // Basic Y.js WebSocket implementation
  const docs = new Map()
  
  setupWSConnection = (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const docName = url.pathname.slice(1) || 'default'
    
    console.log(`📞 New Y.js connection: "${docName}"`)
    
    // Get or create document
    let doc = docs.get(docName)
    if (!doc) {
      doc = new Y.Doc()
      docs.set(docName, doc)
      console.log(`📄 Created new Y.js document: "${docName}"`)
    }
    
    // Store doc reference on websocket
    ws.doc = doc
    ws.docName = docName
    
    // Simple message relay for Y.js
    ws.on('message', (data) => {
      // Broadcast to all other connections for this document
      wss.clients.forEach(client => {
        if (client !== ws && 
            client.readyState === WebSocket.OPEN && 
            client.docName === docName) {
          try {
            client.send(data)
          } catch (error) {
            console.error('Error relaying Y.js message:', error)
          }
        }
      })
    })
    
    ws.on('close', () => {
      console.log(`📞 Y.js connection closed: "${docName}"`)
      
      // Check if any clients are still connected to this document
      const hasClients = Array.from(wss.clients).some(
        client => client.docName === docName && client.readyState === WebSocket.OPEN
      )
      
      if (!hasClients) {
        docs.delete(docName)
        console.log(`🗑️  Y.js document "${docName}" cleaned up`)
      }
    })
    
    ws.on('error', (error) => {
      console.error(`❌ Y.js connection error for "${docName}":`, error.message)
    })
    
    // Send welcome message (Y.js will handle the protocol)
    try {
      ws.send(JSON.stringify({ 
        type: 'yjs-ready', 
        docName: docName,
        timestamp: Date.now()
      }))
    } catch (error) {
      console.error('Error sending Y.js welcome:', error)
    }
  }
}

const wss = new WebSocket.Server({ port: process.env.WS_PORT || 1234 })

console.log('🚀 Starting Y.js WebSocket server...')

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req)
})

wss.on('listening', () => {
  console.log(`✅ Y.js WebSocket server running on port ${wss.options.port}`)
  console.log(`🎯 Ready for Y.js collaborative editing!`)
})

wss.on('error', (error) => {
  console.error('❌ Y.js WebSocket server error:', error)
})

// Stats logging
setInterval(() => {
  const totalConnections = wss.clients.size
  const docNames = new Set()
  
  wss.clients.forEach(client => {
    if (client.docName) {
      docNames.add(client.docName)
    }
  })
  
  if (totalConnections > 0) {
    console.log(`📊 Y.js Stats: ${totalConnections} connections, ${docNames.size} documents`)
    
    // Count connections per document
    const docCounts = new Map()
    wss.clients.forEach(client => {
      if (client.docName) {
        const count = docCounts.get(client.docName) || 0
        docCounts.set(client.docName, count + 1)
      }
    })
    
    docCounts.forEach((count, docName) => {
      console.log(`  📄 "${docName}": ${count} connections`)
    })
  }
}, 30000)

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Y.js WebSocket server...')
  
  // Close all connections
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'Server shutting down')
    }
  })
  
  wss.close(() => {
    console.log('✅ Y.js WebSocket server closed')
    process.exit(0)
  })
})