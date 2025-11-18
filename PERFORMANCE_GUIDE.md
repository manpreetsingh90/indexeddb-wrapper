# Performance Guide

Maximize the performance of your IndexedDB applications with optimization techniques and best practices.

## Understanding Performance Characteristics

### Query Performance Spectrum

```
Fastest (μs)     Index Query     Range Query     Full Scan     Slowest (s)
     │               │                │              │               │
     ├───────────────┼────────────────┼──────────────┼───────────────┤
   0.5ms           5ms             25ms          100ms            1s+
```

### Performance Factors

1. **Index Usage**: Queries using indexes are 10-100x faster
2. **Data Size**: Performance scales with proper indexing
3. **Query Complexity**: Simple queries outperform complex ones
4. **Memory Usage**: Large result sets impact performance
5. **Transaction Scope**: Smaller transactions perform better

## Query Optimization

### Index Utilization

#### ✅ Optimal: Index-Based Queries

```javascript
// Fast: Uses email index
const user = await db.query('users', { email: 'john@example.com' });

// Fast: Uses age index with range
const adults = await db.query('users', { age: { $gte: 18 } });

// Fast: Uses compound index
const activeUsers = await db.query('users', {
  'name-status': ['John', 'active']
});
```

#### ❌ Suboptimal: Non-Indexed Queries

```javascript
// Slow: Scans entire table
const users = await db.query('users', { bio: 'developer' });

// Slow: Complex non-indexed conditions
const users = await db.query('users', {
  $and: [
    { bio: { $regex: 'dev' } },
    { location: 'NYC' }
  ]
});
```

### Query Analysis Tool

Use `analyzeQuery()` to understand query performance before execution:

```javascript
const analysis = await db.analyzeQuery('users', { email: 'john@example.com' });
console.log(analysis);
/*
{
  canUseIndex: true,
  indexName: "email",
  estimatedCost: 5,
  optimizationNotes: ["Using index 'email' for field 'email'"]
}
*/

// Compare different query approaches
const analysis1 = await db.analyzeQuery('users', { email: 'john@example.com' });
const analysis2 = await db.analyzeQuery('users', { name: 'John' });

console.log(`${analysis1.estimatedCost} vs ${analysis2.estimatedCost}`);
// Output: "5 vs 100" (index query is much cheaper)
```

## Schema Optimization

### Index Strategy

#### Primary Indexes (Essential)

```javascript
const schema = {
  stores: {
    users: {
      keyPath: 'id',
      indexes: {
        // Login/authentication queries
        email: { unique: true },

        // User search/filtering
        status: { unique: false },
        role: { unique: false },

        // Date-based queries
        createdAt: { unique: false },
        lastLogin: { unique: false }
      }
    }
  }
};
```

#### Compound Indexes (Advanced)

```javascript
const schema = {
  stores: {
    orders: {
      keyPath: 'id',
      indexes: {
        // For queries like: orders by user with status
        'userId-status': {
          keyPath: ['userId', 'status'],
          unique: false
        },

        // For date range queries by status
        'status-createdAt': {
          keyPath: ['status', 'createdAt'],
          unique: false
        }
      }
    }
  }
};
```

### Index Maintenance

- **Add indexes for frequent queries**: Monitor slow queries and add indexes
- **Remove unused indexes**: Each index consumes storage and slows writes
- **Balance read vs write performance**: More indexes = faster reads, slower writes

## Bulk Operations

### When to Use Bulk Operations

```javascript
// ✅ Good: Use bulk for multiple operations
const operations = [];
for (let i = 0; i < 1000; i++) {
  operations.push({
    type: 'create',
    data: { name: `User ${i}`, email: `user${i}@example.com` }
  });
}
await db.bulk('users', operations); // Single transaction

// ❌ Bad: Individual operations in loop
for (let i = 0; i < 1000; i++) {
  await db.create('users', {
    name: `User ${i}`,
    email: `user${i}@example.com`
  }); // 1000 separate transactions
}
```

### Bulk Operation Performance

| Operation Count | Individual Time | Bulk Time | Speedup |
|-----------------|-----------------|-----------|---------|
| 10 | 50ms | 5ms | 10x |
| 100 | 500ms | 15ms | 33x |
| 1000 | 5000ms | 50ms | 100x |

## Memory Management

### Large Dataset Handling

#### Pagination (Recommended)

```javascript
// ✅ Good: Paginated queries
const PAGE_SIZE = 100;
const allUsers = [];

for (let offset = 0; ; offset += PAGE_SIZE) {
  const page = await db.query('users', {}, {
    limit: PAGE_SIZE,
    offset: offset
  });

  if (page.length === 0) break;

  // Process page without loading all data
  await processUsers(page);
  allUsers.push(...page);
}
```

#### Cursor-Based Processing

```javascript
// For very large datasets, consider cursor operations
// (Future feature - not yet implemented in main API)
```

### Memory Usage Patterns

```javascript
// Monitor memory usage
console.log(`Heap used: ${performance.memory.usedJSHeapSize / 1024 / 1024} MB`);

// Large object handling
const largeData = await db.read('documents', docId);
// Process in chunks to avoid memory spikes
processLargeObject(largeData);
largeData = null; // Allow garbage collection
```

## Transaction Optimization

### Transaction Scope

```javascript
// ✅ Good: Minimal transaction scope
await db.create('users', userData); // Single operation transaction

// ✅ Good: Related operations together
await db.bulk('users', [
  { type: 'create', data: user1 },
  { type: 'create', data: user2 }
]); // Single transaction for related operations

// ❌ Bad: Unnecessarily large transactions
// Don't wrap unrelated operations in same transaction
```

### Transaction Modes

- **readonly**: Fastest, for queries only
- **readwrite**: Slower, for create/update/delete operations

The wrapper automatically chooses the appropriate mode.

## Performance Monitoring

### Built-in Performance Analysis

```javascript
// Analyze all your queries
const queries = [
  { filters: { email: 'user@example.com' } },
  { filters: { status: 'active' } },
  { filters: { age: { $gte: 18 } } },
  { filters: { bio: 'developer' } } // Non-indexed
];

for (const query of queries) {
  const analysis = await db.analyzeQuery('users', query.filters);
  console.log(`${JSON.stringify(query.filters)}: Cost ${analysis.estimatedCost}`);
}
```

### Custom Performance Monitoring

```javascript
class PerformanceMonitor {
  static async timeQuery(db, storeName, filters, options) {
    const start = performance.now();
    const results = await db.query(storeName, filters, options);
    const end = performance.now();

    return {
      duration: end - start,
      resultCount: results.length,
      filters,
      options
    };
  }
}

// Usage
const metrics = await PerformanceMonitor.timeQuery(
  db, 'users', { status: 'active' }, { limit: 100 }
);
console.log(`Query took ${metrics.duration.toFixed(2)}ms for ${metrics.resultCount} results`);
```

## Benchmarking Your Application

### Performance Benchmarks

```javascript
// Run the included benchmark suite
node performance-benchmark.js

// Results example:
// Index Query (email): Average: 0.62ms
// Range Query (age): Average: 23.66ms
// Compound Query ($and): Average: 19.22ms
// Full Scan (no filters): Average: 15.71ms
// Paginated Query: Average: 20.87ms
```

### Custom Benchmarks

```javascript
async function benchmarkQuery(description, queryFn, iterations = 100) {
  const times = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await queryFn();
    const end = performance.now();
    times.push(end - start);
  }

  const avg = times.reduce((a, b) => a + b) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];

  console.log(`${description}:`);
  console.log(`  Average: ${avg.toFixed(2)}ms`);
  console.log(`  Min: ${min.toFixed(2)}ms, Max: ${max.toFixed(2)}ms`);
  console.log(`  95th percentile: ${p95.toFixed(2)}ms`);
}

// Usage
await benchmarkQuery(
  'Email lookup',
  () => db.query('users', { email: 'user500@example.com' })
);
```

## Common Performance Issues

### Slow Queries

**Symptoms:**
- Queries taking >100ms
- Application freezing during data operations
- High memory usage

**Solutions:**
1. Add indexes for queried fields
2. Use `analyzeQuery()` to identify bottlenecks
3. Implement pagination for large result sets
4. Consider data archiving for old records

### Memory Issues

**Symptoms:**
- Browser tab becoming unresponsive
- Out of memory errors
- Slow garbage collection

**Solutions:**
1. Use pagination instead of loading all data
2. Process data in chunks
3. Clear references to large objects
4. Monitor heap usage with `performance.memory`

### Storage Quota Issues

**Symptoms:**
- "Quota exceeded" errors
- Data not persisting

**Solutions:**
1. Implement data cleanup strategies
2. Compress large objects before storage
3. Use external storage for large files
4. Monitor storage usage

## Advanced Optimization Techniques

### Query Result Caching

```javascript
class QueryCache {
  constructor(db, ttl = 300000) { // 5 minutes
    this.db = db;
    this.ttl = ttl;
    this.cache = new Map();
  }

  async query(storeName, filters, options) {
    const key = JSON.stringify({ storeName, filters, options });
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.results;
    }

    const results = await this.db.query(storeName, filters, options);
    this.cache.set(key, {
      results: results,
      timestamp: Date.now()
    });

    return results;
  }
}
```

### Index Selection Strategy

```javascript
// Choose best index for compound queries
function selectBestIndex(store, filters) {
  const indexStats = {};

  // Analyze which indexes can satisfy which filters
  for (const indexName of store.indexNames) {
    const index = store.index(indexName);
    const keyPath = Array.isArray(index.keyPath) ? index.keyPath : [index.keyPath];

    let matchCount = 0;
    for (const field of keyPath) {
      if (filters[field] !== undefined) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      indexStats[indexName] = {
        matchCount,
        selectivity: matchCount / keyPath.length,
        unique: index.unique
      };
    }
  }

  // Return index with highest selectivity
  return Object.entries(indexStats)
    .sort(([,a], [,b]) => b.selectivity - a.selectivity)[0]?.[0];
}
```

### Connection Pooling

For applications with frequent database operations:

```javascript
class DBConnectionPool {
  constructor(dbConfig, poolSize = 3) {
    this.config = dbConfig;
    this.poolSize = poolSize;
    this.connections = [];
    this.available = [];
  }

  async getConnection() {
    if (this.available.length > 0) {
      return this.available.pop();
    }

    if (this.connections.length < this.poolSize) {
      const db = new IDBWrapper(this.config.name, this.config.version, this.config.schema);
      await db.open();
      this.connections.push(db);
      return db;
    }

    // Wait for available connection
    return new Promise((resolve) => {
      const checkAvailable = () => {
        if (this.available.length > 0) {
          resolve(this.available.pop());
        } else {
          setTimeout(checkAvailable, 10);
        }
      };
      checkAvailable();
    });
  }

  releaseConnection(db) {
    this.available.push(db);
  }
}
```

## Performance Checklist

- [ ] All frequently queried fields are indexed
- [ ] Large result sets use pagination
- [ ] Bulk operations replace individual operations
- [ ] Query analysis shows low cost estimates
- [ ] Memory usage is monitored
- [ ] Transactions are appropriately scoped
- [ ] Unused indexes are removed
- [ ] Performance benchmarks are run regularly

## Monitoring & Alerting

### Performance Thresholds

```javascript
const PERFORMANCE_THRESHOLDS = {
  QUERY_TIME: 100,      // ms
  MEMORY_USAGE: 50,     // MB
  STORAGE_QUOTA: 80,    // % of available
  TRANSACTION_TIME: 50  // ms
};

function checkPerformance(db) {
  // Implement performance checks
  // Alert if thresholds are exceeded
}
```

### Automated Performance Testing

```javascript
// Add to CI/CD pipeline
async function performanceRegressionTest() {
  const db = new IDBWrapper('test', 1, testSchema);
  await db.open();

  // Run standard performance tests
  const results = await runPerformanceSuite(db);

  // Compare against baseline
  const baseline = loadBaselineResults();
  const regressions = findRegressions(results, baseline);

  if (regressions.length > 0) {
    console.error('Performance regressions detected:', regressions);
    process.exit(1);
  }
}
```

This guide provides comprehensive strategies for optimizing IndexedDB performance. Regular monitoring and profiling will help maintain optimal performance as your application grows.