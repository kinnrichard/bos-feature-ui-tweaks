class Api::V1::DocumentationController < Api::V1::BaseController
  skip_before_action :authenticate_request

  # GET /api/v1/documentation
  def index
    render json: openapi_spec
  end

  private

  def openapi_spec
    {
      openapi: "3.0.0",
      info: {
        title: "bŏs API",
        description: "API for the Business Operating System. Supports both cookie-based authentication (for the Svelte PWA) and Bearer token authentication (for future native mobile apps).",
        version: "1.0.0",
        contact: {
          name: "API Support",
          email: "support@example.com"
        }
      },
      servers: [
        {
          url: "#{request.protocol}#{request.host_with_port}/api/v1",
          description: "Current API Server"
        }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Bearer token authentication for native mobile apps (e.g., future Swift app). Include token in Authorization header as 'Bearer {token}'"
          },
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "auth_token",
            description: "Cookie-based authentication for the Svelte PWA. Tokens are stored in secure httpOnly cookies for XSS protection"
          }
        },
        schemas: {
          Error: {
            type: "object",
            properties: {
              errors: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "404" },
                    code: { type: "string", example: "NOT_FOUND" },
                    title: { type: "string", example: "Resource Not Found" },
                    detail: { type: "string", example: "The requested resource was not found" },
                    source: {
                      type: "object",
                      properties: {
                        pointer: { type: "string", example: "/data/id" },
                        parameter: { type: "string", example: "id" }
                      }
                    }
                  },
                  required: [ "status", "code", "title", "detail" ]
                }
              }
            }
          },
          User: {
            type: "object",
            properties: {
              id: { type: "integer", example: 1 },
              name: { type: "string", example: "John Doe" },
              email: { type: "string", format: "email", example: "john@example.com" },
              role: { type: "string", enum: [ "admin", "technician", "customer_specialist", "owner" ] },
              resortTasksOnStatusChange: { type: "boolean" },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" }
            }
          },
          LoginRequest: {
            type: "object",
            properties: {
              email: { type: "string", format: "email", example: "john@example.com" },
              password: { type: "string", format: "password", example: "password123" }
            },
            required: [ "email", "password" ]
          },
          LoginResponse: {
            type: "object",
            properties: {
              data: {
                type: "object",
                properties: {
                  type: { type: "string", example: "auth" },
                  attributes: {
                    type: "object",
                    properties: {
                      message: { type: "string", example: "Successfully authenticated" },
                      expiresAt: { type: "string", format: "date-time" },
                      # Note: accessToken and refreshToken are only included when X-Request-Client: mobile header is present
                      accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiJ9...", description: "Only included for mobile clients" },
                      refreshToken: { type: "string", example: "eyJhbGciOiJIUzI1NiJ9...", description: "Only included for mobile clients" }
                    }
                  },
                  relationships: {
                    type: "object",
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          data: {
                            type: "object",
                            properties: {
                              type: { type: "string", example: "users" },
                              id: { type: "string", example: "1" }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              },
              included: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", example: "users" },
                    id: { type: "string", example: "1" },
                    attributes: {
                      type: "object",
                      properties: {
                        name: { type: "string", example: "John Doe" },
                        email: { type: "string", example: "john@example.com" },
                        role: { type: "string", example: "technician" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      paths: paths_spec,
      security: [
        { bearerAuth: [] },
        { cookieAuth: [] }
      ],
      tags: [
        {
          name: "Authentication",
          description: "Authentication endpoints support two methods: 1) Cookie-based auth for the Svelte PWA (default) - tokens stored in secure httpOnly cookies. 2) Bearer token auth for future Swift/native apps - tokens returned in response body when X-Request-Client: mobile header is present."
        }
      ]
    }
  end

  def paths_spec
    {
      '/health': {
        get: {
          tags: [ "Health" ],
          summary: "Health check endpoint",
          description: "Returns the health status of the API",
          security: [],
          responses: {
            '200': {
              description: "API is healthy",
              content: {
                'application/json': {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "ok" },
                      timestamp: { type: "string", format: "date-time" },
                      version: { type: "string", example: "1.0.0" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/auth/login': {
        post: {
          tags: [ "Authentication" ],
          summary: "User login",
          description: "Authenticate user and receive JWT tokens. For Svelte PWA: tokens are set as httpOnly cookies. For native apps: include 'X-Request-Client: mobile' header to receive tokens in response body.",
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { '$ref': "#/components/schemas/LoginRequest" }
              }
            }
          },
          responses: {
            '200': {
              description: "Login successful",
              content: {
                'application/json': {
                  schema: { '$ref': "#/components/schemas/LoginResponse" }
                }
              },
              headers: {
                'Set-Cookie': {
                  description: "HttpOnly cookie containing auth token",
                  schema: { type: "string" }
                }
              }
            },
            '401': {
              description: "Invalid credentials",
              content: {
                'application/json': {
                  schema: { '$ref': "#/components/schemas/Error" }
                }
              }
            }
          }
        }
      },
      '/auth/refresh': {
        post: {
          tags: [ "Authentication" ],
          summary: "Refresh access token",
          description: "Use refresh token to get new access token",
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: "object",
                  properties: {
                    refreshToken: { type: "string" }
                  },
                  required: [ "refreshToken" ]
                }
              }
            }
          },
          responses: {
            '200': {
              description: "Token refreshed successfully",
              content: {
                'application/json': {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {
                          type: { type: "string", example: "auth_tokens" },
                          attributes: {
                            type: "object",
                            properties: {
                              accessToken: { type: "string" },
                              expiresAt: { type: "string", format: "date-time" }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '401': {
              description: "Invalid or expired refresh token",
              content: {
                'application/json': {
                  schema: { '$ref': "#/components/schemas/Error" }
                }
              }
            }
          }
        }
      },
      '/auth/logout': {
        post: {
          tags: [ "Authentication" ],
          summary: "User logout",
          description: "Invalidate current session",
          responses: {
            '204': {
              description: "Logout successful"
            }
          }
        }
      },
      '/websocket/connection_info': {
        get: {
          tags: [ "WebSocket" ],
          summary: "Get WebSocket connection information",
          description: "Returns WebSocket URL and authentication token for real-time features",
          responses: {
            '200': {
              description: "WebSocket connection info",
              content: {
                'application/json': {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "object",
                        properties: {
                          type: { type: "string", example: "websocket_connection" },
                          attributes: {
                            type: "object",
                            properties: {
                              url: { type: "string", example: "wss://api.example.com/cable" },
                              protocol: { type: "string", example: "wss" },
                              authToken: { type: "string", example: "eyJhbGciOiJIUzI1NiJ9..." }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/jobs': {
        get: {
          tags: [ "Jobs" ],
          summary: "List jobs",
          description: "Get a paginated list of jobs assigned to the current user",
          parameters: [
            {
              name: "page",
              in: "query",
              description: "Page number",
              schema: { type: "integer", default: 1 }
            },
            {
              name: "per_page",
              in: "query",
              description: "Items per page",
              schema: { type: "integer", default: 25, maximum: 100 }
            },
            {
              name: "status",
              in: "query",
              description: "Filter by job status",
              schema: {
                type: "string",
                enum: [ "open", "in_progress", "paused", "waiting_for_customer", "waiting_for_scheduled_appointment", "successfully_completed", "cancelled" ]
              }
            },
            {
              name: "priority",
              in: "query",
              description: "Filter by priority",
              schema: {
                type: "string",
                enum: [ "critical", "very_high", "high", "normal", "low", "proactive_followup" ]
              }
            }
          ],
          responses: {
            '200': {
              description: "List of jobs",
              content: {
                'application/json': {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: { type: "string", example: "jobs" },
                            id: { type: "string", example: "123" },
                            attributes: {
                              type: "object",
                              properties: {
                                title: { type: "string", example: "Fix Server Issues" },
                                description: { type: "string" },
                                status: { type: "string", example: "open" },
                                priority: { type: "string", example: "high" },
                                dueOn: { type: "string", format: "date" },
                                dueTime: { type: "string", format: "time" },
                                createdAt: { type: "string", format: "date-time" },
                                updatedAt: { type: "string", format: "date-time" }
                              }
                            }
                          }
                        }
                      },
                      meta: {
                        type: "object",
                        properties: {
                          currentPage: { type: "integer", example: 1 },
                          totalPages: { type: "integer", example: 5 },
                          totalCount: { type: "integer", example: 125 },
                          perPage: { type: "integer", example: 25 }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/cable': {
        get: {
          tags: [ "WebSocket" ],
          summary: "WebSocket endpoint",
          description: "Connect to this endpoint for real-time updates. Use the auth token from /websocket/connection_info",
          security: [],
          responses: {
            '101': {
              description: "Switching Protocols - WebSocket connection established"
            }
          }
        }
      }
    }
  end
end
