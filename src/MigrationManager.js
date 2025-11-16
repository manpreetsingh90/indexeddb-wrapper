import { MigrationError } from './ErrorHandler.js';
import TransactionManager from './TransactionManager.js';

/**
 * Handles schema migrations
 */
export default class MigrationManager {
  /**
   * Runs migrations from old version to new version
   * @param {IDBDatabase} db - Database instance
   * @param {Array<Function>} migrations - Array of migration functions
   * @param {number} fromVersion - Starting version
   * @param {number} toVersion - Target version
   */
  static async runMigrations(db, migrations, fromVersion, toVersion) {
    if (!migrations || fromVersion >= toVersion) return;

    for (let i = fromVersion; i < toVersion; i++) {
      const migrationIndex = i; // migrations[0] is for version 1->2

      if (migrations[migrationIndex]) {
        try {
          await TransactionManager.execute(db, [], 'readwrite', (transaction) => {
            return migrations[migrationIndex](db, transaction);
          });
        } catch (error) {
          throw new MigrationError(`Migration from version ${i} to ${i + 1} failed`, error);
        }
      }
    }
  }
}