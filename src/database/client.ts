/**
 * Database client for PostgreSQL operations
 * Implements connection management with pooling, caching, and performance monitoring
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { PerformanceMonitor, DetailedMetrics } from './performance-monitor';

export interface DatabaseClient {
  connect(): Promise<void>;
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  disconnect(): Promise<void>;
}

export interface TestResult {
  success: boolean;
  message: string;
  data?: any;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number; // Maximum number of clients in the pool
  idleTimeoutMillis?: number; // How long a client is allowed to remain idle
  connectionTimeoutMillis?: number; // How long to wait when connecting a new client
  enableCache?: boolean; // Enable query result caching
  cacheMaxSize?: number; // Maximum number of cached queries
  cacheTtlMs?: number; // Cache time-to-live in milliseconds
  enablePerformanceLogging?: boolean; // Enable performance monitoring
}

export interface QueryCacheEntry {
  result: any[];
  timestamp: number;
  ttl: number;
}

export interface PerformanceMetrics {
  queryCount: number;
  totalQueryTime: number;
  averageQueryTime: number;
  slowQueries: Array<{
    sql: string;
    duration: number;
    timestamp: number;
  }>;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
}

export class PostgreSQLClient implements DatabaseClient {
  private pool: Pool | null = null;
  private config: DatabaseConfig;
  private queryCache: Map<string, QueryCacheEntry> = new Map();
  private performanceMetrics: PerformanceMetrics = {
    queryCount: 0,
    totalQueryTime: 0,
    averageQueryTime: 0,
    slowQueries: [],
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitRate: 0,
  };
  private performanceMonitor: PerformanceMonitor;

  constructor(config?: DatabaseConfig) {
    // Parse connection string or use provided config
    this.config = config || this.parseConnectionString();
    
    // Set default cache and performance settings
    this.config.enableCache = this.config.enableCache ?? true;
    this.config.cacheMaxSize = this.config.cacheMaxSize ?? 100;
    this.config.cacheTtlMs = this.config.cacheTtlMs ?? 300000; // 5 minutes
    this.config.enablePerformanceLogging = this.config.enablePerformanceLogging ?? true;
    
    // Initialize performance monitor
    this.performanceMonitor = new PerformanceMonitor();
  }

  /**
   * Parse DATABASE_URL environment variable or use individual DB_* variables
   */
  private parseConnectionString(): DatabaseConfig {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (databaseUrl) {
      try {
        const url = new URL(databaseUrl);
        return {
          host: url.hostname,
          port: parseInt(url.port) || 5432,
          database: url.pathname.slice(1), // Remove leading slash
          user: url.username,
          password: url.password,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
          enableCache: true,
          cacheMaxSize: 100,
          cacheTtlMs: 300000,
          enablePerformanceLogging: true,
        };
      } catch (error) {
        throw new Error(`Invalid DATABASE_URL format: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Fallback to individual environment variables
    const host = process.env.DB_HOST || 'localhost';
    const port = parseInt(process.env.DB_PORT || '5432');
    const database = process.env.DB_NAME || 'wasm_learning';
    const user = process.env.DB_USER || 'postgres';
    const password = process.env.DB_PASSWORD || 'password';

    if (!host || !database || !user || !password) {
      throw new Error('Missing required database configuration. Set DATABASE_URL or DB_HOST, DB_NAME, DB_USER, DB_PASSWORD');
    }

    return {
      host,
      port,
      database,
      user,
      password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      enableCache: true,
      cacheMaxSize: 100,
      cacheTtlMs: 300000,
      enablePerformanceLogging: true,
    };
  }

  /**
   * Establish connection pool to PostgreSQL database
   */
  async connect(): Promise<void> {
    if (this.pool) {
      return; // Already connected
    }

    try {
      const poolConfig: PoolConfig = {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        max: this.config.max,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis,
      };

      this.pool = new Pool(poolConfig);

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      console.log(`Connected to PostgreSQL database: ${this.config.database}`);
    } catch (error) {
      this.pool = null;
      const errorMessage = error instanceof Error ? error.message : 'Unknown connection error';
      throw new Error(`Failed to connect to database: ${errorMessage}`);
    }
  }

  /**
   * Execute SQL query with optional parameters, caching, and performance monitoring
   */
  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(sql, params);

    // Check cache for SELECT queries
    if (this.config.enableCache && this.isSelectQuery(sql)) {
      const cachedResult = this.getCachedResult<T>(cacheKey);
      if (cachedResult) {
        this.performanceMetrics.cacheHits++;
        this.updateCacheHitRate();
        if (this.config.enablePerformanceLogging) {
          console.log(`Cache hit for query: ${sql.substring(0, 50)}...`);
        }
        return cachedResult;
      }
      this.performanceMetrics.cacheMisses++;
    }

    let client: PoolClient | null = null;
    
    try {
      client = await this.pool.connect();
      console.log('[DEBUG] Executing SQL:', JSON.stringify(sql));
      console.log('[DEBUG] With params:', JSON.stringify(params));
      const result = await client.query(sql, params);
      const queryResult = result.rows as T[];

      // Cache SELECT query results
      if (this.config.enableCache && this.isSelectQuery(sql)) {
        this.setCachedResult(cacheKey, queryResult);
      }

      // Update performance metrics
      const duration = Date.now() - startTime;
      this.updatePerformanceMetrics(sql, duration);
      this.performanceMonitor.recordQuery(duration);

      return queryResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown query error';
      throw new Error(`Query execution failed: ${errorMessage}`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Close all connections in the pool
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('Disconnected from PostgreSQL database');
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.pool !== null;
  }

  /**
   * Get pool statistics for monitoring
   */
  getPoolStats() {
    if (!this.pool) {
      return null;
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Generate cache key for query and parameters
   */
  private generateCacheKey(sql: string, params?: any[]): string {
    const normalizedSql = sql.trim().toLowerCase();
    const paramString = params ? JSON.stringify(params) : '';
    return `${normalizedSql}:${paramString}`;
  }

  /**
   * Check if query is a SELECT statement (cacheable)
   */
  private isSelectQuery(sql: string): boolean {
    return sql.trim().toLowerCase().startsWith('select');
  }

  /**
   * Get cached query result if available and not expired
   */
  private getCachedResult<T>(cacheKey: string): T[] | null {
    const entry = this.queryCache.get(cacheKey);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.queryCache.delete(cacheKey);
      return null;
    }

    return entry.result as T[];
  }

  /**
   * Cache query result with TTL
   */
  private setCachedResult<T>(cacheKey: string, result: T[]): void {
    // Implement LRU eviction if cache is full
    if (this.queryCache.size >= (this.config.cacheMaxSize || 100)) {
      const oldestKey = this.queryCache.keys().next().value;
      if (oldestKey) {
        this.queryCache.delete(oldestKey);
      }
    }

    this.queryCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl: this.config.cacheTtlMs || 300000,
    });
  }

  /**
   * Update performance metrics after query execution
   */
  private updatePerformanceMetrics(sql: string, duration: number): void {
    this.performanceMetrics.queryCount++;
    this.performanceMetrics.totalQueryTime += duration;
    this.performanceMetrics.averageQueryTime = 
      this.performanceMetrics.totalQueryTime / this.performanceMetrics.queryCount;

    // Track slow queries (> 1000ms)
    if (duration > 1000) {
      this.performanceMetrics.slowQueries.push({
        sql: sql.substring(0, 100), // Truncate for logging
        duration,
        timestamp: Date.now(),
      });

      // Keep only last 10 slow queries
      if (this.performanceMetrics.slowQueries.length > 10) {
        this.performanceMetrics.slowQueries.shift();
      }
    }

    this.updateCacheHitRate();

    if (this.config.enablePerformanceLogging && duration > 100) {
      console.log(`Query executed in ${duration}ms: ${sql.substring(0, 50)}...`);
    }
  }

  /**
   * Update cache hit rate calculation
   */
  private updateCacheHitRate(): void {
    const totalCacheAttempts = this.performanceMetrics.cacheHits + this.performanceMetrics.cacheMisses;
    this.performanceMetrics.cacheHitRate = totalCacheAttempts > 0 
      ? (this.performanceMetrics.cacheHits / totalCacheAttempts) * 100 
      : 0;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    this.queryCache.clear();
    console.log('Query cache cleared');
  }

  /**
   * Reset performance metrics
   */
  resetPerformanceMetrics(): void {
    this.performanceMetrics = {
      queryCount: 0,
      totalQueryTime: 0,
      averageQueryTime: 0,
      slowQueries: [],
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
    };
    console.log('Performance metrics reset');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.queryCache.size,
      maxSize: this.config.cacheMaxSize || 100,
      hitRate: this.performanceMetrics.cacheHitRate,
      hits: this.performanceMetrics.cacheHits,
      misses: this.performanceMetrics.cacheMisses,
    };
  }

  /**
   * Get detailed performance metrics including system monitoring
   */
  getDetailedMetrics(): DetailedMetrics {
    const poolStats = this.getPoolStats();
    const cacheStats = this.getCacheStats();
    return this.performanceMonitor.getDetailedMetrics(poolStats, cacheStats);
  }

  /**
   * Generate comprehensive performance report
   */
  generatePerformanceReport(): string {
    const poolStats = this.getPoolStats();
    const cacheStats = this.getCacheStats();
    return this.performanceMonitor.generateReport(poolStats, cacheStats);
  }

  /**
   * Run performance health checks
   */
  runHealthChecks(): void {
    const poolStats = this.getPoolStats();
    const cacheStats = this.getCacheStats();
    
    if (poolStats) {
      this.performanceMonitor.checkConnectionPool(poolStats);
    }
    
    this.performanceMonitor.checkCachePerformance(cacheStats);
    this.performanceMonitor.checkMemoryUsage();
  }

  // CRUD Operations for Users table
  
  /**
   * Create a new user
   */
  async createUser(name: string, email: string): Promise<{ id: number; name: string; email: string; created_at: Date }> {
    const sql = 'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at';
    const result = await this.query<{ id: number; name: string; email: string; created_at: Date }>(sql, [name, email]);
    
    if (result.length === 0) {
      throw new Error('Failed to create user');
    }
    
    return result[0];
  }

  /**
   * Get user by ID
   */
  async getUserById(id: number): Promise<{ id: number; name: string; email: string; created_at: Date } | null> {
    const sql = 'SELECT id, name, email, created_at FROM users WHERE id = $1';
    const result = await this.query<{ id: number; name: string; email: string; created_at: Date }>(sql, [id]);
    
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<{ id: number; name: string; email: string; created_at: Date }[]> {
    const sql = 'SELECT id, name, email, created_at FROM users ORDER BY created_at DESC';
    return await this.query<{ id: number; name: string; email: string; created_at: Date }>(sql);
  }

  /**
   * Update user information
   */
  async updateUser(id: number, name?: string, email?: string): Promise<{ id: number; name: string; email: string; created_at: Date } | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }

    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    params.push(id);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, email, created_at`;
    
    const result = await this.query<{ id: number; name: string; email: string; created_at: Date }>(sql, params);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Delete user by ID (also deletes associated posts)
   */
  async deleteUser(id: number): Promise<boolean> {
    // First delete associated posts
    await this.query('DELETE FROM posts WHERE user_id = $1', [id]);
    
    // Then delete the user
    const sql = 'DELETE FROM users WHERE id = $1';
    const result = await this.query(sql, [id]);
    return (result as any).rowCount > 0;
  }

  // CRUD Operations for Posts table

  /**
   * Create a new post
   */
  async createPost(userId: number, title: string, content?: string): Promise<{ id: number; user_id: number; title: string; content: string | null; created_at: Date }> {
    const sql = 'INSERT INTO posts (user_id, title, content) VALUES ($1, $2, $3) RETURNING id, user_id, title, content, created_at';
    const result = await this.query<{ id: number; user_id: number; title: string; content: string | null; created_at: Date }>(sql, [userId, title, content || null]);
    
    if (result.length === 0) {
      throw new Error('Failed to create post');
    }
    
    return result[0];
  }

  /**
   * Get post by ID
   */
  async getPostById(id: number): Promise<{ id: number; user_id: number; title: string; content: string | null; created_at: Date } | null> {
    const sql = 'SELECT id, user_id, title, content, created_at FROM posts WHERE id = $1';
    const result = await this.query<{ id: number; user_id: number; title: string; content: string | null; created_at: Date }>(sql, [id]);
    
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get all posts with user information
   */
  async getAllPostsWithUsers(): Promise<{ id: number; title: string; content: string | null; created_at: Date; user_name: string; user_email: string }[]> {
    const sql = `
      SELECT p.id, p.title, p.content, p.created_at, u.name as user_name, u.email as user_email
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `;
    return await this.query<{ id: number; title: string; content: string | null; created_at: Date; user_name: string; user_email: string }>(sql);
  }

  /**
   * Get posts by user ID
   */
  async getPostsByUserId(userId: number): Promise<{ id: number; user_id: number; title: string; content: string | null; created_at: Date }[]> {
    const sql = 'SELECT id, user_id, title, content, created_at FROM posts WHERE user_id = $1 ORDER BY created_at DESC';
    return await this.query<{ id: number; user_id: number; title: string; content: string | null; created_at: Date }>(sql, [userId]);
  }

  /**
   * Update post
   */
  async updatePost(id: number, title?: string, content?: string): Promise<{ id: number; user_id: number; title: string; content: string | null; created_at: Date } | null> {
    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params.push(title);
    }

    if (content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      params.push(content);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    params.push(id);
    const sql = `UPDATE posts SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, user_id, title, content, created_at`;
    
    const result = await this.query<{ id: number; user_id: number; title: string; content: string | null; created_at: Date }>(sql, params);
    return result.length > 0 ? result[0] : null;
  }

  /**
   * Delete post by ID
   */
  async deletePost(id: number): Promise<boolean> {
    let client: any = null;
    
    try {
      if (!this.pool) {
        throw new Error('Database not connected. Call connect() first.');
      }

      client = await this.pool.connect();
      const result = await client.query('DELETE FROM posts WHERE id = $1', [id]);
      return result.rowCount > 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown query error';
      throw new Error(`Query execution failed: ${errorMessage}`);
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  /**
   * Initialize database schema and test data
   */
  async initializeSchema(): Promise<void> {
    const schemaSQL = `
      -- Create users table
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create posts table
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await this.query(schemaSQL);

    // Insert test data
    const testDataSQL = `
      INSERT INTO users (name, email) VALUES 
        ('Alice Johnson', 'alice@example.com'),
        ('Bob Smith', 'bob@example.com'),
        ('Carol Davis', 'carol@example.com')
      ON CONFLICT (email) DO NOTHING;
    `;

    await this.query(testDataSQL);

    // Get user IDs for posts
    const users = await this.getAllUsers();
    if (users.length >= 3) {
      const postsSQL = `
        INSERT INTO posts (user_id, title, content) VALUES 
          ($1, 'First Post', 'This is Alice''s first post about learning WASM and PostgreSQL.'),
          ($1, 'WASM Adventures', 'Exploring WebAssembly compilation and execution.'),
          ($2, 'Database Connections', 'Learning about PostgreSQL connection patterns.'),
          ($3, 'Integration Testing', 'Testing the complete WASM to database flow.')
        ON CONFLICT DO NOTHING;
      `;

      await this.query(postsSQL, [users[0].id, users[1].id, users[2].id]);
    }
  }
}