// k6 scenario stub — not a claimed production result
// k6 run scripts/load-k6.js
import http from 'k6/http';
import { check } from 'k6';

export const options = { vus: 5, duration: '10s' };

export default function () {
  const res = http.get('http://127.0.0.1:4004/health');
  check(res, { ok: (r) => r.status === 200 });
}
