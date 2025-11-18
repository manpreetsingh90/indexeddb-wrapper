# API Reference

Complete API documentation for the IndexedDB Wrapper.

## Table of Contents

- [IDBWrapper Class](#idbwrapper-class)
- [Query Operators](#query-operators)
- [Error Types](#error-types)
- [Schema Definition](#schema-definition)
- [Migration Functions](#migration-functions)
- [Type Definitions](#type-definitions)

## IDBWrapper Class

### Constructor

```javascript
new IDBWrapper(dbName, version, schema, migrations?)
```

**Parameters:**
- `dbName` (string): Database name
- `version` (number): Schema version number
- `schema` (object): Database schema definition
- `migrations` (Array<Function>, optional): Migration functions

**Example:**
```javascript
const db = new IDBWrapper('myapp', 1, userSchema, migrations);
```

### Instance Methods

#### Database Management

##### `open(): Promise<IDBDatabase>`

Opens the database connection and initializes schema.

**Returns:** Promise resolving to the IDBDatabase instance

**Throws:**
- `ConnectionError` - If IndexedDB is not supported or connection fails
- `SchemaError` - If schema validation fails
- `MigrationError` - If migration execution fails

**Example:**
```javascript
try {
  await db.open();
  console.log('Database ready');
} catch (error) {
  console.error('Failed to open database:', error.message);
}
```

##### `close(): void`

Closes the database connection.

**Example:**
```javascript
db.close();
```

##### `isOpen(): boolean`

Checks if the database connection is currently open.

**Returns:** `true` if database is open, `false` otherwise

**Example:**
```javascript
if (db.isOpen()) {
  // Database is ready for operations
}
```

##### `getDatabase(): IDBDatabase|null`

Returns the raw IDBDatabase instance for advanced operations.

**Returns:** IDBDatabase instance or null if not connected

**Example:**
```javascript
const rawDB = db.getDatabase();
if (rawDB) {
  // Use raw IndexedDB API
}
```

#### CRUD Operations

##### `create(storeName, data): Promise<Key>`

Creates a new record in the specified object store.

**Parameters:**
- `storeName` (string): Name of the object store
- `data` (object): Record data to store

**Returns:** Promise resolving to the record key

**Throws:**
- `Error` - If database is not open
- `TransactionError` - If create operation fails

**Example:**
```javascript
const userId = await db.create('users', {
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});
// userId = 1 (auto-generated)
```

##### `read(storeName, key): Promise<Object|null>`

Reads a record by its primary key.

**Parameters:**
- `storeName` (string): Name of the object store
- `key` (*): Primary key value

**Returns:** Promise resolving to the record object or null if not found

**Throws:**
- `Error` - If database is not open
- `TransactionError` - If read operation fails

**Example:**
```javascript
const user = await db.read('users', 1);
if (user) {
  console.log(user.name); // 'John Doe'
}
```

##### `update(storeName, key, data): Promise<void>`

Updates an existing record.

**Parameters:**
- `storeName` (string): Name of the object store
- `key` (*): Primary key value
- `data` (object): Updated data (merged with existing record)

**Throws:**
- `Error` - If database is not open or record not found
- `TransactionError` - If update operation fails

**Example:**
```javascript
await db.update('users', 1, {
  name: 'Johnny Doe',
  lastLogin: new Date()
});
```

##### `delete(storeName, key): Promise<void>`

Deletes a record by its primary key.

**Parameters:**
- `storeName` (string): Name of the object store
- `key` (*): Primary key value

**Throws:**
- `Error` - If database is not open
- `TransactionError` - If delete operation fails

**Example:**
```javascript
await db.delete('users', 1);
```

#### Query Operations

##### `query(storeName, filters?, options?): Promise<Array>`

Queries records with optional filters and options.

**Parameters:**
- `storeName` (string): Name of the object store
- `filters` (object, optional): Query filter criteria
- `options` (object, optional): Query options

**Returns:** Promise resolving to array of matching records

**Query Options:**
```javascript
{
  limit: 100,        // Maximum results to return
  offset: 0,         // Number of results to skip
  sort: {            // Sort specification
    fieldName: 1     // 1 = ascending, -1 = descending
  }
}
```

**Throws:**
- `Error` - If database is not open
- `TransactionError` - If query operation fails

**Examples:**
```javascript
// Simple equality query
const users = await db.query('users', { status: 'active' });

// Range query
const adults = await db.query('users', { age: { $gte: 18 } });

// Compound query
const activeAdults = await db.query('users', {
  $and: [
    { age: { $gte: 18 } },
    { status: 'active' }
  ]
});

// With pagination and sorting
const page = await db.query('users',
  { status: 'active' },
  {
    limit: 50,
    offset: 100,
    sort: { name: 1 }
  }
);
```

##### `analyzeQuery(storeName, filters?, options?): Promise<Object>`

Analyzes a query without executing it to understand performance characteristics.

**Parameters:**
- `storeName` (string): Name of the object store
- `filters` (object, optional): Query filter criteria
- `options` (object, optional): Query options

**Returns:** Promise resolving to analysis object

**Analysis Object:**
```javascript
{
  canUseIndex: true,           // Whether query can use an index
  indexName: "email",          // Index being used
  keyRange: IDBKeyRange,       // Key range for index query
  postFilters: {},             // Filters requiring post-processing
  compoundFilters: null,       // Compound filter object
  estimatedCost: 5,            // Performance cost estimate
  optimizationNotes: [         // Optimization suggestions
    "Using index 'email' for field 'email'"
  ]
}
```

**Example:**
```javascript
const analysis = await db.analyzeQuery('users', { email: 'john@example.com' });
console.log(`Estimated cost: ${analysis.estimatedCost}`);
console.log(`Can use index: ${analysis.canUseIndex}`);
```

#### Bulk Operations

##### `bulk(storeName, operations): Promise<Array>`

Executes multiple operations in a single transaction.

**Parameters:**
- `storeName` (string): Name of the object store
- `operations` (Array): Array of operation objects

**Operation Types:**
```javascript
// Create operation
{ type: 'create', data: { name: 'John', email: 'john@example.com' } }

// Update operation
{ type: 'update', id: 1, data: { status: 'active' } }

// Delete operation
{ type: 'delete', id: 1 }
```

**Returns:** Promise resolving to array of operation results

**Throws:**
- `Error` - If database is not open
- `TransactionError` - If any operation fails

**Example:**
```javascript
const operations = [
  { type: 'create', data: { name: 'Alice', email: 'alice@example.com' } },
  { type: 'create', data: { name: 'Bob', email: 'bob@example.com' } },
  { type: 'update', id: 1, data: { status: 'premium' } },
  { type: 'delete', id: 2 }
];

const results = await db.bulk('users', operations);
// results = [1, 2, undefined, undefined] (keys for creates, undefined for updates/deletes)
```

## Query Operators

### Comparison Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `$eq` | Equal to | `{ age: { $eq: 25 } }` |
| `$ne` | Not equal to | `{ status: { $ne: 'inactive' } }` |
| `$gt` | Greater than | `{ age: { $gt: 18 } }` |
| `$gte` | Greater than or equal | `{ score: { $gte: 90 } }` |
| `$lt` | Less than | `{ age: { $lt: 65 } }` |
| `$lte` | Less than or equal | `{ rating: { $lte: 5 } }` |
| `$regex` | Regular expression match | `{ email: { $regex: '@company\\.com$' } }` |

### Logical Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `$and` | Logical AND | `{ $and: [filter1, filter2] }` |
| `$or` | Logical OR | `{ $or: [filter1, filter2] }` |

### Examples

```javascript
// Simple equality
{ status: 'active' }

// Range query
{ age: { $gte: 18, $lt: 65 } }

// Regex match
{ email: { $regex: '^admin' } }

// Compound AND
{
  $and: [
    { age: { $gte: 18 } },
    { status: 'active' },
    { role: { $ne: 'banned' } }
  ]
}

// Compound OR
{
  $or: [
    { status: 'premium' },
    { subscription: { $gt: 100 } }
  ]
}

// Complex nested query
{
  $and: [
    { age: { $gte: 18 } },
    {
      $or: [
        { status: 'active' },
        { subscription: { $gt: 50 } }
      ]
    }
  ]
}
```

## Error Types

### IDBError (Base Class)

All errors extend from IDBError.

**Properties:**
- `message` (string): Error description
- `originalError` (Error, optional): Original error that caused this error

### ConnectionError

Thrown when database connection fails.

**Common Causes:**
- IndexedDB not supported in browser
- Database version conflicts
- Storage quota exceeded

### SchemaError

Thrown when schema validation fails.

**Common Causes:**
- Invalid schema structure
- Missing required fields
- Invalid index configuration

### MigrationError

Thrown when schema migration fails.

**Common Causes:**
- Migration function errors
- Incompatible schema changes
- Data corruption during migration

### TransactionError

Thrown when database transaction fails.

**Common Causes:**
- Constraint violations
- Storage quota exceeded
- Transaction conflicts
- Invalid operations

### Error Handling Example

```javascript
try {
  await db.create('users', userData);
} catch (error) {
  switch (error.constructor) {
    case ConnectionError:
      // Handle connection issues
      break;
    case SchemaError:
      // Handle schema validation errors
      break;
    case TransactionError:
      // Handle transaction failures
      break;
    default:
      // Handle unexpected errors
      break;
  }
}
```

## Schema Definition

### Schema Structure

```javascript
const schema = {
  stores: {
    storeName: {
      keyPath: 'id',              // Primary key field (string or array)
      autoIncrement: true,        // Auto-generate keys (boolean)
      indexes: {                  // Index definitions
        indexName: {
          keyPath: 'field',       // Indexed field (string or array)
          unique: false           // Uniqueness constraint (boolean)
        }
      }
    }
  }
};
```

### Key Path Types

```javascript
// Single field key
{
  keyPath: 'id',
  autoIncrement: true
}

// Compound key
{
  keyPath: ['type', 'id'],
  autoIncrement: false
}

// No auto key (manual key specification)
{
  keyPath: 'id',
  autoIncrement: false
}
```

### Index Types

```javascript
// Single field index
indexes: {
  email: {
    keyPath: 'email',
    unique: true
  }
}

// Compound index
indexes: {
  'name-email': {
    keyPath: ['name', 'email'],
    unique: false
  }
}
```

## Migration Functions

Migration functions are called during database upgrades.

**Signature:**
```javascript
(db: IDBDatabase, transaction: IDBTransaction) => void
```

**Parameters:**
- `db`: Raw IDBDatabase instance
- `transaction`: Active upgrade transaction

**Example:**
```javascript
const migrations = [
  // Version 1 -> 2
  (db, transaction) => {
    // Add new object store
    db.createObjectStore('posts', {
      keyPath: 'id',
      autoIncrement: true
    });
  },

  // Version 2 -> 3
  (db, transaction) => {
    // Add index to existing store
    const usersStore = transaction.objectStore('users');
    usersStore.createIndex('email', 'email', { unique: true });
  },

  // Version 3 -> 4
  (db, transaction) => {
    // Transform data
    const usersStore = transaction.objectStore('users');
    const cursorRequest = usersStore.openCursor();

    cursorRequest.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const user = cursor.value;
        // Transform user data
        user.lastModified = new Date();
        cursor.update(user);
        cursor.continue();
      }
    };
  }
];
```

## Type Definitions (TypeScript)

```typescript
interface DBSchema {
  stores: Record<string, StoreSchema>;
}

interface StoreSchema {
  keyPath: string | string[];
  autoIncrement?: boolean;
  indexes?: Record<string, IndexSchema>;
}

interface IndexSchema {
  keyPath: string | string[];
  unique?: boolean;
}

type QueryFilter<T> = {
  [K in keyof T]?: T[K] | QueryOperator<T[K]>;
};

type QueryOperator<T> = {
  $eq?: T;
  $ne?: T;
  $gt?: T;
  $gte?: T;
  $lt?: T;
  $lte?: T;
  $regex?: string;
};

type QueryOptions = {
  limit?: number;
  offset?: number;
  sort?: Record<string, 1 | -1>;
};

type BulkOperation =
  | { type: 'create'; data: any }
  | { type: 'update'; id: any; data: any }
  | { type: 'delete'; id: any };

interface QueryAnalysis {
  canUseIndex: boolean;
  indexName?: string;
  keyRange?: IDBKeyRange;
  postFilters: Record<string, any>;
  compoundFilters: any;
  estimatedCost: number;
  optimizationNotes: string[];
}

class IDBWrapper<Schema extends DBSchema = any> {
  constructor(dbName: string, version: number, schema: Schema, migrations?: MigrationFunction[]);
  open(): Promise<IDBDatabase>;
  close(): void;
  isOpen(): boolean;
  getDatabase(): IDBDatabase | null;

  create<StoreName extends keyof Schema['stores']>(
    storeName: StoreName,
    data: any
  ): Promise<IDBValidKey>;

  read<StoreName extends keyof Schema['stores']>(
    storeName: StoreName,
    key: any
  ): Promise<any>;

  update<StoreName extends keyof Schema['stores']>(
    storeName: StoreName,
    key: any,
    data: any
  ): Promise<void>;

  delete<StoreName extends keyof Schema['stores']>(
    storeName: StoreName,
    key: any
  ): Promise<void>;

  query<StoreName extends keyof Schema['stores']>(
    storeName: StoreName,
    filters?: QueryFilter<any>,
    options?: QueryOptions
  ): Promise<any[]>;

  analyzeQuery<StoreName extends keyof Schema['stores']>(
    storeName: StoreName,
    filters?: QueryFilter<any>,
    options?: QueryOptions
  ): Promise<QueryAnalysis>;

  bulk<StoreName extends keyof Schema['stores']>(
    storeName: StoreName,
    operations: BulkOperation[]
  ): Promise<any[]>;
}
```

This comprehensive API reference covers all functionality. For examples and guides, see the main README.md.