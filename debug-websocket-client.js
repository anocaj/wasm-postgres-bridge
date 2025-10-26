const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', function open() {
  console.log('Connected to secure WebSocket server');
  
  // First authenticate
  const authMessage = {
    type: 'auth',
    payload: {
      username: 'admin',
      password: 'admin123'
    },
    id: Date.now().toString()
  };
  
  console.log('Sending auth message:', JSON.stringify(authMessage));
  ws.send(JSON.stringify(authMessage));
});

ws.on('message', function message(data) {
  const msg = JSON.parse(data.toString());
  console.log('Received:', JSON.stringify(msg, null, 2));
  
  // If authentication successful, send query
  if (msg.type === 'result' && msg.payload.user) {
    console.log('Authentication successful, sending query...');
    
    const queryMessage = {
      type: 'query',
      payload: {
        sql: "INSERT INTO users (name, email) VALUES ('Debug Test', 'debug@test.com') RETURNING *;",
        params: []
      },
      id: Date.now().toString()
    };
    
    console.log('Sending query message:', JSON.stringify(queryMessage));
    ws.send(JSON.stringify(queryMessage));
  }
});

ws.on('error', function error(err) {
  console.error('WebSocket error:', err);
});

ws.on('close', function close() {
  console.log('Connection closed');
});