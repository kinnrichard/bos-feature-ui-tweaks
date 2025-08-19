/**
 * Core type definitions for polymorphic tracking system
 * 
 * Provides TypeScript safety for polymorphic association configuration
 * and tracking metadata.
 * 
 * Generated: 2025-08-06 Epic-008 Polymorphic Tracking
 */

/**
 * Polymorphic association types discovered in the codebase
 */
export type PolymorphicType = 
  | 'notable'     // notes -> jobs, tasks, clients
  | 'loggable'    // activity_logs -> jobs, tasks, clients, users, people, scheduled_date_times, people_groups, people_group_memberships, devices
  | 'schedulable' // scheduled_date_times -> jobs, tasks
  | 'target'      // job_targets -> clients, people, people_groups
  | 'parseable';  // parsed_emails -> jobs, tasks

/**
 * Metadata for a polymorphic target model
 */
export interface PolymorphicTargetMetadata {
  /** Model name (e.g., 'Job', 'Task', 'Client') */
  modelName: string;
  /** Database table name (e.g., 'jobs', 'tasks', 'clients') */
  tableName: string;
  /** When this target was first discovered */
  discoveredAt: string;
  /** When this target was last verified */
  lastVerifiedAt: string;
  /** Whether this target is currently active */
  active: boolean;
  /** Source of discovery (e.g., 'generated-schema', 'manual', 'runtime') */
  source: 'generated-schema' | 'manual' | 'runtime';
}

/**
 * Configuration for a single polymorphic association
 */
export interface PolymorphicAssociationConfig {
  /** The polymorphic type (e.g., 'loggable', 'notable') */
  type: PolymorphicType;
  /** Description of this association */
  description: string;
  /** Valid target models for this polymorphic type */
  validTargets: Record<string, PolymorphicTargetMetadata>;
  /** Configuration metadata */
  metadata: {
    /** When this config was created */
    createdAt: string;
    /** When this config was last updated */
    updatedAt: string;
    /** Version of the config format */
    configVersion: string;
    /** Source that generated this config */
    generatedBy: string;
  };
}

/**
 * Complete polymorphic configuration for all associations
 */
export interface PolymorphicConfig {
  /** All polymorphic associations keyed by type */
  associations: Record<PolymorphicType, PolymorphicAssociationConfig>;
  /** Global metadata */
  metadata: {
    /** When the config was created */
    createdAt: string;
    /** When the config was last updated */
    updatedAt: string;
    /** Version of the config format */
    configVersion: string;
    /** Total number of polymorphic associations */
    totalAssociations: number;
    /** Total number of target models across all associations */
    totalTargets: number;
    /** Source that generated this config */
    generatedBy: string;
  };
}

/**
 * Discovery result when scanning for polymorphic relationships
 */
export interface PolymorphicDiscoveryResult {
  /** The polymorphic type that was discovered */
  type: PolymorphicType;
  /** Target models found for this type */
  targets: Array<{
    modelName: string;
    tableName: string;
    source: string;
    relationshipName?: string;
  }>;
  /** Metadata about the discovery process */
  metadata: {
    discoveredAt: string;
    source: string;
    confidence: 'high' | 'medium' | 'low';
  };
}

/**
 * Options for polymorphic tracking operations
 */
export interface PolymorphicTrackingOptions {
  /** Whether to include inactive targets */
  includeInactive?: boolean;
  /** Whether to validate targets against current schema */
  validateTargets?: boolean;
  /** Whether to auto-discover new targets */
  autoDiscover?: boolean;
  /** Source identifier for tracking changes */
  source?: string;
}

/**
 * Result of a polymorphic validation operation
 */
export interface PolymorphicValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors if any */
  errors: Array<{
    type: PolymorphicType;
    target?: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  /** Validation warnings */
  warnings: Array<{
    type: PolymorphicType;
    target?: string;
    message: string;
  }>;
  /** Validation metadata */
  metadata: {
    validatedAt: string;
    validatedBy: string;
    totalChecked: number;
    passedChecks: number;
    failedChecks: number;
  };
}