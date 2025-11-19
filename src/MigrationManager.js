import { MigrationError, MigrationRollbackError } from './ErrorHandler.js';
import TransactionManager from './TransactionManager.js';

/**
 * Handles safe schema migrations with rollback capabilities
 */
export default class MigrationManager {
  static MIGRATION_STORE = '_migration_meta';

  /**
   * Runs migrations from old version to new version with safety features
   * @param {IDBDatabase} db - Database instance
   * @param {Array<Migration>} migrations - Array of migration objects
   * @param {number} fromVersion - Starting version
   * @param {number} toVersion - Target version
   * @param {string[]} storeNames - Available store names for transactions
   */
  static async runMigrations(db, migrations, fromVersion, toVersion, storeNames = []) {
    if (!migrations || fromVersion >= toVersion) return;

    // Ensure migration metadata store exists
    await this.ensureMigrationStore(db);

    // Check if migrations are already completed
    const completedMigrations = await this.getCompletedMigrations(db);
    const pendingMigrations = this.getPendingMigrations(migrations, fromVersion, toVersion, completedMigrations);

    if (pendingMigrations.length === 0) {
      console.log('All migrations already completed');
      return;
    }

    console.log(`Running ${pendingMigrations.length} pending migrations...`);

    for (const migration of pendingMigrations) {
      await this.runMigrationSafely(db, migration, storeNames);
    }

    console.log('All migrations completed successfully');
  }

  /**
   * Ensures the migration metadata store exists
   * @param {IDBDatabase} db - Database instance
   */
  static async ensureMigrationStore(db) {
    if (!db.objectStoreNames.contains(this.MIGRATION_STORE)) {
      // This would be called during schema creation
      // For existing databases, we need to handle this during upgrade
      console.warn('Migration metadata store not found. This should be created during schema upgrade.');
    }
  }

  /**
   * Gets list of completed migrations
   * @param {IDBDatabase} db - Database instance
   * @returns {Promise<Array<string>>} Array of completed migration IDs
   */
  static async getCompletedMigrations(db) {
    if (!db.objectStoreNames.contains(this.MIGRATION_STORE)) {
      return [];
    }

    return TransactionManager.execute(db, [this.MIGRATION_STORE], 'readonly', (transaction) => {
      return new Promise((resolve) => {
        const store = transaction.objectStore(this.MIGRATION_STORE);
        const request = store.getAll();
        request.onsuccess = () => {
          const completed = request.result
            .filter(meta => meta.status === 'completed')
            .map(meta => meta.id);
          resolve(completed);
        };
        request.onerror = () => resolve([]);
      });
    });
  }

  /**
   * Gets pending migrations that need to be run
   * @param {Array<Migration>} migrations - All migrations
   * @param {number} fromVersion - Starting version
   * @param {number} toVersion - Target version
   * @param {Array<string>} completed - Already completed migration IDs
   * @returns {Array<Migration>} Pending migrations
   */
  static getPendingMigrations(migrations, fromVersion, toVersion, completed) {
    return migrations
      .filter(migration => {
        const version = migration.version || migration.id;
        return version > fromVersion && version <= toVersion && !completed.includes(migration.id);
      })
      .sort((a, b) => (a.version || a.id) - (b.version || b.id));
  }

  /**
   * Runs a single migration with safety features
   * @param {IDBDatabase} db - Database instance
   * @param {Migration} migration - Migration to run
   * @param {string[]} storeNames - Available store names for transactions
   */
  static async runMigrationSafely(db, migration, storeNames = []) {
    const migrationId = migration.id;
    const startTime = Date.now();

    console.log(`Starting migration: ${migrationId}`);

    // Check if migration is already in progress
    const status = await this.getMigrationStatus(db, migrationId);
    if (status === 'in_progress') {
      console.log(`Migration ${migrationId} already in progress, attempting resume...`);
      return this.resumeMigration(db, migration, storeNames);
    } else if (status === 'completed') {
      console.log(`Migration ${migrationId} already completed`);
      return;
    }

    // Mark migration as in progress
    await this.setMigrationStatus(db, migrationId, 'in_progress', { startTime });

    try {
      // Run the migration with checkpointing
      await this.executeMigrationWithCheckpointing(db, migration, storeNames);

      // Mark as completed
      const endTime = Date.now();
      await this.setMigrationStatus(db, migrationId, 'completed', {
        startTime,
        endTime,
        duration: endTime - startTime
      });

      console.log(`Migration ${migrationId} completed successfully in ${endTime - startTime}ms`);

    } catch (error) {
      console.error(`Migration ${migrationId} failed:`, error);

      // Mark as failed
      await this.setMigrationStatus(db, migrationId, 'failed', {
        startTime,
        error: error.message,
        stack: error.stack
      });

      // Attempt rollback if available
      if (migration.rollback) {
        try {
          console.log(`Attempting rollback for migration ${migrationId}...`);
          await this.rollbackMigration(db, migration, storeNames);
          await this.setMigrationStatus(db, migrationId, 'rolled_back', {
            startTime,
            rollbackTime: Date.now(),
            originalError: error.message
          });
          console.log(`Rollback completed for migration ${migrationId}`);
        } catch (rollbackError) {
          console.error(`Rollback failed for migration ${migrationId}:`, rollbackError);
          await this.setMigrationStatus(db, migrationId, 'rollback_failed', {
            startTime,
            originalError: error.message,
            rollbackError: rollbackError.message
          });
          throw new MigrationRollbackError(`Migration ${migrationId} failed and rollback unsuccessful`, rollbackError);
        }
      }

      throw new MigrationError(`Migration ${migrationId} failed`, error);
    }
  }

  /**
   * Executes migration with checkpointing for resumability
   * @param {IDBDatabase} db - Database instance
   * @param {Migration} migration - Migration to execute
   * @param {string[]} storeNames - Available store names for transactions
   */
  static async executeMigrationWithCheckpointing(db, migration, storeNames = []) {
    const migrationId = migration.id;

    if (migration.checkpointed && typeof migration.up === 'function') {
      // For large migrations, implement checkpointing
      let checkpoint = await this.getMigrationCheckpoint(db, migrationId) || 0;
      const batchSize = migration.batchSize || 1000;

      while (true) {
        const result = await migration.up(db, checkpoint, batchSize);

        if (result.completed) {
          break;
        }

        checkpoint = result.nextCheckpoint;
        await this.setMigrationCheckpoint(db, migrationId, checkpoint);

        // Allow UI updates and prevent blocking
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } else {
      // Simple migration without checkpointing
      // Use all available stores for the transaction scope
      const transactionStores = storeNames.length > 0 ? storeNames : [this.MIGRATION_STORE];
      await TransactionManager.execute(db, transactionStores, 'readwrite', (transaction) => {
        return migration.up(db, transaction);
      });
    }
  }

  /**
   * Resumes a migration that was previously interrupted
   * @param {IDBDatabase} db - Database instance
   * @param {Migration} migration - Migration to resume
   * @param {string[]} storeNames - Available store names for transactions
   */
  static async resumeMigration(db, migration, storeNames = []) {
    const migrationId = migration.id;
    const checkpoint = await this.getMigrationCheckpoint(db, migrationId);

    if (checkpoint !== null && migration.checkpointed) {
      console.log(`Resuming migration ${migrationId} from checkpoint ${checkpoint}`);
      await this.executeMigrationWithCheckpointing(db, migration);
    } else {
      // Cannot resume, mark as failed and retry
      await this.setMigrationStatus(db, migrationId, 'failed', {
        error: 'Migration interrupted and cannot be resumed'
      });
      throw new MigrationError(`Migration ${migrationId} was interrupted and cannot be resumed`);
    }
  }

  /**
   * Rolls back a failed migration
   * @param {IDBDatabase} db - Database instance
   * @param {Migration} migration - Migration to rollback
   * @param {string[]} storeNames - Available store names for transactions
   */
  static async rollbackMigration(db, migration, storeNames = []) {
    const migrationId = migration.id;

    if (migration.rollback) {
      // Use all available stores for the transaction scope
      const transactionStores = storeNames.length > 0 ? storeNames : [this.MIGRATION_STORE];
      await TransactionManager.execute(db, transactionStores, 'readwrite', (transaction) => {
        return migration.rollback(db, transaction);
      });
    } else {
      throw new MigrationRollbackError(`No rollback function provided for migration ${migrationId}`);
    }
  }

  /**
   * Gets migration status
   * @param {IDBDatabase} db - Database instance
   * @param {string} migrationId - Migration ID
   * @returns {Promise<string|null>} Migration status
   */
  static async getMigrationStatus(db, migrationId) {
    if (!db.objectStoreNames.contains(this.MIGRATION_STORE)) {
      return null;
    }

    return TransactionManager.execute(db, [this.MIGRATION_STORE], 'readonly', (transaction) => {
      return new Promise((resolve) => {
        const store = transaction.objectStore(this.MIGRATION_STORE);
        const request = store.get(migrationId);
        request.onsuccess = () => {
          resolve(request.result ? request.result.status : null);
        };
        request.onerror = () => resolve(null);
      });
    });
  }

  /**
   * Sets migration status
   * @param {IDBDatabase} db - Database instance
   * @param {string} migrationId - Migration ID
   * @param {string} status - Migration status
   * @param {Object} metadata - Additional metadata
   */
  static async setMigrationStatus(db, migrationId, status, metadata = {}) {
    if (!db.objectStoreNames.contains(this.MIGRATION_STORE)) {
      // Try to create the store if it doesn't exist
      try {
        await this.createMigrationStore(db);
      } catch (error) {
        console.warn('Could not create migration store:', error);
        return;
      }
    }

    await TransactionManager.execute(db, [this.MIGRATION_STORE], 'readwrite', (transaction) => {
      return new Promise((resolve, reject) => {
        const store = transaction.objectStore(this.MIGRATION_STORE);
        const data = {
          id: migrationId,
          status,
          timestamp: Date.now(),
          ...metadata
        };

        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Gets migration checkpoint
   * @param {IDBDatabase} db - Database instance
   * @param {string} migrationId - Migration ID
   * @returns {Promise<any>} Checkpoint data
   */
  static async getMigrationCheckpoint(db, migrationId) {
    if (!db.objectStoreNames.contains(this.MIGRATION_STORE)) {
      return null;
    }

    return TransactionManager.execute(db, [this.MIGRATION_STORE], 'readonly', (transaction) => {
      return new Promise((resolve) => {
        const store = transaction.objectStore(this.MIGRATION_STORE);
        const request = store.get(`${migrationId}_checkpoint`);
        request.onsuccess = () => {
          resolve(request.result ? request.result.checkpoint : null);
        };
        request.onerror = () => resolve(null);
      });
    });
  }

  /**
   * Sets migration checkpoint
   * @param {IDBDatabase} db - Database instance
   * @param {string} migrationId - Migration ID
   * @param {any} checkpoint - Checkpoint data
   */
  static async setMigrationCheckpoint(db, migrationId, checkpoint) {
    if (!db.objectStoreNames.contains(this.MIGRATION_STORE)) {
      return;
    }

    await TransactionManager.execute(db, [this.MIGRATION_STORE], 'readwrite', (transaction) => {
      return new Promise((resolve, reject) => {
        const store = transaction.objectStore(this.MIGRATION_STORE);
        const data = {
          id: `${migrationId}_checkpoint`,
          checkpoint,
          timestamp: Date.now()
        };

        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Creates the migration metadata store
   * @param {IDBDatabase} db - Database instance
   */
  static async createMigrationStore(db) {
    // This should be called during database upgrade
    // For now, we'll try to create it if possible
    if (db.version > 1) {
      console.warn('Migration store should be created during schema upgrade');
    }
  }
}