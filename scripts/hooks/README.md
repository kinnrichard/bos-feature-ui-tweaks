# Git Hooks Setup

This directory contains git hooks that can be optionally installed for development.

## Available Hooks

### `pre-commit`
- **Runs RuboCop** on changed Ruby files with auto-fix
- **Runs ESLint + Prettier** on changed JS/TS/Svelte files with auto-fix  
- **Ensures final newlines** on all changed files
- **Re-stages auto-fixed files** automatically

## Installation

### Option 1: Manual Installation
```bash
# Copy the hook and make it executable
cp scripts/hooks/pre-commit .git/hooks/
chmod +x .git/hooks/pre-commit
```

### Option 2: Use the Setup Script
```bash
# Run the setup script (creates symlink for easier updates)
scripts/hooks/setup.sh
```

## Verification

Test that the hook is working:
```bash
# Make a small change to a Ruby or JS file
echo "# test comment" >> app/models/user.rb

# Try to commit (hook should run automatically)
git add app/models/user.rb
git commit -m "test commit"
```

## Bypassing the Hook

If you need to bypass the hook for a specific commit:
```bash
git commit --no-verify -m "skip hooks for this commit"
```

## Updating Hooks

When hooks are updated in `scripts/hooks/`, you need to reinstall them:
```bash
# If using manual installation
cp scripts/hooks/pre-commit .git/hooks/

# If using setup script (symlink updates automatically)
# No action needed - changes are automatically reflected
```

## Benefits

- ✅ **Consistent code formatting** across the team
- ✅ **Catches linting issues** before they reach CI
- ✅ **Auto-fixes common issues** (indentation, final newlines)
- ✅ **Prevents broken commits** from failing CI builds
- ✅ **Optional installation** - doesn't force hooks on developers

## Troubleshooting

### Hook not running
- Verify the file is executable: `ls -la .git/hooks/pre-commit`
- Check the shebang: `head -1 .git/hooks/pre-commit` (should be `#!/bin/sh`)

### Hook failing
- Run the linters manually to see specific errors:
  ```bash
  bin/rubocop -a
  cd frontend && npm run lint
  ```
- Bypass the hook temporarily: `git commit --no-verify`