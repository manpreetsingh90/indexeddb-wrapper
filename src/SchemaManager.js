import { SchemaError } from './ErrorHandler.js';

/**
 * Manages schema validation and object store creation
 */
export default class SchemaManager {
  /**
   * Validates the schema structure
   * @param {Object} schema - The schema definition
   * @throws {SchemaError} If schema is invalid
   */
  static validateSchema(schema) {
    if (!schema || typeof schema !== 'object') {
      throw new SchemaError('Schema must be an object');
    }

    if (!schema.stores || typeof schema.stores !== 'object') {
      throw new SchemaError('Schema must have a stores property');
    }

    for (const [storeName, storeConfig] of Object.entries(schema.stores)) {
      if (!storeConfig || typeof storeConfig !== 'object') {
        throw new SchemaError(`Store ${storeName} configuration must be an object`);
      }

      if (!storeConfig.keyPath) {
        throw new SchemaError(`Store ${storeName} must have a keyPath`);
      }

      // Validate indexes
      if (storeConfig.indexes) {
        if (typeof storeConfig.indexes !== 'object') {
          throw new SchemaError(`Indexes for store ${storeName} must be an object`);
        }

        for (const [indexName, indexConfig] of Object.entries(storeConfig.indexes)) {
          if (typeof indexConfig !== 'object') {
            throw new SchemaError(`Index ${indexName} in store ${storeName} must be an object`);
          }

          if (!indexConfig.keyPath && !indexConfig.unique) {
            // Allow minimal config, but warn if no keyPath
          }
        }
      }
    }
  }

  /**
   * Creates object stores and indexes in the database
   * @param {IDBDatabase} db - The database instance
   * @param {Object} schema - The schema definition
   */
  static createSchema(db, schema) {
    this.validateSchema(schema);

    for (const [storeName, storeConfig] of Object.entries(schema.stores)) {
      if (!db.objectStoreNames.contains(storeName)) {
        const store = db.createObjectStore(storeName, {
          keyPath: storeConfig.keyPath,
          autoIncrement: storeConfig.autoIncrement || false
        });

        if (storeConfig.indexes) {
          for (const [indexName, indexConfig] of Object.entries(storeConfig.indexes)) {
            const keyPath = indexConfig.keyPath || indexName;
            store.createIndex(indexName, keyPath, {
              unique: indexConfig.unique || false
            });
          }
        }
      }
    }
  }

  /**
   * Checks if the existing schema matches the expected schema
   * @param {IDBDatabase} db - The database instance
   * @param {Object} schema - The expected schema
   * @returns {boolean} True if schema matches
   */
  static checkSchemaConsistency(db, schema) {
    // This would be more complex in a real implementation
    // For now, just check if stores exist
    for (const storeName of Object.keys(schema.stores)) {
      if (!db.objectStoreNames.contains(storeName)) {
        return false;
      }
    }
    return true;
  }
}