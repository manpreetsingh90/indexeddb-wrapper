# Troubleshooting Guide

Common issues and solutions when using the IndexedDB Wrapper.

## Quick Diagnosis

### Check Your Environment

```javascript
// Verify IndexedDB support
if (!window.indexedDB) {
  console.error('IndexedDB not supported in this browser');
}

// Check wrapper functionality
import { IDBWrapper } from 'indexeddb-wrapper';
console.log('Wrapper version:', IDBWrapper.version || '1.1.0+');
```

### Run Diagnostics

```javascript
async function runDiagnostics() {
  try {
    const db = new IDBWrapper('diagnostics', 1, {
      stores: {
        test: { keyPath: 'id', autoIncrement: true }
      }
    });

    await db.open();
    console.log('✅ Database connection successful');

    const testId = await db.create('test', { data: 'test' });
    console.log('✅ Create operation successful');

    const testData = await db.read('test', testId);
    console.log('✅ Read operation successful');

    const results = await db.query('test', { data: 'test' });
    console.log('✅ Query operation successful');

    await db.delete('test', testId);
    console.log('✅ Delete operation successful');

    await db.close();
    console.log('✅ All diagnostics passed');

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
  }
}

runDiagnostics();
```

## Common Issues & Solutions

### 1. "IndexedDB not supported"

**Symptoms:**
- `ConnectionError: IndexedDB not supported`
- Database operations fail immediately

**Causes:**
- Browser doesn't support IndexedDB
- Running in private/incognito mode
- Browser security restrictions

**Solutions:**

```javascript
// Check support before using
function checkIndexedDBSupport() {
  if (!window.indexedDB) {
    showError('Your browser does not support IndexedDB. Please use a modern browser.');
    return false;
  }

  // Check if in private mode (some browsers disable IndexedDB)
  try {
    const db = indexedDB.open('test');
    db.onerror = () => {
      showError('IndexedDB is disabled. Please disable private/incognito mode.');
    };
  } catch (e) {
    showError('IndexedDB access denied. Check browser permissions.');
  }

  return true;
}
```

**Fallback Options:**
```javascript
// Use localStorage as fallback
class LocalStorageFallback {
  async create(store, data) {
    const items = JSON.parse(localStorage.getItem(store) || '[]');
    const id = Date.now(); // Simple ID generation
    items.push({ ...data, id });
    localStorage.setItem(store, JSON.stringify(items));
    return id;
  }

  async query(store, filters) {
    const items = JSON.parse(localStorage.getItem(store) || '[]');
    return items.filter(item => matchesFilters(item, filters));
  }
}
```

### 2. "Version mismatch" Errors

**Symptoms:**
- `ConnectionError: Version mismatch`
- Database upgrade fails
- Data appears corrupted

**Causes:**
- Schema version not incremented after changes
- Migration functions failing
- Concurrent database access during schema changes

**Solutions:**

```javascript
// Always increment version for schema changes
const CURRENT_VERSION = 3; // Increment this

const db = new IDBWrapper('myapp', CURRENT_VERSION, schema, migrations);
```

**Migration Debugging:**
```javascript
const migrations = [
  (db, transaction) => {
    console.log('Running migration 1->2');
    try {
      // Migration logic
      db.createObjectStore('newStore', { keyPath: 'id' });
      console.log('Migration 1->2 completed');
    } catch (error) {
      console.error('Migration 1->2 failed:', error);
      throw error;
    }
  }
];
```

**Reset Database:**
```javascript
// Nuclear option: Clear all data
async function resetDatabase(dbName) {
  await new Promise((resolve) => {
    const deleteRequest = indexedDB.deleteDatabase(dbName);
    deleteRequest.onsuccess = () => resolve();
    deleteRequest.onerror = () => resolve();
  });

  console.log('Database cleared. Refresh page to recreate.');
}
```

### 3. Slow Query Performance

**Symptoms:**
- Queries taking >100ms
- UI freezing during data operations
- High memory usage

**Diagnosis:**

```javascript
// Analyze query performance
async function diagnoseQueryPerformance() {
  const analysis = await db.analyzeQuery('users', { status: 'active' });

  console.log('Query Analysis:');
  console.log('- Estimated cost:', analysis.estimatedCost);
  console.log('- Uses index:', analysis.canUseIndex);
  console.log('- Index name:', analysis.indexName);
  console.log('- Optimization notes:', analysis.optimizationNotes);

  if (analysis.estimatedCost > 50) {
    console.warn('⚠️ Query is expensive. Consider adding indexes.');
  }

  if (!analysis.canUseIndex) {
    console.warn('⚠️ Query cannot use indexes. Performance will be poor for large datasets.');
  }
}
```

**Solutions:**

```javascript
// Add missing indexes
const optimizedSchema = {
  stores: {
    users: {
      keyPath: 'id',
      indexes: {
        status: { unique: false },      // For status filtering
        email: { unique: true },        // For email lookups
        createdAt: { unique: false },   // For date queries
        'status-createdAt': {           // Compound index
          keyPath: ['status', 'createdAt'],
          unique: false
        }
      }
    }
  }
};

// Use pagination for large results
const results = await db.query('users', {}, {
  limit: 100,
  offset: 0
});
```

### 4. Memory Issues

**Symptoms:**
- Browser tab becoming unresponsive
- "Out of memory" errors
- Slow garbage collection

**Solutions:**

```javascript
// Use pagination instead of loading everything
async function loadUsersPaginated(db, filters) {
  const PAGE_SIZE = 100;
  const allUsers = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await db.query('users', filters, {
      limit: PAGE_SIZE,
      offset
    });

    if (page.length === 0) break;

    // Process page immediately to free memory
    await processUserPage(page);
    allUsers.push(...page);

    // Allow UI updates
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return allUsers;
}

// Monitor memory usage
function logMemoryUsage() {
  if (performance.memory) {
    const { usedJSHeapSize, totalJSHeapSize } = performance.memory;
    console.log(`Memory: ${Math.round(usedJSHeapSize / 1024 / 1024)}MB used of ${Math.round(totalJSHeapSize / 1024 / 1024)}MB total`);
  }
}
```

### 5. Transaction Conflicts

**Symptoms:**
- `TransactionError: Transaction aborted`
- Operations failing intermittently
- Data inconsistency

**Causes:**
- Multiple transactions trying to modify same data
- Long-running transactions
- Network interruptions during operations

**Solutions:**

```javascript
// Use bulk operations for related changes
await db.bulk('users', [
  { type: 'update', id: 1, data: { status: 'active' } },
  { type: 'update', id: 2, data: { status: 'inactive' } }
]);

// Handle transaction failures gracefully
async function safeUpdate(db, id, data, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await db.update('users', id, data);
      return; // Success
    } catch (error) {
      if (error instanceof TransactionError && attempt < retries) {
        console.warn(`Transaction failed, retrying (${attempt}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        continue;
      }
      throw error;
    }
  }
}
```

### 6. Storage Quota Exceeded

**Symptoms:**
- `ConnectionError: Quota exceeded`
- Data not persisting
- Operations failing silently

**Solutions:**

```javascript
// Check storage quota
async function checkStorageQuota() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const usedPercent = (estimate.usage / estimate.quota) * 100;

    console.log(`Storage: ${Math.round(estimate.usage / 1024 / 1024)}MB used of ${Math.round(estimate.quota / 1024 / 1024)}MB (${usedPercent.toFixed(1)}%)`);

    if (usedPercent > 80) {
      console.warn('⚠️ Storage quota is over 80%. Consider cleanup.');
    }
  }
}

// Implement data cleanup
async function cleanupOldData(db, daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const oldRecords = await db.query('logs', {
    createdAt: { $lt: cutoffDate }
  });

  for (const record of oldRecords) {
    await db.delete('logs', record.id);
  }

  console.log(`Cleaned up ${oldRecords.length} old records`);
}
```

### 7. Schema Validation Errors

**Symptoms:**
- `SchemaError: Invalid schema structure`
- Database creation fails

**Common Issues:**

```javascript
// ❌ Invalid: Missing keyPath
const badSchema = {
  stores: {
    users: {
      // keyPath is required!
      indexes: { /* ... */ }
    }
  }
};

// ✅ Valid
const goodSchema = {
  stores: {
    users: {
      keyPath: 'id',  // Required
      indexes: { /* ... */ }
    }
  }
};
```

**Schema Validation:**

```javascript
function validateSchema(schema) {
  const errors = [];

  if (!schema.stores || typeof schema.stores !== 'object') {
    errors.push('Schema must have a "stores" object');
  }

  for (const [storeName, storeConfig] of Object.entries(schema.stores || {})) {
    if (!storeConfig.keyPath) {
      errors.push(`Store "${storeName}" missing keyPath`);
    }

    if (storeConfig.indexes) {
      for (const [indexName, indexConfig] of Object.entries(storeConfig.indexes)) {
        if (!indexConfig.keyPath) {
          errors.push(`Index "${indexName}" in store "${storeName}" missing keyPath`);
        }
      }
    }
  }

  return errors;
}

// Usage
const errors = validateSchema(mySchema);
if (errors.length > 0) {
  console.error('Schema validation failed:', errors);
}
```

## Debug Mode

Enable detailed logging for troubleshooting:

```javascript
// Enable debug logging
const db = new IDBWrapper('myapp', 1, schema);
db.debug = true; // Log all operations

// Or create a debug wrapper
class DebugWrapper extends IDBWrapper {
  async query(storeName, filters, options) {
    console.log('Query:', { storeName, filters, options });
    const start = performance.now();

    try {
      const result = await super.query(storeName, filters, options);
      const duration = performance.now() - start;
      console.log(`Query completed in ${duration.toFixed(2)}ms, returned ${result.length} results`);
      return result;
    } catch (error) {
      console.error('Query failed:', error);
      throw error;
    }
  }
}
```

## Performance Benchmarks

Run the included performance suite:

```bash
# Run performance benchmarks
node performance-benchmark.js

# Expected output:
# Index Query (email): Average: 0.62ms
# Range Query (age): Average: 23.66ms
# Compound Query ($and): Average: 19.22ms
# Full Scan (no filters): Average: 15.71ms
# Paginated Query: Average: 20.87ms
```

If your benchmarks show significantly worse performance, check:

1. **Missing indexes** on queried fields
2. **Large datasets** without pagination
3. **Complex queries** that can't use indexes
4. **Memory pressure** causing GC pauses

## Browser-Specific Issues

### Chrome
- **Issue:** Strict storage quota enforcement
- **Solution:** Implement storage monitoring and cleanup

### Firefox
- **Issue:** IndexedDB operations may be slower in private mode
- **Solution:** Detect private mode and warn users

### Safari
- **Issue:** Limited IndexedDB support in older versions
- **Solution:** Check version and provide fallbacks

### Mobile Browsers
- **Issue:** Storage quota much smaller
- **Solution:** Compress data and implement aggressive cleanup

## Getting Help

### Debug Information

When reporting issues, include:

```javascript
const debugInfo = {
  userAgent: navigator.userAgent,
  indexedDB: !!window.indexedDB,
  wrapperVersion: '1.1.0+',
  schema: mySchema,
  error: error.message,
  errorStack: error.stack,
  performance: {
    memory: performance.memory,
    timing: performance.timing
  }
};

console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
```

### Issue Template

When opening GitHub issues:

```
**Environment:**
- Browser: Chrome 120.0.6099.109
- OS: Windows 11
- Wrapper version: 1.1.0

**Code:**
```javascript
// Minimal reproduction case
```

**Expected behavior:**
What should happen

**Actual behavior:**
What actually happens

**Error messages:**
Any console errors

**Performance impact:**
If applicable, performance metrics
```

## Prevention Best Practices

### Development
- Always run diagnostics after setup changes
- Use debug mode during development
- Test with large datasets early
- Monitor performance regularly

### Production
- Implement error boundaries
- Add performance monitoring
- Set up storage quota monitoring
- Have rollback strategies ready

### Maintenance
- Keep dependencies updated
- Monitor browser compatibility
- Regularly review and optimize queries
- Clean up old data periodically

This troubleshooting guide covers the most common issues. For additional help, check the GitHub issues or create a new issue with your specific problem.