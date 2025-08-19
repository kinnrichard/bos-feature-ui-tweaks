#!/bin/bash

# lint-fix.sh - Auto-fix wrapper using shared linting logic
# Convenience script for fixing linting issues across all contexts

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Set fix mode for shared linting
export LINT_MODE="fix"
export LINT_CONTEXT="${LINT_CONTEXT:-manual}"

# Source shared linting logic
source "$SCRIPT_DIR/shared-lint.sh"

# Auto-fix specific functions
show_usage() {
    cat << 'EOF'
Auto-fix Linting Issues

Usage:
  lint-fix.sh [files...]
  lint-fix.sh --all-staged     # Fix all staged git files
  lint-fix.sh --all-modified   # Fix all modified git files
  lint-fix.sh --ruby          # Fix all Ruby files in project
  lint-fix.sh --frontend      # Fix all JS/TS/Svelte files in frontend/

Examples:
  # Fix specific files
  ./scripts/lint-fix.sh app/models/user.rb frontend/src/app.ts
  
  # Fix all staged files before commit
  ./scripts/lint-fix.sh --all-staged
  
  # Fix all modified files
  ./scripts/lint-fix.sh --all-modified
  
  # Fix all Ruby files
  ./scripts/lint-fix.sh --ruby
  
  # Fix all frontend files
  ./scripts/lint-fix.sh --frontend

Environment Variables:
  LINT_CONTEXT - manual, git, claude, ci (default: manual)
EOF
}

# Get all Ruby files in project
get_all_ruby_files() {
    find . -name "*.rb" -not -path "./vendor/*" -not -path "./node_modules/*" | head -100
}

# Get all frontend files
get_all_frontend_files() {
    find frontend -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.svelte" 2>/dev/null | head -100
}

# Get staged files
get_staged_files() {
    git diff --cached --name-only --diff-filter=ACM
}

# Get modified files (including unstaged)
get_modified_files() {
    git diff --name-only HEAD
}

# Main auto-fix execution
main() {
    local files=()
    
    # Handle special flags
    case "${1:-}" in
        "--help"|"-h")
            show_usage
            exit 0
            ;;
        "--all-staged")
            echo "🔧 Auto-fixing all staged files..."
            while IFS= read -r file; do
                [[ -n "$file" ]] && files+=("$file")
            done < <(get_staged_files)
            ;;
        "--all-modified")
            echo "🔧 Auto-fixing all modified files..."
            while IFS= read -r file; do
                [[ -n "$file" ]] && files+=("$file")
            done < <(get_modified_files)
            ;;
        "--ruby")
            echo "🔧 Auto-fixing all Ruby files..."
            while IFS= read -r file; do
                [[ -n "$file" ]] && files+=("$file")
            done < <(get_all_ruby_files)
            ;;
        "--frontend")
            echo "🔧 Auto-fixing all frontend files..."
            while IFS= read -r file; do
                [[ -n "$file" ]] && files+=("$file")
            done < <(get_all_frontend_files)
            ;;
        "")
            show_usage
            exit 1
            ;;
        *)
            # Regular file arguments
            files=("$@")
            ;;
    esac
    
    # Validate files exist
    local valid_files=()
    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            valid_files+=("$file")
        else
            echo "⚠️  File not found: $file"
        fi
    done
    
    if [[ ${#valid_files[@]} -eq 0 ]]; then
        echo "❌ No valid files to fix"
        exit 1
    fi
    
    echo "Files to fix: ${#valid_files[@]}"
    echo ""
    
    # Reset state for fresh run
    reset_lint_state
    
    # Show what we're about to do
    echo "🔍 Analyzing files for auto-fix..."
    local lintable_files=()
    while IFS= read -r file; do
        [[ -n "$file" ]] && lintable_files+=("$file")
    done < <(filter_lintable_files "${valid_files[@]}")
    
    if [[ ${#lintable_files[@]} -eq 0 ]]; then
        echo "ℹ️  No lintable files found"
        exit 0
    fi
    
    echo "Lintable files: ${#lintable_files[@]}"
    
    # Group by context for user info
    local backend_files=()
    local frontend_files=()
    
    for file in "${lintable_files[@]}"; do
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
    
    if [[ ${#backend_files[@]} -gt 0 ]]; then
        echo "  Ruby files: ${#backend_files[@]}"
    fi
    if [[ ${#frontend_files[@]} -gt 0 ]]; then
        echo "  JS/TS/Svelte files: ${#frontend_files[@]}"
    fi
    
    echo ""
    echo "🚀 Starting auto-fix process..."
    
    # Run the shared linting logic in fix mode
    if lint_files "${lintable_files[@]}"; then
        echo ""
        echo "✅ AUTO-FIX COMPLETED SUCCESSFULLY"
        
        # Check if files were modified
        if files_were_modified; then
            echo ""
            echo "📝 Files were modified during auto-fix process"
            echo "💡 Tip: Review changes and stage them for commit"
            
            # Show git status if in git context
            if [[ "$LINT_CONTEXT" == "git" ]]; then
                echo ""
                echo "Git status after auto-fix:"
                git status --porcelain "${lintable_files[@]}" 2>/dev/null || true
            fi
        else
            echo "📝 No files were modified (already properly formatted)"
        fi
        
        exit 0
    else
        echo ""
        echo "❌ AUTO-FIX PARTIALLY FAILED"
        echo ""
        echo "Some issues were automatically fixed, but others require manual intervention."
        echo "Review the errors above and fix them manually."
        exit 1
    fi
}

# Execute main function
main "$@"