import 'fake-indexeddb/auto';
import { IDBWrapper } from './dist/index.mjs';

async function testRealWorldUsage() {
    try {
        console.log('Initializing database...');

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

        const db = new IDBWrapper('testdb', 1, schema);
        await db.open();

        console.log('Database opened successfully.');

        // Create a user
        const userId = await db.create('users', { name: 'John Doe', email: 'john@example.com' });
        console.log(`Created user with ID: ${userId}`);

        // Read the user
        const user = await db.read('users', userId);
        console.log(`Read user: ${JSON.stringify(user)}`);

        // Update the user
        await db.update('users', userId, { name: 'Johnny Doe', email: 'john@example.com' });
        console.log('User updated.');

        // Query users
        const users = await db.query('users', { name: 'Johnny Doe' });
        console.log(`Query results: ${users.length} users found`);

        // Test compound query
        const compoundUsers = await db.query('users', {
          $and: [
            { name: 'Johnny Doe' },
            { email: 'john@example.com' }
          ]
        });
        console.log(`Compound query results: ${compoundUsers.length} users found`);

        // Test pagination
        const paginatedUsers = await db.query('users', {}, { limit: 2, offset: 0 });
        console.log(`Paginated query results: ${paginatedUsers.length} users found`);

        // Test query analysis
        const analysis = await db.analyzeQuery('users', { email: 'john@example.com' });
        console.log('Query analysis:', JSON.stringify(analysis, null, 2));

        // Test bulk operations
        const bulkOps = [
            { type: 'create', data: { name: 'Jane Doe', email: 'jane@example.com' } },
            { type: 'create', data: { name: 'Bob Smith', email: 'bob@example.com' } }
        ];
        const bulkResults = await db.bulk('users', bulkOps);
        console.log(`Bulk operations completed, results: ${bulkResults.length}`);

        // Delete the user
        await db.delete('users', userId);
        console.log('User deleted.');

        db.close();
        console.log('Database closed. All tests passed!');

    } catch (error) {
        console.error(`Error: ${error.message}`);
        console.error(error);
    }
}

testRealWorldUsage();