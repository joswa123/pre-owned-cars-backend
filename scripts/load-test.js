const http = require('http');

const PORT = process.env.PORT || 5000;
const URL = `http://localhost:${PORT}/api/v1/cars`;

async function runLoadTest(iterations = 50) {
  console.log(`Starting load test with ${iterations} iterations on ${URL}`);
  
  const times = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    try {
      const response = await fetch(URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      await response.json();
      const end = performance.now();
      times.push(end - start);
    } catch (error) {
      console.error(`Request ${i + 1} failed:`, error.message);
    }
  }

  if (times.length === 0) {
    console.log('All requests failed.');
    return;
  }

  const average = times.reduce((a, b) => a + b, 0) / times.length;
  const max = Math.max(...times);
  const min = Math.min(...times);

  console.log('--- Load Test Results ---');
  console.log(`Average Response Time: ${average.toFixed(2)} ms`);
  console.log(`Min Response Time: ${min.toFixed(2)} ms`);
  console.log(`Max Response Time: ${max.toFixed(2)} ms`);
  console.log(`Total Requests: ${times.length}`);
}

runLoadTest();
