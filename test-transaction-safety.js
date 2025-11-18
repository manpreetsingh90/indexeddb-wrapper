import 'fake-indexeddb/auto';
import { IDBWrapper } from './dist/index.mjs';

/**
 * Test transaction safety improvements
 */
async function testTransactionSafety() {
  console.log('Testing Transaction Safety Improvements...\n');

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

  const db = new IDBWrapper('safety-test', 1, schema);
  await db.open();

  console.log('✅ Database opened');

  // Test 1: Safe transaction with proper async handling
  try {
    const result = await db.withTransaction(['users'], 'readwrite', async (txn) => {
      const store = txn.objectStore('users');

      // This should work fine - proper async handling
      const user1 = await store.add({ name: 'Alice', email: 'alice@example.com' });
      const user2 = await store.add({ name: 'Bob', email: 'bob@example.com' });

      return [user1, user2];
    });

    console.log('✅ Safe transaction completed:', result);
  } catch (error) {
    console.error('❌ Safe transaction failed:', error.message);
  }

  // Test 2: Error handling with structured error codes
  try {
    await db.create('users', { name: 'Charlie', email: 'alice@example.com' }); // Duplicate email
  } catch (error) {
    console.log('✅ Proper error handling - Constraint violation detected');
    console.log('   Error code:', error.code || 'No code');
    console.log('   Error name:', error.name);
  }

  // Test 3: Transaction timeout
  try {
    await db.withTransaction(['users'], 'readwrite', async (txn) => {
      // Simulate long operation that exceeds timeout
      await new Promise(resolve => setTimeout(resolve, 200));
      return 'completed';
    }, { timeout: 100 });
  } catch (error) {
    if (error.name === 'TransactionTimeoutError') {
      console.log('✅ Transaction timeout properly detected');
      console.log('   Timeout value:', error.timeout + 'ms');
    } else {
      console.error('❌ Unexpected timeout error:', error.message);
    }
  }

  // Test 4: Safe bulk operations
  try {
    const operations = [
      { type: 'create', data: { name: 'Dave', email: 'dave@example.com' } },
      { type: 'create', data: { name: 'Eve', email: 'eve@example.com' } }
    ];

    const results = await db.safeBulk('users', operations);
    console.log('✅ Safe bulk operations completed:', results);
  } catch (error) {
    console.error('❌ Safe bulk failed:', error.message);
  }

  await db.close();
  console.log('\n🎉 All transaction safety tests completed!');
}

// Run the tests
testTransactionSafety().catch(console.error);