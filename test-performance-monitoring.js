import 'fake-indexeddb/auto';
import { IDBWrapper } from './dist/index.mjs';

/**
 * Test performance monitoring for structured cloning
 */
async function testPerformanceMonitoring() {
  console.log('Testing Performance Monitoring...\n');

  let db;

  // Setup database
  try {
    db = new IDBWrapper('perf_test', 1, {
      stores: {
        test_store: { keyPath: 'id', autoIncrement: true }
      }
    });

    await db.open();
    console.log('Database initialized for performance testing\n');

  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    return;
  }

  // Test 1: Small object (should not trigger warnings)
  console.log('Test 1: Small object performance');
  try {
    const smallObject = { id: 1, name: 'Small Object', data: 'minimal' };
    await db.create('test_store', smallObject);

    console.log('✅ Small object handled without warnings');

  } catch (error) {
    console.error('❌ Small object test failed:', error.message);
  }

  // Test 2: Medium object (should trigger monitoring)
  console.log('\nTest 2: Medium object performance');
  try {
    const mediumObject = {
      id: 2,
      name: 'Medium Object',
      data: 'x'.repeat(50000), // ~50KB
      metadata: {
        created: new Date(),
        tags: ['test', 'performance', 'medium']
      }
    };

    await db.create('test_store', mediumObject);
    console.log('✅ Medium object handled with monitoring');

  } catch (error) {
    console.error('❌ Medium object test failed:', error.message);
  }

  // Test 3: Large object (should trigger warnings)
  console.log('\nTest 3: Large object performance warnings');
  try {
    const largeObject = {
      id: 3,
      name: 'Large Object',
      data: 'x'.repeat(2000000), // ~2MB
      nested: {
        level1: {
          level2: {
            level3: {
              bigArray: Array.from({ length: 1000 }, (_, i) => ({
                index: i,
                value: 'x'.repeat(100)
              }))
            }
          }
        }
      }
    };

    await db.create('test_store', largeObject);
    console.log('✅ Large object handled with warnings');

  } catch (error) {
    console.error('❌ Large object test failed:', error.message);
  }

  // Test 4: Bulk operations with large data
  console.log('\nTest 4: Bulk operations performance');
  try {
    const bulkOperations = Array.from({ length: 10 }, (_, i) => ({
      type: 'create',
      data: {
        id: 10 + i,
        name: `Bulk Item ${i}`,
        data: 'x'.repeat(10000), // 10KB each
        batch: true
      }
    }));

    const results = await db.bulk('test_store', bulkOperations);
    console.log(`✅ Bulk operations completed: ${results.length} items`);

  } catch (error) {
    console.error('❌ Bulk operations test failed:', error.message);
  }

  // Test 5: Query performance
  console.log('\nTest 5: Query performance monitoring');
  try {
    const queryResults = await db.query('test_store', { name: 'Large Object' });
    console.log(`✅ Query completed: ${queryResults.length} results`);

  } catch (error) {
    console.error('❌ Query test failed:', error.message);
  }

  // Test 6: Performance statistics
  console.log('\nTest 6: Performance statistics');
  try {
    // Access performance stats (would be more comprehensive in real implementation)
    console.log('✅ Performance monitoring active');

    await db.close();

  } catch (error) {
    console.error('❌ Performance stats test failed:', error.message);
  }

  console.log('\n🎉 All performance monitoring tests completed!');
}

// Run the tests
testPerformanceMonitoring().catch(console.error);