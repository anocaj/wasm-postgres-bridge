/**
 * Performance monitoring utilities for database operations
 * Provides detailed metrics, logging, and alerting capabilities
 */

export interface PerformanceAlert {
  type: 'slow_query' | 'high_connection_usage' | 'cache_miss_rate' | 'memory_usage';
  message: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high';
  data?: any;
}

export interface DetailedMetrics {
  database: {
    connectionPool: {
      total: number;
      idle: number;
      waiting: number;
      utilization: number;
    };
    queries: {
      total: number;
      averageTime: number;
      slowQueries: number;
      queriesPerSecond: number;
    };
    cache: {
      hitRate: number;
      size: number;
      maxSize: number;
      memoryUsage: number;
    };
  };
  system: {
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
  };
  alerts: PerformanceAlert[];
}

export class PerformanceMonitor {
  private alerts: PerformanceAlert[] = [];
  private startTime: number = Date.now();
  private queryTimes: number[] = [];
  private lastMetricsCheck: number = Date.now();

  constructor(
    private alertThresholds = {
      slowQueryMs: 1000,
      connectionUtilization: 0.8,
      cacheMissRate: 0.5,
      memoryUsageMB: 500,
    }
  ) {}

  /**
   * Record query execution time
   */
  recordQuery(duration: number): void {
    this.queryTimes.push(duration);
    
    // Keep only last 1000 query times for performance
    if (this.queryTimes.length > 1000) {
      this.queryTimes.shift();
    }

    // Check for slow query alert
    if (duration > this.alertThresholds.slowQueryMs) {
      this.addAlert({
        type: 'slow_query',
        message: `Slow query detected: ${duration}ms`,
        timestamp: Date.now(),
        severity: duration > 5000 ? 'high' : 'medium',
        data: { duration },
      });
    }
  }

  /**
   * Check connection pool utilization
   */
  checkConnectionPool(stats: { totalCount: number; idleCount: number; waitingCount: number }): void {
    const utilization = (stats.totalCount - stats.idleCount) / stats.totalCount;
    
    if (utilization > this.alertThresholds.connectionUtilization) {
      this.addAlert({
        type: 'high_connection_usage',
        message: `High connection pool utilization: ${(utilization * 100).toFixed(1)}%`,
        timestamp: Date.now(),
        severity: utilization > 0.9 ? 'high' : 'medium',
        data: { utilization, stats },
      });
    }
  }

  /**
   * Check cache performance
   */
  checkCachePerformance(cacheStats: { hitRate: number; size: number; maxSize: number }): void {
    const missRate = (100 - cacheStats.hitRate) / 100;
    
    if (missRate > this.alertThresholds.cacheMissRate) {
      this.addAlert({
        type: 'cache_miss_rate',
        message: `High cache miss rate: ${(missRate * 100).toFixed(1)}%`,
        timestamp: Date.now(),
        severity: missRate > 0.8 ? 'high' : 'medium',
        data: { missRate, cacheStats },
      });
    }
  }

  /**
   * Check system memory usage
   */
  checkMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    
    if (heapUsedMB > this.alertThresholds.memoryUsageMB) {
      this.addAlert({
        type: 'memory_usage',
        message: `High memory usage: ${heapUsedMB.toFixed(1)}MB`,
        timestamp: Date.now(),
        severity: heapUsedMB > 1000 ? 'high' : 'medium',
        data: { memoryUsage: memUsage },
      });
    }
  }

  /**
   * Add performance alert
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.shift();
    }

    // Log high severity alerts immediately
    if (alert.severity === 'high') {
      console.warn(`[PERFORMANCE ALERT] ${alert.message}`, alert.data);
    }
  }

  /**
   * Get comprehensive performance metrics
   */
  getDetailedMetrics(
    poolStats: { totalCount: number; idleCount: number; waitingCount: number } | null,
    cacheStats: { hitRate: number; size: number; maxSize: number }
  ): DetailedMetrics {
    const now = Date.now();
    const uptimeSeconds = (now - this.startTime) / 1000;
    const recentQueries = this.queryTimes.filter(time => now - time < 60000); // Last minute
    
    return {
      database: {
        connectionPool: poolStats ? {
          total: poolStats.totalCount,
          idle: poolStats.idleCount,
          waiting: poolStats.waitingCount,
          utilization: (poolStats.totalCount - poolStats.idleCount) / poolStats.totalCount,
        } : {
          total: 0,
          idle: 0,
          waiting: 0,
          utilization: 0,
        },
        queries: {
          total: this.queryTimes.length,
          averageTime: this.queryTimes.length > 0 
            ? this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length 
            : 0,
          slowQueries: this.queryTimes.filter(time => time > this.alertThresholds.slowQueryMs).length,
          queriesPerSecond: recentQueries.length / 60,
        },
        cache: {
          hitRate: cacheStats.hitRate,
          size: cacheStats.size,
          maxSize: cacheStats.maxSize,
          memoryUsage: this.estimateCacheMemoryUsage(cacheStats.size),
        },
      },
      system: {
        memoryUsage: process.memoryUsage(),
        uptime: uptimeSeconds,
      },
      alerts: [...this.alerts],
    };
  }

  /**
   * Estimate cache memory usage (rough calculation)
   */
  private estimateCacheMemoryUsage(cacheSize: number): number {
    // Rough estimate: 1KB per cache entry on average
    return cacheSize * 1024;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(maxAge: number = 3600000): PerformanceAlert[] {
    const cutoff = Date.now() - maxAge;
    return this.alerts.filter(alert => alert.timestamp > cutoff);
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(maxAge: number = 86400000): void {
    const cutoff = Date.now() - maxAge;
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff);
  }

  /**
   * Generate performance report
   */
  generateReport(
    poolStats: { totalCount: number; idleCount: number; waitingCount: number } | null,
    cacheStats: { hitRate: number; size: number; maxSize: number }
  ): string {
    const metrics = this.getDetailedMetrics(poolStats, cacheStats);
    const highAlerts = this.getRecentAlerts().filter(alert => alert.severity === 'high');
    
    return `
=== Database Performance Report ===
Generated: ${new Date().toISOString()}
Uptime: ${(metrics.system.uptime / 3600).toFixed(2)} hours

Connection Pool:
- Total Connections: ${metrics.database.connectionPool.total}
- Idle Connections: ${metrics.database.connectionPool.idle}
- Waiting Connections: ${metrics.database.connectionPool.waiting}
- Utilization: ${(metrics.database.connectionPool.utilization * 100).toFixed(1)}%

Query Performance:
- Total Queries: ${metrics.database.queries.total}
- Average Query Time: ${metrics.database.queries.averageTime.toFixed(2)}ms
- Slow Queries: ${metrics.database.queries.slowQueries}
- Queries/Second: ${metrics.database.queries.queriesPerSecond.toFixed(2)}

Cache Performance:
- Hit Rate: ${metrics.database.cache.hitRate.toFixed(1)}%
- Cache Size: ${metrics.database.cache.size}/${metrics.database.cache.maxSize}
- Memory Usage: ${(metrics.database.cache.memoryUsage / 1024).toFixed(1)}KB

System:
- Heap Used: ${(metrics.system.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)}MB
- Heap Total: ${(metrics.system.memoryUsage.heapTotal / 1024 / 1024).toFixed(1)}MB

High Priority Alerts: ${highAlerts.length}
${highAlerts.map(alert => `- ${alert.message} (${new Date(alert.timestamp).toISOString()})`).join('\n')}
`;
  }
}