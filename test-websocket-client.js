#!/usr/bin/env node

/**
 * Command-line WebSocket client for testing
 */

const WebSocket = require("ws");

async function testWebSocketClient() {
  console.log("🔌 Connecting to WebSocket server...");

  const ws = new WebSocket("ws://localhost:8080");

  ws.on("open", () => {
    console.log("✅ Connected to WebSocket server");

    // Test 1: Ping
    console.log("\n📤 Test 1: Sending ping...");
    ws.send(
      JSON.stringify({
        type: "ping",
        payload: "Hello from command line!",
        id: "test_ping",
      })
    );

    // Test 2: Simple query after a delay
    setTimeout(() => {
      console.log("\n📤 Test 2: Querying users...");
      ws.send(
        JSON.stringify({
          type: "query",
          payload: {
            sql: "SELECT id, name, email FROM users LIMIT 3",
          },
          id: "test_users",
        })
      );
    }, 1000);

    // Test 3: Parameterized query
    setTimeout(() => {
      console.log("\n📤 Test 3: Parameterized query...");
      ws.send(
        JSON.stringify({
          type: "query",
          payload: {
            sql: "SELECT COUNT(*) as user_count FROM users WHERE id > $1",
            params: [0],
          },
          id: "test_count",
        })
      );
    }, 2000);

    // Test 4: Invalid query (should fail)
    setTimeout(() => {
      console.log("\n📤 Test 4: Invalid query (should fail)...");
      ws.send(
        JSON.stringify({
          type: "query",
          payload: {
            sql: "DROP TABLE users",
          },
          id: "test_dangerous",
        })
      );
    }, 3000);

    // Close after tests
    setTimeout(() => {
      console.log("\n🔚 Closing connection...");
      ws.close();
    }, 4000);
  });

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`\n📥 Received (${message.id}):`);

      if (message.type === "result") {
        console.log(`   Type: ${message.type}`);
        console.log(`   Rows: ${message.payload.rowCount || "N/A"}`);
        console.log(
          `   Execution Time: ${message.payload.executionTime || "N/A"}ms`
        );
        if (message.payload.rows && message.payload.rows.length > 0) {
          console.log(`   Sample Data:`, message.payload.rows[0]);
        }
      } else if (message.type === "error") {
        console.log(`   Type: ${message.type}`);
        console.log(`   Error: ${message.payload.message}`);
        console.log(`   Code: ${message.payload.code}`);
      } else {
        console.log(`   Type: ${message.type}`);
        console.log(`   Payload:`, message.payload);
      }
    } catch (error) {
      console.log(`📥 Raw message: ${data}`);
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`\n🔌 Connection closed: ${code} - ${reason}`);
    process.exit(0);
  });

  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error);
    process.exit(1);
  });
}

testWebSocketClient();
