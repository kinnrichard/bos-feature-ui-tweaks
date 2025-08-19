/**
 * Epic 015 Security Tests
 * Comprehensive security testing for the debug system migration
 * 
 * Test Coverage:
 * - Sensitive data redaction validation
 * - Production security behavior
 * - Attack vector prevention
 * - Data leak prevention
 * - Compliance verification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock debug function
const mockDebugFunction = vi.hoisted(() => vi.fn());

vi.mock('debug', () => ({
  default: vi.fn(() => mockDebugFunction)
}));

import { 
  debugAuth, 
  debugDatabase, 
  debugWorkflow, 
  debugComponent 
} from '../namespaces';
import { securityRedactor } from '../redactor';

describe('Epic 015 Security - Sensitive Data Redaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createSensitiveDataset = () => ({
    // Authentication credentials
    password: 'mySecretPassword123!',
    userPassword: 'userPass456$',
    adminPassword: 'adminSecret789%',
    currentPassword: 'currentPass321^',
    newPassword: 'newPass654&',
    confirmPassword: 'confirmPass987*',
    
    // Tokens and keys
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    accessToken: 'access-token-abc123def456',
    refreshToken: 'refresh-token-ghi789jkl012',
    bearerToken: 'bearer-mno345pqr678',
    authToken: 'auth-stu901vwx234',
    sessionToken: 'session-yzab567cdef890',
    
    // API keys
    apiKey: 'sk-1234567890abcdef1234567890abcdef',
    api_key: 'ak_test_1234567890abcdef1234567890abcdef',
    secretKey: 'secret-key-abcdef1234567890abcdef1234567890',
    secret_key: 'secret_key_1234567890abcdef1234567890abcdef',
    privateKey: 'private-key-1234567890abcdef1234567890abcdef',
    publicKey: 'public-key-1234567890abcdef1234567890abcdef',
    
    // Session and CSRF tokens
    sessionId: 'sess_1234567890abcdef1234567890abcdef',
    session_id: 'session_id_abcdef1234567890abcdef1234567890',
    csrfToken: 'csrf-token-1234567890abcdef1234567890abcdef',
    csrf_token: 'csrf_token_abcdef1234567890abcdef1234567890',
    xsrfToken: 'xsrf-token-1234567890abcdef1234567890abcdef',
    
    // Database credentials
    connectionString: 'postgresql://username:password@localhost:5432/database',
    databasePassword: 'db-password-123',
    dbPassword: 'db-pass-456',
    
    // Safe data that should not be redacted
    email: 'user@example.com',
    username: 'testuser',
    firstName: 'John',
    lastName: 'Doe',
    id: '12345',
    userId: 'user-67890',
    timestamp: '2024-01-15T10:30:00Z',
    status: 'active',
    role: 'admin'
  });

  it('should redact all known sensitive field patterns', () => {
    const sensitiveData = createSensitiveDataset();
    const redactedData = securityRedactor(sensitiveData);
    
    // All password fields should be redacted
    expect(redactedData.password).toBe('[REDACTED]');
    expect(redactedData.userPassword).toBe('[REDACTED]');
    expect(redactedData.adminPassword).toBe('[REDACTED]');
    expect(redactedData.currentPassword).toBe('[REDACTED]');
    expect(redactedData.newPassword).toBe('[REDACTED]');
    expect(redactedData.confirmPassword).toBe('[REDACTED]');
    
    // All token fields should be redacted
    expect(redactedData.token).toBe('[REDACTED]');
    expect(redactedData.accessToken).toBe('[REDACTED]');
    expect(redactedData.refreshToken).toBe('[REDACTED]');
    expect(redactedData.bearerToken).toBe('[REDACTED]');
    expect(redactedData.authToken).toBe('[REDACTED]');
    expect(redactedData.sessionToken).toBe('[REDACTED]');
    
    // All API key fields should be redacted
    expect(redactedData.apiKey).toBe('[REDACTED]');
    expect(redactedData.api_key).toBe('[REDACTED]');
    expect(redactedData.secretKey).toBe('[REDACTED]');
    expect(redactedData.secret_key).toBe('[REDACTED]');
    expect(redactedData.privateKey).toBe('[REDACTED]');
    expect(redactedData.publicKey).toBe('[REDACTED]');
    
    // All session fields should be redacted
    expect(redactedData.sessionId).toBe('[REDACTED]');
    expect(redactedData.session_id).toBe('[REDACTED]');
    expect(redactedData.csrfToken).toBe('[REDACTED]');
    expect(redactedData.csrf_token).toBe('[REDACTED]');
    expect(redactedData.xsrfToken).toBe('[REDACTED]');
    
    // Database credentials should be redacted
    expect(redactedData.connectionString).toBe('[REDACTED]');
    expect(redactedData.databasePassword).toBe('[REDACTED]');
    expect(redactedData.dbPassword).toBe('[REDACTED]');
    
    // Safe data should be preserved
    expect(redactedData.email).toBe('user@example.com');
    expect(redactedData.username).toBe('testuser');
    expect(redactedData.firstName).toBe('John');
    expect(redactedData.lastName).toBe('Doe');
    expect(redactedData.id).toBe('12345');
    expect(redactedData.userId).toBe('user-67890');
    expect(redactedData.timestamp).toBe('2024-01-15T10:30:00Z');
    expect(redactedData.status).toBe('active');
    expect(redactedData.role).toBe('admin');
  });

  it('should handle case-insensitive sensitive field detection', () => {
    const caseVariantData = {
      Password: 'secret1',
      PASSWORD: 'secret2',
      Token: 'token1',
      TOKEN: 'token2',
      ApiKey: 'key1',
      APIKEY: 'key2',
      SessionId: 'session1',
      SESSIONID: 'session2',
      // Safe data
      Email: 'user@example.com',
      USERNAME: 'testuser'
    };

    const redactedData = securityRedactor(caseVariantData);
    
    // Should redact regardless of case
    expect(redactedData.Password).toBe('[REDACTED]');
    expect(redactedData.PASSWORD).toBe('[REDACTED]');
    expect(redactedData.Token).toBe('[REDACTED]');
    expect(redactedData.TOKEN).toBe('[REDACTED]');
    expect(redactedData.ApiKey).toBe('[REDACTED]');
    expect(redactedData.APIKEY).toBe('[REDACTED]');
    expect(redactedData.SessionId).toBe('[REDACTED]');
    expect(redactedData.SESSIONID).toBe('[REDACTED]');
    
    // Safe data should be preserved
    expect(redactedData.Email).toBe('user@example.com');
    expect(redactedData.USERNAME).toBe('testuser');
  });

  it('should redact sensitive data in nested objects', () => {
    const nestedData = {
      user: {
        profile: {
          credentials: {
            password: 'nested-secret-1',
            token: 'nested-token-1'
          }
        }
      },
      config: {
        database: {
          connection: {
            password: 'nested-secret-2',
            apiKey: 'nested-key-1'
          }
        }
      },
      metadata: {
        session: {
          authentication: {
            sessionId: 'nested-session-1',
            csrfToken: 'nested-csrf-1'
          }
        }
      }
    };

    const redactedData = securityRedactor(nestedData);
    
    expect(redactedData.user.profile.credentials.password).toBe('[REDACTED]');
    expect(redactedData.user.profile.credentials.token).toBe('[REDACTED]');
    expect(redactedData.config.database.connection.password).toBe('[REDACTED]');
    expect(redactedData.config.database.connection.apiKey).toBe('[REDACTED]');
    expect(redactedData.metadata.session.authentication.sessionId).toBe('[REDACTED]');
    expect(redactedData.metadata.session.authentication.csrfToken).toBe('[REDACTED]');
  });

  it('should redact sensitive data in arrays', () => {
    const arrayData = {
      users: [
        { id: '1', email: 'user1@example.com', password: 'secret1', token: 'token1' },
        { id: '2', email: 'user2@example.com', password: 'secret2', token: 'token2' }
      ],
      sessions: [
        { id: 'sess1', userId: '1', sessionId: 'session-id-1', csrfToken: 'csrf-1' },
        { id: 'sess2', userId: '2', sessionId: 'session-id-2', csrfToken: 'csrf-2' }
      ]
    };

    const redactedData = securityRedactor(arrayData);
    
    // Array elements should be redacted
    expect(redactedData.users[0].password).toBe('[REDACTED]');
    expect(redactedData.users[0].token).toBe('[REDACTED]');
    expect(redactedData.users[1].password).toBe('[REDACTED]');
    expect(redactedData.users[1].token).toBe('[REDACTED]');
    
    expect(redactedData.sessions[0].sessionId).toBe('[REDACTED]');
    expect(redactedData.sessions[0].csrfToken).toBe('[REDACTED]');
    expect(redactedData.sessions[1].sessionId).toBe('[REDACTED]');
    expect(redactedData.sessions[1].csrfToken).toBe('[REDACTED]');
    
    // Safe data should be preserved
    expect(redactedData.users[0].email).toBe('user1@example.com');
    expect(redactedData.users[1].email).toBe('user2@example.com');
    expect(redactedData.sessions[0].userId).toBe('1');
    expect(redactedData.sessions[1].userId).toBe('2');
  });
});

describe('Epic 015 Security - Production Environment Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prevent debug output in production environment', () => {
    // Mock production environment
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEBUG', '');
    
    const sensitiveData = {
      password: 'production-secret',
      token: 'production-token',
      apiKey: 'production-key'
    };

    debugAuth.error('Production test', sensitiveData);
    debugDatabase.error('Production test', sensitiveData);
    debugWorkflow.error('Production test', sensitiveData);
    debugComponent.error('Production test', sensitiveData);

    // Should not log anything in production
    expect(mockDebugFunction).not.toHaveBeenCalled();
  });

  it('should allow controlled debug output in production with specific DEBUG setting', () => {
    // Mock production environment with specific debug namespace
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEBUG', 'bos:auth');
    
    const sensitiveData = {
      password: 'production-secret',
      token: 'production-token',
      user: 'admin@example.com'
    };

    debugAuth.error('Production auth test', sensitiveData);
    debugDatabase.error('Production db test', sensitiveData);

    // Should only log for the enabled namespace
    expect(mockDebugFunction).toHaveBeenCalledTimes(1);
    
    // Should still redact sensitive data
    const logCall = mockDebugFunction.mock.calls[0];
    const loggedData = JSON.stringify(logCall);
    expect(loggedData).not.toContain('production-secret');
    expect(loggedData).not.toContain('production-token');
    expect(loggedData).toContain('admin@example.com');
  });

  it('should handle namespace wildcards securely in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEBUG', 'bos:*');
    
    const sensitiveData = {
      password: 'wildcard-secret',
      token: 'wildcard-token',
      operation: 'test-operation'
    };

    debugAuth.error('Wildcard auth test', sensitiveData);
    debugDatabase.error('Wildcard db test', sensitiveData);

    // Should log for all namespaces
    expect(mockDebugFunction).toHaveBeenCalledTimes(2);
    
    // Should redact sensitive data in all calls
    mockDebugFunction.mock.calls.forEach(call => {
      const loggedData = JSON.stringify(call);
      expect(loggedData).not.toContain('wildcard-secret');
      expect(loggedData).not.toContain('wildcard-token');
      expect(loggedData).toContain('test-operation');
    });
  });
});

describe('Epic 015 Security - Attack Vector Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prevent prototype pollution attacks', () => {
    const maliciousData = {
      '__proto__': { 
        password: 'malicious-secret',
        isAdmin: true 
      },
      'constructor': {
        prototype: {
          token: 'malicious-token'
        }
      },
      user: 'test@example.com'
    };

    // Should not throw and should handle safely
    expect(() => {
      const redactedData = securityRedactor(maliciousData);
      debugAuth.error('Prototype pollution test', redactedData);
    }).not.toThrow();

    expect(mockDebugFunction).toHaveBeenCalled();
  });

  it('should handle circular references without stack overflow', () => {
    const circularData: any = {
      user: 'test@example.com',
      password: 'circular-secret',
      token: 'circular-token'
    };
    circularData.self = circularData;
    circularData.parent = { child: circularData };

    expect(() => {
      const redactedData = securityRedactor(circularData);
      debugComponent.error('Circular reference test', redactedData);
    }).not.toThrow();

    expect(mockDebugFunction).toHaveBeenCalled();
  });

  it('should handle extremely large objects without DoS', () => {
    const largeData = {
      items: Array(10000).fill(0).map((_, i) => ({
        id: i,
        password: `secret-${i}`,
        data: 'x'.repeat(1000)
      })),
      metadata: {
        token: 'large-data-token',
        processed: new Date().toISOString()
      }
    };

    const startTime = Date.now();
    
    expect(() => {
      const redactedData = securityRedactor(largeData);
      debugDatabase.error('Large data test', redactedData);
    }).not.toThrow();

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time (not DoS)
    expect(duration).toBeLessThan(1000); // 1 second
    expect(mockDebugFunction).toHaveBeenCalled();
  });

  it('should handle malicious string patterns', () => {
    const maliciousData = {
      // SQL injection patterns
      query: "'; DROP TABLE users; --",
      
      // XSS patterns
      userInput: '<script>alert("xss")</script>',
      
      // Command injection patterns
      command: 'rm -rf / && echo "hacked"',
      
      // But still sensitive data
      password: 'still-secret',
      token: 'still-token',
      
      // Safe data
      email: 'user@example.com'
    };

    const redactedData = securityRedactor(maliciousData);
    
    // Should preserve malicious strings (they're not sensitive fields)
    expect(redactedData.query).toBe("'; DROP TABLE users; --");
    expect(redactedData.userInput).toBe('<script>alert("xss")</script>');
    expect(redactedData.command).toBe('rm -rf / && echo "hacked"');
    
    // Should redact actual sensitive data
    expect(redactedData.password).toBe('[REDACTED]');
    expect(redactedData.token).toBe('[REDACTED]');
    
    // Should preserve safe data
    expect(redactedData.email).toBe('user@example.com');
  });
});

describe('Epic 015 Security - Data Leak Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prevent sensitive data leakage through error messages', () => {
    const sensitiveError = new Error('Authentication failed for password: secretPassword123');
    const errorData = {
      message: 'Login failed for user with token: bearer-abc123',
      details: {
        password: 'secretPassword123',
        token: 'bearer-abc123'
      }
    };

    debugAuth.error('Authentication error', {
      error: sensitiveError,
      data: errorData
    });

    const logCall = mockDebugFunction.mock.calls[0];
    const loggedData = JSON.stringify(logCall);
    
    // Should redact sensitive data in structured fields
    expect(loggedData).not.toContain('secretPassword123');
    expect(loggedData).not.toContain('bearer-abc123');
    expect(loggedData).toContain('[REDACTED]');
    
    // Error messages might still contain sensitive data - this is expected
    // as we can't safely redact arbitrary error message content
  });

  it('should handle URL parameters with sensitive data', () => {
    const urlData = {
      requestUrl: 'https://api.example.com/auth?token=secret-token-123&password=secret-pass',
      queryParams: {
        token: 'secret-token-123',
        password: 'secret-pass',
        redirect: '/dashboard'
      },
      headers: {
        'Authorization': 'Bearer secret-bearer-token',
        'X-CSRF-Token': 'csrf-token-456',
        'Content-Type': 'application/json'
      }
    };

    const redactedData = securityRedactor(urlData);
    
    // Should redact sensitive query parameters
    expect(redactedData.queryParams.token).toBe('[REDACTED]');
    expect(redactedData.queryParams.password).toBe('[REDACTED]');
    expect(redactedData.queryParams.redirect).toBe('/dashboard');
    
    // Should redact sensitive headers
    expect(redactedData.headers['Authorization']).toBe('[REDACTED]');
    expect(redactedData.headers['X-CSRF-Token']).toBe('[REDACTED]');
    expect(redactedData.headers['Content-Type']).toBe('application/json');
    
    // URL might still contain sensitive data - this is harder to redact safely
    expect(redactedData.requestUrl).toBe('https://api.example.com/auth?token=secret-token-123&password=secret-pass');
  });

  it('should handle form data with mixed sensitive and safe fields', () => {
    const formData = {
      form: {
        username: 'testuser',
        email: 'user@example.com',
        password: 'formPassword123',
        confirmPassword: 'formPassword123',
        firstName: 'John',
        lastName: 'Doe',
        apiKey: 'form-api-key-789',
        newsletter: true,
        terms: true
      }
    };

    const redactedData = securityRedactor(formData);
    
    // Should redact sensitive form fields
    expect(redactedData.form.password).toBe('[REDACTED]');
    expect(redactedData.form.confirmPassword).toBe('[REDACTED]');
    expect(redactedData.form.apiKey).toBe('[REDACTED]');
    
    // Should preserve safe form fields
    expect(redactedData.form.username).toBe('testuser');
    expect(redactedData.form.email).toBe('user@example.com');
    expect(redactedData.form.firstName).toBe('John');
    expect(redactedData.form.lastName).toBe('Doe');
    expect(redactedData.form.newsletter).toBe(true);
    expect(redactedData.form.terms).toBe(true);
  });
});

describe('Epic 015 Security - Compliance and Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should maintain audit trail while redacting sensitive data', () => {
    const auditData = {
      timestamp: '2024-01-15T10:30:00Z',
      userId: 'user-12345',
      action: 'login_attempt',
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0...',
      sessionId: 'audit-session-123',
      credentials: {
        username: 'testuser',
        password: 'audit-password-123'
      },
      result: 'success',
      metadata: {
        authToken: 'audit-token-456',
        duration: 150
      }
    };

    debugAuth.error('Audit log entry', auditData);

    const logCall = mockDebugFunction.mock.calls[0];
    const loggedData = JSON.stringify(logCall);
    
    // Should preserve audit information
    expect(loggedData).toContain('2024-01-15T10:30:00Z');
    expect(loggedData).toContain('user-12345');
    expect(loggedData).toContain('login_attempt');
    expect(loggedData).toContain('192.168.1.100');
    expect(loggedData).toContain('testuser');
    expect(loggedData).toContain('success');
    expect(loggedData).toContain('150');
    
    // Should redact sensitive audit data
    expect(loggedData).not.toContain('audit-password-123');
    expect(loggedData).not.toContain('audit-session-123');
    expect(loggedData).not.toContain('audit-token-456');
    expect(loggedData).toContain('[REDACTED]');
  });

  it('should handle PII data appropriately', () => {
    const piiData = {
      // PII that should be preserved for debugging
      email: 'user@example.com',
      username: 'testuser',
      firstName: 'John',
      lastName: 'Doe',
      userId: 'user-12345',
      
      // Sensitive authentication data that should be redacted
      password: 'pii-password-123',
      ssn: '123-45-6789', // If this were a sensitive field pattern
      token: 'pii-token-456',
      
      // Operational data
      lastLogin: '2024-01-15T10:30:00Z',
      loginCount: 42,
      isActive: true
    };

    const redactedData = securityRedactor(piiData);
    
    // Should preserve operational PII needed for debugging
    expect(redactedData.email).toBe('user@example.com');
    expect(redactedData.username).toBe('testuser');
    expect(redactedData.firstName).toBe('John');
    expect(redactedData.lastName).toBe('Doe');
    expect(redactedData.userId).toBe('user-12345');
    expect(redactedData.lastLogin).toBe('2024-01-15T10:30:00Z');
    expect(redactedData.loginCount).toBe(42);
    expect(redactedData.isActive).toBe(true);
    
    // Should redact sensitive authentication data
    expect(redactedData.password).toBe('[REDACTED]');
    expect(redactedData.token).toBe('[REDACTED]');
    
    // SSN is preserved because it's not in our sensitive patterns
    // (In real applications, you might want to add such patterns)
    expect(redactedData.ssn).toBe('123-45-6789');
  });

  it('should handle international sensitive data patterns', () => {
    const internationalData = {
      // Different naming conventions
      mot_de_passe: 'french-password', // French: password
      parola: 'italian-password',       // Italian: password
      contraseña: 'spanish-password',   // Spanish: password
      senha: 'portuguese-password',     // Portuguese: password
      
      // Different token patterns
      jeton: 'french-token',           // French: token
      gettone: 'italian-token',        // Italian: token
      
      // Safe international data
      email: 'user@example.com',
      nom: 'Jean',                     // French: name
      apellido: 'Garcia'               // Spanish: surname
    };

    const redactedData = securityRedactor(internationalData);
    
    // Our current system only handles English patterns
    // International patterns are preserved (not redacted)
    expect(redactedData.mot_de_passe).toBe('french-password');
    expect(redactedData.parola).toBe('italian-password');
    expect(redactedData.contraseña).toBe('spanish-password');
    expect(redactedData.senha).toBe('portuguese-password');
    expect(redactedData.jeton).toBe('french-token');
    expect(redactedData.gettone).toBe('italian-token');
    
    // Safe data is preserved
    expect(redactedData.email).toBe('user@example.com');
    expect(redactedData.nom).toBe('Jean');
    expect(redactedData.apellido).toBe('Garcia');
  });
});