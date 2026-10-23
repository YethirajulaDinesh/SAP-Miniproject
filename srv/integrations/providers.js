'use strict';

const crypto = require('crypto');

function mockId(prefix) {
  return `MOCK-${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

class EquipmentProvider {
  async fetchSince() {
    return { items: [], cursor: new Date().toISOString(), simulated: true };
  }
}

class BusinessPartnerProvider {
  async fetchSince() {
    return { items: [], cursor: new Date().toISOString(), simulated: true };
  }
}

class RentalContractProvider {
  async fetchSince() {
    return { items: [], blocked: process.env.INTEGRATION_MODE === 's4', simulated: true };
  }
}

class MaintenanceNotificationProvider {
  async create(payload) {
    if (process.env.INTEGRATION_MODE === 's4') {
      const err = new Error('S/4 maintenance notification API is BLOCKED until target metadata is verified');
      err.code = 'S4_BLOCKED';
      throw err;
    }
    return { externalID: mockId('NOTIF'), simulated: true, payload };
  }
}

class MaintenanceOrderProvider {
  async create(payload) {
    if (process.env.INTEGRATION_MODE === 's4') {
      const err = new Error('S/4 maintenance order API is BLOCKED until target metadata is verified');
      err.code = 'S4_BLOCKED';
      throw err;
    }
    return { externalID: mockId('ORDER'), simulated: true, payload };
  }
  async readStatus(externalID) {
    return { externalID, status: 'SIMULATED', simulated: true };
  }
}

class BillingPostingProvider {
  constructor() {
    this.store = new Map();
  }
  async post(command) {
    if (process.env.INTEGRATION_MODE === 's4') {
      const err = new Error('Live billing posting is BLOCKED until Finance API/process is verified');
      err.code = 'S4_BLOCKED';
      throw err;
    }
    if (command.forceTimeout) {
      const err = new Error('TEMP timeout talking to S/4');
      err.code = 'TIMEOUT';
      throw err;
    }
    if (this.store.has(command.idempotencyKey)) {
      return { ...this.store.get(command.idempotencyKey), replayed: true };
    }
    const result = {
      externalRequestID: mockId('DMR'),
      externalDocumentID: mockId('BILL'),
      simulated: true,
      status: 'SIMULATED',
    };
    this.store.set(command.idempotencyKey, result);
    return result;
  }
  async reconcile(idempotencyKey) {
    return this.store.get(idempotencyKey) || null;
  }
}

class BillingStatusProvider {
  async read(externalDocumentID) {
    return { externalDocumentID, billingStatus: 'SIMULATED', simulated: true };
  }
}

class AttachmentProvider {
  async attach() {
    return { simulated: true, skipped: true, reason: 'DIM/S4 attachment adapter optional' };
  }
}

class NotificationProvider {
  async send(record) {
    return { ...record, status: 'SIMULATED_SENT', simulated: true };
  }
}

class LocalMediaStorage {
  constructor(fs, path, root) {
    this.fs = fs;
    this.path = path;
    this.root = root;
  }
  async put(key, buffer) {
    const full = this.path.join(this.root, key);
    this.fs.mkdirSync(this.path.dirname(full), { recursive: true });
    this.fs.writeFileSync(full, buffer);
    return { provider: 'local', key };
  }
  async get(key) {
    return this.fs.readFileSync(this.path.join(this.root, key));
  }
  signedUrl(key, ttlSec = 300) {
    const exp = Date.now() + ttlSec * 1000;
    const sig = crypto.createHmac('sha256', process.env.MEDIA_SIGNING_SECRET || 'dev-only-not-for-prod').update(`${key}|${exp}`).digest('hex');
    return `/api/media/object?key=${encodeURIComponent(key)}&exp=${exp}&sig=${sig}`;
  }
  verifySigned(key, exp, sig) {
    if (Number(exp) < Date.now()) return false;
    const expected = crypto.createHmac('sha256', process.env.MEDIA_SIGNING_SECRET || 'dev-only-not-for-prod').update(`${key}|${exp}`).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  }
}

class S3MediaStorage {
  async put() {
    throw Object.assign(new Error('S3 media adapter requires destination credentials'), { code: 'S3_BLOCKED' });
  }
}

function mediaProvider() {
  const fs = require('fs');
  const path = require('path');
  if ((process.env.MEDIA_PROVIDER || 'local') === 's3') return new S3MediaStorage();
  return new LocalMediaStorage(fs, path, process.env.MEDIA_ROOT || path.join(process.cwd(), '.media'));
}

const billing = new BillingPostingProvider();

module.exports = {
  EquipmentProvider,
  BusinessPartnerProvider,
  RentalContractProvider,
  MaintenanceNotificationProvider,
  MaintenanceOrderProvider,
  BillingPostingProvider,
  BillingStatusProvider,
  AttachmentProvider,
  NotificationProvider,
  mediaProvider,
  billing,
  mockId,
};
