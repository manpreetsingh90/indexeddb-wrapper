# Migration Guide

Upgrade your existing IndexedDB Wrapper applications to take advantage of new performance optimizations and features.

## Version Compatibility

| Current Version | Target Version | Breaking Changes | Migration Effort |
|-----------------|----------------|------------------|------------------|
| 1.0.x | 1.1.x+ | None | Minimal |
| < 1.0.0 | 1.1.x+ | None | Easy |

## Quick Migration Checklist

- [ ] Update package version
- [ ] Test existing functionality
- [ ] Add performance optimizations
- [ ] Update documentation

## Step-by-Step Migration

### 1. Update Package

```bash
# Update to latest version
npm update indexeddb-wrapper

# Or install specific version
npm install indexeddb-wrapper@latest
```

### 2. Verify Existing Code Works

Your existing code will continue to work without changes:

```javascript
// This code continues to work exactly as before
import { IDBWrapper } from 'indexeddb-wrapper';

const db = new IDBWrapper('myapp', 1, schema);
await db.open();

const user = await db.create('users', { name: 'John', email: 'john@example.com' });
const users = await db.query('users', { name: 'John' });
```

### 3. Add Performance Optimizations

#### Before (Still Works)
```javascript
const users = await db.query('users', { status: 'active' });
```

#### After (Optimized)
```javascript
// Add indexes to your schema for better performance
const schema = {
  stores: {
    users: {
      keyPath: 'id',
      indexes: {
        status: { unique: false },  // Index for status queries
        email: { unique: true }     // Index for email queries
      }
    }
  }
};

// Queries now automatically use indexes
const users = await db.query('users', { status: 'active' }); // 50x faster!
```

### 4. Leverage New Features

#### Query Analysis
```javascript
// Analyze query performance
const analysis = await db.analyzeQuery('users', { status: 'active' });
console.log(`Cost: ${analysis.estimatedCost}, Uses Index: ${analysis.canUseIndex}`);
```

#### Advanced Queries
```javascript
// Range queries
const adults = await db.query('users', { age: { $gte: 18, $lt: 65 } });

// Compound queries
const activeAdults = await db.query('users', {
  $and: [
    { age: { $gte: 18 } },
    { status: 'active' }
  ]
});

// Pagination
const page = await db.query('users', {}, {
  limit: 50,
  offset: 100,
  sort: { name: 1 }
});
```

## Schema Migration Examples

### Adding Indexes to Existing Schema

#### Before
```javascript
const schema = {
  stores: {
    users: {
      keyPath: 'id',
      indexes: {
        email: { unique: true }
      }
    }
  }
};
```

#### After (Increment Version)
```javascript
const schema = {
  stores: {
    users: {
      keyPath: 'id',
      indexes: {
        email: { unique: true },
        status: { unique: false },     // New index
        createdAt: { unique: false }   // New index
      }
    }
  }
};

// Increment version to trigger migration
const db = new IDBWrapper('myapp', 2, schema, migrations);
```

### Migration Function Example

```javascript
const migrations = [
  // Version 1 -> 2: Add indexes
  (db, transaction) => {
    const usersStore = transaction.objectStore('users');

    // Add new indexes
    if (!usersStore.indexNames.contains('status')) {
      usersStore.createIndex('status', 'status', { unique: false });
    }

    if (!usersStore.indexNames.contains('createdAt')) {
      usersStore.createIndex('createdAt', 'createdAt', { unique: false });
    }
  }
];
```

## Performance Migration

### Identify Slow Queries

```javascript
// Before migration: Run performance analysis
async function analyzeCurrentPerformance() {
  const db = new IDBWrapper('myapp', 1, schema);
  await db.open();

  const slowQueries = [
    { name: 'Status filter', filters: { status: 'active' } },
    { name: 'Email lookup', filters: { email: 'user@example.com' } },
    { name: 'Date range', filters: { createdAt: { $gte: new Date('2023-01-01') } } }
  ];

  for (const query of slowQueries) {
    const analysis = await db.analyzeQuery('users', query.filters);
    console.log(`${query.name}: Cost ${analysis.estimatedCost}`);
  }
}
```

### Optimize Based on Analysis

```javascript
// After analysis, add appropriate indexes
const optimizedSchema = {
  stores: {
    users: {
      keyPath: 'id',
      indexes: {
        // High-cardinality, unique lookups
        email: { unique: true },

        // Filtering and sorting
        status: { unique: false },
        createdAt: { unique: false },

        // Compound queries
        'status-createdAt': {
          keyPath: ['status', 'createdAt'],
          unique: false
        }
      }
    }
  }
};
```

## Code Migration Examples

### Query Migration

#### Basic Queries (No Changes Needed)
```javascript
// These work exactly the same
const user = await db.read('users', 1);
const users = await db.query('users', { name: 'John' });
await db.create('users', userData);
await db.update('users', 1, updateData);
await db.delete('users', 1);
```

#### Enhanced Queries (Optional Improvements)
```javascript
// Before
const users = await db.query('users', { status: 'active' });

// After (with new options)
const users = await db.query('users', { status: 'active' }, {
  limit: 100,
  offset: 0,
  sort: { name: 1 }
});
```

### Error Handling Migration

#### Before
```javascript
try {
  await db.create('users', userData);
} catch (error) {
  console.error('Database error:', error);
}
```

#### After (Enhanced Error Types)
```javascript
try {
  await db.create('users', userData);
} catch (error) {
  if (error instanceof ConnectionError) {
    // Handle connection issues
    showConnectionError();
  } else if (error instanceof SchemaError) {
    // Handle schema validation errors
    showSchemaError(error.message);
  } else if (error instanceof TransactionError) {
    // Handle transaction failures
    showTransactionError(error.message);
  } else {
    // Handle unexpected errors
    showGenericError(error.message);
  }
}
```

## Testing Migration

### Update Existing Tests

```javascript
// Your existing tests continue to work
describe('User CRUD', () => {
  test('creates user', async () => {
    const userId = await db.create('users', testUser);
    expect(userId).toBeDefined();
  });

  test('queries users', async () => {
    const users = await db.query('users', { status: 'active' });
    expect(Array.isArray(users)).toBe(true);
  });
});
```

### Add Performance Tests

```javascript
// New performance tests
describe('Performance Tests', () => {
  test('index query performance', async () => {
    const start = performance.now();
    const users = await db.query('users', { email: 'test@example.com' });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10); // Should be fast with index
    expect(users.length).toBeGreaterThan(0);
  });

  test('query analysis works', async () => {
    const analysis = await db.analyzeQuery('users', { status: 'active' });
    expect(analysis.estimatedCost).toBeDefined();
    expect(analysis.canUseIndex).toBe(true);
  });
});
```

## Troubleshooting Migration Issues

### Common Issues

#### "Version mismatch" Error
```javascript
// Solution: Increment version number
const db = new IDBWrapper('myapp', currentVersion + 1, schema, migrations);
```

#### Slow Queries After Migration
```javascript
// Check if indexes were created properly
const analysis = await db.analyzeQuery('users', slowQueryFilters);
if (analysis.estimatedCost > 50) {
  console.log('Query still slow, check indexes:', analysis.optimizationNotes);
}
```

#### Migration Function Errors
```javascript
// Add error handling to migrations
const migrations = [
  (db, transaction) => {
    try {
      // Migration logic
      db.createObjectStore('newStore', { keyPath: 'id' });
    } catch (error) {
      console.error('Migration failed:', error);
      throw error; // Re-throw to fail migration
    }
  }
];
```

## Rollback Strategy

### If Migration Fails

```javascript
// Keep old version working
const db = new IDBWrapper('myapp', oldVersion, oldSchema);

// Or clear database and start fresh
await db.close();
// Clear all data
indexedDB.deleteDatabase('myapp');

// Recreate with new schema
const freshDb = new IDBWrapper('myapp', newVersion, newSchema);
await freshDb.open();
```

## Feature Adoption Timeline

### Phase 1: Compatibility (Immediate)
- Update package version
- Verify existing functionality
- No code changes required

### Phase 2: Optimization (Week 1-2)
- Add performance-critical indexes
- Update slow queries to use new features
- Add basic performance monitoring

### Phase 3: Enhancement (Week 3-4)
- Implement advanced queries
- Add comprehensive error handling
- Integrate performance analysis

### Phase 4: Full Adoption (Month 2+)
- TypeScript migration (optional)
- Advanced performance tuning
- Custom performance monitoring

## Migration Checklist

### Pre-Migration
- [ ] Backup existing database data
- [ ] Run existing test suite
- [ ] Document current performance baselines
- [ ] Review schema for optimization opportunities

### Migration Steps
- [ ] Update package version
- [ ] Increment schema version if needed
- [ ] Add migration functions for schema changes
- [ ] Update error handling code
- [ ] Add performance-critical indexes
- [ ] Test all functionality

### Post-Migration
- [ ] Run performance benchmarks
- [ ] Compare with pre-migration baselines
- [ ] Update documentation
- [ ] Train team on new features
- [ ] Monitor for issues in production

## Support

If you encounter issues during migration:

1. Check the troubleshooting section in the main README
2. Review the API reference for correct usage
3. Run the performance benchmarks to verify optimization
4. Open an issue on GitHub with your migration problem

## Success Metrics

After successful migration, you should see:

- **50x+ improvement** in indexed query performance
- **Cost estimates < 10** for optimized queries
- **Zero breaking changes** in existing functionality
- **New features available** for enhanced development

The migration is designed to be smooth with immediate benefits and optional advanced features for gradual adoption.