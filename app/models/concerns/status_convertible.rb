# frozen_string_literal: true

# Concern for handling status/priority format conversions between
# hyphenated (frontend) and underscored (backend) formats
module StatusConvertible
  extend ActiveSupport::Concern

  class_methods do
    # Convert hyphenated format to underscored format
    def normalize_status(value)
      return value if value.blank?
      value.to_s.tr("-", "_")
    end

    # Convert underscored format to hyphenated format
    def hyphenate_status(value)
      return value if value.blank?
      value.to_s.tr("_", "-")
    end
  end

  # Instance methods for easy access
  def normalize_status(value)
    self.class.normalize_status(value)
  end

  def hyphenate_status(value)
    self.class.hyphenate_status(value)
  end
end
