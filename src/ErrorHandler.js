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
    this.code = 'ERR_TRANSACTION_FAILED';
  }
}

/**
 * Error thrown when transaction becomes inactive
 */
export class TransactionInactiveError extends TransactionError {
  constructor(message = 'Transaction became inactive', originalError = null) {
    super(message, originalError);
    this.name = 'TransactionInactiveError';
    this.code = 'ERR_TRANSACTION_INACTIVE';
  }
}

/**
 * Error thrown when transaction times out
 */
export class TransactionTimeoutError extends TransactionError {
  constructor(timeout, originalError = null) {
    super(`Transaction timeout after ${timeout}ms`, originalError);
    this.name = 'TransactionTimeoutError';
    this.code = 'ERR_TRANSACTION_TIMEOUT';
    this.timeout = timeout;
  }
}

/**
 * Error thrown when storage quota is exceeded
 */
export class QuotaExceededError extends IDBError {
  constructor(message = 'Storage quota exceeded', originalError = null) {
    super(message, originalError);
    this.name = 'QuotaExceededError';
    this.code = 'ERR_QUOTA_EXCEEDED';
  }
}

/**
 * Error thrown when migration rollback fails
 */
export class MigrationRollbackError extends MigrationError {
  constructor(message, originalError = null) {
    super(message, originalError);
    this.name = 'MigrationRollbackError';
    this.code = 'ERR_MIGRATION_ROLLBACK_FAILED';
  }
}