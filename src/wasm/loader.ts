/**
 * WASM module loading utilities
 * Provides cross-platform loading for both browser and Node.js environments
 */

// Conditional imports for Node.js environment
let path: any;
let fs: any;

if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  try {
    path = require('path');
    fs = require('fs');
  } catch (error) {
    // Ignore import errors in browser environment
  }
}

// Define the interface for our WASM module functions
export interface WasmModule {
  // Arithmetic functions
  add(a: number, b: number): number;
  subtract(a: number, b: number): number;
  multiply(a: number, b: number): number;
  divide(a: number, b: number): number;
  
  // String processing functions
  reverse_string(input: string): string;
  to_uppercase(input: string): string;
  count_words(input: string): number;
  process_string(input: string): string;
  
  // Array functions
  create_array(size: number): Int32Array;
  sum_array(arr: Int32Array): number;
  
  // Error handling demonstration
  safe_parse_int(input: string): number;
  
  // WebSocket functionality
  WasmWebSocketClient: any;
  create_websocket_client(url: string): any;
  wasm_query_database(websocket_url: string, sql: string, params_json?: string): any;
  
  // Initialization
  main(): void;
}

export interface WasmLoader {
  loadModule(path?: string): Promise<WasmModule>;
  isSupported(): boolean;
  getEnvironment(): 'browser' | 'node' | 'unknown';
}

// Environment detection utilities
export function isBrowser(): boolean {
  return typeof globalThis !== 'undefined' && 
         typeof (globalThis as any).window !== 'undefined' && 
         typeof (globalThis as any).window.document !== 'undefined';
}

export function isNode(): boolean {
  return typeof process !== 'undefined' && process.versions != null && process.versions.node != null;
}

export function isWebAssemblySupported(): boolean {
  return typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiate === 'function';
}

// Error classes for better error handling
export class WasmLoadError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'WasmLoadError';
  }
}

export class WasmUnsupportedError extends Error {
  constructor(message: string = 'WebAssembly is not supported in this environment') {
    super(message);
    this.name = 'WasmUnsupportedError';
  }
}

// Browser-specific WASM loader
export class BrowserWasmLoader implements WasmLoader {
  private wasmModule: WasmModule | null = null;

  async loadModule(wasmPath?: string): Promise<WasmModule> {
    if (!this.isSupported()) {
      throw new WasmUnsupportedError();
    }

    if (this.wasmModule) {
      return this.wasmModule;
    }

    try {
      // Use the web target package
      const wasmUrl = wasmPath || '/src/wasm/pkg/wasm_postgres_learning_bg.wasm';
      
      // Dynamic import of the generated JS module
      const wasmModule = await import('./pkg/wasm_postgres_learning.js');
      
      // Initialize the WASM module
      await wasmModule.default(wasmUrl);
      
      // Create our interface wrapper
      this.wasmModule = {
        add: wasmModule.add,
        subtract: wasmModule.subtract,
        multiply: wasmModule.multiply,
        divide: wasmModule.divide,
        reverse_string: wasmModule.reverse_string,
        to_uppercase: wasmModule.to_uppercase,
        count_words: wasmModule.count_words,
        process_string: wasmModule.process_string,
        create_array: wasmModule.create_array,
        sum_array: wasmModule.sum_array,
        safe_parse_int: wasmModule.safe_parse_int,
        WasmWebSocketClient: wasmModule.WasmWebSocketClient,
        create_websocket_client: wasmModule.create_websocket_client,
        wasm_query_database: wasmModule.wasm_query_database,
        main: wasmModule.main
      };

      // Call initialization
      this.wasmModule.main();
      
      return this.wasmModule;
    } catch (error) {
      throw new WasmLoadError(`Failed to load WASM module in browser: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
    }
  }

  isSupported(): boolean {
    return isBrowser() && isWebAssemblySupported();
  }

  getEnvironment(): 'browser' | 'node' | 'unknown' {
    return 'browser';
  }
}

// Node.js-specific WASM loader
export class NodeWasmLoader implements WasmLoader {
  private wasmModule: WasmModule | null = null;

  async loadModule(wasmPath?: string): Promise<WasmModule> {
    if (!this.isSupported()) {
      throw new WasmUnsupportedError();
    }

    if (this.wasmModule) {
      return this.wasmModule;
    }

    try {
      // Use the nodejs target package
      const modulePath = wasmPath || path.join(__dirname, 'pkg-node', 'wasm_postgres_learning.js');
      
      // Dynamic import of the Node.js generated module
      const wasmModule = await import('./pkg-node/wasm_postgres_learning.js');
      
      // Create our interface wrapper
      this.wasmModule = {
        add: wasmModule.add,
        subtract: wasmModule.subtract,
        multiply: wasmModule.multiply,
        divide: wasmModule.divide,
        reverse_string: wasmModule.reverse_string,
        to_uppercase: wasmModule.to_uppercase,
        count_words: wasmModule.count_words,
        process_string: wasmModule.process_string,
        create_array: wasmModule.create_array,
        sum_array: wasmModule.sum_array,
        safe_parse_int: wasmModule.safe_parse_int,
        WasmWebSocketClient: wasmModule.WasmWebSocketClient,
        create_websocket_client: wasmModule.create_websocket_client,
        wasm_query_database: wasmModule.wasm_query_database,
        main: wasmModule.main
      };

      // Call initialization
      this.wasmModule.main();
      
      return this.wasmModule;
    } catch (error) {
      throw new WasmLoadError(`Failed to load WASM module in Node.js: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined);
    }
  }

  isSupported(): boolean {
    return isNode() && isWebAssemblySupported();
  }

  getEnvironment(): 'browser' | 'node' | 'unknown' {
    return 'node';
  }
}

// Universal WASM loader that automatically detects environment
export class UniversalWasmLoader implements WasmLoader {
  private loader: WasmLoader;

  constructor() {
    if (isBrowser()) {
      this.loader = new BrowserWasmLoader();
    } else if (isNode()) {
      this.loader = new NodeWasmLoader();
    } else {
      throw new WasmUnsupportedError('Unknown environment - neither browser nor Node.js detected');
    }
  }

  async loadModule(path?: string): Promise<WasmModule> {
    return this.loader.loadModule(path);
  }

  isSupported(): boolean {
    return this.loader.isSupported();
  }

  getEnvironment(): 'browser' | 'node' | 'unknown' {
    return this.loader.getEnvironment();
  }
}

// Convenience function for easy loading
export async function loadWasmModule(path?: string): Promise<WasmModule> {
  const loader = new UniversalWasmLoader();
  return loader.loadModule(path);
}

// Function binding and parameter passing utilities
export class WasmFunctionBinder {
  constructor(private wasmModule: WasmModule) {}

  // Bind arithmetic functions with validation
  bindArithmetic() {
    return {
      add: (a: number, b: number): number => {
        this.validateNumber(a, 'first argument');
        this.validateNumber(b, 'second argument');
        return this.wasmModule.add(a, b);
      },
      
      subtract: (a: number, b: number): number => {
        this.validateNumber(a, 'first argument');
        this.validateNumber(b, 'second argument');
        return this.wasmModule.subtract(a, b);
      },
      
      multiply: (a: number, b: number): number => {
        this.validateNumber(a, 'first argument');
        this.validateNumber(b, 'second argument');
        return this.wasmModule.multiply(a, b);
      },
      
      divide: (a: number, b: number): number => {
        this.validateNumber(a, 'dividend');
        this.validateNumber(b, 'divisor');
        if (b === 0) {
          throw new Error('Division by zero is not allowed');
        }
        return this.wasmModule.divide(a, b);
      }
    };
  }

  // Bind string functions with validation
  bindStringFunctions() {
    return {
      reverse: (input: string): string => {
        this.validateString(input, 'input');
        return this.wasmModule.reverse_string(input);
      },
      
      toUppercase: (input: string): string => {
        this.validateString(input, 'input');
        return this.wasmModule.to_uppercase(input);
      },
      
      countWords: (input: string): number => {
        this.validateString(input, 'input');
        return this.wasmModule.count_words(input);
      },
      
      process: (input: string): string => {
        this.validateString(input, 'input');
        return this.wasmModule.process_string(input);
      }
    };
  }

  // Bind array functions with validation
  bindArrayFunctions() {
    return {
      createArray: (size: number): Int32Array => {
        this.validateNumber(size, 'size');
        if (size < 0) {
          throw new Error('Array size must be non-negative');
        }
        if (size > 1000000) {
          throw new Error('Array size too large (max: 1,000,000)');
        }
        return this.wasmModule.create_array(size);
      },
      
      sumArray: (arr: Int32Array): number => {
        if (!(arr instanceof Int32Array)) {
          throw new Error('Input must be an Int32Array');
        }
        return this.wasmModule.sum_array(arr);
      }
    };
  }

  // Bind utility functions
  bindUtilities() {
    return {
      parseIntSafe: (input: string): number => {
        this.validateString(input, 'input');
        try {
          return this.wasmModule.safe_parse_int(input);
        } catch (error) {
          throw new Error(`Failed to parse '${input}' as integer: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    };
  }

  // Get all bound functions
  bindAll() {
    return {
      arithmetic: this.bindArithmetic(),
      strings: this.bindStringFunctions(),
      arrays: this.bindArrayFunctions(),
      utilities: this.bindUtilities()
    };
  }

  private validateNumber(value: any, paramName: string): void {
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error(`${paramName} must be a valid number`);
    }
  }

  private validateString(value: any, paramName: string): void {
    if (typeof value !== 'string') {
      throw new Error(`${paramName} must be a string`);
    }
  }
}

// Export the main loader class for backward compatibility
export class BasicWasmLoader extends UniversalWasmLoader {}

// Performance monitoring utilities
export class WasmPerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  async measureFunction<T>(name: string, fn: () => T | Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.recordMetric(name, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name}_error`, duration);
      throw error;
    }
  }

  private recordMetric(name: string, duration: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);
  }

  getMetrics(name: string): { count: number; average: number; min: number; max: number } | null {
    const durations = this.metrics.get(name);
    if (!durations || durations.length === 0) {
      return null;
    }

    return {
      count: durations.length,
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations)
    };
  }

  getAllMetrics(): Record<string, { count: number; average: number; min: number; max: number }> {
    const result: Record<string, { count: number; average: number; min: number; max: number }> = {};
    for (const [name] of this.metrics) {
      const metrics = this.getMetrics(name);
      if (metrics) {
        result[name] = metrics;
      }
    }
    return result;
  }

  clearMetrics(): void {
    this.metrics.clear();
  }
}