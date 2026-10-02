const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const engineDir = path.join(__dirname, '..', 'wa-engine');
if (fs.existsSync(engineDir)) {
  console.log('[BUILD-ENGINE] Building WhatsApp Automation Engine...');
  execSync('npm install', { cwd: engineDir, stdio: 'inherit' });
  execSync('npm run build', { cwd: engineDir, stdio: 'inherit' });
  console.log('[BUILD-ENGINE] ✅ wa-engine built successfully.');
}
