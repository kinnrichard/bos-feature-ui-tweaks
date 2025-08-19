# Epic-012: Replace Custom Logging with Secure Debug System

## 📋 Epic Information

- **Epic ID**: 012
- **Title**: Replace Custom Logging with Secure Debug System
- **Status**: Draft
- **Priority**: High
- **Estimated Effort**: 4-6 hours
- **Dependencies**: None
- **Owner**: Development Team

## 🎯 Objective

Replace the custom SecureLogger implementation with a production-ready debug system that combines the existing `debug` library with `fast-redact` for security filtering, creating a more maintainable and architecturally sound logging solution.

## 📖 Background

### Current State
- Custom `SecureLogger` utility with manual security filtering
- Mixed usage of `console.log` and debug functions throughout codebase
- Existing `debug.ts` with well-structured namespaces but limited usage
- Security concerns addressed through custom code

### Problem Statement
- **Technical debt**: Custom logging code requires maintenance
- **Inconsistent logging**: Mix of console.log and debug usage
- **Security risks**: Manual filtering is error-prone
- **Developer experience**: Different logging patterns across codebase

### Proposed Solution
- **Revert custom logging**: Remove custom SecureLogger implementation
- **Expand debug system**: Enhance existing debug.ts with security filtering
- **Integrate fast-redact**: Use battle-tested library for sensitive data filtering
- **Standardize logging**: Replace all console.log with debug calls

## 🏗️ Architecture

### Current Debug System
```typescript
// /src/lib/utils/debug.ts
export const debugAPI = debug('bos:api');
export const debugState = debug('bos:state');
// ... other namespaces
```

### Proposed Enhanced System
```typescript
// /src/lib/utils/debug.ts (enhanced)
import debug from 'debug';
import fastRedact from 'fast-redact';

// Security filtering configuration
const secureRedact = fastRedact({
  paths: ['password', 'token', 'csrf', 'X-CSRF-Token', 'Authorization'],
  censor: '[REDACTED]',
  serialize: false
});

// Secure debug wrapper
function createSecureDebug(namespace: string) {
  const debugFn = debug(namespace);
  return function(...args: any[]) {
    if (!debugFn.enabled) return;
    const safeArgs = args.map(arg => secureRedact(arg));
    debugFn(...safeArgs);
  };
}

// Enhanced exports
export const debugAPI = createSecureDebug('bos:api');
export const debugState = createSecureDebug('bos:state');
// ... other secure namespaces
```

## 📋 Implementation Plan

### Phase 1: Revert Custom Changes (1 hour)
**Goal**: Clean slate by removing custom logging implementation

**Tasks**:
1. **Git revert** custom SecureLogger changes
   - Identify commits that introduced custom logging
   - Revert changes to API client logging
   - Remove `/src/lib/utils/secure-logger.ts`
   - Remove security test files (optional: keep for future validation)

2. **Restore original behavior**
   - API client uses console.log again
   - Remove SecureLogger imports
   - Clean up any custom logging utilities

**Success Criteria**:
- ✅ No custom logging code in codebase
- ✅ API client functions normally
- ✅ No broken imports or references

### Phase 2: Enhance Debug System (2 hours)
**Goal**: Create secure debug wrapper with fast-redact integration

**Tasks**:
1. **Install dependencies**
   ```bash
   npm install fast-redact
   npm install --save-dev @types/debug
   ```

2. **Enhance debug.ts**
   - Add fast-redact import and configuration
   - Create `createSecureDebug` wrapper function
   - Configure sensitive data patterns for redaction
   - Wrap all existing debug exports with security

3. **Add new debug namespaces**
   - `debugSecurity` for security-related events
   - `debugAuth` for authentication flows
   - `debugValidation` for input validation
   - Any other needed namespaces

4. **Enhance browser console helper**
   - Add security testing function
   - Show redaction examples in console
   - Update help text with security information

**Success Criteria**:
- ✅ All debug functions have automatic security filtering
- ✅ Fast-redact properly configured for sensitive patterns
- ✅ Browser console helper enhanced with security features
- ✅ Existing debug namespaces work unchanged

### Phase 3: Replace Console.log Usage (1-2 hours)
**Goal**: Standardize all logging through debug system

**Tasks**:
1. **Audit codebase for console.log usage**
   ```bash
   grep -r "console.log" src/ --include="*.ts" --include="*.js" --include="*.svelte"
   ```

2. **Replace console.log with appropriate debug calls**
   - API calls → `debugAPI`
   - Component state → `debugState`
   - Authentication → `debugAuth`
   - Cache operations → `debugCache`
   - General debugging → `debugComponent`

3. **Update API client logging**
   - Replace manual logging with `debugAPI` calls
   - Remove custom header filtering (now handled by fast-redact)
   - Use structured logging patterns

4. **Add debug calls to key areas**
   - CSRF token management
   - Authentication flows
   - API error handling
   - State management operations

**Success Criteria**:
- ✅ No console.log calls in production code
- ✅ All logging goes through debug system
- ✅ Appropriate debug namespaces used
- ✅ Sensitive data automatically filtered

### Phase 4: Testing & Validation (30 minutes)
**Goal**: Verify security and functionality

**Tasks**:
1. **Test security filtering**
   - Enable debug: `localStorage.debug = 'bos:*'`
   - Trigger API calls with tokens
   - Verify sensitive data shows as `[REDACTED]`
   - Test browser console helper security function

2. **Validate debug functionality**
   - Test selective namespace enabling
   - Verify performance impact is minimal
   - Check that debug is disabled in production

3. **Run existing tests**
   - Ensure no regressions in functionality
   - Update any tests that relied on console.log
   - Verify API client still works correctly

**Success Criteria**:
- ✅ Sensitive data properly redacted in debug output
- ✅ All debug namespaces work correctly
- ✅ No performance impact when debug disabled
- ✅ Existing tests pass

## 🔧 Technical Specifications

### Security Configuration
```typescript
const secureRedact = fastRedact({
  paths: [
    'password',
    'token',
    'csrf',
    'X-CSRF-Token',
    'Authorization',
    'Cookie',
    'Set-Cookie',
    'secret',
    'key',
    'auth',
    'bearer'
  ],
  censor: '[REDACTED]',
  serialize: false
});
```

### Debug Namespaces
- `bos:api` - API calls and responses
- `bos:auth` - Authentication and authorization
- `bos:state` - Component state management
- `bos:cache` - Cache operations
- `bos:component` - General component debugging
- `bos:security` - Security-related events
- `bos:validation` - Input validation
- `bos:reactive` - Svelte reactive statements
- `bos:technician-assignment` - Technician assignment logic

### Usage Examples
```typescript
// API client
debugAPI('Making request: %s %s', method, url);
debugAPI('Request headers: %O', requestHeaders); // Automatically redacted

// Component state
debugState('Component state changed: %O', newState);

// Authentication
debugAuth('User login attempt: %s', email); // No password logged
debugAuth('Token refresh: %s', hasToken ? 'success' : 'failed');

// Security events
debugSecurity('CSRF token validation: %s', isValid ? 'passed' : 'failed');
```

## 📊 Success Metrics

### Security Improvements
- **0** instances of sensitive data in debug logs
- **100%** of logging goes through secure filtering
- **Automatic** redaction of known sensitive patterns

### Developer Experience
- **Consistent** logging patterns across codebase
- **Selective** debug enabling by namespace
- **Enhanced** browser console helper with security features

### Code Quality
- **Reduced** custom code maintenance
- **Standardized** logging approach
- **Better** separation of concerns

## 🚀 Post-Implementation

### Documentation Updates
- Update README with debug usage examples
- Document security filtering patterns
- Create debugging guide for developers

### Future Enhancements
- Add structured logging for production
- Integrate with log aggregation systems
- Add performance monitoring debug namespace
- Consider adding log level support

### Monitoring
- Track debug usage patterns
- Monitor for any security filtering bypasses
- Collect feedback on developer experience

## 🔗 Related Work

### Dependencies
- Existing debug.ts implementation
- fast-redact library integration
- Current API client architecture

### Follow-up Epics
- Epic-013: Production Log Aggregation
- Epic-014: Performance Monitoring Integration
- Epic-015: Error Tracking Enhancement

## 📝 Notes

### Why This Approach?
- **Builds on existing investment** in debug system
- **Uses battle-tested libraries** instead of custom code
- **Maintains developer workflow** while adding security
- **Zero production impact** (debug disabled in production)

### Alternatives Considered
- Keep custom SecureLogger (rejected: technical debt)
- Use full logging library like Winston (rejected: overkill)
- Cloud logging service (rejected: premature optimization)

### Risks & Mitigations
- **Risk**: Debug overhead in development
  - **Mitigation**: Fast-redact is highly performant
- **Risk**: Missing sensitive data patterns
  - **Mitigation**: Comprehensive pattern configuration
- **Risk**: Developer adoption
  - **Mitigation**: Enhanced console helper and documentation