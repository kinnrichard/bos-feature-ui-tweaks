/**
 * Monitoring and Analytics for Polymorphic Schema Evolution
 * 
 * Tracks schema changes over time, performance metrics, usage patterns,
 * and provides alerting for missing types and optimization opportunities.
 */

// import type { PolymorphicConfig, PolymorphicAssociation } from './types';
import type { TypeDiscoveryResult, IntrospectionStats } from './database-introspection';

export interface PerformanceMetric {
  timestamp: number;
  operation: string;
  duration: number;
  recordCount?: number;
  success: boolean;
  error?: string;
}

export interface UsageStats {
  associationId: string;
  queryCount: number;
  avgResponseTime: number;
  errorRate: number;
  popularTypes: Array<{ type: string; count: number }>;
  lastUsed: number;
}

export interface SchemaAlert {
  id: string;
  type: 'missing_types' | 'performance_degradation' | 'high_error_rate' | 'unused_association' | 'new_type_discovered';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: any;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  resolvedBy?: string;
}

export interface EvolutionEvent {
  id: string;
  timestamp: number;
  type: 'association_added' | 'association_removed' | 'type_added' | 'type_removed' | 'config_updated';
  before: any;
  after: any;
  source: 'manual' | 'auto_discovery' | 'sync' | 'migration';
  impact: 'low' | 'medium' | 'high';
}

export interface MonitoringReport {
  period: { start: number; end: number };
  overview: {
    totalQueries: number;
    avgResponseTime: number;
    errorRate: number;
    configurationsUpdated: number;
    alertsGenerated: number;
  };
  topAssociations: UsageStats[];
  performanceTrends: PerformanceMetric[];
  evolutionEvents: EvolutionEvent[];
  activeAlerts: SchemaAlert[];
  recommendations: string[];
}

export class PolymorphicMonitoring {
  private metricsStorage = 'zero_polymorphic_metrics';
  private alertsStorage = 'zero_polymorphic_alerts';
  private eventsStorage = 'zero_polymorphic_events';
  
  private metrics: PerformanceMetric[] = [];
  private alerts: SchemaAlert[] = [];
  private evolutionEvents: EvolutionEvent[] = [];
  private usageStats: Map<string, UsageStats> = new Map();
  
  private alertThresholds = {
    responseTime: 1000, // ms
    errorRate: 0.05, // 5%
    unusedDays: 7,
    missingTypeThreshold: 5 // queries to unknown types
  };

  constructor() {
    this.loadStoredData();
    this.startPeriodicCleanup();
  }

  /**
   * Record a performance metric
   */
  recordMetric(operation: string, duration: number, success: boolean, recordCount?: number, error?: string): void {
    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      operation,
      duration,
      recordCount,
      success,
      error
    };

    this.metrics.push(metric);
    this.updateUsageStats(operation, duration, success);
    
    // Check for performance alerts
    this.checkPerformanceThresholds(operation, duration, success);
    
    // Persist metrics (keep last 1000)
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
    
    this.saveMetrics();
  }

  /**
   * Track schema evolution event
   */
  recordEvolutionEvent(
    type: EvolutionEvent['type'],
    before: any,
    after: any,
    source: EvolutionEvent['source'],
    impact: EvolutionEvent['impact'] = 'medium'
  ): void {
    const event: EvolutionEvent = {
      id: this.generateId(),
      timestamp: Date.now(),
      type,
      before,
      after,
      source,
      impact
    };

    this.evolutionEvents.push(event);
    
    // Keep only last 500 events
    if (this.evolutionEvents.length > 500) {
      this.evolutionEvents = this.evolutionEvents.slice(-500);
    }

    this.saveEvents();
    
    // Generate alerts for significant changes
    if (impact === 'high') {
      this.generateAlert(
        'schema_evolution',
        'high',
        `Significant schema change: ${type}`,
        { event }
      );
    }
  }

  /**
   * Monitor type discovery and generate alerts for missing types
   */
  monitorTypeDiscovery(results: TypeDiscoveryResult[]): void {
    for (const result of results) {
      // Alert for low confidence discoveries
      if (result.confidence < 0.3 && result.totalRecords > 10) {
        this.generateAlert(
          'missing_types',
          'medium',
          `Low confidence polymorphic detection in ${result.table}.${result.field}`,
          { result }
        );
      }

      // Alert for new types discovered
      const knownTypes = this.getKnownTypes(result.table, result.field);
      const newTypes = result.discoveredTypes.filter(type => !knownTypes.includes(type));
      
      if (newTypes.length > 0) {
        this.generateAlert(
          'new_type_discovered',
          'low',
          `New polymorphic types discovered: ${newTypes.join(', ')}`,
          { table: result.table, field: result.field, newTypes }
        );
      }
    }
  }

  /**
   * Monitor introspection statistics and generate insights
   */
  monitorIntrospectionStats(stats: IntrospectionStats): void {
    // Alert for empty tables that might need attention
    if (stats.emptyTables.length > 0) {
      this.generateAlert(
        'missing_types',
        'low',
        `Empty tables detected: ${stats.emptyTables.slice(0, 3).join(', ')}${stats.emptyTables.length > 3 ? '...' : ''}`,
        { emptyTables: stats.emptyTables }
      );
    }

    // Track overall health metrics
    const healthScore = this.calculateHealthScore(stats);
    if (healthScore < 0.7) {
      this.generateAlert(
        'performance_degradation',
        'medium',
        `Schema health score below threshold: ${(healthScore * 100).toFixed(1)}%`,
        { healthScore, stats }
      );
    }
  }

  /**
   * Generate monitoring report for a time period
   */
  generateReport(startTime: number, endTime: number): MonitoringReport {
    const periodMetrics = this.metrics.filter(m => 
      m.timestamp >= startTime && m.timestamp <= endTime
    );

    const overview = {
      totalQueries: periodMetrics.length,
      avgResponseTime: this.calculateAverageResponseTime(periodMetrics),
      errorRate: this.calculateErrorRate(periodMetrics),
      configurationsUpdated: this.evolutionEvents.filter(e => 
        e.timestamp >= startTime && e.timestamp <= endTime && e.type === 'config_updated'
      ).length,
      alertsGenerated: this.alerts.filter(a => 
        a.timestamp >= startTime && a.timestamp <= endTime
      ).length
    };

    const topAssociations = Array.from(this.usageStats.values())
      .sort((a, b) => b.queryCount - a.queryCount)
      .slice(0, 10);

    const activeAlerts = this.alerts.filter(a => !a.resolved);
    
    const recommendations = this.generateRecommendations(periodMetrics, topAssociations, activeAlerts);

    return {
      period: { start: startTime, end: endTime },
      overview,
      topAssociations,
      performanceTrends: periodMetrics.slice(-100), // Last 100 metrics
      evolutionEvents: this.evolutionEvents.filter(e => 
        e.timestamp >= startTime && e.timestamp <= endTime
      ),
      activeAlerts,
      recommendations
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): SchemaAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string, resolvedBy?: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      alert.resolvedBy = resolvedBy;
      this.saveAlerts();
      return true;
    }
    return false;
  }

  /**
   * Get performance metrics for specific operation
   */
  getOperationMetrics(operation: string, limit: number = 100): PerformanceMetric[] {
    return this.metrics
      .filter(m => m.operation === operation)
      .slice(-limit);
  }

  /**
   * Get usage statistics for association
   */
  getAssociationUsage(associationId: string): UsageStats | undefined {
    return this.usageStats.get(associationId);
  }

  /**
   * Get schema evolution timeline
   */
  getEvolutionTimeline(): EvolutionEvent[] {
    return [...this.evolutionEvents].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Set alert thresholds
   */
  setAlertThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
  }

  /**
   * Clear old metrics and events
   */
  cleanup(olderThanDays: number = 30): void {
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);
    this.evolutionEvents = this.evolutionEvents.filter(e => e.timestamp > cutoffTime);
    this.alerts = this.alerts.filter(a => a.timestamp > cutoffTime);
    
    this.saveMetrics();
    this.saveEvents();
    this.saveAlerts();
  }

  private updateUsageStats(operation: string, duration: number, success: boolean): void {
    // Extract association ID from operation if possible
    const associationMatch = operation.match(/association[_:](\w+)/);
    if (!associationMatch) return;

    const associationId = associationMatch[1];
    const existing = this.usageStats.get(associationId) || {
      associationId,
      queryCount: 0,
      avgResponseTime: 0,
      errorRate: 0,
      popularTypes: [],
      lastUsed: 0
    };

    existing.queryCount++;
    existing.avgResponseTime = (existing.avgResponseTime * (existing.queryCount - 1) + duration) / existing.queryCount;
    existing.errorRate = success ? existing.errorRate * 0.99 : existing.errorRate * 0.99 + 0.01;
    existing.lastUsed = Date.now();

    this.usageStats.set(associationId, existing);
  }

  private checkPerformanceThresholds(operation: string, duration: number, success: boolean): void {
    // Check response time threshold
    if (duration > this.alertThresholds.responseTime) {
      this.generateAlert(
        'performance_degradation',
        duration > this.alertThresholds.responseTime * 2 ? 'high' : 'medium',
        `Slow query detected: ${operation} took ${duration}ms`,
        { operation, duration }
      );
    }

    // Check error rate
    if (!success) {
      const recentMetrics = this.metrics.slice(-10);
      const errorRate = recentMetrics.filter(m => !m.success).length / recentMetrics.length;
      
      if (errorRate > this.alertThresholds.errorRate) {
        this.generateAlert(
          'high_error_rate',
          'high',
          `High error rate detected: ${(errorRate * 100).toFixed(1)}%`,
          { operation, errorRate }
        );
      }
    }
  }

  private generateAlert(
    type: SchemaAlert['type'],
    severity: SchemaAlert['severity'],
    message: string,
    details: any
  ): void {
    // Check if similar alert already exists and is unresolved
    const existingSimilar = this.alerts.find(a => 
      !a.resolved && 
      a.type === type && 
      a.message === message &&
      Date.now() - a.timestamp < 60000 // Within last minute
    );

    if (existingSimilar) return;

    const alert: SchemaAlert = {
      id: this.generateId(),
      type,
      severity,
      message,
      details,
      timestamp: Date.now(),
      resolved: false
    };

    this.alerts.push(alert);
    this.saveAlerts();

    // Auto-resolve low severity alerts after 24 hours
    if (severity === 'low') {
      setTimeout(() => {
        this.resolveAlert(alert.id, 'auto');
      }, 24 * 60 * 60 * 1000);
    }
  }

  private calculateHealthScore(stats: IntrospectionStats): number {
    let score = 1.0;

    // Penalize for empty tables
    const emptyTableRatio = stats.emptyTables.length / stats.totalTables;
    score -= emptyTableRatio * 0.2;

    // Penalize for low polymorphic coverage
    const polymorphicCoverage = stats.tablesWithPolymorphicFields / stats.totalTables;
    if (polymorphicCoverage < 0.5) {
      score -= (0.5 - polymorphicCoverage) * 0.3;
    }

    // Factor in discovered associations
    if (stats.discoveredAssociations === 0) {
      score -= 0.2;
    }

    return Math.max(0, score);
  }

  private calculateAverageResponseTime(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length;
  }

  private calculateErrorRate(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    const errorCount = metrics.filter(m => !m.success).length;
    return errorCount / metrics.length;
  }

  private generateRecommendations(
    metrics: PerformanceMetric[],
    topAssociations: UsageStats[],
    alerts: SchemaAlert[]
  ): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    const slowQueries = metrics.filter(m => m.duration > this.alertThresholds.responseTime);
    if (slowQueries.length > metrics.length * 0.1) {
      recommendations.push('Consider optimizing database queries - more than 10% of queries are slow');
    }

    // Usage recommendations
    const unusedAssociations = Array.from(this.usageStats.values())
      .filter(stat => Date.now() - stat.lastUsed > this.alertThresholds.unusedDays * 24 * 60 * 60 * 1000);
    
    if (unusedAssociations.length > 0) {
      recommendations.push(`Review unused associations: ${unusedAssociations.map(a => a.associationId).join(', ')}`);
    }

    // Alert-based recommendations
    const missingTypeAlerts = alerts.filter(a => a.type === 'missing_types');
    if (missingTypeAlerts.length > 0) {
      recommendations.push('Review and configure newly discovered polymorphic types');
    }

    const performanceAlerts = alerts.filter(a => a.type === 'performance_degradation');
    if (performanceAlerts.length > 0) {
      recommendations.push('Investigate performance degradation causes and optimize queries');
    }

    return recommendations;
  }

  private getKnownTypes(_table: string, _field: string): string[] {
    // This would typically query the current configuration
    // For now, return empty array as placeholder
    return [];
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startPeriodicCleanup(): void {
    // Clean up old data every 24 hours
    setInterval(() => {
      this.cleanup(30); // Keep 30 days of data
    }, 24 * 60 * 60 * 1000);
  }

  private loadStoredData(): void {
    try {
      const metricsData = localStorage.getItem(this.metricsStorage);
      if (metricsData) {
        this.metrics = JSON.parse(metricsData);
      }

      const alertsData = localStorage.getItem(this.alertsStorage);
      if (alertsData) {
        this.alerts = JSON.parse(alertsData);
      }

      const eventsData = localStorage.getItem(this.eventsStorage);
      if (eventsData) {
        this.evolutionEvents = JSON.parse(eventsData);
      }
    } catch (error) {
      console.warn('Failed to load monitoring data:', error);
    }
  }

  private saveMetrics(): void {
    try {
      localStorage.setItem(this.metricsStorage, JSON.stringify(this.metrics));
    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }

  private saveAlerts(): void {
    try {
      localStorage.setItem(this.alertsStorage, JSON.stringify(this.alerts));
    } catch (error) {
      console.error('Failed to save alerts:', error);
    }
  }

  private saveEvents(): void {
    try {
      localStorage.setItem(this.eventsStorage, JSON.stringify(this.evolutionEvents));
    } catch (error) {
      console.error('Failed to save events:', error);
    }
  }
}

/**
 * Global monitoring instance
 */
export const polymorphicMonitoring = new PolymorphicMonitoring();