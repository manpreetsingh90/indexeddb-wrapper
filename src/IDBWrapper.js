import ConnectionManager from './ConnectionManager.js';
import SchemaManager from './SchemaManager.js';
import TransactionManager from './TransactionManager.js';
import QueryEngine from './QueryEngine.js';

/**
 * Main IndexedDB wrapper class
 */
export default class IDBWrapper {
  constructor(dbName, version, schema, migrations = []) {
    // Validate schema upfront
    SchemaManager.validateSchema(schema);

    this.dbName = dbName;
    this.version = version;
    this.schema = schema;
    this.migrations = migrations;

    this.connectionManager = new ConnectionManager(dbName, version, schema, migrations);
  }

  /**
   * Opens the database connection
   * @returns {Promise<IDBDatabase>}
   */
  async open() {
    return this.connectionManager.open();
  }

  /**
   * Closes the database connection
   */
  close() {
    this.connectionManager.close();
  }

  /**
   * Checks if the database is open
   * @returns {boolean}
   */
  isOpen() {
    return this.connectionManager.isOpen();
  }

  /**
   * Gets the database instance
   * @returns {IDBDatabase|null}
   */
  getDatabase() {
    return this.connectionManager.getDatabase();
  }

  /**
   * Creates a new record
   * @param {string} storeName - Object store name
   * @param {Object} data - Data to store
   * @returns {Promise} Resolves with the key
   */
  async create(storeName, data) {
    const db = this.getDatabase();
    if (!db) throw new Error('Database not open');

    return TransactionManager.execute(db, storeName, 'readwrite', (transaction) => {
      const store = transaction.objectStore(storeName);
      return TransactionManager.promisifyRequest(store.add(data));
    });
  }

  /**
   * Reads a record by key
   * @param {string} storeName - Object store name
   * @param {*} key - Record key
   * @returns {Promise} Resolves with the record or undefined
   */
  async read(storeName, key) {
    const db = this.getDatabase();
    if (!db) throw new Error('Database not open');

    return TransactionManager.execute(db, storeName, 'readonly', (transaction) => {
      const store = transaction.objectStore(storeName);
      return TransactionManager.promisifyRequest(store.get(key));
    });
  }

  /**
   * Updates a record
   * @param {string} storeName - Object store name
   * @param {*} key - Record key
   * @param {Object} data - Updated data
   * @returns {Promise} Resolves when updated
   */
  async update(storeName, key, data) {
    const db = this.getDatabase();
    if (!db) throw new Error('Database not open');

    return TransactionManager.execute(db, storeName, 'readwrite', (transaction) => {
      const store = transaction.objectStore(storeName);
      return TransactionManager.promisifyRequest(store.put(data, key));
    });
  }

  /**
   * Deletes a record
   * @param {string} storeName - Object store name
   * @param {*} key - Record key
   * @returns {Promise} Resolves when deleted
   */
  async delete(storeName, key) {
    const db = this.getDatabase();
    if (!db) throw new Error('Database not open');

    return TransactionManager.execute(db, storeName, 'readwrite', (transaction) => {
      const store = transaction.objectStore(storeName);
      return TransactionManager.promisifyRequest(store.delete(key));
    });
  }

  /**
   * Queries records with filters
   * @param {string} storeName - Object store name
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} Matching records
   */
  async query(storeName, filters = {}) {
    const db = this.getDatabase();
    if (!db) throw new Error('Database not open');

    return QueryEngine.query(db, storeName, filters);
  }

  /**
   * Performs bulk operations
   * @param {string} storeName - Object store name
   * @param {Array} operations - Array of operations
   * @returns {Promise<Array>} Results of operations
   */
  async bulk(storeName, operations) {
    const db = this.getDatabase();
    if (!db) throw new Error('Database not open');

    return TransactionManager.execute(db, storeName, 'readwrite', (transaction) => {
      const store = transaction.objectStore(storeName);

      const promises = operations.map(op => {
        switch (op.type) {
          case 'create':
            return TransactionManager.promisifyRequest(store.add(op.data));
          case 'update':
            return TransactionManager.promisifyRequest(store.put(op.data, op.id));
          case 'delete':
            return TransactionManager.promisifyRequest(store.delete(op.id));
          default:
            throw new Error(`Unknown operation type: ${op.type}`);
        }
      });

      return Promise.all(promises);
    });
  }
}