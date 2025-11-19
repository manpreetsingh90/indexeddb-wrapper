/**
 * Performance utilities for monitoring and optimizing IndexedDB operations
 */
export default class PerformanceUtils {
  /**
   * Calculates the approximate size of an object in bytes
   * @param {any} obj - Object to measure
   * @returns {number} Size in bytes
   */
  static calculateObjectSize(obj) {
    if (obj === null || obj === undefined) return 0;

    // For primitives, return a minimal size
    if (typeof obj !== 'object') {
      if (typeof obj === 'string') return obj.length * 2; // UTF-16
      if (typeof obj === 'boolean') return 1;
      if (typeof obj === 'number') return 8; // 64-bit
      return 0;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      let size = 0;
      for (const item of obj) {
        size += this.calculateObjectSize(item);
      }
      return size + (obj.length * 8); // Array overhead
    }

    // Handle objects
    let size = 0;
    const visited = new WeakSet();

    const calculateSize = (o) => {
      if (o === null || o === undefined) return 0;
      if (typeof o !== 'object') return this.calculateObjectSize(o);

      // Prevent circular references
      if (visited.has(o)) return 0;
      visited.add(o);

      let objSize = 0;

      if (Array.isArray(o)) {
        for (const item of o) {
          objSize += calculateSize(item);
        }
        objSize += o.length * 8; // Array overhead
      } else {
        for (const key in o) {
          if (o.hasOwnProperty(key)) {
            objSize += key.length * 2; // Key size (UTF-16)
            objSize += calculateSize(o[key]); // Value size
          }
        }
        objSize += Object.keys(o).length * 16; // Object property overhead
      }

      return objSize;
    };

    return calculateSize(obj);
  }

  /**
   * Measures the time taken for structured cloning
   * @param {any} obj - Object to clone
   * @returns {Object} Clone time and size metrics
   */
  static measureCloningPerformance(obj) {
    const startTime = performance.now();
    const size = this.calculateObjectSize(obj);

    try {
      // Perform structured cloning
      const cloned = structuredClone(obj);
      const endTime = performance.now();

      return {
        size,
        cloneTime: endTime - startTime,
        success: true,
        cloned
      };
    } catch (error) {
      const endTime = performance.now();

      return {
        size,
        cloneTime: endTime - startTime,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Checks if an object size exceeds performance thresholds
   * @param {number} size - Object size in bytes
   * @returns {Object} Performance assessment
   */
  static assessPerformance(size) {
    const thresholds = {
      small: 1024,      // 1KB
      medium: 1024 * 1024,     // 1MB
      large: 10 * 1024 * 1024, // 10MB
      huge: 50 * 1024 * 1024   // 50MB
    };

    let level = 'small';
    let warning = null;
    let recommendation = null;

    if (size >= thresholds.huge) {
      level = 'huge';
      warning = 'Extremely large object may cause performance issues';
      recommendation = 'Consider breaking into smaller chunks or using external storage';
    } else if (size >= thresholds.large) {
      level = 'large';
      warning = 'Large object may impact performance';
      recommendation = 'Consider optimizing data structure or using pagination';
    } else if (size >= thresholds.medium) {
      level = 'medium';
      warning = 'Medium-sized object - monitor performance';
    }

    return {
      level,
      size,
      sizeKB: Math.round(size / 1024),
      sizeMB: Math.round(size / (1024 * 1024) * 100) / 100,
      warning,
      recommendation,
      thresholds
    };
  }

  /**
   * Logs performance warnings for large objects
   * @param {string} operation - Operation name
   * @param {any} obj - Object being processed
   * @param {Object} context - Additional context
   */
  static logPerformanceWarning(operation, obj, context = {}) {
    const metrics = this.measureCloningPerformance(obj);
    const assessment = this.assessPerformance(metrics.size);

    if (assessment.warning) {
      const message = `[Performance Warning] ${operation}: ${assessment.warning}
        Size: ${assessment.sizeMB}MB (${assessment.sizeKB}KB)
        ${assessment.recommendation || ''}
        Context: ${JSON.stringify(context)}`;

      console.warn(message);

      // In development, throw error for huge objects
      if (assessment.level === 'huge' && process.env.NODE_ENV === 'development') {
        throw new Error(`Performance violation: ${message}`);
      }
    }

    return {
      metrics,
      assessment,
      logged: !!assessment.warning
    };
  }

  /**
   * Monitors transaction performance
   * @param {string} operation - Operation name
   * @param {Function} operationFn - Function to monitor
   * @returns {Promise<Object>} Operation result with performance metrics
   */
  static async monitorTransaction(operation, operationFn) {
    const startTime = performance.now();

    try {
      const result = await operationFn();
      const endTime = performance.now();

      const metrics = {
        operation,
        duration: endTime - startTime,
        success: true,
        timestamp: Date.now()
      };

      // Log slow transactions
      if (metrics.duration > 100) { // 100ms threshold
        console.warn(`[Slow Transaction] ${operation} took ${metrics.duration.toFixed(2)}ms`);
      }

      return {
        result,
        metrics
      };

    } catch (error) {
      const endTime = performance.now();

      const metrics = {
        operation,
        duration: endTime - startTime,
        success: false,
        error: error.message,
        timestamp: Date.now()
      };

      console.error(`[Transaction Error] ${operation} failed after ${metrics.duration.toFixed(2)}ms:`, error);

      throw error;
    }
  }

  /**
   * Creates a performance-monitored version of a function
   * @param {Function} fn - Original function
   * @param {string} name - Function name for logging
   * @returns {Function} Monitored function
   */
  static createMonitoredFunction(fn, name) {
    return async (...args) => {
      const startTime = performance.now();

      try {
        // Check object sizes for relevant arguments
        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          if (arg && typeof arg === 'object') {
            this.logPerformanceWarning(`${name}(arg${i})`, arg, { argIndex: i });
          }
        }

        const result = await fn.apply(this, args);
        const endTime = performance.now();

        // Log slow operations
        const duration = endTime - startTime;
        if (duration > 50) { // 50ms threshold
          console.warn(`[Slow Operation] ${name} took ${duration.toFixed(2)}ms`);
        }

        return result;

      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;

        console.error(`[Operation Error] ${name} failed after ${duration.toFixed(2)}ms:`, error);
        throw error;
      }
    };
  }

  /**
   * Gets performance statistics
   * @returns {Object} Performance statistics
   */
  static getPerformanceStats() {
    // This would integrate with a more comprehensive monitoring system
    return {
      timestamp: Date.now(),
      memory: typeof performance.memory !== 'undefined' ? {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      } : null,
      timing: performance.timing ? {
        navigationStart: performance.timing.navigationStart,
        loadEventEnd: performance.timing.loadEventEnd,
        domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
      } : null
    };
  }
}