# Bug-to-PR Automation Implementation Stories

## Overview

This implementation creates a feedback system that:
- Allows users to report bugs and request features via in-app forms
- Creates GitHub Issues for all feedback
- Automatically generates fixes for bugs via Claude Code
- Uses semi-automated workflow for feature requests
- Requires no database models or admin UI
- Total estimated time: ~25-35 hours

## Epic 1: Feedback Collection System

### Story 1.1: Add Feedback Menu Items and Routes

**As a** user  
**I want** to report bugs or request features from the user menu  
**So that** I can easily provide feedback to improve the system

**Acceptance Criteria:**
1. Add dividers and two menu items to UserMenuComponent:
   - 🐞 Report a Bug
   - ✨ Request a Feature  
2. Position between Settings and Sign Out
3. Create FeedbackController with new and create actions
4. Add routes for /feedback/bug and /feedback/feature
5. Add Octokit gem to Gemfile
6. Configure GitHub client with access token

**Technical Notes:**
- No models needed - direct to GitHub Issues
- Use environment variable for GitHub token
- Follow existing controller patterns

**Estimated:** 2-3 hours

---

### Story 1.2: Build Bug Report Form with Screenshot

**As a** user reporting a bug  
**I want** to describe the issue and include a screenshot  
**So that** developers can see exactly what went wrong

**Acceptance Criteria:**
1. Create BugReportWidget Phlex component
2. Single form with title, description fields
3. Implement automatic screenshot capture flow:
   - User clicks "Report a Bug" in user menu
   - Close/hide the user menu dropdown
   - Wait for menu animation to complete (~200ms)
   - Capture screenshot using html2canvas
   - Then open the bug report form with screenshot already captured
4. Compress screenshot before uploading (2MB limit)
5. On submit, create GitHub Issue with:
   - Title from form
   - Body with description, browser info, console logs
   - Labels: ["bug", "auto-fix"]
   - Screenshot attached to issue

**Technical Notes:**
- Use html2canvas library for screenshot capture
- Capture sequence in Stimulus controller:
  ```javascript
  async reportBugClicked(event) {
    event.preventDefault();
    
    // 1. Close user menu dropdown
    this.dropdownController.close();
    
    // 2. Wait for animation
    await new Promise(resolve => setTimeout(resolve, 250));
    
    // 3. Capture screenshot of current page state
    const screenshot = await html2canvas(document.body, {
      scale: 0.3,
      logging: false
    });
    
    // 4. Store screenshot and open bug report form
    this.screenshotData = screenshot.toDataURL('image/jpeg', 0.7);
    this.openBugReportForm();
  }
  ```
- Upload image to GitHub via Issues API
- Format issue body with markdown sections

**Estimated:** 5-6 hours

---

### Story 1.3: Build Feature Request Multi-Step Form

**As a** user requesting a feature  
**I want** to provide detailed information about my needs  
**So that** developers understand what to build

**Acceptance Criteria:**
1. Create FeatureRequestWidget Phlex component
2. Implement 5-screen progressive form with these exact questions:

   **Screen 1: Initial Request**
   - "What would you like to add or improve?" (text field)
   - "How important is this to you?" (radio buttons)
     - Nice to have
     - Would really help my workflow  
     - Critical - blocking my work

   **Screen 2: Problem Definition**
   - "What problem are you trying to solve?" (text area)
   - "How do you handle this today?" (text area)
   - "How often do you face this?" (radio buttons)
     - Daily
     - Weekly  
     - Monthly
     - Occasionally

   **Screen 3: Solution Exploration**
   - "Describe your ideal solution" (text area)
   - "Have you seen this done well elsewhere?" (text area - optional)

   **Screen 4: Context**
   - "What's your main goal with this feature?" (text area)
     - Helper text: "Examples: Save time, reduce errors, automate tasks, better insights"
   - "Expected outcome after implementation?" (text area)
     - Helper text: "What specific improvement do you expect?"

   **Screen 5: Priority & Impact**
   - "Business impact if implemented?" (radio buttons)
     - Minor efficiency gain
     - Significant time savings
     - Unlocks new capabilities
     - Revenue/cost impact
   - "How can we measure success?" (text area)
     - Helper text: "What metrics would show this is working?"
   - "Anything else we should know?" (text area - optional)

3. Create GitHub Issue with all Q&A formatted in markdown
4. Apply labels: ["feature-request", "needs-review"]

**Technical Notes:**
- Use Stimulus for multi-step navigation
- Format Q&A pairs as markdown in issue body
- Save draft in localStorage to prevent data loss

**Estimated:** 6-8 hours

---

### Story 1.4: Browser Data Collection for Bugs

**As a** developer  
**I want** bug reports to include console and browser data  
**So that** I have debugging information automatically

**Acceptance Criteria:**
1. Create console capture Stimulus controller
2. Capture last 50 console entries (log, warn, error)
3. Capture browser info (user agent, viewport, etc.)
4. Capture current page URL automatically
5. Only collect for bug reports, not features
6. Include in GitHub issue body as collapsible sections:
   ```markdown
   <details>
   <summary>Console Logs</summary>
   
   ```json
   [console entries here]
   ```
   </details>
   ```

**Technical Notes:**
- Override console methods to capture
- Store in memory until submission
- Clear after successful submission

**Estimated:** 3-4 hours

## Epic 2: Automation Pipeline

### Story 2.1: Claude Integration for Bug Fixes

**As a** system  
**I want** to automatically fix reported bugs  
**So that** simple issues are resolved quickly

**Acceptance Criteria:**
1. Create ClaudeAutomationService
2. Create ProcessBugIssueJob using Solid Queue
3. When bug issue created, fetch issue details via Octokit
4. Format comprehensive prompt including:
   - Issue title, body, and number
   - Instructions for fix and PR creation
   - Branch naming: `fix/issue-#{issue_number}`
5. Execute via: `echo '#{prompt}' | claude --conversation-id issue-#{number}`
6. Claude creates PR with "Fixes #123" in description
7. Add "claude-processing" label during work
8. Remove label and add "pr-created" when done

**Technical Notes:**
- Example prompt structure:
  ```ruby
  prompt = <<~PROMPT
    You are Claude Code with BMAD Dev agent capabilities. 
    Fix the bug reported in GitHub Issue ##{issue.number}.
    
    ISSUE DETAILS:
    Title: #{issue.title}
    Body: #{issue.body}
    URL: #{issue.html_url}
    
    BMAD METHODOLOGY INSTRUCTIONS:
    
    1. ANALYZE (QA Agent approach):
       - Identify the root cause from symptoms
       - Determine affected components
       - Assess impact and severity
       - Note reproduction steps from report
    
    2. CREATE STORY (Story Manager approach):
       - Title: Fix: #{issue.title}
       - User Story: As a user, I want this bug fixed so that [impact]
       - Acceptance Criteria:
         * Bug no longer occurs
         * Tests cover the fix
         * No regression in related features
       - Technical Notes: Document your fix approach
    
    3. IMPLEMENT (Dev Agent approach):
       - Follow existing code patterns in the codebase
       - Make minimal changes to fix the issue
       - Add tests if applicable (check test patterns first)
       - Ensure no side effects
    
    4. GIT WORKFLOW:
       - Create branch: fix/issue-#{issue.number}
       - Commit with message: "Fix: #{issue.title}\n\nFixes ##{issue.number}"
       - Include story details in commit body
    
    5. CREATE PR:
       - Title: "Fix: #{issue.title}"
       - Body must include "Fixes ##{issue.number}" for auto-close
       - Add BMAD story summary
       - List files changed and why
       - Note any risks or concerns
    
    Follow BMAD best practices throughout. The PR will automatically close the issue when merged.
  PROMPT
  ```

**Estimated:** 5-6 hours

---

### Story 2.2: Feature Request Workflow

**As an** admin  
**I want** to review feature requests and generate stories  
**So that** I can manage product development efficiently

**Acceptance Criteria:**
1. Monitor issues with "feature-request" label
2. Add GitHub Issue comment with action buttons:
   - "Generate Story" - sends to Claude for story creation
   - "Approve Implementation" - triggers implementation
   - "Decline" - closes issue with explanation
3. When "Generate Story" clicked:
   - Send issue content to Claude
   - Claude adds story as issue comment
   - Add "story-generated" label
4. When "Approve Implementation" clicked:
   - Send to Claude for implementation
   - Create PR linked to issue

**Technical Notes:**
- Use GitHub Issue comments for workflow
- Can be triggered via slash commands in comments
- Simple HTML links with tokens for actions

**Estimated:** 4-5 hours

## Epic 3: Monitoring and Notifications

### Story 3.1: Basic Monitoring and Controls

**As an** admin  
**I want** to monitor the automation and control the system  
**So that** I can ensure safety and quality

**Acceptance Criteria:**
1. Add email notifications for:
   - New feature requests (to admin)
   - Bug automation failures (to admin)
   - Issue/PR creation (include links)
2. Create emergency off switch (environment variable)
3. Skip automation for specific file patterns
4. Add confidence check - skip if Claude unsure
5. Log all automation attempts to Rails log

**Technical Notes:**
- Use ActionMailer for notifications
- Add AUTOMATION_ENABLED env var
- Check file patterns before allowing automation
- Parse Claude's confidence from response

**Estimated:** 3-4 hours

## Implementation Order

1. **Week 1: Feedback Collection**
   - Story 1.1: Menu and routes (2-3 hours)
   - Story 1.2: Bug report form (5-6 hours)
   - Story 1.3: Feature request form (6-8 hours)
   - Story 1.4: Browser data (3-4 hours)
   - **Subtotal: 16-21 hours**

2. **Week 2: Automation**
   - Story 2.1: Claude integration (5-6 hours)
   - Story 2.2: Feature workflow (4-5 hours)
   - Story 3.1: Monitoring (3-4 hours)
   - **Subtotal: 12-15 hours**

**Total: 28-36 hours** (approximately 1-1.5 weeks for one developer)

## Key Simplifications from GitHub Issues

1. **No database models** - Everything in GitHub
2. **No admin UI** - Use GitHub Issues interface
3. **No status tracking** - GitHub handles it
4. **No user accounts sync** - Just include reporter info in issue
5. **Automatic PR-to-issue linking** - Via "Fixes #123"
6. **Built-in discussion** - GitHub Issue comments

## GitHub Configuration

### Required Labels:
- `bug` - Auto-added to bug reports
- `feature-request` - Auto-added to feature requests  
- `auto-fix` - Bugs eligible for automation
- `claude-processing` - Currently being fixed
- `pr-created` - PR has been created
- `needs-review` - Feature requests awaiting review
- `story-generated` - Story has been created

### Issue Templates:

**Bug Report:**
```markdown
**Reporter:** {user_email}
**URL:** {page_url}
**Date:** {timestamp}

## Description
{user_description}

## Browser Info
- User Agent: {user_agent}
- Viewport: {viewport_size}

<details>
<summary>Console Logs</summary>

```json
{console_logs}
```
</details>

<details>
<summary>Screenshot</summary>

{screenshot_attachment}
</details>
```

**Feature Request:**
```markdown
**Reporter:** {user_email}
**Date:** {timestamp}

## Request Summary
{what_to_improve}

## Importance
{importance_level}

## Problem Definition
**What problem are you trying to solve?**
{problem_description}

**How do you handle this today?**
{current_handling}

**How often?**
{frequency}

## Solution
**Ideal solution:**
{ideal_solution}

**Examples seen elsewhere:**
{examples}

## Context
**Main goal:**
{main_goal}

**Expected outcome:**
{expected_outcome}

## Impact
**Business impact:**
{business_impact}

**Success metrics:**
{success_metrics}

**Additional notes:**
{additional_notes}
```

## Success Metrics

- Time from bug report to PR < 10 minutes
- Feature request to story generation < 5 minutes  
- 80%+ automation success rate for simple bugs
- Zero security incidents from automated fixes
- Clean GitHub Issues organization