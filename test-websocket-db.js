#!/usr/bin/env node

/**
 * Manual test script for WebSocket-Database integration
 * This starts the WebSocket server so you can test with the web client
 */

const { BasicWebSocketServer } = require('./dist/websocket/server.js');
const { PostgreSQLClient } = require('./dist/database/client.js');

async function startTestServer() {
  console.log('🚀 Starting WebSocket-Database test server...');
  
  try {
    // Initialize database client
    console.log('📊 Connecting to database...');
    const dbClient = new PostgreSQLClient();
    await dbClient.connect();
    await dbClient.initializeSchema();
    console.log('✅ Database connected and schema initialized');

    // Start WebSocket server
    console.log('🔌 Starting WebSocket server...');
    const server = new BasicWebSocketServer(dbClient);
    await server.start(8080);
    console.log('✅ WebSocket server started on port 8080');

    console.log('\n🎯 Test Instructions:');
    console.log('1. Open src/websocket/client.html in your browser');
    console.log('2. Connect to ws://localhost:8080');
    console.log('3. Try the query templates or write your own SQL');
    console.log('4. Press Ctrl+C to stop the server\n');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down server...');
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
}

startTestServer();