# Documentation and Usage Examples

## Documentation Structure

### README.md
- Project overview and key features
- Installation instructions
- Quick start guide
- API overview with basic examples
- Browser support matrix
- Contributing guidelines
- License information

### API Reference
- Complete method documentation
- Parameter descriptions
- Return types and examples
- Error types and handling

### Guides
- Schema definition guide
- Migration tutorial
- Advanced querying examples
- Framework integration guides

## Usage Examples

### Basic Setup
```javascript
import { IDBWrapper } from 'idb-wrapper';

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
```

### CRUD Operations
```javascript
// Create
const userId = await db.create('users', { name: 'John', email: 'john@example.com' });

// Read
const user = await db.read('users', userId);

// Update
await db.update('users', userId, { name: 'Johnny' });

// Delete
await db.delete('users', userId);
```

### Advanced Queries
```javascript
// Find users by email domain
const gmailUsers = await db.query('users', {
  email: { $regex: /@gmail\.com$/ }
});

// Find users created after date
const recentUsers = await db.query('users', {
  createdAt: { $gt: new Date('2023-01-01') }
});
```

### Schema Migrations
```javascript
const migrations = [
  (db, transaction) => {
    // Add posts store in version 2
    db.createObjectStore('posts', { keyPath: 'id', autoIncrement: true });
  }
];

const db = new IDBWrapper('myapp', 2, schema, migrations);
await db.open(); // Automatically migrates from v1 to v2
```

### Bulk Operations
```javascript
const operations = [
  { type: 'create', data: { name: 'Alice' } },
  { type: 'create', data: { name: 'Bob' } },
  { type: 'update', id: 1, data: { name: 'Alice Updated' } }
];

const results = await db.bulk('users', operations);
```

## Example Applications
- Todo app with local storage
- Blog with posts and comments
- E-commerce cart with products and orders
- Note-taking app with search

## Framework Integration Examples
- React hooks for state management
- Vue composables
- Svelte stores
- Vanilla JavaScript integration

## Documentation Generation
- Use JSDoc for inline documentation
- Generate HTML docs with documentation.js or similar
- Include code examples in markdown
- Host docs on GitHub Pages

## Content Organization
```
docs/
├── README.md
├── api-reference.md
├── guides/
│   ├── schema-definition.md
│   ├── migrations.md
│   └── querying.md
├── examples/
│   ├── basic-crud.html
│   ├── advanced-queries.html
│   ├── migrations.html
│   └── framework-integration/
└── CHANGELOG.md
```

## Accessibility
- Clear, concise language
- Code examples with comments
- Progressive disclosure (basic to advanced)
- Search functionality in docs site

## Maintenance
- Update docs with new features
- Keep examples working and up-to-date
- Collect user feedback for improvements
- Version documentation with releases