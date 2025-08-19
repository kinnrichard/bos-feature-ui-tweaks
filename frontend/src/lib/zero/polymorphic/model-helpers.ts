/**
 * Model Helpers for Polymorphic Relationships
 * 
 * Provides helper methods for models to declare polymorphic capabilities
 * and interact with the polymorphic tracking system. These helpers make
 * it easy for models to declare their polymorphic relationships and 
 * provide type-safe querying capabilities.
 * 
 * Key Features:
 * - Declarative polymorphic relationship configuration
 * - Automatic relationship registration
 * - Type-safe polymorphic querying helpers
 * - Integration with existing model architecture
 * 
 * Created: 2025-08-06
 */

import { polymorphicRegistry, polymorphicModelIntegration, type PolymorphicConfig, type PolymorphicFieldDefinition } from './model-integration';
import type { RelationshipMetadata } from '../../models/base/scoped-query-base';

/**
 * Configuration for declaring polymorphic relationships in models
 */
export interface ModelPolymorphicConfig {
  tableName: string;
  belongsTo?: Record<string, {
    typeField: string;
    idField: string;
    allowedTypes: string[];
  }>;
  hasMany?: Record<string, {
    typeField: string;
    idField: string;
    allowedTypes: string[];
  }>;
}

/**
 * Result type for polymorphic queries
 */
export interface PolymorphicQueryResult<T = any> {
  type: string;
  id: string;
  data?: T;
}

/**
 * Polymorphic relationship declaration helper
 * Use this in model classes to declare polymorphic capabilities
 */
export function declarePolymorphicRelationships(config: ModelPolymorphicConfig): void {
  const { tableName, belongsTo, hasMany } = config;

  // Convert to polymorphic registry format
  const polymorphicConfig: PolymorphicConfig = {};

  if (belongsTo) {
    polymorphicConfig.belongsTo = {};
    for (const [fieldName, fieldConfig] of Object.entries(belongsTo)) {
      polymorphicConfig.belongsTo[fieldName] = {
        typeField: fieldConfig.typeField,
        idField: fieldConfig.idField,
        allowedTypes: fieldConfig.allowedTypes
      };
    }
  }

  if (hasMany) {
    polymorphicConfig.hasMany = {};
    for (const [fieldName, fieldConfig] of Object.entries(hasMany)) {
      polymorphicConfig.hasMany[fieldName] = {
        typeField: fieldConfig.typeField,
        idField: fieldConfig.idField,
        allowedTypes: fieldConfig.allowedTypes
      };
    }
  }

  // Register with polymorphic registry
  polymorphicRegistry.register(tableName, polymorphicConfig);

  // Integrate with relationship registry
  polymorphicModelIntegration.registerPolymorphicRelationships(tableName);
}

/**
 * Helper to declare a polymorphic belongsTo relationship
 */
export function belongsToPolymorphic(
  tableName: string,
  fieldName: string,
  options: {
    typeField: string;
    idField: string;
    allowedTypes: string[];
  }
): void {
  declarePolymorphicRelationships({
    tableName,
    belongsTo: {
      [fieldName]: options
    }
  });
}

/**
 * Helper to declare a polymorphic hasMany relationship
 */
export function hasManyPolymorphic(
  tableName: string,
  fieldName: string,
  options: {
    typeField: string;
    idField: string;
    allowedTypes: string[];
  }
): void {
  declarePolymorphicRelationships({
    tableName,
    hasMany: {
      [fieldName]: options
    }
  });
}

/**
 * Create polymorphic includes helper for a specific model
 * This creates typed helper methods for polymorphic relationships
 */
export function createPolymorphicIncludes(tableName: string) {
  const config = polymorphicRegistry.getConfig(tableName);
  
  const helpers = {
    /**
     * Include a polymorphic belongsTo relationship by type
     */
    includePolymorphicBelongsTo: (
      fieldName: string, 
      type: string
    ): string => {
      if (!config?.belongsTo?.[fieldName]) {
        throw new Error(`No polymorphic belongsTo relationship '${fieldName}' found for ${tableName}`);
      }

      const fieldConfig = config.belongsTo[fieldName];
      if (!fieldConfig.allowedTypes.includes(type)) {
        throw new Error(`Type '${type}' not allowed for polymorphic relationship '${fieldName}'. Allowed types: ${fieldConfig.allowedTypes.join(', ')}`);
      }

      return `${fieldName}${capitalizeFirst(type)}`;
    },

    /**
     * Include a polymorphic hasMany relationship by type
     */
    includePolymorphicHasMany: (
      fieldName: string, 
      type: string
    ): string => {
      if (!config?.hasMany?.[fieldName]) {
        throw new Error(`No polymorphic hasMany relationship '${fieldName}' found for ${tableName}`);
      }

      const fieldConfig = config.hasMany[fieldName];
      if (!fieldConfig.allowedTypes.includes(type)) {
        throw new Error(`Type '${type}' not allowed for polymorphic relationship '${fieldName}'. Allowed types: ${fieldConfig.allowedTypes.join(', ')}`);
      }

      return `${fieldName}${capitalizeFirst(type)}`;
    },

    /**
     * Get all available polymorphic relationship types
     */
    getPolymorphicTypes: (fieldName: string): string[] => {
      const belongsToConfig = config?.belongsTo?.[fieldName];
      const hasManyConfig = config?.hasMany?.[fieldName];
      
      if (belongsToConfig) {
        return belongsToConfig.allowedTypes;
      } else if (hasManyConfig) {
        return hasManyConfig.allowedTypes;
      } else {
        throw new Error(`No polymorphic relationship '${fieldName}' found for ${tableName}`);
      }
    },

    /**
     * Check if a polymorphic relationship is valid
     */
    isValidPolymorphicRelationship: (fieldName: string, type: string): boolean => {
      const belongsToConfig = config?.belongsTo?.[fieldName];
      const hasManyConfig = config?.hasMany?.[fieldName];
      
      if (belongsToConfig) {
        return belongsToConfig.allowedTypes.includes(type);
      } else if (hasManyConfig) {
        return hasManyConfig.allowedTypes.includes(type);
      }
      
      return false;
    },

    /**
     * Get polymorphic field configuration
     */
    getPolymorphicConfig: (fieldName: string): PolymorphicFieldDefinition | null => {
      const belongsToConfig = config?.belongsTo?.[fieldName];
      const hasManyConfig = config?.hasMany?.[fieldName];
      
      return belongsToConfig || hasManyConfig || null;
    }
  };

  return helpers;
}

/**
 * Extract polymorphic information from a record
 */
export function extractPolymorphicInfo<T extends Record<string, any>>(
  record: T,
  fieldName: string,
  tableName: string
): PolymorphicQueryResult | null {
  const config = polymorphicRegistry.getConfig(tableName);
  const fieldConfig = config?.belongsTo?.[fieldName] || config?.hasMany?.[fieldName];
  
  if (!fieldConfig) {
    return null;
  }

  const typeValue = record[fieldConfig.typeField];
  const idValue = record[fieldConfig.idField];

  if (!typeValue || !idValue) {
    return null;
  }

  return {
    type: typeValue,
    id: idValue
  };
}

/**
 * Create polymorphic query conditions for Zero.js
 * This helps build where clauses for polymorphic queries
 */
export function createPolymorphicConditions(
  fieldName: string,
  type: string,
  id: string,
  tableName: string
): Record<string, any> | null {
  const config = polymorphicRegistry.getConfig(tableName);
  const fieldConfig = config?.belongsTo?.[fieldName] || config?.hasMany?.[fieldName];
  
  if (!fieldConfig) {
    return null;
  }

  return {
    [fieldConfig.typeField]: type,
    [fieldConfig.idField]: id
  };
}

/**
 * Validate polymorphic field values
 */
export function validatePolymorphicValues(
  fieldName: string,
  type: string,
  id: string,
  tableName: string
): boolean {
  const config = polymorphicRegistry.getConfig(tableName);
  const fieldConfig = config?.belongsTo?.[fieldName] || config?.hasMany?.[fieldName];
  
  if (!fieldConfig) {
    return false;
  }

  // Check if type is allowed
  if (!fieldConfig.allowedTypes.includes(type)) {
    return false;
  }

  // Basic validation - in real app might want to validate ID format
  return Boolean(type && id);
}

/**
 * Migration helper to convert existing hardcoded relationships
 * to polymorphic declarations
 */
export function migrateToPolymorphic(
  tableName: string,
  relationships: Record<string, RelationshipMetadata>,
  polymorphicFields: Array<{
    fieldName: string;
    typeField: string;
    idField: string;
    relationshipPattern: RegExp;
  }>
): ModelPolymorphicConfig {
  const config: ModelPolymorphicConfig = {
    tableName,
    belongsTo: {},
    hasMany: {}
  };

  // Analyze existing relationships to identify polymorphic patterns
  for (const field of polymorphicFields) {
    const matchingRelationships: string[] = [];
    const allowedTypes: string[] = [];

    // Find relationships that match the pattern
    for (const [relationshipName] of Object.entries(relationships)) {
      const match = relationshipName.match(field.relationshipPattern);
      if (match && match[1]) {
        matchingRelationships.push(relationshipName);
        allowedTypes.push(match[1].toLowerCase());
      }
    }

    if (matchingRelationships.length > 0) {
      const relationshipType = relationships[matchingRelationships[0]].type;
      
      if (relationshipType === 'belongsTo') {
        config.belongsTo![field.fieldName] = {
          typeField: field.typeField,
          idField: field.idField,
          allowedTypes
        };
      } else if (relationshipType === 'hasMany') {
        config.hasMany![field.fieldName] = {
          typeField: field.typeField,
          idField: field.idField,
          allowedTypes
        };
      }
    }
  }

  return config;
}

/**
 * Utility functions
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Type guards for polymorphic relationships
 */
export function isPolymorphicBelongsTo(
  tableName: string,
  fieldName: string
): boolean {
  const config = polymorphicRegistry.getConfig(tableName);
  return Boolean(config?.belongsTo?.[fieldName]);
}

export function isPolymorphicHasMany(
  tableName: string,
  fieldName: string
): boolean {
  const config = polymorphicRegistry.getConfig(tableName);
  return Boolean(config?.hasMany?.[fieldName]);
}

export function isPolymorphicRelationship(
  tableName: string,
  fieldName: string
): boolean {
  return isPolymorphicBelongsTo(tableName, fieldName) || isPolymorphicHasMany(tableName, fieldName);
}

/**
 * Export commonly used helpers
 */
export { capitalizeFirst as capitalize };