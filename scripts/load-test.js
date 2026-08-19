const http = require('http');

const PORT = process.env.PORT || 5000;
const BASE_URL = process.env.TEST_URL || `http://localhost:${PORT}`;

async function runAutocannonIfAvailable() {
  try {
    const autocannon = require('autocannon');
    console.log(`🚀 Running Autocannon load test against ${BASE_URL}...`);

    const result = await autocannon({
      url: BASE_URL,
      connections: 50,
      duration: 10,
      pipelining: 1,
      requests: [
        { method: 'GET', path: '/health' },
        { method: 'GET', path: '/api/v1/cars' },
        { method: 'GET', path: '/api/v1/catalog/brands' },
        { method: 'GET', path: '/api/v1/locations/states' },
      ],
    });

    console.log(autocannon.printResult(result));
    return true;
  } catch (err) {
    return false;
  }
}

async function runNativeConcurrentLoadTest(totalRequests = 100, concurrency = 20) {
  console.log(`\n📊 Running Native Concurrent Load Test:`);
  console.log(`   Target: ${BASE_URL}`);
  console.log(`   Total Requests: ${totalRequests} | Concurrency: ${concurrency}\n`);

  const endpoints = [
    '/health',
    '/api/v1/cars',
    '/api/v1/catalog/brands',
    '/api/v1/locations/states',
  ];

  const results = [];
  let index = 0;

  async function worker() {
    while (index < totalRequests) {
      const currentIdx = index++;
      const path = endpoints[currentIdx % endpoints.length];
      const url = `${BASE_URL}${path}`;
      const start = performance.now();

      try {
        const res = await fetch(url);
        const duration = performance.now() - start;
        results.push({ path, status: res.status, ok: res.ok, duration });
      } catch (err) {
        results.push({ path, status: 0, ok: false, error: err.message, duration: performance.now() - start });
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  const globalStart = performance.now();
  await Promise.all(workers);
  const totalDuration = (performance.now() - globalStart) / 1000;

  const successful = results.filter(r => r.ok);
  const failed = results.filter(r => !r.ok);
  const durations = successful.map(r => r.duration);

  durations.sort((a, b) => a - b);
  const avg = durations.reduce((a, b) => a + b, 0) / (durations.length || 1);
  const min = durations[0] || 0;
  const max = durations[durations.length - 1] || 0;
  const p95 = durations[Math.floor(durations.length * 0.95)] || 0;

  console.log('══════════════════════════════════════════════════');
  console.log('LOAD TEST PERFORMANCE REPORT');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Total Requests:        ${results.length}`);
  console.log(`  Successful (2xx):      ${successful.length}`);
  console.log(`  Failed (non-2xx/err):  ${failed.length}`);
  console.log(`  Total Time:            ${totalDuration.toFixed(2)}s`);
  console.log(`  Requests / Second:     ${(results.length / totalDuration).toFixed(2)} req/s`);
  console.log('──────────────────────────────────────────────────');
  console.log(`  Min Latency:           ${min.toFixed(2)} ms`);
  console.log(`  Avg Latency:           ${avg.toFixed(2)} ms`);
  console.log(`  p95 Latency:           ${p95.toFixed(2)} ms`);
  console.log(`  Max Latency:           ${max.toFixed(2)} ms`);
  console.log('══════════════════════════════════════════════════\n');
}

async function main() {
  const autocannonRan = await runAutocannonIfAvailable();
  if (!autocannonRan) {
    await runNativeConcurrentLoadTest(100, 20);
  }
}

main();
