namespace :db do
  namespace :import do
    namespace :filemaker do
      desc "Import all FileMaker XML files"
      task all: :environment do
        puts "Starting FileMaker data import..."
        
        # Use a single importer instance to maintain job ID mappings
        importer = FilemakerImporter.new
        stats = importer.import_all
        
        puts "\nFinal import statistics:"
        puts "  Clients: #{stats[:clients]}"
        puts "  Jobs: #{stats[:jobs]}"
        puts "  Tasks: #{stats[:tasks]}"
        puts "  Contacts: #{stats[:contacts]}"
      end

      desc "Import clients from FMPClients.xml"
      task clients: :environment do
        importer = FilemakerImporter.new
        file_path = Rails.root.join('FMPClients.xml')
        
        if File.exist?(file_path)
          count = importer.import_clients(file_path)
          puts "✓ Imported #{count} clients"
        else
          puts "✗ FMPClients.xml not found"
        end
      end

      desc "Import jobs from FMPCases.xml"
      task jobs: :environment do
        importer = FilemakerImporter.new
        file_path = Rails.root.join('FMPCases.xml')
        
        if File.exist?(file_path)
          count = importer.import_jobs(file_path)
          puts "✓ Imported #{count} jobs"
        else
          puts "✗ FMPCases.xml not found"
        end
      end

      desc "Import tasks from FMPTasks.xml"
      task tasks: :environment do
        importer = FilemakerImporter.new
        file_path = Rails.root.join('FMPTasks.xml')
        
        if File.exist?(file_path)
          count = importer.import_tasks(file_path)
          puts "✓ Imported #{count} tasks"
        else
          puts "✗ FMPTasks.xml not found"
        end
      end

      desc "Import contacts from FMPContactInfo.xml"
      task contacts: :environment do
        importer = FilemakerImporter.new
        file_path = Rails.root.join('FMPContactInfo.xml')
        
        if File.exist?(file_path)
          count = importer.import_contacts(file_path)
          puts "✓ Imported #{count} contact methods"
        else
          puts "✗ FMPContactInfo.xml not found"
        end
      end

      desc "Clean ALL data from database (DANGER: This deletes EVERYTHING!)"
      task clean: :environment do
        puts "\n⚠️  DANGER: This will delete ALL data in the database!"
        puts "This is NOT limited to imported data - it will DELETE EVERYTHING"
        print "Type 'DELETE ALL DATA' to confirm: "
        response = STDIN.gets.chomp
        
        if response == 'DELETE ALL DATA'
          ActiveRecord::Base.transaction do
            Note.destroy_all
            Task.destroy_all
            Job.destroy_all
            ContactMethod.destroy_all
            Person.destroy_all
            Client.destroy_all
            puts "All data has been deleted from the database."
          end
        else
          puts "Clean operation cancelled."
        end
      end
    end
  end
end