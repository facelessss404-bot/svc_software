// SVC Smart Move - Phase 1: Stock Ledger, Reconciliation & Backup Controller
// Directly implements the 'Balance check' workbook logic for Lot-by-Lot traceability.

class LedgerModule {
  constructor(app) {
    this.app = app;
    this.searchQuery = '';
    this.statusFilter = '';
    this.currentPage = 1;
    this.pageSize = 10;
  }

  init() {
    this.renderLedger();
    this.renderAuditLogs();
    this.bindBackupActions();
  }

  renderLedger() {
    const container = document.getElementById('ledger-container');
    if (!container) return;

    let batches = db.getActiveBatchesWithStock();

    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      batches = batches.filter(b =>
        b.batchNo.toLowerCase().includes(q) ||
        b.supplier.toLowerCase().includes(q) ||
        b.material.toLowerCase().includes(q) ||
        b.grade.toLowerCase().includes(q) ||
        b.wireSize.toLowerCase().includes(q)
      );
    }

    if (this.statusFilter) {
      batches = batches.filter(b => b.status === this.statusFilter);
    }

    const totalCount = batches.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / this.pageSize));
    if (this.currentPage > totalPages) this.currentPage = totalPages;

    const startIdx = (this.currentPage - 1) * this.pageSize;
    const pageBatches = batches.slice(startIdx, startIdx + this.pageSize);

    container.innerHTML = `
      <div class="table-card">
        <div class="table-toolbar">
          <div class="toolbar-search">
            <input type="text" id="ledger-search" placeholder="Search Batch, Supplier, Material, Grade..." value="${this.searchQuery}" class="form-control" />
          </div>
          <div class="toolbar-filters">
            <select id="ledger-status-filter" class="form-control">
              <option value="">All Statuses</option>
              <option value="In Stock" ${this.statusFilter === 'In Stock' ? 'selected' : ''}>In Stock</option>
              <option value="Low Stock" ${this.statusFilter === 'Low Stock' ? 'selected' : ''}>Low Stock (< 100kg)</option>
              <option value="Exhausted" ${this.statusFilter === 'Exhausted' ? 'selected' : ''}>Exhausted (0kg)</option>
            </select>
            <button id="ledger-clear-filters" class="btn btn-secondary btn-sm">Reset</button>
            <button id="btn-export-ledger-csv" class="btn btn-accent btn-sm">Export CSV</button>
          </div>
        </div>

        <div class="table-scroll-hint header-mobile-only">
          <span>↔ Swipe table horizontally • Sticky Batch No • Tap row for details</span>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Batch Number</th>
                <th>Inward Date</th>
                <th>Supplier</th>
                <th>Material</th>
                <th>Wire Spec</th>
                <th>Inward Wt (kg)</th>
                <th>Total Issued (kg)</th>
                <th>Total Return (kg)</th>
                <th>Net Consumed (kg)</th>
                <th>Available Balance (kg)</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${pageBatches.length === 0 ? `
                <tr><td colspan="12" class="text-center py-4 text-muted">No stock balance records found.</td></tr>
              ` : pageBatches.map(b => {
                const batchNo = b.batchNo || b.batch_no || '';
                const inwardDate = b.inwardDate || b.inward_date || '-';
                const supplier = b.supplier || '-';
                const wireSize = b.wireSize || b.wire_size || '-';
                const stock = db.getBatchStock(batchNo) || { inwardWeight: b.weight || 0, totalIssued: 0, totalReturned: 0, totalNetConsumed: 0, availableStock: b.weight || 0, status: 'In Stock', issueCount: 0 };
                const statusClass = stock.status === 'In Stock' ? 'status-ok' : stock.status === 'Low Stock' ? 'status-warn' : 'status-danger';
                return `
                  <tr data-batch="${batchNo}" class="clickable-row">
                    <td><strong class="font-mono text-gold">${batchNo}</strong></td>
                    <td>${inwardDate}</td>
                    <td>${supplier}</td>
                    <td><span class="badge badge-mat">${b.material}</span></td>
                    <td>${b.grade} <code>${wireSize}</code></td>
                    <td><strong>${stock.inwardWeight.toFixed(2)}</strong></td>
                    <td class="text-warning">${stock.totalIssued.toFixed(2)}</td>
                    <td class="text-info">${stock.totalReturned.toFixed(2)}</td>
                    <td>${stock.totalNetConsumed.toFixed(2)}</td>
                    <td><strong class="${stock.availableStock <= 0 ? 'text-danger' : 'text-success'}">${stock.availableStock.toFixed(2)}</strong></td>
                    <td><span class="badge ${statusClass}">${stock.status}</span></td>
                    <td>
                      <button class="btn btn-secondary btn-xs btn-view-trace" data-batch="${batchNo}">
                        Trace (${stock.issueCount})
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="table-pagination">
          <span class="text-muted">Showing ${totalCount === 0 ? 0 : startIdx + 1} to ${Math.min(startIdx + this.pageSize, totalCount)} of ${totalCount} lots</span>
          <div class="pagination-buttons">
            <button id="ledger-prev-page" class="btn btn-secondary btn-sm" ${this.currentPage <= 1 ? 'disabled' : ''}>Prev</button>
            <span class="page-indicator">Page ${this.currentPage} / ${totalPages}</span>
            <button id="ledger-next-page" class="btn btn-secondary btn-sm" ${this.currentPage >= totalPages ? 'disabled' : ''}>Next</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('ledger-search')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.currentPage = 1;
      this.renderLedger();
    });

    document.getElementById('ledger-status-filter')?.addEventListener('change', (e) => {
      this.statusFilter = e.target.value;
      this.currentPage = 1;
      this.renderLedger();
    });

    document.getElementById('ledger-clear-filters')?.addEventListener('click', () => {
      this.searchQuery = '';
      this.statusFilter = '';
      this.currentPage = 1;
      this.renderLedger();
    });

    document.getElementById('ledger-prev-page')?.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.renderLedger();
      }
    });

    document.getElementById('ledger-next-page')?.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.renderLedger();
      }
    });

    document.querySelectorAll('.btn-view-trace').forEach(btn => {
      btn.addEventListener('click', () => {
        const batchNo = btn.dataset.batch;
        this.openBatchTraceModal(batchNo);
      });
    });

    document.getElementById('btn-export-ledger-csv')?.addEventListener('click', () => {
      this.exportLedgerCSV();
    });
  }

  openBatchTraceModal(batchNo) {
    const stock = db.getBatchStock(batchNo);
    if (!stock) return;

    const issues = db.issueTransactions.filter(t => t.batchNo === batchNo);
    const modal = document.getElementById('trace-modal');
    const content = document.getElementById('trace-modal-body');
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="trace-header-card">
        <div class="trace-title">
          <span class="text-muted">Traceability Card:</span>
          <strong class="font-mono text-gold text-xl">${stock.lot.batchNo}</strong>
        </div>
        <div class="trace-meta-grid">
          <div><span class="text-muted">Supplier:</span> <strong>${stock.lot.supplier}</strong></div>
          <div><span class="text-muted">Invoice No:</span> <strong>${stock.lot.invNo}</strong> (${stock.lot.invDate})</div>
          <div><span class="text-muted">Material / Grade:</span> <strong>${stock.lot.material} - ${stock.lot.grade}</strong></div>
          <div><span class="text-muted">Wire Size:</span> <code>${stock.lot.wireSize}</code></div>
          <div><span class="text-muted">Heat / TC No:</span> <strong>${stock.lot.heatNo || '-'}</strong></div>
          <div><span class="text-muted">Initial Inward:</span> <strong>${stock.inwardWeight.toFixed(2)} kg</strong> (${stock.lot.coils} coils)</div>
          <div><span class="text-muted">Total Issued:</span> <strong class="text-warning">${stock.totalIssued.toFixed(2)} kg</strong></div>
          <div><span class="text-muted">Total Returned:</span> <strong class="text-info">${stock.totalReturned.toFixed(2)} kg</strong></div>
          <div><span class="text-muted">Current Balance:</span> <strong class="text-success text-lg">${stock.availableStock.toFixed(2)} kg</strong></div>
        </div>
      </div>

      <h4 class="mt-4 mb-2">Machine Issue Transaction History (${issues.length})</h4>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tx ID</th>
              <th>Date</th>
              <th>M/C</th>
              <th>Part Number</th>
              <th>Customer</th>
              <th>Issued (kg)</th>
              <th>Return (kg)</th>
              <th>Scrap (kg)</th>
              <th>Net Consumed</th>
            </tr>
          </thead>
          <tbody>
            ${issues.length === 0 ? `
              <tr><td colspan="9" class="text-center py-3 text-muted">No issues recorded against this batch yet.</td></tr>
            ` : issues.map(iss => `
              <tr>
                <td><code>${iss.id}</code></td>
                <td>${iss.issueDate}</td>
                <td><span class="badge badge-mach">${iss.machineNo}</span></td>
                <td><code>${iss.partNumber}</code></td>
                <td><strong>${iss.customer}</strong></td>
                <td class="text-warning"><strong>${iss.issuedQty.toFixed(2)}</strong></td>
                <td>${iss.returnQty.toFixed(2)}</td>
                <td>${iss.scrapQty.toFixed(2)}</td>
                <td class="text-success"><strong>${iss.netConsumed.toFixed(2)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  renderAuditLogs() {
    const container = document.getElementById('audit-log-container');
    if (!container) return;

    const logs = db.auditLogs.slice(0, 50);

    container.innerHTML = `
      <div class="table-card">
        <div class="card-header">
          <h3>System Audit Trail (Last 50 Events)</h3>
        </div>
        <div class="table-scroll-hint header-mobile-only">
          <span>↔ Swipe table horizontally • Sticky Batch No • Tap row for details</span>
        </div>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity Reference</th>
                <th>User</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length === 0 ? `
                <tr><td colspan="6" class="text-center py-3 text-muted">No audit events recorded.</td></tr>
              ` : logs.map(l => `
                <tr>
                  <td><code>${l.id}</code></td>
                  <td>${new Date(l.timestamp).toLocaleString()}</td>
                  <td><span class="badge badge-mach">${l.action}</span></td>
                  <td><strong class="font-mono text-gold">${l.entityId}</strong></td>
                  <td><strong>${l.user}</strong></td>
                  <td>${l.details}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  bindBackupActions() {
    // Export JSON Backup
    document.getElementById('btn-export-backup')?.addEventListener('click', () => {
      const jsonStr = db.exportBackupJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SVC_SmartMove_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.app.showNotification('Database backup exported successfully!', 'success');
    });

    // Import JSON Backup
    const fileInput = document.getElementById('backup-file-input');
    document.getElementById('btn-trigger-restore')?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          db.importBackupJSON(event.target.result);
          this.app.showNotification('Database restored successfully from backup!', 'success');
          this.app.refreshAllViews();
        } catch (err) {
          this.app.showNotification(`Restore failed: ${err.message}`, 'error');
        }
      };
      reader.readAsText(file);
    });
  }

  exportLedgerCSV() {
    const batches = db.getActiveBatchesWithStock();
    const headers = [
      'Batch Number', 'Inward Date', 'Supplier', 'Invoice No', 'Material',
      'Grade', 'Wire Size', 'Inward Weight (kg)', 'Total Issued (kg)',
      'Total Returned (kg)', 'Net Consumed (kg)', 'Available Balance (kg)', 'Status'
    ];
    const rows = batches.map(b => {
      const stock = db.getBatchStock(b.batchNo);
      return [
        `"${b.batchNo}"`,
        `"${b.inwardDate}"`,
        `"${b.supplier}"`,
        `"${b.invNo}"`,
        `"${b.material}"`,
        `"${b.grade}"`,
        `"${b.wireSize}"`,
        stock.inwardWeight.toFixed(2),
        stock.totalIssued.toFixed(2),
        stock.totalReturned.toFixed(2),
        stock.totalNetConsumed.toFixed(2),
        stock.availableStock.toFixed(2),
        `"${stock.status}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SVC_RM_Stock_Reconciliation_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.app.showNotification('Stock Reconciliation CSV downloaded!', 'success');
  }
}

if (typeof window !== 'undefined') {
  window.LedgerModule = LedgerModule;
}
