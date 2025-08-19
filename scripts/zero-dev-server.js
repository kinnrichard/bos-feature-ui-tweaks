#!/usr/bin/env node

/**
 * Development Zero cache server
 * This is a simplified server for local development
 * In production, you would use the official zero-cache binary
 */

const http = require('http');
const WebSocket = require('ws');
const { readFileSync } = require('fs');
const { join } = require('path');

// Load Zero configuration
let config;
try {
  config = JSON.parse(readFileSync(join(__dirname, '..', 'zero-config.json'), 'utf8'));
} catch (error) {
  console.error('❌ Error loading zero-config.json:', error.message);
  process.exit(1);
}

console.log('🚀 Starting Zero development server...');
console.log('📋 Configuration:', JSON.stringify(config, null, 2));

// Create HTTP server for Zero cache
const httpServer = http.createServer((req, res) => {
  // Enable CORS for development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      databases: {
        upstream: config.upstream.database,
        cvr: config.cvr.database,
        cdb: config.cdb.database
      }
    }));
    return;
  }
  
  // For now, return a simple placeholder response
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    message: 'Zero dev server placeholder',
    config: config
  }));
});

// Create WebSocket server for real-time sync
const wsServer = new WebSocket.Server({ 
  port: config['change-streamer-port'],
  cors: {
    origin: '*'
  }
});

wsServer.on('connection', (ws) => {
  console.log('📡 New WebSocket connection established');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📨 Received message:', data);
      
      // Echo back for now (placeholder)
      ws.send(JSON.stringify({
        type: 'ack',
        data: data,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('❌ Error processing message:', error.message);
    }
  });
  
  ws.on('close', () => {
    console.log('📡 WebSocket connection closed');
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to Zero dev server',
    timestamp: new Date().toISOString()
  }));
});

// Start HTTP server
httpServer.listen(config.port, () => {
  console.log(`✅ Zero cache server running on port ${config.port}`);
  console.log(`✅ WebSocket server running on port ${config['change-streamer-port']}`);
  console.log(`🔍 Health check: http://localhost:${config.port}/health`);
  console.log('\n⚠️  This is a development placeholder server.');
  console.log('   For production, use the official zero-cache binary from Rocicorp.');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Zero dev server...');
  httpServer.close();
  wsServer.close();
  process.exit(0);
});