# Security Best Practices Guide

This document outlines the security features implemented in the WASM-PostgreSQL learning project and provides best practices for secure development.

## Table of Contents

1. [Security Features Overview](#security-features-overview)
2. [Authentication and Authorization](#authentication-and-authorization)
3. [Input Validation and Sanitization](#input-validation-and-sanitization)
4. [SQL Injection Prevention](#sql-injection-prevention)
5. [WebSocket Security](#websocket-security)
6. [Rate Limiting and DoS Protection](#rate-limiting-and-dos-protection)
7. [Audit Logging](#audit-logging)
8. [Configuration Security](#configuration-security)
9. [Production Deployment Security](#production-deployment-security)
10. [Security Testing](#security-testing)

## Security Features Overview

The project implements multiple layers of security:

- **Authentication**: JWT tokens, API keys, username/password
- **Authorization**: Role-based access control (RBAC)
- **Input Validation**: SQL injection prevention, XSS protection
- **Rate Limiting**: Request throttling and DoS protection
- **Audit Logging**: Comprehensive security event logging
- **Connection Security**: WebSocket connection verification
- **Data Sanitization**: Input/output sanitization

## Authentication and Authorization

### Authentication Methods

#### 1. JWT Token Authentication
```typescript
// Client-side authentication
const authMessage = {
  type: 'auth',
  payload: {
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }
};
ws.send(JSON.stringify(authMessage));
```

#### 2. API Key Authentication
```typescript
// API key authentication
const authMessage = {
  type: 'auth',
  payload: {
    apiKey: 'your-api-key-here'
  }
};
ws.send(JSON.stringify(authMessage));
```

#### 3. Username/Password Authentication
```typescript
// Username/password authentication
const authMessage = {
  type: 'auth',
  payload: {
    username: 'admin',
    password: 'admin123'
  }
};
ws.send(JSON.stringify(authMessage));
```

### Default User Accounts

For demonstration purposes, the following accounts are available:

| Username | Password | Role | Permissions |
|----------|----------|------|-------------|
| admin | admin123 | admin | read, write, delete, admin |
| user | user123 | user | read, write |
| readonly | readonly123 | readonly | read |

**⚠️ Important**: Change these default credentials in production!

### Role-Based Access Control

#### Admin Role
- Can execute any SQL query
- Full database access
- Can manage users and system settings

#### User Role
- Can execute SELECT, INSERT, UPDATE queries
- Cannot execute DROP, DELETE, TRUNCATE, ALTER queries
- Limited to safe operations

#### Readonly Role
- Can only execute SELECT queries
- No write access to database
- Ideal for reporting and analytics

### Permission Checking

```typescript
// Check if user has permission
const hasPermission = authManager.hasPermission(user, 'write');

// Check if query is allowed for user role
const queryCheck = authManager.isQueryAllowed(user, sql);
if (!queryCheck.allowed) {
  throw new Error(queryCheck.reason);
}
```

## Input Validation and Sanitization

### WebSocket Message Validation

All incoming WebSocket messages are validated:

```typescript
const validation = InputValidator.validateWebSocketMessage(data);
if (!validation.isValid) {
  // Reject message
  sendError('VALIDATION_ERROR', validation.errors.join(', '));
  return;
}
```

### String Input Sanitization

```typescript
// Validate and sanitize string input
const validation = InputValidator.validateString(userInput, 1000);
if (validation.isValid) {
  const sanitizedInput = validation.sanitized;
  // Use sanitized input
}
```

### XSS Prevention

The system automatically removes/escapes dangerous content:

- Script tags (`<script>`)
- Event handlers (`onclick`, `onload`, etc.)
- JavaScript URLs (`javascript:`)
- Iframe tags
- HTML entities are escaped

## SQL Injection Prevention

### Multi-Layer Protection

#### 1. Query Type Validation
```typescript
// Only allow specific query types
const allowedTypes = ['SELECT', 'INSERT', 'UPDATE'];
const validation = InputValidator.validateSQL(sql, allowedTypes);
```

#### 2. Pattern Detection
The system detects common injection patterns:
- Union-based injection (`UNION SELECT`)
- Comment-based injection (`--`, `/*`)
- Boolean-based injection (`OR 1=1`)
- Time-based injection (`SLEEP`, `WAITFOR`)

#### 3. Keyword Filtering
Dangerous keywords are blocked:
- `DROP`, `DELETE`, `TRUNCATE`, `ALTER`
- `EXEC`, `EXECUTE`, `SP_`
- System functions and procedures

#### 4. Parameterized Queries
Always use parameterized queries:

```typescript
// Safe - parameterized query
const result = await client.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

// Unsafe - string concatenation
const result = await client.query(
  `SELECT * FROM users WHERE id = ${userId}` // DON'T DO THIS
);
```

### SQL Validation Example

```typescript
const sqlValidation = InputValidator.validateSQL(
  "SELECT * FROM users WHERE name = 'test'",
  ['SELECT']
);

if (!sqlValidation.isValid) {
  console.log('Errors:', sqlValidation.errors);
  console.log('Warnings:', sqlValidation.warnings);
}
```

## WebSocket Security

### Connection Verification

```typescript
// Verify client before WebSocket upgrade
const wss = new WebSocketServer({
  server: httpServer,
  verifyClient: (info) => {
    // Implement origin validation, IP whitelisting, etc.
    return verifyClient(info);
  }
});
```

### Message Size Limits

- Maximum message size: 100KB
- Maximum query length: 10,000 characters
- Prevents DoS attacks via large payloads

### Connection Lifecycle Management

```typescript
// Automatic cleanup of inactive connections
setInterval(() => {
  cleanupInactiveClients();
}, 5 * 60 * 1000); // Every 5 minutes
```

## Rate Limiting and DoS Protection

### Request Rate Limiting

Each authenticated client is limited to:
- Maximum requests per minute: 60 (configurable)
- Failed authentication attempts: 5 per IP
- Lockout duration: 15 minutes after max attempts

### Implementation

```typescript
const securityConfig = {
  maxRequestsPerMinute: 60,
  maxFailedAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
};
```

### Query Complexity Limits

- Maximum query complexity score: 100
- Prevents resource-intensive queries
- Complexity based on joins, subqueries, functions

## Audit Logging

### Logged Events

All security-relevant events are logged:

- Authentication attempts (success/failure)
- Query executions
- Permission denials
- Connection events
- Validation failures

### Audit Log Format

```typescript
interface AuditLogEntry {
  timestamp: Date;
  clientId: string;
  userId?: string;
  action: string;
  details: any;
  success: boolean;
  error?: string;
}
```

### Log Retention

- In-memory: Last 1,000 entries
- Time-based: Last 24 hours
- Automatic cleanup of old entries

### Accessing Audit Logs

```typescript
// Get recent audit log entries
const recentLogs = server.getAuditLog(50);

// Get server statistics
const stats = server.getStats();
```

## Configuration Security

### Environment Variables

Store sensitive configuration in environment variables:

```bash
# .env file
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
JWT_SECRET=your-super-secret-jwt-key-here
API_KEYS=key1,key2,key3
NODE_ENV=production
```

### Security Configuration

```typescript
const securityConfig: SecurityConfig = {
  // Authentication
  jwtSecret: process.env.JWT_SECRET || 'default-secret',
  apiKeys: (process.env.API_KEYS || '').split(','),
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  
  // Rate limiting
  maxFailedAttempts: 5,
  lockoutDuration: 15 * 60 * 1000,
  maxRequestsPerMinute: 60,
  
  // Query restrictions
  allowedQueryTypes: ['SELECT', 'INSERT', 'UPDATE'],
  
  // Features
  requireAuth: true,
  enableAuditLog: true,
};
```

## Production Deployment Security

### HTTPS/WSS

Always use secure connections in production:

```typescript
// Use WSS (WebSocket Secure) in production
const protocol = process.env.NODE_ENV === 'production' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${protocol}//your-domain.com/ws`);
```

### Database Security

1. **Connection Security**:
   ```typescript
   const dbConfig = {
     connectionString: process.env.DATABASE_URL,
     ssl: process.env.NODE_ENV === 'production' ? {
       rejectUnauthorized: false
     } : false
   };
   ```

2. **Connection Pooling**:
   ```typescript
   const poolConfig = {
     max: 20,                    // Maximum connections
     idleTimeoutMillis: 30000,   // 30 seconds
     connectionTimeoutMillis: 2000, // 2 seconds
   };
   ```

### Reverse Proxy Configuration

Use nginx or similar for additional security:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    # SSL configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # WebSocket proxy
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Environment Hardening

1. **Process User**: Run as non-root user
2. **File Permissions**: Restrict file access
3. **Network**: Use firewalls and security groups
4. **Monitoring**: Implement security monitoring
5. **Updates**: Keep dependencies updated

## Security Testing

### Manual Testing

#### 1. Authentication Testing
```bash
# Test invalid credentials
curl -X POST http://localhost:8080/auth \
  -H "Content-Type: application/json" \
  -d '{"username":"invalid","password":"wrong"}'

# Test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:8080/auth \
    -H "Content-Type: application/json" \
    -d '{"username":"invalid","password":"wrong"}'
done
```

#### 2. SQL Injection Testing
```javascript
// Test SQL injection attempts
const maliciousQueries = [
  "SELECT * FROM users; DROP TABLE users;--",
  "SELECT * FROM users WHERE id = 1 OR 1=1",
  "SELECT * FROM users UNION SELECT * FROM passwords",
  "SELECT * FROM users WHERE name = 'admin'--"
];

maliciousQueries.forEach(query => {
  ws.send(JSON.stringify({
    type: 'query',
    payload: { sql: query }
  }));
});
```

#### 3. XSS Testing
```javascript
// Test XSS payloads
const xssPayloads = [
  "<script>alert('xss')</script>",
  "javascript:alert('xss')",
  "<iframe src='javascript:alert(1)'></iframe>",
  "<img onerror='alert(1)' src='x'>"
];
```

### Automated Security Testing

#### 1. Dependency Scanning
```bash
# Check for vulnerable dependencies
npm audit

# Fix vulnerabilities
npm audit fix
```

#### 2. Static Code Analysis
```bash
# Install security linter
npm install -g eslint-plugin-security

# Run security checks
eslint --ext .ts src/ --config .eslintrc-security.js
```

#### 3. Integration Tests
```typescript
// Security integration tests
describe('Security Tests', () => {
  test('should reject SQL injection attempts', async () => {
    const maliciousSQL = "SELECT * FROM users; DROP TABLE users;--";
    const result = await client.query(maliciousSQL);
    expect(result).toThrow('SQL injection detected');
  });
  
  test('should enforce rate limiting', async () => {
    // Make many requests quickly
    const promises = Array(100).fill(0).map(() => 
      client.query('SELECT 1')
    );
    
    await expect(Promise.all(promises)).rejects.toThrow('Rate limit exceeded');
  });
});
```

## Security Checklist

### Development
- [ ] Input validation on all user inputs
- [ ] Parameterized queries for database access
- [ ] Authentication required for sensitive operations
- [ ] Role-based access control implemented
- [ ] Rate limiting configured
- [ ] Audit logging enabled
- [ ] Error messages don't leak sensitive information
- [ ] Dependencies regularly updated

### Testing
- [ ] SQL injection tests pass
- [ ] XSS protection tests pass
- [ ] Authentication bypass tests fail
- [ ] Rate limiting tests pass
- [ ] Authorization tests pass
- [ ] Input validation tests pass

### Production
- [ ] HTTPS/WSS enabled
- [ ] Strong JWT secrets configured
- [ ] Default credentials changed
- [ ] Database connections secured
- [ ] Reverse proxy configured
- [ ] Monitoring and alerting setup
- [ ] Regular security updates applied
- [ ] Backup and recovery tested

## Incident Response

### Security Incident Handling

1. **Detection**: Monitor audit logs for suspicious activity
2. **Containment**: Block malicious IPs, disable compromised accounts
3. **Investigation**: Analyze logs, determine scope of breach
4. **Recovery**: Restore from backups, patch vulnerabilities
5. **Lessons Learned**: Update security measures, improve monitoring

### Emergency Procedures

```bash
# Block suspicious IP
iptables -A INPUT -s MALICIOUS_IP -j DROP

# Disable user account
# Update user set active = false where username = 'compromised_user';

# Rotate JWT secrets
export JWT_SECRET="new-secret-key"
systemctl restart your-app

# Check for unauthorized access
grep "authentication" /var/log/your-app.log | grep "FAILED"
```

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [WebSocket Security](https://devcenter.heroku.com/articles/websocket-security)

Remember: Security is an ongoing process, not a one-time implementation. Regularly review and update your security measures as threats evolve.