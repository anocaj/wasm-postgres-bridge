/**
 * WebSocket communication tests
 * Tests basic WebSocket server functionality and message protocols
 */

import { BasicWebSocketServer, WebSocketMessage } from '../src/websocket/server';
import WebSocket from 'ws';

describe('WebSocket Communication', () => {
  let server: BasicWebSocketServer;
  const TEST_PORT = 8081; // Use different port to avoid conflicts

  beforeEach(() => {
    server = new BasicWebSocketServer();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  test('should start and stop WebSocket server', async () => {
    await server.start(TEST_PORT);
    expect(server.connectedClients).toBe(0);
    
    await server.stop();
  }, 10000);

  test('should handle client connections', async () => {
    await server.start(TEST_PORT);
    
    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    await new Promise<void>((resolve, reject) => {
      client.on('open', () => {
        expect(server.connectedClients).toBe(1);
        client.close();
        resolve();
      });
      
      client.on('error', reject);
      
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }, 10000);

  test('should handle ping messages', async () => {
    await server.start(TEST_PORT);
    
    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    await new Promise<void>((resolve, reject) => {
      let welcomeReceived = false;
      
      client.on('open', () => {
        const pingMessage: WebSocketMessage = {
          type: 'ping',
          payload: 'test ping',
          id: 'test-ping-1'
        };
        
        client.send(JSON.stringify(pingMessage));
      });
      
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (!welcomeReceived && message.id === 'welcome') {
          welcomeReceived = true;
          return;
        }
        
        if (message.id === 'test-ping-1') {
          expect(message.type).toBe('result');
          expect(message.payload.message).toBe('pong');
          expect(message.payload.echo).toBe('test ping');
          client.close();
          resolve();
        }
      });
      
      client.on('error', reject);
      
      setTimeout(() => reject(new Error('Message timeout')), 5000);
    });
  }, 10000);

  test('should handle query messages', async () => {
    await server.start(TEST_PORT);
    
    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    await new Promise<void>((resolve, reject) => {
      let welcomeReceived = false;
      
      client.on('open', () => {
        const queryMessage: WebSocketMessage = {
          type: 'query',
          payload: { sql: 'SELECT * FROM users' },
          id: 'test-query-1'
        };
        
        client.send(JSON.stringify(queryMessage));
      });
      
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (!welcomeReceived && message.id === 'welcome') {
          welcomeReceived = true;
          return;
        }
        
        if (message.id === 'test-query-1') {
          expect(message.type).toBe('result');
          expect(message.payload.sql).toBe('SELECT * FROM users');
          expect(Array.isArray(message.payload.rows)).toBe(true);
          expect(typeof message.payload.rowCount).toBe('number');
          client.close();
          resolve();
        }
      });
      
      client.on('error', reject);
      
      setTimeout(() => reject(new Error('Message timeout')), 5000);
    });
  }, 10000);

  test('should reject invalid messages', async () => {
    await server.start(TEST_PORT);
    
    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    await new Promise<void>((resolve, reject) => {
      let welcomeReceived = false;
      
      client.on('open', () => {
        // Send invalid message (missing type)
        client.send(JSON.stringify({ payload: 'test' }));
      });
      
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (!welcomeReceived && message.id === 'welcome') {
          welcomeReceived = true;
          return;
        }
        
        if (message.type === 'error') {
          expect(message.payload.message).toContain('type');
          expect(message.payload.code).toBe('PARSE_ERROR');
          client.close();
          resolve();
        }
      });
      
      client.on('error', reject);
      
      setTimeout(() => reject(new Error('Error message timeout')), 5000);
    });
  }, 10000);

  test('should reject dangerous SQL queries', async () => {
    await server.start(TEST_PORT);
    
    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    await new Promise<void>((resolve, reject) => {
      let welcomeReceived = false;
      
      client.on('open', () => {
        const dangerousQuery: WebSocketMessage = {
          type: 'query',
          payload: { sql: 'DROP TABLE users' },
          id: 'dangerous-query'
        };
        
        client.send(JSON.stringify(dangerousQuery));
      });
      
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (!welcomeReceived && message.id === 'welcome') {
          welcomeReceived = true;
          return;
        }
        
        if (message.id === 'dangerous-query') {
          expect(message.type).toBe('error');
          expect(message.payload.message).toContain('dangerous SQL keywords');
          client.close();
          resolve();
        }
      });
      
      client.on('error', reject);
      
      setTimeout(() => reject(new Error('Dangerous query test timeout')), 5000);
    });
  }, 10000);

  test('should broadcast messages to all clients', async () => {
    await server.start(TEST_PORT);
    
    const client1 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    const client2 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    await new Promise<void>((resolve, reject) => {
      let client1Ready = false;
      let client2Ready = false;
      let messagesReceived = 0;
      
      const checkReady = () => {
        if (client1Ready && client2Ready) {
          const broadcastMessage: WebSocketMessage = {
            type: 'result',
            payload: { message: 'Broadcast test' },
            id: 'broadcast-test'
          };
          
          server.broadcast(broadcastMessage);
        }
      };
      
      client1.on('open', () => {
        client1Ready = true;
        checkReady();
      });
      
      client2.on('open', () => {
        client2Ready = true;
        checkReady();
      });
      
      const handleMessage = (data: Buffer) => {
        const message = JSON.parse(data.toString());
        
        if (message.id === 'broadcast-test') {
          messagesReceived++;
          if (messagesReceived === 2) {
            client1.close();
            client2.close();
            resolve();
          }
        }
      };
      
      client1.on('message', handleMessage);
      client2.on('message', handleMessage);
      
      client1.on('error', reject);
      client2.on('error', reject);
      
      setTimeout(() => reject(new Error('Broadcast test timeout')), 10000);
    });
  }, 15000);
});