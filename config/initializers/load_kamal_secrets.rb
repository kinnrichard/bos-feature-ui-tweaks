# Load Kamal secrets in development if not already loaded via environment
if Rails.env.development?
  secrets_file = Rails.root.join(".kamal/secrets.development.real")

  if secrets_file.exist? && ENV["GIT_TOKEN"].blank?
    Rails.logger.info "Loading Kamal secrets from #{secrets_file}"

    File.readlines(secrets_file).each do |line|
      # Skip comments and empty lines
      next if line.strip.empty? || line.strip.start_with?("#")

      # Parse KEY=value or KEY="value" format
      if match = line.match(/^([A-Z_]+)=(.*)$/)
        key = match[1]
        value = match[2].strip

        # Remove surrounding quotes if present
        value = value[1..-2] if value.start_with?('"') && value.end_with?('"')
        value = value[1..-2] if value.start_with?("'") && value.end_with?("'")

        # Only set if not already set
        ENV[key] ||= value
      end
    end

    Rails.logger.info "Loaded environment variables: #{ENV.keys.select { |k| k.start_with?('GIT_', 'BUG_', 'FEATURE_', 'ADMIN_') }.join(', ')}"
  end
end
