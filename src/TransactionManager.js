import { TransactionError, TransactionInactiveError, TransactionTimeoutError } from './ErrorHandler.js';

/**
 * Manages IndexedDB transactions
 */
export default class TransactionManager {
  /**
   * Executes an operation within a transaction with safety checks
   * @param {IDBDatabase} db - The database instance
   * @param {string|string[]} storeNames - Store name(s) for the transaction
   * @param {string} mode - Transaction mode ('readonly' or 'readwrite')
   * @param {Function} operation - Function that receives the transaction and performs operations
   * @param {Object} options - Transaction options
   * @returns {Promise} Result of the operation
   */
  static async execute(db, storeNames, mode, operation, options = {}) {
    const {
      timeout = 5000, // 5 second default timeout
      strictAsync = true // Enforce no external async operations
    } = options;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeNames, mode);
      let timeoutId;
      let completed = false;

      // Set transaction timeout
      if (timeout > 0) {
        timeoutId = setTimeout(() => {
          if (!completed && transaction.readyState === 'active') {
            try {
              transaction.abort();
              reject(new TransactionTimeoutError(timeout));
            } catch (error) {
              // Transaction might already be finished
              reject(new TransactionTimeoutError(timeout));
            }
          }
        }, timeout);
      }

      transaction.onerror = () => {
        completed = true;
        if (timeoutId) clearTimeout(timeoutId);
        reject(new TransactionError('Transaction failed', transaction.error));
      };

      transaction.onabort = () => {
        completed = true;
        if (timeoutId) clearTimeout(timeoutId);

        // Check if this was due to transaction becoming inactive
        if (transaction.error && transaction.error.name === 'InvalidStateError') {
          reject(new TransactionInactiveError('Transaction became inactive during operation'));
        } else {
          reject(new TransactionError('Transaction aborted'));
        }
      };

      // Track async operations to prevent transaction invalidation
      const activePromises = new Set();

      const safeOperation = async (txn) => {
        try {
          // Wrap the operation to monitor async behavior
          const result = await this.executeWithSafety(txn, operation, {
            strictAsync,
            activePromises,
            transaction
          });
          return result;
        } catch (error) {
          throw new TransactionError('Operation failed', error);
        }
      };

      // Execute the operation
      safeOperation(transaction)
        .then((result) => {
          // Wait for transaction completion
          transaction.oncomplete = () => {
            completed = true;
            if (timeoutId) clearTimeout(timeoutId);
            resolve(result);
          };
        })
        .catch((error) => {
          completed = true;
          if (timeoutId) clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Executes operation with safety monitoring
   * @param {IDBTransaction} transaction - The transaction
   * @param {Function} operation - The operation to execute
   * @param {Object} safety - Safety monitoring options
   * @returns {Promise} Operation result
   */
  static async executeWithSafety(transaction, operation, safety) {
    const { strictAsync, activePromises, transaction: txn } = safety;

    // Create a proxy to monitor transaction access
    const monitoredTransaction = this.createMonitoredTransaction(transaction, safety);

    // Execute the operation
    const result = operation(monitoredTransaction);

    // If result is a promise, monitor it
    if (result && typeof result.then === 'function') {
      activePromises.add(result);

      try {
        const resolvedResult = await result;
        activePromises.delete(result);
        return resolvedResult;
      } catch (error) {
        activePromises.delete(result);
        throw error;
      }
    }

    return result;
  }

  /**
   * Creates a monitored transaction proxy
   * @param {IDBTransaction} transaction - Original transaction
   * @param {Object} safety - Safety monitoring options
   * @returns {Proxy} Monitored transaction
   */
  static createMonitoredTransaction(transaction, safety) {
    const { strictAsync, activePromises } = safety;

    return new Proxy(transaction, {
      get(target, property) {
        // Monitor transaction state
        if (property === 'objectStore') {
          return (storeName) => {
            // Check if transaction is still active
            if (target.error) {
              throw new TransactionError('Transaction is in error state', target.error);
            }

            // Check if transaction is still active (not aborted or completed)
            if (target.mode === 'versionchange') {
              // Version change transactions are special
            } else if (target.readyState === 'finished') {
              throw new TransactionInactiveError('Transaction has already finished');
            }

            try {
              const store = target.objectStore(storeName);
              // Return monitored object store
              return TransactionManager.createMonitoredObjectStore(store, safety);
            } catch (error) {
              if (error.name === 'InvalidStateError') {
                throw new TransactionInactiveError('Cannot access object store - transaction is inactive');
              }
              throw error;
            }
          };
        }

        return target[property];
      }
    });
  }

  /**
   * Creates a monitored object store proxy
   * @param {IDBObjectStore} store - Original object store
   * @param {Object} safety - Safety monitoring options
   * @returns {Proxy} Monitored object store
   */
  static createMonitoredObjectStore(store, safety) {
    const { strictAsync, activePromises } = safety;

    const monitoredStore = new Proxy(store, {
      get(target, property) {
        if (typeof target[property] === 'function') {
          return (...args) => {
            const result = target[property](...args);

            // Monitor async operations
            if (result && typeof result.then === 'function') {
              if (strictAsync && activePromises.size > 0) {
                throw new TransactionError(
                  'Cannot start new async operation while another is pending. ' +
                  'Use withTransaction() for complex async operations.'
                );
              }

              activePromises.add(result);

              // Add error handling
              result.catch(() => {
                activePromises.delete(result);
              }).finally(() => {
                activePromises.delete(result);
              });
            }

            return result;
          };
        }

        return target[property];
      }
    });

    return monitoredStore;
  }

  /**
   * Creates a promise-based wrapper for IDBRequest
   * @param {IDBRequest} request - The IndexedDB request
   * @returns {Promise} Resolves with the result
   */
  static promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error('IDBRequest failed:', request.error.name, request.error.message);
        reject(new TransactionError(`Request failed: ${request.error.name} - ${request.error.message}`, request.error));
      };
    });
  }
}