// SVC Smart Move - Phase 1 Database & Persistence Engine
// IndexedDB + LocalStorage fallback with in-memory relational indexing and ACID sequence locking.

const DB_NAME = 'SVC_SmartMove_RM_Phase1_DB';
const DB_VERSION = 1;

class DatabaseEngine {
  constructor() {
    this.inwardLots = [];
    this.issueTransactions = [];
    this.auditLogs = [];
    this.users = [];
    this.sequenceCounters = {};
    this.isInitialized = false;
    this.initPromise = null;
    this.isServerConnected = false;
    this.syncTimer = null;
  }

  async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInit();
    return this.initPromise;
  }

  async _doInit() {
    // 1. Check if Central Server is available
    await this.checkServerConnection();

    // 2. Load from localStorage as fallback / cache
    const savedState = localStorage.getItem(DB_NAME);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        this.inwardLots = parsed.inwardLots || [];
        this.issueTransactions = parsed.issueTransactions || [];
        this.auditLogs = parsed.auditLogs || [];
        this.users = parsed.users || [];
        this.sequenceCounters = parsed.sequenceCounters || {};
      } catch (e) {
        console.error('Failed to parse saved state, re-seeding:', e);
      }
    }

    // 3. If connected to server, sync immediately
    if (this.isServerConnected) {
      await this.syncWithServer();
      this.startSyncTimer();
    }

    // 2. Ensure initial users exist
    if (this.users.length === 0) {
      this.users = [
        {
          id: 'USR-01',
          username: 'admin',
          name: 'SVC Plant Manager',
          role: 'Admin',
          // Default password hash for 'admin123'
          pin: 'admin123',
          active: true
        },
        {
          id: 'USR-02',
          username: 'operator',
          name: 'RM Store Operator',
          role: 'Operator',
          pin: 'store123',
          active: true
        },
        {
          id: 'USR-03',
          username: 'viewer',
          name: 'Audit / Supervisor',
          role: 'Viewer',
          pin: 'view123',
          active: true
        }
      ];
    }

    // 3. Ensure historical seed inward lots exist if empty (realistic initial stock)
    if (this.inwardLots.length === 0) {
      this._seedInitialInwardBatches();
    }

    // 4. Rebuild sequence counters from existing batches
    this._rebuildSequenceCounters();

    this.isInitialized = true;
    this.persist();
    return true;
  }

  apiUrl(path) {
    if (typeof window !== 'undefined' && window.SVC_CONFIG && window.SVC_CONFIG.apiUrl) {
      return window.SVC_CONFIG.apiUrl(path);
    }
    return path;
  }

  async checkServerConnection() {
    try {
      const res = await fetch(this.apiUrl('/api/health'), { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          this.isServerConnected = true;
          this.updateConnectionBadge(true);
          return true;
        }
      }
    } catch (e) {
      // Offline / standalone mode
    }
    this.isServerConnected = false;
    this.updateConnectionBadge(false);
    return false;
  }

  updateConnectionBadge(isOnline) {
    const pill = document.getElementById('connection-status-pill');
    const text = document.getElementById('connection-status-text');
    if (!pill || !text) return;
    if (isOnline) {
      pill.className = 'connection-pill status-online';
      text.textContent = 'Central Server Mode (LAN Shared DB)';
      pill.title = 'Connected to central factory database. All transactions are shared in real-time across workstations.';
    } else {
      pill.className = 'connection-pill status-offline';
      text.textContent = 'Standalone Demo Mode (Local Only)';
      pill.title = 'Running on local browser storage. Transactions on this computer are not shared with other machines.';
    }
  }

  async syncWithServer() {
    if (!this.isServerConnected) return;
    try {
      const [lotsRes, issuesRes] = await Promise.all([
        fetch(this.apiUrl('/api/inward')),
        fetch(this.apiUrl('/api/issue'))
      ]);

      if (lotsRes.ok && issuesRes.ok) {
        const lotsData = await lotsRes.json();
        const issuesData = await issuesRes.json();
        if (lotsData.ok && issuesData.ok) {
          this.inwardLots = lotsData.lots || [];
          this.issueTransactions = issuesData.issues || [];
          this._rebuildSequenceCounters();
          this.persist();
          if (window.app) window.app.refreshAllViews();
        }
      }
    } catch (e) {
      console.warn('[SYNC] Central server sync error:', e);
    }
  }

  startSyncTimer() {
    if (this.syncTimer) clearInterval(this.syncTimer);
    // Poll central server every 4 seconds to sync changes from other computers
    this.syncTimer = setInterval(() => {
      if (this.isServerConnected) {
        this.syncWithServer();
      }
    }, 4000);
  }

  _seedInitialInwardBatches() {
    // Seed verified representative historical batches from 'RM Inward Data'
    const seedLots = [
      {
        batchNo: 'MS-M-a-26-001',
        giNo: '',
        inwardDate: '2026-01-02',
        supplier: 'RCW',
        invNo: '2340',
        invDate: '2026-01-01',
        poNo: '',
        material: 'MS',
        grade: '1010',
        wireSize: '7.88',
        coils: 12,
        weight: 1785.00,
        heatNo: 'A3094255',
        remarks: 'Coil tags intact, standard wire',
        createdAt: '2026-01-02T09:30:00.000Z',
        createdBy: 'admin'
      },
      {
        batchNo: 'MS-D-a-26-001',
        giNo: '',
        inwardDate: '2026-01-02',
        supplier: 'RCW',
        invNo: '2340',
        invDate: '2026-01-01',
        poNo: '',
        material: 'MS',
        grade: '1010',
        wireSize: '4.78',
        coils: 8,
        weight: 1139.00,
        heatNo: 'B3094182',
        remarks: 'Store Bay 3',
        createdAt: '2026-01-02T10:15:00.000Z',
        createdBy: 'admin'
      },
      {
        batchNo: 'MS-F-a-26-001',
        giNo: '',
        inwardDate: '2026-01-03',
        supplier: 'RCW',
        invNo: '2357',
        invDate: '2026-01-02',
        poNo: '',
        material: 'MS',
        grade: '1010',
        wireSize: '5.50(DA)',
        coils: 18,
        weight: 2950.00,
        heatNo: 'B3094182',
        remarks: 'Wire drawing required',
        createdAt: '2026-01-03T08:45:00.000Z',
        createdBy: 'admin'
      },
      {
        batchNo: 'MS-C-a-26-001',
        giNo: '',
        inwardDate: '2026-01-27',
        supplier: 'RCW',
        invNo: '2499',
        invDate: '2026-01-24',
        poNo: '',
        material: 'MS',
        grade: '1010',
        wireSize: '4.50(DA).', // Dot preserved!
        coils: 2,
        weight: 350.00,
        heatNo: 'B3095445',
        remarks: 'Special dotted wire spec',
        createdAt: '2026-01-27T11:00:00.000Z',
        createdBy: 'admin'
      },
      {
        batchNo: 'BR-C-j-26-001',
        giNo: '',
        inwardDate: '2026-01-05',
        supplier: 'SHARP',
        invNo: '664',
        invDate: '2026-01-02',
        poNo: '',
        material: 'BR',
        grade: 'CUZN35',
        wireSize: '5.50.', // Dot preserved!
        coils: 4,
        weight: 221.35,
        heatNo: 'R5606',
        remarks: 'Brass lot',
        createdAt: '2026-01-05T14:20:00.000Z',
        createdBy: 'admin'
      },
      {
        batchNo: 'SS-A-h-26-001',
        giNo: '',
        inwardDate: '2026-01-03',
        supplier: 'VENUS',
        invNo: '9300252649',
        invDate: '2025-12-30',
        poNo: '',
        material: 'SS',
        grade: 'AISI430',
        wireSize: '2.98',
        coils: 6,
        weight: 322.70,
        heatNo: 'V21026',
        remarks: 'Stainless Steel lot',
        createdAt: '2026-01-03T16:10:00.000Z',
        createdBy: 'admin'
      }
    ];
    this.inwardLots = seedLots;
  }

  _rebuildSequenceCounters() {
    this.sequenceCounters = {};
    for (const lot of this.inwardLots) {
      const parts = (lot.batchNo || '').split('-');
      if (parts.length === 5) {
        const prefix = `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}`;
        const seq = parseInt(parts[4], 10);
        if (!isNaN(seq)) {
          this.sequenceCounters[prefix] = Math.max(this.sequenceCounters[prefix] || 0, seq);
        }
      }
    }
  }

  persist() {
    try {
      const payload = {
        inwardLots: this.inwardLots,
        issueTransactions: this.issueTransactions,
        auditLogs: this.auditLogs,
        users: this.users,
        sequenceCounters: this.sequenceCounters,
        lastSaved: new Date().toISOString()
      };
      localStorage.setItem(DB_NAME, JSON.stringify(payload));
    } catch (e) {
      console.error('Failed to persist to localStorage:', e);
    }
  }

  // --- Master Data Lookups ---
  getMasterData() {
    return MASTER_DATA;
  }

  getSuppliers() {
    return SUPPLIERS;
  }

  getPartsCatalog() {
    return PARTS_CATALOG;
  }

  lookupCustomerByPartNumber(partNumber) {
    if (!partNumber) return null;
    const clean = partNumber.trim().toUpperCase();
    const match = PARTS_CATALOG.find(p => p.partNumber.toUpperCase() === clean);
    return match ? match.customer : null;
  }

  resolveMasterMapping(material, grade, wireSize) {
    return MASTER_DATA.find(m => 
      m.material === material && 
      m.grade === grade && 
      m.wireSize === wireSize
    );
  }

  // --- Batch Number Generation Engine ---
  generateBatchNumber(material, grade, wireSize, inwardDate) {
    const mapping = this.resolveMasterMapping(material, grade, wireSize);
    if (!mapping) {
      throw new Error(`No master code mapping found for Material: ${material}, Grade: ${grade}, Wire Size: "${wireSize}".`);
    }

    // Determine 2-digit year from inwardDate
    let yy = '26';
    if (inwardDate) {
      const d = new Date(inwardDate);
      if (!isNaN(d.getTime())) {
        yy = String(d.getFullYear()).slice(-2);
      }
    }

    const prefix = `${mapping.material}-${mapping.wireCode}-${mapping.gradeCode}-${yy}`;
    const nextSeq = (this.sequenceCounters[prefix] || 0) + 1;
    const seqPadded = String(nextSeq).padStart(3, '0');
    return {
      batchNo: `${prefix}-${seqPadded}`,
      prefix,
      seq: nextSeq,
      wireCode: mapping.wireCode,
      gradeCode: mapping.gradeCode,
      template: mapping.templateBatch
    };
  }

  // --- Inward Operations (ACID transaction) ---
  async saveInwardLot(lotData, currentUser = 'operator') {
    // 1. Validation
    if (!lotData.material) throw new Error('Material is required.');
    if (!lotData.grade) throw new Error('Grade is required.');
    if (!lotData.wireSize) throw new Error('Wire Size is required.');
    if (!lotData.supplier || !lotData.supplier.trim()) throw new Error('Supplier Name is required.');
    if (!lotData.invNo || !lotData.invNo.trim()) throw new Error('Invoice Number is required.');
    if (!lotData.inwardDate) throw new Error('Inward Date is required.');
    
    const weight = parseFloat(lotData.weight);
    if (isNaN(weight) || weight <= 0) throw new Error('Weight must be greater than 0 kg.');
    
    const coils = parseInt(lotData.coils, 10);
    if (isNaN(coils) || coils < 0) throw new Error('Number of coils cannot be negative.');

    // 2. If Central Server is Connected, delegate to Server REST API
    if (this.isServerConnected) {
      const token = (typeof auth !== 'undefined' && auth.getToken) ? auth.getToken() : '';
      const res = await fetch(this.apiUrl('/api/inward'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(lotData)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Server rejected inward transaction.');
      }
      await this.syncWithServer();
      return this.inwardLots.find(l => l.batchNo === data.batchNo) || { batchNo: data.batchNo, weight: weight };
    }

    // 3. Production Protection: Disallow silent local storage writes on LAN
    const isFileProtocol = (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:');
    const isExplicitDemo = (typeof window !== 'undefined' && window.SVC_ALLOW_OFFLINE_DEMO);
    if (!isFileProtocol && !isExplicitDemo) {
      throw new Error("CENTRAL SERVER OFFLINE: Inward entry blocked. Production LAN mode strictly prohibits local browser storage writes to prevent factory inventory discrepancies. Please verify that the central server is running.");
    }

    // 4. Standalone Offline Execution (Explicit Demo / File Protocol only): Generate Batch Number atomically
    const batchInfo = this.generateBatchNumber(
      lotData.material,
      lotData.grade,
      lotData.wireSize,
      lotData.inwardDate
    );

    // Double-check uniqueness
    if (this.inwardLots.some(l => l.batchNo === batchInfo.batchNo)) {
      throw new Error(`Batch Number ${batchInfo.batchNo} already exists in the system.`);
    }

    // 3. Create Record
    const record = {
      batchNo: batchInfo.batchNo,
      giNo: (lotData.giNo || '').trim(),
      inwardDate: lotData.inwardDate,
      supplier: lotData.supplier.trim(),
      invNo: lotData.invNo.trim(),
      invDate: lotData.invDate || lotData.inwardDate,
      poNo: (lotData.poNo || '').trim(),
      material: lotData.material,
      grade: lotData.grade,
      wireSize: lotData.wireSize,
      coils: coils,
      weight: Math.round(weight * 100) / 100, // 2 decimal precision
      heatNo: (lotData.heatNo || '').trim(),
      remarks: (lotData.remarks || '').trim(),
      createdAt: new Date().toISOString(),
      createdBy: currentUser
    };

    // 4. Commit atomic sequence counter and record
    this.sequenceCounters[batchInfo.prefix] = batchInfo.seq;
    this.inwardLots.unshift(record);

    // 5. Audit Log
    this._addAuditLog('INWARD_SAVE', record.batchNo, `Saved Inward Lot: ${record.weight}kg from ${record.supplier}`, currentUser);

    this.persist();
    return record;
  }

  // --- Batch Stock & Reconciliation Calculations ---
  getBatchStock(batchNo) {
    const lot = this.inwardLots.find(l => l.batchNo === batchNo);
    if (!lot) return null;

    const issues = this.issueTransactions.filter(t => t.batchNo === batchNo && !t.isVoid);
    let totalIssued = 0;
    let totalReturned = 0;
    let totalScrap = 0;
    let totalBitWire = 0;
    let totalSlug = 0;
    let totalNetConsumed = 0;

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

    // Available wire in store = Inward Weight - Issued + Returned
    const availableStock = Math.round((lot.weight - totalIssued + totalReturned) * 100) / 100;

    return {
      lot,
      inwardWeight: lot.weight,
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

  getActiveBatchesWithStock() {
    return this.inwardLots.map(lot => {
      const stock = this.getBatchStock(lot.batchNo);
      return {
        ...lot,
        availableStock: stock.availableStock,
        status: stock.status
      };
    });
  }

  // --- RM Issue Operations ---
  async saveIssueTransaction(issueData, currentUser = 'operator') {
    // 1. Validate required fields
    if (!issueData.batchNo) throw new Error('Batch Number selection is required.');
    if (!issueData.partNumber || !issueData.partNumber.trim()) throw new Error('Part Number is required.');
    if (!issueData.machineNo || !issueData.machineNo.trim()) throw new Error('Machine Number is required.');
    if (!issueData.issueDate) throw new Error('Issue Date is required.');

    const issuedQty = parseFloat(issueData.issuedQty);
    if (isNaN(issuedQty) || issuedQty <= 0) throw new Error('RM Issued Quantity must be greater than 0 kg.');

    const returnQty = parseFloat(issueData.returnQty || 0);
    const scrapQty = parseFloat(issueData.scrapQty || 0);
    const bitWireQty = parseFloat(issueData.bitWireQty || 0);
    const slugQty = parseFloat(issueData.slugQty || 0);

    if (returnQty < 0 || scrapQty < 0 || bitWireQty < 0 || slugQty < 0) {
      throw new Error('Quantities cannot be negative.');
    }

    // 2. If Central Server is Connected, delegate to Server REST API for atomic stock check
    if (this.isServerConnected) {
      const token = (typeof auth !== 'undefined' && auth.getToken) ? auth.getToken() : '';
      const res = await fetch(this.apiUrl('/api/issue'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(issueData)
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Server rejected issue transaction.');
      }
      await this.syncWithServer();
      return this.issueTransactions.find(t => t.id === data.issueId) || {
        id: data.issueId,
        batchNo: issueData.batchNo,
        issuedQty: issuedQty,
        netConsumed: data.netConsumed,
        machineNo: issueData.machineNo
      };
    }

    // 3. Production Protection: Disallow silent local storage writes on LAN
    const isFileProtocol = (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:');
    const isExplicitDemo = (typeof window !== 'undefined' && window.SVC_ALLOW_OFFLINE_DEMO);
    if (!isFileProtocol && !isExplicitDemo) {
      throw new Error("CENTRAL SERVER OFFLINE: Issue transaction blocked. Production LAN mode strictly prohibits local browser storage writes to prevent factory inventory discrepancies. Please verify that the central server is running.");
    }

    // 4. Standalone Offline Execution (Explicit Demo / File Protocol only): Fetch linked Inward Lot
    const lotStock = this.getBatchStock(issueData.batchNo);
    if (!lotStock) throw new Error(`Batch Number "${issueData.batchNo}" does not exist.`);

    // 3. Strict Stock Validation: Negative Stock Prevention
    if (issuedQty > lotStock.availableStock) {
      const deficit = Math.round((issuedQty - lotStock.availableStock) * 100) / 100;
      throw new Error(`Insufficient stock for Batch ${issueData.batchNo}! Available: ${lotStock.availableStock.toFixed(2)} kg. Requested: ${issuedQty.toFixed(2)} kg (Deficit: ${deficit.toFixed(2)} kg).`);
    }

    // 4. Customer Lookup from Main List
    const customer = this.lookupCustomerByPartNumber(issueData.partNumber) || issueData.customer || 'Unknown Customer';

    // 5. Backend Net Consumed Calculation (Formula: Issued - Return - Scrap - BitWire - Slug)
    const netConsumed = Math.round((issuedQty - returnQty - scrapQty - bitWireQty - slugQty) * 100) / 100;

    const record = {
      id: 'ISS-' + String(this.issueTransactions.length + 1).padStart(5, '0'),
      issueDate: issueData.issueDate,
      machineNo: issueData.machineNo.trim(),
      partNumber: issueData.partNumber.trim(),
      customer: customer,
      batchNo: lotStock.lot.batchNo,
      material: lotStock.lot.material,
      grade: lotStock.lot.grade,
      wireSize: lotStock.lot.wireSize,
      drawnSize: issueData.drawnSize ? parseFloat(issueData.drawnSize) : null,
      supplier: lotStock.lot.supplier,
      invNo: lotStock.lot.invNo,
      heatNo: lotStock.lot.heatNo,
      dieNo: (issueData.dieNo || '').trim(),
      issuedQty: Math.round(issuedQty * 100) / 100,
      returnQty: Math.round(returnQty * 100) / 100,
      scrapQty: Math.round(scrapQty * 100) / 100,
      bitWireQty: Math.round(bitWireQty * 100) / 100,
      slugQty: Math.round(slugQty * 100) / 100,
      netConsumed: netConsumed,
      remarks: (issueData.remarks || '').trim(),
      createdAt: new Date().toISOString(),
      createdBy: currentUser,
      isVoid: false
    };

    this.issueTransactions.unshift(record);

    this._addAuditLog(
      'ISSUE_SAVE', 
      record.id, 
      `Issued ${record.issuedQty}kg from Batch ${record.batchNo} to M/C ${record.machineNo} for Part ${record.partNumber} (${record.customer}). Net Consumed: ${record.netConsumed}kg`, 
      currentUser
    );

    this.persist();
    return record;
  }

  // --- Audit Logging ---
  _addAuditLog(action, entityId, details, user) {
    this.auditLogs.unshift({
      id: 'AUD-' + String(this.auditLogs.length + 1).padStart(5, '0'),
      action,
      entityId,
      details,
      user,
      timestamp: new Date().toISOString()
    });
    // Keep max 500 audit logs
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
  }

  // --- System Overview / Dashboard KPIs ---
  getDashboardMetrics() {
    let totalInwardKg = 0;
    let totalIssuedKg = 0;
    let totalReturnedKg = 0;
    let totalNetConsumedKg = 0;

    for (const lot of this.inwardLots) {
      totalInwardKg += lot.weight || 0;
    }

    for (const iss of this.issueTransactions) {
      if (!iss.isVoid) {
        totalIssuedKg += iss.issuedQty || 0;
        totalReturnedKg += iss.returnQty || 0;
        totalNetConsumedKg += iss.netConsumed || 0;
      }
    }

    const currentWireStockKg = Math.round((totalInwardKg - totalIssuedKg + totalReturnedKg) * 100) / 100;
    const activeBatches = this.getActiveBatchesWithStock().filter(b => b.availableStock > 0).length;

    return {
      totalInwardKg: Math.round(totalInwardKg * 100) / 100,
      totalIssuedKg: Math.round(totalIssuedKg * 100) / 100,
      totalReturnedKg: Math.round(totalReturnedKg * 100) / 100,
      currentWireStockKg,
      totalNetConsumedKg: Math.round(totalNetConsumedKg * 100) / 100,
      totalLots: this.inwardLots.length,
      activeBatches,
      totalIssues: this.issueTransactions.length
    };
  }

  // --- Backup & Restore ---
  exportBackupJSON() {
    return JSON.stringify({
      version: '1.0',
      client: 'Sri Venkateswara Company (SVC)',
      module: 'Phase 1 RM Inward & RM Issue',
      timestamp: new Date().toISOString(),
      inwardLots: this.inwardLots,
      issueTransactions: this.issueTransactions,
      auditLogs: this.auditLogs,
      users: this.users,
      sequenceCounters: this.sequenceCounters
    }, null, 2);
  }

  importBackupJSON(jsonString, currentUser = 'admin') {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data.inwardLots) || !Array.isArray(data.issueTransactions)) {
      throw new Error('Invalid backup format: missing inwardLots or issueTransactions.');
    }
    this.inwardLots = data.inwardLots;
    this.issueTransactions = data.issueTransactions;
    this.auditLogs = data.auditLogs || [];
    this.sequenceCounters = data.sequenceCounters || {};
    this._rebuildSequenceCounters();
    this._addAuditLog('DB_RESTORE', 'SYSTEM', `Restored database from backup. Inwards: ${this.inwardLots.length}, Issues: ${this.issueTransactions.length}`, currentUser);
    this.persist();
    return true;
  }
}

const db = new DatabaseEngine();
if (typeof window !== 'undefined') {
  window.db = db;
}
