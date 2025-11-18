import 'fake-indexeddb/auto';
import { IDBWrapper } from './dist/index.mjs';

/**
 * Simple performance benchmark for the optimized QueryEngine
 */
async function runPerformanceBenchmark() {
  console.log('Running QueryEngine Performance Benchmark...\n');

  const schema = {
    stores: {
      users: {
        keyPath: 'id',
        autoIncrement: true,
        indexes: {
          email: { unique: true },
          age: { unique: false },
          status: { unique: false }
        }
      }
    }
  };

  const db = new IDBWrapper('benchmark-db', 1, schema);
  await db.open();

  // Create test data
  console.log('Creating test data...');
  const testUsers = [];
  for (let i = 0; i < 1000; i++) {
    testUsers.push({
      name: `User ${i}`,
      email: `user${i}@example.com`,
      age: Math.floor(Math.random() * 80) + 18,
      status: Math.random() > 0.5 ? 'active' : 'inactive'
    });
  }

  // Bulk insert
  const bulkOps = testUsers.map(user => ({ type: 'create', data: user }));
  await db.bulk('users', bulkOps);
  console.log('Inserted 1000 test users\n');

  // Benchmark different query types
  const benchmarks = [
    {
      name: 'Index Query (email)',
      query: () => db.query('users', { email: 'user500@example.com' })
    },
    {
      name: 'Range Query (age)',
      query: () => db.query('users', { age: { $gte: 30, $lt: 50 } })
    },
    {
      name: 'Compound Query ($and)',
      query: () => db.query('users', {
        $and: [
          { age: { $gte: 25 } },
          { status: 'active' }
        ]
      })
    },
    {
      name: 'Full Scan (no filters)',
      query: () => db.query('users', {})
    },
    {
      name: 'Paginated Query',
      query: () => db.query('users', {}, { limit: 50, offset: 100 })
    }
  ];

  for (const benchmark of benchmarks) {
    const times = [];

    // Run each query 10 times
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      const results = await benchmark.query();
      const end = performance.now();
      times.push(end - start);
    }

    const avgTime = times.reduce((a, b) => a + b) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    console.log(`${benchmark.name}:`);
    console.log(`  Average: ${avgTime.toFixed(2)}ms`);
    console.log(`  Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
  }

  // Query analysis examples
  console.log('\nQuery Analysis Examples:');
  const analysis1 = await db.analyzeQuery('users', { email: 'user500@example.com' });
  console.log('Email index query cost:', analysis1.estimatedCost);

  const analysis2 = await db.analyzeQuery('users', { name: 'User 500' });
  console.log('Name scan query cost:', analysis2.estimatedCost);

  await db.close();
  console.log('\nBenchmark completed!');
}

// Run benchmark
runPerformanceBenchmark().catch(console.error);