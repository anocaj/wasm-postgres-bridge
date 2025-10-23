/**
 * WebSocket server for real-time communication
 * This will be implemented in task 3.1
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

// Placeholder implementation - will be completed in task 3.1
export class BasicWebSocketServer implements WebSocketServer {
  async start(port: number): Promise<void> {
    throw new Error('Not implemented yet - see task 3.1');
  }

  broadcast(message: WebSocketMessage): void {
    throw new Error('Not implemented yet - see task 3.1');
  }

  async stop(): Promise<void> {
    throw new Error('Not implemented yet - see task 3.1');
  }
}