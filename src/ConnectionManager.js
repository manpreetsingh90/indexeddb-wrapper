import { ConnectionError } from './ErrorHandler.js';
import SchemaManager from './SchemaManager.js';
import MigrationManager from './MigrationManager.js';

/**
 * Manages IndexedDB database connections
 */
export default class ConnectionManager {
  constructor(dbName, version, schema, migrations = []) {
    this.dbName = dbName;
    this.version = version;
    this.schema = schema;
    this.migrations = migrations;
    this.db = null;
    this.oldVersion = 0;
  }

  /**
   * Opens the database connection
   * @returns {Promise<IDBDatabase>} The database instance
   */
  open() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
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
        SchemaManager.createSchema(this.db, this.schema);
      };

      request.onsuccess = async () => {
        this.db = request.result;
        if (this.oldVersion < this.version) {
          try {
            await MigrationManager.runMigrations(this.db, this.migrations, this.oldVersion, this.version);
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
}