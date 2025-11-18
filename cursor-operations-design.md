# Cursor-Based Operations Design for Large Datasets

## Problem Statement
Current query operations load all matching records into memory, which doesn't scale for large datasets. Cursor-based operations provide streaming access to results without loading everything at once.

## Cursor API Design

### Basic Cursor Interface
```javascript
class QueryCursor {
  constructor(db, storeName, query, options = {}) {
    this.db = db;
    this.storeName = storeName;
    this.query = query;
    this.options = options;
    this.cursor = null;
    this.currentKey = null;
    this.currentValue = null;
  }

  // Check if more results are available
  async hasNext() {
    if (this.cursor === null) {
      await this.initializeCursor();
    }
    return this.cursor !== null;
  }

  // Get next result
  async next() {
    if (this.cursor === null) {
      await this.initializeCursor();
    }

    if (this.cursor) {
      const result = {
        key: this.cursor.key,
        value: this.cursor.value
      };

      await this.advanceCursor();
      return result;
    }

    return null;
  }

  // Skip records
  async skip(count) {
    for (let i = 0; i < count && await this.hasNext(); i++) {
      await this.advanceCursor();
    }
  }

  // Close cursor
  close() {
    this.cursor = null;
  }
}
```

### Advanced Cursor Features

#### Bidirectional Navigation
```javascript
class BidirectionalCursor extends QueryCursor {
  async previous() {
    // Navigate backwards through results
  }

  async seek(key) {
    // Jump to specific position
  }
}
```

#### Buffered Cursor
```javascript
class BufferedCursor extends QueryCursor {
  constructor(db, storeName, query, options = {}) {
    super(db, storeName, query, options);
    this.bufferSize = options.bufferSize || 100;
    this.buffer = [];
  }

  async next() {
    if (this.buffer.length === 0) {
      await this.fillBuffer();
    }

    return this.buffer.shift() || null;
  }

  async fillBuffer() {
    // Fill buffer with next batch of results
  }
}
```

## Integration with IDBWrapper

### Cursor Creation Methods
```javascript
class IDBWrapper {
  // Create cursor for queries
  createCursor(storeName, filters = {}, options = {}) {
    return new QueryCursor(this.db, storeName, { filters }, options);
  }

  // Create cursor for index queries
  createIndexCursor(storeName, indexName, filters = {}, options = {}) {
    return new IndexCursor(this.db, storeName, indexName, { filters }, options);
  }

  // Create cursor for all records
  createStoreCursor(storeName, options = {}) {
    return new StoreCursor(this.db, storeName, options);
  }
}
```

### Usage Examples

#### Basic Iteration
```javascript
const cursor = db.createCursor('users', { status: 'active' });

while (await cursor.hasNext()) {
  const user = await cursor.next();
  console.log(user.value.name);
  // Process one user at a time
}
```

#### Pagination with Cursors
```javascript
async function getPage(storeName, filters, pageSize, startAfter = null) {
  const cursor = db.createCursor(storeName, filters);

  if (startAfter) {
    await cursor.seek(startAfter);
    await cursor.next(); // Skip the startAfter record
  }

  const results = [];
  for (let i = 0; i < pageSize && await cursor.hasNext(); i++) {
    results.push(await cursor.next());
  }

  return {
    data: results,
    hasNextPage: await cursor.hasNext(),
    nextCursor: results.length > 0 ? results[results.length - 1].key : null
  };
}
```

#### Real-time Data Processing
```javascript
async function processLargeDataset(storeName, processor) {
  const cursor = db.createStoreCursor(storeName);
  let processed = 0;

  while (await cursor.hasNext()) {
    const record = await cursor.next();
    await processor(record.value);

    processed++;
    if (processed % 1000 === 0) {
      console.log(`Processed ${processed} records`);
      // Allow UI updates or yield control
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
}
```

## Performance Optimizations

### Cursor Pooling
```javascript
class CursorPool {
  constructor(maxSize = 10) {
    this.pool = [];
    this.maxSize = maxSize;
  }

  async acquire(db, storeName, query) {
    // Reuse existing cursors when possible
  }

  release(cursor) {
    // Return cursor to pool for reuse
  }
}
```

### Memory Management
- **Chunked Processing**: Process results in batches
- **Garbage Collection Hints**: Help browser clean up
- **Resource Limits**: Prevent excessive memory usage

### Concurrent Cursors
- **Multiple Active Cursors**: Support parallel processing
- **Transaction Isolation**: Ensure cursor operations don't conflict
- **Resource Sharing**: Optimize for multiple simultaneous cursors

## Error Handling

### Cursor State Validation
```javascript
class QueryCursor {
  async next() {
    if (this.isClosed) {
      throw new Error('Cursor is closed');
    }

    try {
      return await this._next();
    } catch (error) {
      this.close();
      throw error;
    }
  }
}
```

### Transaction Timeouts
- **Cursor Inactivity**: Close idle cursors
- **Transaction Limits**: Respect IndexedDB transaction time limits
- **Recovery Mechanisms**: Handle cursor invalidation

## Testing Strategy

### Cursor Correctness Tests
- **Result Ordering**: Verify correct sort order
- **Filter Application**: Ensure filters work correctly
- **Boundary Conditions**: Test edge cases (empty results, large datasets)

### Performance Tests
- **Memory Usage**: Monitor heap usage during cursor operations
- **Throughput**: Measure records processed per second
- **Scalability**: Test with increasing dataset sizes

### Integration Tests
- **Transaction Integration**: Cursors within transactions
- **Concurrent Access**: Multiple cursors on same store
- **Error Recovery**: Cursor behavior during errors

## Browser Compatibility

### Cursor API Differences
- **IndexedDB v1 vs v2**: Different cursor capabilities
- **Browser-Specific**: Handle vendor differences
- **Polyfill Support**: Fallback for older browsers

### Feature Detection
```javascript
const supportsAdvancedCursors = (() => {
  if (!window.indexedDB) return false;

  // Test for specific cursor features
  try {
    // Feature detection logic
    return true;
  } catch {
    return false;
  }
})();
```

## Migration and Adoption

### Gradual Rollout
1. **Add Cursor API**: Introduce alongside existing query methods
2. **Documentation**: Provide migration guides
3. **Deprecation**: Mark inefficient methods as deprecated
4. **Removal**: Remove old methods in future major version

### Backward Compatibility
- **Existing API**: Keep working for current users
- **Performance Warnings**: Alert when using inefficient methods
- **Migration Tools**: Provide utilities to convert old code