/**
 * Multi-tab coordination for IndexedDB operations
 * Uses BroadcastChannel to coordinate database access across multiple tabs/windows
 */
export default class TabCoordinator {
  constructor(dbName, options = {}) {
    this.dbName = dbName;
    this.options = {
      channelName: `idb-${dbName}`,
      heartbeatInterval: 5000, // 5 seconds
      lockTimeout: 30000, // 30 seconds
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      ...options
    };

    this.channel = null;
    this.isLeader = false;
    this.tabId = this.generateTabId();
    this.heartbeatTimer = null;
    this.lockQueue = new Map();
    this.activeLocks = new Set();
    this.lastHeartbeat = Date.now();

    this.init();
  }

  /**
   * Initialize the coordinator
   */
  init() {
    try {
      this.channel = new BroadcastChannel(this.options.channelName);
      this.setupChannelListeners();
      this.startHeartbeat();
      this.announcePresence();

      console.log(`[TabCoordinator] Initialized for database '${this.dbName}' with tab ID ${this.tabId}`);
    } catch (error) {
      console.warn('[TabCoordinator] BroadcastChannel not supported, running in single-tab mode');
      this.fallbackMode = true;
    }
  }

  /**
   * Generate a unique tab identifier
   */
  generateTabId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set up BroadcastChannel event listeners
   */
  setupChannelListeners() {
    if (!this.channel) return;

    this.channel.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    // Handle tab close/unload
    window.addEventListener('beforeunload', () => {
      this.announceDeparture();
    });

    // Handle visibility change (tab becomes active/inactive)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.announceInactive();
      } else {
        this.announceActive();
      }
    });
  }

  /**
   * Handle incoming messages from other tabs
   */
  handleMessage(message) {
    const { type, tabId, data, timestamp } = message;

    // Ignore our own messages
    if (tabId === this.tabId) return;

    switch (type) {
      case 'presence':
        this.handlePresence(tabId, data);
        break;
      case 'departure':
        this.handleDeparture(tabId);
        break;
      case 'heartbeat':
        this.handleHeartbeat(tabId, timestamp);
        break;
      case 'lock_request':
        this.handleLockRequest(tabId, data);
        break;
      case 'lock_release':
        this.handleLockRelease(tabId, data);
        break;
      case 'lock_granted':
        this.handleLockGranted(data);
        break;
      case 'lock_denied':
        this.handleLockDenied(data);
        break;
      case 'migration_start':
        this.handleMigrationStart(tabId, data);
        break;
      case 'migration_complete':
        this.handleMigrationComplete(tabId, data);
        break;
    }
  }

  /**
   * Start heartbeat timer
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
      this.checkForDeadTabs();
    }, this.options.heartbeatInterval);
  }

  /**
   * Send heartbeat to other tabs
   */
  sendHeartbeat() {
    this.broadcast({
      type: 'heartbeat',
      tabId: this.tabId,
      timestamp: Date.now()
    });
  }

  /**
   * Check for dead tabs and clean up their locks
   */
  checkForDeadTabs() {
    const now = Date.now();
    const timeout = this.options.heartbeatInterval * 3; // 3x heartbeat interval

    // Clean up dead tab locks
    for (const [lockId, lockInfo] of this.lockQueue) {
      if (now - lockInfo.lastSeen > timeout) {
        console.warn(`[TabCoordinator] Cleaning up dead tab lock: ${lockId}`);
        this.lockQueue.delete(lockId);
        this.activeLocks.delete(lockId);
      }
    }
  }

  /**
   * Announce presence to other tabs
   */
  announcePresence() {
    this.broadcast({
      type: 'presence',
      tabId: this.tabId,
      data: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Announce departure
   */
  announceDeparture() {
    this.broadcast({
      type: 'departure',
      tabId: this.tabId,
      timestamp: Date.now()
    });

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    if (this.channel) {
      this.channel.close();
    }
  }

  /**
   * Announce tab becoming active
   */
  announceActive() {
    this.broadcast({
      type: 'presence',
      tabId: this.tabId,
      data: {
        active: true,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Announce tab becoming inactive
   */
  announceInactive() {
    this.broadcast({
      type: 'presence',
      tabId: this.tabId,
      data: {
        active: false,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Broadcast message to all tabs
   */
  broadcast(message) {
    if (this.channel && !this.fallbackMode) {
      this.channel.postMessage(message);
    }
  }

  /**
   * Handle presence announcement from another tab
   */
  handlePresence(tabId, data) {
    // Update last seen time
    this.updateTabLastSeen(tabId);

    // If this is the first time seeing this tab, acknowledge
    if (!this.lockQueue.has(tabId)) {
      console.log(`[TabCoordinator] Tab ${tabId} joined`);
    }
  }

  /**
   * Handle tab departure
   */
  handleDeparture(tabId) {
    console.log(`[TabCoordinator] Tab ${tabId} departed`);

    // Clean up any locks held by this tab
    this.cleanupTabLocks(tabId);
  }

  /**
   * Handle heartbeat from another tab
   */
  handleHeartbeat(tabId, timestamp) {
    this.updateTabLastSeen(tabId);
  }

  /**
   * Update last seen time for a tab
   */
  updateTabLastSeen(tabId) {
    // Update any lock queue entries for this tab
    for (const [lockId, lockInfo] of this.lockQueue) {
      if (lockInfo.tabId === tabId) {
        lockInfo.lastSeen = Date.now();
      }
    }
  }

  /**
   * Clean up locks held by a departed tab
   */
  cleanupTabLocks(tabId) {
    const locksToRemove = [];

    for (const [lockId, lockInfo] of this.lockQueue) {
      if (lockInfo.tabId === tabId) {
        locksToRemove.push(lockId);
      }
    }

    for (const lockId of locksToRemove) {
      this.lockQueue.delete(lockId);
      this.activeLocks.delete(lockId);
      console.log(`[TabCoordinator] Released lock ${lockId} from departed tab ${tabId}`);
    }
  }

  /**
   * Request a database lock
   */
  async requestLock(lockId, options = {}) {
    if (this.fallbackMode) {
      // In fallback mode, just grant the lock immediately
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const lockRequest = {
        id: lockId,
        tabId: this.tabId,
        timestamp: Date.now(),
        timeout: options.timeout || this.options.lockTimeout,
        resolve,
        reject
      };

      // Check if we already hold this lock
      if (this.activeLocks.has(lockId)) {
        resolve();
        return;
      }

      // Add to queue
      this.lockQueue.set(lockId, lockRequest);

      // Broadcast lock request
      this.broadcast({
        type: 'lock_request',
        tabId: this.tabId,
        data: {
          lockId,
          timeout: lockRequest.timeout
        }
      });

      // Set timeout
      setTimeout(() => {
        if (this.lockQueue.has(lockId)) {
          this.lockQueue.delete(lockId);
          reject(new Error(`Lock request timeout: ${lockId}`));
        }
      }, lockRequest.timeout);
    });
  }

  /**
   * Release a database lock
   */
  releaseLock(lockId) {
    if (this.fallbackMode) return;

    this.activeLocks.delete(lockId);
    this.lockQueue.delete(lockId);

    // Notify other tabs
    this.broadcast({
      type: 'lock_release',
      tabId: this.tabId,
      data: { lockId }
    });
  }

  /**
   * Handle lock request from another tab
   */
  handleLockRequest(fromTabId, data) {
    const { lockId } = data;

    // If we hold this lock, deny the request
    if (this.activeLocks.has(lockId)) {
      this.broadcast({
        type: 'lock_denied',
        tabId: this.tabId,
        data: { lockId, requestingTab: fromTabId }
      });
      return;
    }

    // Otherwise, grant the lock
    this.broadcast({
      type: 'lock_granted',
      tabId: this.tabId,
      data: { lockId, requestingTab: fromTabId }
    });
  }

  /**
   * Handle lock release from another tab
   */
  handleLockRelease(fromTabId, data) {
    const { lockId } = data;

    // If someone else had this lock, we can now request it
    // This is handled by the requestLock promise resolution
  }

  /**
   * Handle lock granted message
   */
  handleLockGranted(data) {
    const { lockId } = data;

    const lockRequest = this.lockQueue.get(lockId);
    if (lockRequest && lockRequest.tabId === this.tabId) {
      this.activeLocks.add(lockId);
      lockRequest.resolve();
    }
  }

  /**
   * Handle lock denied message
   */
  handleLockDenied(data) {
    const { lockId } = data;

    const lockRequest = this.lockQueue.get(lockId);
    if (lockRequest && lockRequest.tabId === this.tabId) {
      // Retry with exponential backoff
      this.retryLockRequest(lockRequest);
    }
  }

  /**
   * Retry a lock request with backoff
   */
  retryLockRequest(lockRequest) {
    const { id, retryCount = 0 } = lockRequest;

    if (retryCount >= this.options.maxRetries) {
      lockRequest.reject(new Error(`Lock request failed after ${this.options.maxRetries} retries: ${id}`));
      this.lockQueue.delete(id);
      return;
    }

    lockRequest.retryCount = retryCount + 1;
    const delay = this.options.retryDelay * Math.pow(2, retryCount);

    setTimeout(() => {
      // Re-broadcast the lock request
      this.broadcast({
        type: 'lock_request',
        tabId: this.tabId,
        data: {
          lockId: id,
          timeout: lockRequest.timeout
        }
      });
    }, delay);
  }

  /**
   * Announce migration start
   */
  announceMigrationStart(migrationId, version) {
    this.broadcast({
      type: 'migration_start',
      tabId: this.tabId,
      data: { migrationId, version, timestamp: Date.now() }
    });
  }

  /**
   * Announce migration completion
   */
  announceMigrationComplete(migrationId, version) {
    this.broadcast({
      type: 'migration_complete',
      tabId: this.tabId,
      data: { migrationId, version, timestamp: Date.now() }
    });
  }

  /**
   * Handle migration start from another tab
   */
  handleMigrationStart(fromTabId, data) {
    console.log(`[TabCoordinator] Migration started in tab ${fromTabId}: ${data.migrationId} -> v${data.version}`);
    // Other tabs should wait or coordinate
  }

  /**
   * Handle migration completion from another tab
   */
  handleMigrationComplete(fromTabId, data) {
    console.log(`[TabCoordinator] Migration completed in tab ${fromTabId}: ${data.migrationId} -> v${data.version}`);
    // Other tabs can now proceed
  }

  /**
   * Get coordination status
   */
  getStatus() {
    return {
      tabId: this.tabId,
      isLeader: this.isLeader,
      activeLocks: Array.from(this.activeLocks),
      queuedLocks: Array.from(this.lockQueue.keys()),
      fallbackMode: this.fallbackMode,
      channelSupported: !!this.channel
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.announceDeparture();

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    if (this.channel) {
      this.channel.close();
    }
  }
}