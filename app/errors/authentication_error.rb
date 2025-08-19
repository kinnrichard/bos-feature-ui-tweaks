class AuthenticationError < StandardError
  attr_reader :code

  def initialize(message = "Authentication required", code: "AUTHENTICATION_REQUIRED")
    @code = code
    super(message)
  end
end
