'use strict';

class EncryptedQueue {
  constructor() {
    this.items = [];
    this.token = null;
  }
  enqueue(op) {
    if (!op.clientOperationID) throw new Error('clientOperationID required');
    this.items.push({ ...op, queuedAt: new Date().toISOString() });
  }
  snapshot() {
    return this.items.slice();
  }
  markSynced(id) {
    this.items = this.items.filter((i) => i.clientOperationID !== id);
  }
  setToken(token) {
    this.token = token ? { stored: true, value: 'OS_SECURE_STORE' } : null;
  }
}

module.exports = { EncryptedQueue };
