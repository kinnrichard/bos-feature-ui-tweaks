# Claude Code Configuration

This directory contains configuration files for Claude Code integration with the DRY linting system.

## Files

### `hooks.json`
Configures Claude Code hooks to run shared linting system on file saves.

**Key Features:**
- **Post-save hook**: Runs linting immediately after Claude saves any file
- **Blocking behavior**: Prevents Claude from continuing if linting fails
- **File filtering**: Only runs on lintable file types (*.rb, *.js, *.ts, *.jsx, *.tsx, *.svelte)
- **Smart exclusions**: Skips node_modules, vendor, and build directories

### `settings.json`
Main Claude Code project settings with linting integration.

**Key Features:**
- **Shared configuration**: References `./scripts/lint-config.sh` for DRY setup
- **Context-aware**: Different settings for backend vs frontend
- **Integration**: Links to git hooks and npm scripts
- **Quality gates**: Enforces code standards before allowing workflow continuation

## How It Works

1. **Claude edits a file** → PostToolUse hook triggers automatically
2. **Initial check** → `./scripts/claude-lint-hook-posttool.sh` runs linting check
3. **Smart auto-fix** → If issues found, automatically attempts to fix them (formatting, etc.)
4. **Final validation** → Checks for remaining unfixable issues
5. **Result handling**:
   - ✅ **All issues fixed**: Claude continues normally
   - ⚠️ **Some issues auto-fixed**: Claude continues, clean code saved
   - ❌ **Unfixable issues remain**: Claude workflow blocked with specific error details

**Auto-fix Examples:**
- ✅ **Prettier formatting** (spaces, quotes, indentation)
- ✅ **RuboCop auto-corrections** (trailing whitespace, etc.)
- ❌ **Logic errors** (unused variables, syntax errors) - requires manual fix

## Usage Examples

### Manual Testing
```bash
# Test PostToolUse hook directly
CLAUDE_FILE_PATHS="app/models/user.rb" ./scripts/claude-lint-hook-posttool.sh

# Test with multiple files
CLAUDE_FILE_PATHS="frontend/src/app.ts frontend/src/lib.ts" ./scripts/claude-lint-hook-posttool.sh

# Debug mode
./scripts/claude-lint-hook-posttool.sh --debug
```

### NPM Scripts Integration
```bash
# Use shared linting commands
npm run lint:fix                    # Auto-fix all issues
npm run lint:staged                # Fix staged files  
npm run lint:frontend              # Fix frontend files only
```

## Configuration Customization

### Disable hooks temporarily
Edit `hooks.json`:
```json
{
  "hooks": {
    "post-save": {
      "enabled": false
    }
  }
}
```

### Enable auto-fix on save
Edit `settings.json`:
```json
{
  "linting": {
    "autoFixOnSave": true
  }
}
```

### Adjust timeout
Edit `hooks.json`:
```json
{
  "hooks": {
    "post-save": {
      "timeout": 120000
    }
  }
}
```

## Troubleshooting

### Hook not triggering
1. Check `hooks.json` has `"enabled": true`
2. Verify file extension is in `filePatterns`
3. Ensure script is executable: `chmod +x scripts/claude-lint-hook.sh`

### Linting errors
1. Run manual fix: `npm run lint:fix`
2. Check specific file: `./scripts/shared-lint.sh <file>`
3. Debug configuration: `./scripts/shared-lint.sh --debug`

### Performance issues
1. Increase timeout in `hooks.json`
2. Check for large files in exclusion patterns
3. Verify working directories are correct

## Integration Benefits

- **Zero Duplication**: Same linting logic for git, Claude, CI, and manual use
- **Consistent Standards**: Identical rules across all contexts
- **Developer Experience**: Claude automatically follows project code standards
- **Quality Assurance**: Prevents Claude from creating non-compliant code
- **Workflow Efficiency**: Immediate feedback without manual intervention
EOF < /dev/null