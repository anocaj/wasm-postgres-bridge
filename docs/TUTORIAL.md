# Complete WASM-PostgreSQL Learning Tutorial

This comprehensive tutorial will guide you through building a complete WebAssembly (WASM) to PostgreSQL integration system. You'll learn each component step-by-step, from basic database operations to advanced WASM integration.

## Table of Contents

1. [Prerequisites and Setup](#prerequisites-and-setup)
2. [Phase 1: Database Foundation](#phase-1-database-foundation)
3. [Phase 2: WebSocket Communication](#phase-2-websocket-communication)
4. [Phase 3: WASM Basics](#phase-3-wasm-basics)
5. [Phase 4: Integration](#phase-4-integration)
6. [Phase 5: Advanced Features](#phase-5-advanced-features)
7. [Performance Optimization](#performance-optimization)
8. [Troubleshooting](#troubleshooting)

## Prerequisites and Setup

### System Requirements

- **Node.js** v18 or higher
- **Docker** and Docker Compose
- **Rust** toolchain (for WASM development)
- **PostgreSQL** client tools (optional, for direct database access)

### Installation Steps

1. **Clone and setup the project:**
   ```bash
   git clone <repository-url>
   cd wasm-postgres-learning
   npm install
   ```

2. **Install Rust and WASM tools:**
   ```bash
   # Install Rust
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source "$HOME/.cargo/env"
   
   # Install wasm-pack
   cargo install wasm-pack
   ```

3. **Setup environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials if needed
   ```

4. **Start PostgreSQL database:**
   ```bash
   ./scripts/setup-db.sh
   ```

5. **Verify setup:**
   ```bash
   node scripts/verify-setup.js
   ```

## Phase 1: Database Foundation

### Understanding PostgreSQL Connection Patterns

The database client implements several key patterns:

#### 1. Connection Pooling
```typescript
// Connection pool configuration
const poolConfig: PoolConfig = {
  host: 'localhost',
  port: 5432,
  database: 'wasm_learning',
  user: 'postgres',
  password: 'password',
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Connection idle timeout
  connectionTimeoutMillis: 2000, // Connection timeout
};
```

#### 2. Query Execution with Error Handling
```typescript
async query<T>(sql: string, params?: any[]): Promise<T[]> {
  const client = await this.pool.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } catch (error) {
    throw new Error(`Query failed: ${error.message}`);
  } finally {
    client.release(); // Always release connection back to pool
  }
}
```

### Hands-on Exercise: Basic Database Operations

1. **Test database connection:**
   ```bash
   npx ts-node -e "
   import { PostgreSQLClient } from './src/database/client';
   const client = new PostgreSQLClient();
   client.connect().then(() => console.log('Connected!')).catch(console.error);
   "
   ```

2. **Run CRUD operations:**
   ```bash
   npm test -- tests/database.test.ts
   ```

3. **Explore the database schema:**
   ```bash
   docker compose exec postgres psql -U postgres -d wasm_learning -c "\dt"
   ```

### Key Learning Points

- **Connection pooling** prevents connection exhaustion
- **Parameterized queries** prevent SQL injection
- **Transaction management** ensures data consistency
- **Error handling** provides graceful failure recovery

## Phase 2: WebSocket Communication

### Understanding Real-time Communication

WebSockets enable bidirectional communication between client and server:

#### 1. Server Implementation
```typescript
// WebSocket server with message handling
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    const message = JSON.parse(data.toString());
    
    switch (message.type) {
      case 'query':
        const result = await database.query(message.sql, message.params);
        ws.send(JSON.stringify({ type: 'result', data: result, id: message.id }));
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', id: message.id }));
        break;
    }
  });
});
```

#### 2. Client Implementation
```javascript
// Browser WebSocket client
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  console.log('Connected to WebSocket server');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

// Send query to server
function sendQuery(sql, params = []) {
  const message = {
    type: 'query',
    sql,
    params,
    id: Date.now().toString()
  };
  ws.send(JSON.stringify(message));
}
```

### Hands-on Exercise: WebSocket Communication

1. **Start the WebSocket server:**
   ```bash
   npm run dev:websocket
   ```

2. **Test with browser client:**
   ```bash
   open src/websocket/client.html
   ```

3. **Run WebSocket tests:**
   ```bash
   npm test -- tests/websocket.test.ts
   ```

### Key Learning Points

- **Message protocols** structure communication
- **Connection lifecycle** management prevents resource leaks
- **Error handling** ensures robust communication
- **Bidirectional communication** enables real-time updates

## Phase 3: WASM Basics

### Understanding WebAssembly

WebAssembly (WASM) allows running compiled code in browsers and Node.js:

#### 1. Rust Source Code
```rust
// wasm/src/lib.rs
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[wasm_bindgen]
pub fn process_string(input: &str) -> String {
    input.to_uppercase()
}
```

#### 2. WASM Loading in JavaScript
```typescript
// src/wasm/loader.ts
export async function loadWasmModule() {
  const wasm = await import('./pkg/wasm_postgres_learning');
  return {
    add: wasm.add,
    process_string: wasm.process_string,
  };
}
```

#### 3. Browser Integration
```html
<!-- Browser WASM loading -->
<script type="module">
  import init, { add, process_string } from './src/wasm/pkg/wasm_postgres_learning.js';
  
  async function run() {
    await init();
    console.log('2 + 3 =', add(2, 3));
    console.log('Hello WASM:', process_string('hello wasm'));
  }
  
  run();
</script>
```

### Hands-on Exercise: WASM Development

1. **Build WASM module:**
   ```bash
   npm run build:wasm
   ```

2. **Test WASM in Node.js:**
   ```bash
   npx ts-node examples/wasm-demo.ts
   ```

3. **Test WASM in browser:**
   ```bash
   ./scripts/start-browser-demo.sh
   ```

4. **Run WASM tests:**
   ```bash
   npm test -- tests/wasm.test.ts
   ```

### Key Learning Points

- **Compilation** transforms Rust code to WASM bytecode
- **Binding generation** creates JavaScript interfaces
- **Memory management** requires careful handling
- **Performance** benefits from compiled code execution

## Phase 4: Integration

### Connecting All Components

The integration layer connects WASM, WebSocket, and Database:

#### 1. WASM WebSocket Client
```rust
// Enhanced WASM module with WebSocket capability
#[wasm_bindgen]
pub async fn send_database_query(query: &str) -> Result<String, JsValue> {
    let ws = WebSocket::new("ws://localhost:8080")?;
    
    let message = json!({
        "type": "query",
        "sql": query,
        "id": js_sys::Date::now().to_string()
    });
    
    ws.send_with_str(&message.to_string())?;
    
    // Wait for response (simplified)
    Ok("Query sent".to_string())
}
```

#### 2. Integration Bridge
```typescript
// src/integration/bridge.ts
export class WasmDatabaseBridge {
  private ws: WebSocket;
  private wasm: any;
  
  async initialize() {
    this.wasm = await loadWasmModule();
    this.ws = new WebSocket('ws://localhost:8080');
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleDatabaseResponse(message);
    };
  }
  
  async executeQuery(sql: string, params: any[] = []) {
    return this.wasm.send_database_query(sql);
  }
}
```

### Hands-on Exercise: Complete Integration

1. **Run the complete flow demo:**
   ```bash
   # Terminal 1: Start WebSocket server
   npm run dev:websocket
   
   # Terminal 2: Run CLI demo
   npx ts-node examples/wasm-database-cli-demo.ts demo
   ```

2. **Test browser integration:**
   ```bash
   # Start server
   npm run dev:websocket
   
   # Open browser demo
   open examples/wasm-websocket-database-demo.html
   ```

3. **Run integration tests:**
   ```bash
   npm test -- tests/integration.test.ts
   ```

### Key Learning Points

- **System architecture** requires careful component coordination
- **Error propagation** must work across all layers
- **Performance** depends on efficient data flow
- **Testing** validates the complete system behavior

## Phase 5: Advanced Features

### Performance Optimization

#### 1. Connection Pooling
```typescript
// Advanced pool configuration
const poolConfig = {
  max: 20,                    // Maximum connections
  min: 2,                     // Minimum connections
  idleTimeoutMillis: 30000,   // Idle timeout
  connectionTimeoutMillis: 2000, // Connection timeout
  acquireTimeoutMillis: 60000,   // Acquire timeout
};
```

#### 2. Query Result Caching
```typescript
// Intelligent caching system
class QueryCache {
  private cache = new Map<string, CacheEntry>();
  
  get(key: string): any[] | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.result;
  }
  
  set(key: string, result: any[], ttl: number = 300000) {
    this.cache.set(key, { result, timestamp: Date.now(), ttl });
  }
}
```

#### 3. Performance Monitoring
```typescript
// Comprehensive performance tracking
class PerformanceMonitor {
  recordQuery(duration: number) {
    this.metrics.queryCount++;
    this.metrics.totalTime += duration;
    
    if (duration > 1000) {
      this.metrics.slowQueries.push({
        duration,
        timestamp: Date.now()
      });
    }
  }
  
  generateReport() {
    return {
      averageQueryTime: this.metrics.totalTime / this.metrics.queryCount,
      slowQueryCount: this.metrics.slowQueries.length,
      cacheHitRate: this.calculateCacheHitRate()
    };
  }
}
```

### Security Features

#### 1. Input Validation
```typescript
// SQL injection prevention
function validateQuery(sql: string): boolean {
  const dangerousPatterns = [
    /;\s*(drop|delete|truncate|alter)\s+/i,
    /union\s+select/i,
    /--\s*$/,
    /\/\*.*\*\//
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(sql));
}
```

#### 2. Authentication
```typescript
// WebSocket authentication
function authenticateConnection(request: any): boolean {
  const token = request.headers.authorization;
  return validateToken(token);
}
```

### Hands-on Exercise: Advanced Features

1. **Test performance monitoring:**
   ```bash
   npx ts-node -e "
   import { PostgreSQLClient } from './src/database/client';
   const client = new PostgreSQLClient();
   await client.connect();
   
   // Run some queries
   for (let i = 0; i < 10; i++) {
     await client.getAllUsers();
   }
   
   console.log(client.generatePerformanceReport());
   "
   ```

2. **Test caching:**
   ```bash
   npm test -- tests/database.test.ts --grep "cache"
   ```

## Performance Optimization

### Database Optimization

1. **Connection Pool Tuning:**
   - Monitor pool utilization
   - Adjust max connections based on load
   - Set appropriate timeouts

2. **Query Optimization:**
   - Use indexes for frequently queried columns
   - Implement query result caching
   - Monitor slow queries

3. **Memory Management:**
   - Monitor heap usage
   - Implement cache size limits
   - Clean up old cache entries

### WASM Optimization

1. **Module Size:**
   - Use `wee_alloc` for smaller binary size
   - Enable optimization flags in Cargo.toml
   - Strip debug information

2. **Memory Usage:**
   - Minimize data copying between JS and WASM
   - Use efficient data structures
   - Implement proper cleanup

### WebSocket Optimization

1. **Message Batching:**
   - Combine multiple small messages
   - Implement message queuing
   - Use compression for large payloads

2. **Connection Management:**
   - Implement connection pooling
   - Handle reconnection gracefully
   - Monitor connection health

## Troubleshooting

### Common Issues and Solutions

#### Database Connection Issues

**Problem:** "Connection refused" errors
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solutions:**
1. Check if PostgreSQL is running: `docker compose ps`
2. Verify connection settings in `.env`
3. Restart database: `docker compose restart postgres`

#### WASM Build Issues

**Problem:** "wasm-pack not found"
```
Error: wasm-pack: command not found
```

**Solutions:**
1. Install wasm-pack: `cargo install wasm-pack`
2. Add cargo bin to PATH: `export PATH="$HOME/.cargo/bin:$PATH"`
3. Verify installation: `wasm-pack --version`

#### WebSocket Connection Issues

**Problem:** WebSocket connection fails in browser
```
WebSocket connection to 'ws://localhost:8080/' failed
```

**Solutions:**
1. Check if server is running: `npm run dev:websocket`
2. Verify port is not in use: `lsof -i :8080`
3. Check browser console for detailed errors

#### Performance Issues

**Problem:** Slow query performance
```
Query executed in 2500ms: SELECT * FROM users...
```

**Solutions:**
1. Check database indexes: `EXPLAIN ANALYZE SELECT ...`
2. Monitor connection pool: `client.getPoolStats()`
3. Enable query caching: `enableCache: true`

### Debugging Tips

1. **Enable verbose logging:**
   ```typescript
   const client = new PostgreSQLClient({
     ...config,
     enablePerformanceLogging: true
   });
   ```

2. **Monitor system resources:**
   ```bash
   # Check memory usage
   node -e "console.log(process.memoryUsage())"
   
   # Monitor database connections
   docker compose exec postgres psql -U postgres -d wasm_learning -c "SELECT * FROM pg_stat_activity;"
   ```

3. **Use performance profiling:**
   ```bash
   # Profile Node.js application
   node --prof your-app.js
   node --prof-process isolate-*.log > processed.txt
   ```

### Getting Help

1. **Check logs:**
   - Application logs: `npm run dev 2>&1 | tee app.log`
   - Database logs: `docker compose logs postgres`
   - Browser console: F12 → Console tab

2. **Run diagnostics:**
   ```bash
   node scripts/verify-setup.js
   npm run test:health
   ```

3. **Community resources:**
   - [PostgreSQL Documentation](https://www.postgresql.org/docs/)
   - [WebAssembly Documentation](https://webassembly.org/)
   - [WebSocket API Reference](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

## Next Steps

After completing this tutorial, you can:

1. **Extend the WASM module** with more complex operations
2. **Add authentication and authorization** to the WebSocket server
3. **Implement real-time notifications** using WebSocket subscriptions
4. **Deploy the system** to production environments
5. **Add monitoring and alerting** for production use

## Conclusion

You've now built a complete WASM-to-PostgreSQL integration system! This architecture demonstrates:

- **Modular design** with clear separation of concerns
- **Performance optimization** through caching and connection pooling
- **Error handling** across all system layers
- **Testing strategies** for complex integrations
- **Monitoring and debugging** capabilities

This foundation can be extended for real-world applications requiring high-performance database access from WebAssembly modules.