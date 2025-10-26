#!/usr/bin/env node

/**
 * Verification script to check if the project setup is complete
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying WASM-PostgreSQL Learning Project Setup...\n');

const requiredFiles = [
  'package.json',
  'tsconfig.json',
  'jest.config.js',
  'docker-compose.yml',
  '.env.example',
  'src/index.ts',
  'src/database/client.ts',
  'src/database/schema.sql',
  'src/websocket/server.ts',
  'src/websocket/client.html',
  'src/wasm/loader.ts',
  'src/integration/bridge.ts',
  'tests/setup.ts',
  'tests/database.test.ts',
  'tests/websocket.test.ts',
  'tests/wasm.test.ts',
  'tests/integration.test.ts',
  'scripts/setup-db.sh',
  'README.md'
];

const requiredDirectories = [
  'src',
  'src/database',
  'src/websocket',
  'src/wasm',
  'src/integration',
  'tests',
  'scripts',
  'examples',
  'wasm'
];

let allGood = true;

// Check directories
console.log('📁 Checking directories...');
requiredDirectories.forEach(dir => {
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    console.log(`  ✅ ${dir}/`);
  } else {
    console.log(`  ❌ ${dir}/ - MISSING`);
    allGood = false;
  }
});

console.log('\n📄 Checking files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    allGood = false;
  }
});

// Check if node_modules exists
console.log('\n📦 Checking dependencies...');
if (fs.existsSync('node_modules')) {
  console.log('  ✅ node_modules/ - Dependencies installed');
} else {
  console.log('  ❌ node_modules/ - Run "npm install"');
  allGood = false;
}

// Check if dist exists (after build)
console.log('\n🔨 Checking build output...');
if (fs.existsSync('dist')) {
  console.log('  ✅ dist/ - Project built successfully');
} else {
  console.log('  ⚠️  dist/ - Run "npm run build" to create build output');
}

console.log('\n' + '='.repeat(50));

if (allGood) {
  console.log('🎉 Project setup is complete!');
  console.log('\nNext steps:');
  console.log('1. Copy .env.example to .env');
  console.log('2. Run ./scripts/setup-db.sh to start PostgreSQL');
  console.log('3. Begin implementing Database client');
} else {
  console.log('❌ Project setup is incomplete. Please fix the missing items above.');
  process.exit(1);
}

console.log('\n📚 Ready to start learning WASM and PostgreSQL integration!');