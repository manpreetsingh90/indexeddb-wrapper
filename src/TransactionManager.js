import { TransactionError } from './ErrorHandler.js';

/**
 * Manages IndexedDB transactions
 */
export default class TransactionManager {
  /**
   * Executes an operation within a transaction
   * @param {IDBDatabase} db - The database instance
   * @param {string|string[]} storeNames - Store name(s) for the transaction
   * @param {string} mode - Transaction mode ('readonly' or 'readwrite')
   * @param {Function} operation - Function that receives the transaction and performs operations
   * @returns {Promise} Result of the operation
   */
  static async execute(db, storeNames, mode, operation) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeNames, mode);

      transaction.onerror = () => {
        reject(new TransactionError('Transaction failed', transaction.error));
      };

      transaction.onabort = () => {
        reject(new TransactionError('Transaction aborted'));
      };

      let operationResult;

      try {
        operationResult = operation(transaction);

        // If operation returns a promise, wait for it
        if (operationResult && typeof operationResult.then === 'function') {
          operationResult.then((result) => {
            transaction.oncomplete = () => resolve(result);
          }).catch(reject);
        } else {
          // For synchronous operations, resolve on complete
          transaction.oncomplete = () => resolve(operationResult);
        }
      } catch (error) {
        reject(new TransactionError('Operation failed', error));
      }
    });
  }

  /**
   * Creates a promise-based wrapper for IDBRequest
   * @param {IDBRequest} request - The IndexedDB request
   * @returns {Promise} Resolves with the result
   */
  static promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new TransactionError('Request failed', request.error));
    });
  }
}