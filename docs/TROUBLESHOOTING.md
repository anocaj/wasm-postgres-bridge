# Troubleshooting Guide

This guide covers common issues you might encounter while working with the WASM-PostgreSQL learning project and their solutions.

## Table of Contents

1. [Database Issues](#database-issues)
2. [WASM Build Issues](#wasm-build-issues)
3. [WebSocket Issues](#websocket-issues)
4. [Performance Issues](#performance-issues)
5. [Integration Issues](#integration-issues)
6. [Development Environment Issues](#development-environment-issues)
7. [Testing Issues](#testing-issues)
8. [Deployment Issues](#deployment-issues)

## Database Issues

### Connection Refused Errors

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
Error: Failed to connect to database: Connection refused
```

**Causes and Solutions:**

1. **PostgreSQL not running:**
   ```bash
   # Check if PostgreSQL container is running
   docker compose ps
   
   # Start PostgreSQL if not running
   docker compose up -d postgres
   
   # Check logs for startup issues
   docker compose logs postgres
   ```

2. **Wrong connection parameters:**
   ```bash
   # Verify environment variables
   cat .env
   
   # Test connection manually
   docker compose exec postgres psql -U postgres -d wasm_learning -c "SELECT 1;"
   ```

3. **Port conflicts:**
   ```bash
   # Check if port 5432 is in use
   lsof -i :5432
   
   # Use different port in docker-compose.yml if needed
   ports:
     - "5433:5432"  # Map to different host port
   ```

### Authentication Failures

**Symptoms:**
```
Error: password authentication failed for user "postgres"
Error: FATAL: database "wasm_learning" does not exist
```

**Solutions:**

1. **Reset database credentials:**
   ```bash
   # Stop and remove containers
   docker compose down -v
   
   # Recreate with fresh data
   docker compose up -d postgres
   
   # Wait for initialization
   sleep 10
   
   # Run setup script
   ./scripts/setup-db.sh
   ```

2. **Check environment variables:**
   ```bash
   # Verify .env file
   grep -E "^(DB_|DATABASE_)" .env
   
   # Test with explicit credentials
   PGPASSWORD=password psql -h localhost -U postgres -d wasm_learning -c "SELECT 1;"
   ```

### Query Execution Errors

**Symptoms:**
```
Error: relation "users" does not exist
Error: syntax error at or near "SELECT"
```

**Solutions:**

1. **Initialize database schema:**
   ```bash
   # Run schema initialization
   npx ts-node -e "
   import { PostgreSQLClient } from './src/database/client';
   const client = new PostgreSQLClient();
   await client.connect();
   await client.initializeSchema();
   console.log('Schema initialized');
   "
   ```

2. **Validate SQL syntax:**
   ```bash
   # Test query directly in PostgreSQL
   docker compose exec postgres psql -U postgres -d wasm_learning
   # Then run your query manually
   ```

## WASM Build Issues

### wasm-pack Not Found

**Symptoms:**
```
Error: wasm-pack: command not found
npm ERR! code ELIFECYCLE
```

**Solutions:**

1. **Install wasm-pack:**
   ```bash
   # Install via cargo
   cargo install wasm-pack
   
   # Or via npm (alternative)
   npm install -g wasm-pack
   
   # Verify installation
   wasm-pack --version
   ```

2. **Fix PATH issues:**
   ```bash
   # Add cargo bin to PATH
   echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
   source ~/.bashrc
   
   # Or for zsh
   echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

### Rust Compilation Errors

**Symptoms:**
```
error[E0432]: unresolved import `wasm_bindgen::prelude::*`
error: could not compile `wasm-postgres-learning`
```

**Solutions:**

1. **Update Rust toolchain:**
   ```bash
   # Update Rust
   rustup update
   
   # Add wasm32 target
   rustup target add wasm32-unknown-unknown
   
   # Verify targets
   rustup target list --installed
   ```

2. **Clean and rebuild:**
   ```bash
   # Clean Rust build cache
   cd wasm
   cargo clean
   
   # Clean npm WASM artifacts
   cd ..
   npm run clean:wasm
   
   # Rebuild
   npm run build:wasm
   ```

### WASM Module Loading Errors

**Symptoms:**
```
Error: WebAssembly module is not a valid module
TypeError: Cannot read property 'add' of undefined
```

**Solutions:**

1. **Check WASM file generation:**
   ```bash
   # Verify WASM files exist
   ls -la src/wasm/pkg/
   ls -la src/wasm/pkg-node/
   
   # Check file sizes (should not be 0 bytes)
   du -h src/wasm/pkg/*.wasm
   ```

2. **Browser compatibility:**
   ```javascript
   // Check WebAssembly support
   if (typeof WebAssembly === 'object') {
     console.log('WebAssembly is supported');
   } else {
     console.error('WebAssembly is not supported');
   }
   ```

3. **CORS issues in browser:**
   ```bash
   # Serve files via HTTP server (not file://)
   python3 -m http.server 8000
   # Then access: http://localhost:8000/examples/wasm-simple-demo.html
   ```

## WebSocket Issues

### Connection Failures

**Symptoms:**
```
WebSocket connection to 'ws://localhost:8080/' failed
Error: WebSocket is not open: readyState 3 (CLOSED)
```

**Solutions:**

1. **Check server status:**
   ```bash
   # Verify WebSocket server is running
   lsof -i :8080
   
   # Start server if not running
   npm run dev:websocket
   
   # Check server logs
   npm run dev:websocket 2>&1 | tee websocket.log
   ```

2. **Port conflicts:**
   ```bash
   # Find process using port 8080
   lsof -i :8080
   
   # Kill conflicting process
   kill -9 <PID>
   
   # Or use different port
   PORT=8081 npm run dev:websocket
   ```

3. **Firewall issues:**
   ```bash
   # Check if port is blocked (macOS)
   sudo pfctl -sr | grep 8080
   
   # Check if port is blocked (Linux)
   sudo iptables -L | grep 8080
   ```

### Message Handling Errors

**Symptoms:**
```
Error: Unexpected token in JSON at position 0
TypeError: Cannot read property 'type' of undefined
```

**Solutions:**

1. **Validate message format:**
   ```javascript
   // Add message validation
   ws.onmessage = (event) => {
     try {
       const message = JSON.parse(event.data);
       if (!message.type) {
         throw new Error('Message missing type field');
       }
       handleMessage(message);
     } catch (error) {
       console.error('Invalid message:', event.data, error);
     }
   };
   ```

2. **Debug message flow:**
   ```javascript
   // Add logging to both client and server
   console.log('Sending:', JSON.stringify(message));
   console.log('Received:', event.data);
   ```

## Performance Issues

### Slow Database Queries

**Symptoms:**
```
Query executed in 2500ms: SELECT * FROM users...
Warning: Slow query detected: 3000ms
```

**Solutions:**

1. **Check database indexes:**
   ```sql
   -- Connect to database
   docker compose exec postgres psql -U postgres -d wasm_learning
   
   -- Check existing indexes
   \di
   
   -- Analyze query performance
   EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
   
   -- Add index if needed
   CREATE INDEX idx_users_email ON users(email);
   ```

2. **Monitor connection pool:**
   ```typescript
   // Check pool statistics
   const stats = client.getPoolStats();
   console.log('Pool stats:', stats);
   
   // Adjust pool size if needed
   const client = new PostgreSQLClient({
     ...config,
     max: 30,  // Increase max connections
     idleTimeoutMillis: 60000  // Increase idle timeout
   });
   ```

3. **Enable query caching:**
   ```typescript
   const client = new PostgreSQLClient({
     ...config,
     enableCache: true,
     cacheMaxSize: 200,
     cacheTtlMs: 600000  // 10 minutes
   });
   ```

### High Memory Usage

**Symptoms:**
```
Warning: High memory usage: 512.3MB
Error: JavaScript heap out of memory
```

**Solutions:**

1. **Monitor memory usage:**
   ```bash
   # Check Node.js memory usage
   node -e "console.log(process.memoryUsage())"
   
   # Monitor continuously
   while true; do
     node -e "console.log(new Date(), process.memoryUsage())"
     sleep 5
   done
   ```

2. **Optimize cache size:**
   ```typescript
   // Reduce cache size
   const client = new PostgreSQLClient({
     ...config,
     cacheMaxSize: 50,  // Reduce from default 100
     cacheTtlMs: 300000  // Reduce TTL
   });
   
   // Clear cache periodically
   setInterval(() => {
     client.clearCache();
   }, 600000);  // Every 10 minutes
   ```

3. **Increase Node.js memory limit:**
   ```bash
   # Increase heap size
   node --max-old-space-size=4096 your-app.js
   
   # Or set environment variable
   export NODE_OPTIONS="--max-old-space-size=4096"
   ```

### Poor Cache Performance

**Symptoms:**
```
Cache hit rate: 15.2%
High cache miss rate: 84.8%
```

**Solutions:**

1. **Analyze cache usage:**
   ```typescript
   // Get detailed cache statistics
   const cacheStats = client.getCacheStats();
   console.log('Cache stats:', cacheStats);
   
   // Get performance metrics
   const metrics = client.getPerformanceMetrics();
   console.log('Performance metrics:', metrics);
   ```

2. **Optimize cache strategy:**
   ```typescript
   // Increase cache size for frequently accessed data
   const client = new PostgreSQLClient({
     ...config,
     cacheMaxSize: 500,
     cacheTtlMs: 1800000  // 30 minutes for stable data
   });
   ```

3. **Pre-warm cache:**
   ```typescript
   // Pre-load frequently accessed data
   async function preWarmCache() {
     await client.getAllUsers();
     await client.getAllPostsWithUsers();
     console.log('Cache pre-warmed');
   }
   ```

## Integration Issues

### WASM-WebSocket Communication Failures

**Symptoms:**
```
Error: Failed to send WebSocket message from WASM
TypeError: ws.send is not a function
```

**Solutions:**

1. **Check WASM WebSocket binding:**
   ```rust
   // Verify WebSocket is properly imported in Rust
   use web_sys::WebSocket;
   use wasm_bindgen::prelude::*;
   
   #[wasm_bindgen]
   pub fn test_websocket() -> Result<(), JsValue> {
       let ws = WebSocket::new("ws://localhost:8080")?;
       Ok(())
   }
   ```

2. **Debug message flow:**
   ```typescript
   // Add logging at each integration point
   console.log('WASM → WebSocket:', message);
   console.log('WebSocket → Database:', query);
   console.log('Database → WebSocket:', result);
   console.log('WebSocket → WASM:', response);
   ```

### Data Serialization Issues

**Symptoms:**
```
Error: Converting circular structure to JSON
TypeError: Cannot convert BigInt to JSON
```

**Solutions:**

1. **Handle special data types:**
   ```typescript
   // Custom JSON serializer
   function safeStringify(obj: any): string {
     return JSON.stringify(obj, (key, value) => {
       if (typeof value === 'bigint') {
         return value.toString();
       }
       if (value instanceof Date) {
         return value.toISOString();
       }
       return value;
     });
   }
   ```

2. **Validate data before serialization:**
   ```typescript
   function validateMessage(message: any): boolean {
     try {
       JSON.stringify(message);
       return true;
     } catch (error) {
       console.error('Invalid message:', error);
       return false;
     }
   }
   ```

## Development Environment Issues

### Node.js Version Conflicts

**Symptoms:**
```
Error: The engine "node" is incompatible with this module
npm ERR! peer dep missing
```

**Solutions:**

1. **Check Node.js version:**
   ```bash
   node --version
   npm --version
   
   # Should be Node.js v18 or higher
   ```

2. **Use Node Version Manager:**
   ```bash
   # Install nvm (if not installed)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   
   # Install and use Node.js 18
   nvm install 18
   nvm use 18
   
   # Set as default
   nvm alias default 18
   ```

### TypeScript Compilation Issues

**Symptoms:**
```
Error: Cannot find module '@types/node'
Error: Property 'memoryUsage' does not exist on type 'Process'
```

**Solutions:**

1. **Install missing type definitions:**
   ```bash
   npm install --save-dev @types/node @types/pg @types/ws
   ```

2. **Check TypeScript configuration:**
   ```bash
   # Verify tsconfig.json
   npx tsc --showConfig
   
   # Compile TypeScript manually
   npx tsc --noEmit
   ```

### Docker Issues

**Symptoms:**
```
Error: Cannot connect to the Docker daemon
Error: docker-compose: command not found
```

**Solutions:**

1. **Check Docker installation:**
   ```bash
   docker --version
   docker compose version
   
   # Start Docker daemon (macOS)
   open -a Docker
   
   # Start Docker daemon (Linux)
   sudo systemctl start docker
   ```

2. **Fix permission issues (Linux):**
   ```bash
   # Add user to docker group
   sudo usermod -aG docker $USER
   
   # Logout and login again, or run:
   newgrp docker
   ```

## Testing Issues

### Test Database Setup

**Symptoms:**
```
Error: Database "wasm_learning_test" does not exist
Error: Tests failing due to missing test data
```

**Solutions:**

1. **Create test database:**
   ```bash
   # Create test database
   docker compose exec postgres createdb -U postgres wasm_learning_test
   
   # Initialize test schema
   TEST_DATABASE_URL="postgresql://postgres:password@localhost:5432/wasm_learning_test" \
   npx ts-node -e "
   import { PostgreSQLClient } from './src/database/client';
   const client = new PostgreSQLClient();
   await client.connect();
   await client.initializeSchema();
   console.log('Test database initialized');
   "
   ```

2. **Use separate test configuration:**
   ```bash
   # Create .env.test file
   cp .env .env.test
   sed -i 's/wasm_learning/wasm_learning_test/g' .env.test
   ```

### Test Timeouts

**Symptoms:**
```
Error: Timeout of 5000ms exceeded
Jest did not exit one second after the test run completed
```

**Solutions:**

1. **Increase test timeouts:**
   ```javascript
   // In test files
   describe('Database tests', () => {
     jest.setTimeout(30000);  // 30 seconds
     
     test('slow query', async () => {
       // test code
     }, 15000);  // 15 seconds for this specific test
   });
   ```

2. **Fix resource cleanup:**
   ```javascript
   // Ensure proper cleanup in tests
   afterEach(async () => {
     await client.disconnect();
   });
   
   afterAll(async () => {
     await new Promise(resolve => setTimeout(resolve, 1000));
   });
   ```

## Deployment Issues

### Environment Configuration

**Symptoms:**
```
Error: Missing required environment variables
Error: Cannot connect to production database
```

**Solutions:**

1. **Validate environment variables:**
   ```bash
   # Check required variables
   node -e "
   const required = ['DATABASE_URL', 'NODE_ENV'];
   const missing = required.filter(key => !process.env[key]);
   if (missing.length) {
     console.error('Missing variables:', missing);
     process.exit(1);
   }
   console.log('Environment OK');
   "
   ```

2. **Use environment-specific configs:**
   ```typescript
   // config/database.ts
   export const getDatabaseConfig = () => {
     const env = process.env.NODE_ENV || 'development';
     
     switch (env) {
       case 'production':
         return {
           connectionString: process.env.DATABASE_URL,
           ssl: { rejectUnauthorized: false }
         };
       case 'test':
         return {
           connectionString: process.env.TEST_DATABASE_URL
         };
       default:
         return {
           host: 'localhost',
           port: 5432,
           database: 'wasm_learning'
         };
     }
   };
   ```

### Build Issues

**Symptoms:**
```
Error: Module not found: Can't resolve './pkg/wasm_postgres_learning'
Error: WASM files not found in production build
```

**Solutions:**

1. **Ensure WASM files are built:**
   ```bash
   # Build WASM before main build
   npm run build:wasm
   npm run build:wasm:node
   npm run build
   ```

2. **Include WASM files in build:**
   ```json
   // package.json
   {
     "files": [
       "dist/",
       "src/wasm/pkg/",
       "src/wasm/pkg-node/"
     ]
   }
   ```

## Getting Additional Help

### Diagnostic Commands

```bash
# Run comprehensive system check
node scripts/verify-setup.js

# Generate performance report
npx ts-node -e "
import { PostgreSQLClient } from './src/database/client';
const client = new PostgreSQLClient();
await client.connect();
console.log(client.generatePerformanceReport());
"

# Check all service status
docker compose ps
lsof -i :8080  # WebSocket server
lsof -i :5432  # PostgreSQL
```

### Log Analysis

```bash
# Collect all logs
mkdir -p logs
docker compose logs postgres > logs/postgres.log
npm run dev:websocket > logs/websocket.log 2>&1 &
npm test > logs/test.log 2>&1

# Analyze error patterns
grep -i error logs/*.log
grep -i "connection" logs/*.log
grep -i "timeout" logs/*.log
```

### Community Resources

- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **WebAssembly Documentation**: https://webassembly.org/
- **WebSocket API Reference**: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- **Node.js Documentation**: https://nodejs.org/docs/
- **Docker Documentation**: https://docs.docker.com/

### Reporting Issues

When reporting issues, please include:

1. **System information:**
   ```bash
   node --version
   npm --version
   docker --version
   rustc --version
   ```

2. **Error logs:**
   - Full error messages
   - Stack traces
   - Relevant log files

3. **Steps to reproduce:**
   - Exact commands run
   - Expected vs actual behavior
   - Environment configuration

4. **Configuration:**
   - `.env` file (without sensitive data)
   - `package.json` dependencies
   - Docker compose configuration