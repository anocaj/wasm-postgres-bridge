# Examples Directory

This directory contains example applications and demonstrations for the WASM PostgreSQL learning project.

## Available Examples

### WASM Examples

#### Node.js Demo
Run the comprehensive WASM demo in Node.js:

```bash
# Quick start (builds WASM and runs demo)
source "$HOME/.cargo/env" && npm run build:wasm:node && npx ts-node examples/wasm-demo.ts

# Or step by step:
npm run build:wasm:node  # Build WASM for Node.js
npx ts-node examples/wasm-demo.ts  # Run the demo
```

**Features:**
- Arithmetic operations (add, subtract, multiply, divide)
- String processing (reverse, uppercase, word count)
- Array operations (create, sum)
- Performance benchmarking
- Error handling demonstrations
- Console logging from WASM

#### Browser Demo
Run the interactive WASM demo in your browser:

```bash
# Easy way - use the setup script
./scripts/start-browser-demo.sh

# Manual way:
npm run build:wasm  # Build WASM for web
python3 -m http.server 8000  # Start HTTP server
# Then open: http://localhost:8000/examples/wasm-simple-demo.html
```

**Features:**
- Interactive web interface
- Real-time function testing
- Performance monitoring
- Console logging
- Error handling with user feedback

### Build Commands

```bash
# Build WASM for web (browser)
npm run build:wasm

# Build WASM for Node.js
npm run build:wasm:node

# Clean WASM build artifacts
npm run clean:wasm
```

### 🚀 **NEW: Complete Integration Examples**

#### WASM → WebSocket → Database Demo (Browser)
**File:** `wasm-websocket-database-demo.html`

A comprehensive browser-based demonstration of the complete integration:

```bash
# Start the WebSocket server first
npm run dev:websocket

# Then open the demo in browser
open examples/wasm-websocket-database-demo.html
```

**Features:**
- ✅ End-to-end WASM → WebSocket → PostgreSQL flow
- ✅ Interactive query builder with demo templates
- ✅ Real-time performance monitoring
- ✅ System status indicators
- ✅ Comprehensive error handling and logging
- ✅ Export functionality for logs and results

#### WASM Database CLI Demo (Node.js)
**File:** `wasm-database-cli-demo.ts`

A command-line demonstration of the complete integration:

```bash
# Run automated demo
npx ts-node examples/wasm-database-cli-demo.ts demo

# Run interactive mode
npx ts-node examples/wasm-database-cli-demo.ts interactive

# Show help
npx ts-node examples/wasm-database-cli-demo.ts help
```

**Features:**
- ✅ Automated testing of full WASM → WebSocket → Database flow
- ✅ Interactive mode for custom queries
- ✅ Performance benchmarking and metrics
- ✅ System status reporting
- ✅ Comprehensive error handling

## Integration Flow

The new examples demonstrate this complete architecture:

```
🦀 WASM Module (Rust)
    ↓ WebSocket Client
🔌 WebSocket Server (Node.js)
    ↓ Database Client
🐘 PostgreSQL Database
    ↓ Query Results
🔌 WebSocket Server
    ↓ Message Response
🦀 WASM Module
    ↓ Display Results
🌐 Browser/CLI Interface
```

## Completed Examples

- ✅ `wasm-functions/` - WASM function examples (Task 4) - **COMPLETED**
- ✅ `complete-flow/` - End-to-end integration examples (Task 6) - **COMPLETED**

## New Advanced Examples

### Performance Monitoring Demo (Node.js)
**File:** `performance-monitoring-demo.ts`

A comprehensive demonstration of the advanced performance monitoring features:

```bash
# Run the performance monitoring demo
npx ts-node examples/performance-monitoring-demo.ts

# Show help
npx ts-node examples/performance-monitoring-demo.ts help
```

**Features:**
- ✅ Query performance tracking and analysis
- ✅ Cache hit rate monitoring and optimization
- ✅ Connection pool utilization tracking
- ✅ Memory usage monitoring and alerts
- ✅ Automated health checks and reporting
- ✅ Stress testing and concurrent query handling
- ✅ Performance report generation

### Database Playground (Browser)
**File:** `database-playground.html`

An interactive web-based database query interface with real-time monitoring:

```bash
# Start the WebSocket server first
npm run dev:websocket

# Then open the playground in browser
open examples/database-playground.html
```

**Features:**
- ✅ Interactive SQL query builder with templates
- ✅ Real-time performance metrics display
- ✅ Query result visualization
- ✅ Activity logging and monitoring
- ✅ Connection status indicators
- ✅ Cache performance tracking

## Planned Examples

- `websocket-chat/` - WebSocket communication examples (Task 3)

## Troubleshooting

### WASM Build Issues
If you encounter WASM build errors:

1. Make sure Rust is installed:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source "$HOME/.cargo/env"
   ```

2. Install wasm-pack:
   ```bash
   cargo install wasm-pack
   ```

3. Rebuild the WASM module:
   ```bash
   npm run clean:wasm
   npm run build:wasm
   ```

### Browser Demo Issues
If the browser demo doesn't load:

1. Make sure you're serving the files through an HTTP server (not opening the HTML file directly)
2. Check that the WASM files were built: `ls -la src/wasm/pkg/`
3. Check the browser console for detailed error messages
4. Try the simple demo: `wasm-simple-demo.html`

### Node.js Demo Issues
If the Node.js demo fails:

1. Make sure TypeScript is available: `npm install -g ts-node typescript`
2. Check that Node.js WASM files were built: `ls -la src/wasm/pkg-node/`
3. Run with verbose output: `npx ts-node --transpile-only examples/wasm-demo.ts`