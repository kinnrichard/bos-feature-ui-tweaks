# Custom exception classes for API error handling

class AuthenticationError < StandardError; end
class AuthorizationError < StandardError; end
class ValidationError < StandardError
  attr_reader :errors

  def initialize(message = nil, errors = {})
    super(message)
    @errors = errors
  end
end

class BusinessLogicError < StandardError
  attr_reader :code

  def initialize(message = nil, code = nil)
    super(message)
    @code = code
  end
end
