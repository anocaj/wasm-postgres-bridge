# WASM-PostgreSQL Learning Project

A step-by-step learning environment for WebAssembly (WASM) and PostgreSQL connections. This project is designed to help you understand the integration between WASM, WebSockets, and PostgreSQL through hands-on implementation.

## Project Structure

```
├── src/
│   ├── database/          # PostgreSQL client and operations
│   ├── websocket/         # WebSocket server and client
│   ├── wasm/              # WASM module loading utilities
│   ├── integration/       # WASM-WebSocket-Database bridge
│   └── index.ts           # Main entry point
├── tests/                 # Test files
├── scripts/               # Setup and utility scripts
├── wasm/                  # Rust WASM module (to be created)
└── examples/              # Example applications (to be created)
```

## Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose
- Rust (for WASM module development)

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   ```bash
   cp .env.example .env
   ```

3. **Start PostgreSQL database:**
   ```bash
   ./scripts/setup-db.sh
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

5. **Build the project:**
   ```bash
   npm run build
   ```

## Learning Path

This project follows a structured learning approach:

1. **Database Foundation** - Learn PostgreSQL operations and connection patterns
2. **WebSocket Communication** - Understand real-time bidirectional communication
3. **WASM Basics** - Create and load WebAssembly modules
4. **Integration** - Connect all components into a working system

## Development Commands

- `npm run dev` - Run development server
- `npm run build` - Build TypeScript to JavaScript
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run clean` - Clean build artifacts

## Database Management

- **Start database:** `docker-compose up -d postgres`
- **Stop database:** `docker-compose down`
- **Connect to database:** `docker-compose exec postgres psql -U postgres -d wasm_learning`
- **View logs:** `docker-compose logs postgres`

## Project Goals

By completing this project, you will learn:

- PostgreSQL connection patterns and query execution
- WebSocket server implementation and client communication
- WebAssembly compilation, loading, and JavaScript interoperability
- System integration and error handling
- Testing strategies for distributed systems

## Next Steps

1. Implement database client (Task 2.1)
2. Create WebSocket server (Task 3.1)
3. Build WASM module (Task 4.1)
4. Integrate all components (Task 5+)

## Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [WebAssembly Documentation](https://webassembly.org/)
- [Rust and WebAssembly Book](https://rustwasm.github.io/docs/book/)

## License

MIT License - see LICENSE file for details.