/**
 * Polymorphic Utility Functions
 *
 * Helper utilities for common polymorphic operations:
 * - Type conversion and validation
 * - Relationship name generation
 * - Schema analysis helpers
 * - Configuration management
 * - Integration utilities
 *
 * Generated: 2025-08-06 Epic-008 Polymorphic Tracking
 */

import type { PolymorphicType, PolymorphicTargetMetadata, PolymorphicConfig } from './types';
import { getPolymorphicTracker } from './tracker';
// import { getPolymorphicRegistry } from './registry';
import { debugDatabase } from '../../utils/debug';

/**
 * Relationship naming utilities
 */
export class RelationshipNamer {
  /**
   * Generate polymorphic relationship name
   * e.g., ('loggable', 'Job') -> 'loggableJob'
   */
  static generatePolymorphicRelationshipName(
    polymorphicType: PolymorphicType,
    modelName: string
  ): string {
    return `${polymorphicType}${modelName}`;
  }

  /**
   * Generate reverse relationship name
   * e.g., 'activity_logs' -> 'activityLogs'
   */
  static generateReverseRelationshipName(sourceTableName: string): string {
    return sourceTableName.replace(/_(.)/g, (_, char) => char.toUpperCase());
  }

  /**
   * Parse polymorphic relationship name to extract components
   * e.g., 'loggableJob' -> { polymorphicType: 'loggable', modelName: 'Job' }
   */
  static parsePolymorphicRelationshipName(relationshipName: string): {
    polymorphicType: PolymorphicType | null;
    modelName: string | null;
  } {
    const polymorphicTypes: PolymorphicType[] = [
      'notable',
      'loggable',
      'schedulable',
      'target',
      'parseable',
    ];

    for (const type of polymorphicTypes) {
      if (relationshipName.startsWith(type)) {
        const modelName = relationshipName.slice(type.length);
        return {
          polymorphicType: type,
          modelName: modelName || null,
        };
      }
    }

    return {
      polymorphicType: null,
      modelName: null,
    };
  }

  /**
   * Generate field names for polymorphic relationships
   */
  static generatePolymorphicFieldNames(polymorphicType: PolymorphicType): {
    idField: string;
    typeField: string;
  } {
    return {
      idField: `${polymorphicType}_id`,
      typeField: `${polymorphicType}_type`,
    };
  }
}

/**
 * Type conversion utilities
 */
export class TypeConverter {
  /**
   * Convert table name to model name (snake_case to PascalCase)
   * e.g., 'job_assignments' -> 'JobAssignment'
   */
  static tableToModelName(tableName: string): string {
    return tableName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')
      .replace(/s$/, ''); // Remove trailing 's' for pluralization
  }

  /**
   * Convert model name to table name (PascalCase to snake_case)
   * e.g., 'JobAssignment' -> 'job_assignments'
   */
  static modelToTableName(modelName: string): string {
    return (
      modelName
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .slice(1) + 's'
    ); // Add 's' for pluralization
  }

  /**
   * Convert model name to singular table name (for polymorphic type values)
   * e.g., 'JobAssignment' -> 'JobAssignment'
   */
  static modelToPolymorphicTypeName(modelName: string): string {
    return modelName;
  }

  /**
   * Convert table name to polymorphic type value
   * e.g., 'jobs' -> 'Job'
   */
  static tableToPolymorphicTypeName(tableName: string): string {
    return this.tableToModelName(tableName);
  }
}

/**
 * Validation utilities
 */
export class PolymorphicValidator {
  /**
   * Validate polymorphic type
   */
  static isValidPolymorphicType(type: string): type is PolymorphicType {
    const validTypes: PolymorphicType[] = [
      'notable',
      'loggable',
      'schedulable',
      'target',
      'parseable',
    ];
    return validTypes.includes(type as PolymorphicType);
  }

  /**
   * Validate table name format
   */
  static isValidTableName(tableName: string): boolean {
    if (!tableName || tableName.length === 0) {
      return false;
    }

    // Check basic format: lowercase letters, numbers, underscores
    const validTablePattern = /^[a-z][a-z0-9_]*[a-z0-9]$/;
    return validTablePattern.test(tableName);
  }

  /**
   * Validate model name format
   */
  static isValidModelName(modelName: string): boolean {
    if (!modelName || modelName.length === 0) {
      return false;
    }

    // Check PascalCase format
    const validModelPattern = /^[A-Z][a-zA-Z0-9]*$/;
    return validModelPattern.test(modelName);
  }

  /**
   * Validate polymorphic target metadata
   */
  static validateTargetMetadata(metadata: PolymorphicTargetMetadata): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!this.isValidModelName(metadata.modelName)) {
      errors.push(`Invalid model name: ${metadata.modelName}`);
    }

    if (!this.isValidTableName(metadata.tableName)) {
      errors.push(`Invalid table name: ${metadata.tableName}`);
    }

    if (!metadata.discoveredAt || !this.isValidISODate(metadata.discoveredAt)) {
      errors.push('Invalid discoveredAt timestamp');
    }

    if (!metadata.lastVerifiedAt || !this.isValidISODate(metadata.lastVerifiedAt)) {
      errors.push('Invalid lastVerifiedAt timestamp');
    }

    if (!['generated-schema', 'manual', 'runtime'].includes(metadata.source)) {
      errors.push(`Invalid source: ${metadata.source}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate ISO date string
   */
  private static isValidISODate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime()) && dateString === date.toISOString();
  }
}

/**
 * Configuration utilities
 */
export class ConfigUtils {
  /**
   * Create default polymorphic target metadata
   */
  static createDefaultTargetMetadata(
    modelName: string,
    tableName: string,
    source: 'generated-schema' | 'manual' | 'runtime' = 'manual'
  ): PolymorphicTargetMetadata {
    const now = new Date().toISOString();

    return {
      modelName,
      tableName,
      discoveredAt: now,
      lastVerifiedAt: now,
      active: true,
      source,
    };
  }

  /**
   * Merge polymorphic configurations
   */
  static mergeConfigs(
    base: PolymorphicConfig,
    updates: Partial<PolymorphicConfig>
  ): PolymorphicConfig {
    const merged: PolymorphicConfig = {
      ...base,
      associations: { ...base.associations },
      metadata: { ...base.metadata },
    };

    if (updates.associations) {
      for (const [type, association] of Object.entries(updates.associations)) {
        merged.associations[type as PolymorphicType] = {
          ...merged.associations[type as PolymorphicType],
          ...association,
          validTargets: {
            ...merged.associations[type as PolymorphicType]?.validTargets,
            ...association.validTargets,
          },
        };
      }
    }

    if (updates.metadata) {
      merged.metadata = { ...merged.metadata, ...updates.metadata };
    }

    // Update timestamps
    merged.metadata.updatedAt = new Date().toISOString();
    merged.metadata.totalAssociations = Object.keys(merged.associations).length;
    merged.metadata.totalTargets = Object.values(merged.associations).reduce(
      (total, assoc) => total + Object.keys(assoc.validTargets).length,
      0
    );

    return merged;
  }

  /**
   * Extract summary from polymorphic configuration
   */
  static getConfigSummary(config: PolymorphicConfig): {
    totalAssociations: number;
    totalTargets: number;
    activeTargets: number;
    inactiveTargets: number;
    associationBreakdown: Record<PolymorphicType, number>;
  } {
    const associationBreakdown = {} as Record<PolymorphicType, number>;
    let activeTargets = 0;
    let inactiveTargets = 0;

    for (const [type, association] of Object.entries(config.associations)) {
      const targets = Object.values(association.validTargets);
      associationBreakdown[type as PolymorphicType] = targets.length;

      activeTargets += targets.filter((t) => t.active).length;
      inactiveTargets += targets.filter((t) => !t.active).length;
    }

    return {
      totalAssociations: config.metadata.totalAssociations,
      totalTargets: config.metadata.totalTargets,
      activeTargets,
      inactiveTargets,
      associationBreakdown,
    };
  }
}

/**
 * Integration utilities for working with existing systems
 */
export class IntegrationUtils {
  /**
   * Generate Zero.js relationship configuration from polymorphic config
   */
  static generateZeroJsRelationships(
    polymorphicType: PolymorphicType,
    sourceTableName: string,
    options: {
      includeReverse?: boolean;
      includeInactive?: boolean;
    } = {}
  ): Record<string, any> {
    const tracker = getPolymorphicTracker();
    const validTargets = tracker.getValidTargets(polymorphicType, {
      includeInactive: options.includeInactive,
    });

    const relationships: Record<string, any> = {};

    // Generate forward relationships (e.g., loggableJob, loggableTask)
    for (const tableName of validTargets) {
      const metadata = tracker.getTargetMetadata(polymorphicType, tableName);
      if (!metadata || (!metadata.active && !options.includeInactive)) {
        continue;
      }

      const relationshipName = RelationshipNamer.generatePolymorphicRelationshipName(
        polymorphicType,
        metadata.modelName
      );

      const fieldNames = RelationshipNamer.generatePolymorphicFieldNames(polymorphicType);

      relationships[relationshipName] = {
        sourceField: [fieldNames.idField],
        destField: ['id'],
        destSchema: tableName, // This would reference the actual Zero.js schema
      };
    }

    return relationships;
  }

  /**
   * Generate Rails-style polymorphic belongs_to relationship
   */
  static generateRailsPolymorphicRelationship(
    polymorphicType: PolymorphicType,
    _sourceTableName: string
  ): {
    relationshipName: string;
    options: {
      polymorphic: true;
      foreign_key: string;
      foreign_type: string;
    };
  } {
    const fieldNames = RelationshipNamer.generatePolymorphicFieldNames(polymorphicType);

    return {
      relationshipName: polymorphicType,
      options: {
        polymorphic: true,
        foreign_key: fieldNames.idField,
        foreign_type: fieldNames.typeField,
      },
    };
  }

  /**
   * Convert existing hardcoded relationships to polymorphic configuration
   */
  static convertHardcodedToPolymorphic(hardcodedRelationships: Record<string, any>): {
    polymorphicType: PolymorphicType | null;
    targets: Array<{
      modelName: string;
      tableName: string;
      relationshipName: string;
    }>;
  } {
    const targets: Array<{
      modelName: string;
      tableName: string;
      relationshipName: string;
    }> = [];

    let polymorphicType: PolymorphicType | null = null;

    for (const [relationshipName] of Object.entries(hardcodedRelationships)) {
      const parsed = RelationshipNamer.parsePolymorphicRelationshipName(relationshipName);

      if (parsed.polymorphicType && parsed.modelName) {
        if (!polymorphicType) {
          polymorphicType = parsed.polymorphicType;
        } else if (polymorphicType !== parsed.polymorphicType) {
          debugDatabase.warn('Mixed polymorphic types in relationship set', {
            existing: polymorphicType,
            found: parsed.polymorphicType,
          });
        }

        targets.push({
          modelName: parsed.modelName,
          tableName: TypeConverter.modelToTableName(parsed.modelName),
          relationshipName,
        });
      }
    }

    return { polymorphicType, targets };
  }
}

/**
 * Debug and logging utilities
 */
export class PolymorphicDebugUtils {
  /**
   * Log polymorphic configuration summary
   */
  static logConfigSummary(config: PolymorphicConfig): void {
    const summary = ConfigUtils.getConfigSummary(config);

    debugDatabase('Polymorphic Configuration Summary', {
      ...summary,
      configVersion: config.metadata.configVersion,
      lastUpdated: config.metadata.updatedAt,
    });

    for (const [type, count] of Object.entries(summary.associationBreakdown)) {
      debugDatabase(`Polymorphic type '${type}' has ${count} targets`);
    }
  }

  /**
   * Validate entire polymorphic system
   */
  static async validateSystem(): Promise<{
    trackerValid: boolean;
    registryValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const tracker = getPolymorphicTracker();
      // const registry = getPolymorphicRegistry();

      // Validate tracker
      const trackerValidation = tracker.validate();
      if (!trackerValidation.valid) {
        errors.push(...trackerValidation.errors.map((e) => e.message));
      }
      warnings.push(...trackerValidation.warnings.map((w) => w.message));

      return {
        trackerValid: trackerValidation.valid,
        registryValid: true, // Registry doesn't have built-in validation yet
        errors,
        warnings,
      };
    } catch (error) {
      errors.push(`System validation failed: ${error}`);
      return {
        trackerValid: false,
        registryValid: false,
        errors,
        warnings,
      };
    }
  }
}

/**
 * Export all utilities for easy access
 */
export const PolymorphicUtils = {
  RelationshipNamer,
  TypeConverter,
  PolymorphicValidator,
  ConfigUtils,
  IntegrationUtils,
  PolymorphicDebugUtils,
};

/**
 * Convenience functions for common operations
 */

/**
 * Quick check if a relationship name is polymorphic
 */
export function isPolymorphicRelationshipName(relationshipName: string): boolean {
  const parsed = RelationshipNamer.parsePolymorphicRelationshipName(relationshipName);
  return parsed.polymorphicType !== null;
}

/**
 * Quick generation of polymorphic relationship name
 */
export function createPolymorphicRelationshipName(
  polymorphicType: PolymorphicType,
  modelName: string
): string {
  return RelationshipNamer.generatePolymorphicRelationshipName(polymorphicType, modelName);
}

/**
 * Quick validation of polymorphic target
 */
export function validatePolymorphicTarget(
  polymorphicType: PolymorphicType,
  modelName: string,
  tableName: string
): boolean {
  return (
    PolymorphicValidator.isValidPolymorphicType(polymorphicType) &&
    PolymorphicValidator.isValidModelName(modelName) &&
    PolymorphicValidator.isValidTableName(tableName)
  );
}
