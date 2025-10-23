/**
 * Database operation tests
 * Tests for PostgreSQL client connection, queries, and CRUD operations
 */

import { PostgreSQLClient, DatabaseConfig } from '../src/database/client';

describe('Database Operations', () => {
  let client: PostgreSQLClient;
  let testUserId: number;
  let testPostId: number;

  // Use test database configuration
  const testConfig: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'wasm_learning',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    max: 5, // Smaller pool for tests
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 2000,
  };

  beforeAll(async () => {
    client = new PostgreSQLClient(testConfig);
    await client.connect();
    await client.initializeSchema();
  });

  afterAll(async () => {
    // Clean up test data (posts first due to foreign key constraint)
    if (testPostId) {
      try {
        await client.deletePost(testPostId);
      } catch (error) {
        // Post might already be deleted in tests
      }
    }
    if (testUserId) {
      try {
        await client.deleteUser(testUserId);
      } catch (error) {
        // User might already be deleted in tests
      }
    }
    await client.disconnect();
  });

  describe('Connection Management', () => {
    test('should connect to database successfully', async () => {
      expect(client.isConnected()).toBe(true);
    });

    test('should execute basic queries', async () => {
      const result = await client.query<{ result: number }>('SELECT 1 as result');
      expect(result).toHaveLength(1);
      expect(result[0].result).toBe(1);
    });

    test('should handle connection errors gracefully', async () => {
      const badClient = new PostgreSQLClient({
        host: 'nonexistent-host',
        port: 5432,
        database: 'test',
        user: 'test',
        password: 'test',
      });

      await expect(badClient.connect()).rejects.toThrow('Failed to connect to database');
    });

    test('should throw error when querying without connection', async () => {
      const disconnectedClient = new PostgreSQLClient(testConfig);
      await expect(disconnectedClient.query('SELECT 1')).rejects.toThrow('Database not connected');
    });
  });

  describe('User CRUD Operations', () => {
    test('should create a new user', async () => {
      const user = await client.createUser('Test User', 'test@example.com');
      testUserId = user.id;

      expect(user.id).toBeDefined();
      expect(user.name).toBe('Test User');
      expect(user.email).toBe('test@example.com');
      expect(user.created_at).toBeInstanceOf(Date);
    });

    test('should get user by ID', async () => {
      const user = await client.getUserById(testUserId);
      
      expect(user).not.toBeNull();
      expect(user!.id).toBe(testUserId);
      expect(user!.name).toBe('Test User');
      expect(user!.email).toBe('test@example.com');
    });

    test('should return null for non-existent user', async () => {
      const user = await client.getUserById(99999);
      expect(user).toBeNull();
    });

    test('should get all users', async () => {
      const users = await client.getAllUsers();
      expect(users.length).toBeGreaterThan(0);
      expect(users.some(u => u.id === testUserId)).toBe(true);
    });

    test('should update user information', async () => {
      const updatedUser = await client.updateUser(testUserId, 'Updated Test User', 'updated-test@example.com');
      
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.name).toBe('Updated Test User');
      expect(updatedUser!.email).toBe('updated-test@example.com');
    });

    test('should handle duplicate email error', async () => {
      await expect(client.createUser('Another User', 'updated-test@example.com'))
        .rejects.toThrow('Query execution failed');
    });

    test('should handle update with no fields', async () => {
      await expect(client.updateUser(testUserId)).rejects.toThrow('No fields to update');
    });
  });

  describe('Post CRUD Operations', () => {
    test('should create a new post', async () => {
      const post = await client.createPost(testUserId, 'Test Post', 'This is a test post content');
      testPostId = post.id;

      expect(post.id).toBeDefined();
      expect(post.user_id).toBe(testUserId);
      expect(post.title).toBe('Test Post');
      expect(post.content).toBe('This is a test post content');
      expect(post.created_at).toBeInstanceOf(Date);
    });

    test('should create post without content', async () => {
      const post = await client.createPost(testUserId, 'Post Without Content');
      
      expect(post.title).toBe('Post Without Content');
      expect(post.content).toBeNull();
      
      // Clean up
      await client.deletePost(post.id);
    });

    test('should get post by ID', async () => {
      const post = await client.getPostById(testPostId);
      
      expect(post).not.toBeNull();
      expect(post!.id).toBe(testPostId);
      expect(post!.title).toBe('Test Post');
    });

    test('should return null for non-existent post', async () => {
      const post = await client.getPostById(99999);
      expect(post).toBeNull();
    });

    test('should get posts by user ID', async () => {
      const posts = await client.getPostsByUserId(testUserId);
      expect(posts.length).toBeGreaterThan(0);
      expect(posts.some(p => p.id === testPostId)).toBe(true);
    });

    test('should get all posts with user information', async () => {
      const posts = await client.getAllPostsWithUsers();
      expect(posts.length).toBeGreaterThan(0);
      
      const testPost = posts.find(p => p.id === testPostId);
      expect(testPost).toBeDefined();
      expect(testPost!.user_name).toBe('Updated Test User');
      expect(testPost!.user_email).toBe('updated-test@example.com');
    });

    test('should update post', async () => {
      const updatedPost = await client.updatePost(testPostId, 'Updated Test Post', 'Updated content');
      
      expect(updatedPost).not.toBeNull();
      expect(updatedPost!.title).toBe('Updated Test Post');
      expect(updatedPost!.content).toBe('Updated content');
    });

    test('should handle post update with no fields', async () => {
      await expect(client.updatePost(testPostId)).rejects.toThrow('No fields to update');
    });

    test('should delete post', async () => {
      const deleted = await client.deletePost(testPostId);
      expect(deleted).toBe(true);
      
      const post = await client.getPostById(testPostId);
      expect(post).toBeNull();
      
      testPostId = 0; // Reset so cleanup doesn't try to delete again
    });

    test('should return false when deleting non-existent post', async () => {
      const deleted = await client.deletePost(99999);
      expect(deleted).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle SQL injection attempts safely', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const uniqueEmail = `malicious-${Date.now()}@example.com`;
      
      // This should work safely due to parameterized queries - the malicious input is treated as data
      const user = await client.createUser(maliciousInput, uniqueEmail);
      expect(user.name).toBe(maliciousInput);
      expect(user.email).toBe(uniqueEmail);
      
      // Clean up
      await client.deleteUser(user.id);
    });

    test('should handle invalid foreign key', async () => {
      await expect(client.createPost(99999, 'Invalid Post')).rejects.toThrow();
    });

    test('should handle connection pool statistics', () => {
      const stats = client.getPoolStats();
      expect(stats).not.toBeNull();
      expect(typeof stats!.totalCount).toBe('number');
      expect(typeof stats!.idleCount).toBe('number');
      expect(typeof stats!.waitingCount).toBe('number');
    });
  });

  describe('Schema Initialization', () => {
    test('should initialize schema without errors', async () => {
      await expect(client.initializeSchema()).resolves.not.toThrow();
    });

    test('should have test data after initialization', async () => {
      const users = await client.getAllUsers();
      const posts = await client.getAllPostsWithUsers();
      
      expect(users.length).toBeGreaterThan(0);
      expect(posts.length).toBeGreaterThan(0);
      
      // Check for specific test users
      expect(users.some(u => u.email === 'alice@example.com')).toBe(true);
      expect(users.some(u => u.email === 'bob@example.com')).toBe(true);
      expect(users.some(u => u.email === 'carol@example.com')).toBe(true);
    });
  });
});