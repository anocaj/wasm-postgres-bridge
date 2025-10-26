/**
 * Input validation and sanitization module
 * Provides SQL injection prevention, XSS protection, and input sanitization
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: any;
}

export interface SQLValidationResult {
  isValid: boolean;
  isSafe: boolean;
  errors: string[];
  warnings: string[];
  queryType:
    | "SELECT"
    | "INSERT"
    | "UPDATE"
    | "DELETE"
    | "CREATE"
    | "DROP"
    | "ALTER"
    | "UNKNOWN";
}

export class InputValidator {
  private static readonly SQL_INJECTION_PATTERNS = [
    // Union-based injection
    /(\bunion\b.*\bselect\b)/i,
    // SQL line comments (but not in the middle of valid SQL)
    /--\s*[a-zA-Z]/,
    // Block comments
    /\/\*[\s\S]*?\*\//,
    // Dangerous stacked queries
    /;\s*(?:drop|truncate|alter|grant|revoke|exec|execute)\b/i,
    // Boolean-based blind injection
    /(\bor\b|\band\b)\s+\d+\s*=\s*\d+/i,
    // Time-based blind injection
    /(sleep|waitfor|delay)\s*\(/i,
    // Information schema queries
    /information_schema/i,
    // System functions that could be dangerous
    /(pg_sleep|version|current_user|current_database)\s*\(/i,
  ];

  private static readonly XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  ];

  private static readonly DANGEROUS_SQL_KEYWORDS = [
    "drop",
    "delete",
    "truncate",
    "alter",
    "create",
    "grant",
    "revoke",
    "exec",
    "execute",
    "sp_",
    "xp_",
    "pg_",
    "dbms_",
    "utl_",
    "sys.",
  ];

  private static readonly ALLOWED_SQL_FUNCTIONS = [
    "count",
    "sum",
    "avg",
    "min",
    "max",
    "upper",
    "lower",
    "substring",
    "length",
    "trim",
    "coalesce",
    "nullif",
    "case",
    "when",
    "then",
    "else",
    "end",
    "cast",
    "extract",
  ];

  /**
   * Validate and sanitize SQL query
   */
  static validateSQL(
    sql: string,
    allowedOperations: string[] = ["SELECT"]
  ): SQLValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!sql || typeof sql !== "string") {
      return {
        isValid: false,
        isSafe: false,
        errors: ["SQL query must be a non-empty string"],
        warnings: [],
        queryType: "UNKNOWN",
      };
    }

    const normalizedSQL = sql.trim().toLowerCase();
    const queryType = this.detectQueryType(normalizedSQL);

    // Check if query type is allowed
    if (
      !allowedOperations
        .map((op) => op.toLowerCase())
        .includes(queryType.toLowerCase())
    ) {
      errors.push(
        `Query type '${queryType}' is not allowed. Allowed operations: ${allowedOperations.join(
          ", "
        )}`
      );
    }

    // Check for SQL injection patterns
    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(sql)) {
        errors.push(`Potential SQL injection detected: ${pattern.source}`);
      }
    }

    // Check for dangerous keywords (but allow them if they match the query type and are in allowed operations)
    const foundDangerous = this.DANGEROUS_SQL_KEYWORDS.filter((keyword) => {
      const keywordInSQL = normalizedSQL.includes(keyword.toLowerCase());
      if (!keywordInSQL) return false;

      // Allow the keyword if it matches the query type and is in allowed operations
      const keywordUpper = keyword.toUpperCase();
      if (
        keywordUpper === queryType &&
        allowedOperations.includes(keywordUpper)
      ) {
        return false; // Not dangerous if it's the main operation and it's allowed
      }

      return true; // It's dangerous
    });

    if (foundDangerous.length > 0) {
      errors.push(
        `Dangerous SQL keywords detected: ${foundDangerous.join(", ")}`
      );
    }

    // Check for suspicious patterns
    if (normalizedSQL.includes("1=1") || normalizedSQL.includes("1 = 1")) {
      warnings.push('Suspicious pattern detected: "1=1" condition');
    }

    if (normalizedSQL.includes("'") && !this.isValidStringLiteral(sql)) {
      warnings.push("Unescaped quotes detected - potential injection risk");
    }

    // Check query length (prevent DoS)
    if (sql.length > 10000) {
      errors.push("Query too long (max 10,000 characters)");
    }

    // Check for excessive complexity
    const complexity = this.calculateQueryComplexity(normalizedSQL);
    if (complexity > 100) {
      warnings.push(
        `Query complexity is high (${complexity}). Consider simplifying.`
      );
    }

    const isValid = errors.length === 0;
    const isSafe = errors.length === 0 && warnings.length === 0;

    return {
      isValid,
      isSafe,
      errors,
      warnings,
      queryType,
    };
  }

  /**
   * Sanitize SQL query by removing/escaping dangerous content
   */
  static sanitizeSQL(sql: string): string {
    if (!sql || typeof sql !== "string") {
      return "";
    }

    let sanitized = sql;

    // Remove SQL comments
    sanitized = sanitized.replace(/--.*$/gm, "");
    sanitized = sanitized.replace(/\/\*[\s\S]*?\*\//g, "");

    // Escape single quotes
    sanitized = sanitized.replace(/'/g, "''");

    // Remove multiple spaces
    sanitized = sanitized.replace(/\s+/g, " ");

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  /**
   * Validate WebSocket message structure
   */
  static validateWebSocketMessage(data: any): ValidationResult {
    const errors: string[] = [];

    if (!data || typeof data !== "object") {
      return {
        isValid: false,
        errors: ["Message must be a valid JSON object"],
      };
    }

    // Check required fields
    if (!data.type || typeof data.type !== "string") {
      errors.push('Message must have a valid "type" field');
    }

    if (data.payload === undefined) {
      errors.push('Message must have a "payload" field');
    }

    // Validate message type
    const validTypes = ["query", "auth", "ping", "result", "error"];
    if (data.type && !validTypes.includes(data.type)) {
      errors.push(
        `Invalid message type "${data.type}". Valid types: ${validTypes.join(
          ", "
        )}`
      );
    }

    // Type-specific validation
    if (data.type === "query" && data.payload) {
      if (!data.payload.sql || typeof data.payload.sql !== "string") {
        errors.push('Query message must have a valid "sql" field in payload');
      }

      if (data.payload.params && !Array.isArray(data.payload.params)) {
        errors.push("Query parameters must be an array");
      }
    }

    if (data.type === "auth" && data.payload) {
      if (
        !data.payload.token &&
        !data.payload.apiKey &&
        (!data.payload.username || !data.payload.password)
      ) {
        errors.push(
          "Auth message must have token, apiKey, or username/password"
        );
      }
    }

    // Check message size
    const messageSize = JSON.stringify(data).length;
    if (messageSize > 100000) {
      // 100KB limit
      errors.push("Message too large (max 100KB)");
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: this.sanitizeObject(data, true), // Skip SQL sanitization for WebSocket messages
    };
  }

  /**
   * Validate and sanitize string input for XSS
   */
  static validateString(
    input: string,
    maxLength: number = 1000
  ): ValidationResult {
    const errors: string[] = [];

    if (typeof input !== "string") {
      return {
        isValid: false,
        errors: ["Input must be a string"],
      };
    }

    if (input.length > maxLength) {
      errors.push(`String too long (max ${maxLength} characters)`);
    }

    // Check for XSS patterns
    for (const pattern of this.XSS_PATTERNS) {
      if (pattern.test(input)) {
        errors.push("Potential XSS content detected");
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: this.sanitizeString(input),
    };
  }

  /**
   * Sanitize string by removing/escaping dangerous content
   */
  static sanitizeString(input: string): string {
    if (typeof input !== "string") {
      return "";
    }

    let sanitized = input;

    // Remove script tags
    sanitized = sanitized.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ""
    );

    // Remove iframe tags
    sanitized = sanitized.replace(
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      ""
    );

    // Remove javascript: URLs
    sanitized = sanitized.replace(/javascript:/gi, "");

    // Remove event handlers
    sanitized = sanitized.replace(/on\w+\s*=/gi, "");

    // Escape HTML entities
    sanitized = sanitized
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;");

    return sanitized;
  }

  /**
   * Validate email address
   */
  static validateEmail(email: string): ValidationResult {
    const errors: string[] = [];

    if (!email || typeof email !== "string") {
      return {
        isValid: false,
        errors: ["Email must be a non-empty string"],
      };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push("Invalid email format");
    }

    if (email.length > 254) {
      errors.push("Email too long (max 254 characters)");
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitized: email.toLowerCase().trim(),
    };
  }

  /**
   * Detect SQL query type
   */
  private static detectQueryType(
    sql: string
  ):
    | "SELECT"
    | "INSERT"
    | "UPDATE"
    | "DELETE"
    | "CREATE"
    | "DROP"
    | "ALTER"
    | "UNKNOWN" {
    const trimmed = sql.trim().toLowerCase();

    if (trimmed.startsWith("select")) return "SELECT";
    if (trimmed.startsWith("insert")) return "INSERT";
    if (trimmed.startsWith("update")) return "UPDATE";
    if (trimmed.startsWith("delete")) return "DELETE";
    if (trimmed.startsWith("create")) return "CREATE";
    if (trimmed.startsWith("drop")) return "DROP";
    if (trimmed.startsWith("alter")) return "ALTER";

    return "UNKNOWN";
  }

  /**
   * Check if string contains valid SQL string literals
   */
  private static isValidStringLiteral(sql: string): boolean {
    // Simple check for balanced quotes
    const singleQuotes = (sql.match(/'/g) || []).length;
    return singleQuotes % 2 === 0;
  }

  /**
   * Calculate query complexity score
   */
  private static calculateQueryComplexity(sql: string): number {
    let complexity = 0;

    // Count joins
    complexity += (sql.match(/\bjoin\b/gi) || []).length * 5;

    // Count subqueries
    complexity += (sql.match(/\(\s*select\b/gi) || []).length * 10;

    // Count unions
    complexity += (sql.match(/\bunion\b/gi) || []).length * 8;

    // Count conditions
    complexity += (sql.match(/\bwhere\b/gi) || []).length * 2;
    complexity += (sql.match(/\band\b|\bor\b/gi) || []).length * 1;

    // Count functions
    complexity += (sql.match(/\w+\s*\(/g) || []).length * 1;

    return complexity;
  }

  /**
   * Sanitize object recursively (but preserve SQL queries)
   */
  private static sanitizeObject(
    obj: any,
    skipSqlSanitization: boolean = false
  ): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === "string") {
      // Don't sanitize SQL queries - they need their quotes intact
      return skipSqlSanitization ? obj : this.sanitizeString(obj);
    }

    if (typeof obj === "number" || typeof obj === "boolean") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item, skipSqlSanitization));
    }

    if (typeof obj === "object") {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Don't sanitize SQL field content, but sanitize the key
        const sanitizedKey = this.sanitizeString(key);
        const shouldSkipSanitization = skipSqlSanitization || key === "sql";
        sanitized[sanitizedKey] = this.sanitizeObject(
          value,
          shouldSkipSanitization
        );
      }
      return sanitized;
    }

    return obj;
  }
}
