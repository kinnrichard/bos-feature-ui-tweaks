namespace :zero do
  desc "Create Zero databases (CVR and CDB)"
  task create_databases: :environment do
    require "pg"

    # Database configuration from Rails
    db_config = Rails.application.config.database_configuration[Rails.env]

    # CVR database name
    cvr_db = "#{db_config['database'].gsub('_development', '')}_zero_cvr_development"
    cvr_db = cvr_db.gsub("_test", "_zero_cvr_test") if Rails.env.test?

    # CDB database name
    cdb_db = "#{db_config['database'].gsub('_development', '')}_zero_cdb_development"
    cdb_db = cdb_db.gsub("_test", "_zero_cdb_test") if Rails.env.test?

    begin
      # Connect to PostgreSQL as superuser (usually the system user)
      conn = PG.connect(
        host: db_config["host"] || "localhost",
        port: db_config["port"] || 5432,
        dbname: "postgres",
        user: db_config["username"] || ENV["USER"] || ENV["USERNAME"]
      )

      # Create CVR database
      puts "Creating Zero CVR database: #{cvr_db}"
      begin
        conn.exec("CREATE DATABASE #{conn.escape_identifier(cvr_db)}")
        puts "✓ CVR database created successfully"
      rescue PG::DuplicateDatabase
        puts "✓ CVR database already exists"
      end

      # Create CDB database
      puts "Creating Zero CDB database: #{cdb_db}"
      begin
        conn.exec("CREATE DATABASE #{conn.escape_identifier(cdb_db)}")
        puts "✓ CDB database created successfully"
      rescue PG::DuplicateDatabase
        puts "✓ CDB database already exists"
      end

      conn.close

      # Enable logical replication on main database
      puts "Configuring logical replication on main database..."
      main_conn = PG.connect(
        host: db_config["host"] || "localhost",
        port: db_config["port"] || 5432,
        dbname: db_config["database"],
        user: db_config["username"] || ENV["USER"] || ENV["USERNAME"]
      )

      # Check if logical replication is enabled
      result = main_conn.exec("SHOW wal_level")
      wal_level = result[0]["wal_level"]

      if wal_level != "logical"
        puts "⚠️  WARNING: wal_level is '#{wal_level}', should be 'logical' for Zero replication"
        puts "   Please set wal_level = logical in postgresql.conf and restart PostgreSQL"
        puts "   Then run: ALTER SYSTEM SET wal_level = logical; (requires restart)"
      else
        puts "✓ Logical replication is properly configured"
      end

      main_conn.close

    rescue PG::Error => e
      puts "❌ Error setting up Zero databases: #{e.message}"
      exit 1
    end
  end

  desc "Drop Zero databases (CVR and CDB)"
  task drop_databases: :environment do
    require "pg"

    db_config = Rails.application.config.database_configuration[Rails.env]

    cvr_db = "#{db_config['database'].gsub('_development', '')}_zero_cvr_development"
    cvr_db = cvr_db.gsub("_test", "_zero_cvr_test") if Rails.env.test?

    cdb_db = "#{db_config['database'].gsub('_development', '')}_zero_cdb_development"
    cdb_db = cdb_db.gsub("_test", "_zero_cdb_test") if Rails.env.test?

    begin
      conn = PG.connect(
        host: db_config["host"] || "localhost",
        port: db_config["port"] || 5432,
        dbname: "postgres",
        user: db_config["username"] || ENV["USER"] || ENV["USERNAME"]
      )

      puts "Dropping Zero databases..."

      begin
        conn.exec("DROP DATABASE IF EXISTS #{conn.escape_identifier(cvr_db)}")
        puts "✓ CVR database dropped"
      rescue PG::Error => e
        puts "❌ Error dropping CVR database: #{e.message}"
      end

      begin
        conn.exec("DROP DATABASE IF EXISTS #{conn.escape_identifier(cdb_db)}")
        puts "✓ CDB database dropped"
      rescue PG::Error => e
        puts "❌ Error dropping CDB database: #{e.message}"
      end

      conn.close

    rescue PG::Error => e
      puts "❌ Error connecting to PostgreSQL: #{e.message}"
      exit 1
    end
  end

  desc "Setup Zero infrastructure (create databases and configure replication)"
  task setup: [ :create_databases ] do
    puts "\n🎉 Zero infrastructure setup complete!"
    puts "\nNext steps:"
    puts "1. Install zero-cache: npm install -g @rocicorp/zero-cache"
    puts "2. Start Zero cache server: npx zero-cache --config zero-config.json"
    puts "3. Your Zero client will connect automatically when the frontend starts"
    puts "\nZero databases created:"
    puts "- CVR: bos_zero_cvr_development"
    puts "- CDB: bos_zero_cdb_development"
  end

  desc "Reset Zero infrastructure (drop and recreate databases)"
  task reset: [ :drop_databases, :create_databases ] do
    puts "✓ Zero infrastructure reset complete"
  end

  desc "Generate Zero schema from Rails database"
  task generate_schema: :environment do
    require_relative "../zero_schema_generator"

    begin
      puts "🔍 Analyzing Rails schema..."
      result = ZeroSchemaGenerator.generate_schema

      puts "✅ Zero schema generated successfully!"
      puts "📁 Files updated:"
      puts "   - #{result[:schema_path]}"
      puts "   - #{result[:types_path]}" if result[:types_path] != result[:schema_path]
      puts "📊 Generated #{result[:tables_count]} tables"
      puts "⏰ Generated at: #{result[:generated_at]}"

    rescue => e
      puts "❌ Error generating Zero schema: #{e.message}"
      puts e.backtrace.first(5) if Rails.env.development?
      exit 1
    end
  end

  desc "Validate Zero schema against Rails database"
  task validate_schema: :environment do
    require_relative "../zero_schema_generator"

    begin
      validation = ZeroSchemaGenerator.validate_schema

      if validation[:valid]
        puts "✅ Zero schema is valid"
      else
        puts "❌ Schema validation failed:"
        validation[:errors].each { |error| puts "   - #{error}" }
        exit 1
      end

    rescue => e
      puts "❌ Error validating Zero schema: #{e.message}"
      exit 1
    end
  end

  desc "Create sample Zero generator configuration"
  task create_config: :environment do
    require_relative "../zero_schema_generator"

    config_path = Rails.root.join("config", "zero_generator.yml")

    if File.exist?(config_path)
      puts "⚠️  Configuration file already exists at #{config_path}"
      print "Overwrite? (y/N): "
      response = STDIN.gets.chomp.downcase

      unless response == "y" || response == "yes"
        puts "Configuration creation cancelled"
        exit 0
      end
    end

    ZeroSchemaGenerator.create_sample_config(config_path)
    puts "📝 Edit #{config_path} to customize schema generation"
  end

  desc "Generate Zero mutations from Rails schema"
  task generate_mutations: :environment do
    require_relative "../zero_schema_generator"

    begin
      puts "🔍 Generating Zero mutations from Rails schema..."
      result = ZeroSchemaGenerator.generate_mutations

      puts "✅ Zero mutations generated successfully!"
      puts "📁 Generated mutations for #{result[:generated_tables].size} tables"
      puts "📄 Files created: #{result[:generated_files].size}"
      result[:generated_files].each { |file| puts "   - #{File.basename(file)}" }

    rescue => e
      puts "❌ Error generating Zero mutations: #{e.message}"
      puts e.backtrace.first(5) if Rails.env.development?
      exit 1
    end
  end

  desc "Generate Zero mutations (dry run)"
  task mutations_dry_run: :environment do
    require_relative "../zero_schema_generator"

    begin
      puts "🔍 Dry run: Zero mutations generation preview..."
      result = ZeroSchemaGenerator.generate_mutations(options: { dry_run: true })

      puts "✅ Dry run completed!"
      puts "📋 Would generate mutations for #{result[:generated_tables].size} tables"
      puts "📄 Would create #{result[:generated_files].size} files"
      puts "🔄 Run 'rails zero:generate_mutations' to actually generate files"

    rescue => e
      puts "❌ Error in dry run: #{e.message}"
      puts e.backtrace.first(5) if Rails.env.development?
      exit 1
    end
  end

  desc "Create sample Zero mutations configuration"
  task create_mutations_config: :environment do
    require_relative "../zero_schema_generator"

    config_path = ZeroSchemaGenerator::MutationConfig.default_config_path

    if File.exist?(config_path)
      puts "⚠️  Mutations configuration file already exists at #{config_path}"
      print "Overwrite? (y/N): "
      response = STDIN.gets.chomp.downcase

      unless response == "y" || response == "yes"
        puts "Configuration creation cancelled"
        exit 0
      end
    end

    ZeroSchemaGenerator.create_mutations_config(config_path)
    puts "📝 Edit #{config_path} to customize mutation generation"
  end
end
