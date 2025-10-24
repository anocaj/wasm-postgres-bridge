#!/bin/bash

# Script to build WASM and start browser demo

echo "🚀 Starting WASM Browser Demo Setup..."

# Check if Rust is available
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust/Cargo not found. Please install Rust first."
    echo "Run: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Source Rust environment
source "$HOME/.cargo/env" 2>/dev/null || true

# Build WASM module for web
echo "📦 Building WASM module for web..."
npm run build:wasm

if [ $? -ne 0 ]; then
    echo "❌ Failed to build WASM module"
    exit 1
fi

echo "✅ WASM module built successfully!"

# Check if we have a simple HTTP server available
if command -v python3 &> /dev/null; then
    echo "🌐 Starting Python HTTP server on port 8000..."
    echo "📱 Open your browser and go to: http://localhost:8000/examples/wasm-simple-demo.html"
    echo "🛑 Press Ctrl+C to stop the server"
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "🌐 Starting Python HTTP server on port 8000..."
    echo "📱 Open your browser and go to: http://localhost:8000/examples/wasm-simple-demo.html"
    echo "🛑 Press Ctrl+C to stop the server"
    python -m SimpleHTTPServer 8000
elif command -v npx &> /dev/null; then
    echo "🌐 Starting Node.js HTTP server on port 8000..."
    echo "📱 Open your browser and go to: http://localhost:8000/examples/wasm-simple-demo.html"
    echo "🛑 Press Ctrl+C to stop the server"
    npx http-server -p 8000
else
    echo "❌ No HTTP server found. Please install Python or Node.js to serve the files."
    echo "Alternatively, you can use any static file server to serve the current directory on port 8000"
    echo "Then open: http://localhost:8000/examples/wasm-simple-demo.html"
    exit 1
fi