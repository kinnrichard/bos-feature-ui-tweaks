# Svelte5-Engineer Agent - Quick Reference

## Agent Profile
- **Nickname**: Svelte5-Engineer
- **Authority**: Exclusive control over `.svelte` and `.svelte.ts` files
- **Specializations**: svelte, svelte5, frontend, ui, components
- **Location**: `.claude-mpm/agents/user-agents/svelte5-engineer.yaml`

## Quick Delegation Patterns

### Component Creation
```
**Svelte5-Engineer**: Create [component-name] component with [specific-features]
```

### Component Updates
```
**Svelte5-Engineer**: Update [component-name] to use Svelte 5 [specific-features]
```

### Bug Fixes
```
**Svelte5-Engineer**: Fix [component-name] [specific-issue]
```

## Key Svelte 5 Features

| Svelte 4 Pattern | Svelte 5 Replacement |
|------------------|---------------------|
| `let prop = value` | `let { prop = value } = $props()` |
| `$: derived = compute(state)` | `const derived = $derived(compute(state))` |
| `onMount(() => {})` | `$effect(() => {})` |
| `on:click={handler}` | `onclick={handler}` |
| `<slot>` | `{#snippet}...{/snippet}` |

## Common Task Templates

### New Component
```
**Svelte5-Engineer**: Create [ComponentName] component

**Task**:
1. Create [ComponentName].svelte in appropriate directory
2. Implement using Svelte 5 runes ($state, $derived, $props)
3. Include TypeScript types if needed
4. Ensure accessibility compliance
5. Follow project naming conventions

**Authority**: Full authority over .svelte file creation
```

### Component Modernization
```
**Svelte5-Engineer**: Modernize [ComponentName] to Svelte 5

**Task**:
1. Convert reactive statements to $derived
2. Update props to $props() syntax
3. Replace slots with snippets where applicable
4. Update event handlers to modern syntax
5. Test component functionality

**Authority**: Full authority over .svelte file modifications
```

## Escalation Triggers
- ⚠️ Blocked on Svelte issues for 2+ iterations
- 🚨 Other agents attempting to modify .svelte files
- ❌ Requirements conflict with Svelte 5 best practices
- 🔗 Need coordination for non-Svelte dependencies

## Integration Notes
- **Before**: Ensure APIs/types ready (Engineer/Data Engineer)
- **After**: Coordinate testing (QA) and docs (Documentation)
- **Concurrent**: Research Svelte 5 patterns (Research Agent)