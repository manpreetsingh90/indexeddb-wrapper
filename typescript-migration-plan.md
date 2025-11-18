# TypeScript Migration Plan

## Benefits of TypeScript Migration

### Developer Experience
- **Type Safety**: Catch errors at compile time
- **IntelliSense**: Better IDE support and autocomplete
- **Documentation**: Types serve as living documentation
- **Refactoring**: Safer code changes with type checking

### Large-Scale Usage Benefits
- **Schema Type Safety**: Typed database schemas prevent runtime errors
- **Query Type Safety**: Type-checked query parameters and results
- **API Reliability**: Strongly typed public APIs
- **Maintenance**: Easier to maintain and extend codebase

## Migration Strategy

### Phase 1: Infrastructure Setup
1. **Install TypeScript**: Add to devDependencies
2. **Configure tsconfig.json**: Strict settings for large-scale code
3. **Build Pipeline**: Update Rollup for TypeScript compilation
4. **Type Definitions**: Add @types packages for dependencies

### Phase 2: Core Types Definition
```typescript
// Core database types
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

// Query types
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
  // ... more operators
};
```

### Phase 3: Gradual Migration
1. **Rename Files**: .js → .ts (maintain compatibility)
2. **Add Type Annotations**: Start with core classes
3. **Generic Types**: Make IDBWrapper generic over schema type
4. **Test Compatibility**: Ensure existing JavaScript code still works

### Phase 4: Advanced Type Features
```typescript
// Schema-aware wrapper
class IDBWrapper<Schema extends DBSchema> {
  constructor(dbName: string, version: number, schema: Schema) {}

  async create<StoreName extends keyof Schema>(
    storeName: StoreName,
    data: Omit<Schema[StoreName]['data'], 'id'>
  ): Promise<IDBValidKey> {}

  async query<StoreName extends keyof Schema>(
    storeName: StoreName,
    filters: QueryFilter<Schema[StoreName]['data']>
  ): Promise<Schema[StoreName]['data'][]> {}
}
```

## Type Definition Strategy

### External API Types
- **Public Methods**: Fully typed with generics
- **Options Objects**: Interface definitions for configuration
- **Callback Types**: Properly typed async operations

### Internal Implementation Types
- **Database Objects**: Typed IDBDatabase, IDBTransaction, etc.
- **Cursor Types**: Generic cursor operations
- **Error Types**: Discriminated unions for error handling

## Build and Distribution

### Dual Package Strategy
- **ESM + CJS**: Support both module systems
- **Type Declarations**: Include .d.ts files
- **Source Maps**: For debugging TypeScript in browsers

### Rollup Configuration Updates
```javascript
// rollup.config.js
import typescript from '@rollup/plugin-typescript';

export default {
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist/types'
    })
  ]
};
```

## Testing Type Safety
- **Type Tests**: Use `tsd` or similar for API type testing
- **Migration Tests**: Ensure JavaScript consumers still work
- **Generic Tests**: Verify type inference works correctly

## Developer Onboarding
- **TypeScript Guide**: Migration documentation
- **Type Definition Examples**: Common usage patterns
- **IDE Setup**: Recommended VSCode extensions and settings

## Compatibility Considerations
- **JavaScript Consumers**: Maintain backward compatibility
- **Browser Support**: Ensure TypeScript output works in target browsers
- **Bundle Size**: Monitor impact on final bundle size

## Timeline and Milestones
1. **Week 1-2**: Infrastructure and core types
2. **Week 3-4**: Migrate core classes (IDBWrapper, managers)
3. **Week 5-6**: Advanced types and generics
4. **Week 7-8**: Testing and documentation
5. **Week 9-10**: Final validation and release