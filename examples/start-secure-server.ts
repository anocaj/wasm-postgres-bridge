#!/usr/bin/env npx ts-node

/**
 * Secure WebSocket Server Starter
 * Starts the secure WebSocket server with authentication
 */

import { SecureWebSocketServer } from '../src/websocket/secure-server';
import { PostgreSQLClient } from '../src/database/client';

async function startSecureServer() {
  console.log('🔒 Starting Secure WebSocket Server...\n');

  const dbClient = new PostgreSQLClient();
  
  const securityConfig = {
    jwtSecret: process.env.JWT_SECRET || 'demo-secret-key-change-in-production',
    apiKeys: (process.env.API_KEYS || 'demo-api-key-123,another-api-key-456').split(','),
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    maxFailedAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    requireAuth: process.env.REQUIRE_AUTH !== 'false', // Default to true
    maxRequestsPerMinute: 60,
    allowedQueryTypes: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    enableAuditLog: true,
  };

  const server = new SecureWebSocketServer(dbClient, securityConfig);

  try {
    await server.start(8080);
    console.log('✅ Secure WebSocket server is running on ws://localhost:8080');
    console.log(`🔐 Authentication required: ${securityConfig.requireAuth}`);
    console.log('📋 Audit logging enabled');
    
    if (securityConfig.requireAuth) {
      console.log('\n👥 Default user accounts:');
      console.log('- admin / admin123 (full access)');
      console.log('- user / user123 (read/write, no delete)');
      console.log('- readonly / readonly123 (read only)');
      console.log('\n🔑 API Keys:');
      console.log('- demo-api-key-123');
      console.log('- another-api-key-456');
    }
    
    console.log('\nTo test:');
    console.log('- Use examples/security-demo.ts --websocket');
    console.log('- Connect with authentication to ws://localhost:8080');
    console.log('\nPress Ctrl+C to stop the server');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down secure server...');
      
      // Show final stats
      const stats = server.getStats();
      console.log('\nFinal Statistics:');
      console.log(`- Connected clients: ${stats.connectedClients}`);
      console.log(`- Audit log entries: ${stats.auditLogEntries}`);
      
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down secure server...');
      await server.stop();
      process.exit(0);
    });

    // Show periodic stats
    setInterval(() => {
      const stats = server.getStats();
      if (stats.connectedClients > 0 || stats.auditLogEntries > 0) {
        console.log(`📊 Stats - Clients: ${stats.connectedClients}, Audit entries: ${stats.auditLogEntries}`);
      }
    }, 30000); // Every 30 seconds

  } catch (error) {
    console.error('❌ Failed to start secure server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startSecureServer();
}