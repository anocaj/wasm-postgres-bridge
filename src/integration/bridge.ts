/**
 * WASM-WebSocket-Database bridge
 * Completed in task 6.1 - provides integration between WASM, WebSocket, and Database
 */

import { WebSocketMessage, BasicWebSocketServer } from '../websocket/server';
import { WasmModule } from '../wasm/loader';
import { DatabaseClient } from '../database/client';

export interface IntegrationBridge {
  connectWasmToDatabase(wasmModule: WasmModule, dbClient: DatabaseClient): Promise<void>;
  processWasmQuery(query: string): Promise<any>;
  cleanup(): Promise<void>;
}

export interface WasmIntegrationConfig {
  websocketPort: number;
  websocketUrl: string;
  connectionTimeout: number;
  maxRetries: number;
}

export class WasmDatabaseBridge implements IntegrationBridge {
  private wasmModule: WasmModule | null = null;
  private dbClient: DatabaseClient | null = null;
  private wsServer: BasicWebSocketServer | null = null;
  private wasmClient: any = null;
  private config: WasmIntegrationConfig;
  private isConnected: boolean = false;

  constructor(config: Partial<WasmIntegrationConfig> = {}) {
    this.config = {
      websocketPort: 8080,
      websocketUrl: 'ws://localhost:8080',
      connectionTimeout: 5000,
      maxRetries: 3,
      ...config
    };
  }

  async connectWasmToDatabase(wasmModule: WasmModule, dbClient: DatabaseClient): Promise<void> {
    try {
      this.wasmModule = wasmModule;
      this.dbClient = dbClient;

      // Ensure database is connected
      if (!dbClient) {
        throw new Error('Database client is required');
      }

      // Start WebSocket server if not already running
      if (!this.wsServer) {
        this.wsServer = new BasicWebSocketServer(dbClient);
        await this.wsServer.start(this.config.websocketPort);
      }

      // Create WASM WebSocket client
      if (wasmModule.WasmWebSocketClient) {
        this.wasmClient = new wasmModule.WasmWebSocketClient(this.config.websocketUrl);
        this.wasmClient.connect();
        
        // Wait for connection with timeout
        const connectionPromise = new Promise<void>((resolve, reject) => {
          const checkConnection = () => {
            if (this.wasmClient.is_connected()) {
              this.isConnected = true;
              resolve();
            } else {
              setTimeout(checkConnection, 100);
            }
          };
          checkConnection();
          setTimeout(() => reject(new Error('Connection timeout')), this.config.connectionTimeout);
        });

        await connectionPromise;
      } else {
        throw new Error('WASM module does not support WebSocket client functionality');
      }

    } catch (error) {
      throw new Error(`Failed to connect WASM to database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async processWasmQuery(query: string, params?: any[]): Promise<any> {
    if (!this.isConnected || !this.wasmClient) {
      throw new Error('WASM client not connected. Call connectWasmToDatabase first.');
    }

    return new Promise((resolve, reject) => {
      try {
        // Set up message handler for this query
        const messageHandler = (messageStr: string) => {
          try {
            const message = JSON.parse(messageStr);
            if (message.type === 'result') {
              resolve(message.payload);
            } else if (message.type === 'error') {
              reject(new Error(message.payload.message || 'Query failed'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error instanceof Error ? error.message : String(error)}`));
          }
        };

        this.wasmClient.set_message_handler(messageHandler);

        // Send query
        const paramsJson = params ? JSON.stringify(params) : undefined;
        const messageId = this.wasmClient.send_query(query, paramsJson);

        // Set timeout for query response
        setTimeout(() => {
          reject(new Error('Query timeout'));
        }, this.config.connectionTimeout);

      } catch (error) {
        reject(new Error(`Failed to process WASM query: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }

  async sendPing(message: string = 'ping'): Promise<string> {
    if (!this.isConnected || !this.wasmClient) {
      throw new Error('WASM client not connected');
    }

    return new Promise((resolve, reject) => {
      try {
        const messageHandler = (messageStr: string) => {
          try {
            const response = JSON.parse(messageStr);
            if (response.type === 'result' && response.payload.message === 'pong') {
              resolve(response.payload.echo || message);
            }
          } catch (error) {
            // Ignore parsing errors for ping
          }
        };

        this.wasmClient.set_message_handler(messageHandler);
        const messageId = this.wasmClient.send_ping(message);

        setTimeout(() => {
          reject(new Error('Ping timeout'));
        }, this.config.connectionTimeout);

      } catch (error) {
        reject(new Error(`Failed to send ping: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.sendPing('connection_test');
      return true;
    } catch (error) {
      return false;
    }
  }

  getConnectionStatus(): {
    isConnected: boolean;
    hasWasmModule: boolean;
    hasDatabase: boolean;
    hasWebSocketServer: boolean;
  } {
    return {
      isConnected: this.isConnected,
      hasWasmModule: this.wasmModule !== null,
      hasDatabase: this.dbClient !== null,
      hasWebSocketServer: this.wsServer !== null
    };
  }

  async cleanup(): Promise<void> {
    try {
      this.isConnected = false;

      if (this.wasmClient) {
        try {
          this.wasmClient.disconnect();
        } catch (error) {
          // Ignore cleanup errors
        }
        this.wasmClient = null;
      }

      if (this.wsServer) {
        await this.wsServer.stop();
        this.wsServer = null;
      }

      this.wasmModule = null;
      this.dbClient = null;

    } catch (error) {
      throw new Error(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Utility functions for integration testing
export class WasmIntegrationTester {
  private bridge: WasmDatabaseBridge;
  private testResults: Array<{
    testName: string;
    success: boolean;
    duration: number;
    error?: string;
  }> = [];

  constructor(config?: Partial<WasmIntegrationConfig>) {
    this.bridge = new WasmDatabaseBridge(config);
  }

  async runIntegrationTests(wasmModule: WasmModule, dbClient: DatabaseClient): Promise<{
    totalTests: number;
    passedTests: number;
    failedTests: number;
    results: Array<{
      testName: string;
      success: boolean;
      duration: number;
      error?: string;
    }>;
  }> {
    this.testResults = [];

    try {
      // Test 1: Connection
      await this.runTest('Connection Test', async () => {
        await this.bridge.connectWasmToDatabase(wasmModule, dbClient);
      });

      // Test 2: Ping
      await this.runTest('Ping Test', async () => {
        await this.bridge.sendPing('integration_test');
      });

      // Test 3: Simple Query
      await this.runTest('Simple Query Test', async () => {
        const result = await this.bridge.processWasmQuery("SELECT 'Integration Test' as message");
        if (!result.rows || result.rows.length === 0) {
          throw new Error('No rows returned');
        }
      });

      // Test 4: Parameterized Query
      await this.runTest('Parameterized Query Test', async () => {
        const result = await this.bridge.processWasmQuery(
          "SELECT $1 as param_value", 
          ['test_parameter']
        );
        if (result.rows[0].param_value !== 'test_parameter') {
          throw new Error('Parameter not processed correctly');
        }
      });

      // Test 5: Error Handling
      await this.runTest('Error Handling Test', async () => {
        try {
          await this.bridge.processWasmQuery("SELECT * FROM nonexistent_table");
          throw new Error('Expected query to fail');
        } catch (error) {
          // This is expected
          if (error instanceof Error && error.message === 'Expected query to fail') {
            throw error;
          }
        }
      });

    } finally {
      await this.bridge.cleanup();
    }

    const passedTests = this.testResults.filter(r => r.success).length;
    const failedTests = this.testResults.filter(r => !r.success).length;

    return {
      totalTests: this.testResults.length,
      passedTests,
      failedTests,
      results: this.testResults
    };
  }

  private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    try {
      await testFn();
      this.testResults.push({
        testName,
        success: true,
        duration: Date.now() - startTime
      });
    } catch (error) {
      this.testResults.push({
        testName,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}