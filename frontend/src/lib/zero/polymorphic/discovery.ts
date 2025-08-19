/**
 * Polymorphic Discovery Utilities
 *
 * Helper utilities for discovering polymorphic relationships from various sources:
 * - Generated schema analysis
 * - Relationship pattern scanning
 * - Model registration inspection
 * - Runtime relationship discovery
 *
 * Generated: 2025-08-06 Epic-008 Polymorphic Tracking
 */

import type {
  PolymorphicType,
  PolymorphicDiscoveryResult,
  PolymorphicTrackingOptions,
} from './types';
import { getPolymorphicTracker, PolymorphicTracker } from './tracker';
import { debugDatabase } from '../../utils/debug';

/**
 * Schema relationship pattern for polymorphic detection
 */
interface RelationshipPattern {
  sourceTable: string;
  relationshipName: string;
  foreignKey: string;
  targetTable: string;
  polymorphicType?: PolymorphicType;
}

/**
 * Discovery patterns for known polymorphic types
 */
const POLYMORPHIC_PATTERNS: Record<
  PolymorphicType,
  {
    typeField: string;
    idField: string;
    relationshipPrefix: string;
    description: string;
  }
> = {
  notable: {
    typeField: 'notable_type',
    idField: 'notable_id',
    relationshipPrefix: 'notable',
    description: 'Notes that belong to various models',
  },
  loggable: {
    typeField: 'loggable_type',
    idField: 'loggable_id',
    relationshipPrefix: 'loggable',
    description: 'Activity logs for various models',
  },
  schedulable: {
    typeField: 'schedulable_type',
    idField: 'schedulable_id',
    relationshipPrefix: 'schedulable',
    description: 'Scheduled date times for various models',
  },
  target: {
    typeField: 'target_type',
    idField: 'target_id',
    relationshipPrefix: 'target',
    description: 'Job targets referencing various models',
  },
  parseable: {
    typeField: 'parseable_type',
    idField: 'parseable_id',
    relationshipPrefix: 'parseable',
    description: 'Parsed emails belonging to various models',
  },
};

/**
 * PolymorphicDiscovery - Utility class for discovering polymorphic relationships
 */
export class PolymorphicDiscovery {
  private tracker: PolymorphicTracker;

  constructor(tracker?: PolymorphicTracker) {
    this.tracker = tracker || getPolymorphicTracker();
  }

  /**
   * Discover polymorphic relationships from schema relationships
   */
  async discoverFromSchemaRelationships(
    relationships: RelationshipPattern[]
  ): Promise<PolymorphicDiscoveryResult[]> {
    const discoveries: PolymorphicDiscoveryResult[] = [];
    const now = new Date().toISOString();

    // Group relationships by potential polymorphic type
    const groupedRelationships = this.groupRelationshipsByPolymorphicType(relationships);

    for (const [polymorphicType, patterns] of Object.entries(groupedRelationships)) {
      if (!this.isValidPolymorphicType(polymorphicType)) {
        continue;
      }

      const targets = patterns.map((pattern) => ({
        modelName: this.tableToModelName(pattern.targetTable),
        tableName: pattern.targetTable,
        source: 'generated-schema',
        relationshipName: pattern.relationshipName,
      }));

      discoveries.push({
        type: polymorphicType as PolymorphicType,
        targets,
        metadata: {
          discoveredAt: now,
          source: 'schema-analysis',
          confidence: 'high',
        },
      });
    }

    debugDatabase('Discovered polymorphic relationships from schema', {
      discoveryCount: discoveries.length,
      totalTargets: discoveries.reduce((sum, d) => sum + d.targets.length, 0),
    });

    return discoveries;
  }

  /**
   * Discover polymorphic relationships by analyzing relationship naming patterns
   */
  discoverFromNamingPatterns(relationshipNames: string[]): PolymorphicDiscoveryResult[] {
    const discoveries: PolymorphicDiscoveryResult[] = [];
    const now = new Date().toISOString();

    for (const [polymorphicType, pattern] of Object.entries(POLYMORPHIC_PATTERNS)) {
      const matchingRelationships = relationshipNames.filter((name) =>
        name.startsWith(pattern.relationshipPrefix)
      );

      if (matchingRelationships.length === 0) {
        continue;
      }

      const targets = matchingRelationships.map((relationshipName) => {
        // Extract model name from relationship name
        // e.g., 'loggableJob' -> 'Job', 'notableClient' -> 'Client'
        const modelName = relationshipName.replace(pattern.relationshipPrefix, '');
        const tableName = this.modelToTableName(modelName);

        return {
          modelName,
          tableName,
          source: 'naming-pattern',
          relationshipName,
        };
      });

      discoveries.push({
        type: polymorphicType as PolymorphicType,
        targets,
        metadata: {
          discoveredAt: now,
          source: 'naming-pattern-analysis',
          confidence: 'medium',
        },
      });
    }

    debugDatabase('Discovered polymorphic relationships from naming patterns', {
      discoveryCount: discoveries.length,
    });

    return discoveries;
  }

  /**
   * Discover polymorphic relationships from hardcoded schema definitions
   */
  async discoverFromHardcodedSchema(schemaContent: string): Promise<PolymorphicDiscoveryResult[]> {
    const discoveries: PolymorphicDiscoveryResult[] = [];
    const now = new Date().toISOString();

    // Parse the schema content to find polymorphic relationship patterns
    for (const [polymorphicType, pattern] of Object.entries(POLYMORPHIC_PATTERNS)) {
      const targets: Array<{
        modelName: string;
        tableName: string;
        source: string;
        relationshipName?: string;
      }> = [];

      // Look for relationship patterns like: loggableJob, loggableTask, etc.
      const relationshipRegex = new RegExp(`${pattern.relationshipPrefix}(\\w+):\\s*one\\(`, 'g');
      let match;

      while ((match = relationshipRegex.exec(schemaContent)) !== null) {
        const modelName = match[1];
        const tableName = this.modelToTableName(modelName);
        const relationshipName = `${pattern.relationshipPrefix}${modelName}`;

        targets.push({
          modelName,
          tableName,
          source: 'hardcoded-schema',
          relationshipName,
        });
      }

      if (targets.length > 0) {
        discoveries.push({
          type: polymorphicType as PolymorphicType,
          targets,
          metadata: {
            discoveredAt: now,
            source: 'hardcoded-schema-analysis',
            confidence: 'high',
          },
        });
      }
    }

    debugDatabase('Discovered polymorphic relationships from hardcoded schema', {
      discoveryCount: discoveries.length,
    });

    return discoveries;
  }

  /**
   * Apply discoveries to the polymorphic tracker
   */
  async applyDiscoveries(
    discoveries: PolymorphicDiscoveryResult[],
    options: PolymorphicTrackingOptions = {}
  ): Promise<void> {
    for (const discovery of discoveries) {
      for (const target of discovery.targets) {
        const isValid = await this.validateTarget(discovery.type, target.tableName);

        if (isValid || options.autoDiscover) {
          await this.tracker.addTarget(discovery.type, target.tableName, target.modelName, {
            ...options,
            source: discovery.metadata.source as any,
          });
        }
      }
    }

    debugDatabase('Applied polymorphic discoveries to tracker', {
      discoveryCount: discoveries.length,
    });
  }

  /**
   * Validate that a target model exists and is appropriate for the polymorphic type
   */
  private async validateTarget(
    polymorphicType: PolymorphicType,
    tableName: string
  ): Promise<boolean> {
    // In a full implementation, this would check if the table exists in the schema
    // and if it makes sense as a target for the polymorphic type

    // For now, we'll do basic validation
    if (!tableName || tableName.length === 0) {
      return false;
    }

    // Check if it's a reasonable table name
    const validTablePattern = /^[a-z][a-z0-9_]*[a-z0-9]$/;
    if (!validTablePattern.test(tableName)) {
      return false;
    }

    return true;
  }

  /**
   * Group relationships by potential polymorphic type
   */
  private groupRelationshipsByPolymorphicType(
    relationships: RelationshipPattern[]
  ): Record<string, RelationshipPattern[]> {
    const grouped: Record<string, RelationshipPattern[]> = {};

    for (const relationship of relationships) {
      // Try to match relationship name to polymorphic patterns
      for (const [polymorphicType, pattern] of Object.entries(POLYMORPHIC_PATTERNS)) {
        if (relationship.relationshipName.startsWith(pattern.relationshipPrefix)) {
          if (!grouped[polymorphicType]) {
            grouped[polymorphicType] = [];
          }
          grouped[polymorphicType].push({
            ...relationship,
            polymorphicType: polymorphicType as PolymorphicType,
          });
        }
      }
    }

    return grouped;
  }

  /**
   * Check if a string is a valid polymorphic type
   */
  private isValidPolymorphicType(type: string): type is PolymorphicType {
    return Object.keys(POLYMORPHIC_PATTERNS).includes(type);
  }

  /**
   * Convert table name to model name (snake_case to PascalCase)
   */
  private tableToModelName(tableName: string): string {
    return tableName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('')
      .replace(/s$/, ''); // Remove trailing 's' for pluralization
  }

  /**
   * Convert model name to table name (PascalCase to snake_case)
   */
  private modelToTableName(modelName: string): string {
    return (
      modelName
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .slice(1) + 's'
    ); // Add 's' for pluralization
  }
}

/**
 * Helper functions for common discovery operations
 */

/**
 * Discover polymorphic relationships from the current hardcoded schema
 */
export async function discoverPolymorphicRelationships(): Promise<PolymorphicDiscoveryResult[]> {
  const discovery = new PolymorphicDiscovery();

  // This would load the actual schema content
  const schemaContent = `
    // Simulated schema content based on research findings
    loggableJob: one({ sourceField: ['loggable_id'], destField: ['id'], destSchema: jobs }),
    loggableTask: one({ sourceField: ['loggable_id'], destField: ['id'], destSchema: tasks }),
    loggableClient: one({ sourceField: ['loggable_id'], destField: ['id'], destSchema: clients }),
    loggableUser: one({ sourceField: ['loggable_id'], destField: ['id'], destSchema: users }),
    loggablePerson: one({ sourceField: ['loggable_id'], destField: ['id'], destSchema: people }),
    
    notableJob: one({ sourceField: ['notable_id'], destField: ['id'], destSchema: jobs }),
    notableTask: one({ sourceField: ['notable_id'], destField: ['id'], destSchema: tasks }),
    notableClient: one({ sourceField: ['notable_id'], destField: ['id'], destSchema: clients }),
    
    schedulableJob: one({ sourceField: ['schedulable_id'], destField: ['id'], destSchema: jobs }),
    schedulableTask: one({ sourceField: ['schedulable_id'], destField: ['id'], destSchema: tasks }),
  `;

  return await discovery.discoverFromHardcodedSchema(schemaContent);
}

/**
 * Auto-discover and configure polymorphic relationships
 */
export async function autoDiscoverAndConfigure(
  options: PolymorphicTrackingOptions = {}
): Promise<void> {
  const discoveries = await discoverPolymorphicRelationships();
  const discovery = new PolymorphicDiscovery();

  await discovery.applyDiscoveries(discoveries, {
    ...options,
    autoDiscover: true,
    source: 'auto-discovery',
  });
}

/**
 * Get polymorphic patterns for reference
 */
export function getPolymorphicPatterns(): typeof POLYMORPHIC_PATTERNS {
  return POLYMORPHIC_PATTERNS;
}

/**
 * Create a new discovery instance
 */
export function createPolymorphicDiscovery(): PolymorphicDiscovery {
  return new PolymorphicDiscovery();
}
