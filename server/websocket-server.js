// server/websocket-server.js
const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: process.env.WS_PORT || 1234 })
const docConnections = new Map()

console.log('Starting collaborative WebSocket server...')

// Helper function to generate connection ID
function generateConnectionId() {
  return Math.random().toString(36).substring(2, 15)
}

// Helper function to get connection info
function getConnectionInfo(ws) {
  return `${ws.connectionId} (${ws.docName})`
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const docName = url.pathname.slice(1) || 'default'
  const connectionId = generateConnectionId()
  
  // Add metadata to websocket
  ws.docName = docName
  ws.connectionId = connectionId
  ws.connectedAt = new Date()
  
  console.log(`📞 New connection: ${getConnectionInfo(ws)}`)
  
  // Track connections per document
  if (!docConnections.has(docName)) {
    docConnections.set(docName, new Map())
  }
  docConnections.get(docName).set(connectionId, ws)
  
  const docConnectionCount = docConnections.get(docName).size
  console.log(`📄 Document "${docName}" now has ${docConnectionCount} connection(s)`)
  
  // Send welcome message with connection info
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify({ 
        type: 'welcome', 
        docName: docName,
        connectionId: connectionId,
        collaborators: docConnectionCount
      }))
    } catch (error) {
      console.error('Error sending welcome message:', error)
    }
  }
  
  // Notify other clients about new collaborator
  const docMap = docConnections.get(docName)
  if (docMap) {
    docMap.forEach((client, clientId) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify({
            type: 'collaborators',
            count: docConnectionCount,
            action: 'joined'
          }))
        } catch (error) {
          console.error('Error notifying client:', error)
        }
      }
    })
  }
  
  // Handle messages
  ws.on('message', (data) => {
    const docMap = docConnections.get(docName)
    if (docMap) {
      let relayedCount = 0
      docMap.forEach((client, clientId) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          try {
            client.send(data)
            relayedCount++
          } catch (error) {
            console.error(`Error relaying message to ${clientId}:`, error)
          }
        }
      })
      
      if (relayedCount > 0) {
        console.log(`📤 Relayed message from ${getConnectionInfo(ws)} to ${relayedCount} clients`)
      }
    }
  })
  
  // Handle disconnection
  ws.on('close', (code, reason) => {
    console.log(`📞 Connection closed: ${getConnectionInfo(ws)} (code: ${code})`)
    
    const docMap = docConnections.get(docName)
    if (docMap) {
      docMap.delete(connectionId)
      const remainingConnections = docMap.size
      
      console.log(`📄 Document "${docName}" now has ${remainingConnections} connection(s)`)
      
      // Notify remaining clients
      if (remainingConnections > 0) {
        docMap.forEach((client, clientId) => {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(JSON.stringify({
                type: 'collaborators',
                count: remainingConnections,
                action: 'left'
              }))
            } catch (error) {
              console.error('Error notifying client of departure:', error)
            }
          }
        })
      } else {
        // No more connections, clean up document
        docConnections.delete(docName)
        console.log(`🗑️  Document "${docName}" cleaned up (no more connections)`)
      }
    }
  })
  
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for ${getConnectionInfo(ws)}:`, error.message)
  })
  
  // Handle ping/pong for connection health
  ws.on('pong', () => {
    ws.isAlive = true
  })
})

// Ping all connections every 30 seconds to check health
const pingInterval = setInterval(() => {
  let totalConnections = 0
  let healthyConnections = 0
  
  wss.clients.forEach((ws) => {
    totalConnections++
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.isAlive = false
      ws.ping()
      
      // Check if connection responded to previous ping
      setTimeout(() => {
        if (ws.isAlive) {
          healthyConnections++
        } else {
          console.log(`🏥 Terminating unresponsive connection: ${getConnectionInfo(ws)}`)
          ws.terminate()
        }
      }, 5000)
    } else {
      ws.terminate()
    }
  })
  
  if (totalConnections > 0) {
    console.log(`💓 Health check: ${totalConnections} total connections`)
  }
}, 30000)

// Server event handlers
wss.on('listening', () => {
  console.log(`✅ Collaborative WebSocket server running on port ${wss.options.port}`)
})

wss.on('error', (error) => {
  console.error('❌ WebSocket server error:', error)
})

// Log stats every minute
setInterval(() => {
  const totalConnections = Array.from(docConnections.values())
    .reduce((sum, docMap) => sum + docMap.size, 0)
  const docCount = docConnections.size
  
  if (totalConnections > 0 || docCount > 0) {
    console.log(`📊 Stats: ${totalConnections} connections across ${docCount} documents`)
    
    // Log details for each document
    docConnections.forEach((docMap, docName) => {
      const connections = Array.from(docMap.values())
      const connectionIds = Array.from(docMap.keys()).join(', ')
      console.log(`  📄 "${docName}": ${docMap.size} connections [${connectionIds}]`)
    })
  }
}, 60000)

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down WebSocket server...')
  
  clearInterval(pingInterval)
  
  // Close all connections gracefully
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'server_shutdown' }))
      ws.close(1000, 'Server shutting down')
    }
  })
  
  wss.close(() => {
    console.log('✅ WebSocket server closed')
    process.exit(0)
  })
})