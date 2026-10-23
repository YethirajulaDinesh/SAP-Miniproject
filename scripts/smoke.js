'use strict';

async function main() {
  const base = process.env.SMOKE_URL || 'http://127.0.0.1:4004';
  const health = await fetch(`${base}/health`).then((r) => r.json());
  if (health.status !== 'ok') throw new Error('health failed');
  const auth = 'Basic ' + Buffer.from('manager:manager').toString('base64');
  const eq = await fetch(`${base}/odata/v4/rental/Equipment?$top=5&$count=true`, { headers: { Authorization: auth } });
  if (!eq.ok) throw new Error('equipment read failed ' + eq.status);
  console.log('smoke ok', health, 'equipment', eq.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
