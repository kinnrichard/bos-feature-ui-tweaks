# EP-XXXX: Rails Generator Validation and Normalization Support

**Status**: 🚧 WORK IN PROGRESS  
**Type**: Enhancement  
**Component**: Rails Generator / Zero.js Integration  
**Priority**: Medium  
**Created**: 2025-08-01  

## Executive Summary

The Rails generator for ReactiveRecord frontend models currently generates TypeScript interfaces and model classes but does not translate Rails validations, callbacks, or normalization logic. This epic proposes extending the generator to automatically create Zero.js mutator hooks that mirror Rails model behavior, ensuring frontend and backend validation consistency.

## Problem Statement

### Current Limitations

1. **No Validation Translation**: Rails validations like `validates :name, presence: true` are not translated to frontend code
2. **Missing Callbacks**: Rails callbacks like `before_validation :normalize_name` are not implemented in generated models
3. **Inconsistent Business Logic**: Frontend models don't enforce the same rules as backend models
4. **Manual Duplication**: Developers must manually implement validations in TypeScript, leading to:
   - Duplication of business logic
   - Potential inconsistencies between frontend and backend
   - Maintenance burden when validation rules change

### Example Case: Client Model

The Rails Client model has:
```ruby
validates :name, presence: true
validates :client_type, presence: true
validates :name_normalized, presence: true
validate :unique_name_validation

before_validation :normalize_name
```

But the generated TypeScript model has no equivalent validation or normalization logic.

## Current State Analysis

### What the Generator Currently Does

1. **Schema Introspection**: Extracts table structure, columns, relationships
2. **Pattern Detection**: Identifies patterns like `_normalized` fields, soft deletion, enums
3. **Type Mapping**: Converts Rails types to TypeScript types
4. **Relationship Mapping**: Generates TypeScript relationships (hasMany, belongsTo)
5. **Default Values**: Extracts and converts database defaults

### What's Missing

1. **Model Introspection**: No extraction of Rails model validations or callbacks
2. **Validation Mapping**: No conversion of Rails validations to Zero.js validators
3. **Callback Translation**: No implementation of Rails lifecycle callbacks
4. **Custom Validator Support**: No handling of custom validation methods

## Proposed Solution

### High-Level Approach

1. **Extend Schema Introspection**: Add model-level introspection alongside database schema introspection
2. **Create Validation Extractor**: New service to extract and map Rails validations
3. **Generate Mutator Hooks**: Implement Zero.js mutator hooks in generated models
4. **Maintain Type Safety**: Ensure all generated code is fully typed

### Architecture Overview

```
RailsSchemaIntrospector (existing)
  ├── extract_schema() (existing)
  └── extract_patterns() (existing)

ValidationExtractor (new)
  ├── extract_validations(model_class)
  ├── extract_callbacks(model_class)
  └── map_to_typescript(validations)

GenerationCoordinator (existing)
  ├── generate_model_set() (modify)
  └── build_model_context() (modify to include validations)

Templates (modify)
  ├── active_model.ts.erb (add mutator hooks)
  └── validation_helpers.ts.erb (new shared validators)
```

## Technical Design

### 1. Validation Extractor Service

```ruby
module Zero
  module Generators
    class ValidationExtractor
      def extract_model_validations(model_class)
        {
          validations: extract_validations(model_class),
          callbacks: extract_callbacks(model_class),
          custom_validators: extract_custom_validators(model_class)
        }
      end

      private

      def extract_validations(model_class)
        model_class.validators.map do |validator|
          {
            type: validator.class.name.demodulize,
            attributes: validator.attributes,
            options: validator.options,
            message: extract_error_message(validator)
          }
        end
      end

      def extract_callbacks(model_class)
        # Extract before_validation, after_validation, etc.
        callbacks = {}
        [:before_validation, :after_validation, :before_save].each do |callback_type|
          callbacks[callback_type] = model_class._callbacks[callback_type].map do |callback|
            {
              method: callback.filter,
              conditions: callback.conditions
            }
          end
        end
        callbacks
      end
    end
  end
end
```

### 2. TypeScript Mutator Hooks Generation

Generated output for Client model:

```typescript
import { normalizeString } from './base/validation-helpers';
import type { MutatorHooks } from './base/mutator-hooks';

// Generated mutator hooks for Client model
const clientMutatorHooks: MutatorHooks<ClientData> = {
  beforeSave: [
    async (data, context) => {
      // Rails: before_validation :normalize_name
      if (data.name !== undefined) {
        data.name_normalized = normalizeString(data.name);
      }
      return data;
    }
  ],
  
  validators: [
    async (data, context) => {
      const errors: Record<string, string[]> = {};
      
      // Rails: validates :name, presence: true
      if (context.action === 'create' && !data.name) {
        errors.name = ['Name can\'t be blank'];
      }
      
      // Rails: validates :client_type, presence: true
      if (context.action === 'create' && !data.client_type) {
        errors.client_type = ['Client type can\'t be blank'];
      }
      
      // Rails: validates :name_normalized, presence: true
      if (context.action === 'create' && !data.name_normalized) {
        errors.name_normalized = ['Name normalized can\'t be blank'];
      }
      
      return {
        valid: Object.keys(errors).length === 0,
        errors: errors
      };
    },
    
    async (data, context) => {
      // Rails: validate :unique_name_validation
      if (data.name_normalized) {
        const existing = await Client.where({ 
          name_normalized: data.name_normalized 
        }).first();
        
        if (existing && existing.id !== (data as any).id) {
          return {
            valid: false,
            errors: {
              name: [`is too similar to an existing client: '${existing.name}'`]
            }
          };
        }
      }
      
      return { valid: true };
    }
  ]
};

// Attach hooks to the model
Client.mutatorHooks = clientMutatorHooks;
```

### 3. Shared Validation Helpers

Create reusable validation functions:

```typescript
// base/validation-helpers.ts

/**
 * Normalize a string following Rails normalization pattern
 * Removes diacritics and non-alphanumeric characters
 */
export function normalizeString(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Check for presence (Rails presence: true)
 */
export function validatePresence(
  value: any, 
  fieldName: string
): string[] {
  if (value === null || value === undefined || value === '') {
    return [`${fieldName} can't be blank`];
  }
  return [];
}

/**
 * Validate inclusion in list (Rails inclusion: { in: [...] })
 */
export function validateInclusion<T>(
  value: T,
  allowedValues: T[],
  fieldName: string
): string[] {
  if (!allowedValues.includes(value)) {
    return [`${fieldName} is not included in the list`];
  }
  return [];
}
```

## Implementation Plan

### Phase 1: Foundation (Week 1-2)
- [ ] Create ValidationExtractor service
- [ ] Add model introspection to RailsSchemaIntrospector
- [ ] Create validation mapping logic
- [ ] Unit tests for extraction logic

### Phase 2: Code Generation (Week 3-4)
- [ ] Update GenerationCoordinator to use validation data
- [ ] Modify active_model.ts.erb template
- [ ] Create validation-helpers.ts template
- [ ] Add mutator hooks generation

### Phase 3: Validation Types (Week 5-6)
- [ ] Support for presence validations
- [ ] Support for uniqueness validations
- [ ] Support for inclusion/exclusion validations
- [ ] Support for format validations
- [ ] Support for custom validations

### Phase 4: Callbacks (Week 7-8)
- [ ] before_validation callbacks
- [ ] after_validation callbacks
- [ ] before_save callbacks
- [ ] Conditional callbacks

### Phase 5: Testing & Documentation (Week 9-10)
- [ ] Comprehensive test suite
- [ ] Documentation updates
- [ ] Migration guide for existing models
- [ ] Performance testing

## Success Criteria

1. **Validation Parity**: Generated models enforce the same validation rules as Rails models
2. **Callback Support**: Rails callbacks are translated to appropriate mutator hooks
3. **Type Safety**: All generated code maintains full TypeScript type safety
4. **Performance**: Validation logic doesn't significantly impact frontend performance
5. **Maintainability**: Changes to Rails validations are reflected in regenerated models
6. **Testing**: 100% test coverage for validation extraction and generation

## Open Questions

1. **Async Validations**: How to handle validations that require API calls?
2. **Custom Validators**: How to handle complex custom validation methods?
3. **Error Messages**: Should we extract Rails i18n error messages?
4. **Conditional Validations**: How to handle `:if` and `:unless` options?
5. **Performance**: Should uniqueness checks be debounced in the frontend?

## Future Enhancements

1. **Live Validation**: Real-time validation as users type
2. **Validation Groups**: Support for validation contexts
3. **I18n Support**: Multi-language error messages
4. **Visual Indicators**: Generated UI helpers for validation states
5. **Form Integration**: Automatic form validation setup

## Related Work

- EP-0008: Epic-008 ReactiveRecord Architecture
- EP-0009: Model Relationships and Includes
- Zero.js Mutator Documentation
- Rails Validation API Reference

## Notes

This epic is currently a work in progress. Additional sections to be added:
- Performance benchmarks
- Security considerations
- Backward compatibility strategy
- Rollout plan