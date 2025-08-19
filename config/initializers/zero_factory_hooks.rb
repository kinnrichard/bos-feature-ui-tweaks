# frozen_string_literal: true

# Zero.js Factory Models Integration
# Provides integration with Rails development workflow

if Rails.env.development?
  Rails.logger.info "🔧 Zero.js factory model integration initialized"
  Rails.logger.info "💡 Use 'rake zero:regenerate_factory_models' to update TypeScript models after schema changes"
end
