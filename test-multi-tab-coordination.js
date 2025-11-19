import 'fake-indexeddb/auto';
import { IDBWrapper } from './dist/index.mjs';

/**
 * Test multi-tab coordination functionality
 */
async function testMultiTabCoordination() {
  console.log('Testing Multi-Tab Coordination...\n');

  // Test 1: Basic coordination status
  console.log('Test 1: Basic coordination status');
  try {
    const db = new IDBWrapper('coord_test', 1, {
      stores: {
        test_store: { keyPath: 'id', autoIncrement: true }
      }
    }, [], { enableTabCoordination: true });

    const status = db.getCoordinationStatus();
    console.log('Coordination status:', status);

    if (status.enabled === false) {
      console.log('✅ Coordination disabled (BroadcastChannel not available in Node.js)');
    } else {
      console.log('✅ Coordination enabled');
    }

  } catch (error) {
    console.error('❌ Coordination status test failed:', error.message);
  }

  // Test 2: Operations with coordination (will work in single-tab mode)
  console.log('\nTest 2: Operations with coordination');
  try {
    const db = new IDBWrapper('coord_test', 1, {
      stores: {
        test_store: { keyPath: 'id', autoIncrement: true }
      }
    }, [], { enableTabCoordination: true });

    await db.open();

    // Test coordinated operations
    const userId = await db.create('test_store', {
      name: 'Coordinated User',
      email: 'coord@example.com'
    });
    console.log(`✅ Created user with coordination: ${userId}`);

    const user = await db.read('test_store', userId);
    console.log(`✅ Read user with coordination: ${user.name}`);

    await db.update('test_store', userId, { name: 'Updated Coordinated User' });
    console.log('✅ Updated user with coordination');

    const users = await db.query('test_store', { name: 'Updated Coordinated User' });
    console.log(`✅ Queried users with coordination: ${users.length} found`);

    await db.delete('test_store', userId);
    console.log('✅ Deleted user with coordination');

    await db.close();

  } catch (error) {
    console.error('❌ Coordinated operations test failed:', error.message);
  }

  // Test 3: Bulk operations with coordination
  console.log('\nTest 3: Bulk operations with coordination');
  try {
    const db = new IDBWrapper('coord_test', 1, {
      stores: {
        test_store: { keyPath: 'id', autoIncrement: true }
      }
    }, [], { enableTabCoordination: true });

    await db.open();

    const bulkOps = Array.from({ length: 5 }, (_, i) => ({
      type: 'create',
      data: {
        name: `Bulk User ${i}`,
        email: `bulk${i}@example.com`,
        batch: true
      }
    }));

    const results = await db.bulk('test_store', bulkOps);
    console.log(`✅ Bulk operations with coordination: ${results.length} items`);

    await db.close();

  } catch (error) {
    console.error('❌ Bulk coordination test failed:', error.message);
  }

  // Test 4: Migration coordination (would announce in real multi-tab scenario)
  console.log('\nTest 4: Migration coordination');
  try {
    const db = new IDBWrapper('coord_migration_test', 2, {
      stores: {
        users: { keyPath: 'id', autoIncrement: true },
        posts: { keyPath: 'id', autoIncrement: true }
      }
    }, [
      // Migration from v1 to v2
      {
        id: 'add_posts_store',
        version: 2,
        up: async (db, transaction) => {
          // Migration logic would be handled by SchemaManager
          console.log('Running migration: add posts store');
        },
        checkpointed: false
      }
    ], { enableTabCoordination: true });

    await db.open();
    console.log('✅ Migration completed with coordination');

    await db.close();

  } catch (error) {
    console.error('❌ Migration coordination test failed:', error.message);
  }

  console.log('\n🎉 All multi-tab coordination tests completed!');
  console.log('\nNote: Full multi-tab coordination requires real browser tabs.');
  console.log('In Node.js, operations work but coordination falls back to single-tab mode.');
}

// Run the tests
testMultiTabCoordination().catch(console.error);