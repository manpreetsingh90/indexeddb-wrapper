# API Design for IndexedDB Wrapper

## Main Classes

### IDBWrapper
The primary class for interacting with IndexedDB.

#### Constructor
```javascript
new IDBWrapper(dbName, version, schema)
```
- `dbName`: String - Name of the database
- `version`: Number - Schema version
- `schema`: Object - Schema definition

#### Methods

##### Connection Management
- `open()`: Promise<void> - Opens the database connection
- `close()`: Promise<void> - Closes the database connection
- `isOpen()`: Boolean - Checks if database is open

##### CRUD Operations
- `create(storeName, data)`: Promise<ID> - Creates a new record
- `read(storeName, id)`: Promise<Object> - Reads a record by ID
- `update(storeName, id, data)`: Promise<void> - Updates a record
- `delete(storeName, id)`: Promise<void> - Deletes a record

##### Advanced Operations
- `query(storeName, query)`: Promise<Array> - Advanced querying with filters
- `bulk(storeName, operations)`: Promise<Array> - Bulk operations (create/update/delete)
- `clear(storeName)`: Promise<void> - Clears all records in a store

##### Schema Management
- `migrate(newVersion, migrationFn)`: Promise<void> - Handles schema migrations

## Schema Definition Format
```javascript
const schema = {
  stores: {
    users: {
      keyPath: 'id',
      autoIncrement: true,
      indexes: {
        email: { unique: true },
        name: { unique: false }
      }
    },
    posts: {
      keyPath: 'id',
      autoIncrement: true,
      indexes: {
        authorId: { unique: false },
        createdAt: { unique: false }
      }
    }
  }
};
```

## Query API
```javascript
// Simple query
const users = await db.query('users', { name: 'John' });

// Advanced query with operators
const posts = await db.query('posts', {
  authorId: 1,
  createdAt: { $gt: new Date('2023-01-01') }
});
```

## Bulk Operations
```javascript
const operations = [
  { type: 'create', data: { name: 'Alice' } },
  { type: 'update', id: 2, data: { name: 'Bob' } },
  { type: 'delete', id: 3 }
];
const results = await db.bulk('users', operations);
```

## Error Handling
Custom error classes:
- `IDBError` - Base error
- `ConnectionError` - Connection issues
- `SchemaError` - Schema validation errors
- `MigrationError` - Migration failures

## Observable Changes (Future)
```javascript
db.on('change', (event) => {
  console.log('Store changed:', event.store, event.operation);
});
```

## Framework Integration
Provide adapters for popular frameworks like React, Vue, etc.