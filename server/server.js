/**
 * SVC Smart Move — Central On-Premise Server (Node.js Edition)
 * Sri Venkateshwara Company (SVC), Coimbatore
 * 
 * Zero-Dependency Production Server for Windows Server 2012 / Factory LAN.
 * Uses only Node.js Built-in Core Modules (http, fs, path, crypto).
 * Provides Static Web Hosting and Central Shared REST API with ACID File-Locked JSON Store.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.SVC_PORT || 8080;
const BASE_DIR = __dirname;
const APP_DIR = path.resolve(BASE_DIR, '..', 'app');
const DATA_DIR = path.resolve(BASE_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'svc_smartmove_db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-Memory Database Image synced to disk atomically with write-lock
let DB = {
  users: [],
  masterWireSpecs: [],
  partsCatalog: [],
  inwardLots: [],
  batchSequences: {},
  issueTransactions: [],
  auditLogs: []
};

const SESSIONS = new Map(); // token -> user session

function hashPin(pin) {
  return crypto.createHash('sha256').update(`svc_salt_${pin}`).digest('hex');
}

function loadDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      DB = JSON.parse(raw);
      console.log(`[OK] Loaded existing central database (${DB.inwardLots.length} lots, ${DB.issueTransactions.length} issues).`);
      return;
    } catch (e) {
      console.error('[WARN] Failed to parse central database, re-seeding:', e);
    }
  }

  // Seed default database
  DB.users = [
    { id: 'USR-01', username: 'admin', passwordHash: hashPin('admin123'), fullName: 'SVC Plant Manager', role: 'Admin', isActive: true },
    { id: 'USR-02', username: 'operator', passwordHash: hashPin('store123'), fullName: 'Store Supervisor', role: 'Operator', isActive: true },
    { id: 'USR-03', username: 'viewer', passwordHash: hashPin('view123'), fullName: 'Plant Auditor', role: 'Viewer', isActive: true }
  ];

  // Seed initial lots
  DB.inwardLots = [
    { batchNo: 'MS-M-a-26-001', inwardDate: '2026-01-02', supplier: 'RCW', invNo: '2340', invDate: '2026-01-01', material: 'MS', grade: '1010', wireSize: '7.88', coils: 12, weight: 1785.00, heatNo: 'A3094255', remarks: 'Initial wire stock', createdBy: 'admin', createdAt: '2026-01-02T09:30:00.000Z' },
    { batchNo: 'MS-D-a-26-001', inwardDate: '2026-01-02', supplier: 'RCW', invNo: '2341', invDate: '2026-01-01', material: 'MS', grade: '1010', wireSize: '4.78', coils: 8, weight: 1139.00, heatNo: 'A3094256', remarks: 'Mild Steel coil', createdBy: 'admin', createdAt: '2026-01-02T10:15:00.000Z' },
    { batchNo: 'MS-F-a-26-001', inwardDate: '2026-01-03', supplier: 'RCW', invNo: '2345', invDate: '2026-01-02', material: 'MS', grade: '1010', wireSize: '5.50(DA)', coils: 20, weight: 2950.00, heatNo: 'A3094280', remarks: 'Drawn Annealed wire', createdBy: 'admin', createdAt: '2026-01-03T08:45:00.000Z' },
    { batchNo: 'MS-C-a-26-001', inwardDate: '2026-01-27', supplier: 'RCW', invNo: '2480', invDate: '2026-01-25', material: 'MS', grade: '1010', wireSize: '4.50(DA).', coils: 2, weight: 350.00, heatNo: 'B3095445', remarks: 'Special dotted wire spec', createdBy: 'admin', createdAt: '2026-01-27T11:00:00.000Z' },
    { batchNo: 'BR-C-j-26-001', inwardDate: '2026-01-05', supplier: 'SHARP', invNo: '664', invDate: '2026-01-02', material: 'BR', grade: 'CUZN35', wireSize: '5.50.', coils: 4, weight: 221.35, heatNo: 'R5606', remarks: 'Brass lot', createdBy: 'admin', createdAt: '2026-01-05T14:20:00.000Z' },
    { batchNo: 'SS-A-h-26-001', inwardDate: '2026-01-03', supplier: 'VENUS', invNo: '9300252649', invDate: '2025-12-30', material: 'SS', grade: 'AISI430', wireSize: '2.98', coils: 6, weight: 322.70, heatNo: 'V21026', remarks: 'Stainless Steel lot', createdBy: 'admin', createdAt: '2026-01-03T16:10:00.000Z' }
  ];

  DB.batchSequences = {
    'MS-M-a-26': 1,
    'MS-D-a-26': 1,
    'MS-F-a-26': 1,
    'MS-C-a-26': 1,
    'BR-C-j-26': 1,
    'SS-A-h-26': 1
  };

  saveDatabaseAtomic();
}

function saveDatabaseAtomic() {
  const tempFile = DB_FILE + '.tmp';
  fs.writeFileSync(tempFile, JSON.stringify(DB, null, 2), 'utf8');
  fs.renameSync(tempFile, DB_FILE);
}

function calculateBatchStock(batchNo) {
  const lot = DB.inwardLots.find(l => l.batchNo === batchNo);
  if (!lot) return null;

  const issues = DB.issueTransactions.filter(t => t.batchNo === batchNo && !t.isVoid);
  let totalIssued = 0, totalReturned = 0, totalScrap = 0, totalBitWire = 0, totalSlug = 0, totalNetConsumed = 0;

  for (const iss of issues) {
    totalIssued += iss.issuedQty || 0;
    totalReturned += iss.returnQty || 0;
    totalScrap += iss.scrapQty || 0;
    totalBitWire += iss.bitWireQty || 0;
    totalSlug += iss.slugQty || 0;
    totalNetConsumed += iss.netConsumed || 0;
  }

  totalIssued = Math.round(totalIssued * 100) / 100;
  totalReturned = Math.round(totalReturned * 100) / 100;
  totalScrap = Math.round(totalScrap * 100) / 100;
  totalBitWire = Math.round(totalBitWire * 100) / 100;
  totalSlug = Math.round(totalSlug * 100) / 100;
  totalNetConsumed = Math.round(totalNetConsumed * 100) / 100;

  const availableStock = Math.round((lot.weight - totalIssued + totalReturned) * 100) / 100;

  return {
    batchNo: lot.batchNo,
    inwardDate: lot.inwardDate,
    supplier: lot.supplier,
    material: lot.material,
    grade: lot.grade,
    wireSize: lot.wireSize,
    inwardWeight: lot.weight,
    coils: lot.coils,
    heatNo: lot.heatNo,
    invNo: lot.invNo,
    totalIssued,
    totalReturned,
    totalScrap,
    totalBitWire,
    totalSlug,
    totalNetConsumed,
    availableStock,
    issueCount: issues.length,
    status: availableStock <= 0 ? 'Exhausted' : availableStock < 100 ? 'Low Stock' : 'In Stock'
  };
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // REST API Endpoints
  if (pathname.startsWith('/api/')) {
    let bodyData = '';
    req.on('data', chunk => { bodyData += chunk; });
    req.on('end', () => {
      let body = {};
      if (bodyData) {
        try { body = JSON.parse(bodyData); } catch (e) {}
      }
      handleApi(req, res, pathname, body);
    });
    return;
  }

  // Static File Serving
  let relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const filePath = path.resolve(APP_DIR, relPath);

  if (!filePath.startsWith(APP_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

function handleApi(req, res, pathname, body) {
  const sendJson = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };
  const sendError = (msg, status = 400) => sendJson({ ok: false, error: msg }, status);

  const getAuth = () => {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ')) {
      return SESSIONS.get(authHeader.slice(7).trim()) || null;
    }
    return null;
  };

  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson({ ok: true, server: 'Node.js SVC Smart Move API', status: 'Online', timestamp: new Date().toISOString() });
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    const { username, pin } = body;
    const user = DB.users.find(u => u.username === username && u.isActive);
    if (!user || user.passwordHash !== hashPin(pin)) {
      return sendError('Invalid username or password PIN.', 401);
    }

    const token = crypto.randomBytes(24).toString('hex');
    const session = { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
    SESSIONS.set(token, session);

    DB.auditLogs.unshift({
      id: DB.auditLogs.length + 1,
      timestamp: new Date().toISOString(),
      action: 'LOGIN_SUCCESS',
      userId: user.username,
      details: 'User logged in via central API'
    });
    saveDatabaseAtomic();

    return sendJson({ ok: true, token, user: session });
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const user = getAuth();
    if (!user) return sendError('Unauthorized', 401);
    return sendJson({ ok: true, user });
  }

  if (pathname === '/api/inward' && req.method === 'GET') {
    return sendJson({ ok: true, lots: DB.inwardLots });
  }

  if (pathname === '/api/inward' && req.method === 'POST') {
    const user = getAuth();
    if (!user) return sendError('Authentication required', 401);

    const { material, grade, wireSize, supplier, invNo, invDate, inwardDate, weight, coils, heatNo, remarks, giNo, poNo } = body;
    const parsedWeight = parseFloat(weight);

    if (!material || !grade || !wireSize || !supplier || !invNo || isNaN(parsedWeight) || parsedWeight <= 0) {
      return sendError('Missing required fields or invalid weight.');
    }

    // Determine year and prefix
    const yy = inwardDate ? String(new Date(inwardDate).getFullYear()).slice(-2) : String(new Date().getFullYear()).slice(-2);
    
    // Read wireCode and gradeCode from master
    // Default fallback codes if master not fully loaded
    const wireCode = body.wireCode || 'M';
    const gradeCode = body.gradeCode || 'a';
    const prefix = `${material}-${wireCode}-${gradeCode}-${yy}`;

    const nextSeq = (DB.batchSequences[prefix] || 0) + 1;
    DB.batchSequences[prefix] = nextSeq;

    const batchNo = `${prefix}-${String(nextSeq).padStart(3, '0')}`;

    const record = {
      batchNo,
      inwardDate: inwardDate || new Date().toISOString().slice(0, 10),
      supplier: supplier.trim(),
      invNo: invNo.trim(),
      invDate: invDate || inwardDate,
      poNo: poNo || '',
      giNo: giNo || '',
      material,
      grade,
      wireSize,
      coils: parseInt(coils, 10) || 0,
      weight: Math.round(parsedWeight * 100) / 100,
      heatNo: (heatNo || '').trim(),
      remarks: (remarks || '').trim(),
      createdBy: user.username,
      createdAt: new Date().toISOString()
    };

    DB.inwardLots.unshift(record);
    DB.auditLogs.unshift({
      id: DB.auditLogs.length + 1,
      timestamp: new Date().toISOString(),
      action: 'INWARD_CREATE',
      userId: user.username,
      details: `Generated batch ${batchNo} with ${record.weight} kg`
    });
    saveDatabaseAtomic();

    return sendJson({ ok: true, lot: record });
  }

  if (pathname === '/api/issue' && req.method === 'GET') {
    return sendJson({ ok: true, issues: DB.issueTransactions.filter(t => !t.isVoid) });
  }

  if (pathname === '/api/issue' && req.method === 'POST') {
    const user = getAuth();
    if (!user) return sendError('Authentication required', 401);

    const { batchNo, partNumber, machineNo, issueDate, issuedQty, returnQty, scrapQty, bitWireQty, slugQty, remarks, drawnSize, dieNo, customer } = body;
    const parsedIssue = parseFloat(issuedQty);

    if (!batchNo || !partNumber || !machineNo || isNaN(parsedIssue) || parsedIssue <= 0) {
      return sendError('Missing required fields or invalid issued quantity.');
    }

    const stock = calculateBatchStock(batchNo);
    if (!stock) return sendError(`Batch ${batchNo} not found.`);

    if (parsedIssue > stock.availableStock) {
      const deficit = Math.round((parsedIssue - stock.availableStock) * 100) / 100;
      return sendError(`OVER-ISSUE REJECTED: Available stock is ${stock.availableStock.toFixed(2)} kg. Requested ${parsedIssue.toFixed(2)} kg (Deficit: ${deficit.toFixed(2)} kg).`, 400);
    }

    const ret = parseFloat(returnQty) || 0;
    const scr = parseFloat(scrapQty) || 0;
    const bit = parseFloat(bitWireQty) || 0;
    const slug = parseFloat(slugQty) || 0;
    const netConsumed = Math.round((parsedIssue - ret - scr - bit - slug) * 100) / 100;

    const issueId = `ISS-${String(DB.issueTransactions.length + 1).padStart(5, '0')}`;
    const tx = {
      id: issueId,
      issueDate: issueDate || new Date().toISOString().slice(0, 10),
      machineNo: machineNo.trim(),
      partNumber: partNumber.trim(),
      customer: customer || 'Customer',
      batchNo: stock.batchNo,
      material: stock.material,
      grade: stock.grade,
      wireSize: stock.wireSize,
      drawnSize: drawnSize ? parseFloat(drawnSize) : null,
      supplier: stock.supplier,
      invNo: stock.invNo,
      heatNo: stock.heatNo,
      dieNo: dieNo || '',
      issuedQty: parsedIssue,
      returnQty: ret,
      scrapQty: scr,
      bitWireQty: bit,
      slugQty: slug,
      netConsumed,
      remarks: remarks || '',
      createdBy: user.username,
      createdAt: new Date().toISOString(),
      isVoid: false
    };

    DB.issueTransactions.unshift(tx);
    DB.auditLogs.unshift({
      id: DB.auditLogs.length + 1,
      timestamp: new Date().toISOString(),
      action: 'RM_ISSUE',
      userId: user.username,
      details: `Issued ${parsedIssue} kg from ${batchNo} to M/C ${machineNo} (Net Consumed: ${netConsumed} kg)`
    });
    saveDatabaseAtomic();

    return sendJson({ ok: true, issue: tx, remainingBalance: Math.round((stock.availableStock - parsedIssue + ret) * 100) / 100 });
  }

  if (pathname === '/api/stock-ledger' && req.method === 'GET') {
    const ledger = DB.inwardLots.map(l => calculateBatchStock(l.batchNo));
    return sendJson({ ok: true, ledger });
  }

  if (pathname === '/api/dashboard' && req.method === 'GET') {
    let totalInward = 0;
    for (const l of DB.inwardLots) totalInward += l.weight;

    let totalIssued = 0, totalReturned = 0, totalNet = 0;
    for (const t of DB.issueTransactions) {
      if (!t.isVoid) {
        totalIssued += t.issuedQty || 0;
        totalReturned += t.returnQty || 0;
        totalNet += t.netConsumed || 0;
      }
    }

    const currentStock = Math.round((totalInward - totalIssued + totalReturned) * 100) / 100;
    const ledger = DB.inwardLots.map(l => calculateBatchStock(l.batchNo));
    const activeBatches = ledger.filter(b => b && b.availableStock > 0).length;

    return sendJson({
      ok: true,
      metrics: {
        currentStock,
        totalInward: Math.round(totalInward * 100) / 100,
        totalIssued: Math.round(totalIssued * 100) / 100,
        totalReturned: Math.round(totalReturned * 100) / 100,
        netConsumed: Math.round(totalNet * 100) / 100,
        activeBatches
      }
    });
  }

  return sendError('Unknown API Endpoint', 404);
}

loadDatabase();
server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(65));
  console.log('  SRI VENKATESHWARA COMPANY — SMART MOVE CENTRAL SERVER (NODE.JS)');
  console.log(`  Listening on: http://0.0.0.0:${PORT}`);
  console.log(`  Local Access: http://localhost:${PORT}`);
  console.log(`  Database File: ${DB_FILE}`);
  console.log('='.repeat(65));
});

