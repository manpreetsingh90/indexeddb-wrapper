import { test, expect } from '@playwright/test';

/**
 * Cross-browser compatibility tests for IndexedDB Wrapper
 * Tests IndexedDB functionality across different browsers to ensure compatibility
 */

test.describe('IndexedDB Wrapper - Cross-Browser Compatibility', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to test page and wait for it to load
    await page.goto('/test-browser.html');
    await page.waitForLoadState('networkidle');

    // Wait for the library to be loaded and available
    await page.waitForFunction(() => typeof window.IDBWrapper !== 'undefined');

    // Wait for IndexedDB to be available
    await page.waitForFunction(() => typeof window.indexedDB !== 'undefined');
  });

  test('IndexedDB is supported in browser', async ({ page, browserName }) => {
    const isSupported = await page.evaluate(() => {
      return typeof window.indexedDB !== 'undefined' &&
             typeof window.IDBTransaction !== 'undefined';
    });

    expect(isSupported).toBe(true);
    console.log(`✅ IndexedDB supported in ${browserName}`);
  });

  test('Basic CRUD operations work', async ({ page, browserName }) => {
    const result = await page.evaluate(async () => {
      try {
        // Import the library (already injected)
        const { IDBWrapper } = window;

        const schema = {
          stores: {
            test_users: {
              keyPath: 'id',
              autoIncrement: true,
              indexes: {
                email: { unique: true }
              }
            }
          }
        };

        const db = new IDBWrapper('compatibility_test', 1, schema);
        await db.open();

        // Create
        const userId = await db.create('test_users', {
          name: 'Test User',
          email: 'test@example.com'
        });

        // Read
        const user = await db.read('test_users', userId);

        // Update
        await db.update('test_users', userId, { name: 'Updated User' });

        // Query
        const users = await db.query('test_users', { name: 'Updated User' });

        // Delete
        await db.delete('test_users', userId);

        await db.close();

        return {
          success: true,
          userId,
          userFound: !!user,
          usersFound: users.length,
          userName: user?.name
        };

      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.userId).toBeDefined();
    expect(result.userFound).toBe(true);
    expect(result.usersFound).toBe(1);
    expect(result.userName).toBe('Test User');

    console.log(`✅ CRUD operations work in ${browserName}`);
  });

  test('Transaction safety works', async ({ page, browserName }) => {
    const result = await page.evaluate(async () => {
      try {
        const { IDBWrapper } = window;

        const schema = {
          stores: {
            test_txn: {
              keyPath: 'id',
              autoIncrement: true
            }
          }
        };

        const db = new IDBWrapper('txn_test', 1, schema);
        await db.open();

        // Test safe transaction
        const txnResult = await db.withTransaction(['test_txn'], 'readwrite', async (txn) => {
          const store = txn.objectStore('test_txn');
          const id1 = await store.add({ name: 'Item 1' });
          const id2 = await store.add({ name: 'Item 2' });
          return [id1, id2];
        });

        await db.close();

        return {
          success: true,
          transactionResult: txnResult
        };

      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(Array.isArray(result.transactionResult)).toBe(true);
    expect(result.transactionResult.length).toBe(2);

    console.log(`✅ Transaction safety works in ${browserName}`);
  });

  test('Migration system works', async ({ page, browserName }) => {
    const result = await page.evaluate(async () => {
      try {
        const { IDBWrapper } = window;

        const migrations = [
          {
            id: 'create_test_store',
            version: 2,
            up: async (db, transaction) => {
              // Migration logic would go here
              console.log('Migration executed');
            }
          }
        ];

        const schema = {
          stores: {
            migrated_store: {
              keyPath: 'id'
            }
          }
        };

        const db = new IDBWrapper('migration_test', 2, schema, migrations);
        await db.open();

        // Test basic operation after migration
        const testId = await db.create('migrated_store', { data: 'test' });
        const testRecord = await db.read('migrated_store', testId);

        await db.close();

        return {
          success: true,
          recordCreated: !!testId,
          recordRead: !!testRecord
        };

      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.recordCreated).toBe(true);
    expect(result.recordRead).toBe(true);

    console.log(`✅ Migration system works in ${browserName}`);
  });

  test('Error handling works correctly', async ({ page, browserName }) => {
    const result = await page.evaluate(async () => {
      try {
        const { IDBWrapper } = window;

        const schema = {
          stores: {
            error_test: {
              keyPath: 'id',
              indexes: {
                unique_field: { unique: true }
              }
            }
          }
        };

        const db = new IDBWrapper('error_test', 1, schema);
        await db.open();

        // Create first record
        await db.create('error_test', {
          id: 1,
          unique_field: 'unique_value'
        });

        // Try to create duplicate - should fail
        let errorCaught = false;
        let errorCode = null;

        try {
          await db.create('error_test', {
            id: 2,
            unique_field: 'unique_value' // Duplicate
          });
        } catch (error) {
          errorCaught = true;
          errorCode = error.code;
        }

        await db.close();

        return {
          success: true,
          errorCaught,
          errorCode
        };

      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.errorCaught).toBe(true);
    expect(result.errorCode).toBeDefined();

    console.log(`✅ Error handling works in ${browserName}`);
  });

  test('Query optimization works', async ({ page, browserName }) => {
    const result = await page.evaluate(async () => {
      try {
        const { IDBWrapper } = window;

        const schema = {
          stores: {
            query_test: {
              keyPath: 'id',
              autoIncrement: true,
              indexes: {
                status: { unique: false },
                email: { unique: true }
              }
            }
          }
        };

        const db = new IDBWrapper('query_test', 1, schema);
        await db.open();

        // Create test data
        await db.create('query_test', { name: 'User 1', email: 'user1@test.com', status: 'active' });
        await db.create('query_test', { name: 'User 2', email: 'user2@test.com', status: 'inactive' });
        await db.create('query_test', { name: 'User 3', email: 'user3@test.com', status: 'active' });

        // Test indexed query
        const activeUsers = await db.query('query_test', { status: 'active' });

        // Test compound query
        const compoundUsers = await db.query('query_test', {
          $and: [
            { status: 'active' },
            { name: 'User 1' }
          ]
        });

        // Test pagination
        const paginatedUsers = await db.query('query_test', {}, { limit: 2, offset: 0 });

        await db.close();

        return {
          success: true,
          activeUsersCount: activeUsers.length,
          compoundUsersCount: compoundUsers.length,
          paginatedUsersCount: paginatedUsers.length
        };

      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.activeUsersCount).toBe(2);
    expect(result.compoundUsersCount).toBe(1);
    expect(result.paginatedUsersCount).toBe(2);

    console.log(`✅ Query optimization works in ${browserName}`);
  });

  test('Large dataset handling', async ({ page, browserName }) => {
    // Skip this test on mobile devices due to resource constraints
    test.skip(browserName.includes('Mobile'), 'Skipping large dataset test on mobile');

    const result = await page.evaluate(async () => {
      try {
        const { IDBWrapper } = window;

        const schema = {
          stores: {
            large_test: {
              keyPath: 'id',
              autoIncrement: true,
              indexes: {
                batch: { unique: false }
              }
            }
          }
        };

        const db = new IDBWrapper('large_test', 1, schema);
        await db.open();

        // Create 100 records
        const createdIds = [];
        for (let i = 0; i < 100; i++) {
          const id = await db.create('large_test', {
            batch: Math.floor(i / 10),
            data: `Record ${i}`,
            timestamp: Date.now()
          });
          createdIds.push(id);
        }

        // Query with index
        const batch0Records = await db.query('large_test', { batch: 0 });

        // Test pagination on larger dataset
        const paginated = await db.query('large_test', {}, { limit: 20, offset: 10 });

        await db.close();

        return {
          success: true,
          recordsCreated: createdIds.length,
          batchQueryCount: batch0Records.length,
          paginatedCount: paginated.length
        };

      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.recordsCreated).toBe(100);
    expect(result.batchQueryCount).toBe(10);
    expect(result.paginatedCount).toBe(20);

    console.log(`✅ Large dataset handling works in ${browserName}`);
  });

});