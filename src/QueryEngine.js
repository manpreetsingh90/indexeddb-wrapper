import TransactionManager from './TransactionManager.js';

/**
 * Handles advanced querying with filters and operators
 */
export default class QueryEngine {
  /**
   * Executes a query with filters
   * @param {IDBDatabase} db - Database instance
   * @param {string} storeName - Object store name
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} Matching records
   */
  static async query(db, storeName, filters = {}) {
    return TransactionManager.execute(db, storeName, 'readonly', async (transaction) => {
      const store = transaction.objectStore(storeName);
      const results = [];

      // For now, implement basic filtering
      // In a full implementation, this would use indexes and cursors efficiently

      if (Object.keys(filters).length === 0) {
        // No filters, return all
        return new Promise((resolve, reject) => {
          const request = store.openCursor();
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              results.push(cursor.value);
              cursor.continue();
            } else {
              resolve(results);
            }
          };
          request.onerror = () => reject(request.error);
        });
      }

      // Simple implementation: get all and filter in memory
      // TODO: Optimize with indexes
      const allRecords = await new Promise((resolve, reject) => {
        const request = store.openCursor();
        const records = [];
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            records.push(cursor.value);
            cursor.continue();
          } else {
            resolve(records);
          }
        };
        request.onerror = () => reject(request.error);
      });

      return allRecords.filter(record => this.matchesFilters(record, filters));
    });
  }

  /**
   * Checks if a record matches the given filters
   * @param {Object} record - Record to check
   * @param {Object} filters - Filter criteria
   * @returns {boolean}
   */
  static matchesFilters(record, filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === 'object' && value !== null) {
        // Operator-based filter
        if (!this.evaluateOperator(record[key], value)) {
          return false;
        }
      } else {
        // Equality filter
        if (record[key] !== value) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Evaluates operator-based conditions
   * @param {*} fieldValue - Value from the record
   * @param {Object} operator - Operator object (e.g., { $gt: 5 })
   * @returns {boolean}
   */
  static evaluateOperator(fieldValue, operator) {
    const [op, value] = Object.entries(operator)[0];

    switch (op) {
      case '$gt':
        return fieldValue > value;
      case '$gte':
        return fieldValue >= value;
      case '$lt':
        return fieldValue < value;
      case '$lte':
        return fieldValue <= value;
      case '$eq':
        return fieldValue === value;
      case '$ne':
        return fieldValue !== value;
      case '$regex':
        return new RegExp(value).test(fieldValue);
      default:
        return false;
    }
  }
}