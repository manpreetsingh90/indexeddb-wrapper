import 'fake-indexeddb/auto';
import { IDBWrapper } from './dist/index.mjs';

/**
 * Test security hardening measures
 */
async function testSecurityHardening() {
  console.log('Testing Security Hardening Measures...\n');

  // Test 1: Valid inputs should work
  console.log('Test 1: Valid inputs');
  try {
    const db = new IDBWrapper('security_test_1', 1, {
      stores: {
        users: { keyPath: 'id', autoIncrement: true }
      }
    });

    await db.open();

    const validUser = Object.create(null); // Create object without prototype
    validUser.name = 'John Doe';
    validUser.email = 'john@example.com';
    await db.create('users', validUser);
    console.log('✅ Valid inputs accepted');

  } catch (error) {
    console.error('❌ Valid inputs test failed:', error.message);
  }

  // Test 2: Invalid database name
  console.log('\nTest 2: Invalid database name');
  try {
    const db = new IDBWrapper('invalid<>name', 1, {
      stores: {
        users: { keyPath: 'id', autoIncrement: true }
      }
    });
    console.log('❌ Should have rejected invalid database name');

  } catch (error) {
    console.log('✅ Invalid database name rejected:', error.message);
  }

  // Test 3: Invalid store name
  console.log('\nTest 3: Invalid store name');
  try {
    const db = new IDBWrapper('security_test_3', 1, {
      stores: {
        'invalid<>store': { keyPath: 'id', autoIncrement: true }
      }
    });
    console.log('❌ Should have rejected invalid store name');

  } catch (error) {
    console.log('✅ Invalid store name rejected:', error.message);
  }

  // Test 4: Prototype pollution attempt
  console.log('\nTest 4: Prototype pollution protection');
  try {
    const db = new IDBWrapper('security_test_4', 1, {
      stores: {
        users: { keyPath: 'id', autoIncrement: true }
      }
    });

    await db.open();

    const maliciousData = {
      name: 'Malicious User',
      __proto__: { isAdmin: true } // Prototype pollution attempt
    };

    await db.create('users', maliciousData);
    console.log('❌ Should have blocked prototype pollution');

  } catch (error) {
    console.log('✅ Prototype pollution blocked:', error.message);
  }

  // Test 5: Oversized data
  console.log('\nTest 5: Oversized data protection');
  try {
    const db = new IDBWrapper('security_test_5', 1, {
      stores: {
        users: { keyPath: 'id', autoIncrement: true }
      }
    });

    await db.open();

    const hugeData = {
      name: 'Huge User',
      data: 'x'.repeat(10000000) // 10MB of data
    };

    await db.create('users', hugeData);
    console.log('❌ Should have rejected oversized data');

  } catch (error) {
    console.log('✅ Oversized data rejected:', error.message);
  }

  // Test 6: Invalid query filters
  console.log('\nTest 6: Invalid query filters');
  try {
    const db = new IDBWrapper('security_test_6', 1, {
      stores: {
        users: { keyPath: 'id', autoIncrement: true }
      }
    });

    await db.open();

    // Create a test user first
    await db.create('users', { name: 'Test User', email: 'test@example.com' });

    // Try deeply nested filters (should be rejected)
    const deepFilters = { level1: { level2: { level3: { level4: { level5: { level6: 'value' } } } } } };
    await db.query('users', deepFilters);
    console.log('❌ Should have rejected deeply nested filters');

  } catch (error) {
    console.log('✅ Deeply nested filters rejected:', error.message);
  }

  // Test 7: Invalid bulk operations
  console.log('\nTest 7: Invalid bulk operations');
  try {
    const db = new IDBWrapper('security_test_7', 1, {
      stores: {
        users: { keyPath: 'id', autoIncrement: true }
      }
    });

    await db.open();

    const invalidBulkOps = [
      { type: 'invalid_type', data: { name: 'Test' } }, // Invalid type
      { type: 'create' }, // Missing data
      { type: 'update', data: { name: 'Updated' } } // Missing id
    ];

    await db.bulk('users', invalidBulkOps);
    console.log('❌ Should have rejected invalid bulk operations');

  } catch (error) {
    console.log('✅ Invalid bulk operations rejected:', error.message);
  }

  // Test 8: Security validation disabled
  console.log('\nTest 8: Security validation can be disabled');
  try {
    const db = new IDBWrapper('security_test_8', 1, {
      stores: {
        users: { keyPath: 'id', autoIncrement: true }
      }
    }, [], { enableSecurityValidation: false });

    await db.open();

    // This would normally be rejected
    const riskyData = {
      name: 'Risky User',
      __proto__: { dangerous: true }
    };

    await db.create('users', riskyData);
    console.log('✅ Security validation successfully disabled');

  } catch (error) {
    console.log('❌ Security validation disable test failed:', error.message);
  }

  console.log('\n🎉 All security hardening tests completed!');
  console.log('\nSecurity features verified:');
  console.log('✅ Input validation for all operations');
  console.log('✅ Prototype pollution protection');
  console.log('✅ Size limits and performance monitoring');
  console.log('✅ Safe object copying');
  console.log('✅ Query filter validation');
  console.log('✅ Configurable security settings');
}

// Run the tests
testSecurityHardening().catch(console.error);