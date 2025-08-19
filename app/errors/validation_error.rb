class ValidationError < StandardError
  attr_reader :errors, :code

  def initialize(message = "Validation failed", errors: {}, code: "VALIDATION_FAILED")
    @errors = errors
    @code = code
    super(message)
  end
end
