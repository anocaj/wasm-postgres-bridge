#!/usr/bin/env npx ts-node

/**
 * Simple WebSocket Server Starter
 * Starts the basic WebSocket server for testing examples
 */

import { BasicWebSocketServer } from '../src/websocket/server';
import { PostgreSQLClient } from '../src/database/client';

async function startServer() {
  console.log('🚀 Starting WebSocket Server for Examples...\n');

  const dbClient = new PostgreSQLClient();
  const server = new BasicWebSocketServer(dbClient);

  try {
    await server.start(8080);
    console.log('✅ WebSocket server is running on ws://localhost:8080');
    console.log('📋 You can now use the database playground and other examples');
    console.log('\nTo test:');
    console.log('- Open examples/database-playground.html in your browser');
    console.log('- Open examples/wasm-websocket-database-demo.html');
    console.log('\nPress Ctrl+C to stop the server');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down server...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down server...');
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}