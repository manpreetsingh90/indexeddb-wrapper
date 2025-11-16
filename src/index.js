// Main exports
export { default as IDBWrapper } from './IDBWrapper.js';

// Error classes
export {
  IDBError,
  ConnectionError,
  SchemaError,
  MigrationError,
  TransactionError
} from './ErrorHandler.js';