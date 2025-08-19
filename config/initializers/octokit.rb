# Configure Octokit for GitHub API access
require "octokit"

# Set up auto-pagination to handle large result sets
Octokit.configure do |c|
  c.auto_paginate = true
end

# Optional: Configure default media type if needed
# Octokit.default_media_type = "application/vnd.github.v3+json"
