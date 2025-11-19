import 'fake-indexeddb/auto';
import { IDBWrapper } from './dist/index.mjs';

/**
 * Test safe migration system with rollback capabilities
 */
async function testSafeMigrations() {
  console.log('Testing Safe Migration System...\n');

  // Test 1: Basic migration with rollback
  console.log('Test 1: Basic migration with rollback');
  try {
    const migrations = [
      {
        id: 'add_users_table',
        version: 2,
        up: async (db, transaction) => {
          // Simulate creating a users table
          console.log('  Creating users table...');
          // In real scenario, this would create object stores
        },
        rollback: async (db, transaction) => {
          console.log('  Rolling back users table...');
          // Rollback logic would go here
        }
      },
      {
        id: 'add_email_index',
        version: 3,
        up: async (db, transaction) => {
          console.log('  Creating email index...');
          // Index creation logic
        },
        rollback: async (db, transaction) => {
          console.log('  Rolling back email index...');
          // Rollback index creation
        }
      }
    ];

    // Test with version 1 -> 3
    const db = new IDBWrapper('migration-test', 3, {
      stores: {
        users: { keyPath: 'id', autoIncrement: true }
      }
    }, migrations);

    await db.open();
    console.log('✅ Database opened with migrations');

    await db.close();

  } catch (error) {
    console.error('❌ Migration test failed:', error.message);
  }

  // Test 2: Migration failure and rollback
  console.log('\nTest 2: Migration failure and rollback');
  try {
    const failingMigrations = [
      {
        id: 'failing_migration',
        version: 2,
        up: async (db, transaction) => {
          console.log('  Starting failing migration...');
          throw new Error('Simulated migration failure');
        },
        rollback: async (db, transaction) => {
          console.log('  Executing rollback...');
          // Rollback would clean up any partial changes
        }
      }
    ];

    const db = new IDBWrapper('migration-fail-test', 2, {
      stores: {
        test: { keyPath: 'id' }
      }
    }, failingMigrations);

    try {
      await db.open();
    } catch (error) {
      if (error.name === 'MigrationError') {
        console.log('✅ Migration failure properly caught');
        console.log('   Error type:', error.name);
        console.log('   Error code:', error.code);
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error in migration failure test:', error);
  }

  // Test 3: Checkpointed migration (simulated)
  console.log('\nTest 3: Checkpointed migration simulation');
  try {
    let processedItems = 0;
    const checkpointedMigrations = [
      {
        id: 'large_data_migration',
        version: 2,
        checkpointed: true,
        batchSize: 10,
        up: async (db, checkpoint, batchSize) => {
          console.log(`  Processing batch starting at ${checkpoint}`);

          // Simulate processing items in batches
          const itemsToProcess = Math.min(batchSize, 25 - checkpoint);
          processedItems += itemsToProcess;

          if (processedItems >= 25) {
            console.log('  Migration completed');
            return { completed: true };
          } else {
            console.log(`  Processed ${processedItems}/25 items`);
            return {
              completed: false,
              nextCheckpoint: checkpoint + itemsToProcess
            };
          }
        },
        rollback: async (db, transaction) => {
          console.log('  Rolling back large data migration...');
          processedItems = 0;
        }
      }
    ];

    const db = new IDBWrapper('checkpoint-test', 2, {
      stores: {
        data: { keyPath: 'id' }
      }
    }, checkpointedMigrations);

    await db.open();
    console.log('✅ Checkpointed migration completed');

    await db.close();

  } catch (error) {
    console.error('❌ Checkpointed migration test failed:', error.message);
  }

  // Test 4: Legacy migration compatibility
  console.log('\nTest 4: Legacy migration compatibility');
  try {
    // Old-style function migrations
    const legacyMigrations = [
      (db, transaction) => {
        console.log('  Legacy migration 1->2 executed');
      },
      (db, transaction) => {
        console.log('  Legacy migration 2->3 executed');
      }
    ];

    const db = new IDBWrapper('legacy-test', 3, {
      stores: {
        legacy: { keyPath: 'id' }
      }
    }, legacyMigrations);

    await db.open();
    console.log('✅ Legacy migrations work with new system');

    await db.close();

  } catch (error) {
    console.error('❌ Legacy migration test failed:', error.message);
  }

  console.log('\n🎉 All safe migration tests completed!');
}

// Run the tests
testSafeMigrations().catch(console.error);