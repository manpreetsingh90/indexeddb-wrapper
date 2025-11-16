# IndexedDB Wrapper

A tiny, promise-based, schema-aware IndexedDB wrapper that doesn't suck.

## Features

- **Tiny**: Minimal footprint with full functionality
- **Promise-based**: Modern async/await support
- **Schema-aware**: Explicit schema definition with versioning
- **CRUD Operations**: Create, read, update, delete
- **Advanced Querying**: Filters with operators
- **Bulk Operations**: Batch create/update/delete
- **Migrations**: Automatic schema migrations
- **Error Handling**: Custom error types with meaningful messages

## Installation

```bash
npm install indexeddb-wrapper
```

## Quick Start

```javascript
import { IDBWrapper } from 'indexeddb-wrapper';

const schema = {
  stores: {
    users: {
      keyPath: 'id',
      autoIncrement: true,
      indexes: {
        email: { unique: true }
      }
    }
  }
};

const db = new IDBWrapper('myapp', 1, schema);
await db.open();

// CRUD operations
const userId = await db.create('users', { name: 'John', email: 'john@example.com' });
const user = await db.read('users', userId);
await db.update('users', userId, { name: 'Johnny' });
await db.delete('users', userId);

// Querying
const users = await db.query('users', { name: 'John' });

// Bulk operations
const operations = [
  { type: 'create', data: { name: 'Alice' } },
  { type: 'create', data: { name: 'Bob' } }
];
await db.bulk('users', operations);
```

## Schema Definition

```javascript
const schema = {
  stores: {
    storeName: {
      keyPath: 'id',           // Primary key
      autoIncrement: true,     // Auto-increment primary key
      indexes: {
        indexName: {
          keyPath: 'field',    // Field to index
          unique: false        // Uniqueness constraint
        }
      }
    }
  }
};
```

## Migrations

```javascript
const migrations = [
  // Version 1 -> 2
  (db, transaction) => {
    // Migration logic
    db.createObjectStore('posts', { keyPath: 'id', autoIncrement: true });
  }
];

const db = new IDBWrapper('myapp', 2, schema, migrations);
await db.open(); // Automatically runs migrations
```

## API Reference

### IDBWrapper

- `constructor(dbName, version, schema, migrations?)`
- `open()`: Promise<IDBDatabase>
- `close()`: void
- `isOpen()`: boolean
- `create(storeName, data)`: Promise
- `read(storeName, key)`: Promise
- `update(storeName, key, data)`: Promise
- `delete(storeName, key)`: Promise
- `query(storeName, filters?)`: Promise<Array>
- `bulk(storeName, operations)`: Promise<Array>

## Browser Support

Modern browsers with IndexedDB support (Chrome, Firefox, Safari, Edge).

## License

MIT