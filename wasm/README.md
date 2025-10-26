# WASM Module Directory

This directory will contain the Rust source code for the WebAssembly module.

## Setup 

The WASM module will be created with the following structure:

```
wasm/
├── Cargo.toml          # Rust project configuration
├── src/
│   └── lib.rs          # Main Rust source file
└── pkg/                # Generated WASM output (after build)
```

## Prerequisites

- Rust toolchain
- wasm-pack

## Build Commands (to be implemented)

- `wasm-pack build --target web` - Build for web browsers
- `wasm-pack build --target nodejs` - Build for Node.js
