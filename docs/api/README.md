---
title: "bŏs API Documentation"
description: "Comprehensive API documentation for the bŏs job management system"
last_updated: "2025-07-17"
status: "active"
category: "api"
tags: ["api", "documentation", "authentication", "json-api", "rest"]
---

# bŏs API Documentation

## Overview

The bŏs (Business Operating System) API provides comprehensive access to job management, task tracking, client management, and technician collaboration functionality. This documentation covers all aspects of the API from basic usage to advanced integration patterns.

## Quick Start

1. **Authentication**: Start with [Authentication Guide](./api-authentication.md)
2. **API Specification**: Review [API Specification](./api-specification.md) for technical details
3. **Interactive Documentation**: Visit `/api-docs.html` for Swagger UI
4. **Examples**: Check [v1/examples/](./v1/examples/) for practical usage examples

## Documentation Structure

### Core Documentation
- **[api-authentication.md](./api-authentication.md)** - Authentication methods and security
- **[api-specification.md](./api-specification.md)** - Technical specification and standards
- **[LEGACY_API_SPEC.md](./LEGACY_API_SPEC.md)** - Legacy Rails API specification

### Version 1 API (v1/)
- **[authentication/](./v1/authentication/)** - Authentication flows and security
- **[endpoints/](./v1/endpoints/)** - Detailed endpoint documentation
- **[guides/](./v1/guides/)** - Integration guides and best practices
- **[examples/](./v1/examples/)** - Code examples and usage patterns
- **[reference/](./v1/reference/)** - TypeScript/JavaScript API reference

### Frontend API Integration
- **[FRONTEND_API_REFERENCE.md](./FRONTEND_API_REFERENCE.md)** - ActiveRecord/ReactiveRecord API documentation
- **[FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md)** - Frontend integration patterns

## Base Configuration

- **Base URL**: `/api/v1`
- **Format**: JSON:API specification
- **Authentication**: Bearer token via httpOnly cookies or Authorization header
- **Content-Type**: `application/vnd.api+json`

## Supported Client Types

1. **Web Application (Svelte PWA)**: Cookie-based authentication
2. **Mobile Application (Future)**: Bearer token authentication
3. **API Integrations**: Bearer token authentication

## Interactive Documentation

Access the interactive Swagger UI documentation at: **`/api-docs.html`**

## Version History

- **v1.0** - Initial API release with job management, task tracking, and authentication
- **Legacy** - Pre-v1 Rails API (deprecated, documentation preserved)

## Getting Help

For API support and questions:
- Review the documentation in this directory
- Check the [examples](./v1/examples/) for common usage patterns
- Consult the [guides](./v1/guides/) for integration best practices
- Use the interactive documentation at `/api-docs.html`

## Related Documentation

### Frontend Integration
- **[Frontend API Integration](./frontend-integration.md)** - Complete frontend API patterns
- **[Frontend API Reference](./frontend-api-reference.md)** - ReactiveRecord/ActiveRecord API documentation
- **[Zero.js Integration](../../frontend/src/lib/zero/README.md)** - Zero.js reactive system integration
- **[Frontend Debug System](../frontend/epics/epic-014-debug-system-guide.md)** - Debug API calls and responses

### Development & Testing
- **[Testing Guide](../guides/README-TESTS.md)** - API testing patterns
- **[Claude Automation](../guides/claude-automation-setup.md)** - Automated API testing setup
- **[Test Plan Critical Areas](../guides/test-plan-critical-areas.md)** - API testing focus areas

### Architecture & Standards
- **[Technical Decisions](../standards/technical-decisions.md)** - API architecture decisions
- **[Style Guide](../standards/style-guide.md)** - API code style standards
- **[Authentication Setup](../setup/github-setup.md)** - API authentication configuration

### See Also
- **[Epic Management](../epics/README.md)** - API-related epic tracking
- **[Story Development](../stories/README.md)** - API feature stories
- **[Frontend Migration Guide](../../frontend/epic-008-migration-guide.md)** - API migration patterns