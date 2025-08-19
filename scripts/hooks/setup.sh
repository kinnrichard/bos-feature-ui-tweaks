#!/bin/bash
# Git Hooks Setup Script
# Sets up development git hooks for the project

set -e  # Exit on any error

echo "🔧 Setting up git hooks for BOS project..."

# Get the project root directory (where .git is located)
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"
SCRIPTS_DIR="$PROJECT_ROOT/scripts/hooks"

# Verify we're in a git repository
if [ ! -d "$PROJECT_ROOT/.git" ]; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Verify the scripts directory exists
if [ ! -d "$SCRIPTS_DIR" ]; then
    echo "❌ Error: Scripts directory not found at $SCRIPTS_DIR"
    exit 1
fi

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Install pre-commit hook
if [ -f "$SCRIPTS_DIR/pre-commit" ]; then
    echo "📋 Installing pre-commit hook..."
    
    # Create symlink (easier to update) or copy file
    if command -v ln >/dev/null 2>&1; then
        # Remove existing hook if it exists
        [ -f "$HOOKS_DIR/pre-commit" ] && rm "$HOOKS_DIR/pre-commit"
        
        # Create symlink
        ln -s "$SCRIPTS_DIR/pre-commit" "$HOOKS_DIR/pre-commit"
        echo "✅ Created symlink: .git/hooks/pre-commit -> scripts/hooks/pre-commit"
    else
        # Fallback to copying
        cp "$SCRIPTS_DIR/pre-commit" "$HOOKS_DIR/pre-commit"
        echo "✅ Copied pre-commit hook to .git/hooks/"
    fi
    
    # Make sure it's executable
    chmod +x "$HOOKS_DIR/pre-commit"
    echo "✅ Made pre-commit hook executable"
else
    echo "❌ Warning: pre-commit hook not found at $SCRIPTS_DIR/pre-commit"
fi

# Verify installation
echo ""
echo "🔍 Verifying installation..."

if [ -x "$HOOKS_DIR/pre-commit" ]; then
    echo "✅ pre-commit hook installed and executable"
    
    # Show what the hook will do
    echo ""
    echo "📝 This hook will:"
    echo "   • Run RuboCop on changed Ruby files"
    echo "   • Run ESLint + Prettier on changed JS/TS/Svelte files"
    echo "   • Ensure all files end with newlines"
    echo "   • Auto-stage fixed files"
    echo ""
    echo "🚀 Hook installation complete!"
    echo ""
    echo "💡 To bypass the hook for a specific commit:"
    echo "   git commit --no-verify -m 'your message'"
else
    echo "❌ Error: Hook installation failed"
    exit 1
fi