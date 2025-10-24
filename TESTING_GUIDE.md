# WebSocket-Database Integration Testing Guide

This guide shows you how to test the WebSocket-Database integration that was implemented in Task 5.

## Prerequisites

1. Make sure PostgreSQL is running and configured (see `.env` file)
2. Build the project: `npm run build`
3. Install dependencies: `npm install`

## Testing Methods

### 1. Automated Integration Tests

Run the comprehensive test suite:

```bash
npm test tests/integration.test.ts
```

This tests:
- ✅ Basic SELECT queries
- ✅ Parameterized queries with `$1`, `$2` syntax
- ✅ Security (dangerous SQL rejection)
- ✅ Error handling for invalid queries
- ✅ Complex JOIN operations
- ✅ Connection recovery
- ✅ Data accuracy validation

### 2. Manual Testing with Web Interface

#### Step 1: Start the WebSocket Server
```bash
node test-websocket-db.js
```

#### Step 2: Open the Web Client
1. Open `src/websocket/client.html` in your browser
2. Connect to `ws://localhost:8080`
3. Use the database query interface

#### Available Query Templates:
- **All Users**: `SELECT * FROM users`
- **All Posts**: `SELECT * FROM posts`
- **Users with Posts**: JOIN query
- **Count Tables**: Count rows in each table

#### Try These Queries:
```sql
-- Basic query
SELECT id, name, email FROM users LIMIT 5;

-- Parameterized query (use params: [1])
SELECT * FROM users WHERE id = $1;

-- JOIN query
SELECT u.name, p.title FROM users u JOIN posts p ON u.id = p.user_id;

-- Aggregate query
SELECT COUNT(*) as total_users FROM users;
```

### 3. Command Line Testing

Run the automated command-line test:

```bash
node test-websocket-client.js
```

This will:
1. Connect to the WebSocket server
2. Send a ping message
3. Execute several SQL queries
4. Test security (dangerous SQL rejection)
5. Display all responses

### 4. Manual WebSocket Testing

You can also test manually using any WebSocket client. Send JSON messages like:

```json
{
  "type": "query",
  "payload": {
    "sql": "SELECT * FROM users LIMIT 3"
  },
  "id": "my_test_query"
}
```

## Expected Behavior

### ✅ Successful Query Response
```json
{
  "type": "result",
  "payload": {
    "sql": "SELECT * FROM users LIMIT 3",
    "rows": [...],
    "rowCount": 3,
    "executionTime": 5,
    "timestamp": "2024-..."
  },
  "id": "my_test_query"
}
```

### ❌ Error Response (Dangerous SQL)
```json
{
  "type": "error",
  "payload": {
    "message": "Query contains potentially dangerous SQL keywords...",
    "code": "DANGEROUS_SQL",
    "sql": "DROP TABLE users"
  },
  "id": "my_test_query"
}
```

### ❌ Error Response (Invalid SQL)
```json
{
  "type": "error",
  "payload": {
    "message": "Database query failed: relation \"bad_table\" does not exist",
    "code": "DATABASE_ERROR",
    "sql": "SELECT * FROM bad_table"
  },
  "id": "my_test_query"
}
```

## Security Features

The integration includes several security measures:

1. **SQL Injection Prevention**: Only SELECT queries allowed
2. **Dangerous Keywords Blocked**: DROP, DELETE, INSERT, UPDATE, etc.
3. **Parameterized Queries**: Support for `$1`, `$2` parameters
4. **Error Handling**: Graceful error responses for invalid queries

## Database Schema

The test database includes:

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Posts Table
```sql
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Troubleshooting

### Connection Issues
- Ensure PostgreSQL is running
- Check `.env` file for correct database credentials
- Verify WebSocket server is running on port 8080

### Query Failures
- Only SELECT queries are allowed for security
- Use parameterized queries for dynamic values
- Check SQL syntax for typos

### Performance
- Query execution times are logged
- Large result sets are handled efficiently
- Connection pooling is used for database connections

## Next Steps

This WebSocket-Database integration provides the foundation for:
- Task 6: WASM integration with the database bridge
- Real-time query execution from WebAssembly modules
- Complete end-to-end data flow testing