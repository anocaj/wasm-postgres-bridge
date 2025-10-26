-- Database schema for WASM-PostgreSQL learning project

-- Simple learning schema
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some test data for learning purposes
INSERT INTO users (name, email) VALUES 
  ('Alice Johnson', 'alice@example.com'),
  ('Bob Smith', 'bob@example.com'),
  ('Carol Davis', 'carol@example.com')
ON CONFLICT (email) DO NOTHING;

INSERT INTO posts (user_id, title, content) VALUES 
  (1, 'First Post', 'This is Alice''s first post about learning WASM and PostgreSQL.'),
  (1, 'WASM Adventures', 'Exploring WebAssembly compilation and execution.'),
  (2, 'Database Connections', 'Learning about PostgreSQL connection patterns.'),
  (3, 'Integration Testing', 'Testing the complete WASM to database flow.')
ON CONFLICT DO NOTHING;