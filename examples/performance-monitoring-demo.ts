#!/usr/bin/env npx ts-node

/**
 * Performance Monitoring Demo
 * 
 * This demo showcases the advanced performance monitoring capabilities
 * of the enhanced database client, including:
 * - Query performance tracking
 * - Cache hit rate monitoring
 * - Connection pool utilization
 * - Memory usage tracking
 * - Automated alerting
 */

import { PostgreSQLClient } from '../src/database/client';
import { PerformanceMonitor } from '../src/database/performance-monitor';

async function runPerformanceDemo() {
  console.log('🚀 Starting Performance Monitoring Demo\n');

  // Initialize database client with performance monitoring enabled
  const client = new PostgreSQLClient({
    host: 'localhost',
    port: 5432,
    database: 'wasm_learning',
    user: 'postgres',
    password: 'password',
    enableCache: true,
    cacheMaxSize: 50,
    cacheTtlMs: 300000, // 5 minutes
    enablePerformanceLogging: true,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    // Initialize schema and test data
    await client.initializeSchema();
    console.log('✅ Database schema initialized\n');

    // Demo 1: Query Performance Tracking
    console.log('📊 Demo 1: Query Performance Tracking');
    console.log('=====================================');

    for (let i = 0; i < 10; i++) {
      const startTime = Date.now();
      await client.getAllUsers();
      const duration = Date.now() - startTime;
      console.log(`Query ${i + 1}: ${duration}ms`);
      
      // Add some delay to simulate real usage
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Show initial performance metrics
    const initialMetrics = client.getPerformanceMetrics();
    console.log('\nInitial Performance Metrics:');
    console.log(`- Total queries: ${initialMetrics.queryCount}`);
    console.log(`- Average query time: ${initialMetrics.averageQueryTime.toFixed(2)}ms`);
    console.log(`- Cache hit rate: ${initialMetrics.cacheHitRate.toFixed(1)}%\n`);

    // Demo 2: Cache Performance
    console.log('💾 Demo 2: Cache Performance Testing');
    console.log('====================================');

    // First run - cache misses
    console.log('First run (cache misses):');
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      await client.getAllUsers();
      const duration = Date.now() - startTime;
      console.log(`  Query ${i + 1}: ${duration}ms`);
    }

    // Second run - cache hits
    console.log('\nSecond run (cache hits):');
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      await client.getAllUsers();
      const duration = Date.now() - startTime;
      console.log(`  Query ${i + 1}: ${duration}ms`);
    }

    const cacheStats = client.getCacheStats();
    console.log('\nCache Statistics:');
    console.log(`- Cache size: ${cacheStats.size}/${cacheStats.maxSize}`);
    console.log(`- Hit rate: ${cacheStats.hitRate.toFixed(1)}%`);
    console.log(`- Hits: ${cacheStats.hits}`);
    console.log(`- Misses: ${cacheStats.misses}\n`);

    // Demo 3: Connection Pool Monitoring
    console.log('🔗 Demo 3: Connection Pool Monitoring');
    console.log('=====================================');

    const poolStats = client.getPoolStats();
    if (poolStats) {
      console.log('Connection Pool Statistics:');
      console.log(`- Total connections: ${poolStats.totalCount}`);
      console.log(`- Idle connections: ${poolStats.idleCount}`);
      console.log(`- Waiting connections: ${poolStats.waitingCount}`);
      console.log(`- Utilization: ${((poolStats.totalCount - poolStats.idleCount) / poolStats.totalCount * 100).toFixed(1)}%\n`);
    }

    // Demo 4: Stress Testing
    console.log('⚡ Demo 4: Stress Testing');
    console.log('========================');

    console.log('Running concurrent queries...');
    const concurrentQueries = [];
    for (let i = 0; i < 20; i++) {
      concurrentQueries.push(client.getAllUsers());
    }

    const startTime = Date.now();
    await Promise.all(concurrentQueries);
    const totalTime = Date.now() - startTime;

    console.log(`Completed 20 concurrent queries in ${totalTime}ms`);
    console.log(`Average time per query: ${(totalTime / 20).toFixed(2)}ms\n`);

    // Demo 5: Slow Query Simulation
    console.log('🐌 Demo 5: Slow Query Simulation');
    console.log('=================================');

    console.log('Simulating slow query with pg_sleep...');
    try {
      await client.query('SELECT pg_sleep(2)'); // 2 second delay
      console.log('Slow query completed\n');
    } catch (error) {
      console.log('Slow query failed (this is expected in some environments)\n');
    }

    // Demo 6: Memory Usage Monitoring
    console.log('🧠 Demo 6: Memory Usage Monitoring');
    console.log('==================================');

    const memoryBefore = process.memoryUsage();
    console.log('Memory usage before operations:');
    console.log(`- Heap used: ${(memoryBefore.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`- Heap total: ${(memoryBefore.heapTotal / 1024 / 1024).toFixed(2)}MB`);

    // Create some memory pressure
    const largeData = [];
    for (let i = 0; i < 1000; i++) {
      largeData.push(await client.getAllPostsWithUsers());
    }

    const memoryAfter = process.memoryUsage();
    console.log('\nMemory usage after operations:');
    console.log(`- Heap used: ${(memoryAfter.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`- Heap total: ${(memoryAfter.heapTotal / 1024 / 1024).toFixed(2)}MB`);
    console.log(`- Memory increase: ${((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024).toFixed(2)}MB\n`);

    // Demo 7: Health Checks and Alerts
    console.log('🏥 Demo 7: Health Checks and Alerts');
    console.log('===================================');

    console.log('Running health checks...');
    client.runHealthChecks();

    const detailedMetrics = client.getDetailedMetrics();
    console.log('\nSystem Health Summary:');
    console.log(`- Uptime: ${(detailedMetrics.system.uptime / 60).toFixed(1)} minutes`);
    console.log(`- Total queries: ${detailedMetrics.database.queries.total}`);
    console.log(`- Average query time: ${detailedMetrics.database.queries.averageTime.toFixed(2)}ms`);
    console.log(`- Slow queries: ${detailedMetrics.database.queries.slowQueries}`);
    console.log(`- Cache hit rate: ${detailedMetrics.database.cache.hitRate.toFixed(1)}%`);
    console.log(`- Active alerts: ${detailedMetrics.alerts.length}\n`);

    if (detailedMetrics.alerts.length > 0) {
      console.log('Recent Alerts:');
      detailedMetrics.alerts.forEach((alert, index) => {
        console.log(`${index + 1}. [${alert.severity.toUpperCase()}] ${alert.message}`);
      });
      console.log();
    }

    // Demo 8: Performance Report Generation
    console.log('📋 Demo 8: Performance Report Generation');
    console.log('========================================');

    const performanceReport = client.generatePerformanceReport();
    console.log(performanceReport);

    // Demo 9: Cache Management
    console.log('🗑️  Demo 9: Cache Management');
    console.log('============================');

    console.log('Cache stats before clearing:');
    const statsBefore = client.getCacheStats();
    console.log(`- Size: ${statsBefore.size}`);
    console.log(`- Hit rate: ${statsBefore.hitRate.toFixed(1)}%`);

    client.clearCache();
    console.log('\nCache cleared!');

    const statsAfter = client.getCacheStats();
    console.log('Cache stats after clearing:');
    console.log(`- Size: ${statsAfter.size}`);
    console.log(`- Hit rate: ${statsAfter.hitRate.toFixed(1)}%\n`);

    // Demo 10: Performance Metrics Reset
    console.log('🔄 Demo 10: Performance Metrics Reset');
    console.log('=====================================');

    console.log('Performance metrics before reset:');
    const metricsBefore = client.getPerformanceMetrics();
    console.log(`- Query count: ${metricsBefore.queryCount}`);
    console.log(`- Cache hits: ${metricsBefore.cacheHits}`);

    client.resetPerformanceMetrics();
    console.log('\nPerformance metrics reset!');

    const metricsAfter = client.getPerformanceMetrics();
    console.log('Performance metrics after reset:');
    console.log(`- Query count: ${metricsAfter.queryCount}`);
    console.log(`- Cache hits: ${metricsAfter.cacheHits}\n`);

    console.log('✅ Performance monitoring demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  } finally {
    await client.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Handle command line arguments
const command = process.argv[2];

if (command === 'help' || command === '--help' || command === '-h') {
  console.log(`
Performance Monitoring Demo

Usage:
  npx ts-node examples/performance-monitoring-demo.ts [command]

Commands:
  (none)    Run the full performance monitoring demo
  help      Show this help message

Examples:
  npx ts-node examples/performance-monitoring-demo.ts
  npx ts-node examples/performance-monitoring-demo.ts help

This demo showcases:
- Query performance tracking
- Cache hit rate monitoring  
- Connection pool utilization
- Memory usage tracking
- Automated health checks
- Performance report generation
`);
  process.exit(0);
}

// Run the demo
if (require.main === module) {
  runPerformanceDemo().catch(console.error);
}