class AuthorizationError < StandardError
  attr_reader :code

  def initialize(message = "Access denied", code: "ACCESS_DENIED")
    @code = code
    super(message)
  end
end
