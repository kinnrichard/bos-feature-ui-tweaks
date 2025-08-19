# Svelte5-Engineer Agent Documentation

## Overview

The `svelte5-engineer` agent is a specialized user agent within the Claude PM Framework that has **exclusive authority** over all `.svelte` and `.svelte.ts` files in the project. This agent is specifically designed for modern Svelte 5 development and SvelteKit applications.

## Agent Details

- **Agent Name**: svelte5-engineer
- **Type**: engineer (specialized)
- **Tier**: user
- **Color**: blue
- **Specializations**: ['svelte', 'svelte5', 'frontend', 'ui', 'components']
- **Authority**: Exclusive control over `.svelte` and `.svelte.ts` files

## When to Use This Agent

The PM should delegate tasks to the svelte5-engineer agent in the following scenarios:

### 1. Svelte Component Creation
- Creating new Svelte components
- Building dashboard components with reactive state management
- Developing UI components for the application

### 2. Svelte Component Modification
- Updating existing Svelte components to use Svelte 5 features
- Refactoring components to use Svelte 5 runes and modern patterns
- Converting components from Svelte 4 to Svelte 5 syntax

### 3. Bug Fixes in Svelte Components
- Debugging Svelte component issues
- Fixing reactivity problems in components
- Resolving component lifecycle issues

### 4. Svelte 5 Modernization
- Migrating from Svelte 4 patterns to Svelte 5 runes
- Implementing modern Svelte 5 features like snippets instead of slots
- Optimizing component performance using Svelte 5's signal-based reactivity

## Task Delegation Examples

### Example 1: Creating a New Component
```
**Svelte5-Engineer**: Create a dashboard component with reactive state management

TEMPORAL CONTEXT: Today is 2025-07-30. Apply date awareness to modern development practices.

**Task**: Create a new dashboard component using Svelte 5 patterns
1. Create DashboardComponent.svelte in appropriate directory
2. Implement reactive state management using $state runes
3. Use modern Svelte 5 syntax throughout
4. Include proper TypeScript integration
5. Ensure accessibility compliance

**Context**: Dashboard needs to display job metrics and task summaries
**Authority**: Full authority over .svelte file creation and implementation
**Expected Results**: Complete dashboard component following Svelte 5 best practices
```

### Example 2: Component Modernization
```
**Svelte5-Engineer**: Update components to use Svelte 5 runes and modern patterns

TEMPORAL CONTEXT: Today is 2025-07-30. Modernize components for current Svelte 5 standards.

**Task**: Modernize existing Svelte components
1. Convert reactive statements ($:) to $derived
2. Replace traditional props with $props() syntax
3. Implement snippets instead of slots where applicable
4. Update event handling to modern onclick syntax
5. Ensure performance optimization with new reactivity model

**Context**: Existing components use Svelte 4 patterns that need modernization
**Authority**: Full authority over .svelte file modifications
**Expected Results**: Updated components using modern Svelte 5 patterns
```

### Example 3: Bug Investigation and Fix
```
**Svelte5-Engineer**: Fix counter component reactivity issue

TEMPORAL CONTEXT: Today is 2025-07-30. Address reactivity bugs with current Svelte 5 knowledge.

**Task**: Investigate and fix counter component not updating properly
1. Analyze current component implementation
2. Identify reactivity issues
3. Fix using appropriate Svelte 5 runes
4. Test component functionality
5. Ensure proper state management

**Context**: Counter component fails to update UI when value changes
**Authority**: Full authority over .svelte file debugging and fixes
**Expected Results**: Working counter component with proper reactivity
```

## Integration with Other Agents

### Coordination Patterns

The svelte5-engineer agent works in coordination with other agents but maintains exclusive authority over Svelte files:

- **Engineer Agent**: Handles non-Svelte frontend code (TypeScript, JavaScript utilities)
- **QA Agent**: Tests Svelte components after implementation
- **Documentation Agent**: Documents component APIs and usage patterns
- **Research Agent**: Investigates Svelte 5 best practices and new features

### Boundary Rules

- **EXCLUSIVE**: Only svelte5-engineer can create, modify, or work with `.svelte` files
- **EXCLUSIVE**: Only svelte5-engineer can create, modify, or work with `.svelte.ts` files
- **ESCALATION**: If other agents attempt to work with Svelte files, svelte5-engineer must be notified
- **COORDINATION**: Non-Svelte dependencies (utilities, types, APIs) are handled by appropriate specialized agents

## Key Technical Focus Areas

### Svelte 5 Runes System
- **$state**: Reactive state management
- **$derived**: Computed values replacing reactive statements
- **$effect**: Side effects replacing lifecycle hooks
- **$props**: Component input handling
- **$bindable**: Two-way binding support

### Modern Component Patterns
- Snippets instead of slots for reusable markup
- Modern event handling (onclick vs on:click)
- Performance optimization with signal-based reactivity
- Component lifecycle management with $effect

### SvelteKit Integration
- File-based routing patterns
- Data loading with load functions
- Server-side rendering optimization
- Progressive enhancement techniques

## Quality Standards

The svelte5-engineer agent maintains strict quality standards:

### Code Quality
- All components must use Svelte 5 syntax and features
- Performance-optimized implementations avoiding unnecessary reactivity
- Clean, readable code with appropriate comments
- Proper TypeScript integration where applicable

### Accessibility
- Semantic HTML structures
- ARIA attributes where needed
- Keyboard navigation support
- Screen reader compatibility

### Architecture
- Reusable, well-structured components
- Established naming conventions
- Project structure pattern adherence
- Proper component composition

## Escalation Triggers

The svelte5-engineer agent should escalate to the PM when:

1. **Technical Blocks**: Stuck on Svelte/SvelteKit issues for more than 2-3 iterations
2. **Boundary Violations**: Other agents attempt to work with .svelte files
3. **Requirement Conflicts**: Project requirements conflict with Svelte 5 best practices
4. **Dependency Coordination**: Need coordination with other agents for non-Svelte dependencies
5. **Legacy Conflicts**: Requests to use deprecated Svelte 4 syntax

## PM Orchestration Best Practices

### Task Delegation Format
When delegating to the svelte5-engineer agent, the PM should use this format:

```
**Svelte5-Engineer**: [Clear task description]

TEMPORAL CONTEXT: Today is [date]. [Date-specific considerations]

**Task**: [Specific Svelte work items]
1. [Svelte-specific action]
2. [Component implementation detail]
3. [Quality requirement]

**Context**: [Project background and Svelte-specific context]
**Authority**: Exclusive authority over .svelte and .svelte.ts files
**Expected Results**: [Specific Svelte deliverables]
**Integration**: [How results integrate with other agent work]
```

### Coordination with Other Agents
- **Before Svelte Work**: Ensure APIs and types are ready (Engineer/Data Engineer agents)
- **After Svelte Work**: Coordinate testing (QA Agent) and documentation (Documentation Agent)
- **Concurrent Work**: Coordinate with Research Agent for Svelte 5 best practices

## Agent File Location

The svelte5-engineer agent is located at:
```
/Users/claude/Projects/bos/.claude-mpm/agents/user-agents/svelte5-engineer.yaml
```

This location follows the Claude PM Framework's three-tier agent hierarchy:
- **Tier**: User agent
- **Precedence**: Higher than system agents, lower than project-specific agents
- **Scope**: Project-wide Svelte 5 development

## Performance Considerations

The agent is optimized for:
- **Fast Component Creation**: Templates and patterns for rapid development
- **Modern Reactivity**: Svelte 5's signal-based system for optimal performance
- **Bundle Optimization**: Component patterns that minimize bundle size
- **Development Experience**: Hot reloading and development-friendly patterns

## Conclusion

The svelte5-engineer agent is a critical component of the Claude PM Framework for this project, ensuring that all Svelte development follows modern Svelte 5 patterns and maintains high quality standards. By maintaining exclusive authority over Svelte files, it provides consistency and expertise in Svelte 5 development while integrating seamlessly with the broader agent ecosystem.

For any questions about Svelte component development or agent usage, refer to this documentation or escalate to the PM for clarification.