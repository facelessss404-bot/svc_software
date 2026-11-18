const fs = require('fs');
const path = require('path');

// Read production_readiness_audit.js
const auditCode = fs.readFileSync(path.join(__dirname, 'production_readiness_audit.js'), 'utf8');

// Evaluate in Node context
eval(auditCode);

runProductionAudit().then(results => {
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.allPassed ? 0 : 1);
}).catch(err => {
  console.error("FATAL AUDIT ERROR:", err);
  process.exit(1);
});

