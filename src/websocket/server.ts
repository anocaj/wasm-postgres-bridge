import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';

/**
 * WebSocket server for real-time communication
 * Implements basic WebSocket functionality with connection handling and message parsing
 */

export interface WebSocketMessage {
  type: 'query' | 'result' | 'error' | 'ping';
  payload: any;
  id?: string;
}

export interface WebSocketServer {
  start(port: number): Promise<void>;
  broadcast(message: WebSocketMessage): void;
  stop(): Promise<void>;
}

export class BasicWebSocketServer implements WebSocketServer {
  private wss: WSServer | null = null;
  private httpServer: Server | null = null;
  private clients: Set<WebSocket> = new Set();

  async start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server for WebSocket upgrade
        this.httpServer = createServer();
        
        // Create WebSocket server
        this.wss = new WSServer({ server: this.httpServer });

        // Handle WebSocket connections
        this.wss.on('connection', (ws: WebSocket, request) => {
          const clientId = this.generateClientId();
          console.log(`[WebSocket] New connection established: ${clientId} from ${request.socket.remoteAddress}`);
          
          // Add client to active connections
          this.clients.add(ws);

          // Handle incoming messages
          ws.on('message', (data: Buffer) => {
            try {
              const message = this.parseMessage(data);
              console.log(`[WebSocket] Received message from ${clientId}:`, message);
              
              // Process message based on type
              this.handleMessage(ws, message, clientId);
            } catch (error) {
              console.error(`[WebSocket] Error parsing message from ${clientId}:`, error);
              this.sendToClient(ws, {
                type: 'error',
                payload: { 
                  message: error instanceof Error ? error.message : 'Invalid message format',
                  code: 'PARSE_ERROR'
                },
                id: undefined
              });
            }
          });

          // Handle connection close
          ws.on('close', (code: number, reason: Buffer) => {
            console.log(`[WebSocket] Connection closed: ${clientId}, code: ${code}, reason: ${reason.toString()}`);
            this.clients.delete(ws);
          });

          // Handle connection errors
          ws.on('error', (error: Error) => {
            console.error(`[WebSocket] Connection error for ${clientId}:`, error);
            this.clients.delete(ws);
          });

          // Send welcome message
          this.sendToClient(ws, {
            type: 'result',
            payload: { message: 'Connected to WebSocket server', clientId },
            id: 'welcome'
          });
        });

        // Handle server errors
        this.wss.on('error', (error: Error) => {
          console.error('[WebSocket] Server error:', error);
          reject(error);
        });

        // Start HTTP server
        this.httpServer.listen(port, () => {
          console.log(`[WebSocket] Server started on port ${port}`);
          resolve();
        });

        this.httpServer.on('error', (error: Error) => {
          console.error('[WebSocket] HTTP server error:', error);
          reject(error);
        });

      } catch (error) {
        console.error('[WebSocket] Failed to start server:', error);
        reject(error);
      }
    });
  }

  broadcast(message: WebSocketMessage): void {
    console.log(`[WebSocket] Broadcasting message to ${this.clients.size} clients:`, message);
    
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        this.sendToClient(client, message);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      console.log('[WebSocket] Stopping server...');
      
      // Close all client connections
      this.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.close(1000, 'Server shutting down');
        }
      });
      this.clients.clear();

      // Close WebSocket server
      if (this.wss) {
        this.wss.close(() => {
          console.log('[WebSocket] WebSocket server closed');
          
          // Close HTTP server
          if (this.httpServer) {
            this.httpServer.close(() => {
              console.log('[WebSocket] HTTP server closed');
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  private parseMessage(data: Buffer): WebSocketMessage {
    try {
      const messageStr = data.toString('utf8');
      const parsed = JSON.parse(messageStr);
      
      // Validate message structure
      const validatedMessage = this.validateMessage(parsed);
      return validatedMessage;
    } catch (error) {
      throw new Error(`Failed to parse message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private validateMessage(parsed: any): WebSocketMessage {
    // Check required fields
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Message must be a valid JSON object');
    }

    if (!parsed.type || typeof parsed.type !== 'string') {
      throw new Error('Message must have a valid "type" field');
    }

    // Validate message type
    const validTypes = ['query', 'result', 'error', 'ping'];
    if (!validTypes.includes(parsed.type)) {
      throw new Error(`Invalid message type "${parsed.type}". Valid types: ${validTypes.join(', ')}`);
    }

    // Validate payload exists
    if (parsed.payload === undefined) {
      throw new Error('Message must have a "payload" field');
    }

    // Type-specific validation
    switch (parsed.type) {
      case 'query':
        this.validateQueryMessage(parsed);
        break;
      case 'ping':
        // Ping messages can have any payload
        break;
      case 'result':
      case 'error':
        // These are typically server-to-client messages
        console.warn(`[WebSocket] Client sent server message type: ${parsed.type}`);
        break;
    }

    return {
      type: parsed.type,
      payload: parsed.payload,
      id: parsed.id || this.generateMessageId()
    };
  }

  private validateQueryMessage(message: any): void {
    if (!message.payload || typeof message.payload !== 'object') {
      throw new Error('Query message payload must be an object');
    }

    if (!message.payload.sql || typeof message.payload.sql !== 'string') {
      throw new Error('Query message must have a valid "sql" field in payload');
    }

    // Note: SQL validation is moved to handleQueryMessage for better error handling
  }

  private handleMessage(ws: WebSocket, message: WebSocketMessage, clientId: string): void {
    switch (message.type) {
      case 'ping':
        this.handlePingMessage(ws, message, clientId);
        break;
      
      case 'query':
        this.handleQueryMessage(ws, message, clientId);
        break;
      
      default:
        this.sendToClient(ws, {
          type: 'error',
          payload: { 
            message: `Unsupported message type: ${message.type}`,
            code: 'UNSUPPORTED_TYPE'
          },
          id: message.id
        });
    }
  }

  private handlePingMessage(ws: WebSocket, message: WebSocketMessage, clientId: string): void {
    console.log(`[WebSocket] Handling ping from ${clientId}`);
    
    this.sendToClient(ws, {
      type: 'result',
      payload: {
        message: 'pong',
        echo: message.payload,
        timestamp: new Date().toISOString(),
        clientId
      },
      id: message.id
    });
  }

  private handleQueryMessage(ws: WebSocket, message: WebSocketMessage, clientId: string): void {
    console.log(`[WebSocket] Handling query from ${clientId}:`, message.payload);
    
    // Basic SQL injection prevention (for learning purposes)
    const sql = message.payload.sql.toLowerCase();
    const dangerousKeywords = ['drop', 'delete', 'truncate', 'alter', 'create', 'insert', 'update'];
    const hasDangerousKeyword = dangerousKeywords.some(keyword => sql.includes(keyword));
    
    if (hasDangerousKeyword) {
      this.sendToClient(ws, {
        type: 'error',
        payload: { 
          message: 'Query contains potentially dangerous SQL keywords. Only SELECT queries are allowed for safety.',
          code: 'DANGEROUS_SQL'
        },
        id: message.id
      });
      return;
    }
    
    // For now, simulate query processing since database integration comes later
    // This will be replaced with actual database calls in task 5
    const simulatedResult = {
      sql: message.payload.sql,
      rows: [
        { id: 1, name: 'Sample Data', created_at: new Date().toISOString() },
        { id: 2, name: 'Another Row', created_at: new Date().toISOString() }
      ],
      rowCount: 2,
      executionTime: Math.random() * 100,
      timestamp: new Date().toISOString()
    };

    this.sendToClient(ws, {
      type: 'result',
      payload: simulatedResult,
      id: message.id
    });
  }

  private sendToClient(client: WebSocket, message: WebSocketMessage): void {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error('[WebSocket] Error sending message to client:', error);
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Getter for testing purposes
  get connectedClients(): number {
    return this.clients.size;
  }
}