/**
 * Test for ESLint custom rule: no-reactive-model-outside-svelte
 *
 * EPIC-007 Phase 2 Story 3: Clear Naming Convention Implementation
 */

const { RuleTester } = require('eslint');
const rule = require('./no-reactive-model-outside-svelte');

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
});

// Test the custom rule
ruleTester.run('no-reactive-model-outside-svelte', rule, {
  valid: [
    // ✅ Valid: ReactiveModel in .svelte file
    {
      code: `import { createReactiveModel } from '$lib/record-factory';`,
      filename: 'JobList.svelte',
    },

    // ✅ Valid: ActiveModel in .ts file
    {
      code: `import { createActiveModel } from '$lib/record-factory';`,
      filename: 'api/jobs.ts',
    },

    // ✅ Valid: Example files are allowed
    {
      code: `import { ReactiveRecord } from '$lib/record-factory';`,
      filename: 'examples/reactive-job-example.ts',
    },

    // ✅ Valid: Type definition files are allowed
    {
      code: `type ReactiveModelType<T> = ReactiveRecord<T>;`,
      filename: 'types/models.d.ts',
    },

    // ✅ Valid: ActiveModel usage patterns
    {
      code: `
        const ActiveTask = createActiveModel('task', 'tasks');
        const tasks = ActiveTask.all();
        console.log(tasks.records);
      `,
      filename: 'services/task-service.ts',
    },
  ],

  invalid: [
    // ❌ Invalid: ReactiveModel in .ts file
    {
      code: `import { createReactiveModel } from '$lib/record-factory';`,
      filename: 'services/task-service.ts',
      errors: [
        {
          messageId: 'reactiveModelOutsideSvelte',
          type: 'ImportSpecifier',
        },
      ],
    },

    // ❌ Invalid: ReactiveRecord variable in .js file
    {
      code: `
        import { ReactiveRecord } from '$lib/record-factory';
        const taskQuery = new ReactiveRecord();
      `,
      filename: 'utils/helpers.js',
      errors: [
        {
          messageId: 'reactiveModelOutsideSvelte',
          type: 'ImportSpecifier',
        },
        {
          messageId: 'reactiveModelOutsideSvelte',
          type: 'Identifier',
        },
      ],
    },

    // ❌ Invalid: ReactiveModel in test file (warning)
    {
      code: `
        import { createReactiveModel } from '$lib/record-factory';
        const Task = createReactiveModel('task', 'tasks');
      `,
      filename: 'tests/task.test.ts',
      errors: [
        {
          messageId: 'reactiveModelInTest',
          type: 'ImportSpecifier',
        },
        {
          messageId: 'reactiveModelInTest',
          type: 'Identifier',
        },
      ],
    },

    // ❌ Invalid: ActiveModel in .svelte file
    {
      code: `
        import { createActiveModel } from '$lib/record-factory';
        const Task = createActiveModel('task', 'tasks');
      `,
      filename: 'components/TaskList.svelte',
      errors: [
        {
          messageId: 'activeModelInSvelte',
          type: 'ImportSpecifier',
        },
        {
          messageId: 'activeModelInSvelte',
          type: 'Identifier',
        },
      ],
    },

    // ❌ Invalid: Mixed usage patterns
    {
      code: `
        import { ActiveRecord, ReactiveRecord } from '$lib/record-factory';
        const activeTask = new ActiveRecord();
        const reactiveTask = new ReactiveRecord();
      `,
      filename: 'api/mixed-usage.ts',
      errors: [
        {
          messageId: 'reactiveModelOutsideSvelte',
          type: 'ImportSpecifier',
        },
        {
          messageId: 'reactiveModelOutsideSvelte',
          type: 'Identifier',
        },
      ],
    },

    // ❌ Invalid: Method calls with wrong context
    {
      code: `
        const task = ReactiveTask.find('123');
        console.log(task.record);
      `,
      filename: 'scripts/data-migration.js',
      errors: [
        {
          messageId: 'reactiveModelOutsideSvelte',
          type: 'Identifier',
        },
      ],
    },
  ],
});

console.log('✅ All ESLint rule tests passed!');

// Export for CI integration
module.exports = { ruleTester };
