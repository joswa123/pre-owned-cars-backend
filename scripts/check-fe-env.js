const fs = require('fs');
const path = require('path');
const root = 'D:/PRE-OWNED-CARS-PROJECT';

const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  console.log('--- .env content ---');
  console.log(fs.readFileSync(envPath, 'utf8'));
} else {
  console.log('.env does not exist');
}
const envExamplePath = path.join(root, '.env.example');
if (fs.existsSync(envExamplePath)) {
  console.log('--- .env.example content ---');
  console.log(fs.readFileSync(envExamplePath, 'utf8'));
}
