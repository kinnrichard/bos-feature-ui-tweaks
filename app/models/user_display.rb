# frozen_string_literal: true

class UserDisplay
  # Consistent color palette for user avatars
  # These colors are chosen to be visually distinct and accessible
  AVATAR_COLORS = [
    "#FF9500", # Orange
    "#FF5E5B", # Red
    "#FFCC00", # Yellow
    "#34C759", # Green
    "#007AFF", # Blue
    "#5856D6", # Purple
    "#AF52DE", # Pink Purple
    "#FF2D55", # Pink
    "#00C7BE", # Teal
    "#30B0C7", # Light Blue
    "#FF3B30", # Bright Red
    "#FF9F0A"  # Amber
  ].freeze

  attr_reader :user

  def initialize(user)
    @user = user
    raise ArgumentError, "User cannot be nil" if user.nil?
  end

  # Generate initials from user name
  def initials
    return "?" unless @user.name.present?

    # Take only the first letter of the name
    @user.name[0].upcase
  end

  # Get consistent avatar color based on user
  def avatar_color
    # Use user ID for consistent color assignment
    return AVATAR_COLORS[0] unless @user.id

    # Convert UUID to hash for consistent color assignment
    hash = @user.id.hash
    AVATAR_COLORS[hash % AVATAR_COLORS.length]
  end

  # Get avatar background style
  def avatar_style
    "background-color: #{avatar_color};"
  end

  # Display name (for future enhancement with display preferences)
  def display_name
    @user.name
  end

  # Short display name (first name only)
  def first_name_only
    @user.name.split(/\s+/).first
  end

  # Email display (for future enhancement with privacy settings)
  def display_email
    @user.email
  end

  # Role display
  def role_label
    @user.role&.humanize || "User"
  end

  # Check if this is the system user
  def system_user?
    @user.role == "system" || @user.email == "system@example.com"
  end

  # Generate avatar HTML for views
  def avatar_html(size: :medium, css_class: nil)
    size_classes = {
      small: "avatar-sm",
      medium: "avatar-md",
      large: "avatar-lg"
    }

    classes = [ "user-avatar", size_classes[size], css_class ].compact.join(" ")

    %(<span class="#{classes}" style="#{avatar_style}">#{initials}</span>).html_safe
  end

  # For comparison and equality
  def ==(other)
    return false unless other.is_a?(UserDisplay)
    @user == other.user
  end

  def eql?(other)
    self == other
  end

  def hash
    @user.hash
  end

  # Class method to generate CSS for all avatar colors
  def self.avatar_colors_css
    AVATAR_COLORS.map.with_index do |color, index|
      ".avatar-color-#{index} { background-color: #{color}; }"
    end.join("\n")
  end

  # Export colors for JavaScript
  def self.colors_for_javascript
    AVATAR_COLORS
  end
end
