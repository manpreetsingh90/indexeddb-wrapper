import { IDBError, ConnectionError, SchemaError, MigrationError, TransactionError } from '../src/ErrorHandler.js';

describe('ErrorHandler', () => {
  it('should create IDBError with message', () => {
    const error = new IDBError('test message');
    expect(error.message).toBe('test message');
    expect(error.name).toBe('IDBError');
    expect(error.originalError).toBe(null);
  });

  it('should create IDBError with original error', () => {
    const original = new Error('original');
    const error = new IDBError('test', original);
    expect(error.originalError).toBe(original);
  });

  it('should create ConnectionError', () => {
    const error = new ConnectionError('connection failed');
    expect(error.message).toBe('connection failed');
    expect(error.name).toBe('ConnectionError');
  });

  it('should create SchemaError', () => {
    const error = new SchemaError('invalid schema');
    expect(error.message).toBe('invalid schema');
    expect(error.name).toBe('SchemaError');
  });

  it('should create MigrationError', () => {
    const error = new MigrationError('migration failed');
    expect(error.message).toBe('migration failed');
    expect(error.name).toBe('MigrationError');
  });

  it('should create TransactionError', () => {
    const error = new TransactionError('transaction failed');
    expect(error.message).toBe('transaction failed');
    expect(error.name).toBe('TransactionError');
  });
});