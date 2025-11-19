/**
 * Security utilities for input validation and hardening
 */
export default class SecurityUtils {
  /**
   * Validates database name
   * @param {string} dbName - Database name to validate
   * @returns {boolean} True if valid
   * @throws {Error} If invalid
   */
  static validateDatabaseName(dbName) {
    if (!dbName || typeof dbName !== 'string') {
      throw new Error('Database name must be a non-empty string');
    }

    if (dbName.length === 0 || dbName.length > 100) {
      throw new Error('Database name must be between 1 and 100 characters');
    }

    // Prevent dangerous characters that could be used for path traversal or injection
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(dbName)) {
      throw new Error('Database name contains invalid characters');
    }

    // Prevent reserved names
    const reservedNames = ['system', 'admin', 'root', 'config', 'settings'];
    if (reservedNames.includes(dbName.toLowerCase())) {
      throw new Error('Database name is reserved');
    }

    return true;
  }

  /**
   * Validates object store name
   * @param {string} storeName - Store name to validate
   * @returns {boolean} True if valid
   * @throws {Error} If invalid
   */
  static validateStoreName(storeName) {
    if (!storeName || typeof storeName !== 'string') {
      throw new Error('Store name must be a non-empty string');
    }

    if (storeName.length === 0 || storeName.length > 100) {
      throw new Error('Store name must be between 1 and 100 characters');
    }

    // Allow alphanumeric, underscore, and hyphen
    const validNamePattern = /^[a-zA-Z0-9_-]+$/;
    if (!validNamePattern.test(storeName)) {
      throw new Error('Store name must contain only letters, numbers, underscores, and hyphens');
    }

    // Prevent starting with underscore (reserved for internal use)
    if (storeName.startsWith('_')) {
      throw new Error('Store name cannot start with underscore');
    }

    return true;
  }

  /**
   * Validates record key
   * @param {*} key - Key to validate
   * @returns {boolean} True if valid
   * @throws {Error} If invalid
   */
  static validateKey(key) {
    // Allow common key types: string, number, Date, Array (for compound keys)
    const validTypes = ['string', 'number', 'object'];

    if (!validTypes.includes(typeof key)) {
      throw new Error('Key must be a string, number, or object (for compound keys)');
    }

    // For strings, prevent extremely long keys
    if (typeof key === 'string' && key.length > 1000) {
      throw new Error('String key is too long (max 1000 characters)');
    }

    // For numbers, prevent special values
    if (typeof key === 'number' && (!isFinite(key) || isNaN(key))) {
      throw new Error('Key cannot be NaN or infinite');
    }

    // For objects (compound keys), validate recursively
    if (typeof key === 'object' && key !== null) {
      if (Array.isArray(key)) {
        if (key.length === 0 || key.length > 10) {
          throw new Error('Compound key array must have 1-10 elements');
        }
        key.forEach((subKey, index) => {
          try {
            this.validateKey(subKey);
          } catch (error) {
            throw new Error(`Compound key element ${index}: ${error.message}`);
          }
        });
      } else {
        // Plain object - check for dangerous properties
        this.validateObjectForSecurity(key, 'key');
      }
    }

    return true;
  }

  /**
   * Validates data object for security issues
   * @param {Object} data - Data to validate
   * @param {string} context - Context for error messages
   * @returns {boolean} True if valid
   * @throws {Error} If invalid
   */
  static validateDataObject(data, context = 'data') {
    if (data === null || data === undefined) {
      return true; // Allow null/undefined
    }

    if (typeof data !== 'object') {
      throw new Error(`${context} must be an object`);
    }

    // Check for prototype pollution attempts
    this.validateObjectForSecurity(data, context);

    // Prevent extremely large objects (basic check)
    const sizeEstimate = this.estimateObjectSize(data);
    if (sizeEstimate > 10 * 1024 * 1024) { // 10MB limit for security
      throw new Error(`${context} is too large (${Math.round(sizeEstimate / 1024 / 1024)}MB)`);
    }

    return true;
  }

  /**
   * Validates object for security issues like prototype pollution
   * @param {Object} obj - Object to validate
   * @param {string} context - Context for error messages
   * @returns {boolean} True if valid
   * @throws {Error} If invalid
   */
  static validateObjectForSecurity(obj, context = 'object') {
    if (typeof obj !== 'object' || obj === null) {
      return true;
    }

    const dangerousKeys = ['__proto__', 'prototype', 'constructor'];

    // Check for dangerous properties directly on the object
    for (const key of dangerousKeys) {
      if (key in obj) {
        throw new Error(`Dangerous property '${key}' found in ${context}`);
      }
    }

    const checkKeys = (o, path = '') => {
      if (typeof o !== 'object' || o === null) return;

      for (const key in o) {
        if (Object.prototype.hasOwnProperty.call(o, key)) {
          const fullPath = path ? `${path}.${key}` : key;

          // Check for dangerous keys
          if (dangerousKeys.includes(key)) {
            throw new Error(`Dangerous property '${key}' found in ${context} at ${fullPath}`);
          }

          // Check for extremely long property names
          if (key.length > 100) {
            throw new Error(`Property name too long in ${context} at ${fullPath}`);
          }

          // Recursively check nested objects
          if (typeof o[key] === 'object' && o[key] !== null) {
            checkKeys(o[key], fullPath);
          }
        }
      }
    };

    checkKeys(obj);
    return true;
  }

  /**
   * Sanitizes string input
   * @param {string} input - Input to sanitize
   * @param {Object} options - Sanitization options
   * @returns {string} Sanitized string
   */
  static sanitizeString(input, options = {}) {
    if (typeof input !== 'string') {
      return input;
    }

    let sanitized = input;

    // Remove null bytes
    sanitized = sanitized.replace(/\x00/g, '');

    // Trim whitespace if requested
    if (options.trim) {
      sanitized = sanitized.trim();
    }

    // Limit length if specified
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    return sanitized;
  }

  /**
   * Validates query filters for security
   * @param {Object} filters - Query filters to validate
   * @returns {boolean} True if valid
   * @throws {Error} If invalid
   */
  static validateQueryFilters(filters) {
    if (filters === null || filters === undefined) {
      return true;
    }

    if (typeof filters !== 'object') {
      throw new Error('Query filters must be an object');
    }

    // Prevent extremely deep nesting
    const maxDepth = 5;
    const checkDepth = (obj, depth = 0) => {
      if (depth > maxDepth) {
        throw new Error('Query filters are too deeply nested');
      }

      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            checkDepth(obj[key], depth + 1);
          }
        }
      }
    };

    checkDepth(filters);

    // Validate against prototype pollution
    this.validateObjectForSecurity(filters, 'query filters');

    return true;
  }

  /**
   * Validates schema definition
   * @param {Object} schema - Schema to validate
   * @returns {boolean} True if valid
   * @throws {Error} If invalid
   */
  static validateSchema(schema) {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Schema must be an object');
    }

    if (!schema.stores || typeof schema.stores !== 'object') {
      throw new Error('Schema must have a stores property');
    }

    const storeNames = Object.keys(schema.stores);
    if (storeNames.length === 0) {
      throw new Error('Schema must define at least one store');
    }

    if (storeNames.length > 100) {
      throw new Error('Schema cannot define more than 100 stores');
    }

    for (const storeName of storeNames) {
      this.validateStoreName(storeName);

      const storeConfig = schema.stores[storeName];
      if (!storeConfig || typeof storeConfig !== 'object') {
        throw new Error(`Store '${storeName}' configuration must be an object`);
      }

      // Validate indexes if present
      if (storeConfig.indexes) {
        if (typeof storeConfig.indexes !== 'object') {
          throw new Error(`Indexes for store '${storeName}' must be an object`);
        }

        const indexNames = Object.keys(storeConfig.indexes);
        if (indexNames.length > 50) {
          throw new Error(`Store '${storeName}' cannot have more than 50 indexes`);
        }

        for (const indexName of indexNames) {
          if (indexName.length === 0 || indexName.length > 100) {
            throw new Error(`Index name '${indexName}' in store '${storeName}' must be 1-100 characters`);
          }
        }
      }
    }

    return true;
  }

  /**
   * Estimates object size for security validation
   * @param {any} obj - Object to measure
   * @returns {number} Size in bytes
   */
  static estimateObjectSize(obj) {
    if (obj === null || obj === undefined) return 0;

    if (typeof obj === 'string') return obj.length * 2;
    if (typeof obj === 'boolean') return 1;
    if (typeof obj === 'number') return 8;

    if (typeof obj !== 'object') return 0;

    let size = 0;
    const visited = new WeakSet();

    const calculateSize = (o) => {
      if (o === null || o === undefined) return;
      if (typeof o !== 'object') return;

      if (visited.has(o)) return; // Prevent circular references
      visited.add(o);

      if (Array.isArray(o)) {
        size += o.length * 8; // Array overhead
        for (const item of o) {
          if (typeof item === 'string') size += item.length * 2;
          else if (typeof item === 'object') calculateSize(item);
          else size += 8; // Other types
        }
      } else {
        for (const key in o) {
          if (Object.prototype.hasOwnProperty.call(o, key)) {
            size += key.length * 2; // Key size
            const value = o[key];
            if (typeof value === 'string') size += value.length * 2;
            else if (typeof value === 'object') calculateSize(value);
            else size += 8; // Other types
          }
        }
      }
    };

    calculateSize(obj);
    return size;
  }

  /**
   * Creates a safe copy of an object for storage
   * @param {Object} obj - Object to copy
   * @returns {Object} Safe copy
   */
  static createSafeCopy(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    try {
      // Use structured clone for safety
      return structuredClone(obj);
    } catch (error) {
      // Fallback to JSON serialization for simple objects
      try {
        return JSON.parse(JSON.stringify(obj));
      } catch (fallbackError) {
        throw new Error('Cannot create safe copy of object');
      }
    }
  }

  /**
   * Validates migration function
   * @param {Function} migration - Migration function to validate
   * @returns {boolean} True if valid
   * @throws {Error} If invalid
   */
  static validateMigrationFunction(migration) {
    if (typeof migration !== 'function') {
      throw new Error('Migration must be a function');
    }

    // Check function string representation for dangerous patterns
    const funcString = migration.toString();
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
      /XMLHttpRequest/,
      /fetch\s*\(/,
      /import\s*\(/,
      /require\s*\(/
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(funcString)) {
        throw new Error('Migration function contains potentially dangerous code');
      }
    }

    return true;
  }

  /**
   * Performs comprehensive security check on all inputs
   * @param {Object} inputs - All inputs to validate
   * @returns {Object} Validation results
   */
  static performSecurityAudit(inputs) {
    const results = {
      passed: true,
      warnings: [],
      errors: []
    };

    try {
      // Validate database name
      if (inputs.dbName) {
        this.validateDatabaseName(inputs.dbName);
      }

      // Validate schema
      if (inputs.schema) {
        this.validateSchema(inputs.schema);
      }

      // Validate store name
      if (inputs.storeName) {
        this.validateStoreName(inputs.storeName);
      }

      // Validate key
      if (inputs.key !== undefined) {
        this.validateKey(inputs.key);
      }

      // Validate data
      if (inputs.data !== undefined) {
        this.validateDataObject(inputs.data);
      }

      // Validate filters
      if (inputs.filters) {
        this.validateQueryFilters(inputs.filters);
      }

      // Validate migrations
      if (inputs.migrations) {
        if (Array.isArray(inputs.migrations)) {
          inputs.migrations.forEach((migration, index) => {
            try {
              if (typeof migration === 'function') {
                this.validateMigrationFunction(migration);
              }
            } catch (error) {
              results.errors.push(`Migration ${index}: ${error.message}`);
            }
          });
        }
      }

    } catch (error) {
      results.passed = false;
      results.errors.push(error.message);
    }

    return results;
  }
}