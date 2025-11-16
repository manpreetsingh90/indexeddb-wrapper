/**
 * Base error class for IndexedDB operations
 */
export class IDBError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'IDBError';
    this.originalError = originalError;
  }
}

/**
 * Error thrown when database connection fails
 */
export class ConnectionError extends IDBError {
  constructor(message, originalError = null) {
    super(message, originalError);
    this.name = 'ConnectionError';
  }
}

/**
 * Error thrown when schema validation fails
 */
export class SchemaError extends IDBError {
  constructor(message, originalError = null) {
    super(message, originalError);
    this.name = 'SchemaError';
  }
}

/**
 * Error thrown when migration fails
 */
export class MigrationError extends IDBError {
  constructor(message, originalError = null) {
    super(message, originalError);
    this.name = 'MigrationError';
  }
}

/**
 * Error thrown when transaction fails
 */
export class TransactionError extends IDBError {
  constructor(message, originalError = null) {
    super(message, originalError);
    this.name = 'TransactionError';
  }
}