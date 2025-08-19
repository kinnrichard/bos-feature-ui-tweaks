namespace :users do
  desc "Populate short_name for existing users"
  task populate_short_names: :environment do
    puts "Populating short_names for existing users..."
    
    User.find_each do |user|
      next if user.short_name.present?
      
      # Try email prefix first
      email_prefix = user.email.split('@').first.downcase
      short_name = email_prefix
      
      # If not unique, try with incremental numbers
      counter = 1
      while User.where.not(id: user.id).exists?(short_name: short_name)
        short_name = "#{email_prefix}#{counter}"
        counter += 1
        
        # If we've tried too many times, just use the full email
        if counter > 10
          short_name = user.email.downcase
          break
        end
      end
      
      user.update_column(:short_name, short_name)
      puts "  Set short_name for #{user.email} to #{short_name}"
    end
    
    puts "Done!"
  end
end