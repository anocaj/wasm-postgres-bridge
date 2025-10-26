#!/usr/bin/env npx ts-node

/**
 * Security Features Demo
 * 
 * This demo showcases the security features implemented in the project:
 * - Authentication and authorization
 * - Input validation and sanitization
 * - SQL injection prevention
 * - Rate limiting
 * - Audit logging
 */

import { PostgreSQLClient } from '../src/database/client';
import { SecureWebSocketServer } from '../src/websocket/secure-server';
import { AuthenticationManager } from '../src/security/auth';
import { InputValidator } from '../src/security/validation';
import WebSocket from 'ws';

async function runSecurityDemo() {
  console.log('🔒 Starting Security Features Demo\n');

  // Demo 1: Input Validation
  console.log('📝 Demo 1: Input Validation and Sanitization');
  console.log('==============================================');

  const testInputs = [
    "SELECT * FROM users",
    "SELECT * FROM users; DROP TABLE users;--",
    "SELECT * FROM users WHERE id = 1 OR 1=1",
    "<script>alert('xss')</script>",
    "javascript:alert('xss')",
    "user@example.com",
    "invalid-email",
  ];

  testInputs.forEach(input => {
    console.log(`\nTesting input: "${input}"`);
    
    // SQL validation
    if (input.toLowerCase().includes('select')) {
      const sqlValidation = InputValidator.validateSQL(input, ['SELECT']);
      console.log(`  SQL Valid: ${sqlValidation.isValid}`);
      console.log(`  SQL Safe: ${sqlValidation.isSafe}`);
      if (sqlValidation.errors.length > 0) {
        console.log(`  Errors: ${sqlValidation.errors.join(', ')}`);
      }
      if (sqlValidation.warnings.length > 0) {
        console.log(`  Warnings: ${sqlValidation.warnings.join(', ')}`);
      }
    }
    
    // String validation (for XSS)
    const stringValidation = InputValidator.validateString(input);
    console.log(`  String Valid: ${stringValidation.isValid}`);
    if (!stringValidation.isValid) {
      console.log(`  String Errors: ${stringValidation.errors.join(', ')}`);
    }
    console.log(`  Sanitized: "${stringValidation.sanitized}"`);
    
    // Email validation
    if (input.includes('@')) {
      const emailValidation = InputValidator.validateEmail(input);
      console.log(`  Email Valid: ${emailValidation.isValid}`);
      if (!emailValidation.isValid) {
        console.log(`  Email Errors: ${emailValidation.errors.join(', ')}`);
      }
    }
  });

  // Demo 2: Authentication Manager
  console.log('\n\n🔐 Demo 2: Authentication and Authorization');
  console.log('==========================================');

  const authConfig = {
    jwtSecret: 'demo-secret-key',
    apiKeys: ['demo-api-key-123', 'another-api-key-456'],
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    maxFailedAttempts: 3,
    lockoutDuration: 5 * 60 * 1000, // 5 minutes
  };

  const authManager = new AuthenticationManager(authConfig);

  // Test valid authentication
  console.log('\nTesting valid authentication:');
  const validAuth = await authManager.authenticateUser('admin', 'admin123', '127.0.0.1');
  console.log(`  Success: ${validAuth.success}`);
  if (validAuth.success && validAuth.user) {
    console.log(`  User: ${validAuth.user.username} (${validAuth.user.role})`);
    console.log(`  Permissions: ${validAuth.user.permissions.join(', ')}`);
    console.log(`  Token: ${validAuth.token?.substring(0, 20)}...`);
  }

  // Test invalid authentication
  console.log('\nTesting invalid authentication:');
  const invalidAuth = await authManager.authenticateUser('admin', 'wrongpassword', '127.0.0.1');
  console.log(`  Success: ${invalidAuth.success}`);
  console.log(`  Error: ${invalidAuth.error}`);

  // Test API key authentication
  console.log('\nTesting API key authentication:');
  const apiKeyAuth = authManager.authenticateApiKey('demo-api-key-123');
  console.log(`  Success: ${apiKeyAuth.success}`);
  if (apiKeyAuth.success && apiKeyAuth.user) {
    console.log(`  User: ${apiKeyAuth.user.username} (${apiKeyAuth.user.role})`);
  }

  // Test invalid API key
  console.log('\nTesting invalid API key:');
  const invalidApiKey = authManager.authenticateApiKey('invalid-key');
  console.log(`  Success: ${invalidApiKey.success}`);
  console.log(`  Error: ${invalidApiKey.error}`);

  // Demo 3: Role-based Query Authorization
  console.log('\n\n👥 Demo 3: Role-based Query Authorization');
  console.log('=========================================');

  const testQueries = [
    "SELECT * FROM users",
    "INSERT INTO users (name, email) VALUES ('test', 'test@example.com')",
    "UPDATE users SET name = 'updated' WHERE id = 1",
    "DELETE FROM users WHERE id = 1",
    "DROP TABLE users",
    "ALTER TABLE users ADD COLUMN test VARCHAR(50)",
  ];

  const roles = ['admin', 'user', 'readonly'];
  
  for (const role of roles) {
    console.log(`\nTesting queries for ${role} role:`);
    const userAuth = await authManager.authenticateUser(role, `${role}123`, '127.0.0.1');
    
    if (userAuth.success && userAuth.user) {
      testQueries.forEach(query => {
        const queryCheck = authManager.isQueryAllowed(userAuth.user!, query);
        console.log(`  "${query.substring(0, 30)}..." - ${queryCheck.allowed ? '✅ ALLOWED' : '❌ DENIED'}`);
        if (!queryCheck.allowed) {
          console.log(`    Reason: ${queryCheck.reason}`);
        }
      });
    }
  }

  // Demo 4: Rate Limiting Simulation
  console.log('\n\n⏱️  Demo 4: Rate Limiting Simulation');
  console.log('====================================');

  console.log('Simulating multiple failed authentication attempts...');
  for (let i = 1; i <= 5; i++) {
    const result = await authManager.authenticateUser('admin', 'wrongpassword', '192.168.1.100');
    console.log(`  Attempt ${i}: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.error || 'OK'}`);
  }

  // Demo 5: WebSocket Message Validation
  console.log('\n\n📨 Demo 5: WebSocket Message Validation');
  console.log('=======================================');

  const testMessages = [
    { type: 'query', payload: { sql: 'SELECT * FROM users' } },
    { type: 'auth', payload: { username: 'admin', password: 'admin123' } },
    { type: 'ping', payload: { message: 'hello' } },
    { type: 'invalid', payload: {} }, // Invalid type
    { payload: { sql: 'SELECT 1' } }, // Missing type
    { type: 'query' }, // Missing payload
    { type: 'query', payload: { params: ['test'] } }, // Missing sql
  ];

  testMessages.forEach((message, index) => {
    console.log(`\nTesting message ${index + 1}:`, JSON.stringify(message));
    const validation = InputValidator.validateWebSocketMessage(message);
    console.log(`  Valid: ${validation.isValid}`);
    if (!validation.isValid) {
      console.log(`  Errors: ${validation.errors.join(', ')}`);
    }
    if (validation.sanitized) {
      console.log(`  Sanitized: ${JSON.stringify(validation.sanitized)}`);
    }
  });

  // Demo 6: Secure WebSocket Server (if requested)
  if (process.argv.includes('--websocket')) {
    console.log('\n\n🌐 Demo 6: Secure WebSocket Server');
    console.log('==================================');

    const dbClient = new PostgreSQLClient();
    const securityConfig = {
      ...authConfig,
      requireAuth: true,
      maxRequestsPerMinute: 10,
      allowedQueryTypes: ['SELECT'],
      enableAuditLog: true,
    };

    const server = new SecureWebSocketServer(dbClient, securityConfig);
    
    try {
      await server.start(8081);
      console.log('Secure WebSocket server started on port 8081');
      
      // Wait a bit then show stats
      setTimeout(() => {
        const stats = server.getStats();
        console.log('\nServer Statistics:');
        console.log(`  Connected clients: ${stats.connectedClients}`);
        console.log(`  Auth stats:`, stats.authStats);
        console.log(`  Audit log entries: ${stats.auditLogEntries}`);
        
        const auditLog = server.getAuditLog(5);
        console.log('\nRecent audit log entries:');
        auditLog.forEach(entry => {
          console.log(`  ${entry.timestamp.toISOString()} - ${entry.action} - ${entry.success ? 'SUCCESS' : 'FAILED'}`);
        });
        
        server.stop();
      }, 2000);
      
    } catch (error) {
      console.error('Failed to start secure server:', error);
    }
  }

  console.log('\n✅ Security demo completed successfully!');
  console.log('\nKey Security Features Demonstrated:');
  console.log('- ✅ Input validation and sanitization');
  console.log('- ✅ SQL injection prevention');
  console.log('- ✅ XSS protection');
  console.log('- ✅ Authentication (JWT, API key, username/password)');
  console.log('- ✅ Role-based authorization');
  console.log('- ✅ Rate limiting and lockout protection');
  console.log('- ✅ WebSocket message validation');
  console.log('- ✅ Audit logging');
  
  if (!process.argv.includes('--websocket')) {
    console.log('\nTo test the secure WebSocket server, run:');
    console.log('npx ts-node examples/security-demo.ts --websocket');
  }
}

// Handle command line arguments
const command = process.argv[2];

if (command === 'help' || command === '--help' || command === '-h') {
  console.log(`
Security Features Demo

Usage:
  npx ts-node examples/security-demo.ts [options]

Options:
  --websocket   Also start and test the secure WebSocket server
  help          Show this help message

Examples:
  npx ts-node examples/security-demo.ts
  npx ts-node examples/security-demo.ts --websocket
  npx ts-node examples/security-demo.ts help

This demo showcases:
- Input validation and sanitization
- SQL injection prevention
- XSS protection  
- Authentication methods (JWT, API key, username/password)
- Role-based authorization
- Rate limiting and account lockout
- WebSocket message validation
- Audit logging and monitoring
`);
  process.exit(0);
}

// Run the demo
if (require.main === module) {
  runSecurityDemo().catch(console.error);
}