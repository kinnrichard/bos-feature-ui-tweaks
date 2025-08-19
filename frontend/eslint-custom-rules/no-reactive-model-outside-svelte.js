/**
 * ESLint custom rule: no-reactive-model-outside-svelte
 *
 * Prevents ReactiveModel/ReactiveRecord usage outside of Svelte files
 * Enforces clear naming convention: ReactiveModel for Svelte, ActiveModel for other contexts
 *
 * EPIC-007 Phase 2 Story 3: Clear Naming Convention Implementation
 */

const REACTIVE_MODEL_PATTERNS = [
  'ReactiveRecord',
  'ReactiveModel',
  'createReactiveModel',
  'ReactiveQuery',
  'ReactiveTask',
  'ReactiveJob',
  'ReactiveUser',
  'ReactiveClient',
  'ReactiveDevice',
  'ReactiveNote',
  'ReactivePerson',
];

const ACTIVE_MODEL_PATTERNS = [
  'ActiveRecord',
  'ActiveModel',
  'createActiveModel',
  'ActiveTask',
  'ActiveJob',
  'ActiveUser',
  'ActiveClient',
  'ActiveDevice',
  'ActiveNote',
  'ActivePerson',
];

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent ReactiveModel usage outside of Svelte files',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: 'code',
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        properties: {
          allowedNonSvelteFiles: {
            type: 'array',
            items: { type: 'string' },
            description: 'File patterns allowed to use ReactiveModel outside Svelte',
          },
          suggestActiveModel: {
            type: 'boolean',
            description: 'Suggest ActiveModel alternative when ReactiveModel is used incorrectly',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      reactiveModelOutsideSvelte:
        'ReactiveModel/ReactiveRecord should only be used in Svelte files (.svelte). Use ActiveModel/ActiveRecord for non-Svelte contexts.',
      reactiveModelInTest:
        'ReactiveModel/ReactiveRecord in test files may cause issues. Consider using ActiveModel for more predictable testing.',
      activeModelInSvelte:
        'ActiveModel/ActiveRecord in Svelte files will not be reactive. Use ReactiveModel/ReactiveRecord for automatic UI updates.',
      inconsistentNaming:
        'Inconsistent model naming. Use Reactive* for Svelte files, Active* for other contexts.',
      suggestFix: 'Consider using {{suggestion}} instead of {{current}} for this context.',
    },
  },

  create(context) {
    const filename = context.getFilename();
    const options = context.options[0] || {};
    const allowedNonSvelteFiles = options.allowedNonSvelteFiles || [];
    const suggestActiveModel = options.suggestActiveModel !== false;

    // File type detection
    const isSvelteFile = filename.endsWith('.svelte');
    const isTestFile = /\.(test|spec)\.(js|ts|jsx|tsx)$/.test(filename);
    const isTypeDefinition = filename.endsWith('.d.ts');
    const isExampleFile = filename.includes('/examples/');
    const isAllowedNonSvelteFile = allowedNonSvelteFiles.some((pattern) =>
      filename.includes(pattern)
    );

    function getModelContext() {
      if (isSvelteFile) return 'svelte';
      if (isTestFile) return 'test';
      if (isTypeDefinition) return 'types';
      if (isExampleFile) return 'example';
      if (isAllowedNonSvelteFile) return 'allowed';
      return 'other';
    }

    function isReactiveModelUsage(node) {
      if (node.type === 'Identifier') {
        return REACTIVE_MODEL_PATTERNS.some((pattern) => node.name.includes(pattern));
      }
      if (node.type === 'ImportSpecifier' || node.type === 'ImportDefaultSpecifier') {
        return REACTIVE_MODEL_PATTERNS.some(
          (pattern) => node.imported?.name?.includes(pattern) || node.local?.name?.includes(pattern)
        );
      }
      return false;
    }

    function isActiveModelUsage(node) {
      if (node.type === 'Identifier') {
        return ACTIVE_MODEL_PATTERNS.some((pattern) => node.name.includes(pattern));
      }
      if (node.type === 'ImportSpecifier' || node.type === 'ImportDefaultSpecifier') {
        return ACTIVE_MODEL_PATTERNS.some(
          (pattern) => node.imported?.name?.includes(pattern) || node.local?.name?.includes(pattern)
        );
      }
      return false;
    }

    function getSuggestion(currentName, targetContext) {
      // Convert ReactiveModel to ActiveModel and vice versa
      if (targetContext === 'svelte' && currentName.includes('Active')) {
        return currentName.replace(/Active/g, 'Reactive');
      }
      if (targetContext !== 'svelte' && currentName.includes('Reactive')) {
        return currentName.replace(/Reactive/g, 'Active');
      }
      return null;
    }

    function reportIssue(node, messageId, data = {}) {
      const report = {
        node,
        messageId,
        data,
      };

      // Add fix suggestion if available
      if (suggestActiveModel && data.suggestion) {
        report.suggest = [
          {
            desc: `Replace with ${data.suggestion}`,
            fix(fixer) {
              return fixer.replaceText(node, data.suggestion);
            },
          },
        ];
      }

      context.report(report);
    }

    const modelContext = getModelContext();

    return {
      // Check import declarations
      ImportDeclaration(node) {
        if (
          !node.source?.value?.includes('record-factory') &&
          !node.source?.value?.includes('reactive-record') &&
          !node.source?.value?.includes('active-record')
        ) {
          return;
        }

        node.specifiers.forEach((spec) => {
          if (isReactiveModelUsage(spec)) {
            if (modelContext === 'other') {
              const suggestion = getSuggestion(spec.local.name, 'other');
              reportIssue(spec, 'reactiveModelOutsideSvelte', {
                current: spec.local.name,
                suggestion,
              });
            } else if (modelContext === 'test') {
              reportIssue(spec, 'reactiveModelInTest', {
                current: spec.local.name,
              });
            }
          }

          if (isActiveModelUsage(spec) && modelContext === 'svelte') {
            const suggestion = getSuggestion(spec.local.name, 'svelte');
            reportIssue(spec, 'activeModelInSvelte', {
              current: spec.local.name,
              suggestion,
            });
          }
        });
      },

      // Check variable declarations and function calls
      Identifier(node) {
        // Skip if in type definitions or allowed files
        if (modelContext === 'types' || modelContext === 'allowed' || modelContext === 'example') {
          return;
        }

        // Check for ReactiveModel usage in wrong context
        if (isReactiveModelUsage(node)) {
          if (modelContext === 'other') {
            const suggestion = getSuggestion(node.name, 'other');
            reportIssue(node, 'reactiveModelOutsideSvelte', {
              current: node.name,
              suggestion,
            });
          } else if (modelContext === 'test') {
            reportIssue(node, 'reactiveModelInTest', {
              current: node.name,
            });
          }
        }

        // Check for ActiveModel usage in Svelte files
        if (isActiveModelUsage(node) && modelContext === 'svelte') {
          const suggestion = getSuggestion(node.name, 'svelte');
          reportIssue(node, 'activeModelInSvelte', {
            current: node.name,
            suggestion,
          });
        }
      },

      // Check method calls and property access
      MemberExpression(node) {
        if (modelContext === 'types' || modelContext === 'allowed' || modelContext === 'example') {
          return;
        }

        if (node.object && isReactiveModelUsage(node.object)) {
          if (modelContext === 'other') {
            reportIssue(node.object, 'reactiveModelOutsideSvelte');
          }
        }

        if (node.object && isActiveModelUsage(node.object) && modelContext === 'svelte') {
          reportIssue(node.object, 'activeModelInSvelte');
        }
      },
    };
  },
};
