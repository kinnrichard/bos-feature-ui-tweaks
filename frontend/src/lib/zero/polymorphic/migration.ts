/**
 * Migration Utilities for Polymorphic Relationships
 * 
 * Provides utilities to migrate from hardcoded polymorphic relationships
 * to the dynamic polymorphic tracking system. Includes tools to extract
 * existing configurations, validate migrations, and generate new config.
 * 
 * Key Features:
 * - Extract hardcoded polymorphic relationships from existing schema
 * - Generate initial polymorphic configuration from current setup
 * - Validate migrated configurations
 * - Provide migration scripts and guidance
 * 
 * Created: 2025-08-06
 */

import { polymorphicRegistry } from './model-integration';
import { polymorphicSchemaGenerator } from './schema-generator';
import { declarePolymorphicRelationships, type ModelPolymorphicConfig } from './model-helpers';
import type { RelationshipMetadata } from '../../models/base/scoped-query-base';

/**
 * Migration analysis result
 */
export interface MigrationAnalysis {
  tablesWithPolymorphicPatterns: string[];
  detectedPatterns: PolymorphicPattern[];
  suggestedConfigurations: Record<string, ModelPolymorphicConfig>;
  migrationInstructions: string[];
  validationErrors: string[];
}

/**
 * Detected polymorphic pattern
 */
export interface PolymorphicPattern {
  tableName: string;
  fieldName: string;
  relationshipType: 'belongsTo' | 'hasMany';
  typeField: string;
  idField: string;
  detectedTypes: string[];
  relationships: string[];
}

/**
 * Migration configuration options
 */
export interface MigrationOptions {
  dryRun?: boolean;
  backupExisting?: boolean;
  validateOnly?: boolean;
  includeSchemaGeneration?: boolean;
  outputPath?: string;
}

/**
 * Polymorphic migration manager
 */
export class PolymorphicMigration {
  private static instance: PolymorphicMigration;

  static getInstance(): PolymorphicMigration {
    if (!PolymorphicMigration.instance) {
      PolymorphicMigration.instance = new PolymorphicMigration();
    }
    return PolymorphicMigration.instance;
  }

  /**
   * Analyze existing codebase for polymorphic patterns
   */
  analyzeExistingPolymorphicPatterns(): MigrationAnalysis {
    const analysis: MigrationAnalysis = {
      tablesWithPolymorphicPatterns: [],
      detectedPatterns: [],
      suggestedConfigurations: {},
      migrationInstructions: [],
      validationErrors: []
    };

    // Known polymorphic patterns from the existing schema
    const knownPatterns = this.getKnownPolymorphicPatterns();
    
    for (const pattern of knownPatterns) {
      analysis.detectedPatterns.push(pattern);
      
      if (!analysis.tablesWithPolymorphicPatterns.includes(pattern.tableName)) {
        analysis.tablesWithPolymorphicPatterns.push(pattern.tableName);
      }

      // Generate suggested configuration
      const config = this.createConfigurationFromPattern(pattern);
      if (config) {
        if (!analysis.suggestedConfigurations[pattern.tableName]) {
          analysis.suggestedConfigurations[pattern.tableName] = config;
        } else {
          // Merge configurations for same table
          this.mergeConfigurations(analysis.suggestedConfigurations[pattern.tableName], config);
        }
      }
    }

    // Generate migration instructions
    analysis.migrationInstructions = this.generateMigrationInstructions(analysis);

    return analysis;
  }

  /**
   * Extract hardcoded polymorphic relationships from existing relationships
   */
  extractHardcodedPatterns(
    tableName: string,
    relationships: Record<string, RelationshipMetadata>
  ): PolymorphicPattern[] {
    const patterns: PolymorphicPattern[] = [];

    // Common polymorphic patterns to look for
    const commonPatterns = [
      { field: 'loggable', regex: /^loggable([A-Z][a-z]+)$/, typeField: 'loggable_type', idField: 'loggable_id' },
      { field: 'notable', regex: /^notable([A-Z][a-z]+)$/, typeField: 'notable_type', idField: 'notable_id' },
      { field: 'schedulable', regex: /^schedulable([A-Z][a-z]+)$/, typeField: 'schedulable_type', idField: 'schedulable_id' },
      { field: 'commentable', regex: /^commentable([A-Z][a-z]+)$/, typeField: 'commentable_type', idField: 'commentable_id' },
      { field: 'taggable', regex: /^taggable([A-Z][a-z]+)$/, typeField: 'taggable_type', idField: 'taggable_id' }
    ];

    for (const patternDef of commonPatterns) {
      const matchingRelationships: string[] = [];
      const detectedTypes: string[] = [];

      for (const [relationshipName] of Object.entries(relationships)) {
        const match = relationshipName.match(patternDef.regex);
        if (match && match[1]) {
          matchingRelationships.push(relationshipName);
          detectedTypes.push(match[1]);
        }
      }

      if (matchingRelationships.length > 0) {
        // Determine relationship type from first match
        const firstRelationship = relationships[matchingRelationships[0]];
        
        patterns.push({
          tableName,
          fieldName: patternDef.field,
          relationshipType: firstRelationship.type as 'belongsTo' | 'hasMany',
          typeField: patternDef.typeField,
          idField: patternDef.idField,
          detectedTypes,
          relationships: matchingRelationships
        });
      }
    }

    return patterns;
  }

  /**
   * Generate migration configuration from existing setup
   */
  generateMigrationConfiguration(options: MigrationOptions = {}): MigrationAnalysis {
    const analysis = this.analyzeExistingPolymorphicPatterns();

    if (options.validateOnly) {
      analysis.validationErrors = this.validateMigrationConfiguration(analysis);
    }

    if (options.includeSchemaGeneration) {
      // Add schema generation instructions
      const schemaInstructions = this.generateSchemaInstructions(analysis);
      analysis.migrationInstructions.push(...schemaInstructions);
    }

    return analysis;
  }

  /**
   * Execute migration (dry run or actual)
   */
  executeMigration(
    configurations: Record<string, ModelPolymorphicConfig>,
    options: MigrationOptions = {}
  ): { success: boolean; errors: string[]; results: string[] } {
    const results: string[] = [];
    const errors: string[] = [];

    for (const [tableName, config] of Object.entries(configurations)) {
      try {
        if (options.dryRun) {
          results.push(`[DRY RUN] Would register polymorphic config for ${tableName}`);
          results.push(`  - BelongsTo: ${Object.keys(config.belongsTo || {}).join(', ')}`);
          results.push(`  - HasMany: ${Object.keys(config.hasMany || {}).join(', ')}`);
        } else {
          // Actually register the configuration
          declarePolymorphicRelationships(config);
          results.push(`Successfully registered polymorphic config for ${tableName}`);
        }
      } catch (error) {
        errors.push(`Failed to register polymorphic config for ${tableName}: ${error.message}`);
      }
    }

    return {
      success: errors.length === 0,
      errors,
      results
    };
  }

  /**
   * Validate migration configuration
   */
  validateMigrationConfiguration(analysis: MigrationAnalysis): string[] {
    const errors: string[] = [];

    for (const [tableName, config] of Object.entries(analysis.suggestedConfigurations)) {
      // Validate belongsTo configurations
      if (config.belongsTo) {
        for (const [fieldName, fieldConfig] of Object.entries(config.belongsTo)) {
          if (!fieldConfig.typeField || !fieldConfig.idField) {
            errors.push(`${tableName}.${fieldName}: Missing typeField or idField`);
          }
          
          if (!fieldConfig.allowedTypes || fieldConfig.allowedTypes.length === 0) {
            errors.push(`${tableName}.${fieldName}: No allowed types specified`);
          }
        }
      }

      // Validate hasMany configurations
      if (config.hasMany) {
        for (const [fieldName, fieldConfig] of Object.entries(config.hasMany)) {
          if (!fieldConfig.typeField || !fieldConfig.idField) {
            errors.push(`${tableName}.${fieldName}: Missing typeField or idField`);
          }
          
          if (!fieldConfig.allowedTypes || fieldConfig.allowedTypes.length === 0) {
            errors.push(`${tableName}.${fieldName}: No allowed types specified`);
          }
        }
      }
    }

    return errors;
  }

  /**
   * Generate code for implementing the migration
   */
  generateMigrationCode(configurations: Record<string, ModelPolymorphicConfig>): string {
    const lines: string[] = [];

    lines.push('// Auto-generated polymorphic migration code');
    lines.push('// Add this to your model initialization');
    lines.push('');
    lines.push('import { declarePolymorphicRelationships } from \'@/lib/zero/polymorphic/model-helpers\';');
    lines.push('');

    for (const [tableName, config] of Object.entries(configurations)) {
      lines.push(`// Polymorphic configuration for ${tableName}`);
      lines.push('declarePolymorphicRelationships({');
      lines.push(`  tableName: '${tableName}',`);
      
      if (config.belongsTo && Object.keys(config.belongsTo).length > 0) {
        lines.push('  belongsTo: {');
        for (const [fieldName, fieldConfig] of Object.entries(config.belongsTo)) {
          lines.push(`    ${fieldName}: {`);
          lines.push(`      typeField: '${fieldConfig.typeField}',`);
          lines.push(`      idField: '${fieldConfig.idField}',`);
          lines.push(`      allowedTypes: [${fieldConfig.allowedTypes.map(t => `'${t}'`).join(', ')}]`);
          lines.push('    },');
        }
        lines.push('  },');
      }

      if (config.hasMany && Object.keys(config.hasMany).length > 0) {
        lines.push('  hasMany: {');
        for (const [fieldName, fieldConfig] of Object.entries(config.hasMany)) {
          lines.push(`    ${fieldName}: {`);
          lines.push(`      typeField: '${fieldConfig.typeField}',`);
          lines.push(`      idField: '${fieldConfig.idField}',`);
          lines.push(`      allowedTypes: [${fieldConfig.allowedTypes.map(t => `'${t}'`).join(', ')}]`);
          lines.push('    },');
        }
        lines.push('  }');
      }

      lines.push('});');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Get known polymorphic patterns from the current schema
   */
  private getKnownPolymorphicPatterns(): PolymorphicPattern[] {
    return [
      {
        tableName: 'notes',
        fieldName: 'notable',
        relationshipType: 'belongsTo',
        typeField: 'notable_type',
        idField: 'notable_id',
        detectedTypes: ['Job', 'Task', 'Client'],
        relationships: ['notableJob', 'notableTask', 'notableClient']
      },
      {
        tableName: 'activity_logs',
        fieldName: 'loggable',
        relationshipType: 'belongsTo',
        typeField: 'loggable_type',
        idField: 'loggable_id',
        detectedTypes: ['Job', 'Task', 'Client'],
        relationships: ['loggableJob', 'loggableTask', 'loggableClient']
      },
      {
        tableName: 'scheduled_date_times',
        fieldName: 'schedulable',
        relationshipType: 'belongsTo',
        typeField: 'schedulable_type',
        idField: 'schedulable_id',
        detectedTypes: ['Job', 'Task'],
        relationships: ['schedulableJob', 'schedulableTask']
      }
    ];
  }

  /**
   * Create configuration from detected pattern
   */
  private createConfigurationFromPattern(pattern: PolymorphicPattern): ModelPolymorphicConfig | null {
    const config: ModelPolymorphicConfig = {
      tableName: pattern.tableName
    };

    const fieldConfig = {
      typeField: pattern.typeField,
      idField: pattern.idField,
      allowedTypes: pattern.detectedTypes.map(type => type.toLowerCase())
    };

    if (pattern.relationshipType === 'belongsTo') {
      config.belongsTo = {
        [pattern.fieldName]: fieldConfig
      };
    } else if (pattern.relationshipType === 'hasMany') {
      config.hasMany = {
        [pattern.fieldName]: fieldConfig
      };
    }

    return config;
  }

  /**
   * Merge two configurations for the same table
   */
  private mergeConfigurations(
    target: ModelPolymorphicConfig,
    source: ModelPolymorphicConfig
  ): void {
    if (source.belongsTo) {
      target.belongsTo = { ...target.belongsTo, ...source.belongsTo };
    }

    if (source.hasMany) {
      target.hasMany = { ...target.hasMany, ...source.hasMany };
    }
  }

  /**
   * Generate migration instructions
   */
  private generateMigrationInstructions(analysis: MigrationAnalysis): string[] {
    const instructions: string[] = [];

    instructions.push('## Polymorphic Migration Instructions');
    instructions.push('');
    instructions.push('### 1. Review Detected Patterns');
    
    for (const pattern of analysis.detectedPatterns) {
      instructions.push(`- **${pattern.tableName}.${pattern.fieldName}** (${pattern.relationshipType})`);
      instructions.push(`  - Types: ${pattern.detectedTypes.join(', ')}`);
      instructions.push(`  - Relationships: ${pattern.relationships.join(', ')}`);
    }

    instructions.push('');
    instructions.push('### 2. Implement Polymorphic Declarations');
    instructions.push('Add the generated declarations to your model initialization code.');
    instructions.push('');
    instructions.push('### 3. Update Schema Generation');
    instructions.push('Integrate polymorphic relationships with Zero.js schema generation.');
    instructions.push('');
    instructions.push('### 4. Test Relationship Loading');
    instructions.push('Verify that all existing includes() calls work with the new system.');
    instructions.push('');
    instructions.push('### 5. Remove Hardcoded Relationships');
    instructions.push('After validation, remove hardcoded polymorphic relationships from schema.');

    return instructions;
  }

  /**
   * Generate schema integration instructions
   */
  private generateSchemaInstructions(analysis: MigrationAnalysis): string[] {
    const instructions: string[] = [];

    instructions.push('');
    instructions.push('## Schema Integration');
    instructions.push('');
    instructions.push('### Generated Schema Code');
    instructions.push('```typescript');
    
    const schemaCode = polymorphicSchemaGenerator.generateSchemaCompositionCode();
    instructions.push(schemaCode);
    
    instructions.push('```');
    instructions.push('');
    instructions.push('### Integration Steps');
    instructions.push('1. Add polymorphic relationship generation to schema build process');
    instructions.push('2. Replace hardcoded relationships with generated ones');
    instructions.push('3. Update relationship registration in models');
    instructions.push('4. Test Zero.js query functionality');

    return instructions;
  }
}

/**
 * Convenience functions for migration
 */

/**
 * Quick migration for a single table
 */
export function migrateTableToPolymorphic(
  tableName: string,
  patterns: Array<{
    fieldName: string;
    relationshipType: 'belongsTo' | 'hasMany';
    typeField: string;
    idField: string;
    allowedTypes: string[];
  }>
): ModelPolymorphicConfig {
  const config: ModelPolymorphicConfig = {
    tableName,
    belongsTo: {},
    hasMany: {}
  };

  for (const pattern of patterns) {
    const fieldConfig = {
      typeField: pattern.typeField,
      idField: pattern.idField,
      allowedTypes: pattern.allowedTypes
    };

    if (pattern.relationshipType === 'belongsTo') {
      config.belongsTo![pattern.fieldName] = fieldConfig;
    } else {
      config.hasMany![pattern.fieldName] = fieldConfig;
    }
  }

  return config;
}

/**
 * Global migration instance
 */
export const polymorphicMigration = PolymorphicMigration.getInstance();