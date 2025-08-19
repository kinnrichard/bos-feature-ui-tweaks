# frozen_string_literal: true

namespace :zero do
  desc "Regenerate TypeScript factory models from Rails schema"
  task regenerate_factory_models: :environment do
    require_relative "../generators/zero/factory_models/factory_models_generator"

    puts "🏭 Regenerating TypeScript factory models..."

    begin
      generator = Zero::Generators::FactoryModelsGenerator.new([], {}, {})
      generator.generate_factory_models

      puts "✅ Factory models regeneration completed"
    rescue => e
      puts "❌ Factory models regeneration failed: #{e.message}"
      puts e.backtrace.first(5).join("\n") if Rails.env.development?
      exit 1
    end
  end
end

# Add helpful reminders to migration tasks
%w[db:migrate db:rollback db:migrate:up db:migrate:down].each do |task_name|
  begin
    Rake::Task[task_name].enhance do
      if Rails.env.development?
        puts "\n💡 TIP: Run 'rake zero:regenerate_factory_models' to update TypeScript models after schema changes"
      end
    end
  rescue
    # Silently ignore if task doesn't exist or enhancement fails
  end
end
