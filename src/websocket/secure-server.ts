/**
 * Secure WebSocket server with authentication and input validation
 * Extends the basic WebSocket server with security features
 */

import { WebSocketServer as WSServer, WebSocket } from "ws";
import { createServer, Server, IncomingMessage } from "http";
import { PostgreSQLClient, DatabaseClient } from "../database/client";
import { AuthenticationManager, AuthConfig, User } from "../security/auth";
import {
  InputValidator,
  ValidationResult,
  SQLValidationResult,
} from "../security/validation";

export interface SecureWebSocketMessage {
  type: "auth" | "query" | "result" | "error" | "ping";
  payload: any;
  id?: string;
}

export interface AuthenticatedClient {
  ws: WebSocket;
  user: User;
  clientId: string;
  connectedAt: Date;
  lastActivity: Date;
  requestCount: number;
}

export interface SecurityConfig extends AuthConfig {
  requireAuth: boolean;
  maxRequestsPerMinute: number;
  allowedQueryTypes: string[];
  enableAuditLog: boolean;
}

export interface AuditLogEntry {
  timestamp: Date;
  clientId: string;
  userId?: string;
  action: string;
  details: any;
  success: boolean;
  error?: string;
}

export class SecureWebSocketServer {
  private wss: WSServer | null = null;
  private httpServer: Server | null = null;
  private dbClient: DatabaseClient;
  private authManager: AuthenticationManager;
  private config: SecurityConfig;
  private authenticatedClients: Map<string, AuthenticatedClient> = new Map();
  private auditLog: AuditLogEntry[] = [];

  constructor(dbClient: DatabaseClient, config: SecurityConfig) {
    this.dbClient = dbClient;
    this.config = config;
    this.authManager = new AuthenticationManager(config);
    this.startCleanupTimer();
  }

  async start(port: number): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Initialize database connection
        console.log("[SecureWS] Connecting to database...");
        await this.dbClient.connect();
        console.log("[SecureWS] Database connected successfully");

        // Create HTTP server
        this.httpServer = createServer();

        // Create WebSocket server with connection verification
        this.wss = new WSServer({
          server: this.httpServer,
          verifyClient: (info: any) => this.verifyClient(info),
        });

        // Handle WebSocket connections
        this.wss.on("connection", (ws: WebSocket, request: IncomingMessage) => {
          this.handleConnection(ws, request);
        });

        // Handle server errors
        this.wss.on("error", (error: Error) => {
          console.error("[SecureWS] Server error:", error);
          reject(error);
        });

        // Start HTTP server
        this.httpServer.listen(port, () => {
          console.log(
            `[SecureWS] Secure WebSocket server started on port ${port}`
          );
          console.log(
            `[SecureWS] Authentication required: ${this.config.requireAuth}`
          );
          resolve();
        });

        this.httpServer.on("error", (error: Error) => {
          console.error("[SecureWS] HTTP server error:", error);
          reject(error);
        });
      } catch (error) {
        console.error("[SecureWS] Failed to start server:", error);
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise(async (resolve) => {
      console.log("[SecureWS] Stopping secure server...");

      // Close all authenticated connections
      this.authenticatedClients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.close(1000, "Server shutting down");
        }
      });
      this.authenticatedClients.clear();

      // Close database connection
      try {
        await this.dbClient.disconnect();
        console.log("[SecureWS] Database disconnected");
      } catch (error) {
        console.error("[SecureWS] Error disconnecting database:", error);
      }

      // Close WebSocket server
      if (this.wss) {
        this.wss.close(() => {
          console.log("[SecureWS] WebSocket server closed");

          // Close HTTP server
          if (this.httpServer) {
            this.httpServer.close(() => {
              console.log("[SecureWS] HTTP server closed");
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

  /**
   * Verify client connection before WebSocket upgrade
   */
  private verifyClient(info: any): boolean {
    const clientIp = info.req.socket.remoteAddress || "unknown";

    // Log connection attempt
    this.logAudit({
      timestamp: new Date(),
      clientId: clientIp,
      action: "connection_attempt",
      details: { origin: info.origin, secure: info.secure },
      success: true,
    });

    // For demo purposes, allow all connections
    // In production, implement IP whitelisting, origin validation, etc.
    return true;
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const clientId = this.generateClientId();
    const clientIp = request.socket.remoteAddress || "unknown";

    console.log(`[SecureWS] New connection: ${clientId} from ${clientIp}`);

    // If authentication is not required, create anonymous user
    if (!this.config.requireAuth) {
      const anonymousUser: User = {
        id: "anonymous",
        username: "anonymous",
        role: "readonly",
        permissions: ["read"],
        createdAt: new Date(),
      };

      this.authenticatedClients.set(clientId, {
        ws,
        user: anonymousUser,
        clientId,
        connectedAt: new Date(),
        lastActivity: new Date(),
        requestCount: 0,
      });
    }

    // Handle incoming messages
    ws.on("message", async (data: Buffer) => {
      await this.handleMessage(ws, data, clientId, clientIp);
    });

    // Handle connection close
    ws.on("close", (code: number, reason: Buffer) => {
      console.log(`[SecureWS] Connection closed: ${clientId}, code: ${code}`);
      this.authenticatedClients.delete(clientId);

      this.logAudit({
        timestamp: new Date(),
        clientId,
        action: "disconnection",
        details: { code, reason: reason.toString() },
        success: true,
      });
    });

    // Handle connection errors
    ws.on("error", (error: Error) => {
      console.error(`[SecureWS] Connection error for ${clientId}:`, error);
      this.authenticatedClients.delete(clientId);
    });

    // Send welcome message
    this.sendToClient(ws, {
      type: "result",
      payload: {
        message: "Connected to secure WebSocket server",
        clientId,
        authRequired: this.config.requireAuth,
      },
      id: "welcome",
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(
    ws: WebSocket,
    data: Buffer,
    clientId: string,
    clientIp: string
  ): Promise<void> {
    try {
      // Parse and validate message
      const messageStr = data.toString("utf8");
      const parsed = JSON.parse(messageStr);

      const validation = InputValidator.validateWebSocketMessage(parsed);
      if (!validation.isValid) {
        this.sendError(
          ws,
          "VALIDATION_ERROR",
          validation.errors.join(", "),
          parsed.id
        );
        return;
      }

      const message = validation.sanitized as SecureWebSocketMessage;

      // Check rate limiting
      if (!this.checkRateLimit(clientId)) {
        this.sendError(ws, "RATE_LIMIT", "Too many requests", message.id);
        return;
      }

      // Handle authentication messages
      if (message.type === "auth") {
        await this.handleAuthMessage(ws, message, clientId, clientIp);
        return;
      }

      // Check if client is authenticated (if required)
      const client = this.authenticatedClients.get(clientId);
      if (this.config.requireAuth && !client) {
        this.sendError(
          ws,
          "AUTH_REQUIRED",
          "Authentication required",
          message.id
        );
        return;
      }

      // Update client activity
      if (client) {
        client.lastActivity = new Date();
        client.requestCount++;
      }

      // Handle other message types
      switch (message.type) {
        case "ping":
          this.handlePingMessage(ws, message, clientId);
          break;
        case "query":
          await this.handleQueryMessage(ws, message, clientId, client);
          break;
        default:
          this.sendError(
            ws,
            "UNSUPPORTED_TYPE",
            `Unsupported message type: ${message.type}`,
            message.id
          );
      }
    } catch (error) {
      console.error(
        `[SecureWS] Error handling message from ${clientId}:`,
        error
      );
      this.sendError(ws, "PARSE_ERROR", "Invalid message format");
    }
  }

  /**
   * Handle authentication message
   */
  private async handleAuthMessage(
    ws: WebSocket,
    message: SecureWebSocketMessage,
    clientId: string,
    clientIp: string
  ): Promise<void> {
    try {
      let authResult;

      if (message.payload.token) {
        // JWT token authentication
        authResult = this.authManager.validateToken(message.payload.token);
      } else if (message.payload.apiKey) {
        // API key authentication
        authResult = this.authManager.authenticateApiKey(
          message.payload.apiKey
        );
      } else if (message.payload.username && message.payload.password) {
        // Username/password authentication
        authResult = await this.authManager.authenticateUser(
          message.payload.username,
          message.payload.password,
          clientIp
        );
      } else {
        this.sendError(
          ws,
          "AUTH_ERROR",
          "Invalid authentication payload",
          message.id
        );
        return;
      }

      if (authResult.success && authResult.user) {
        // Store authenticated client
        this.authenticatedClients.set(clientId, {
          ws,
          user: authResult.user,
          clientId,
          connectedAt: new Date(),
          lastActivity: new Date(),
          requestCount: 0,
        });

        this.sendToClient(ws, {
          type: "result",
          payload: {
            message: "Authentication successful",
            user: {
              id: authResult.user.id,
              username: authResult.user.username,
              role: authResult.user.role,
              permissions: authResult.user.permissions,
            },
            token: authResult.token,
          },
          id: message.id,
        });

        this.logAudit({
          timestamp: new Date(),
          clientId,
          userId: authResult.user.id,
          action: "authentication",
          details: {
            username: authResult.user.username,
            role: authResult.user.role,
          },
          success: true,
        });

        console.log(
          `[SecureWS] Client ${clientId} authenticated as ${authResult.user.username} (${authResult.user.role})`
        );
      } else {
        this.sendError(
          ws,
          "AUTH_ERROR",
          authResult.error || "Authentication failed",
          message.id
        );

        this.logAudit({
          timestamp: new Date(),
          clientId,
          action: "authentication",
          details: { error: authResult.error },
          success: false,
          error: authResult.error,
        });
      }
    } catch (error) {
      console.error(`[SecureWS] Authentication error for ${clientId}:`, error);
      this.sendError(ws, "AUTH_ERROR", "Authentication failed", message.id);
    }
  }

  /**
   * Handle ping message
   */
  private handlePingMessage(
    ws: WebSocket,
    message: SecureWebSocketMessage,
    clientId: string
  ): void {
    this.sendToClient(ws, {
      type: "result",
      payload: {
        message: "pong",
        timestamp: new Date().toISOString(),
        clientId,
      },
      id: message.id,
    });
  }

  /**
   * Handle database query message
   */
  private async handleQueryMessage(
    ws: WebSocket,
    message: SecureWebSocketMessage,
    clientId: string,
    client?: AuthenticatedClient
  ): Promise<void> {
    try {
      const sql = message.payload.sql;
      const params = message.payload.params || [];

      // Validate SQL query
      const sqlValidation = InputValidator.validateSQL(
        sql,
        this.config.allowedQueryTypes
      );
      if (!sqlValidation.isValid) {
        this.sendError(
          ws,
          "SQL_VALIDATION_ERROR",
          sqlValidation.errors.join(", "),
          message.id
        );

        this.logAudit({
          timestamp: new Date(),
          clientId,
          userId: client?.user.id,
          action: "query_validation_failed",
          details: { sql, errors: sqlValidation.errors },
          success: false,
          error: sqlValidation.errors.join(", "),
        });
        return;
      }

      // Check user permissions
      if (
        client &&
        !this.authManager.isQueryAllowed(client.user, sql).allowed
      ) {
        const reason = this.authManager.isQueryAllowed(client.user, sql).reason;
        this.sendError(
          ws,
          "PERMISSION_DENIED",
          reason || "Query not allowed",
          message.id
        );

        this.logAudit({
          timestamp: new Date(),
          clientId,
          userId: client.user.id,
          action: "query_permission_denied",
          details: { sql, reason },
          success: false,
          error: reason,
        });
        return;
      }

      // Execute query
      const startTime = Date.now();
      const rows = await this.dbClient.query(sql, params);
      const executionTime = Date.now() - startTime;

      // Send successful response
      this.sendToClient(ws, {
        type: "result",
        payload: {
          sql,
          params,
          rows,
          rowCount: rows.length,
          executionTime,
          timestamp: new Date().toISOString(),
          warnings: sqlValidation.warnings,
        },
        id: message.id,
      });

      this.logAudit({
        timestamp: new Date(),
        clientId,
        userId: client?.user.id,
        action: "query_executed",
        details: { sql, rowCount: rows.length, executionTime },
        success: true,
      });

      console.log(
        `[SecureWS] Query executed for ${clientId}: ${rows.length} rows in ${executionTime}ms`
      );
    } catch (error) {
      console.error(`[SecureWS] Database query error for ${clientId}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown database error";

      this.sendError(
        ws,
        "DATABASE_ERROR",
        `Database query failed: ${errorMessage}`,
        message.id
      );

      this.logAudit({
        timestamp: new Date(),
        clientId,
        userId: client?.user.id,
        action: "query_error",
        details: { sql: message.payload.sql, error: errorMessage },
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * Send error message to client
   */
  private sendError(
    ws: WebSocket,
    code: string,
    message: string,
    id?: string
  ): void {
    this.sendToClient(ws, {
      type: "error",
      payload: { code, message },
      id,
    });
  }

  /**
   * Send message to client
   */
  private sendToClient(ws: WebSocket, message: SecureWebSocketMessage): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error("[SecureWS] Error sending message to client:", error);
    }
  }

  /**
   * Check rate limiting for client
   */
  private checkRateLimit(clientId: string): boolean {
    const client = this.authenticatedClients.get(clientId);
    if (!client) {
      return true; // Allow unauthenticated clients for auth messages
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Reset counter if more than a minute has passed
    if (client.lastActivity.getTime() < oneMinuteAgo) {
      client.requestCount = 0;
    }

    return client.requestCount < this.config.maxRequestsPerMinute;
  }

  /**
   * Log audit entry
   */
  private logAudit(entry: AuditLogEntry): void {
    if (!this.config.enableAuditLog) {
      return;
    }

    this.auditLog.push(entry);

    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }

    // Log to console for demo
    console.log(
      `[AUDIT] ${entry.timestamp.toISOString()} - ${entry.action} - ${
        entry.success ? "SUCCESS" : "FAILED"
      }`
    );
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;
  }

  /**
   * Clean up expired sessions and old audit logs
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      const sessionTimeout = 30 * 60 * 1000; // 30 minutes

      // Clean up inactive clients
      for (const [clientId, client] of this.authenticatedClients.entries()) {
        if (now - client.lastActivity.getTime() > sessionTimeout) {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.close(1000, "Session timeout");
          }
          this.authenticatedClients.delete(clientId);
          console.log(`[SecureWS] Cleaned up inactive client: ${clientId}`);
        }
      }

      // Clean up old audit logs (keep last 24 hours)
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      this.auditLog = this.auditLog.filter(
        (entry) => entry.timestamp.getTime() > oneDayAgo
      );
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      connectedClients: this.authenticatedClients.size,
      authStats: this.authManager.getAuthStats(),
      auditLogEntries: this.auditLog.length,
      clientsByRole: {
        admin: Array.from(this.authenticatedClients.values()).filter(
          (c) => c.user.role === "admin"
        ).length,
        user: Array.from(this.authenticatedClients.values()).filter(
          (c) => c.user.role === "user"
        ).length,
        readonly: Array.from(this.authenticatedClients.values()).filter(
          (c) => c.user.role === "readonly"
        ).length,
      },
    };
  }

  /**
   * Get recent audit log entries
   */
  getAuditLog(limit: number = 100): AuditLogEntry[] {
    return this.auditLog.slice(-limit);
  }
}
