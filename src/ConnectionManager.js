import { ConnectionError } from './ErrorHandler.js';
import SchemaManager from './SchemaManager.js';
import MigrationManager from './MigrationManager.js';

/**
 * Manages IndexedDB database connections
 */
export default class ConnectionManager {
  constructor(dbName, version, schema, migrations = [], tabCoordinator = null) {
    this.dbName = dbName;
    this.version = version;
    this.schema = schema;
    this.migrations = migrations;
    this.tabCoordinator = tabCoordinator;
    this.db = null;
    this.oldVersion = 0;
  }

  /**
   * Opens the database connection
   * @returns {Promise<IDBDatabase>} The database instance
   */
  open() {
    return new Promise((resolve, reject) => {
      const indexedDB = globalThis.indexedDB || window?.indexedDB;
      if (!indexedDB) {
        reject(new ConnectionError('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new ConnectionError('Failed to open database', request.error));
      };

      request.onupgradeneeded = (event) => {
        this.db = event.target.result;
        this.oldVersion = event.oldVersion;

        // Announce migration start if coordinator available
        if (this.tabCoordinator && this.oldVersion < this.version) {
          this.tabCoordinator.announceMigrationStart(`upgrade-${this.oldVersion}-${this.version}`, this.version);
        }

        SchemaManager.createSchema(this.db, this.schema);
      };

      request.onsuccess = async () => {
        this.db = request.result;
        if (this.oldVersion < this.version) {
          try {
            // Convert legacy migration format to new format if needed
            const normalizedMigrations = this.normalizeMigrations(this.migrations);
            // Get store names from schema for transaction scopes
            const storeNames = Object.keys(this.schema.stores || {});
            await MigrationManager.runMigrations(this.db, normalizedMigrations, this.oldVersion, this.version, storeNames);

            // Announce migration completion
            if (this.tabCoordinator) {
              this.tabCoordinator.announceMigrationComplete(`upgrade-${this.oldVersion}-${this.version}`, this.version);
            }
          } catch (error) {
            reject(error);
            return;
          }
        }
        resolve(this.db);
      };
    });
  }

  /**
   * Closes the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Checks if the database is currently open
   * @returns {boolean}
   */
  isOpen() {
    return this.db !== null;
  }

  /**
   * Gets the current database instance
   * @returns {IDBDatabase|null}
   */
  getDatabase() {
    return this.db;
  }

  /**
   * Normalizes migrations from legacy format to new format
   * @param {Array} migrations - Migration functions or objects
   * @returns {Array} Normalized migration objects
   */
  normalizeMigrations(migrations) {
    if (!migrations || !Array.isArray(migrations)) {
      return [];
    }

    return migrations.map((migration, index) => {
      // If it's already a migration object, return as-is
      if (migration && typeof migration === 'object' && migration.id) {
        return migration;
      }

      // Convert legacy function to migration object
      if (typeof migration === 'function') {
        return {
          id: `migration_${index + 1}`,
          version: index + 1,
          up: migration,
          checkpointed: false
        };
      }

      // Invalid migration
      console.warn(`Invalid migration at index ${index}:`, migration);
      return null;
    }).filter(Boolean);
  }
}