/**
 * Model Integration for Polymorphic Tracking System
 * 
 * Provides integration layer between polymorphic tracking system and existing
 * model architecture, connecting the tracking functionality with the existing
 * RelationshipRegistry and Zero.js schema generation.
 * 
 * Key Features:
 * - Integration with existing RelationshipRegistry
 * - Dynamic polymorphic relationship registration
 * - Schema generation integration
 * - Model helper integration
 * 
 * Created: 2025-08-06
 */

import { relationshipRegistry, type RelationshipMetadata } from '../../models/base/scoped-query-base';

// Define core types needed for the new polymorphic system
export interface PolymorphicConfig {
  belongsTo?: Record<string, PolymorphicFieldDefinition>;
  hasMany?: Record<string, PolymorphicFieldDefinition>;
}

export interface PolymorphicFieldDefinition {
  typeField: string;
  idField: string;
  allowedTypes: string[];
}

// Simple polymorphic registry for the new system
class PolymorphicRegistryCore {
  private static instance: PolymorphicRegistryCore;
  private configs = new Map<string, PolymorphicConfig>();

  static getInstance(): PolymorphicRegistryCore {
    if (!PolymorphicRegistryCore.instance) {
      PolymorphicRegistryCore.instance = new PolymorphicRegistryCore();
    }
    return PolymorphicRegistryCore.instance;
  }

  register(tableName: string, config: PolymorphicConfig): void {
    this.configs.set(tableName, config);
  }

  getConfig(tableName: string): PolymorphicConfig | null {
    return this.configs.get(tableName) || null;
  }

  getAllRegisteredTables(): string[] {
    return Array.from(this.configs.keys());
  }
}

// Global instance for the new polymorphic registry
export const polymorphicRegistry = PolymorphicRegistryCore.getInstance();

/**
 * Extended relationship metadata for polymorphic relationships
 */
export interface PolymorphicRelationshipMetadata extends RelationshipMetadata {
  isPolymorphic: true;
  polymorphicType: 'belongsTo' | 'hasMany';
  typeField: string;
  idField: string;
  allowedTypes?: string[];
}

/**
 * Integration manager for polymorphic tracking with existing model system
 */
export class PolymorphicModelIntegration {
  private static instance: PolymorphicModelIntegration;

  static getInstance(): PolymorphicModelIntegration {
    if (!PolymorphicModelIntegration.instance) {
      PolymorphicModelIntegration.instance = new PolymorphicModelIntegration();
    }
    return PolymorphicModelIntegration.instance;
  }

  /**
   * Register polymorphic relationships with the existing RelationshipRegistry
   * This extends the current system to understand polymorphic relationships
   */
  registerPolymorphicRelationships(tableName: string): void {
    const config = polymorphicRegistry.getConfig(tableName);
    if (!config) return;

    const relationships: Record<string, PolymorphicRelationshipMetadata> = {};

    // Process polymorphic belongsTo relationships
    if (config.belongsTo) {
      for (const [fieldName, fieldConfig] of Object.entries(config.belongsTo)) {
        relationships[fieldName] = {
          type: 'belongsTo',
          model: 'polymorphic',
          isPolymorphic: true,
          polymorphicType: 'belongsTo',
          typeField: fieldConfig.typeField,
          idField: fieldConfig.idField,
          allowedTypes: fieldConfig.allowedTypes
        };

        // Register individual typed relationships for includes() validation
        if (fieldConfig.allowedTypes) {
          for (const allowedType of fieldConfig.allowedTypes) {
            const typedRelationshipName = `${fieldName}${this.capitalizeFirst(allowedType)}`;
            relationships[typedRelationshipName] = {
              type: 'belongsTo',
              model: allowedType,
              isPolymorphic: true,
              polymorphicType: 'belongsTo',
              typeField: fieldConfig.typeField,
              idField: fieldConfig.idField
            };
          }
        }
      }
    }

    // Process polymorphic hasMany relationships
    if (config.hasMany) {
      for (const [fieldName, fieldConfig] of Object.entries(config.hasMany)) {
        relationships[fieldName] = {
          type: 'hasMany',
          model: 'polymorphic',
          isPolymorphic: true,
          polymorphicType: 'hasMany',
          typeField: fieldConfig.typeField,
          idField: fieldConfig.idField,
          allowedTypes: fieldConfig.allowedTypes
        };

        // Register individual typed relationships for includes() validation
        if (fieldConfig.allowedTypes) {
          for (const allowedType of fieldConfig.allowedTypes) {
            const typedRelationshipName = `${fieldName}${this.capitalizeFirst(allowedType)}`;
            relationships[typedRelationshipName] = {
              type: 'hasMany',
              model: allowedType,
              isPolymorphic: true,
              polymorphicType: 'hasMany',
              typeField: fieldConfig.typeField,
              idField: fieldConfig.idField
            };
          }
        }
      }
    }

    // Register with existing RelationshipRegistry
    relationshipRegistry.register(tableName, relationships);
  }

  /**
   * Generate Zero.js relationship configuration from polymorphic config
   * Returns the relationships object that can be used in Zero.js schema
   */
  generateZeroRelationships(tableName: string): Record<string, any> | null {
    const config = polymorphicRegistry.getConfig(tableName);
    if (!config) return null;

    const zeroRelationships: Record<string, any> = {};

    // Process polymorphic belongsTo relationships
    if (config.belongsTo) {
      for (const [fieldName, fieldConfig] of Object.entries(config.belongsTo)) {
        if (fieldConfig.allowedTypes) {
          // Create individual typed relationships for Zero.js
          for (const allowedType of fieldConfig.allowedTypes) {
            const relationshipName = `${fieldName}${this.capitalizeFirst(allowedType)}`;
            const targetTable = this.getTableName(allowedType);
            
            zeroRelationships[relationshipName] = {
              type: 'one',
              sourceField: [fieldConfig.idField],
              destField: ['id'],
              destSchema: targetTable,
              // Add polymorphic filter condition
              where: {
                [fieldConfig.typeField]: allowedType
              }
            };
          }
        }
      }
    }

    // Process polymorphic hasMany relationships  
    if (config.hasMany) {
      for (const [fieldName, fieldConfig] of Object.entries(config.hasMany)) {
        if (fieldConfig.allowedTypes) {
          // Create individual typed relationships for Zero.js
          for (const allowedType of fieldConfig.allowedTypes) {
            const relationshipName = `${fieldName}${this.capitalizeFirst(allowedType)}`;
            const targetTable = this.getTableName(allowedType);
            
            zeroRelationships[relationshipName] = {
              type: 'many',
              sourceField: ['id'],
              destSchema: targetTable,
              destField: [fieldConfig.idField],
              // Add polymorphic filter condition
              where: {
                [fieldConfig.typeField]: allowedType
              }
            };
          }
        }
      }
    }

    return Object.keys(zeroRelationships).length > 0 ? zeroRelationships : null;
  }

  /**
   * Get all polymorphic-aware relationships for a table
   * Combines regular relationships with polymorphic ones
   */
  getAllRelationships(tableName: string): string[] {
    const regularRelationships = relationshipRegistry.getValidRelationships(tableName);
    const polymorphicConfig = polymorphicRegistry.getConfig(tableName);
    
    if (!polymorphicConfig) return regularRelationships;

    const polymorphicRelationships: string[] = [];

    // Add polymorphic belongsTo relationships
    if (polymorphicConfig.belongsTo) {
      for (const [fieldName, fieldConfig] of Object.entries(polymorphicConfig.belongsTo)) {
        polymorphicRelationships.push(fieldName);
        
        if (fieldConfig.allowedTypes) {
          for (const allowedType of fieldConfig.allowedTypes) {
            polymorphicRelationships.push(`${fieldName}${this.capitalizeFirst(allowedType)}`);
          }
        }
      }
    }

    // Add polymorphic hasMany relationships
    if (polymorphicConfig.hasMany) {
      for (const [fieldName, fieldConfig] of Object.entries(polymorphicConfig.hasMany)) {
        polymorphicRelationships.push(fieldName);
        
        if (fieldConfig.allowedTypes) {
          for (const allowedType of fieldConfig.allowedTypes) {
            polymorphicRelationships.push(`${fieldName}${this.capitalizeFirst(allowedType)}`);
          }
        }
      }
    }

    return [...regularRelationships, ...polymorphicRelationships];
  }

  /**
   * Validate polymorphic relationship exists and is properly configured
   */
  validatePolymorphicRelationship(tableName: string, relationshipName: string): boolean {
    const config = polymorphicRegistry.getConfig(tableName);
    if (!config) return false;

    // Check if it's a direct polymorphic relationship
    if (config.belongsTo?.[relationshipName] || config.hasMany?.[relationshipName]) {
      return true;
    }

    // Check if it's a typed polymorphic relationship (e.g., "loggableJob")
    for (const [fieldName, fieldConfig] of Object.entries(config.belongsTo || {})) {
      if (fieldConfig.allowedTypes) {
        for (const allowedType of fieldConfig.allowedTypes) {
          const typedName = `${fieldName}${this.capitalizeFirst(allowedType)}`;
          if (relationshipName === typedName) {
            return true;
          }
        }
      }
    }

    for (const [fieldName, fieldConfig] of Object.entries(config.hasMany || {})) {
      if (fieldConfig.allowedTypes) {
        for (const allowedType of fieldConfig.allowedTypes) {
          const typedName = `${fieldName}${this.capitalizeFirst(allowedType)}`;
          if (relationshipName === typedName) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Get polymorphic metadata for a relationship
   */
  getPolymorphicMetadata(tableName: string, relationshipName: string): PolymorphicRelationshipMetadata | null {
    const config = polymorphicRegistry.getConfig(tableName);
    if (!config) return null;

    // Check belongsTo relationships
    if (config.belongsTo?.[relationshipName]) {
      const fieldConfig = config.belongsTo[relationshipName];
      return {
        type: 'belongsTo',
        model: 'polymorphic',
        isPolymorphic: true,
        polymorphicType: 'belongsTo',
        typeField: fieldConfig.typeField,
        idField: fieldConfig.idField,
        allowedTypes: fieldConfig.allowedTypes
      };
    }

    // Check hasMany relationships
    if (config.hasMany?.[relationshipName]) {
      const fieldConfig = config.hasMany[relationshipName];
      return {
        type: 'hasMany',
        model: 'polymorphic',
        isPolymorphic: true,
        polymorphicType: 'hasMany',
        typeField: fieldConfig.typeField,
        idField: fieldConfig.idField,
        allowedTypes: fieldConfig.allowedTypes
      };
    }

    // Check typed relationships
    for (const [fieldName, fieldConfig] of Object.entries(config.belongsTo || {})) {
      if (fieldConfig.allowedTypes) {
        for (const allowedType of fieldConfig.allowedTypes) {
          const typedName = `${fieldName}${this.capitalizeFirst(allowedType)}`;
          if (relationshipName === typedName) {
            return {
              type: 'belongsTo',
              model: allowedType,
              isPolymorphic: true,
              polymorphicType: 'belongsTo',
              typeField: fieldConfig.typeField,
              idField: fieldConfig.idField
            };
          }
        }
      }
    }

    for (const [fieldName, fieldConfig] of Object.entries(config.hasMany || {})) {
      if (fieldConfig.allowedTypes) {
        for (const allowedType of fieldConfig.allowedTypes) {
          const typedName = `${fieldName}${this.capitalizeFirst(allowedType)}`;
          if (relationshipName === typedName) {
            return {
              type: 'hasMany',
              model: allowedType,
              isPolymorphic: true,
              polymorphicType: 'hasMany',
              typeField: fieldConfig.typeField,
              idField: fieldConfig.idField
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Initialize polymorphic integration for all registered models
   */
  initializeAll(): void {
    const registeredTables = polymorphicRegistry.getAllRegisteredTables();
    
    for (const tableName of registeredTables) {
      this.registerPolymorphicRelationships(tableName);
    }
  }

  /**
   * Helper to capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Convert model type to table name
   * This should match the Rails naming conventions
   */
  private getTableName(modelType: string): string {
    // Simple pluralization - in real app, might want more sophisticated
    // pluralization rules or a mapping table
    const irregular: Record<string, string> = {
      'person': 'people',
      'child': 'children'
    };

    const lower = modelType.toLowerCase();
    if (irregular[lower]) {
      return irregular[lower];
    }

    // Simple pluralization rules
    if (lower.endsWith('y')) {
      return lower.slice(0, -1) + 'ies';
    } else if (lower.endsWith('s') || lower.endsWith('sh') || lower.endsWith('ch')) {
      return lower + 'es';
    } else {
      return lower + 's';
    }
  }
}

/**
 * Global instance for easy access
 */
export const polymorphicModelIntegration = PolymorphicModelIntegration.getInstance();