---
title: "Claude Automation Setup Guide"
description: "Guide for setting up and configuring Claude CLI integration for automated bug fixing"
last_updated: "2025-07-17"
status: "active"
category: "guide"
tags: ["claude", "automation", "setup", "bug-fixing", "cli"]
---

# Claude Automation Setup Guide

This guide explains how to set up and configure the Claude CLI integration for automated bug fixing in bŏs.

## Prerequisites

1. **Claude CLI Installation**
   - Install Claude CLI from [https://docs.anthropic.com/en/docs/claude-code](https://docs.anthropic.com/en/docs/claude-code)
   - Ensure `claude` is available in your PATH
   - Authenticate the CLI with your Anthropic API key

2. **GitHub Token**
   - Create a personal access token with `repo` scope
   - Set `GIT_TOKEN` environment variable or add to Rails credentials

3. **GitHub Repository**
   - Set `GIT_REPO` environment variable (e.g., "fluffyx/bos")
   - Or configure in Rails credentials

## Configuration

### Environment Variables

```bash
# Required
export GIT_TOKEN="your-github-token"
export GIT_REPO="owner/repo"

# Optional - Emergency off switch
export BUG_AUTOMATION_ENABLED="true"  # Set to "false" to disable
```

### Rails Credentials

Alternatively, configure via Rails credentials:

```bash
rails credentials:edit
```

```yaml
git_token: "your-github-token"
git_repo: "owner/repo"
```

## How It Works

1. **Bug Report Submission**
   - User submits bug report through the feedback form
   - GitHub issue is created with "bug" and "auto-fix" labels
   - ProcessBugIssueJob is queued

2. **Claude Processing**
   - Job fetches issue details from GitHub
   - Adds "claude-processing" label
   - Generates BMAD-compliant prompt
   - Executes Claude CLI with conversation context
   - Claude creates branch, implements fix, and opens PR

3. **Completion**
   - "claude-processing" label removed
   - "pr-created" label added
   - Comment added to issue with status

## BMAD Methodology

The automation follows BMAD principles:

1. **Analyze** - QA Agent approach to identify root cause
2. **Create Story** - Story Manager approach for requirements
3. **Implement** - Dev Agent approach for code changes
4. **Git Workflow** - Proper branching and commit messages
5. **Create PR** - Detailed PR with "Fixes #N" for auto-close

## Monitoring

### Labels

- `claude-processing` - Claude is currently working on the issue
- `pr-created` - PR has been created by Claude
- `automation-failed` - Automation encountered an error

### Logs

Monitor automation activity:

```bash
tail -f log/development.log | grep -E "(ProcessBugIssueJob|ClaudeAutomationService)"
```

### Emergency Shutdown

To disable automation immediately:

```bash
export BUG_AUTOMATION_ENABLED=false
```

Then restart your Rails application.

## Troubleshooting

### Claude CLI Not Found

```
Claude CLI not found in PATH. Bug automation will not work.
```

Solution: Install Claude CLI and ensure it's in your PATH.

### GitHub API Errors

Check your GitHub token has proper permissions:
- `repo` scope for private repositories
- `public_repo` scope for public repositories

### Claude Execution Errors

Check Claude CLI is authenticated:

```bash
claude --version
claude auth status
```

### Automation Failures

Issues with `automation-failed` label need manual intervention. Check:
- Issue comments for error details
- Rails logs for detailed error messages
- Claude CLI logs if available

## Security Considerations

1. **Limited Scope** - Claude only processes issues with "bug" and "auto-fix" labels
2. **Conversation Isolation** - Each issue uses a separate conversation ID
3. **Emergency Shutdown** - BUG_AUTOMATION_ENABLED environment variable
4. **PR Review Required** - All PRs require human review before merge

## Testing

Run the automation tests:

```bash
rails test test/services/claude_automation_service_test.rb
rails test test/jobs/process_bug_issue_job_test.rb
```

Test with a mock issue (dry run):

```ruby
# In rails console
ClaudeAutomationService.new(123).send(:generate_bug_fix_prompt, 
  OpenStruct.new(
    number: 123,
    title: "Test Bug",
    body: "Test description",
    html_url: "https://github.com/test/repo/issues/123"
  )
)
```

## Best Practices

1. **Review All PRs** - Always review Claude's PRs before merging
2. **Monitor Labels** - Watch for `automation-failed` labels
3. **Check Logs** - Regularly review automation logs
4. **Test First** - Test automation in development before production
5. **Gradual Rollout** - Start with simple bugs, expand scope gradually

---

## 🔗 Related Documentation

### Development Workflow
- **[Feature Request Workflow](../workflows/feature-request-workflow.md)** - Feature development process
- **[Bug to PR Automation](./readme-bug-to-pr-automation.md)** - Complete automation architecture
- **[Epic Management](../epics/README.md)** - Epic planning and tracking system

### Testing & Quality
- **[Testing Strategy](../tests/readme-tests.md)** - Testing approach and patterns
- **[Test Plan Critical Areas](./test-plan-critical-areas.md)** - Testing focus areas
- **[Playwright Testing](../tests/readme-tasklist-testing.md)** - Frontend testing with Playwright

### Architecture & Setup
- **[Technical Decisions](../standards/technical-decisions.md)** - Architecture decision records
- **[GitHub Setup](../setup/github-setup.md)** - GitHub configuration and authentication
- **[Style Guide](../standards/style-guide.md)** - Code style and conventions

### Frontend Integration
- **[Frontend Debug System](../frontend/epics/epic-014-debug-system-guide.md)** - Debug system for troubleshooting
- **[API Integration](../api/frontend-integration.md)** - Frontend API patterns
- **[Zero.js Integration](../../frontend/src/lib/zero/README.md)** - Zero.js reactive system

### See Also
- **[Troubleshooting Guide](../architecture/troubleshooting-guide.md)** - Common issues and solutions
- **[Performance Guidelines](../architecture/performance-guidelines.md)** - Performance optimization
- **[BMAD Context](../../dev-docs/bmad-context/prd.md)** - Business analysis and development methodology