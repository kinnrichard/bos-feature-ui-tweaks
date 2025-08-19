/**
 * ESLint Rule: Debug Migration Helper
 * 
 * This custom ESLint rule helps developers migrate from legacy debug functions
 * to the new 6-category debug system by providing warnings and automatic fixes.
 * 
 * Installation:
 *   1. Copy this file to your ESLint rules directory
 *   2. Add to eslint.config.js:
 *      rules: {
 *        'custom/debug-migration-helper': 'warn'
 *      }
 * 
 * Features:
 * - Detects legacy debug function usage
 * - Provides migration suggestions
 * - Offers automatic fixes via ESLint --fix
 * - Supports .warn() and .error() method variants
 */

const MIGRATION_MAP = {
  // Network category mappings
  debugAPI: { category: 'debugNetwork', method: 'api', namespace: 'bos:api' },
  debugAuth: { category: 'debugNetwork', method: 'auth', namespace: 'bos:auth' },
  debugSecurity: { category: 'debugNetwork', method: 'security', namespace: 'bos:security' },
  debugIntegration: { category: 'debugNetwork', method: 'integration', namespace: 'bos:integration' },
  debugWebSocket: { category: 'debugNetwork', method: 'websocket', namespace: 'bos:websocket' },
  
  // Data category mappings
  debugDatabase: { category: 'debugData', method: 'database', namespace: 'bos:database' },
  debugCache: { category: 'debugData', method: 'cache', namespace: 'bos:cache' },
  debugValidation: { category: 'debugData', method: 'validation', namespace: 'bos:validation' },
  debugReactive: { category: 'debugData', method: 'reactive', namespace: 'bos:reactive' },
  debugState: { category: 'debugData', method: 'state', namespace: 'bos:state' },
  
  // UI category mappings
  debugComponent: { category: 'debugUI', method: 'component', namespace: 'bos:component' },
  debugNavigation: { category: 'debugUI', method: 'navigation', namespace: 'bos:navigation' },
  debugNotification: { category: 'debugUI', method: 'notification', namespace: 'bos:notification' },
  
  // Business category mappings
  debugWorkflow: { category: 'debugBusiness', method: 'workflow', namespace: 'bos:workflow' },
  debugSearch: { category: 'debugBusiness', method: 'search', namespace: 'bos:search' },
  debugUpload: { category: 'debugBusiness', method: 'upload', namespace: 'bos:upload' },
  debugExport: { category: 'debugBusiness', method: 'export', namespace: 'bos:export' },
  
  // Monitor category mappings
  debugPerformance: { category: 'debugMonitor', method: 'performance', namespace: 'bos:performance' },
  debugError: { category: 'debugMonitor', method: 'error', namespace: 'bos:error' }
};

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Suggest migration from legacy debug functions to category system',
      category: 'Best Practices',
      recommended: false
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['warn', 'error', 'suggestion'],
            default: 'warn'
          },
          autoFix: {
            type: 'boolean',
            default: true
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      legacyDebugFunction: 'Legacy debug function "{{functionName}}" detected. Consider migrating to "{{newFunction}}" for better organization.',
      legacyImport: 'Legacy debug import detected. Consider updating import to include "{{categoryFunction}}".',
      migrationSuggestion: 'Replace {{oldCall}} with {{newCall}} to use the new category system.'
    }
  },

  create(context) {
    const options = context.options[0] || {};
    const mode = options.mode || 'warn';
    const autoFix = options.autoFix !== false;
    
    const legacyFunctions = Object.keys(MIGRATION_MAP);
    const sourceCode = context.getSourceCode();
    
    // Track imports to provide import suggestions
    const importedDebugFunctions = new Set();
    const importNodes = [];

    return {
      // Track import statements
      ImportDeclaration(node) {
        if (node.source.value && node.source.value.includes('debug')) {
          importNodes.push(node);
          
          node.specifiers.forEach(spec => {
            if (spec.type === 'ImportSpecifier' && legacyFunctions.includes(spec.imported.name)) {
              importedDebugFunctions.add(spec.imported.name);
            }
          });
        }
      },

      // Check function calls
      CallExpression(node) {
        let functionName = null;
        let isMethodCall = false;
        let methodType = null; // 'warn' or 'error'

        // Handle direct calls: debugAPI(...)
        if (node.callee.type === 'Identifier' && legacyFunctions.includes(node.callee.name)) {
          functionName = node.callee.name;
        }
        // Handle method calls: debugAPI.warn(...) or debugAPI.error(...)  
        else if (node.callee.type === 'MemberExpression' &&
                 node.callee.object.type === 'Identifier' &&
                 legacyFunctions.includes(node.callee.object.name)) {
          functionName = node.callee.object.name;
          isMethodCall = true;
          methodType = node.callee.property.name;
        }

        if (functionName && MIGRATION_MAP[functionName]) {
          const mapping = MIGRATION_MAP[functionName];
          const newFunction = `${mapping.category}.${mapping.method}`;
          const newCall = isMethodCall ? `${newFunction}.${methodType}` : newFunction;
          const oldCall = isMethodCall ? `${functionName}.${methodType}` : functionName;

          context.report({
            node,
            messageId: 'legacyDebugFunction',
            data: {
              functionName,
              newFunction
            },
            fix: autoFix ? function(fixer) {
              // Create fixes for the function call
              const fixes = [];
              
              if (isMethodCall) {
                // Replace debugAPI.warn with debugNetwork.api.warn
                fixes.push(fixer.replaceText(node.callee, newCall));
              } else {
                // Replace debugAPI with debugNetwork.api
                fixes.push(fixer.replaceText(node.callee, newFunction));
              }

              return fixes;
            } : null
          });
        }
      },

      // Provide import suggestions at the end of program analysis
      'Program:exit'() {
        if (importedDebugFunctions.size > 0) {
          // Group imported functions by their target category
          const categoryGroups = {};
          
          importedDebugFunctions.forEach(func => {
            const mapping = MIGRATION_MAP[func];
            if (mapping) {
              if (!categoryGroups[mapping.category]) {
                categoryGroups[mapping.category] = [];
              }
              categoryGroups[mapping.category].push(func);
            }
          });

          // Suggest import updates for each import node
          importNodes.forEach(importNode => {
            const hasLegacyImports = importNode.specifiers.some(spec => 
              spec.type === 'ImportSpecifier' && legacyFunctions.includes(spec.imported.name)
            );

            if (hasLegacyImports) {
              const categories = Object.keys(categoryGroups);
              
              context.report({
                node: importNode,
                messageId: 'legacyImport',
                data: {
                  categoryFunction: categories.join(', ')
                },
                fix: autoFix ? function(fixer) {
                  // Build new import list
                  const currentImports = importNode.specifiers
                    .filter(spec => spec.type === 'ImportSpecifier')
                    .map(spec => spec.imported.name);
                  
                  const newImports = new Set();
                  
                  // Add non-legacy imports
                  currentImports.forEach(imp => {
                    if (!legacyFunctions.includes(imp)) {
                      newImports.add(imp);
                    }
                  });
                  
                  // Add category imports
                  Object.keys(categoryGroups).forEach(category => {
                    newImports.add(category);
                  });
                  
                  const sortedImports = Array.from(newImports).sort();
                  const newImportString = `{ ${sortedImports.join(', ')} }`;
                  
                  return fixer.replaceText(
                    importNode.specifiers.length === 1 ? 
                      importNode.specifiers[0] : 
                      sourceCode.getTokensBetween(
                        importNode.specifiers[0],
                        importNode.specifiers[importNode.specifiers.length - 1],
                        { includeComments: false }
                      )[0].parent,
                    newImportString
                  );
                } : null
              });
            }
          });
        }
      }
    };
  }
};

// Usage example for eslint.config.js:
module.exports.usage = `
// Add to your eslint.config.js:
module.exports = {
  // ... other config
  rules: {
    // ... other rules
    'custom/debug-migration-helper': ['warn', {
      mode: 'warn',        // 'warn', 'error', or 'suggestion'
      autoFix: true        // Enable automatic fixes via --fix
    }]
  }
};

// Example violations and fixes:

// Before (will be flagged):
import { debugAPI, debugAuth } from '$lib/utils/debug';
debugAPI('Request started', { url });
debugAuth.warn('Token expiring', { expiresIn });

// After (auto-fixed):
import { debugNetwork } from '$lib/utils/debug';
debugNetwork.api('Request started', { url });
debugNetwork.auth.warn('Token expiring', { expiresIn });
`;