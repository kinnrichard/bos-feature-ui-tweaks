# Feature Request Workflow

This document describes the semi-automated workflow for handling feature requests in bŏs.

## Overview

Feature requests are processed through GitHub Issues with admin approval required at key stages. The workflow uses slash commands in issue comments to trigger actions.

## Prerequisites

1. **GitHub Webhook Configuration**
   - Set up webhook URL: `https://your-app.com/github/webhook`
   - Events: Issue comments
   - Secret: Set in `GIT_WEBHOOK_SECRET` environment variable

2. **Authorized Users**
   - Configure in `GITHUB_AUTHORIZED_USERS` environment variable
   - Comma-separated list of GitHub usernames
   - Example: `GITHUB_AUTHORIZED_USERS="admin1,admin2,owner"`

3. **Email Notifications** (Optional)
   - Set `ADMIN_EMAILS` with comma-separated admin emails
   - Set `FEATURE_EMAIL_NOTIFICATIONS=false` to disable

## Workflow Steps

### 1. Feature Request Submission

Users submit feature requests through the feedback form:
- Multi-step form collects BMAD-level information
- Creates GitHub issue with `feature-request` and `needs-review` labels
- Includes all Q&A responses formatted in markdown

### 2. Story Generation

Authorized users review the request and generate a BMAD story:

```
/generate-story
```

This command:
- Sends the feature request to Claude Story Manager
- Generates comprehensive user story with acceptance criteria
- Adds story as issue comment
- Applies `story-generated` label
- Sends email notification to admins

### 3. Implementation Approval

After reviewing the generated story, approve implementation:

```
/approve-implementation
```

This command:
- Requires `story-generated` label to be present
- Sends story and request to Claude Dev agent
- Claude creates branch `feature/issue-{number}`
- Implements the feature following Rails patterns
- Creates PR with "Closes #N" for auto-close
- Applies `implementation-pr-created` label
- Sends email notification

### 4. Decline Request

To decline a feature request:

```
/decline [reason]
```

Example:
```
/decline Not aligned with current product roadmap
```

This command:
- Closes the issue with explanation
- Applies `declined` label
- No further action taken

## Labels Used

- `feature-request` - Initial feature request
- `needs-review` - Awaiting admin review
- `story-generated` - BMAD story has been created
- `claude-implementing` - Claude is working on implementation
- `implementation-pr-created` - PR has been created
- `declined` - Request was declined
- `automation-failed` - Automation encountered an error

## Command Reference

| Command | Description | Required Label | New Labels |
|---------|-------------|----------------|------------|
| `/generate-story` | Generate BMAD story | `feature-request` | `story-generated` |
| `/approve-implementation` | Start implementation | `story-generated` | `claude-implementing`, then `implementation-pr-created` |
| `/decline [reason]` | Decline request | `feature-request` | `declined` |

## Security

- Only authorized users can trigger commands
- Webhook signature verification required
- Commands in non-feature-request issues are ignored
- All actions are logged

## Monitoring

### Check Automation Status

Look for issues with these labels:
- `automation-failed` - Requires manual intervention
- `claude-implementing` - Currently being processed

### View Logs

```bash
tail -f log/production.log | grep ProcessFeatureStoryJob
```

### Email Notifications

Admins receive emails for:
- Story generation completion
- Implementation start
- Automation failures (if configured)

## Testing Webhook

Test the webhook endpoint:

```bash
# Generate test signature
PAYLOAD='{"action":"created","issue":{"number":123,"labels":[{"name":"feature-request"}]},"comment":{"body":"/generate-story","user":{"login":"admin_user"}}}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$GIT_WEBHOOK_SECRET" | sed 's/SHA256(.*)= /sha256=/')

# Send test request
curl -X POST https://your-app.com/github/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: issue_comment" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -d "$PAYLOAD"
```

## Troubleshooting

### Commands Not Working

1. Check user is in `GITHUB_AUTHORIZED_USERS`
2. Verify webhook secret matches
3. Ensure issue has `feature-request` label
4. Check Rails logs for errors

### Story Generation Fails

1. Check Claude CLI is authenticated
2. Verify GitHub token has correct permissions
3. Review error in issue comments

### Implementation Fails

1. Ensure story was generated first
2. Check Claude has access to repository
3. Review `automation-failed` issues
4. Check Claude conversation logs

## Best Practices

1. **Review Stories Carefully** - Ensure generated stories align with product vision
2. **Test PRs Thoroughly** - All Claude PRs need human review
3. **Monitor Labels** - Watch for `automation-failed` issues
4. **Provide Context** - More detailed feature requests produce better stories
5. **Batch Reviews** - Process multiple feature requests together for efficiency