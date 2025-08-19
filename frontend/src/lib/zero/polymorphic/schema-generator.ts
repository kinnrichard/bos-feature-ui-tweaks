/**
 * Schema Generator for Polymorphic Relationships
 * 
 * Generates Zero.js schema relationships from polymorphic configuration,
 * replacing hardcoded relationships with dynamic generation based on
 * the polymorphic tracking system.
 * 
 * Key Features:
 * - Dynamic relationship generation from polymorphic config
 * - Integration with existing Zero.js schema structure
 * - Support for both belongsTo and hasMany polymorphic relationships
 * - Schema composition for polymorphic relationships
 * 
 * Created: 2025-08-06
 */

import { polymorphicRegistry } from './model-integration';

/**
 * Zero.js relationship definition structure
 */
interface ZeroRelationshipDefinition {
  type: 'one' | 'many';
  sourceField: string[];
  destField: string[];
  destSchema: string;
  where?: Record<string, any>;
}

/**
 * Schema generator for polymorphic relationships
 */
export class PolymorphicSchemaGenerator {
  private static instance: PolymorphicSchemaGenerator;

  static getInstance(): PolymorphicSchemaGenerator {
    if (!PolymorphicSchemaGenerator.instance) {
      PolymorphicSchemaGenerator.instance = new PolymorphicSchemaGenerator();
    }
    return PolymorphicSchemaGenerator.instance;
  }

  /**
   * Generate all polymorphic relationships for Zero.js schema
   * Returns a map of table names to their relationship definitions
   */
  generateAllPolymorphicRelationships(): Record<string, Record<string, ZeroRelationshipDefinition>> {
    const allRelationships: Record<string, Record<string, ZeroRelationshipDefinition>> = {};
    
    const registeredTables = polymorphicRegistry.getAllRegisteredTables();
    
    for (const tableName of registeredTables) {
      const relationships = this.generateRelationshipsForTable(tableName);
      if (relationships && Object.keys(relationships).length > 0) {
        allRelationships[tableName] = relationships;
      }
    }

    return allRelationships;
  }

  /**
   * Generate polymorphic relationships for a specific table
   */
  generateRelationshipsForTable(tableName: string): Record<string, ZeroRelationshipDefinition> | null {
    const config = polymorphicRegistry.getConfig(tableName);
    if (!config) return null;

    const relationships: Record<string, ZeroRelationshipDefinition> = {};

    // Generate belongsTo relationships
    if (config.belongsTo) {
      const belongsToRels = this.generateBelongsToRelationships(tableName, config.belongsTo);
      Object.assign(relationships, belongsToRels);
    }

    // Generate hasMany relationships
    if (config.hasMany) {
      const hasManyRels = this.generateHasManyRelationships(tableName, config.hasMany);
      Object.assign(relationships, hasManyRels);
    }

    return Object.keys(relationships).length > 0 ? relationships : null;
  }

  /**
   * Generate belongsTo polymorphic relationships
   */
  private generateBelongsToRelationships(
    tableName: string, 
    belongsToConfig: Record<string, any>
  ): Record<string, ZeroRelationshipDefinition> {
    const relationships: Record<string, ZeroRelationshipDefinition> = {};

    for (const [fieldName, fieldConfig] of Object.entries(belongsToConfig)) {
      if (fieldConfig.allowedTypes && Array.isArray(fieldConfig.allowedTypes)) {
        // Create individual typed relationships for each allowed type
        for (const allowedType of fieldConfig.allowedTypes) {
          const relationshipName = `${fieldName}${this.capitalizeFirst(allowedType)}`;
          const destTable = this.getTableName(allowedType);

          relationships[relationshipName] = {
            type: 'one',
            sourceField: [fieldConfig.idField],
            destField: ['id'],
            destSchema: destTable
            // Note: We would add where clause for type filtering, but Zero.js
            // relationships don't support where clauses. Instead, we'll handle
            // filtering at the query level when the relationship is used.
          };
        }
      }
    }

    return relationships;
  }

  /**
   * Generate hasMany polymorphic relationships
   */
  private generateHasManyRelationships(
    tableName: string,
    hasManyConfig: Record<string, any>
  ): Record<string, ZeroRelationshipDefinition> {
    const relationships: Record<string, ZeroRelationshipDefinition> = {};

    for (const [fieldName, fieldConfig] of Object.entries(hasManyConfig)) {
      if (fieldConfig.allowedTypes && Array.isArray(fieldConfig.allowedTypes)) {
        // Create individual typed relationships for each allowed type
        for (const allowedType of fieldConfig.allowedTypes) {
          const relationshipName = `${fieldName}${this.capitalizeFirst(allowedType)}`;
          const destTable = this.getTableName(allowedType);

          relationships[relationshipName] = {
            type: 'many',
            sourceField: ['id'],
            destField: [fieldConfig.idField],
            destSchema: destTable
            // Note: Type filtering will be handled at query level
          };
        }
      }
    }

    return relationships;
  }

  /**
   * Generate Zero.js schema composition code
   * This generates the actual TypeScript code that can be added to the schema
   */
  generateSchemaCompositionCode(): string {
    const allRelationships = this.generateAllPolymorphicRelationships();
    
    if (Object.keys(allRelationships).length === 0) {
      return '// No polymorphic relationships found\n';
    }

    let code = '// Auto-generated polymorphic relationships\n';
    code += '// Generated from polymorphic tracking system\n\n';

    for (const [tableName, relationships] of Object.entries(allRelationships)) {
      code += `// Polymorphic relationships for ${tableName}\n`;
      code += `const ${tableName}PolymorphicRelationships = relationships(${tableName}, ({ one, many }) => ({\n`;

      for (const [relationshipName, relationshipDef] of Object.entries(relationships)) {
        const relType = relationshipDef.type;
        code += `  ${relationshipName}: ${relType}({\n`;
        code += `    sourceField: ['${relationshipDef.sourceField.join("', '")}'],\n`;
        code += `    destField: ['${relationshipDef.destField.join("', '")}'],\n`;
        code += `    destSchema: ${relationshipDef.destSchema}\n`;
        
        if (relationshipDef.where) {
          code += `    // Note: Type filtering should be applied at query level\n`;
          code += `    // where: ${JSON.stringify(relationshipDef.where)}\n`;
        }
        
        code += '  }),\n';
      }

      code += '}));\n\n';
    }

    return code;
  }

  /**
   * Generate migration instructions for existing hardcoded relationships
   */
  generateMigrationInstructions(): string {
    const instructions = [];
    const allRelationships = this.generateAllPolymorphicRelationships();

    instructions.push('# Polymorphic Relationship Migration Instructions');
    instructions.push('');
    instructions.push('This document outlines how to migrate from hardcoded polymorphic');
    instructions.push('relationships to the dynamic polymorphic tracking system.');
    instructions.push('');

    // Analyze existing hardcoded polymorphic relationships in the schema
    const existingPolymorphicPatterns = this.analyzeExistingPolymorphicPatterns();
    
    if (existingPolymorphicPatterns.length > 0) {
      instructions.push('## Existing Polymorphic Patterns Detected');
      instructions.push('');
      
      for (const pattern of existingPolymorphicPatterns) {
        instructions.push(`### ${pattern.tableName}`);
        instructions.push(`- Field: ${pattern.fieldName}`);
        instructions.push(`- Type: ${pattern.type}`);
        instructions.push(`- Relationships: ${pattern.relationships.join(', ')}`);
        instructions.push('');
      }
    }

    if (Object.keys(allRelationships).length > 0) {
      instructions.push('## Generated Replacements');
      instructions.push('');
      
      for (const [tableName, relationships] of Object.entries(allRelationships)) {
        instructions.push(`### ${tableName}`);
        instructions.push('Replace hardcoded relationships with:');
        instructions.push('```typescript');
        
        for (const [relationshipName, relationshipDef] of Object.entries(relationships)) {
          instructions.push(`  ${relationshipName}: ${relationshipDef.type}({`);
          instructions.push(`    sourceField: ['${relationshipDef.sourceField.join("', '")}'],`);
          instructions.push(`    destField: ['${relationshipDef.destField.join("', '")}'],`);
          instructions.push(`    destSchema: ${relationshipDef.destSchema}`);
          instructions.push('  }),');
        }
        
        instructions.push('```');
        instructions.push('');
      }
    }

    instructions.push('## Migration Steps');
    instructions.push('');
    instructions.push('1. **Backup existing schema**: Save current generated-schema.ts');
    instructions.push('2. **Configure polymorphic tracking**: Add polymorphic configurations');
    instructions.push('3. **Update schema generation**: Integrate polymorphic relationships');
    instructions.push('4. **Test relationships**: Verify all includes() calls work');
    instructions.push('5. **Update model files**: Add polymorphic helper methods');
    instructions.push('');

    return instructions.join('\n');
  }

  /**
   * Analyze existing hardcoded polymorphic patterns in the schema
   * This helps identify what needs to be migrated
   */
  private analyzeExistingPolymorphicPatterns(): Array<{
    tableName: string;
    fieldName: string;
    type: 'belongsTo' | 'hasMany';
    relationships: string[];
  }> {
    // In a real implementation, this would parse the existing generated-schema.ts
    // file and identify polymorphic patterns like "loggableJob", "loggableTask", etc.
    
    // For now, return hardcoded patterns we know exist in the current schema
    return [
      {
        tableName: 'notes',
        fieldName: 'notable',
        type: 'belongsTo',
        relationships: ['notableJob', 'notableTask', 'notableClient']
      },
      {
        tableName: 'activity_logs',
        fieldName: 'loggable',
        type: 'belongsTo',
        relationships: ['loggableJob', 'loggableTask', 'loggableClient']
      },
      {
        tableName: 'scheduled_date_times',
        fieldName: 'schedulable',
        type: 'belongsTo',
        relationships: ['schedulableJob', 'schedulableTask']
      }
    ];
  }

  /**
   * Helper to capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Convert model type to table name
   */
  private getTableName(modelType: string): string {
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
export const polymorphicSchemaGenerator = PolymorphicSchemaGenerator.getInstance();