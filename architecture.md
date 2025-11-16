# Internal Architecture

## Module Structure

```
src/
├── index.js          # Main export
├── IDBWrapper.js     # Main wrapper class
├── ConnectionManager.js  # Database connection handling
├── SchemaManager.js     # Schema validation and management
├── TransactionManager.js # Transaction handling
├── QueryEngine.js       # Advanced querying logic
├── MigrationManager.js  # Schema migration handling
├── ErrorHandler.js      # Custom error classes and handling
└── utils.js             # Utility functions
```

## Core Components

### IDBWrapper
- Public API facade
- Delegates to specialized managers
- Maintains connection state

### ConnectionManager
- Manages IndexedDB open/close operations
- Handles version upgrades
- Caches database instances

### SchemaManager
- Validates schema definitions
- Creates object stores and indexes
- Ensures schema consistency

### TransactionManager
- Wraps IndexedDB transactions
- Provides promise-based interface
- Handles transaction lifecycle

### QueryEngine
- Implements advanced query logic
- Supports filtering, sorting, pagination
- Optimizes queries using indexes

### MigrationManager
- Handles schema version changes
- Executes migration functions
- Manages backward compatibility

### ErrorHandler
- Defines custom error classes
- Provides meaningful error messages
- Handles IndexedDB-specific errors

## Data Flow

1. **Initialization**
   - IDBWrapper constructor receives config
   - SchemaManager validates schema
   - ConnectionManager opens database

2. **Operation Execution**
   - IDBWrapper receives API call
   - TransactionManager creates transaction
   - QueryEngine processes query if needed
   - Operation executes on appropriate object store

3. **Error Handling**
   - Errors bubble up through managers
   - ErrorHandler converts to custom errors
   - Promises reject with meaningful messages

4. **Cleanup**
   - ConnectionManager handles connection closing
   - Resources are properly released

## Key Design Decisions

- **Modular**: Each concern separated into its own module
- **Promise-based**: All async operations return promises
- **Lazy loading**: Database opens only when needed
- **Error wrapping**: Native errors converted to custom types
- **Schema-first**: Operations validate against defined schema