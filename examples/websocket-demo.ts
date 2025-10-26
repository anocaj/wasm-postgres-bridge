#!/usr/bin/env ts-node

/**
 * WebSocket Server Demo
 * 
 * This script demonstrates the WebSocket server functionality implemented.
 * Run this script and then open src/websocket/client.html in your browser to test.
 * 
 * Usage:
 *   npm run build && node dist/examples/websocket-demo.js
 *   or
 *   npx ts-node examples/websocket-demo.ts
 */

import { BasicWebSocketServer } from '../src/websocket/server';

async function runWebSocketDemo() {
  const server = new BasicWebSocketServer();
  const PORT = 8080;

  console.log('🚀 Starting WebSocket Server Demo...');
  console.log('📋 This demo shows the WebSocket communication layer');
  console.log('');

  try {
    await server.start(PORT);
    console.log(`✅ WebSocket server started on port ${PORT}`);
    console.log('');
    console.log('📖 How to test:');
    console.log(`   1. Open src/websocket/client.html in your browser`);
    console.log(`   2. Connect to ws://localhost:${PORT}`);
    console.log(`   3. Try sending different message types:`);
    console.log(`      - Ping: {"type": "ping", "payload": "Hello!"}`);
    console.log(`      - Query: {"type": "query", "payload": {"sql": "SELECT 1"}}`);
    console.log(`      - Invalid: {"payload": "missing type"}`);
    console.log('');
    console.log('🔍 Watch this console for connection logs and message handling');
    console.log('');
    console.log('Press Ctrl+C to stop the server');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down WebSocket server...');
      await server.stop();
      console.log('✅ Server stopped gracefully');
      process.exit(0);
    });

    // Keep the process alive
    process.stdin.resume();

  } catch (error) {
    console.error('❌ Failed to start WebSocket server:', error);
    process.exit(1);
  }
}

// Run the demo if this script is executed directly
if (require.main === module) {
  runWebSocketDemo().catch(console.error);
}

export { runWebSocketDemo };