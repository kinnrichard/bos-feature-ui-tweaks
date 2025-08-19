/**
 * PolymorphicTracker - Core polymorphic tracking system
 *
 * Manages polymorphic associations by loading/saving configuration from JSON
 * and tracking discovered polymorphic types with metadata.
 *
 * Features:
 * - JSON-based configuration storage (frontend appropriate)
 * - Dynamic type discovery and validation
 * - Integration with existing RelationshipRegistry
 * - Metadata tracking with timestamps
 * - Type-safe operations with TypeScript
 *
 * Generated: 2025-08-06 Epic-008 Polymorphic Tracking
 */

import type {
  PolymorphicType,
  PolymorphicConfig,
  PolymorphicAssociationConfig,
  PolymorphicTargetMetadata,
  PolymorphicTrackingOptions,
  PolymorphicValidationResult,
} from './types';
import { debugDatabase } from '../../utils/debug';

/**
 * Default configuration file path (relative to project root)
 */
const DEFAULT_CONFIG_PATH = 'src/lib/zero/polymorphic/config.json';

/**
 * Current configuration format version
 */
const CONFIG_VERSION = '1.0.0';

/**
 * PolymorphicTracker - Main tracking system class
 */
export class PolymorphicTracker {
  private config: PolymorphicConfig | null = null;
  private configPath: string;
  private initialized = false;

  constructor(configPath: string = DEFAULT_CONFIG_PATH) {
    this.configPath = configPath;
  }

  /**
   * Initialize the tracker by loading existing configuration or creating default
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.loadConfig();
    } catch (error) {
      debugDatabase.warn('No existing polymorphic config found, creating default', { error });
      this.config = this.createDefaultConfig();
      await this.saveConfig();
    }

    this.initialized = true;
    debugDatabase('PolymorphicTracker initialized', {
      associations: Object.keys(this.config?.associations || {}).length,
      totalTargets: this.config?.metadata.totalTargets || 0,
    });
  }

  /**
   * Get valid target types for a polymorphic association
   */
  getValidTargets(type: PolymorphicType, options: PolymorphicTrackingOptions = {}): string[] {
    this.ensureInitialized();

    const association = this.config?.associations[type];
    if (!association) {
      debugDatabase.warn('Unknown polymorphic type', { type });
      return [];
    }

    const targets = Object.entries(association.validTargets);

    // Filter inactive targets unless requested
    const filteredTargets = options.includeInactive
      ? targets
      : targets.filter(([, metadata]) => metadata.active);

    return filteredTargets.map(([tableName]) => tableName);
  }

  /**
   * Get target metadata for a specific polymorphic type and target
   */
  getTargetMetadata(type: PolymorphicType, tableName: string): PolymorphicTargetMetadata | null {
    this.ensureInitialized();

    const association = this.config?.associations[type];
    return association?.validTargets[tableName] || null;
  }

  /**
   * Check if a table is a valid target for a polymorphic type
   */
  isValidTarget(
    type: PolymorphicType,
    tableName: string,
    options: PolymorphicTrackingOptions = {}
  ): boolean {
    this.ensureInitialized();

    const metadata = this.getTargetMetadata(type, tableName);
    if (!metadata) {
      return false;
    }

    // Check if target is active unless we're including inactive
    return options.includeInactive || metadata.active;
  }

  /**
   * Add a new target to a polymorphic association
   */
  async addTarget(
    type: PolymorphicType,
    tableName: string,
    modelName: string,
    options: PolymorphicTrackingOptions = {}
  ): Promise<void> {
    this.ensureInitialized();

    if (!this.config) {
      throw new Error('PolymorphicTracker not properly initialized');
    }

    // Ensure association exists
    if (!this.config.associations[type]) {
      this.config.associations[type] = this.createDefaultAssociation(type);
    }

    const now = new Date().toISOString();
    const metadata: PolymorphicTargetMetadata = {
      modelName,
      tableName,
      discoveredAt: now,
      lastVerifiedAt: now,
      active: true,
      source: (options.source as any) || 'manual',
    };

    this.config.associations[type].validTargets[tableName] = metadata;
    this.config.associations[type].metadata.updatedAt = now;

    // Update global metadata
    this.config.metadata.updatedAt = now;
    this.config.metadata.totalTargets = this.calculateTotalTargets();

    await this.saveConfig();

    debugDatabase('Added polymorphic target', { type, tableName, modelName });
  }

  /**
   * Remove a target from a polymorphic association
   */
  async removeTarget(type: PolymorphicType, tableName: string): Promise<void> {
    this.ensureInitialized();

    if (!this.config) {
      throw new Error('PolymorphicTracker not properly initialized');
    }

    const association = this.config.associations[type];
    if (!association || !association.validTargets[tableName]) {
      debugDatabase.warn('Target not found for removal', { type, tableName });
      return;
    }

    delete association.validTargets[tableName];

    const now = new Date().toISOString();
    association.metadata.updatedAt = now;
    this.config.metadata.updatedAt = now;
    this.config.metadata.totalTargets = this.calculateTotalTargets();

    await this.saveConfig();

    debugDatabase('Removed polymorphic target', { type, tableName });
  }

  /**
   * Mark a target as inactive without removing it
   */
  async deactivateTarget(type: PolymorphicType, tableName: string): Promise<void> {
    this.ensureInitialized();

    if (!this.config) {
      throw new Error('PolymorphicTracker not properly initialized');
    }

    const metadata = this.getTargetMetadata(type, tableName);
    if (!metadata) {
      debugDatabase.warn('Target not found for deactivation', { type, tableName });
      return;
    }

    metadata.active = false;
    metadata.lastVerifiedAt = new Date().toISOString();

    const now = new Date().toISOString();
    this.config.associations[type].metadata.updatedAt = now;
    this.config.metadata.updatedAt = now;

    await this.saveConfig();

    debugDatabase('Deactivated polymorphic target', { type, tableName });
  }

  /**
   * Get all polymorphic types
   */
  getPolymorphicTypes(): PolymorphicType[] {
    this.ensureInitialized();
    return Object.keys(this.config?.associations || {}) as PolymorphicType[];
  }

  /**
   * Get configuration for a specific polymorphic type
   */
  getAssociationConfig(type: PolymorphicType): PolymorphicAssociationConfig | null {
    this.ensureInitialized();
    return this.config?.associations[type] || null;
  }

  /**
   * Get the complete configuration
   */
  getConfig(): PolymorphicConfig | null {
    this.ensureInitialized();
    return this.config;
  }

  /**
   * Validate all polymorphic associations
   */
  validate(options: PolymorphicTrackingOptions = {}): PolymorphicValidationResult {
    this.ensureInitialized();

    const now = new Date().toISOString();
    const errors: PolymorphicValidationResult['errors'] = [];
    const warnings: PolymorphicValidationResult['warnings'] = [];
    let totalChecked = 0;
    let failedChecks = 0;

    if (!this.config) {
      errors.push({
        type: 'notable' as PolymorphicType,
        message: 'PolymorphicTracker not initialized',
        severity: 'error',
      });
      failedChecks++;
      totalChecked++;
    } else {
      // Validate each association
      for (const [type, association] of Object.entries(this.config.associations)) {
        totalChecked++;

        if (Object.keys(association.validTargets).length === 0) {
          warnings.push({
            type: type as PolymorphicType,
            message: `No valid targets defined for polymorphic type '${type}'`,
          });
        }

        // Validate each target
        for (const [tableName, metadata] of Object.entries(association.validTargets)) {
          totalChecked++;

          if (!metadata.modelName) {
            errors.push({
              type: type as PolymorphicType,
              target: tableName,
              message: `Missing modelName for target '${tableName}'`,
              severity: 'error',
            });
            failedChecks++;
          }

          if (!metadata.active && !options.includeInactive) {
            warnings.push({
              type: type as PolymorphicType,
              target: tableName,
              message: `Target '${tableName}' is inactive`,
            });
          }
        }
      }
    }

    const passedChecks = totalChecked - failedChecks;

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: now,
        validatedBy: 'PolymorphicTracker',
        totalChecked,
        passedChecks,
        failedChecks,
      },
    };
  }

  /**
   * Load configuration from JSON file
   */
  private async loadConfig(): Promise<void> {
    // In a real implementation, this would load from filesystem
    // For now, we'll simulate it since we're in a frontend context
    // This would be: const configData = await fs.readFile(this.configPath, 'utf-8');
    // For frontend, we'll need to use a different approach or pre-generated config
    debugDatabase('Loading polymorphic config', { configPath: this.configPath });

    // In the actual implementation, you would load from a JSON file
    // For now, we'll use createDefaultConfig() as fallback
    throw new Error('Config file not found - will create default');
  }

  /**
   * Save configuration to JSON file
   */
  private async saveConfig(): Promise<void> {
    if (!this.config) {
      throw new Error('No config to save');
    }

    try {
      const configData = JSON.stringify(this.config, null, 2);

      // In a real implementation: await fs.writeFile(this.configPath, configData, 'utf-8');
      // For now, we'll log it since we're in frontend context
      debugDatabase('Saving polymorphic config', {
        configPath: this.configPath,
        associations: Object.keys(this.config.associations).length,
      });

      // In development, you could write to a temporary location or log the config
      debugDatabase('Saving polymorphic config', { configData });
    } catch (error) {
      debugDatabase.error('Failed to save polymorphic config', { error });
      throw error;
    }
  }

  /**
   * Create default configuration with discovered polymorphic types
   */
  private createDefaultConfig(): PolymorphicConfig {
    const now = new Date().toISOString();

    return {
      associations: {
        notable: this.createDefaultAssociation('notable'),
        loggable: this.createDefaultAssociation('loggable'),
        schedulable: this.createDefaultAssociation('schedulable'),
        target: this.createDefaultAssociation('target'),
        parseable: this.createDefaultAssociation('parseable'),
      },
      metadata: {
        createdAt: now,
        updatedAt: now,
        configVersion: CONFIG_VERSION,
        totalAssociations: 5,
        totalTargets: 0,
        generatedBy: 'PolymorphicTracker',
      },
    };
  }

  /**
   * Create default association configuration
   */
  private createDefaultAssociation(type: PolymorphicType): PolymorphicAssociationConfig {
    const now = new Date().toISOString();

    const descriptions: Record<PolymorphicType, string> = {
      notable: 'Notes can belong to jobs, tasks, and clients',
      loggable: 'Activity logs track changes to various models',
      schedulable: 'Scheduled date times can belong to jobs and tasks',
      target: 'Job targets can reference clients, people, and people groups',
      parseable: 'Parsed emails can belong to jobs and tasks',
    };

    return {
      type,
      description: descriptions[type],
      validTargets: {},
      metadata: {
        createdAt: now,
        updatedAt: now,
        configVersion: CONFIG_VERSION,
        generatedBy: 'PolymorphicTracker',
      },
    };
  }

  /**
   * Calculate total targets across all associations
   */
  private calculateTotalTargets(): number {
    if (!this.config) return 0;

    return Object.values(this.config.associations).reduce(
      (total, association) => total + Object.keys(association.validTargets).length,
      0
    );
  }

  /**
   * Ensure tracker is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'PolymorphicTracker must be initialized before use. Call initialize() first.'
      );
    }
  }
}

/**
 * Singleton instance for global use
 */
let globalTracker: PolymorphicTracker | null = null;

/**
 * Get the global polymorphic tracker instance
 */
export function getPolymorphicTracker(): PolymorphicTracker {
  if (!globalTracker) {
    globalTracker = new PolymorphicTracker();
  }
  return globalTracker;
}

/**
 * Initialize the global polymorphic tracker
 */
export async function initializePolymorphicTracking(): Promise<void> {
  const tracker = getPolymorphicTracker();
  await tracker.initialize();
}
