# bos

An AI-Trackdown project for hierarchical project management.

**Project Type:** software  
**Created:** 2025-07-19
**Tasks Directory:** tasks/

## Overview

This project uses AI-Trackdown for hierarchical project management with Epics, Issues, and Tasks. Each item has YAML frontmatter for metadata and Markdown content for descriptions.

## Unified Directory Structure

```
bos/
├── .ai-trackdown/          # Configuration and metadata
│   ├── config.yaml         # Project configuration
│   ├── counters.json       # ID generation counters
│   └── templates/          # Item templates
├── tasks/                  # Tasks root directory (configurable)
│   ├── epics/              # Epic-level planning (.md files)
│   ├── issues/             # Issue-level work items (.md files)
│   ├── tasks/              # Task-level activities (.md files)
│   ├── prs/                # Pull request tracking (.md files)
│   └── templates/          # Item templates
├── .gitignore             # Git ignore patterns
└── README.md              # This file
```

## Hierarchy

- **Epics** (EP-XXXX): High-level features or objectives
- **Issues** (ISS-XXXX): Specific work items within epics
- **Tasks** (TSK-XXXX): Granular activities within issues

## Getting Started

### View Items
```bash
# List all epics
ls tasks/epics/

# List all issues
ls tasks/issues/

# List all tasks
ls tasks/tasks/

# List all PRs
ls tasks/prs/
```

### Create New Items
```bash
# Create a new epic
aitrackdown epic create "New Feature Development"

# Create an issue within an epic
aitrackdown issue create "API Implementation" --epic EP-0001

# Create a task within an issue
aitrackdown task create "Design API Schema" --issue ISS-0001
```

### Project Management
```bash
# View project status
aitrackdown status

# Search items
aitrackdown search --status active --priority high

# Update item status
aitrackdown task update TSK-0001 --status completed

# Export project data
aitrackdown export --format json
```

## Configuration

Project configuration is stored in `.ai-trackdown/config.yaml`. You can modify:

- Directory structure
- Naming conventions
- Default assignee
- AI context templates
- Automation settings

## File Format

Each item file contains YAML frontmatter and Markdown content:

```markdown
---
epic_id: EP-0001
title: Project Setup and Initial Development
description: Initial setup and foundational development
status: active
priority: high
assignee: claude
created_date: 2023-XX-XX
updated_date: 2023-XX-XX
estimated_tokens: 500
actual_tokens: 0
ai_context:
  - project-setup
  - initial-development
related_issues:
  - ISS-0001
sync_status: local
---

# Epic: Project Setup and Initial Development

## Overview
Detailed description of the epic...
```

## Examples

The project includes example items to help you get started:
- **EP-0001**: Project Setup and Initial Development
- **ISS-0001**: Development Environment Setup
- **TSK-0001**: Install and configure development tools
- **TSK-0002**: Create development setup documentation

## Commands

| Command | Description |
|---------|-------------|
| `aitrackdown init` | Initialize a new project |
| `aitrackdown epic create` | Create a new epic |
| `aitrackdown issue create` | Create a new issue |
| `aitrackdown task create` | Create a new task |
| `aitrackdown status` | View project status |
| `aitrackdown search` | Search items |
| `aitrackdown export` | Export project data |

## Links

- [AI-Trackdown Documentation](https://github.com/your-org/ai-trackdown-tools)
- [Project Issues](https://github.com/your-org/ai-trackdown-tools/issues)

---

---
title: "bŏs - Business Operating System"
description: "Client/job/task management system for IT company technicians"
last_updated: "2025-07-17"
status: "active"
category: "project-root"
tags: ["readme", "setup", "getting-started", "project-overview"]
---

# bŏs - Business Operating System

## Email Reply Parser Setup

This application includes an advanced email reply parser using PyCall and Python's Talon library. Follow these steps for setup:

### 1. System Requirements
- **Ruby**: 3.2.2+
- **Python**: 3.8+ (system Python)
- **PostgreSQL**: 13+
- **Redis**: For caching (optional but recommended)

### 2. Python Dependencies
```bash
# Install Python dependencies
pip install -r requirements.txt

# Verify Talon installation
python -c "import talon; print(f'Talon version: {talon.__version__}')"
```

### 3. PyCall Configuration
The PyCall gem is already configured in `config/initializers/pycall.rb`. To verify:

```bash
# Test PyCall integration
bundle exec rake talon:status

# Run comprehensive functionality tests
bundle exec rake talon:test
```

### 4. Database Setup
```bash
# Run email parser migrations
rails db:migrate

# Check parsed_emails table
rails db:schema:load
```

### 5. Health Check
```bash
# Check parser availability via API
curl localhost:3000/api/v1/health

# Check parser status via rake task
bundle exec rake talon:status
```

For detailed setup instructions, see [docs/EMAIL_PARSER_SETUP.md](docs/EMAIL_PARSER_SETUP.md).

## Starting Up

```bash
rails server
```

then in another window:

```bash
cd frontend; npm run dev
````

## how to kill the rails server

```bash
kill $(lsof -ti:3000) 2>/dev/null || kill -9 $(lsof -ti:3000)
```

## how to run testing server (not development)

```bash
RAILS_ENV=test rails server -p 3000
````


## Zero server starting

this might work:
```bash
node scripts/zero-dev-server.js > zero-server.log 2>&1 &
```

⏺ Zero Database Server Management

  Starting Zero Cache Server

  # Start Zero cache server (in project root)
  ./node_modules/.bin/zero-cache --config zero-config.json > zero-server.log 2>&1 &

  # Alternative: Start in foreground to see logs
  ./node_modules/.bin/zero-cache --config zero-config.json

  Stopping Zero Cache Server

  # Find the Zero process
  ps aux | grep zero-cache

  # Kill by process ID (replace XXXX with actual PID)
  kill XXXX

  # Or kill all Zero processes
  pkill -f zero-cache

  Rails Database Servers

  The Rails app uses three PostgreSQL databases:

  1. Primary Database: bos_development (your existing data)
  2. CVR Database: bos_development_cvr (Change View Records)
  3. CDB Database: bos_development_cdb (Change Database)

  PostgreSQL itself is managed by your system (Homebrew, Docker, etc.):

  # Start PostgreSQL (if using Homebrew)
  brew services start postgresql

  # Stop PostgreSQL  
  brew services stop postgresql

  # Check PostgreSQL status
  brew services list | grep postgresql

  Rails Server

  # Start Rails server (API backend)
  rails server -b 0.0.0.0 > /dev/null 2>&1 &

  # Stop Rails server
  pkill -f "rails server"

  Complete Development Stack

  # Start everything
  brew services start postgresql  # If not already running
  rails server -b 0.0.0.0 > rails.log 2>&1 &
  ./node_modules/.bin/zero-cache --config zero-config.json > zero-server.log 2>&1 &
  cd frontend && npm run dev  # Svelte frontend

  # Stop everything  
  pkill -f "rails server"
  pkill -f zero-cache
  # PostgreSQL can stay running


*Generated by ai-trackdown-tools on 2025-07-19*
