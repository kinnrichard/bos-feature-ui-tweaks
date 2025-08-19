/**
 * Simplified ESLint rule for ReactiveModel vs ActiveModel naming convention
 *
 * EPIC-007 Phase 2 Story 3: Clear Naming Convention Implementation
 * Basic validation without complex suggestions to avoid ESLint compatibility issues
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce ReactiveModel vs ActiveModel naming convention based on file type',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      reactiveOutsideSvelte:
        'ReactiveModel should only be used in .svelte files. Use ActiveModel for better performance in non-Svelte contexts.',
      activeInSvelte:
        'ActiveModel in .svelte files will not be reactive. Use ReactiveModel for automatic UI updates.',
      reactiveInTest:
        'ReactiveModel in test files may cause unpredictable behavior. Consider ActiveModel for testing.',
    },
  },

  create(context) {
    const filename = context.getFilename();
    const isSvelteFile = filename.endsWith('.svelte');
    const isTestFile = /\.(test|spec)\.(js|ts)$/.test(filename);
    const isExampleFile = filename.includes('/examples/') || filename.includes('/record-factory/');
    const isReactiveModelFile = filename.includes('/models/reactive-') && filename.endsWith('.ts');
    const isModelSystemFile =
      filename.includes('/models/base/') || filename.includes('/models/migration/');

    // Skip validation for example, factory, reactive model definition, and system files
    if (isExampleFile || filename.includes('.d.ts') || isReactiveModelFile || isModelSystemFile) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        // Check imports from record-factory
        if (!node.source?.value?.includes('record-factory')) {
          return;
        }

        node.specifiers.forEach((spec) => {
          const importName = spec.imported?.name || spec.local?.name;

          if (importName?.includes('Reactive')) {
            if (!isSvelteFile) {
              if (isTestFile) {
                context.report({
                  node: spec,
                  messageId: 'reactiveInTest',
                });
              } else {
                context.report({
                  node: spec,
                  messageId: 'reactiveOutsideSvelte',
                });
              }
            }
          }

          if (importName?.includes('Active') && isSvelteFile) {
            context.report({
              node: spec,
              messageId: 'activeInSvelte',
            });
          }
        });
      },

      Identifier(node) {
        // Skip if in allowed files
        if (isExampleFile) return;

        const name = node.name;

        // Skip common property names that aren't model references
        // These are property/variable names, not model class names
        if (
          name === 'isActive' ||
          name === 'isReactive' ||
          name === 'makeActive' ||
          name === 'setActive' ||
          name === 'active' ||
          name === 'reactive'
        ) {
          return;
        }

        // Only check identifiers that look like model class names
        // Model names typically start with uppercase or contain "Model"
        const looksLikeModelName = /^[A-Z].*Model|^Active[A-Z]|^Reactive[A-Z]/.test(name);

        if (!looksLikeModelName) {
          return;
        }

        if (name.includes('Reactive') && !isSvelteFile) {
          if (isTestFile) {
            context.report({
              node,
              messageId: 'reactiveInTest',
            });
          } else {
            context.report({
              node,
              messageId: 'reactiveOutsideSvelte',
            });
          }
        }

        if (name.includes('Active') && isSvelteFile) {
          context.report({
            node,
            messageId: 'activeInSvelte',
          });
        }
      },
    };
  },
};
