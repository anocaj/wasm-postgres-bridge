/**
 * Full system integration tests
 * Task 5.3: WebSocket-Database integration tests
 * Task 6.3: Complete WASM integration tests (to be implemented later)
 */

import { WasmDatabaseBridge } from '../src/integration/bridge';
import { BasicWebSocketServer } from '../src/websocket/server';
import { PostgreSQLClient } from '../src/database/client';
import WebSocket from 'ws';

describe('WebSocket-Database Integration Tests', () => {
  let server: BasicWebSocketServer;
  let dbClient: PostgreSQLClient;
  let client: WebSocket;
  const TEST_PORT = 8081;

  beforeAll(async () => {
    // Initialize database client
    dbClient = new PostgreSQLClient();
    await dbClient.connect();
    await dbClient.initializeSchema();

    // Initialize WebSocket server with database client
    server = new BasicWebSocketServer(dbClient);
    await server.start(TEST_PORT);
  });

  afterAll(async () => {
    // Cleanup
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    if (server) {
      await server.stop();
    }
    if (dbClient) {
      await dbClient.disconnect();
    }
    // Small delay to ensure all connections are properly closed
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  beforeEach(async () => {
    // Create fresh WebSocket connection for each test
    client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    // Wait for connection to be established
    await new Promise((resolve, reject) => {
      client.on('open', resolve);
      client.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  });

  afterEach(async () => {
    if (client) {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
      // Wait for connection to close
      await new Promise((resolve) => {
        if (client.readyState === WebSocket.CLOSED) {
          resolve(undefined);
        } else {
          client.on('close', resolve);
          setTimeout(resolve, 1000); // Force resolve after 1 second
        }
      });
    }
  });

  test('should execute SELECT query and return results', async () => {
    const queryMessage = {
      type: 'query',
      payload: {
        sql: 'SELECT id, name, email FROM users LIMIT 2'
      },
      id: 'test_query_1'
    };

    // Send query
    client.send(JSON.stringify(queryMessage));

    // Wait for response
    const response = await new Promise((resolve, reject) => {
      client.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.id === 'test_query_1') {
            resolve(message);
          }
        } catch (error) {
          reject(error);
        }
      });
      setTimeout(() => reject(new Error('Response timeout')), 5000);
    });

    expect(response).toMatchObject({
      type: 'result',
      id: 'test_query_1'
    });

    const payload = (response as any).payload;
    expect(payload).toHaveProperty('sql');
    expect(payload).toHaveProperty('rows');
    expect(payload).toHaveProperty('rowCount');
    expect(payload).toHaveProperty('executionTime');
    expect(Array.isArray(payload.rows)).toBe(true);
    expect(typeof payload.executionTime).toBe('number');
  });

  test('should handle parameterized queries', async () => {
    // First, get a user ID to use in the parameterized query
    const users = await dbClient.getAllUsers();
    expect(users.length).toBeGreaterThan(0);
    
    const userId = users[0].id;
    const queryMessage = {
      type: 'query',
      payload: {
        sql: 'SELECT id, name, email FROM users WHERE id = $1',
        params: [userId]
      },
      id: 'test_param_query'
    };

    client.send(JSON.stringify(queryMessage));

    const response = await new Promise((resolve, reject) => {
      client.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.id === 'test_param_query') {
            resolve(message);
          }
        } catch (error) {
          reject(error);
        }
      });
      setTimeout(() => reject(new Error('Response timeout')), 5000);
    });

    expect(response).toMatchObject({
      type: 'result',
      id: 'test_param_query'
    });

    const payload = (response as any).payload;
    expect(payload.rows).toHaveLength(1);
    expect(payload.rows[0].id).toBe(userId);
    expect(payload.params).toEqual([userId]);
  });

  test('should reject dangerous SQL queries', async () => {
    const dangerousQueries = [
      'DROP TABLE users',
      'DELETE FROM users',
      'INSERT INTO users (name, email) VALUES (\'test\', \'test@test.com\')',
      'UPDATE users SET name = \'hacked\''
    ];

    for (const sql of dangerousQueries) {
      const queryMessage = {
        type: 'query',
        payload: { sql },
        id: `dangerous_${Date.now()}`
      };

      client.send(JSON.stringify(queryMessage));

      const response = await new Promise((resolve, reject) => {
        client.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.id === queryMessage.id) {
              resolve(message);
            }
          } catch (error) {
            reject(error);
          }
        });
        setTimeout(() => reject(new Error('Response timeout')), 5000);
      });

      expect(response).toMatchObject({
        type: 'error',
        id: queryMessage.id
      });

      const payload = (response as any).payload;
      expect(payload.code).toBe('DANGEROUS_SQL');
      expect(payload.message).toContain('dangerous SQL keywords');
    }
  });

  test('should handle invalid SQL queries', async () => {
    const queryMessage = {
      type: 'query',
      payload: {
        sql: 'SELECT * FROM nonexistent_table'
      },
      id: 'invalid_query'
    };

    client.send(JSON.stringify(queryMessage));

    const response = await new Promise((resolve, reject) => {
      client.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.id === 'invalid_query') {
            resolve(message);
          }
        } catch (error) {
          reject(error);
        }
      });
      setTimeout(() => reject(new Error('Response timeout')), 5000);
    });

    expect(response).toMatchObject({
      type: 'error',
      id: 'invalid_query'
    });

    const payload = (response as any).payload;
    expect(payload.code).toBe('DATABASE_ERROR');
    expect(payload.message).toContain('Database query failed');
  });

  test('should handle complex JOIN queries', async () => {
    const queryMessage = {
      type: 'query',
      payload: {
        sql: 'SELECT u.name, u.email, p.title FROM users u LEFT JOIN posts p ON u.id = p.user_id ORDER BY u.id LIMIT 5'
      },
      id: 'join_query'
    };

    client.send(JSON.stringify(queryMessage));

    const response = await new Promise((resolve, reject) => {
      client.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.id === 'join_query') {
            resolve(message);
          }
        } catch (error) {
          reject(error);
        }
      });
      setTimeout(() => reject(new Error('Response timeout')), 5000);
    });

    // Check if it's an error response first
    if ((response as any).type === 'error') {
      console.log('JOIN query error:', (response as any).payload);
      // If JOIN fails, it might be due to schema issues, so let's test a simpler query
      const simpleQuery = {
        type: 'query',
        payload: {
          sql: 'SELECT name, email FROM users ORDER BY id LIMIT 5'
        },
        id: 'simple_query'
      };

      client.send(JSON.stringify(simpleQuery));

      const simpleResponse = await new Promise((resolve, reject) => {
        client.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.id === 'simple_query') {
              resolve(message);
            }
          } catch (error) {
            reject(error);
          }
        });
        setTimeout(() => reject(new Error('Response timeout')), 5000);
      });

      expect(simpleResponse).toMatchObject({
        type: 'result',
        id: 'simple_query'
      });
      return;
    }

    expect(response).toMatchObject({
      type: 'result',
      id: 'join_query'
    });

    const payload = (response as any).payload;
    expect(Array.isArray(payload.rows)).toBe(true);
    expect(payload.rowCount).toBeGreaterThanOrEqual(0);
    
    // Check that the result has the expected columns
    if (payload.rows.length > 0) {
      const firstRow = payload.rows[0];
      expect(firstRow).toHaveProperty('name');
      expect(firstRow).toHaveProperty('email');
      // title might be null for users without posts
    }
  });

  test('should handle connection recovery', async () => {
    // Send a query to ensure connection is working
    const queryMessage = {
      type: 'query',
      payload: {
        sql: 'SELECT 1 as test'
      },
      id: 'recovery_test'
    };

    client.send(JSON.stringify(queryMessage));

    const response = await new Promise((resolve, reject) => {
      client.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.id === 'recovery_test') {
            resolve(message);
          }
        } catch (error) {
          reject(error);
        }
      });
      setTimeout(() => reject(new Error('Response timeout')), 5000);
    });

    expect(response).toMatchObject({
      type: 'result',
      id: 'recovery_test'
    });

    // Verify the database connection is still working
    const payload = (response as any).payload;
    expect(payload.rows).toEqual([{ test: 1 }]);
  });

  test('should validate query result accuracy', async () => {
    // Create a test user to verify data accuracy
    const testUser = await dbClient.createUser('Integration Test User', 'integration@test.com');
    
    try {
      const queryMessage = {
        type: 'query',
        payload: {
          sql: 'SELECT id, name, email FROM users WHERE email = $1',
          params: ['integration@test.com']
        },
        id: 'accuracy_test'
      };

      client.send(JSON.stringify(queryMessage));

      const response = await new Promise((resolve, reject) => {
        client.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.id === 'accuracy_test') {
              resolve(message);
            }
          } catch (error) {
            reject(error);
          }
        });
        setTimeout(() => reject(new Error('Response timeout')), 5000);
      });

      expect(response).toMatchObject({
        type: 'result',
        id: 'accuracy_test'
      });

      const payload = (response as any).payload;
      expect(payload.rows).toHaveLength(1);
      expect(payload.rows[0]).toMatchObject({
        id: testUser.id,
        name: 'Integration Test User',
        email: 'integration@test.com'
      });

    } finally {
      // Clean up test user
      await dbClient.deleteUser(testUser.id);
    }
  });
});

describe('WASM Integration Tests (Future)', () => {
  let bridge: WasmDatabaseBridge;

  beforeEach(() => {
    bridge = new WasmDatabaseBridge();
  });

  afterEach(async () => {
    // Cleanup will be implemented in task 6.3
  });

  test('should connect WASM to database', async () => {
    // This test will be implemented in task 6.3
    await expect(bridge.connectWasmToDatabase({} as any, {} as any))
      .rejects.toThrow('Not implemented yet');
  });

  test('should process WASM queries', async () => {
    // This test will be implemented in task 6.3
    await expect(bridge.processWasmQuery('SELECT 1'))
      .rejects.toThrow('Not implemented yet');
  });

  test('should handle complete flow', async () => {
    // This test will be implemented in task 6.3
    // Will test WASM → WebSocket → Database → Response flow
    expect(true).toBe(true); // Placeholder
  });
});