'use strict';

function createPlatform({ nfcEnabled = false } = {}) {
  return {
    camera: { capture: async () => ({ uri: 'file://local-demo.jpg', mime: 'image/jpeg' }) },
    scanner: { scan: async () => ({ format: 'QR', value: 'CAT320-001' }) },
    nfc: nfcEnabled
      ? { scan: async () => ({ id: 'nfc-demo' }) }
      : { scan: async () => { throw new Error('NFC_FEATURE_FLAG_OFF'); } },
    signature: { capture: async () => ({ present: true, objectKey: 'sig-demo' }) },
    secureStore: {
      set: async () => ({ stored: true, backend: 'OS_KEYSTORE' }),
      get: async () => null,
    },
  };
}

module.exports = { createPlatform };
