/**
 * Example: How to register mutator hooks with a model
 * 
 * This file demonstrates how to configure mutator hooks for ActiveRecord models
 * using the new mutator hooks system.
 */

import { createActiveRecord } from './active-record';
import type { MutatorHooks } from './mutator-hooks';
import { normalizeClientName } from '../../shared/normalizers/name-normalizer';
import { addUserAttribution } from '../../shared/mutators/user-attribution';
import { validateUniqueName } from '../../shared/validators/unique-name-validator';

// Example 1: Using a factory function to create models with hooks
export function createClientModel() {
  const Client = createActiveRecord({
    tableName: 'clients',
    className: 'Client',
    primaryKey: 'id',
    supportsDiscard: false
  });
  
  // Attach mutator hooks to the class
  (Client as any).mutatorHooks = {
    beforeCreate: [normalizeClientName],
    beforeSave: [addUserAttribution],
    validators: [validateUniqueName]
  } as MutatorHooks<any>;
  
  return Client;
}

// Example 2: Using a class extension approach
export class ClientWithHooks extends createActiveRecord({
  tableName: 'clients',
  className: 'Client',
  primaryKey: 'id',
  supportsDiscard: false
}).constructor {
  static mutatorHooks: MutatorHooks<any> = {
    beforeCreate: [normalizeClientName],
    beforeSave: [addUserAttribution],
    validators: [validateUniqueName]
  };
}

// Example 3: Using a configuration function
export function configureModelHooks<T>(
  Model: any,
  hooks: MutatorHooks<T>
): void {
  Model.mutatorHooks = hooks;
}

// Usage example:
/*
const Client = createActiveRecord({ ... });
configureModelHooks(Client, {
  beforeCreate: [normalizeClientName],
  beforeSave: [addUserAttribution],
  validators: [validateUniqueName]
});
*/