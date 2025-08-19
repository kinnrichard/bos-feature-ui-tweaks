#!/bin/bash

# lint-config.sh - Single source of truth for all linting configuration
# This file contains all file type mappings and linter configurations
# Used by git hooks, Claude hooks, CI, and manual linting

set -e

# Project structure configuration
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# File type to linter mappings (using case statements for compatibility)
get_linters_for_extension() {
    case "$1" in
        ".rb") echo "rubocop" ;;
        ".js") echo "eslint prettier" ;;
        ".ts") echo "eslint prettier" ;;
        ".jsx") echo "eslint prettier" ;;
        ".tsx") echo "eslint prettier" ;;
        ".svelte") echo "eslint prettier" ;;
        *) echo "" ;;
    esac
}

# File type to context mappings (where to run the linters)
get_context_for_extension() {
    case "$1" in
        ".rb") echo "backend" ;;
        ".js") echo "frontend" ;;
        ".ts") echo "frontend" ;;
        ".jsx") echo "frontend" ;;
        ".tsx") echo "frontend" ;;
        ".svelte") echo "frontend" ;;
        *) echo "unknown" ;;
    esac
}

# Linter command configurations
get_linter_command() {
    case "$1" in
        "rubocop") echo "bin/rubocop" ;;
        "eslint") echo "npx eslint" ;;
        "prettier") echo "npx prettier" ;;
        *) echo "" ;;
    esac
}

# Auto-fix command configurations
get_linter_fix_command() {
    case "$1" in
        "rubocop") echo "bin/rubocop -a" ;;
        "eslint") echo "npx eslint --fix" ;;
        "prettier") echo "npx prettier --write" ;;
        *) echo "" ;;
    esac
}

# Check command configurations (for validation only)
get_linter_check_command() {
    case "$1" in
        "rubocop") echo "bin/rubocop" ;;
        "eslint") echo "npx eslint" ;;
        "prettier") echo "npx prettier --check" ;;
        *) echo "" ;;
    esac
}

# Get file extension with dot
get_file_extension() {
    local file="$1"
    echo ".${file##*.}"
}

# Get linters for a specific file
get_linters_for_file() {
    local file="$1"
    local ext=$(get_file_extension "$file")
    get_linters_for_extension "$ext"
}

# Get context for a specific file (backend/frontend)
get_context_for_file() {
    local file="$1"
    local ext=$(get_file_extension "$file")
    get_context_for_extension "$ext"
}

# Check if file should be linted
should_lint_file() {
    local file="$1"
    local linters=$(get_linters_for_file "$file")
    [[ -n "$linters" ]]
}

# Filter frontend files to only include those in frontend/ directory
is_frontend_file() {
    local file="$1"
    [[ "$file" == frontend/* ]]
}

# Filter files by lintability and context
filter_lintable_files() {
    local files=("$@")
    local lintable_files=()
    
    for file in "${files[@]}"; do
        if [[ -f "$file" ]] && should_lint_file "$file"; then
            # Additional filtering for frontend files
            local context=$(get_context_for_file "$file")
            if [[ "$context" == "frontend" ]]; then
                if is_frontend_file "$file"; then
                    lintable_files+=("$file")
                fi
            else
                lintable_files+=("$file")
            fi
        fi
    done
    
    printf '%s\n' "${lintable_files[@]}"
}

# Set enabled linters for a specific file
set_linters_for_file() {
    local file="$1"
    local linters=$(get_linters_for_file "$file")
    ENABLED_LINTERS=($linters)
    CURRENT_CONTEXT=$(get_context_for_file "$file")
}

# Set enabled linters for multiple files (consolidates all needed linters)
set_linters_for_files() {
    local files=("$@")
    local all_linters=()
    local all_contexts=()
    
    for file in "${files[@]}"; do
        local file_linters=($(get_linters_for_file "$file"))
        local file_context=$(get_context_for_file "$file")
        
        # Add linters to array
        all_linters+=("${file_linters[@]}")
        
        # Track contexts
        if [[ ! " ${all_contexts[@]} " =~ " ${file_context} " ]]; then
            all_contexts+=("$file_context")
        fi
    done
    
    # Remove duplicates from linters
    ENABLED_LINTERS=($(printf '%s\n' "${all_linters[@]}" | sort -u))
    CURRENT_CONTEXTS=("${all_contexts[@]}")
}

# Get working directory for linter context
get_working_directory() {
    local context="$1"
    case "$context" in
        "frontend")
            echo "$FRONTEND_DIR"
            ;;
        "backend"|*)
            echo "$PROJECT_ROOT"
            ;;
    esac
}

# Get relative file path for context
get_relative_file_path() {
    local file="$1"
    local context="$2"
    
    case "$context" in
        "frontend")
            # Remove frontend/ prefix for frontend context
            echo "${file#frontend/}"
            ;;
        *)
            echo "$file"
            ;;
    esac
}

# Validate configuration
validate_config() {
    # Check if required directories exist
    if [[ ! -d "$PROJECT_ROOT" ]]; then
        echo "Error: Project root not found: $PROJECT_ROOT" >&2
        return 1
    fi
    
    if [[ ! -d "$FRONTEND_DIR" ]]; then
        echo "Warning: Frontend directory not found: $FRONTEND_DIR" >&2
    fi
    
    # Check if linter commands exist
    if ! command -v git >/dev/null 2>&1; then
        echo "Error: git command not found" >&2
        return 1
    fi
    
    return 0
}

# Debug function to print configuration
debug_config() {
    echo "=== Lint Configuration Debug ==="
    echo "PROJECT_ROOT: $PROJECT_ROOT"
    echo "FRONTEND_DIR: $FRONTEND_DIR"
    echo ""
    echo "File Type Mappings:"
    for ext in ".rb" ".js" ".ts" ".jsx" ".tsx" ".svelte"; do
        local linters=$(get_linters_for_extension "$ext")
        local context=$(get_context_for_extension "$ext")
        echo "  $ext -> $linters ($context)"
    done
    echo ""
    echo "Linter Commands:"
    for linter in "rubocop" "eslint" "prettier"; do
        echo "  $linter:"
        echo "    check: $(get_linter_check_command "$linter")"
        echo "    fix: $(get_linter_fix_command "$linter")"
    done
    echo "==============================="
}

# Export functions for use in other scripts
export -f get_file_extension
export -f get_linters_for_file
export -f get_context_for_file
export -f should_lint_file
export -f is_frontend_file
export -f filter_lintable_files
export -f set_linters_for_file
export -f set_linters_for_files
export -f get_working_directory
export -f get_relative_file_path
export -f validate_config
export -f debug_config