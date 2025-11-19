import ConnectionManager from './ConnectionManager.js';
import SchemaManager from './SchemaManager.js';
import TransactionManager from './TransactionManager.js';
import QueryEngine from './QueryEngine.js';
import PerformanceUtils from './PerformanceUtils.js';
import TabCoordinator from './TabCoordinator.js';
import SecurityUtils from './SecurityUtils.js';

/**
 * Main IndexedDB wrapper class
 */
export default class IDBWrapper {
  constructor(dbName, version, schema, migrations = [], options = {}) {
    // Security validation
    SecurityUtils.validateDatabaseName(dbName);
    SecurityUtils.validateSchema(schema);

    if (migrations) {
      if (Array.isArray(migrations)) {
        migrations.forEach((migration, index) => {
          if (typeof migration === 'function') {
            SecurityUtils.validateMigrationFunction(migration);
          }
        });
      }
    }

    this.dbName = dbName;
    this.version = version;
    this.schema = schema;
    this.migrations = migrations;
    this.options = {
      enableTabCoordination: true,
      enableSecurityValidation: true,
      ...options
    };

    // Initialize tab coordination if enabled
    if (this.options.enableTabCoordination && typeof BroadcastChannel !== 'undefined') {
      this.tabCoordinator = new TabCoordinator(dbName);
    }

    this.connectionManager = new ConnectionManager(dbName, version, schema, migrations, this.tabCoordinator);
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
   * Execute an operation with tab coordination
   * @param {string} lockId - Lock identifier
   * @param {Function} operation - Operation to execute
   * @returns {Promise} Operation result
   */
  async withCoordination(lockId, operation) {
    if (this.tabCoordinator) {
      await this.tabCoordinator.requestLock(lockId);
      try {
        return await operation();
      } finally {
        this.tabCoordinator.releaseLock(lockId);
      }
    } else {
      // No coordination available, execute directly
      return operation();
    }
  }

  /**
   * Get tab coordination status
   * @returns {Object} Coordination status
   */
  getCoordinationStatus() {
    if (this.tabCoordinator) {
      return this.tabCoordinator.getStatus();
    }
    return { enabled: false, reason: 'BroadcastChannel not supported or disabled' };
  }

  /**
   * Creates a new record
   * @param {string} storeName - Object store name
   * @param {Object} data - Data to store
   * @returns {Promise} Resolves with the key
   */
  async create(storeName, data) {
    // Security validation
    if (this.options.enableSecurityValidation) {
      SecurityUtils.validateStoreName(storeName);
      SecurityUtils.validateDataObject(data, `create(${storeName}) data`);
    }

    return this.withCoordination(`write-${storeName}`, async () => {
      const db = this.getDatabase();
      if (!db) throw new Error('Database not open');

      // Create safe copy for storage
      const safeData = SecurityUtils.createSafeCopy(data);

      // Monitor performance for large objects
      PerformanceUtils.logPerformanceWarning('IDBWrapper.create', safeData, { storeName });

      return PerformanceUtils.monitorTransaction(`create(${storeName})`, () =>
        TransactionManager.execute(db, storeName, 'readwrite', (transaction) => {
          const store = transaction.objectStore(storeName);
          return TransactionManager.promisifyRequest(store.add(safeData));
        })
      ).then(result => result.result);
    });
  }

  /**
   * Reads a record by key
   * @param {string} storeName - Object store name
   * @param {*} key - Record key
   * @returns {Promise} Resolves with the record or undefined
   */
  async read(storeName, key) {
    // Security validation
    if (this.options.enableSecurityValidation) {
      SecurityUtils.validateStoreName(storeName);
      SecurityUtils.validateKey(key);
    }

    return this.withCoordination(`read-${storeName}`, async () => {
      const db = this.getDatabase();
      if (!db) throw new Error('Database not open');

      return PerformanceUtils.monitorTransaction(`read(${storeName})`, () =>
        TransactionManager.execute(db, storeName, 'readonly', (transaction) => {
          const store = transaction.objectStore(storeName);
          return TransactionManager.promisifyRequest(store.get(key));
        })
      ).then(result => result.result);
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
    // Security validation
    if (this.options.enableSecurityValidation) {
      SecurityUtils.validateStoreName(storeName);
      SecurityUtils.validateKey(key);
      SecurityUtils.validateDataObject(data, `update(${storeName}) data`);
    }

    return this.withCoordination(`write-${storeName}`, async () => {
      const db = this.getDatabase();
      if (!db) throw new Error('Database not open');

      // Create safe copy for storage
      const safeData = SecurityUtils.createSafeCopy(data);

      // Monitor performance for large objects
      PerformanceUtils.logPerformanceWarning('IDBWrapper.update', safeData, { storeName, key });

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
              const updatedData = { ...existing, ...safeData };
              const putRequest = store.put(updatedData);
              putRequest.onsuccess = () => resolve();
              putRequest.onerror = () => reject(new TransactionError('Put failed', putRequest.error));
            };
            getRequest.onerror = () => reject(new TransactionError('Get failed', getRequest.error));
          });
        })
      ).then(result => result.result);
    });
  }

  /**
   * Deletes a record
   * @param {string} storeName - Object store name
   * @param {*} key - Record key
   * @returns {Promise} Resolves when deleted
   */
  async delete(storeName, key) {
    // Security validation
    if (this.options.enableSecurityValidation) {
      SecurityUtils.validateStoreName(storeName);
      SecurityUtils.validateKey(key);
    }

    return this.withCoordination(`write-${storeName}`, async () => {
      const db = this.getDatabase();
      if (!db) throw new Error('Database not open');

      return PerformanceUtils.monitorTransaction(`delete(${storeName})`, () =>
        TransactionManager.execute(db, storeName, 'readwrite', (transaction) => {
          const store = transaction.objectStore(storeName);
          return TransactionManager.promisifyRequest(store.delete(key));
        })
      ).then(result => result.result);
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
    // Security validation
    if (this.options.enableSecurityValidation) {
      SecurityUtils.validateStoreName(storeName);
      SecurityUtils.validateQueryFilters(filters);
    }

    return this.withCoordination(`read-${storeName}`, async () => {
      const db = this.getDatabase();
      if (!db) throw new Error('Database not open');

      return PerformanceUtils.monitorTransaction(`query(${storeName})`, () =>
        QueryEngine.query(db, storeName, filters, options)
      ).then(result => result.result);
    });
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
    // Security validation
    if (this.options.enableSecurityValidation) {
      SecurityUtils.validateStoreName(storeName);

      if (!Array.isArray(operations)) {
        throw new Error('Bulk operations must be an array');
      }

      if (operations.length === 0) {
        throw new Error('Bulk operations array cannot be empty');
      }

      if (operations.length > 1000) {
        throw new Error('Bulk operations cannot exceed 1000 items');
      }

      operations.forEach((op, index) => {
        if (!op || typeof op !== 'object') {
          throw new Error(`Bulk operation ${index} must be an object`);
        }

        if (!op.type || typeof op.type !== 'string') {
          throw new Error(`Bulk operation ${index} must have a valid type`);
        }

        if (!['create', 'update', 'delete'].includes(op.type)) {
          throw new Error(`Bulk operation ${index} has invalid type: ${op.type}`);
        }

        if (op.type !== 'delete' && !op.data) {
          throw new Error(`Bulk operation ${index} (${op.type}) must have data`);
        }

        if ((op.type === 'update' || op.type === 'delete') && op.id === undefined) {
          throw new Error(`Bulk operation ${index} (${op.type}) must have an id`);
        }

        // Validate individual operation data
        if (op.data) {
          SecurityUtils.validateDataObject(op.data, `bulk operation ${index} data`);
        }

        if (op.id !== undefined) {
          SecurityUtils.validateKey(op.id);
        }
      });
    }

    return this.withCoordination(`bulk-${storeName}`, async () => {
      const db = this.getDatabase();
      if (!db) throw new Error('Database not open');

      // Create safe copies for all operations
      const safeOperations = operations.map(op => ({
        ...op,
        data: op.data ? SecurityUtils.createSafeCopy(op.data) : undefined
      }));

      // Monitor performance for bulk operations
      const totalSize = safeOperations.reduce((size, op) => {
        return size + PerformanceUtils.calculateObjectSize(op.data || {});
      }, 0);

      PerformanceUtils.logPerformanceWarning('IDBWrapper.bulk', { operations: safeOperations, totalSize }, {
        storeName,
        operationCount: operations.length
      });

      return PerformanceUtils.monitorTransaction(`bulk(${storeName}, ${operations.length} ops)`, () =>
        TransactionManager.execute(db, storeName, 'readwrite', (transaction) => {
          const store = transaction.objectStore(storeName);

          const promises = safeOperations.map(op => {
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
    });
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