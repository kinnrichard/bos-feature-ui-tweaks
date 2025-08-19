/**
 * Database Introspection for Polymorphic Type Discovery
 * 
 * Queries Zero.js data to discover polymorphic types, track usage patterns,
 * and handle empty database scenarios gracefully.
 */

import type { Zero } from '@rocicorp/zero';
import type { PolymorphicConfig, PolymorphicAssociation } from './types';

export interface TypeDiscoveryResult {
  table: string;
  field: string;
  discoveredTypes: string[];
  totalRecords: number;
  typeDistribution: Record<string, number>;
  confidence: number; // 0-1 score based on data quality
}

export interface IntrospectionStats {
  totalTables: number;
  tablesWithPolymorphicFields: number;
  totalPolymorphicTypes: number;
  discoveredAssociations: number;
  emptyTables: string[];
  timestamp: number;
}

export interface FieldAnalysis {
  fieldName: string;
  distinctValues: string[];
  valueCount: number;
  isLikelyPolymorphic: boolean;
  confidence: number;
  patterns: {
    hasClassPattern: boolean; // ends with class names like 'User', 'Post'
    hasTypePattern: boolean;  // contains 'type' in field name
    hasConsistentCasing: boolean;
    hasReasonableVariety: boolean; // not too many, not too few types
  };
}

export class DatabaseIntrospection {
  private zero: Zero;
  private typeCache: Map<string, TypeDiscoveryResult> = new Map();
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes
  private lastCacheTime: number = 0;

  constructor(zero: Zero) {
    this.zero = zero;
  }

  /**
   * Discover all polymorphic types across the database
   */
  async discoverPolymorphicTypes(config?: PolymorphicConfig): Promise<TypeDiscoveryResult[]> {
    const results: TypeDiscoveryResult[] = [];
    
    // Use existing config as a starting point if provided
    const knownAssociations = config?.associations || [];
    const processedFields = new Set<string>();

    // First, check known associations
    for (const association of knownAssociations) {
      const key = `${association.table}.${association.typeField}`;
      if (!processedFields.has(key)) {
        const result = await this.analyzePolymorphicField(
          association.table, 
          association.typeField
        );
        if (result) {
          results.push(result);
          processedFields.add(key);
        }
      }
    }

    // Then discover new potential polymorphic fields
    const tables = await this.getAllTables();
    
    for (const table of tables) {
      const fields = await this.analyzeTableFields(table);
      
      for (const field of fields) {
        const key = `${table}.${field.fieldName}`;
        
        if (!processedFields.has(key) && field.isLikelyPolymorphic) {
          const result = await this.analyzePolymorphicField(table, field.fieldName);
          if (result && result.confidence > 0.5) {
            results.push(result);
            processedFields.add(key);
          }
        }
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze a specific table.field for polymorphic types
   */
  async analyzePolymorphicField(table: string, field: string): Promise<TypeDiscoveryResult | null> {
    const cacheKey = `${table}.${field}`;
    
    // Check cache
    if (this.isCacheValid() && this.typeCache.has(cacheKey)) {
      return this.typeCache.get(cacheKey)!;
    }

    try {
      // Query all records for this table
      const query = this.zero.query[table as keyof typeof this.zero.query];
      if (!query) {
        console.warn(`Table ${table} not found in Zero schema`);
        return null;
      }

      const records = await query.run();
      
      if (!Array.isArray(records) || records.length === 0) {
        return {
          table,
          field,
          discoveredTypes: [],
          totalRecords: 0,
          typeDistribution: {},
          confidence: 0
        };
      }

      // Extract and analyze field values
      const fieldValues: string[] = [];
      const typeDistribution: Record<string, number> = {};
      
      for (const record of records) {
        const value = record[field];
        if (value && typeof value === 'string') {
          fieldValues.push(value);
          typeDistribution[value] = (typeDistribution[value] || 0) + 1;
        }
      }

      const discoveredTypes = Array.from(new Set(fieldValues));
      const confidence = this.calculateConfidence(discoveredTypes, records.length);

      const result: TypeDiscoveryResult = {
        table,
        field,
        discoveredTypes,
        totalRecords: records.length,
        typeDistribution,
        confidence
      };

      // Cache the result
      this.typeCache.set(cacheKey, result);
      this.lastCacheTime = Date.now();

      return result;
    } catch (error) {
      console.error(`Failed to analyze polymorphic field ${table}.${field}:`, error);
      return null;
    }
  }

  /**
   * Get comprehensive introspection statistics
   */
  async getIntrospectionStats(): Promise<IntrospectionStats> {
    const tables = await this.getAllTables();
    const polymorphicTables = new Set<string>();
    const emptyTables: string[] = [];
    let totalPolymorphicTypes = 0;
    let discoveredAssociations = 0;

    for (const table of tables) {
      try {
        const query = this.zero.query[table as keyof typeof this.zero.query];
        const records = await query?.run();
        
        if (!records || records.length === 0) {
          emptyTables.push(table);
          continue;
        }

        const fields = await this.analyzeTableFields(table);
        const polymorphicFields = fields.filter(f => f.isLikelyPolymorphic);
        
        if (polymorphicFields.length > 0) {
          polymorphicTables.add(table);
          discoveredAssociations += polymorphicFields.length;
          
          for (const field of polymorphicFields) {
            totalPolymorphicTypes += field.distinctValues.length;
          }
        }
      } catch (error) {
        console.warn(`Failed to analyze table ${table}:`, error);
      }
    }

    return {
      totalTables: tables.length,
      tablesWithPolymorphicFields: polymorphicTables.size,
      totalPolymorphicTypes,
      discoveredAssociations,
      emptyTables,
      timestamp: Date.now()
    };
  }

  /**
   * Detect new polymorphic associations not in current config
   */
  async detectNewAssociations(config: PolymorphicConfig): Promise<PolymorphicAssociation[]> {
    const discoveredTypes = await this.discoverPolymorphicTypes(config);
    const existingAssociations = new Set(
      config.associations.map(a => `${a.table}.${a.typeField}`)
    );

    const newAssociations: PolymorphicAssociation[] = [];

    for (const result of discoveredTypes) {
      const key = `${result.table}.${result.field}`;
      
      if (!existingAssociations.has(key) && result.confidence > 0.7) {
        // Try to infer the ID field
        const idField = await this.inferIdField(result.table, result.field);
        
        if (idField) {
          newAssociations.push({
            id: `${result.table}_${result.field}`,
            table: result.table,
            typeField: result.field,
            idField,
            types: result.discoveredTypes.reduce((acc, type) => {
              acc[type] = this.inferTargetTable(type);
              return acc;
            }, {} as Record<string, string>)
          });
        }
      }
    }

    return newAssociations;
  }

  /**
   * Track type usage statistics over time
   */
  async getTypeUsageStats(table: string, field: string): Promise<{
    total: number;
    byType: Record<string, number>;
    trends: {
      mostUsed: string;
      leastUsed: string;
      diversity: number; // Shannon diversity index
    };
  }> {
    const result = await this.analyzePolymorphicField(table, field);
    
    if (!result) {
      return {
        total: 0,
        byType: {},
        trends: { mostUsed: '', leastUsed: '', diversity: 0 }
      };
    }

    const sortedTypes = Object.entries(result.typeDistribution)
      .sort(([, a], [, b]) => b - a);

    const diversity = this.calculateDiversity(result.typeDistribution);

    return {
      total: result.totalRecords,
      byType: result.typeDistribution,
      trends: {
        mostUsed: sortedTypes[0]?.[0] || '',
        leastUsed: sortedTypes[sortedTypes.length - 1]?.[0] || '',
        diversity
      }
    };
  }

  /**
   * Clear introspection cache
   */
  clearCache(): void {
    this.typeCache.clear();
    this.lastCacheTime = 0;
  }

  private async getAllTables(): Promise<string[]> {
    // Extract table names from Zero.js query object
    try {
      const queryKeys = Object.keys(this.zero.query);
      return queryKeys.filter(key => typeof this.zero.query[key as keyof typeof this.zero.query] === 'object');
    } catch (error) {
      console.error('Failed to get table list:', error);
      return [];
    }
  }

  private async analyzeTableFields(table: string): Promise<FieldAnalysis[]> {
    try {
      const query = this.zero.query[table as keyof typeof this.zero.query];
      if (!query) return [];

      const records = await query.run();
      if (!records || records.length === 0) return [];

      const firstRecord = records[0];
      const fields: FieldAnalysis[] = [];

      for (const [fieldName, value] of Object.entries(firstRecord)) {
        if (typeof value === 'string') {
          const analysis = await this.analyzeField(table, fieldName, records);
          fields.push(analysis);
        }
      }

      return fields;
    } catch (error) {
      console.error(`Failed to analyze fields for table ${table}:`, error);
      return [];
    }
  }

  private async analyzeField(table: string, fieldName: string, records: any[]): Promise<FieldAnalysis> {
    const values = records
      .map(record => record[fieldName])
      .filter(value => value && typeof value === 'string');

    const distinctValues = Array.from(new Set(values));
    const patterns = this.analyzeFieldPatterns(fieldName, distinctValues);
    
    const isLikelyPolymorphic = this.isFieldPolymorphic(fieldName, distinctValues, patterns);
    const confidence = this.calculateFieldConfidence(fieldName, distinctValues, patterns);

    return {
      fieldName,
      distinctValues,
      valueCount: values.length,
      isLikelyPolymorphic,
      confidence,
      patterns
    };
  }

  private analyzeFieldPatterns(fieldName: string, values: string[]) {
    const hasTypePattern = /type|kind|class|category/i.test(fieldName);
    const hasClassPattern = values.some(value => /^[A-Z][a-zA-Z]+$/.test(value));
    const hasConsistentCasing = values.every(value => 
      value === value.toLowerCase() || 
      value === value.toUpperCase() || 
      /^[A-Z][a-z]+$/.test(value)
    );
    const hasReasonableVariety = values.length >= 2 && values.length <= 20;

    return {
      hasClassPattern,
      hasTypePattern,
      hasConsistentCasing,
      hasReasonableVariety
    };
  }

  private isFieldPolymorphic(fieldName: string, values: string[], patterns: any): boolean {
    if (values.length < 2) return false;
    
    return (
      patterns.hasTypePattern ||
      (patterns.hasClassPattern && patterns.hasReasonableVariety) ||
      (patterns.hasConsistentCasing && patterns.hasReasonableVariety && values.length <= 10)
    );
  }

  private calculateFieldConfidence(fieldName: string, values: string[], patterns: any): number {
    let confidence = 0;

    if (patterns.hasTypePattern) confidence += 0.4;
    if (patterns.hasClassPattern) confidence += 0.3;
    if (patterns.hasConsistentCasing) confidence += 0.2;
    if (patterns.hasReasonableVariety) confidence += 0.1;

    // Bonus for common polymorphic field names
    if (/^(type|kind|class|category)(_type|_kind)?$/i.test(fieldName)) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1);
  }

  private calculateConfidence(types: string[], totalRecords: number): number {
    if (types.length < 2 || totalRecords === 0) return 0;
    
    // Factors that increase confidence:
    // - Reasonable number of types (2-20)
    // - Good distribution of records
    // - Class-like naming patterns
    
    let confidence = 0.5;
    
    // Type variety score
    if (types.length >= 2 && types.length <= 10) confidence += 0.2;
    else if (types.length <= 20) confidence += 0.1;
    
    // Naming pattern score
    const hasClassNames = types.some(type => /^[A-Z][a-zA-Z]+$/.test(type));
    if (hasClassNames) confidence += 0.2;
    
    // Distribution score (not too many records of one type)
    const maxTypeRatio = Math.max(...types.map(type => 
      types.filter(t => t === type).length / totalRecords
    ));
    if (maxTypeRatio < 0.8) confidence += 0.1;
    
    return Math.min(confidence, 1);
  }

  private calculateDiversity(distribution: Record<string, number>): number {
    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    if (total === 0) return 0;

    let diversity = 0;
    for (const count of Object.values(distribution)) {
      const p = count / total;
      if (p > 0) {
        diversity -= p * Math.log2(p);
      }
    }

    return diversity;
  }

  private async inferIdField(table: string, typeField: string): Promise<string | null> {
    // Common ID field patterns
    const commonIdFields = [
      `${typeField.replace(/type$/i, '')}id`,
      `${typeField.replace(/type$/i, '')}_id`,
      'target_id',
      'reference_id',
      'entity_id',
      'id'
    ];

    try {
      const query = this.zero.query[table as keyof typeof this.zero.query];
      const records = await query?.run();
      
      if (!records || records.length === 0) return null;

      const firstRecord = records[0];
      
      // Find the first matching ID field
      for (const idField of commonIdFields) {
        if (idField in firstRecord) {
          return idField;
        }
      }

      // Fallback to any field ending in 'id'
      const idFields = Object.keys(firstRecord).filter(key => key.toLowerCase().endsWith('id'));
      return idFields[0] || null;
    } catch (error) {
      console.error(`Failed to infer ID field for ${table}:`, error);
      return null;
    }
  }

  private inferTargetTable(typeName: string): string {
    // Convert type name to likely table name
    // This is heuristic-based and may need customization
    const tableName = typeName.toLowerCase();
    
    // Add common pluralization rules
    if (tableName.endsWith('y')) {
      return tableName.slice(0, -1) + 'ies';
    } else if (tableName.endsWith('s')) {
      return tableName + 'es';
    } else {
      return tableName + 's';
    }
  }

  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheTime < this.cacheExpiry;
  }
}

/**
 * Create database introspection instance
 */
export function createDatabaseIntrospection(zero: Zero): DatabaseIntrospection {
  return new DatabaseIntrospection(zero);
}