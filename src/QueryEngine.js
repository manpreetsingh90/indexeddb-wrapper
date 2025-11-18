import TransactionManager from './TransactionManager.js';

/**
 * Handles advanced querying with filters and operators
 */
export default class QueryEngine {
  /**
   * Executes a query with filters using optimized index-aware approach
   * @param {IDBDatabase} db - Database instance
   * @param {string} storeName - Object store name
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options (sort, limit, offset, etc.)
   * @returns {Promise<Array>} Matching records
   */
  static async query(db, storeName, filters = {}, options = {}) {
    return TransactionManager.execute(db, storeName, 'readonly', async (transaction) => {
      const store = transaction.objectStore(storeName);

      // Analyze query and plan execution
      const queryPlan = this.analyzeQuery(filters, store, options);

      if (queryPlan.compoundFilters) {
        // Handle compound queries ($and, $or)
        return this.executeCompoundQuery(store, queryPlan.compoundFilters, queryPlan);
      } else if (queryPlan.canUseIndex) {
        // Execute using index cursor
        return this.executeIndexQuery(store, queryPlan);
      } else {
        // Fall back to full scan with in-memory filtering
        return this.executeFullScanQuery(store, filters, queryPlan);
      }
    });
  }

  /**
   * Analyzes a query without executing it
   * @param {IDBDatabase} db - Database instance
   * @param {string} storeName - Object store name
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Query analysis with cost estimation
   */
  static async analyzeQueryPlan(db, storeName, filters = {}, options = {}) {
    return TransactionManager.execute(db, storeName, 'readonly', async (transaction) => {
      const store = transaction.objectStore(storeName);
      return this.analyzeQuery(filters, store, options);
    });
  }

  /**
   * Analyzes query to determine optimal execution plan
   * @param {Object} filters - Query filters
   * @param {IDBObjectStore} store - Object store
   * @param {Object} options - Query options
   * @returns {Object} Query execution plan
   */
  static analyzeQuery(filters, store, options) {
    const plan = {
      canUseIndex: false,
      indexName: null,
      keyRange: null,
      postFilters: {},
      compoundFilters: null, // For $and/$or operations
      sortField: options.sort,
      limit: options.limit,
      offset: options.offset || 0,
      estimatedCost: 0,
      optimizationNotes: []
    };

    // Check if we have any filters
    if (Object.keys(filters).length === 0) {
      plan.estimatedCost = this.estimateFullScanCost(store);
      plan.optimizationNotes.push('Full table scan - no filters provided');
      return plan; // No filters, will use full scan
    }

    // Check for compound operators
    if (filters.$and || filters.$or) {
      plan.compoundFilters = filters;
      plan.estimatedCost = this.estimateFullScanCost(store);
      plan.optimizationNotes.push('Compound query requires full scan');
      // Compound queries require full scan for now
      // TODO: Optimize compound queries with multiple indexes
      return plan;
    }

    // Analyze each filter
    for (const [field, value] of Object.entries(filters)) {
      const indexName = this.findIndexForField(store, field);

      if (indexName && this.canUseIndexForFilter(value)) {
        // We can use an index for this filter
        plan.canUseIndex = true;
        plan.indexName = indexName;
        plan.keyRange = this.createKeyRange(value);
        plan.estimatedCost = this.estimateIndexQueryCost(store, indexName, value);
        plan.optimizationNotes.push(`Using index '${indexName}' for field '${field}'`);
      } else {
        // This filter requires post-processing
        plan.postFilters[field] = value;
        if (!plan.canUseIndex) {
          plan.estimatedCost = this.estimateFullScanCost(store);
          plan.optimizationNotes.push(`Full scan required for non-indexed field '${field}'`);
        } else {
          plan.optimizationNotes.push(`Post-filtering required for field '${field}'`);
        }
      }
    }

    return plan;
  }

  /**
   * Estimates cost of a full table scan
   * @param {IDBObjectStore} store - Object store
   * @returns {number} Estimated cost (higher = more expensive)
   */
  static estimateFullScanCost(store) {
    // Simple estimation: assume we need to scan all records
    // In a real implementation, this could use store statistics
    return 100; // Base cost for full scan
  }

  /**
   * Estimates cost of an index-based query
   * @param {IDBObjectStore} store - Object store
   * @param {string} indexName - Index name
   * @param {*} filterValue - Filter value
   * @returns {number} Estimated cost
   */
  static estimateIndexQueryCost(store, indexName, filterValue) {
    // Simple estimation based on filter type
    if (typeof filterValue === 'object' && filterValue !== null) {
      // Range queries are more expensive than exact matches
      const op = Object.keys(filterValue)[0];
      if (['$gt', '$gte', '$lt', '$lte'].includes(op)) {
        return 20; // Range query
      }
    }
    return 5; // Exact match or equality
  }

  /**
   * Finds an index that can be used for the given field
   * @param {IDBObjectStore} store - Object store
   * @param {string} field - Field name
   * @returns {string|null} Index name or null
   */
  static findIndexForField(store, field) {
    // Check if field is the key path
    if (store.keyPath === field) {
      return null; // Primary key doesn't need index
    }

    // Look for an index on this field
    for (const indexName of store.indexNames) {
      const index = store.index(indexName);
      if (index.keyPath === field) {
        return indexName;
      }
    }

    return null;
  }

  /**
   * Checks if a filter value can be optimized with an index
   * @param {*} value - Filter value
   * @returns {boolean}
   */
  static canUseIndexForFilter(value) {
    if (typeof value === 'object' && value !== null) {
      // Check if it's a range operator
      const operators = Object.keys(value);
      return operators.length === 1 && ['$gt', '$gte', '$lt', '$lte', '$eq'].includes(operators[0]);
    }

    // Equality filter
    return true;
  }

  /**
   * Creates IDBKeyRange from filter value
   * @param {*} value - Filter value
   * @returns {IDBKeyRange|null}
   */
  static createKeyRange(value) {
    if (typeof value === 'object' && value !== null) {
      const [op, val] = Object.entries(value)[0];

      switch (op) {
        case '$gt':
          return IDBKeyRange.lowerBound(val, true);
        case '$gte':
          return IDBKeyRange.lowerBound(val);
        case '$lt':
          return IDBKeyRange.upperBound(val, true);
        case '$lte':
          return IDBKeyRange.upperBound(val);
        case '$eq':
          return IDBKeyRange.only(val);
        default:
          return null;
      }
    } else {
      // Equality
      return IDBKeyRange.only(value);
    }
  }

  /**
   * Executes query using index cursor
   * @param {IDBObjectStore} store - Object store
   * @param {Object} plan - Query execution plan
   * @returns {Promise<Array>} Results
   */
  static async executeIndexQuery(store, plan) {
    const results = await new Promise((resolve, reject) => {
      const tempResults = [];
      let skipped = 0;

      const index = store.index(plan.indexName);
      const request = index.openCursor(plan.keyRange);

      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor) {
          // Apply post-filters if any
          if (Object.keys(plan.postFilters).length === 0 ||
              this.matchesFilters(cursor.value, plan.postFilters)) {

            // Handle offset
            if (skipped < plan.offset) {
              skipped++;
            } else {
              tempResults.push(cursor.value);

              // For index queries, we need to collect all results first for sorting
              // In a more advanced implementation, we could use multiple indexes
            }
          }

          cursor.continue();
        } else {
          resolve(tempResults);
        }
      };

      request.onerror = () => reject(request.error);
    });

    // Apply sorting and final limit/offset
    return this.applySortingAndPagination(results, plan);
  }

  /**
   * Executes compound query ($and, $or)
   * @param {IDBObjectStore} store - Object store
   * @param {Object} compoundFilters - Compound filter object
   * @param {Object} plan - Query execution plan
   * @returns {Promise<Array>} Results
   */
  static async executeCompoundQuery(store, compoundFilters, plan = {}) {
    const results = await new Promise((resolve, reject) => {
      const tempResults = [];
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor) {
          if (this.matchesCompoundFilters(cursor.value, compoundFilters)) {
            tempResults.push(cursor.value);
          }
          cursor.continue();
        } else {
          resolve(tempResults);
        }
      };

      request.onerror = () => reject(request.error);
    });

    // Apply sorting and pagination
    return this.applySortingAndPagination(results, plan);
  }

  /**
   * Executes query with full table scan (fallback)
   * @param {IDBObjectStore} store - Object store
   * @param {Object} filters - Query filters
   * @param {Object} plan - Query execution plan
   * @returns {Promise<Array>} Results
   */
  static async executeFullScanQuery(store, filters, plan = {}) {
    const results = await new Promise((resolve, reject) => {
      const tempResults = [];
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor) {
          if (this.matchesFilters(cursor.value, filters)) {
            tempResults.push(cursor.value);
          }
          cursor.continue();
        } else {
          resolve(tempResults);
        }
      };

      request.onerror = () => reject(request.error);
    });

    // Apply sorting and pagination
    return this.applySortingAndPagination(results, plan);
  }

  /**
   * Applies sorting and pagination to results
   * @param {Array} results - Query results
   * @param {Object} plan - Query execution plan
   * @returns {Array} Sorted and paginated results
   */
  static applySortingAndPagination(results, plan) {
    let processedResults = [...results];

    // Apply sorting if specified
    if (plan.sortField) {
      const [field, direction] = Object.entries(plan.sortField)[0];
      processedResults.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];

        if (aVal < bVal) return direction === 1 ? -1 : 1;
        if (aVal > bVal) return direction === 1 ? 1 : -1;
        return 0;
      });
    }

    // Apply offset and limit
    if (plan.offset > 0) {
      processedResults = processedResults.slice(plan.offset);
    }

    if (plan.limit > 0) {
      processedResults = processedResults.slice(0, plan.limit);
    }

    return processedResults;
  }

  /**
   * Checks if a record matches compound filters ($and, $or)
   * @param {Object} record - Record to check
   * @param {Object} compoundFilters - Compound filter criteria
   * @returns {boolean}
   */
  static matchesCompoundFilters(record, compoundFilters) {
    if (compoundFilters.$and) {
      // All conditions must be true
      return compoundFilters.$and.every(condition =>
        this.matchesFilters(record, { [Object.keys(condition)[0]]: Object.values(condition)[0] })
      );
    } else if (compoundFilters.$or) {
      // At least one condition must be true
      return compoundFilters.$or.some(condition =>
        this.matchesFilters(record, { [Object.keys(condition)[0]]: Object.values(condition)[0] })
      );
    }

    // Fallback to regular filters
    return this.matchesFilters(record, compoundFilters);
  }

  /**
   * Checks if a record matches the given filters
   * @param {Object} record - Record to check
   * @param {Object} filters - Filter criteria
   * @returns {boolean}
   */
  static matchesFilters(record, filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (key === '$and' || key === '$or') {
        // Handle nested compound operators
        if (!this.matchesCompoundFilters(record, { [key]: value })) {
          return false;
        }
      } else if (typeof value === 'object' && value !== null) {
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