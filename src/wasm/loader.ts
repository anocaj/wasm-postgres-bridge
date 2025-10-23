/**
 * WASM module loading utilities
 * This will be implemented in task 4.3
 */

export interface WasmModule {
  add(a: number, b: number): number;
  process_string(input: string): string;
  send_query(query: string): Promise<string>;
}

export interface WasmLoader {
  loadModule(path: string): Promise<WasmModule>;
  isSupported(): boolean;
}

// Placeholder implementation - will be completed in task 4.3
export class BasicWasmLoader implements WasmLoader {
  async loadModule(path: string): Promise<WasmModule> {
    throw new Error('Not implemented yet - see task 4.3');
  }

  isSupported(): boolean {
    return typeof WebAssembly !== 'undefined';
  }
}