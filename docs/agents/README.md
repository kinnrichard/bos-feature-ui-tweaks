# Claude PM Framework Agents Documentation

This directory contains documentation for specialized agents within the Claude PM Framework.

## Available Agent Documentation

### Specialized Agents

- **[svelte5-engineer-agent-guide.md](./svelte5-engineer-agent-guide.md)** - Complete guide for the Svelte 5 Engineer agent with exclusive authority over `.svelte` files

## Agent Integration Patterns

### PM Delegation Template

When delegating tasks to specialized agents, use this standard format:

```
**[Agent-Name]**: [Clear task description]

TEMPORAL CONTEXT: Today is [date]. [Date-specific considerations]

**Task**: [Specific work items]
1. [Action item 1]
2. [Action item 2]
3. [Action item 3]

**Context**: [Relevant project context]
**Authority**: [Agent's decision-making scope]
**Expected Results**: [Specific deliverables]
**Integration**: [How results integrate with other agents]
```

### Agent Hierarchy

The Claude PM Framework uses a three-tier agent hierarchy:

1. **Project Agents** (`.claude-mpm/agents/project-specific/`) - Highest precedence
2. **User Agents** (`.claude-mpm/agents/user-agents/`) - Mid precedence  
3. **System Agents** (`claude_pm/agents/`) - Fallback precedence

### Specialized Agent Types

Beyond the core 9 agent types, specialized agents can be created for:
- **Technology-specific**: svelte5-engineer, react-specialist, database-expert
- **Domain-specific**: performance-optimizer, security-auditor, ui-designer
- **Process-specific**: migration-specialist, testing-coordinator, deployment-manager

## Adding New Agent Documentation

When documenting new agents, include:

1. **Agent Profile**: Name, type, specializations, authority scope
2. **When to Use**: Specific scenarios and triggers
3. **Task Examples**: Concrete delegation patterns
4. **Integration**: How the agent coordinates with others
5. **Quality Standards**: Expected deliverables and standards
6. **Escalation**: When to escalate back to PM

## Quick Reference

| Agent Type | Authority | Use Cases |
|------------|-----------|-----------|
| svelte5-engineer | .svelte, .svelte.ts files | Component creation, Svelte 5 modernization, bug fixes |

## File Locations

- **Agent Definitions**: `.claude-mpm/agents/user-agents/[agent-name].yaml`
- **Agent Documentation**: `docs/agents/[agent-name]-guide.md`
- **Integration Examples**: `docs/agents/examples/`