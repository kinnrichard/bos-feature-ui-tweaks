#!/bin/bash

# shared-lint.sh - Single source of truth for all linting operations
# Used by git hooks, Claude hooks, CI, and manual linting
# Replicates exact logic from original pre-commit hook with context awareness

set -e

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Source shared configuration
source "$SCRIPT_DIR/lint-config.sh"

# Validate configuration on load
if ! validate_config; then
    echo "❌ Lint configuration validation failed" >&2
    exit 1
fi

# Global state for error tracking
LINT_ERRORS=()
LINT_CONTEXT="${LINT_CONTEXT:-manual}"
FILES_MODIFIED=false

# === CORE LINTING FUNCTIONS ===

# Run specific linter on file with proper context
run_linter() {
    local linter="$1"
    local file="$2"
    local mode="${3:-check}"  # check, fix, or validate
    local context=$(get_context_for_file "$file")
    local working_dir=$(get_working_directory "$context")
    local relative_file=$(get_relative_file_path "$file" "$context")
    local exit_code=0
    
    # Change to appropriate working directory
    local original_dir="$PWD"
    cd "$working_dir" || {
        echo "Error: Cannot change to working directory: $working_dir" >&2
        return 1
    }
    
    # Select appropriate command based on mode
    local cmd_key=""
    case "$mode" in
        "fix")
            cmd_key="${linter}_fix"
            ;;
        "check"|"validate"|*)
            cmd_key="${linter}_check"
            ;;
    esac
    
    # Execute linter command
    case "$linter" in
        "rubocop")
            if [[ "$mode" == "fix" ]]; then
                if ! bin/rubocop -a "$relative_file" >/dev/null 2>&1; then
                    exit_code=1
                fi
            else
                if ! bin/rubocop "$relative_file" >/dev/null 2>&1; then
                    exit_code=1
                fi
            fi
            ;;
        "eslint")
            if [[ "$mode" == "fix" ]]; then
                if ! npx eslint --fix "$relative_file" >/dev/null 2>&1; then
                    exit_code=1
                fi
            else
                if ! npx eslint "$relative_file" >/dev/null 2>&1; then
                    exit_code=1
                fi
            fi
            ;;
        "prettier")
            if [[ "$mode" == "fix" ]]; then
                if ! npx prettier --write "$relative_file" >/dev/null 2>&1; then
                    exit_code=1
                fi
            else
                if ! npx prettier --check "$relative_file" >/dev/null 2>&1; then
                    exit_code=1
                fi
            fi
            ;;
        *)
            echo "Unknown linter: $linter" >&2
            exit_code=1
            ;;
    esac
    
    # Return to original directory
    cd "$original_dir"
    
    return $exit_code
}

# Ensure final newlines (replicating original pre-commit logic)
ensure_final_newlines() {
    local files=("$@")
    local newlines_added=false
    
    for file in "${files[@]}"; do
        if [[ -f "$file" ]] && [[ -n "$(tail -c1 "$file" 2>/dev/null)" ]]; then
            echo "" >> "$file"
            echo "Added final newline to: $file"
            newlines_added=true
        fi
    done
    
    if [[ "$newlines_added" == "true" ]]; then
        FILES_MODIFIED=true
    fi
}

# Record lint error for later reporting
record_lint_error() {
    local linter="$1"
    local file="$2"
    local context="$3"
    local mode="$4"
    LINT_ERRORS+=("$context|$linter|$file|$mode")
}

# Process files by context grouping (backend vs frontend)
process_files_by_context() {
    local files=("$@")
    local mode="${LINT_MODE:-check}"
    local overall_exit_code=0
    
    # Group files by context
    local backend_files=()
    local frontend_files=()
    
    for file in "${files[@]}"; do
        local context=$(get_context_for_file "$file")
        case "$context" in
            "backend")
                backend_files+=("$file")
                ;;
            "frontend")
                frontend_files+=("$file")
                ;;
        esac
    done
    
    # Process backend files (Ruby)
    if [[ ${#backend_files[@]} -gt 0 ]]; then
        echo "Processing $(echo "${backend_files[@]}" | wc -w) Ruby files..."
        
        for file in "${backend_files[@]}"; do
            set_linters_for_file "$file"
            
            for linter in "${ENABLED_LINTERS[@]}"; do
                if ! run_linter "$linter" "$file" "$mode"; then
                    record_lint_error "$linter" "$file" "backend" "$mode"
                    overall_exit_code=1
                fi
            done
        done
        
        # Handle final newlines for backend files
        ensure_final_newlines "${backend_files[@]}"
    fi
    
    # Process frontend files (JS/TS/Svelte)
    if [[ ${#frontend_files[@]} -gt 0 ]]; then
        echo "Processing $(echo "${frontend_files[@]}" | wc -w) JS/TS/Svelte files..."
        
        # Group frontend files for batch processing
        local js_ts_files=()
        for file in "${frontend_files[@]}"; do
            js_ts_files+=("$file")
        done
        
        if [[ ${#js_ts_files[@]} -gt 0 ]]; then
            # Process ESLint first
            local working_dir=$(get_working_directory "frontend")
            local original_dir="$PWD"
            cd "$working_dir" || {
                echo "Error: Cannot change to frontend directory" >&2
                return 1
            }
            
            # Convert to relative paths for frontend context
            local relative_files=()
            for file in "${js_ts_files[@]}"; do
                relative_files+=("$(get_relative_file_path "$file" "frontend")")
            done
            
            # Run ESLint
            if [[ "$mode" == "fix" ]]; then
                if ! printf '%s\n' "${relative_files[@]}" | xargs npx eslint --fix; then
                    for file in "${js_ts_files[@]}"; do
                        record_lint_error "eslint" "$file" "frontend" "$mode"
                    done
                    overall_exit_code=1
                fi
            else
                if ! printf '%s\n' "${relative_files[@]}" | xargs npx eslint; then
                    for file in "${js_ts_files[@]}"; do
                        record_lint_error "eslint" "$file" "frontend" "$mode"
                    done
                    overall_exit_code=1
                fi
            fi
            
            # Run Prettier (always after ESLint)
            if [[ "$overall_exit_code" -eq 0 ]] || [[ "$mode" == "fix" ]]; then
                if [[ "$mode" == "fix" ]]; then
                    printf '%s\n' "${relative_files[@]}" | xargs npx prettier --write
                else
                    if ! printf '%s\n' "${relative_files[@]}" | xargs npx prettier --check; then
                        for file in "${js_ts_files[@]}"; do
                            record_lint_error "prettier" "$file" "frontend" "$mode"
                        done
                        overall_exit_code=1
                    fi
                fi
            fi
            
            cd "$original_dir"
        fi
        
        # Handle final newlines for frontend files
        ensure_final_newlines "${frontend_files[@]}"
    fi
    
    return $overall_exit_code
}

# Main linting function - entry point for all linting operations
lint_files() {
    local files=("$@")
    local mode="${LINT_MODE:-check}"
    
    # Validate inputs
    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No files provided for linting"
        return 0
    fi
    
    # Filter to lintable files only
    local lintable_files=()
    while IFS= read -r file; do
        [[ -n "$file" ]] && lintable_files+=("$file")
    done < <(filter_lintable_files "${files[@]}")
    
    if [[ ${#lintable_files[@]} -eq 0 ]]; then
        echo "No lintable files found"
        return 0
    fi
    
    echo "🔍 Running linting in context: $LINT_CONTEXT"
    echo "Mode: $mode"
    echo "Files: ${#lintable_files[@]}"
    
    # Process files
    local exit_code=0
    if ! process_files_by_context "${lintable_files[@]}"; then
        exit_code=1
    fi
    
    # Report results
    if [[ $exit_code -ne 0 ]]; then
        format_lint_errors
    else
        echo "✅ All linting checks passed!"
    fi
    
    return $exit_code
}

# === ERROR FORMATTING FUNCTIONS ===

# Format errors based on context (git, claude, ci, manual)
format_lint_errors() {
    if [[ ${#LINT_ERRORS[@]} -eq 0 ]]; then
        return 0
    fi
    
    echo ""
    case "$LINT_CONTEXT" in
        "claude")
            format_claude_errors
            ;;
        "git")
            format_git_errors
            ;;
        "ci")
            format_ci_errors
            ;;
        *)
            format_manual_errors
            ;;
    esac
}

format_claude_errors() {
    # For Claude context, output to stderr so Claude Code can see the errors
    {
        cat << 'EOF'
❌ LINTING FAILED - BLOCKING CLAUDE WORKFLOW

🚫 REQUIRED ACTION: Fix linting errors before proceeding

To fix these issues:
EOF
        
        local backend_errors=()
        local frontend_errors=()
        
        for error in "${LINT_ERRORS[@]}"; do
            IFS='|' read -r context linter file mode <<< "$error"
            case "$context" in
                "backend")
                    backend_errors+=("$file ($linter)")
                    ;;
                "frontend")
                    frontend_errors+=("$file ($linter)")
                    ;;
            esac
        done
        
        if [[ ${#backend_errors[@]} -gt 0 ]]; then
            echo ""
            echo "📝 Ruby files - Run from project root:"
            for error in "${backend_errors[@]}"; do
                echo "  bin/rubocop -a $error"
            done
        fi
        
        if [[ ${#frontend_errors[@]} -gt 0 ]]; then
            echo ""
            echo "📝 JS/TS/Svelte files - Run from frontend/ directory:"
            echo "  npm run lint"
            for error in "${frontend_errors[@]}"; do
                echo "  npx prettier --write $error"
            done
        fi
        
        cat << 'EOF'

⏸️  ALL CLAUDE TASKS BLOCKED UNTIL LINTING PASSES
✅ Save files again after fixing to resume workflow
EOF
    } >&2
}

format_git_errors() {
    cat << 'EOF'
❌ COMMIT BLOCKED - Linting errors found

Fix these issues before committing:
EOF
    
    for error in "${LINT_ERRORS[@]}"; do
        IFS='|' read -r context linter file mode <<< "$error"
        echo "  • $file ($linter)"
    done
    
    echo ""
    echo "Run the auto-fix commands above or use: scripts/lint-fix.sh <files>"
}

format_ci_errors() {
    echo "❌ CI LINTING FAILED"
    echo ""
    echo "Files with linting errors:"
    
    for error in "${LINT_ERRORS[@]}"; do
        IFS='|' read -r context linter file mode <<< "$error"
        echo "  - $file: $linter failed"
    done
}

format_manual_errors() {
    echo "❌ LINTING ERRORS FOUND"
    echo ""
    
    for error in "${LINT_ERRORS[@]}"; do
        IFS='|' read -r context linter file mode <<< "$error"
        echo "  $file: $linter ($context)"
    done
    
    echo ""
    echo "💡 Tip: Use 'LINT_MODE=fix ./scripts/shared-lint.sh <files>' to auto-fix"
}

# === UTILITY FUNCTIONS ===

# Check if files were modified during linting
files_were_modified() {
    [[ "$FILES_MODIFIED" == "true" ]]
}

# Reset state for fresh run
reset_lint_state() {
    LINT_ERRORS=()
    FILES_MODIFIED=false
}

# Main execution when script is run directly
main() {
    local files=("$@")
    
    # If no files provided, show usage
    if [[ ${#files[@]} -eq 0 ]]; then
        cat << 'EOF'
Usage: shared-lint.sh [files...]

Environment variables:
  LINT_CONTEXT - git, claude, ci, manual (default: manual)
  LINT_MODE    - check, fix (default: check)

Examples:
  # Check files
  ./scripts/shared-lint.sh app/models/user.rb frontend/src/app.js
  
  # Auto-fix files
  LINT_MODE=fix ./scripts/shared-lint.sh app/models/user.rb
  
  # Claude context with auto-fix
  LINT_CONTEXT=claude LINT_MODE=fix ./scripts/shared-lint.sh file.rb
  
  # Debug configuration
  DEBUG=1 ./scripts/shared-lint.sh --debug
EOF
        exit 1
    fi
    
    # Handle debug flag
    if [[ "$1" == "--debug" ]]; then
        debug_config
        exit 0
    fi
    
    # Run linting
    if lint_files "${files[@]}"; then
        exit 0
    else
        exit 1
    fi
}

# Export functions for use by other scripts
export -f lint_files
export -f run_linter
export -f ensure_final_newlines
export -f process_files_by_context
export -f files_were_modified
export -f reset_lint_state

# Run main if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi