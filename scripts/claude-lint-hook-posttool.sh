#!/bin/bash

# claude-lint-hook-posttool.sh - Claude Code PostToolUse hook for linting
# Triggers after Claude uses Edit, Write, or MultiEdit tools
# Uses Claude Code's environment variables for file paths

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

# Set Claude-specific context
export LINT_CONTEXT="claude"
export LINT_MODE="check"  # Start with check mode, can be overridden

# Source shared linting logic
source "$SCRIPT_DIR/shared-lint.sh"

# Claude Code hook functions
claude_posttool_header() {
    echo "🔍 Claude Code PostToolUse Linting Hook"
    echo "======================================="
}

claude_extract_files_from_stdin() {
    # Claude Code hooks receive JSON input via stdin
    # Extract file paths from the tool input for different tool types
    local files=()
    
    # Try to get files from CLAUDE_FILE_PATHS environment variable first
    if [[ -n "$CLAUDE_FILE_PATHS" ]]; then
        # Split space-separated file paths
        IFS=' ' read -ra files <<< "$CLAUDE_FILE_PATHS"
    else
        # Fallback: try to extract from stdin JSON
        # Read stdin and extract file_path from tool_input
        local stdin_content
        if stdin_content=$(timeout 1 cat 2>/dev/null); then
            # Try different JSON structures for different tools
            
            # Standard file_path (Edit, Write)
            local file_path
            file_path=$(echo "$stdin_content" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")
            if [[ -n "$file_path" && "$file_path" != "null" ]]; then
                files+=("$file_path")
            fi
            
            # NotebookEdit: notebook_path
            local notebook_path
            notebook_path=$(echo "$stdin_content" | jq -r '.tool_input.notebook_path // empty' 2>/dev/null || echo "")
            if [[ -n "$notebook_path" && "$notebook_path" != "null" ]]; then
                files+=("$notebook_path")
            fi
            
            # MultiEdit: file_path at root level
            local multi_file_path
            multi_file_path=$(echo "$stdin_content" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")
            if [[ -n "$multi_file_path" && "$multi_file_path" != "null" && "$multi_file_path" != "$file_path" ]]; then
                files+=("$multi_file_path")
            fi
            
            # Extract from edits array if present (MultiEdit alternative structure)
            local edit_files
            if edit_files=$(echo "$stdin_content" | jq -r '.tool_input.edits[]?.file_path // empty' 2>/dev/null); then
                while IFS= read -r edit_file; do
                    if [[ -n "$edit_file" && "$edit_file" != "null" ]]; then
                        files+=("$edit_file")
                    fi
                done <<< "$edit_files"
            fi
        fi
    fi
    
    # Remove duplicates and print
    local unique_files=()
    for file in "${files[@]}"; do
        if [[ ! " ${unique_files[@]} " =~ " ${file} " ]]; then
            unique_files+=("$file")
        fi
    done
    
    printf '%s\n' "${unique_files[@]}"
}

claude_success_message() {
    cat << 'EOF'
✅ CLAUDE CODE LINTING PASSED

All modified files meet linting standards. 
Claude Code workflow can continue normally.
EOF
}

claude_failure_message() {
    # Send error messages to stderr for Claude Code
    cat >&2 << 'EOF'
❌ CLAUDE CODE LINTING FAILED

🚫 CRITICAL: Claude has created files with linting violations!

This will cause git commit failures. Please fix these issues:

EOF
}

claude_auto_fix_suggestion() {
    local files=("$@")
    
    # Send fix suggestions to stderr for Claude Code
    {
        echo ""
        echo "🔧 RECOMMENDED ACTIONS:"
        echo ""
        echo "1. Auto-fix all issues:"
        printf '   ./scripts/lint-fix.sh'
        for file in "${files[@]}"; do
            printf ' "%s"' "$file"
        done
        echo ""
        echo ""
        echo "2. Or fix by category:"
        
        # Group files by context for targeted fixing
        local backend_files=()
        local frontend_files=()
        
        for file in "${files[@]}"; do
            if [[ -f "$file" ]]; then
                local context=$(get_context_for_file "$file")
                case "$context" in
                    "backend")
                        backend_files+=("$file")
                        ;;
                    "frontend")
                        frontend_files+=("$file")
                        ;;
                esac
            fi
        done
        
        if [[ ${#backend_files[@]} -gt 0 ]]; then
            echo "   Ruby files: ./scripts/lint-fix.sh --ruby"
        fi
        if [[ ${#frontend_files[@]} -gt 0 ]]; then
            echo "   Frontend files: ./scripts/lint-fix.sh --frontend"
        fi
        
        echo ""
        echo "3. Then commit your changes normally"
        echo ""
        echo "⚠️  Future Claude edits will be blocked until this is resolved!"
    } >&2
}

# Main PostToolUse hook execution
main() {
    claude_posttool_header
    
    # Extract files that were modified by Claude
    local files=()
    while IFS= read -r file; do
        [[ -n "$file" ]] && files+=("$file")
    done < <(claude_extract_files_from_stdin)
    
    if [[ ${#files[@]} -eq 0 ]]; then
        echo "ℹ️  No files detected from Claude tool usage"
        echo "✅ Hook completed successfully"
        exit 0
    fi
    
    echo "Files modified by Claude: ${#files[@]}"
    for file in "${files[@]}"; do
        echo "  - $file"
    done
    echo ""
    
    # Filter to files that exist and should be linted
    local existing_files=()
    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            existing_files+=("$file")
        else
            echo "⚠️  File not found: $file"
        fi
    done
    
    if [[ ${#existing_files[@]} -eq 0 ]]; then
        echo "ℹ️  No existing files to lint"
        echo "✅ Hook completed successfully"
        exit 0
    fi
    
    # Step 1: Run initial lint check (silently)
    echo "🔍 Running linting checks on Claude's changes..."
    reset_lint_state
    export LINT_MODE="check"
    
    if lint_files "${existing_files[@]}" >/dev/null 2>&1; then
        claude_success_message
        exit 0
    fi
    
    # Step 2: Issues found - try auto-fix silently using lint-fix.sh
    echo "⚠️  Linting issues detected, attempting auto-fix..."
    
    # Use the existing lint-fix script for reliable auto-fixing
    export LINT_CONTEXT="claude"
    if "$SCRIPT_DIR/lint-fix.sh" "${existing_files[@]}" >/dev/null 2>&1; then
        echo "✅ All issues were automatically fixed!"
        claude_success_message
        exit 0
    fi
    
    # Step 3: Some issues remain - show the actual errors
    echo "❌ Some issues could not be automatically fixed"
    claude_failure_message
    
    # Run a final lint check to show remaining errors to Claude via stderr
    echo "" >&2
    echo "Remaining linting errors after auto-fix:" >&2
    reset_lint_state
    export LINT_MODE="check"
    
    # Capture and redirect the actual linting output to stderr
    {
        lint_files "${existing_files[@]}" 2>&1 || true
    } | sed 's/^/  /' >&2
    
    # Provide specific fix suggestions for remaining issues
    claude_auto_fix_suggestion "${existing_files[@]}"
    
    # Exit with code 2 to signal Claude Code that action is required
    exit 2
}

# Handle different execution modes
case "${1:-}" in
    "--debug")
        echo "🐛 Debug mode"
        claude_posttool_header
        echo "Environment variables:"
        echo "  CLAUDE_PROJECT_DIR: ${CLAUDE_PROJECT_DIR:-<not set>}"
        echo "  CLAUDE_FILE_PATHS: ${CLAUDE_FILE_PATHS:-<not set>}"
        echo "  CLAUDE_TOOL_OUTPUT: ${CLAUDE_TOOL_OUTPUT:-<not set>}"
        echo ""
        
        # Show raw JSON input if available
        echo "Checking for JSON input on stdin..."
        local stdin_content
        if stdin_content=$(timeout 1 cat 2>/dev/null); then
            echo "Raw JSON input received:"
            echo "$stdin_content" | jq . 2>/dev/null || echo "$stdin_content"
            echo ""
            
            # Show what we extract from it
            echo "Extracted file paths:"
            echo "$stdin_content" | {
                files=()
                
                # Test all extraction methods
                file_path=$(jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")
                notebook_path=$(jq -r '.tool_input.notebook_path // empty' 2>/dev/null || echo "")
                
                [[ -n "$file_path" && "$file_path" != "null" ]] && echo "  file_path: $file_path"
                [[ -n "$notebook_path" && "$notebook_path" != "null" ]] && echo "  notebook_path: $notebook_path"
                
                # Test edits array
                if jq -e '.tool_input.edits' >/dev/null 2>&1; then
                    echo "  edits array found:"
                    jq -r '.tool_input.edits[]?.file_path // empty' 2>/dev/null | while read -r edit_file; do
                        [[ -n "$edit_file" && "$edit_file" != "null" ]] && echo "    - $edit_file"
                    done
                fi
            }
        else
            echo "No JSON input on stdin"
        fi
        echo ""
        
        echo "Final detected files:"
        claude_extract_files_from_stdin
        exit 0
        ;;
    "--help"|"-h")
        cat << 'EOF'
Claude Code PostToolUse Linting Hook

This hook automatically runs after Claude uses Edit, Write, or MultiEdit tools.
It checks the modified files for linting issues using the shared linting system.

Environment Variables (provided by Claude Code):
  CLAUDE_PROJECT_DIR - Project root directory
  CLAUDE_FILE_PATHS  - Space-separated list of modified files
  CLAUDE_TOOL_OUTPUT - Output from the tool execution

Configuration:
  This hook is configured in .claude/settings.json under hooks.PostToolUse

Usage:
  # Normal execution (called automatically by Claude Code)
  claude-lint-hook-posttool.sh
  
  # Debug mode
  claude-lint-hook-posttool.sh --debug
  
  # Manual test with file paths
  CLAUDE_FILE_PATHS="app/models/user.rb frontend/src/app.ts" claude-lint-hook-posttool.sh

Integration:
  The hook uses the same shared linting logic as git hooks and manual commands,
  ensuring consistent code quality across all contexts.
EOF
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac