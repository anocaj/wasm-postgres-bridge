/**
 * Authentication and authorization module
 * Provides JWT-based authentication, API key validation, and role-based access control
 */

import * as crypto from 'crypto';
import { IncomingMessage } from 'http';

export interface AuthConfig {
  jwtSecret: string;
  apiKeys: string[];
  sessionTimeout: number; // in milliseconds
  maxFailedAttempts: number;
  lockoutDuration: number; // in milliseconds
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'user' | 'readonly';
  permissions: string[];
  createdAt: Date;
  lastLogin?: Date;
}

export interface AuthToken {
  userId: string;
  username: string;
  role: string;
  permissions: string[];
  issuedAt: number;
  expiresAt: number;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export interface RateLimitInfo {
  attempts: number;
  lastAttempt: number;
  lockedUntil?: number;
}

export class AuthenticationManager {
  private config: AuthConfig;
  private users: Map<string, User> = new Map();
  private sessions: Map<string, AuthToken> = new Map();
  private rateLimits: Map<string, RateLimitInfo> = new Map();

  constructor(config: AuthConfig) {
    this.config = config;
    this.initializeDefaultUsers();
    this.startCleanupTimer();
  }

  /**
   * Initialize default users for demo purposes
   */
  private initializeDefaultUsers(): void {
    const defaultUsers: User[] = [
      {
        id: 'admin-001',
        username: 'admin',
        role: 'admin',
        permissions: ['read', 'write', 'delete', 'admin'],
        createdAt: new Date(),
      },
      {
        id: 'user-001',
        username: 'user',
        role: 'user',
        permissions: ['read', 'write'],
        createdAt: new Date(),
      },
      {
        id: 'readonly-001',
        username: 'readonly',
        role: 'readonly',
        permissions: ['read'],
        createdAt: new Date(),
      },
    ];

    defaultUsers.forEach(user => {
      this.users.set(user.username, user);
    });

    console.log('[Auth] Initialized default users:', Array.from(this.users.keys()));
  }

  /**
   * Authenticate user with username/password (simplified for demo)
   */
  async authenticateUser(username: string, password: string, clientIp: string): Promise<AuthResult> {
    // Check rate limiting
    if (this.isRateLimited(clientIp)) {
      return {
        success: false,
        error: 'Too many failed attempts. Please try again later.',
      };
    }

    // For demo purposes, use simple password validation
    // In production, use proper password hashing (bcrypt, scrypt, etc.)
    const validCredentials = this.validateCredentials(username, password);
    
    if (!validCredentials) {
      this.recordFailedAttempt(clientIp);
      return {
        success: false,
        error: 'Invalid username or password',
      };
    }

    const user = this.users.get(username);
    if (!user) {
      this.recordFailedAttempt(clientIp);
      return {
        success: false,
        error: 'User not found',
      };
    }

    // Clear rate limiting on successful auth
    this.rateLimits.delete(clientIp);

    // Update last login
    user.lastLogin = new Date();

    // Generate JWT token
    const token = this.generateToken(user);
    
    return {
      success: true,
      user,
      token,
    };
  }

  /**
   * Validate API key authentication
   */
  authenticateApiKey(apiKey: string): AuthResult {
    if (!this.config.apiKeys.includes(apiKey)) {
      return {
        success: false,
        error: 'Invalid API key',
      };
    }

    // For API key auth, create a service user
    const serviceUser: User = {
      id: 'service-001',
      username: 'service',
      role: 'user',
      permissions: ['read', 'write'],
      createdAt: new Date(),
    };

    return {
      success: true,
      user: serviceUser,
    };
  }

  /**
   * Validate JWT token
   */
  validateToken(token: string): AuthResult {
    try {
      const decoded = this.decodeToken(token);
      
      if (!decoded) {
        return {
          success: false,
          error: 'Invalid token format',
        };
      }

      // Check expiration
      if (Date.now() > decoded.expiresAt) {
        this.sessions.delete(token);
        return {
          success: false,
          error: 'Token expired',
        };
      }

      // Get user from token
      const user = this.users.get(decoded.username);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      return {
        success: true,
        user,
        token,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Token validation failed',
      };
    }
  }

  /**
   * Extract authentication from HTTP request
   */
  extractAuthFromRequest(request: IncomingMessage): { type: 'bearer' | 'apikey' | 'none'; value?: string } {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return { type: 'none' };
    }

    if (authHeader.startsWith('Bearer ')) {
      return {
        type: 'bearer',
        value: authHeader.substring(7),
      };
    }

    if (authHeader.startsWith('ApiKey ')) {
      return {
        type: 'apikey',
        value: authHeader.substring(7),
      };
    }

    return { type: 'none' };
  }

  /**
   * Check if user has required permission
   */
  hasPermission(user: User, permission: string): boolean {
    return user.permissions.includes(permission) || user.permissions.includes('admin');
  }

  /**
   * Check if SQL query is allowed for user role
   */
  isQueryAllowed(user: User, sql: string): { allowed: boolean; reason?: string } {
    const normalizedSql = sql.toLowerCase().trim();
    
    // Admin can do anything
    if (user.role === 'admin') {
      return { allowed: true };
    }

    // Readonly users can only SELECT
    if (user.role === 'readonly') {
      if (!normalizedSql.startsWith('select')) {
        return {
          allowed: false,
          reason: 'Readonly users can only execute SELECT queries',
        };
      }
      return { allowed: true };
    }

    // Regular users can SELECT, INSERT, UPDATE but not DELETE/DROP/ALTER
    if (user.role === 'user') {
      const dangerousKeywords = ['drop', 'delete', 'truncate', 'alter'];
      const hasDangerous = dangerousKeywords.some(keyword => normalizedSql.includes(keyword));
      
      if (hasDangerous) {
        return {
          allowed: false,
          reason: 'Users cannot execute destructive operations (DROP, DELETE, TRUNCATE, ALTER)',
        };
      }
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'Unknown user role',
    };
  }

  /**
   * Generate JWT token (simplified implementation)
   */
  private generateToken(user: User): string {
    const payload: AuthToken = {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      issuedAt: Date.now(),
      expiresAt: Date.now() + this.config.sessionTimeout,
    };

    // In production, use a proper JWT library like 'jsonwebtoken'
    const tokenData = JSON.stringify(payload);
    const signature = this.createSignature(tokenData);
    const token = Buffer.from(`${tokenData}.${signature}`).toString('base64');
    
    this.sessions.set(token, payload);
    return token;
  }

  /**
   * Decode JWT token (simplified implementation)
   */
  private decodeToken(token: string): AuthToken | null {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf8');
      const [tokenData, signature] = decoded.split('.');
      
      // Verify signature
      const expectedSignature = this.createSignature(tokenData);
      if (signature !== expectedSignature) {
        return null;
      }

      return JSON.parse(tokenData);
    } catch (error) {
      return null;
    }
  }

  /**
   * Create HMAC signature for token
   */
  private createSignature(data: string): string {
    return crypto
      .createHmac('sha256', this.config.jwtSecret)
      .update(data)
      .digest('hex');
  }

  /**
   * Validate user credentials (simplified for demo)
   */
  private validateCredentials(username: string, password: string): boolean {
    // In production, use proper password hashing
    const validCredentials: Record<string, string> = {
      admin: 'admin123',
      user: 'user123',
      readonly: 'readonly123',
    };

    return validCredentials[username] === password;
  }

  /**
   * Check if IP is rate limited
   */
  private isRateLimited(clientIp: string): boolean {
    const limit = this.rateLimits.get(clientIp);
    if (!limit) {
      return false;
    }

    // Check if still locked out
    if (limit.lockedUntil && Date.now() < limit.lockedUntil) {
      return true;
    }

    // Check if too many attempts
    if (limit.attempts >= this.config.maxFailedAttempts) {
      const timeSinceLastAttempt = Date.now() - limit.lastAttempt;
      if (timeSinceLastAttempt < this.config.lockoutDuration) {
        return true;
      }
    }

    return false;
  }

  /**
   * Record failed authentication attempt
   */
  private recordFailedAttempt(clientIp: string): void {
    const existing = this.rateLimits.get(clientIp) || { attempts: 0, lastAttempt: 0 };
    
    existing.attempts++;
    existing.lastAttempt = Date.now();
    
    if (existing.attempts >= this.config.maxFailedAttempts) {
      existing.lockedUntil = Date.now() + this.config.lockoutDuration;
    }
    
    this.rateLimits.set(clientIp, existing);
  }

  /**
   * Clean up expired sessions and rate limits
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      
      // Clean expired sessions
      for (const [token, session] of this.sessions.entries()) {
        if (now > session.expiresAt) {
          this.sessions.delete(token);
        }
      }
      
      // Clean old rate limits
      for (const [ip, limit] of this.rateLimits.entries()) {
        if (limit.lockedUntil && now > limit.lockedUntil) {
          this.rateLimits.delete(ip);
        }
      }
    }, 60000); // Clean every minute
  }

  /**
   * Get authentication statistics
   */
  getAuthStats() {
    return {
      totalUsers: this.users.size,
      activeSessions: this.sessions.size,
      rateLimitedIPs: this.rateLimits.size,
      usersByRole: {
        admin: Array.from(this.users.values()).filter(u => u.role === 'admin').length,
        user: Array.from(this.users.values()).filter(u => u.role === 'user').length,
        readonly: Array.from(this.users.values()).filter(u => u.role === 'readonly').length,
      },
    };
  }
}