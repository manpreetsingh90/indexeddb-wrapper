import ConnectionManager from './ConnectionManager.js';
import SchemaManager from './SchemaManager.js';
import TransactionManager from './TransactionManager.js';
import QueryEngine from './QueryEngine.js';
import PerformanceUtils from './PerformanceUtils.js';

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

    // Monitor performance for large objects
    PerformanceUtils.logPerformanceWarning('IDBWrapper.create', data, { storeName });

    return PerformanceUtils.monitorTransaction(`create(${storeName})`, () =>
      TransactionManager.execute(db, storeName, 'readwrite', (transaction) => {
        const store = transaction.objectStore(storeName);
        return TransactionManager.promisifyRequest(store.add(data));
      })
    ).then(result => result.result);
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

    // Monitor performance for large objects
    PerformanceUtils.logPerformanceWarning('IDBWrapper.update', data, { storeName, key });

    return PerformanceUtils.monitorTransaction(`update(${storeName})`, () =>
      TransactionManager.execute(db, storeName, 'readwrite', (transaction) => {
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
          const getRequest = store.get(key);
          getRequest.onsuccess = () => {
            const existing = getRequest.result;
            if (!existing) {
              reject(new Error('Record not found'));
              return;
            }
            const updatedData = { ...existing, ...data };
            const putRequest = store.put(updatedData);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(new TransactionError('Put failed', putRequest.error));
          };
          getRequest.onerror = () => reject(new TransactionError('Get failed', getRequest.error));
        });
      })
    ).then(result => result.result);
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
   * @param {Object} options - Query options (limit, offset, sort)
   * @returns {Promise<Array>} Matching records
   */
  async query(storeName, filters = {}, options = {}) {
    const db = this.getDatabase();
    if (!db) throw new Error('Database not open');

    return PerformanceUtils.monitorTransaction(`query(${storeName})`, () =>
      QueryEngine.query(db, storeName, filters, options)
    ).then(result => result.result);
  }

  /**
   * Analyzes a query plan without executing it
   * @param {string} storeName - Object store name
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Query analysis with cost estimation
   */
  async analyzeQuery(storeName, filters = {}, options = {}) {
    const db = this.getDatabase();
    if (!db) throw new Error('Database not open');

    return QueryEngine.analyzeQueryPlan(db, storeName, filters, options);
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

    // Monitor performance for bulk operations
    const totalSize = operations.reduce((size, op) => {
      return size + PerformanceUtils.calculateObjectSize(op.data || {});
    }, 0);

    PerformanceUtils.logPerformanceWarning('IDBWrapper.bulk', { operations, totalSize }, {
      storeName,
      operationCount: operations.length
    });

    return PerformanceUtils.monitorTransaction(`bulk(${storeName}, ${operations.length} ops)`, () =>
      TransactionManager.execute(db, storeName, 'readwrite', (transaction) => {
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
      })
    ).then(result => result.result);
  }

  /**
   * Executes operations within a safe transaction context
   * @param {string|string[]} storeNames - Store name(s) for the transaction
   * @param {string} mode - Transaction mode ('readonly' or 'readwrite')
   * @param {Function} callback - Function to execute within transaction
   * @param {Object} options - Transaction options
   * @returns {Promise} Result of the callback
   */
  async withTransaction(storeNames, mode, callback, options = {}) {
    const db = this.getDatabase();
    if (!db) throw new Error('Database not open');

    const transactionOptions = {
      timeout: options.timeout || 5000,
      strictAsync: options.strictAsync !== false, // Default to strict
      ...options
    };

    return TransactionManager.execute(db, storeNames, mode, callback, transactionOptions);
  }

  /**
   * Performs a safe bulk operation with transaction guarantees
   * @param {string} storeName - Object store name
   * @param {Array} operations - Array of operations
   * @param {Object} options - Transaction options
   * @returns {Promise<Array>} Results of operations
   */
  async safeBulk(storeName, operations, options = {}) {
    return this.withTransaction(storeName, 'readwrite', async (transaction) => {
      const store = transaction.objectStore(storeName);
      const results = [];

      for (const op of operations) {
        let result;
        switch (op.type) {
          case 'create':
            result = await TransactionManager.promisifyRequest(store.add(op.data));
            break;
          case 'update':
            result = await TransactionManager.promisifyRequest(store.put(op.data, op.id));
            break;
          case 'delete':
            result = await TransactionManager.promisifyRequest(store.delete(op.id));
            break;
          default:
            throw new Error(`Unknown operation type: ${op.type}`);
        }
        results.push(result);
      }

      return results;
    }, options);
  }
}