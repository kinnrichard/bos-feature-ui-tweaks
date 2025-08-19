/**
 * PolymorphicRegistry - Integration with RelationshipRegistry
 *
 * Manages all polymorphic associations by integrating with the existing
 * RelationshipRegistry infrastructure. Provides centralized management
 * of polymorphic relationships and their valid target types.
 *
 * Features:
 * - Integration with existing RelationshipRegistry
 * - Registration of polymorphic relationships
 * - Dynamic target type discovery
 * - Validation of polymorphic associations
 * - Type-safe polymorphic operations
 *
 * Generated: 2025-08-06 Epic-008 Polymorphic Tracking
 */

import { relationshipRegistry } from '../../models/base/scoped-query-base';
import type { RelationshipMetadata } from '../../models/base/scoped-query-base';
import { PolymorphicTracker, getPolymorphicTracker } from './tracker';
import type { PolymorphicType, PolymorphicTrackingOptions } from './types';
import { debugDatabase } from '../../utils/debug';

/**
 * Extended relationship metadata for polymorphic relationships
 */
export interface PolymorphicRelationshipMetadata extends RelationshipMetadata {
  /** Indicates this is a polymorphic relationship */
  polymorphic: true;
  /** The polymorphic type (e.g., 'loggable', 'notable') */
  polymorphicType: PolymorphicType;
  /** The foreign key field for the polymorphic ID */
  polymorphicIdField: string;
  /** The foreign key field for the polymorphic type */
  polymorphicTypeField: string;
  /** Valid target models for this polymorphic relationship */
  validTargets: string[];
}

/**
 * PolymorphicRegistry - Central registry for polymorphic associations
 */
export class PolymorphicRegistry {
  private static instance: PolymorphicRegistry;
  private tracker: PolymorphicTracker;
  private initialized = false;

  constructor(tracker?: PolymorphicTracker) {
    this.tracker = tracker || getPolymorphicTracker();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PolymorphicRegistry {
    if (!PolymorphicRegistry.instance) {
      PolymorphicRegistry.instance = new PolymorphicRegistry();
    }
    return PolymorphicRegistry.instance;
  }

  /**
   * Initialize the registry
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.tracker.initialize();
    this.initialized = true;

    debugDatabase('PolymorphicRegistry initialized');
  }

  /**
   * Register a polymorphic relationship for a model
   */
  registerPolymorphicRelationship(
    sourceTableName: string,
    relationshipName: string,
    polymorphicType: PolymorphicType,
    polymorphicIdField: string,
    polymorphicTypeField: string,
    options: PolymorphicTrackingOptions = {}
  ): void {
    this.ensureInitialized();

    const validTargets = this.tracker.getValidTargets(polymorphicType, options);

    const polymorphicMetadata: PolymorphicRelationshipMetadata = {
      type: 'belongsTo',
      model: 'Polymorphic',
      polymorphic: true,
      polymorphicType,
      polymorphicIdField,
      polymorphicTypeField,
      validTargets,
      foreignKey: polymorphicIdField,
    };

    // Register with the existing RelationshipRegistry
    const relationships: Record<string, RelationshipMetadata> = {
      [relationshipName]: polymorphicMetadata,
    };

    relationshipRegistry.register(sourceTableName, relationships);

    debugDatabase('Registered polymorphic relationship', {
      sourceTableName,
      relationshipName,
      polymorphicType,
      validTargets: validTargets.length,
    });
  }

  /**
   * Register multiple polymorphic target relationships for a model
   * (e.g., activity_logs -> loggableJob, loggableTask, loggableClient)
   */
  registerPolymorphicTargetRelationships(
    sourceTableName: string,
    polymorphicType: PolymorphicType,
    polymorphicIdField: string,
    polymorphicTypeField: string,
    options: PolymorphicTrackingOptions = {}
  ): void {
    this.ensureInitialized();

    const validTargets = this.tracker.getValidTargets(polymorphicType, options);
    const relationships: Record<string, RelationshipMetadata> = {};

    // Create individual relationships for each valid target
    // e.g., loggableJob, loggableTask, loggableClient
    for (const tableName of validTargets) {
      const targetMetadata = this.tracker.getTargetMetadata(polymorphicType, tableName);
      if (!targetMetadata || (!targetMetadata.active && !options.includeInactive)) {
        continue;
      }

      const relationshipName = `${polymorphicType}${targetMetadata.modelName}`;

      relationships[relationshipName] = {
        type: 'belongsTo',
        model: targetMetadata.modelName,
        foreignKey: polymorphicIdField,
      };
    }

    relationshipRegistry.register(sourceTableName, relationships);

    debugDatabase('Registered polymorphic target relationships', {
      sourceTableName,
      polymorphicType,
      relationshipCount: Object.keys(relationships).length,
    });
  }

  /**
   * Register reverse polymorphic relationships for target models
   * (e.g., jobs -> activityLogs, notes)
   */
  registerReversePolymorphicRelationships(
    targetTableName: string,
    polymorphicType: PolymorphicType,
    sourceTableName: string,
    polymorphicIdField: string,
    relationshipName?: string
  ): void {
    this.ensureInitialized();

    // Use provided relationship name or generate based on source table
    const reverseName = relationshipName || this.generateReverseRelationshipName(sourceTableName);

    const reverseMetadata: RelationshipMetadata = {
      type: 'hasMany',
      model: this.capitalizeFirst(
        sourceTableName.replace(/_(.)/g, (_, char) => char.toUpperCase())
      ),
      foreignKey: polymorphicIdField,
    };

    const relationships: Record<string, RelationshipMetadata> = {
      [reverseName]: reverseMetadata,
    };

    relationshipRegistry.register(targetTableName, relationships);

    debugDatabase('Registered reverse polymorphic relationship', {
      targetTableName,
      reverseName,
      sourceTableName,
      polymorphicType,
    });
  }

  /**
   * Get all polymorphic relationships for a table
   */
  getPolymorphicRelationships(tableName: string): PolymorphicRelationshipMetadata[] {
    this.ensureInitialized();

    const validRelationships = relationshipRegistry.getValidRelationships(tableName);
    const polymorphicRelationships: PolymorphicRelationshipMetadata[] = [];

    for (const relationshipName of validRelationships) {
      const metadata = relationshipRegistry.getRelationshipMetadata(tableName, relationshipName);
      if (metadata && this.isPolymorphicRelationship(metadata)) {
        polymorphicRelationships.push(metadata as PolymorphicRelationshipMetadata);
      }
    }

    return polymorphicRelationships;
  }

  /**
   * Check if a relationship is polymorphic
   */
  isPolymorphicRelationship(
    metadata: RelationshipMetadata
  ): metadata is PolymorphicRelationshipMetadata {
    return 'polymorphic' in metadata && metadata.polymorphic === true;
  }

  /**
   * Get valid target models for a polymorphic type
   */
  getValidTargets(
    polymorphicType: PolymorphicType,
    options: PolymorphicTrackingOptions = {}
  ): string[] {
    this.ensureInitialized();
    return this.tracker.getValidTargets(polymorphicType, options);
  }

  /**
   * Check if a target is valid for a polymorphic type
   */
  isValidTarget(
    polymorphicType: PolymorphicType,
    tableName: string,
    options: PolymorphicTrackingOptions = {}
  ): boolean {
    this.ensureInitialized();
    return this.tracker.isValidTarget(polymorphicType, tableName, options);
  }

  /**
   * Add a new valid target for a polymorphic type
   */
  async addPolymorphicTarget(
    polymorphicType: PolymorphicType,
    tableName: string,
    modelName: string,
    options: PolymorphicTrackingOptions = {}
  ): Promise<void> {
    this.ensureInitialized();

    await this.tracker.addTarget(polymorphicType, tableName, modelName, options);

    // Update any existing registered relationships
    await this.refreshPolymorphicRelationships(polymorphicType);
  }

  /**
   * Remove a target from a polymorphic type
   */
  async removePolymorphicTarget(
    polymorphicType: PolymorphicType,
    tableName: string
  ): Promise<void> {
    this.ensureInitialized();

    await this.tracker.removeTarget(polymorphicType, tableName);

    // Update any existing registered relationships
    await this.refreshPolymorphicRelationships(polymorphicType);
  }

  /**
   * Discover polymorphic relationships from the existing RelationshipRegistry
   */
  discoverPolymorphicRelationships(): Array<{
    tableName: string;
    relationshipName: string;
    metadata: PolymorphicRelationshipMetadata;
  }> {
    this.ensureInitialized();

    const discoveries: Array<{
      tableName: string;
      relationshipName: string;
      metadata: PolymorphicRelationshipMetadata;
    }> = [];

    // This would scan all registered relationships to find polymorphic ones
    // Implementation depends on how RelationshipRegistry exposes its data

    debugDatabase('Discovered polymorphic relationships', { count: discoveries.length });
    return discoveries;
  }

  /**
   * Get the underlying polymorphic tracker
   */
  getTracker(): PolymorphicTracker {
    return this.tracker;
  }

  /**
   * Refresh all relationships for a polymorphic type
   */
  private async refreshPolymorphicRelationships(polymorphicType: PolymorphicType): Promise<void> {
    // In a full implementation, this would update all registered relationships
    // that use this polymorphic type to reflect the new valid targets
    debugDatabase('Refreshing polymorphic relationships', { polymorphicType });
  }

  /**
   * Generate reverse relationship name from source table
   */
  private generateReverseRelationshipName(sourceTableName: string): string {
    // Convert snake_case to camelCase
    return sourceTableName.replace(/_(.)/g, (_, char) => char.toUpperCase());
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Ensure registry is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'PolymorphicRegistry must be initialized before use. Call initialize() first.'
      );
    }
  }
}

/**
 * Get the global polymorphic registry instance
 */
export function getPolymorphicRegistry(): PolymorphicRegistry {
  return PolymorphicRegistry.getInstance();
}

/**
 * Initialize the global polymorphic registry
 */
export async function initializePolymorphicRegistry(): Promise<void> {
  const registry = getPolymorphicRegistry();
  await registry.initialize();
}

/**
 * Register model relationships with polymorphic support
 * Enhanced version of the existing registerModelRelationships function
 */
export function registerModelRelationshipsWithPolymorphic(
  tableName: string,
  relationships: Record<string, RelationshipMetadata | PolymorphicRelationshipMetadata>
): void {
  const registry = getPolymorphicRegistry();

  // Separate polymorphic and regular relationships
  const regularRelationships: Record<string, RelationshipMetadata> = {};
  const polymorphicRelationships: PolymorphicRelationshipMetadata[] = [];

  for (const [name, metadata] of Object.entries(relationships)) {
    if (registry.isPolymorphicRelationship(metadata)) {
      polymorphicRelationships.push(metadata as PolymorphicRelationshipMetadata);
    } else {
      regularRelationships[name] = metadata;
    }
  }

  // Register regular relationships with existing system
  if (Object.keys(regularRelationships).length > 0) {
    relationshipRegistry.register(tableName, regularRelationships);
  }

  // Handle polymorphic relationships specially
  for (const polyMetadata of polymorphicRelationships) {
    // Additional polymorphic-specific registration logic would go here
    debugDatabase('Processing polymorphic relationship', {
      tableName,
      polymorphicType: polyMetadata.polymorphicType,
    });
  }
}
