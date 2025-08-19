#!/bin/bash

# claude-lint-hook.sh - Claude Code hook integration
# Runs shared linting logic with Claude-specific context and error formatting
# Blocks Claude workflow until linting passes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Set Claude-specific context
export LINT_CONTEXT="claude"
export LINT_MODE="check"  # Start with check mode

# Source shared linting logic
source "$SCRIPT_DIR/shared-lint.sh"

# Claude-specific functions
claude_header() {
    echo "🔍 Claude Code Linting Hook"
    echo "=========================="
}

claude_success() {
    cat << 'EOF'
✅ LINTING PASSED - Claude workflow can continue

All files meet linting standards. Claude Code can proceed with next tasks.
EOF
}

claude_auto_fix_prompt() {
    local saved_file="$1"
    
    cat << EOF
🔧 AUTO-FIX AVAILABLE

Would you like Claude to automatically fix linting issues?

To auto-fix this file:
  LINT_MODE=fix ./scripts/shared-lint.sh "$saved_file"

Or fix manually and save again to continue.
EOF
}

# Main Claude hook execution
main() {
    local saved_file="$1"
    
    # Validate input
    if [[ -z "$saved_file" ]]; then
        echo "❌ Error: No file provided to Claude lint hook" >&2
        echo "Usage: claude-lint-hook.sh <saved_file>" >&2
        exit 1
    fi
    
    if [[ ! -f "$saved_file" ]]; then
        echo "❌ Error: File not found: $saved_file" >&2
        exit 1
    fi
    
    claude_header
    echo "File: $saved_file"
    echo ""
    
    # Check if file should be linted
    if ! should_lint_file "$saved_file"; then
        echo "ℹ️  Skipping lint for file type: $saved_file"
        echo "✅ Claude workflow can continue"
        exit 0
    fi
    
    # Reset state for fresh run
    reset_lint_state
    
    # Run linting in check mode first
    echo "Running linting checks..."
    if lint_files "$saved_file"; then
        claude_success
        exit 0
    else
        echo ""
        echo "🚨 LINTING FAILED - Claude workflow is BLOCKED"
        echo ""
        echo "Claude Code must fix these linting errors before continuing."
        echo "The file has not been saved in a lintable state."
        echo ""
        
        # Provide auto-fix guidance
        claude_auto_fix_prompt "$saved_file"
        
        # Exit with error to block Claude workflow
        exit 1
    fi
}

# Auto-fix mode for Claude integration
auto_fix_mode() {
    local saved_file="$1"
    
    claude_header
    echo "Auto-fix mode for: $saved_file"
    echo ""
    
    # Set fix mode
    export LINT_MODE="fix"
    
    # Reset state
    reset_lint_state
    
    echo "🔧 Attempting to auto-fix linting issues..."
    
    if lint_files "$saved_file"; then
        echo ""
        echo "✅ AUTO-FIX SUCCESSFUL"
        echo ""
        echo "File has been automatically fixed and meets linting standards."
        echo "Claude Code can now continue with next tasks."
        
        # Check if files were modified
        if files_were_modified; then
            echo ""
            echo "📝 Note: File was modified during auto-fix"
            echo "Claude Code should reload the file to see changes"
        fi
        
        exit 0
    else
        echo ""
        echo "❌ AUTO-FIX FAILED"
        echo ""
        echo "Some linting issues could not be automatically fixed."
        echo "Manual intervention required before Claude can continue."
        exit 1
    fi
}

# Handle different modes based on arguments
case "${1:-}" in
    "--auto-fix")
        auto_fix_mode "$2"
        ;;
    "--help"|"-h")
        cat << 'EOF'
Claude Code Linting Hook

Usage:
  claude-lint-hook.sh <file>           # Check mode (blocks Claude on errors)
  claude-lint-hook.sh --auto-fix <file> # Auto-fix mode (attempts to fix errors)

Environment Variables:
  LINT_CONTEXT=claude (automatically set)
  LINT_MODE=check|fix (set based on mode)

Integration:
  This script is designed to be called by Claude Code hooks.
  It will block Claude's workflow until linting passes.

Examples:
  claude-lint-hook.sh app/models/user.rb
  claude-lint-hook.sh --auto-fix frontend/src/app.ts
EOF
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac